import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime Web WASM paths (loads from high-speed CDN to avoid Cloudflare 25MB asset limit)
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
// Keep CPU threads moderate (max 2) to prevent 100% CPU core pinning and loud cooling fans during WASM fallback
ort.env.wasm.numThreads = Math.min(2, Math.max(1, Math.floor((navigator.hardwareConcurrency || 2) / 2)));

interface DetectionMessage {
  type: 'detect';
  modelType: 'ffdnet-s' | 'ffdnet-l';
  pageIndex: number;
  imageData: ImageData; // 1216x1216
  confidenceThreshold?: number;
}

let activeSession: ort.InferenceSession | null = null;
let activeModelType: string | null = null;

interface ModelMeta {
  fullName: string;
  totalSize: number;
  parts: string[];
  fallbackUrl: string;
}

const MODEL_REGISTRY: Record<'ffdnet-s' | 'ffdnet-l', ModelMeta> = {
  'ffdnet-s': {
    fullName: 'FFDNet-S.onnx',
    totalSize: 38370092,
    parts: [
      '/models/FFDNet-S.onnx.part0',
      '/models/FFDNet-S.onnx.part1',
    ],
    fallbackUrl: 'https://huggingface.co/jbarrow/FFDNet-S-cpu/resolve/main/FFDNet-S.onnx',
  },
  'ffdnet-l': {
    fullName: 'FFDNet-L.onnx',
    totalSize: 101944542,
    parts: [
      '/models/FFDNet-L.onnx.part0',
      '/models/FFDNet-L.onnx.part1',
      '/models/FFDNet-L.onnx.part2',
      '/models/FFDNet-L.onnx.part3',
      '/models/FFDNet-L.onnx.part4',
    ],
    fallbackUrl: 'https://huggingface.co/jbarrow/FFDNet-L-cpu/resolve/main/FFDNet-L.onnx',
  },
};

// Helper to verify that a buffer is an actual binary ONNX model and not HTML error text
function isBinaryOnnxBuffer(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 500 * 1024) {
    return false; // FFDNet models are ~37MB and ~98MB
  }
  const view = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16));
  // HTML starts with '<' (0x3c) or JSON error starts with '{' (0x7b)
  if (view[0] === 0x3c || view[0] === 0x7b) {
    return false;
  }
  return true;
}

// Loads a chunked model (split into <20MB chunks to strictly conform with Cloudflare's 25MB limit)
async function loadChunkedModel(meta: ModelMeta, onProgress: (pct: number) => void): Promise<ArrayBuffer | null> {
  try {
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    for (let i = 0; i < meta.parts.length; i++) {
      const partUrl = meta.parts[i];
      const response = await fetch(partUrl);
      if (!response.ok) {
        console.warn(`[Model Chunk] Part ${partUrl} returned HTTP ${response.status}`);
        return null;
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        console.warn(`[Model Chunk] Part ${partUrl} returned "${contentType}", aborting chunked load.`);
        return null;
      }

      const partBuffer = await response.arrayBuffer();
      // Ensure the part is not HTML
      const view = new Uint8Array(partBuffer, 0, Math.min(partBuffer.byteLength, 16));
      if (view[0] === 0x3c || view[0] === 0x7b) {
        return null;
      }

      chunks.push(new Uint8Array(partBuffer));
      receivedBytes += partBuffer.byteLength;
      const pct = Math.min(99, Math.round((receivedBytes / meta.totalSize) * 100));
      onProgress(pct);
    }

    if (receivedBytes !== meta.totalSize && receivedBytes < 1024 * 1024) {
      console.warn(`[Model Chunk] Incomplete chunks received (${receivedBytes} / ${meta.totalSize})`);
      return null;
    }

    // Assemble full ONNX model binary
    const assembled = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      assembled.set(chunk, offset);
      offset += chunk.byteLength;
    }

    if (!isBinaryOnnxBuffer(assembled.buffer)) {
      console.warn(`[Model Chunk] Assembled buffer failed ONNX binary validation`);
      return null;
    }

    onProgress(100);
    return assembled.buffer;
  } catch (err: any) {
    console.warn(`[Model Chunk] Chunked loading failed:`, err.message);
    return null;
  }
}

// Fetch a single candidate model URL with streaming progress tracking
async function fetchDirectModel(url: string, onProgress: (pct: number) => void): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      return null;
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (!contentLength || !response.body) {
      const buf = await response.arrayBuffer();
      if (!isBinaryOnnxBuffer(buf)) return null;
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

    if (!isBinaryOnnxBuffer(allChunks.buffer)) return null;

    onProgress(100);
    return allChunks.buffer;
  } catch {
    return null;
  }
}

// IndexedDB cache helper for model binaries with chunked loading and persistent caching
async function getModelBuffer(modelType: 'ffdnet-s' | 'ffdnet-l', onProgress: (pct: number) => void): Promise<ArrayBuffer> {
  const meta = MODEL_REGISTRY[modelType];
  const cacheKey = `/models/${meta.fullName}`;
  const cacheName = 'fillora-model-cache-v4';
  
  // Clean up any stale or corrupted caches from previous versions
  if ('caches' in self) {
    try {
      for (const old of ['fillora-model-cache-v1', 'fillora-model-cache-v2', 'fillora-model-cache-v3']) {
        if (await caches.has(old)) await caches.delete(old);
      }

      const cache = await caches.open(cacheName);
      const cachedResp = await cache.match(cacheKey);
      if (cachedResp) {
        const buf = await cachedResp.arrayBuffer();
        if (isBinaryOnnxBuffer(buf)) {
          onProgress(100);
          return buf;
        }
        await cache.delete(cacheKey);
      }
    } catch (e) {
      console.warn('Cache API access error:', e);
    }
  }

  // 1. Try single local file first (available in local dev)
  let buffer = await fetchDirectModel(cacheKey, onProgress);

  // 2. Try chunked parts (conforms to Cloudflare 25MB limit without external network hops)
  if (!buffer) {
    console.log(`[Model Load] Loading chunked model for ${modelType} from same-origin...`);
    buffer = await loadChunkedModel(meta, onProgress);
  }

  // 3. Fallback to external CDN mirror if needed
  if (!buffer && meta.fallbackUrl) {
    console.log(`[Model Load] Falling back to CDN mirror: ${meta.fallbackUrl}`);
    buffer = await fetchDirectModel(meta.fallbackUrl, onProgress);
  }

  if (buffer) {
    // Store in Cache API under standard cacheKey for instant offline access
    if ('caches' in self) {
      try {
        const cache = await caches.open(cacheName);
        await cache.put(cacheKey, new Response(buffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(buffer.byteLength),
          },
        }));
      } catch (e) {
        console.warn('Could not cache model:', e);
      }
    }
    return buffer;
  }

  throw new Error(
    `Failed to load ${meta.fullName} model. Please verify deployment assets.`
  );
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
    console.log(`[Detection Worker] ✅ Session initialized using WebGPU hardware acceleration`);
    return activeSession;
  } catch (gpuError) {
    console.warn('[Detection Worker] ⚠️ WebGPU failed, falling back to CPU WASM:', gpuError);
    activeSession = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    activeModelType = modelType;
    console.log(`[Detection Worker] Session initialized using CPU WASM fallback`);
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
