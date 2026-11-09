import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime Web WASM paths to load from local public directory
ort.env.wasm.wasmPaths = '/wasm/';
ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);

interface DetectionMessage {
  type: 'detect';
  modelType: 'ffdnet-s' | 'ffdnet-l';
  pageIndex: number;
  imageData: ImageData; // 1216x1216
  confidenceThreshold?: number;
}

let activeSession: ort.InferenceSession | null = null;
let activeModelType: string | null = null;

// IndexedDB cache helper for model binaries
async function getModelBuffer(modelType: string, onProgress: (pct: number) => void): Promise<ArrayBuffer> {
  const modelUrl = modelType === 'ffdnet-l' ? '/models/FFDNet-L.onnx' : '/models/FFDNet-S.onnx';
  const cacheName = 'fillora-model-cache-v1';
  
  if ('caches' in self) {
    try {
      const cache = await caches.open(cacheName);
      const cachedResp = await cache.match(modelUrl);
      if (cachedResp) {
        onProgress(100);
        return await cachedResp.arrayBuffer();
      }
    } catch (e) {
      console.warn('Cache API access error:', e);
    }
  }

  // Fetch with progress tracking
  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch model ${modelUrl}: ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (!contentLength || !response.body) {
    const buf = await response.arrayBuffer();
    onProgress(100);
    return buf;
  }

  const reader = response.body.getReader();
  let receivedLength = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedLength += value.length;
    const pct = Math.min(99, Math.round((receivedLength / contentLength) * 100));
    onProgress(pct);
  }

  const allChunks = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  // Cache response if supported
  if ('caches' in self) {
    try {
      const cache = await caches.open(cacheName);
      await cache.put(modelUrl, new Response(allChunks.buffer, {
        headers: { 'Content-Type': 'application/octet-stream' }
      }));
    } catch (e) {
      console.warn('Could not cache model:', e);
    }
  }

  onProgress(100);
  return allChunks.buffer;
}

async function loadSession(modelType: 'ffdnet-s' | 'ffdnet-l', onProgress: (pct: number) => void): Promise<ort.InferenceSession> {
  if (activeSession && activeModelType === modelType) {
    return activeSession;
  }

  if (activeSession) {
    // Release previous session
    activeSession = null;
    activeModelType = null;
  }

  const modelBuffer = await getModelBuffer(modelType, onProgress);

  // Attempt WebGPU first, then fall back to WASM
  const sessionOptions: ort.InferenceSession.SessionOptions = {
    executionProviders: ['webgpu', 'wasm'],
    graphOptimizationLevel: 'all',
  };

  try {
    activeSession = await ort.InferenceSession.create(modelBuffer, sessionOptions);
    activeModelType = modelType;
    return activeSession;
  } catch (gpuError) {
    console.warn('WebGPU failed, falling back to WASM:', gpuError);
    activeSession = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    activeModelType = modelType;
    return activeSession;
  }
}

function preprocessImage(imageData: ImageData, targetSize: number = 1216): Float32Array {
  const { data, width, height } = imageData;
  const tensor = new Float32Array(3 * targetSize * targetSize);
  const planeSize = targetSize * targetSize;

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * targetSize + x;

      // Normalize RGB to 0..1
      tensor[dstIdx] = data[srcIdx] / 255.0;                         // R
      tensor[planeSize + dstIdx] = data[srcIdx + 1] / 255.0;         // G
      tensor[planeSize * 2 + dstIdx] = data[srcIdx + 2] / 255.0;     // B
    }
  }

  return tensor;
}

interface RawDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  classId: number;
  className: string;
  confidence: number;
}

const CLASS_NAMES = ['TextBox', 'ChoiceButton', 'Signature'];

function decodeYOLOOutput(
  outputTensor: ort.Tensor,
  confThreshold: number = 0.25,
  targetSize: number = 1216
): RawDetection[] {
  // Shape: [1, 7, 30324]
  // Dimensions: 7 channels x 30324 anchors
  const data = outputTensor.data as Float32Array;
  const numChannels = 7;
  const numAnchors = 30324;
  const detections: RawDetection[] = [];

  for (let i = 0; i < numAnchors; i++) {
    // Probabilities of 3 classes: channel 4, 5, 6
    const score0 = data[4 * numAnchors + i]; // TextBox
    const score1 = data[5 * numAnchors + i]; // ChoiceButton
    const score2 = data[6 * numAnchors + i]; // Signature

    let maxScore = score0;
    let classId = 0;
    if (score1 > maxScore) {
      maxScore = score1;
      classId = 1;
    }
    if (score2 > maxScore) {
      maxScore = score2;
      classId = 2;
    }

    if (maxScore >= confThreshold) {
      const cx = data[0 * numAnchors + i];
      const cy = data[1 * numAnchors + i];
      const w = data[2 * numAnchors + i];
      const h = data[3 * numAnchors + i];

      const normX = Math.max(0, (cx - w / 2) / targetSize);
      const normY = Math.max(0, (cy - h / 2) / targetSize);
      const normW = Math.min(1 - normX, w / targetSize);
      const normH = Math.min(1 - normY, h / targetSize);

      detections.push({
        x: normX,
        y: normY,
        width: normW,
        height: normH,
        classId,
        className: CLASS_NAMES[classId],
        confidence: maxScore,
      });
    }
  }

  return applyNMS(detections, 0.40);
}

function calculateIoU(a: RawDetection, b: RawDetection): number {
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

function applyNMS(boxes: RawDetection[], iouThreshold: number): RawDetection[] {
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const selected: RawDetection[] = [];

  for (const box of sorted) {
    let keep = true;
    for (const existing of selected) {
      if (calculateIoU(box, existing) > iouThreshold) {
        keep = false;
        break;
      }
    }
    if (keep) {
      selected.push(box);
    }
  }

  return selected;
}

self.onmessage = async (e: MessageEvent<DetectionMessage>) => {
  const { modelType, pageIndex, imageData, confidenceThreshold = 0.28 } = e.data;

  try {
    self.postMessage({
      type: 'progress',
      pageIndex,
      status: 'downloading',
      message: `Loading ${modelType.toUpperCase()} neural weights...`,
      percent: 10,
    });

    const session = await loadSession(modelType, (pct) => {
      self.postMessage({
        type: 'progress',
        pageIndex,
        status: pct < 100 ? 'downloading' : 'loading',
        message: pct < 100 ? `Downloading ${modelType.toUpperCase()} weights (${pct}%)...` : 'Initializing neural engine...',
        percent: Math.round(pct * 0.7),
      });
    });

    self.postMessage({
      type: 'progress',
      pageIndex,
      status: 'detecting',
      message: `Analyzing page ${pageIndex + 1} with ${modelType.toUpperCase()}...`,
      percent: 85,
    });

    const targetSize = 1216;
    const floatData = preprocessImage(imageData, targetSize);
    const tensor = new ort.Tensor('float32', floatData, [1, 3, targetSize, targetSize]);

    const results = await session.run({ images: tensor });
    const outputTensor = results.output0 || Object.values(results)[0];

    const rawDetections = decodeYOLOOutput(outputTensor, confidenceThreshold, targetSize);

    self.postMessage({
      type: 'progress',
      pageIndex,
      status: 'completed',
      message: `Found ${rawDetections.length} fields on page ${pageIndex + 1}`,
      percent: 100,
    });

    self.postMessage({
      type: 'result',
      pageIndex,
      detections: rawDetections,
    });
  } catch (error: any) {
    self.postMessage({
      type: 'error',
      pageIndex,
      error: error?.message || 'Inference error',
    });
  }
};
