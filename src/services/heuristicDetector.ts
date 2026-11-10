import { BoundingBox, FormField, PageInfo } from '../types/pdf';

export class HeuristicDetector {
  /**
   * Detect visual form fields (lines, rectangular input boxes, checkboxes) from a rendered page canvas
   */
  public detectFieldsFromCanvas(
    canvas: HTMLCanvasElement,
    pageIndex: number,
    pageInfo: PageInfo
  ): FormField[] {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Convert to grayscale and binary threshold map (dark pixels = borders/lines)
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      // Luminance
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Dark lines/borders typically gray < 180
      binary[i / 4] = gray < 185 ? 1 : 0;
    }

    const candidateBoxes: { box: BoundingBox; type: FormField['type']; confidence: number }[] = [];

    // 1. Detect Horizontal Underlines (lines where dark pixels continue horizontally for >= 80px)
    const minLineLen = Math.floor(width * 0.08); // at least 8% of page width
    const maxLineLen = Math.floor(width * 0.90);
    const rowHist = new Int32Array(height);

    for (let y = 10; y < height - 10; y++) {
      let run = 0;
      let startX = 0;
      for (let x = 10; x < width - 10; x++) {
        if (binary[y * width + x] === 1) {
          if (run === 0) startX = x;
          run++;
        } else {
          if (run >= minLineLen && run <= maxLineLen) {
            // Check if this is an underline for text input (height above line is mostly white/empty)
            const boxH = Math.min(36, Math.floor(height * 0.035));
            const boxY = Math.max(0, y - boxH);
            
            // Check if region above is blank
            let emptyCount = 0;
            const sampleY = Math.floor(boxY + boxH * 0.5);
            for (let sx = startX; sx < startX + run; sx += 4) {
              if (binary[sampleY * width + sx] === 0) emptyCount++;
            }
            const emptyRatio = emptyCount / ((startX + run - startX) / 4);

            if (emptyRatio > 0.6) {
              candidateBoxes.push({
                box: {
                  x: Math.round((startX / width) * 1000) / 1000,
                  y: Math.round((boxY / height) * 1000) / 1000,
                  width: Math.round((run / width) * 1000) / 1000,
                  height: Math.round((boxH / height) * 1000) / 1000,
                },
                type: 'text',
                confidence: 0.82,
              });
            }
          }
          run = 0;
        }
      }
    }

    // 2. Detect Rectangular Boxes and Checkboxes
    // Scan connected components / bounding boxes of rectangular contours
    const boxes = this.findRectangles(binary, width, height);
    for (const b of boxes) {
      const normW = Math.round((b.w / width) * 1000) / 1000;
      const normH = Math.round((b.h / height) * 1000) / 1000;
      const normX = Math.round((b.x / width) * 1000) / 1000;
      const normY = Math.round((b.y / height) * 1000) / 1000;
      const aspect = b.w / b.h;

      // Checkbox: aspect ~0.7 to 1.4, size between 10px and 35px
      const isCheckboxSize = b.w >= 10 && b.w <= 36 && b.h >= 10 && b.h <= 36;
      if (isCheckboxSize && aspect >= 0.7 && aspect <= 1.4) {
        candidateBoxes.push({
          box: { x: normX, y: normY, width: normW, height: normH },
          type: 'checkbox',
          confidence: 0.88,
        });
      } else if (b.w >= 50 && b.h >= 16 && b.h <= 180 && normW < 0.95) {
        // Text field or multiline textarea
        const isMultiline = b.h > 45 || aspect < 2.0;
        candidateBoxes.push({
          box: { x: normX, y: normY, width: normW, height: normH },
          type: isMultiline ? 'textarea' : 'text',
          confidence: 0.85,
        });
      }
    }

    // Apply Non-Maximum Suppression to remove duplicate / heavily overlapping boxes
    const filtered = this.applyNms(candidateBoxes, 0.35);

    // Sort into natural reading order (top to bottom, then left to right)
    const sorted = this.sortWidgets(filtered);

    // Convert to FormField objects
    return sorted.map((item, idx) => ({
      id: `field_heur_${pageIndex}_${idx}_${Date.now()}`,
      pageIndex,
      type: item.type,
      label: item.type === 'checkbox' ? `Checkbox ${idx + 1}` : `Field ${idx + 1}`,
      box: item.box,
      value: '',
      fontFamily: 'Kalpurush',
      fontSize: item.type === 'textarea' ? 11 : 12,
      autoFontSize: true,
      color: '#111827',
      hAlign: 'left',
      vAlign: item.type === 'textarea' ? 'top' : 'middle',
      multiline: item.type === 'textarea',
      checkboxState: 'empty',
      locked: true, // Locked by default per requirements
      confidence: item.confidence,
      source: 'heuristic',
    }));
  }

  private findRectangles(
    binary: Uint8Array,
    width: number,
    height: number
  ): { x: number; y: number; w: number; h: number }[] {
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    const minEdge = 12;
    const maxW = Math.floor(width * 0.92);
    const maxH = Math.floor(height * 0.60);

    // Sample grid rows/cols to detect closed rectangles
    const step = 4;
    for (let y = 15; y < height - 15; y += step) {
      for (let x = 15; x < width - 15; x += step) {
        // If we encounter a top-left corner (dark pixel with dark right and down pixels)
        if (binary[y * width + x] === 1) {
          // Check horizontal top edge length
          let r = 1;
          while (x + r < width && binary[y * width + (x + r)] === 1 && r < maxW) {
            r++;
          }
          if (r >= minEdge) {
            // Check vertical left edge length
            let b = 1;
            while (y + b < height && binary[(y + b) * width + x] === 1 && b < maxH) {
              b++;
            }
            if (b >= minEdge) {
              // Verify bottom edge and right edge
              const rightEdgeX = x + r - 1;
              const bottomEdgeY = y + b - 1;
              
              let rightDark = 0;
              for (let sy = y; sy <= bottomEdgeY; sy += 2) {
                if (binary[sy * width + rightEdgeX] === 1) rightDark++;
              }
              let bottomDark = 0;
              for (let sx = x; sx <= rightEdgeX; sx += 2) {
                if (binary[bottomEdgeY * width + sx] === 1) bottomDark++;
              }

              const expectedR = (bottomEdgeY - y) / 2;
              const expectedB = (rightEdgeX - x) / 2;

              if (rightDark / Math.max(1, expectedR) > 0.4 && bottomDark / Math.max(1, expectedB) > 0.4) {
                rects.push({ x, y, w: r, h: b });
                // Skip ahead to avoid duplicate hits on same box
                x += Math.max(minEdge, Math.floor(r * 0.6));
              }
            }
          }
        }
      }
    }

    return rects;
  }

  private applyNms<T extends { box: BoundingBox; confidence: number }>(
    boxes: T[],
    iouThreshold: number
  ): T[] {
    const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
    const selected: T[] = [];

    for (const current of sorted) {
      let keep = true;
      for (const existing of selected) {
        if (this.calculateIoU(current.box, existing.box) > iouThreshold) {
          keep = false;
          break;
        }
      }
      if (keep) {
        selected.push(current);
      }
    }

    return selected;
  }

  private calculateIoU(a: BoundingBox, b: BoundingBox): number {
    const x0 = Math.max(a.x, b.x);
    const y0 = Math.max(a.y, b.y);
    const x1 = Math.min(a.x + a.width, b.x + b.width);
    const y1 = Math.min(a.y + a.height, b.y + b.height);

    const interW = Math.max(0, x1 - x0);
    const interH = Math.max(0, y1 - y0);
    const interArea = interW * interH;

    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    const unionArea = areaA + areaB - interArea;

    return unionArea > 0 ? interArea / unionArea : 0;
  }

  private sortWidgets<T extends { box: BoundingBox }>(widgets: T[]): T[] {
    const yThreshold = 0.015; // Vertical threshold for same line
    const sorted = [...widgets].sort((a, b) => {
      if (Math.abs(a.box.y - b.box.y) < yThreshold) {
        return a.box.x - b.box.x;
      }
      return a.box.y - b.box.y;
    });

    return sorted;
  }
}

export const heuristicDetector = new HeuristicDetector();
