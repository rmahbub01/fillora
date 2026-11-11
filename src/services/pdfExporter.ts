import { FormField, PageInfo } from '../types/pdf';
import { getEffectiveFontSizePts } from '../utils/typography';

export class PdfExporterService {
  /**
   * Export a clean, flattened PDF with all filled fields and checkboxes baked in.
   * Completely omits empty/unanswered fields, handles, and editing artifacts.
   * Utilizes high-DPI offscreen canvas rendering to guarantee 100% flawless OpenType
   * shaping for Bangla conjuncts (যুক্তাক্ষর), vowel signs (কার), and complex scripts.
   */
  public async exportFlattenedPdf(
    originalPdfBytes: ArrayBuffer,
    fields: FormField[],
    pageInfos: PageInfo[],
    scope: 'all' | 'current' = 'all',
    activePageIndex: number = 0
  ): Promise<Uint8Array> {
    // Dynamically load pdf-lib on demand only when exporting
    const { PDFDocument } = await import('pdf-lib');

    // Clone the bytes to ensure it can never be detached
    const pdfDataBytes = new Uint8Array(originalPdfBytes.slice(0));
    const pdfDoc = await PDFDocument.load(pdfDataBytes);
    const numPages = pdfDoc.getPageCount();

    // Group fields by pageIndex
    const fieldsByPage = new Map<number, FormField[]>();
    for (const f of fields) {
      // Only keep fields that actually have user data
      const hasText = f.type !== 'checkbox' && f.value.trim().length > 0;
      const hasCheck = f.type === 'checkbox' && f.checkboxState !== 'empty';

      if (hasText || hasCheck) {
        if (!fieldsByPage.has(f.pageIndex)) {
          fieldsByPage.set(f.pageIndex, []);
        }
        fieldsByPage.get(f.pageIndex)!.push(f);
      }
    }

    const pagesToProcess = scope === 'current' 
      ? [activePageIndex] 
      : Array.from({ length: numPages }, (_, i) => i);

    for (const pageIdx of pagesToProcess) {
      if (pageIdx >= numPages) continue;

      const page = pdfDoc.getPage(pageIdx);
      const pageInfo = pageInfos.find((p) => p.pageIndex === pageIdx);
      const pageWidth = pageInfo ? pageInfo.width : page.getWidth();
      const pageHeight = pageInfo ? pageInfo.height : page.getHeight();
      const pageFields = fieldsByPage.get(pageIdx) || [];

      for (const field of pageFields) {
        // Calculate field box in PDF coordinate system
        // Note: PDF origin (0, 0) is at Bottom-Left, while browser/normalized box is Top-Left
        const pdfBoxX = field.box.x * pageWidth;
        const pdfBoxW = field.box.width * pageWidth;
        const pdfBoxH = field.box.height * pageHeight;
        const pdfBoxY = pageHeight - (field.box.y * pageHeight) - pdfBoxH;

        if (field.type === 'checkbox') {
          // Render checkbox symbol
          const pngBytes = await this.renderCheckboxToPng(field, pdfBoxW, pdfBoxH);
          if (pngBytes) {
            const pngImage = await pdfDoc.embedPng(pngBytes);
            page.drawImage(pngImage, {
              x: pdfBoxX,
              y: pdfBoxY,
              width: pdfBoxW,
              height: pdfBoxH,
            });
          }
        } else {
          // Render text with complex Bengali HarfBuzz shaping on high-DPI canvas
          // Supports natural visual overflow (for increased font size or long text) with 100% position parity
          const result = await this.renderTextToPng(field, pdfBoxW, pdfBoxH);
          if (result && result.bytes) {
            const pngImage = await pdfDoc.embedPng(result.bytes);
            const { drawXOffset, drawYOffset, totalWidthPts, totalHeightPts } = result.renderInfo;
            page.drawImage(pngImage, {
              x: pdfBoxX - drawXOffset,
              y: pdfBoxY - drawYOffset,
              width: totalWidthPts,
              height: totalHeightPts,
            });
          }
        }
      }
    }

    return await pdfDoc.save();
  }

  /**
   * Render text with complex script shaping (Bengali / English) to a transparent PNG.
   * Uses 8x resolution (approx 576-600 DPI) to produce razor-sharp vector-grade typography.
   * In multi-line mode, text grows outside naturally without top/bottom padding or cropping.
   */
  private async renderTextToPng(
    field: FormField,
    widthPts: number,
    heightPts: number
  ): Promise<{
    bytes: Uint8Array | null;
    actualHeightPts: number;
    renderInfo: {
      drawXOffset: number;
      drawYOffset: number;
      totalWidthPts: number;
      totalHeightPts: number;
    };
  }> {
    const scaleFactor = 8; // 8x supersampling for 576-600 DPI razor-sharp print quality
    const effectiveSizePts = getEffectiveFontSizePts(field, widthPts, heightPts);
    const fontSizePx = effectiveSizePts * scaleFactor;
    const fontFamily = field.fontFamily.includes(' ') && !field.fontFamily.includes('"')
      ? `"${field.fontFamily}"`
      : field.fontFamily;

    const fontStyle = field.italic ? 'italic ' : '';
    const fontWeight = field.bold ? 'bold ' : '';
    const fullFontSpec = `${fontStyle}${fontWeight}${fontSizePx}px ${fontFamily}, Kalpurush, Nikosh, "Noto Sans Bengali", sans-serif`;

    // Explicitly preload font at target size to ensure vector glyphs are used
    try {
      await Promise.all([
        document.fonts.load(`${fontStyle}${fontWeight}${fontSizePx}px ${fontFamily}`),
        document.fonts.load(`${fontStyle}${fontWeight}${fontSizePx}px "Kalpurush"`),
        document.fonts.load(`${fontStyle}${fontWeight}${fontSizePx}px "Nikosh"`),
        document.fonts.load(`${fontStyle}${fontWeight}${fontSizePx}px "Noto Sans Bengali"`),
      ]);
    } catch {}
    await document.fonts.ready;

    // Temporary canvas for exact text measurement
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) {
      return {
        bytes: null,
        actualHeightPts: heightPts,
        renderInfo: { drawXOffset: 0, drawYOffset: 0, totalWidthPts: widthPts, totalHeightPts: heightPts },
      };
    }
    measureCtx.font = fullFontSpec;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        bytes: null,
        actualHeightPts: heightPts,
        renderInfo: { drawXOffset: 0, drawYOffset: 0, totalWidthPts: widthPts, totalHeightPts: heightPts },
      };
    }

    if (field.multiline) {
      // Top and bottom padding removed in multi-line mode; text starts directly at top
      const padXPts = 4;
      const padXPx = padXPts * scaleFactor;
      const padY = 0;
      const availableWidth = Math.max(10, widthPts * scaleFactor - padXPx * 2);

      // Preserve explicit newlines and word-wrap each paragraph within available width
      const paragraphs = field.value.split('\n');
      const lines: string[] = [];

      for (const para of paragraphs) {
        if (!para.trim()) {
          lines.push('');
          continue;
        }
        const words = para.split(/\s+/);
        let currentLine = '';

        for (const word of words) {
          // If the word itself is wider than availableWidth, break it by character
          if (measureCtx.measureText(word).width > availableWidth) {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = '';
            }
            let chunk = '';
            for (const ch of word) {
              if (measureCtx.measureText(chunk + ch).width > availableWidth && chunk) {
                lines.push(chunk);
                chunk = ch;
              } else {
                chunk += ch;
              }
            }
            currentLine = chunk;
            continue;
          }

          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = measureCtx.measureText(testLine);
          if (metrics.width > availableWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);
      }

      // Measure maximum line width across all wrapped lines
      let maxLineWPx = 0;
      for (const line of lines) {
        if (line) {
          const w = measureCtx.measureText(line).width;
          if (w > maxLineWPx) maxLineWPx = w;
        }
      }
      const maxLineWPts = maxLineWPx / scaleFactor;

      const lineSpacing = field.lineHeight ?? 1.35;
      const lineHeightPx = fontSizePx * lineSpacing;
      // In CSS, line boxes distribute half the extra space between line-height and font-size to the top and bottom.
      // Applying this exact half-leading ensures line 0 starts comfortably inside the box boundary with exact browser parity.
      const halfLeadingPx = (lineHeightPx - fontSizePx) / 2;
      const totalTextHPx = Math.max(1, lines.length) * lineHeightPx;
      const totalTextHPts = totalTextHPx / scaleFactor;
      // Allow text to grow outside the original box height if content requires more vertical space
      const actualHeightPts = Math.max(heightPts, totalTextHPx / scaleFactor);

      // Vertical offset within the bounding box based on field.vAlign (top, middle, bottom)
      let vOffsetPts = 0;
      if (field.vAlign === 'middle') {
        vOffsetPts = (heightPts - totalTextHPts) / 2;
      } else if (field.vAlign === 'bottom') {
        vOffsetPts = heightPts - totalTextHPts;
      }
      const vOffsetPx = vOffsetPts * scaleFactor;

      // Calculate directional bleed to prevent ascenders, descenders, or horizontal text from being cut
      let bleedTopPts = Math.ceil(effectiveSizePts * 0.35 + 4);
      const bleedBottomExtraPts = Math.ceil(effectiveSizePts * 0.35 + 4);
      let bleedBottomPts = (actualHeightPts - heightPts) + bleedBottomExtraPts;

      if (vOffsetPts < 0) {
        bleedTopPts += Math.ceil(-vOffsetPts);
      }
      if (field.vAlign === 'bottom' && vOffsetPts < 0) {
        bleedBottomPts = bleedBottomExtraPts;
      } else if (field.vAlign === 'middle' && vOffsetPts < 0) {
        bleedBottomPts = Math.ceil(-vOffsetPts) + bleedBottomExtraPts;
      }

      let bleedLeftPts = 4;
      let bleedRightPts = 4;

      if (field.hAlign === 'left') {
        const neededWidthPts = padXPts + maxLineWPts;
        if (neededWidthPts > widthPts) {
          bleedRightPts = Math.ceil(neededWidthPts - widthPts + 8);
        }
      } else if (field.hAlign === 'center') {
        if (maxLineWPts > widthPts - padXPts * 2) {
          const extraH = (maxLineWPts - (widthPts - padXPts * 2)) / 2 + 8;
          bleedLeftPts = Math.ceil(extraH);
          bleedRightPts = Math.ceil(extraH);
        }
      } else if (field.hAlign === 'right') {
        const neededWidthPts = padXPts + maxLineWPts;
        if (neededWidthPts > widthPts) {
          bleedLeftPts = Math.ceil(neededWidthPts - widthPts + 8);
        }
      }

      const canvasWidthPts = widthPts + bleedLeftPts + bleedRightPts;
      const canvasHeightPts = heightPts + bleedTopPts + bleedBottomPts;

      canvas.width = Math.ceil(canvasWidthPts * scaleFactor);
      canvas.height = Math.ceil(canvasHeightPts * scaleFactor);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.font = fullFontSpec;
      ctx.fillStyle = field.color || '#000000';
      ctx.textBaseline = 'top';

      const boxLeftPx = bleedLeftPts * scaleFactor;
      const boxTopPx = bleedTopPts * scaleFactor;
      const boxWidthPx = widthPts * scaleFactor;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const lineY = boxTopPx + vOffsetPx + halfLeadingPx + i * lineHeightPx;

        let lineX = boxLeftPx + padXPx;
        const lineWPx = ctx.measureText(line).width;
        if (field.hAlign === 'center') {
          lineX = boxLeftPx + (boxWidthPx - lineWPx) / 2;
        } else if (field.hAlign === 'right') {
          lineX = boxLeftPx + boxWidthPx - padXPx - lineWPx;
        }

        ctx.fillText(line, lineX, lineY);
        this.drawDecorations(ctx, field, lineX, lineY, lineWPx, fontSizePx, scaleFactor, 'top');
      }

      const bytes = await this.canvasToUint8Array(canvas);
      return {
        bytes,
        actualHeightPts,
        renderInfo: {
          drawXOffset: bleedLeftPts,
          drawYOffset: bleedBottomPts,
          totalWidthPts: canvasWidthPts,
          totalHeightPts: canvasHeightPts,
        },
      };
    } else {
      // Single line text: calculates bleed so large font size or long text overflows naturally without clipping
      const text = field.value || '';
      const textMetrics = measureCtx.measureText(text);
      const textWidthPx = textMetrics.width;
      const textWidthPts = textWidthPx / scaleFactor;

      const padXPts = 4;
      const padXPx = padXPts * scaleFactor;

      // When font size is too big, box height grows evenly in both sides (up and down)
      // When font size is equal or smaller than normal, box height keeps its original state (heightPts)
      const fontHeightPts = effectiveSizePts * (field.lineHeight ?? 1.35);
      const actualHeightPts = Math.max(heightPts, Math.ceil(fontHeightPts));
      const extraHeightPts = actualHeightPts - heightPts;
      const halfExtraHeightPts = extraHeightPts / 2;

      const bleedTopExtraPts = Math.max(2, Math.ceil(effectiveSizePts * 0.25));
      const bleedBottomExtraPts = Math.max(2, Math.ceil(effectiveSizePts * 0.15));
      let bleedTopPts = Math.round(halfExtraHeightPts) + bleedTopExtraPts;
      let bleedBottomPts = Math.round(halfExtraHeightPts) + bleedBottomExtraPts;

      // Horizontal overflow bleed (when text is wider than field box)
      let bleedLeftPts = 0;
      let bleedRightPts = 0;

      if (field.hAlign === 'left') {
        const neededWidthPts = padXPts + textWidthPts;
        if (neededWidthPts > widthPts) {
          bleedRightPts = Math.ceil(neededWidthPts - widthPts + 8);
        }
      } else if (field.hAlign === 'center') {
        if (textWidthPts > widthPts - padXPts * 2) {
          const extraH = (textWidthPts - (widthPts - padXPts * 2)) / 2 + 4;
          bleedLeftPts = Math.ceil(extraH);
          bleedRightPts = Math.ceil(extraH);
        }
      } else if (field.hAlign === 'right') {
        const neededWidthPts = padXPts + textWidthPts;
        if (neededWidthPts > widthPts) {
          bleedLeftPts = Math.ceil(neededWidthPts - widthPts + 8);
        }
      }

      const canvasWidthPts = widthPts + bleedLeftPts + bleedRightPts;
      const canvasHeightPts = actualHeightPts + bleedTopExtraPts + bleedBottomExtraPts;

      canvas.width = Math.ceil(canvasWidthPts * scaleFactor);
      canvas.height = Math.ceil(canvasHeightPts * scaleFactor);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.font = fullFontSpec;
      ctx.fillStyle = field.color || '#000000';

      // Bounding box bounds inside the enlarged canvas
      const boxLeftPx = bleedLeftPts * scaleFactor;
      const boxTopPx = bleedTopExtraPts * scaleFactor;
      const boxWidthPx = widthPts * scaleFactor;
      const boxHeightPx = actualHeightPts * scaleFactor;

      // Horizontal positioning
      let textX = boxLeftPx + padXPx;
      if (field.hAlign === 'center') {
        textX = boxLeftPx + (boxWidthPx - textWidthPx) / 2;
      } else if (field.hAlign === 'right') {
        textX = boxLeftPx + boxWidthPx - padXPx - textWidthPx;
      }

      // Vertical positioning matching browser flex layout
      let textY = boxTopPx + boxHeightPx / 2;
      ctx.textBaseline = 'middle';

      if (field.vAlign === 'top') {
        ctx.textBaseline = 'top';
        textY = boxTopPx;
      } else if (field.vAlign === 'bottom') {
        ctx.textBaseline = 'bottom';
        textY = boxTopPx + boxHeightPx;
      }

      ctx.fillText(text, textX, textY);
      this.drawDecorations(ctx, field, textX, textY, textWidthPx, fontSizePx, scaleFactor, ctx.textBaseline);

      const bytes = await this.canvasToUint8Array(canvas);
      return {
        bytes,
        actualHeightPts,
        renderInfo: {
          drawXOffset: bleedLeftPts,
          drawYOffset: bleedBottomPts,
          totalWidthPts: canvasWidthPts,
          totalHeightPts: canvasHeightPts,
        },
      };
    }
  }

  /**
   * Draw underline and strikethrough decorations for text
   */
  private drawDecorations(
    ctx: CanvasRenderingContext2D,
    field: FormField,
    x: number,
    y: number,
    width: number,
    fontSizePx: number,
    scaleFactor: number,
    baseline: CanvasTextBaseline
  ): void {
    if ((!field.underline && !field.strikethrough) || width <= 0) return;

    ctx.save();
    ctx.strokeStyle = field.color || '#000000';
    ctx.lineWidth = Math.max(1.5 * scaleFactor, Math.round(fontSizePx * 0.07));

    if (field.underline) {
      let underlineY = y;
      if (baseline === 'middle') {
        underlineY = y + fontSizePx * 0.45;
      } else if (baseline === 'top') {
        underlineY = y + fontSizePx * 0.95;
      } else if (baseline === 'bottom') {
        underlineY = y + fontSizePx * 0.12;
      }
      ctx.beginPath();
      ctx.moveTo(x, underlineY);
      ctx.lineTo(x + width, underlineY);
      ctx.stroke();
    }

    if (field.strikethrough) {
      let strikeY = y;
      if (baseline === 'middle') {
        strikeY = y;
      } else if (baseline === 'top') {
        strikeY = y + fontSizePx * 0.50;
      } else if (baseline === 'bottom') {
        strikeY = y - fontSizePx * 0.35;
      }
      ctx.beginPath();
      ctx.moveTo(x, strikeY);
      ctx.lineTo(x + width, strikeY);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Render checkbox mark (check ✓, cross ✗, or dot •) to a transparent PNG
   */
  private async renderCheckboxToPng(
    field: FormField,
    widthPts: number,
    heightPts: number
  ): Promise<Uint8Array | null> {
    const scaleFactor = 8;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(widthPts * scaleFactor);
    canvas.height = Math.ceil(heightPts * scaleFactor);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const w = canvas.width;
    const h = canvas.height;
    const color = field.color || '#111827';
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (field.checkboxState === 'check') {
      // Draw crisp checkmark
      ctx.lineWidth = Math.max(2, Math.floor(w * 0.12));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(w * 0.22, h * 0.52);
      ctx.lineTo(w * 0.42, h * 0.74);
      ctx.lineTo(w * 0.80, h * 0.26);
      ctx.stroke();
    } else if (field.checkboxState === 'cross') {
      // Draw cross mark
      ctx.lineWidth = Math.max(2, Math.floor(w * 0.12));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w * 0.25, h * 0.25);
      ctx.lineTo(w * 0.75, h * 0.75);
      ctx.moveTo(w * 0.75, h * 0.25);
      ctx.lineTo(w * 0.25, h * 0.75);
      ctx.stroke();
    } else if (field.checkboxState === 'dot') {
      // Draw solid filled circular dot
      const radius = Math.min(w, h) * 0.28;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    return await this.canvasToUint8Array(canvas);
  }

  private canvasToUint8Array(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(reader.result));
          } else {
            resolve(null);
          }
        };
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    });
  }
}

export const pdfExporter = new PdfExporterService();
