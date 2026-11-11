import { FormField, ModelType, PageInfo } from '../types/pdf';
import { pdfRenderer } from './pdfRenderer';
import { heuristicDetector } from './heuristicDetector';

interface DetectionWorkerResult {
  x: number;
  y: number;
  width: number;
  height: number;
  classId: number;
  className: string;
  confidence: number;
}

export class AiDetectorService {
  private worker: Worker | null = null;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/detection.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return this.worker;
  }

  /**
   * Run detection on a single page using the chosen model
   */
  public async detectPage(
    pageIndex: number,
    modelType: ModelType,
    pageInfo: PageInfo,
    onProgress?: (percent: number, message: string) => void
  ): Promise<FormField[]> {
    // 1. Fast Heuristic Mode
    if (modelType === 'heuristic') {
      onProgress?.(30, 'Analyzing visual form elements & contours...');
      // Render page canvas for visual analysis
      const tempCanvas = document.createElement('canvas');
      await pdfRenderer.renderPageToCanvas(pageIndex, tempCanvas, 1.5);
      
      onProgress?.(70, 'Detecting lines, boxes, and checkboxes...');
      const heuristicFields = heuristicDetector.detectFieldsFromCanvas(tempCanvas, pageIndex, pageInfo);
      
      // Also merge AcroForms if any exist
      const acroFields = await pdfRenderer.extractAcroForms(pageIndex);
      const combined = this.mergeFieldLists(acroFields, heuristicFields);

      onProgress?.(100, `Found ${combined.length} fields`);
      return combined;
    }

    // 2. FFDNet-S / FFDNet-L Neural Detection
    if (modelType === 'ffdnet-s' || modelType === 'ffdnet-l') {
      onProgress?.(10, 'Rendering document page for neural analysis...');
      const targetSize = 1216;
      const imageData = await pdfRenderer.renderPageForInference(pageIndex, targetSize, targetSize);

      const worker = this.getWorker();
      const targetModel = modelType;

      const rawDetections = await new Promise<DetectionWorkerResult[]>((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          const data = e.data;
          if (data.pageIndex === pageIndex) {
            if (data.type === 'progress') {
              onProgress?.(data.percent, data.message);
            } else if (data.type === 'result') {
              worker.removeEventListener('message', handler);
              resolve(data.detections);
            } else if (data.type === 'error') {
              worker.removeEventListener('message', handler);
              reject(new Error(data.error));
            }
          }
        };

        worker.addEventListener('message', handler);
        worker.postMessage({
          type: 'detect',
          modelType: targetModel,
          pageIndex,
          imageData,
          confidenceThreshold: targetModel === 'ffdnet-l' ? 0.25 : 0.28,
        });
      });

      // Map letterboxed coordinates back to page normalized coordinates
      // The image was scaled to fit within targetSize x targetSize preserving aspect ratio:
      const scale = Math.min(targetSize / pageInfo.width, targetSize / pageInfo.height);
      const renderedW = pageInfo.width * scale;
      const renderedH = pageInfo.height * scale;
      const offsetX = (targetSize - renderedW) / 2;
      const offsetY = (targetSize - renderedH) / 2;

      const aiFields: FormField[] = rawDetections.map((det, idx) => {
        // Convert from 1216x1216 space to page normalized [0..1]
        const pixelX = det.x * targetSize;
        const pixelY = det.y * targetSize;
        const pixelW = det.width * targetSize;
        const pixelH = det.height * targetSize;

        const pageNormX = Math.round(Math.max(0, Math.min(1, (pixelX - offsetX) / renderedW)) * 10000) / 10000;
        const pageNormY = Math.round(Math.max(0, Math.min(1, (pixelY - offsetY) / renderedH)) * 10000) / 10000;
        const pageNormW = Math.round(Math.max(0.005, Math.min(1 - pageNormX, pixelW / renderedW)) * 10000) / 10000;
        const pageNormH = Math.round(Math.max(0.005, Math.min(1 - pageNormY, pixelH / renderedH)) * 10000) / 10000;

        const isCheckbox = det.className === 'ChoiceButton' || (det.width < 0.05 && det.height < 0.05);
        const isSignature = det.className === 'Signature';
        const isMultiline = pageNormH > 0.045 && pageNormW > 0.2;

        let fieldType: FormField['type'] = 'text';
        if (isCheckbox) fieldType = 'checkbox';
        else if (isSignature) fieldType = 'signature';
        else if (isMultiline) fieldType = 'textarea';

        return {
          id: `field_ai_${pageIndex}_${idx}_${Date.now()}`,
          pageIndex,
          type: fieldType,
          label: isCheckbox ? `Checkbox ${idx + 1}` : (isSignature ? `Signature ${idx + 1}` : `Field ${idx + 1}`),
          box: {
            x: pageNormX,
            y: pageNormY,
            width: pageNormW,
            height: pageNormH,
          },
          value: '',
          fontFamily: 'Kalpurush',
          fontSize: isMultiline ? 11 : 12,
          autoFontSize: true,
          color: '#111827',
          hAlign: 'left',
          vAlign: isMultiline ? 'top' : 'middle',
          multiline: isMultiline,
          checkboxState: 'empty',
          locked: true, // Locked by default per requirements
          confidence: det.confidence,
          source: 'ai',
        };
      });

      // Also merge AcroForms if any exist
      const acroFields = await pdfRenderer.extractAcroForms(pageIndex);
      const merged = this.mergeFieldLists(acroFields, aiFields);

      // Sort widgets in reading order
      return this.sortWidgets(merged);
    }

    return [];
  }

  /**
   * Run detection across all pages or selected pages
   */
  public async detectAllPages(
    totalPages: number,
    modelType: ModelType,
    pageInfos: PageInfo[],
    onProgress?: (currentPage: number, totalPages: number, percent: number, message: string) => void
  ): Promise<FormField[]> {
    const allFields: FormField[] = [];

    for (let i = 0; i < totalPages; i++) {
      const pageInfo = pageInfos[i];
      if (!pageInfo) continue;

      const pageFields = await this.detectPage(
        i,
        modelType,
        pageInfo,
        (pct, msg) => {
          const overallPct = Math.round(((i + pct / 100) / totalPages) * 100);
          onProgress?.(i + 1, totalPages, overallPct, `Page ${i + 1}/${totalPages}: ${msg}`);
        }
      );

      allFields.push(...pageFields);
    }

    return allFields;
  }

  private mergeFieldLists(priorityList: FormField[], secondaryList: FormField[]): FormField[] {
    const result = [...priorityList];

    for (const item of secondaryList) {
      let isDuplicate = false;
      for (const existing of result) {
        if (this.calculateIoU(item.box, existing.box) > 0.35) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        result.push(item);
      }
    }

    return result;
  }

  private calculateIoU(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number {
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

  private sortWidgets(widgets: FormField[]): FormField[] {
    const yThreshold = 0.015;
    return [...widgets].sort((a, b) => {
      if (Math.abs(a.box.y - b.box.y) < yThreshold) {
        return a.box.x - b.box.x;
      }
      return a.box.y - b.box.y;
    });
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const aiDetector = new AiDetectorService();
