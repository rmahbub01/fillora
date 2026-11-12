import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MiB (strictly below Cloudflare's 25 MiB limit)

const MODELS = [
  'FFDNet-S.onnx',
  'FFDNet-L.onnx',
];

function splitModel(modelName) {
  const modelPath = path.join(rootDir, 'public', 'models', modelName);
  if (!fs.existsSync(modelPath)) {
    console.warn(`[Split] File not found: ${modelPath}`);
    return;
  }

  const stat = fs.statSync(modelPath);
  console.log(`[Split] Processing ${modelName} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)...`);

  const fd = fs.openSync(modelPath, 'r');
  const buffer = Buffer.alloc(CHUNK_SIZE);
  let bytesRead = 0;
  let partIndex = 0;

  while ((bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, null)) > 0) {
    const partPath = path.join(rootDir, 'public', 'models', `${modelName}.part${partIndex}`);
    fs.writeFileSync(partPath, buffer.subarray(0, bytesRead));
    const partSizeMb = (bytesRead / (1024 * 1024)).toFixed(2);
    console.log(`  -> Created ${path.basename(partPath)} (${partSizeMb} MB)`);
    partIndex++;
  }

  fs.closeSync(fd);
  console.log(`[Split] Finished ${modelName}: created ${partIndex} parts.`);
}

for (const model of MODELS) {
  splitModel(model);
}
