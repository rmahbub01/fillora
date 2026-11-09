import * as pdfjsLib from 'pdfjs-dist';
import { FormField, PageInfo } from '../types/pdf';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export class PdfRendererService {
  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  private pdfData: ArrayBuffer | null = null;
  private pageInfos: PageInfo[] = [];

  public async loadPdf(data: ArrayBuffer): Promise<PageInfo[]> {
    this.close();
    this.pdfData = data;
    
    // Load document with pdfjs
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(data),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/standard_fonts/',
    });

    this.pdfDoc = await loadingTask.promise;
    this.pageInfos = [];

    for (let i = 1; i <= this.pdfDoc.numPages; i++) {
      const page = await this.pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      this.pageInfos.push({
        pageNumber: i,
        pageIndex: i - 1,
        width: viewport.width,
        height: viewport.height,
        scale: 1.0,
        aspectRatio: viewport.width / viewport.height,
      });
    }

    return this.pageInfos;
  }

  public getRawData(): ArrayBuffer | null {
    return this.pdfData;
  }

  public getPageCount(): number {
    return this.pdfDoc ? this.pdfDoc.numPages : 0;
  }

  public getPageInfo(pageIndex: number): PageInfo | undefined {
    return this.pageInfos[pageIndex];
  }

  public async renderPageToCanvas(
    pageIndex: number,
    canvas: HTMLCanvasElement,
    scale: number = 1.5
  ): Promise<void> {
    if (!this.pdfDoc) return;
    const page = await this.pdfDoc.getPage(pageIndex + 1);
    
    // HiDPI support
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * dpr });
    
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport: viewport,
      intent: 'display',
    }).promise;
  }

  public async renderThumbnail(pageIndex: number, width: number = 160): Promise<string> {
    if (!this.pdfDoc) return '';
    const page = await this.pdfDoc.getPage(pageIndex + 1);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = width / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      intent: 'print',
    }).promise;

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  /**
   * Render high-resolution page image for ONNX model inference (e.g. 1216x1216 or native)
   */
  public async renderPageForInference(
    pageIndex: number,
    targetWidth: number = 1216,
    targetHeight: number = 1216
  ): Promise<ImageData> {
    if (!this.pdfDoc) throw new Error('No PDF loaded');
    const page = await this.pdfDoc.getPage(pageIndex + 1);
    const vp = page.getViewport({ scale: 1.0 });
    
    // Scale to fit within target dimensions preserving aspect ratio or fill target
    const scale = Math.min(targetWidth / vp.width, targetHeight / vp.height);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get 2D context');

    // Fill white background (standard for document YOLO models)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Center the page rendering
    const offsetX = (targetWidth - viewport.width) / 2;
    const offsetY = (targetHeight - viewport.height) / 2;
    ctx.save();
    ctx.translate(offsetX, offsetY);

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      intent: 'display',
    }).promise;

    ctx.restore();

    return ctx.getImageData(0, 0, targetWidth, targetHeight);
  }

  /**
   * Extract native AcroForm fields if present in the PDF
   */
  public async extractAcroForms(pageIndex: number): Promise<FormField[]> {
    if (!this.pdfDoc) return [];
    const page = await this.pdfDoc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1.0 });
    const annotations = await page.getAnnotations({ intent: 'display' });
    const fields: FormField[] = [];

    for (const annot of annotations) {
      if (annot.subtype === 'Widget' && annot.rect) {
        // PDF rect is [x1, y1, x2, y2] with origin at bottom-left
        const [x1, y1, x2, y2] = annot.rect;
        
        // Convert to top-left normalized coordinates [0..1]
        const normX = Math.min(x1, x2) / viewport.width;
        const normY = (viewport.height - Math.max(y1, y2)) / viewport.height;
        const normW = Math.abs(x2 - x1) / viewport.width;
        const normH = Math.abs(y2 - y1) / viewport.height;

        const isCheckbox = annot.fieldType === 'Btn' && !annot.radioButton;
        const isMultiline = Boolean(annot.multiLine);

        fields.push({
          id: `acro_${pageIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          pageIndex,
          type: isCheckbox ? 'checkbox' : (isMultiline ? 'textarea' : 'text'),
          label: annot.fieldName || annot.alternativeText || 'AcroField',
          box: {
            x: Math.max(0, Math.min(1, normX)),
            y: Math.max(0, Math.min(1, normY)),
            width: Math.max(0.01, Math.min(1, normW)),
            height: Math.max(0.01, Math.min(1, normH)),
          },
          value: annot.fieldValue || '',
          fontFamily: 'Kalpurush',
          fontSize: 12,
          autoFontSize: true,
          color: '#1a1a1a',
          hAlign: 'left',
          vAlign: 'middle',
          multiline: isMultiline,
          checkboxState: isCheckbox && annot.fieldValue === 'Yes' ? 'check' : 'empty',
          locked: true, // Locked by default per requirements
          confidence: 1.0,
          source: 'acroform',
        });
      }
    }

    return fields;
  }

  public close(): void {
    if (this.pdfDoc) {
      this.pdfDoc.cleanup();
      this.pdfDoc = null;
    }
    this.pdfData = null;
    this.pageInfos = [];
  }
}

export const pdfRenderer = new PdfRendererService();
