import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== Fillora Initial Load Speed & Bundle Optimization Test ===\n');

// 1. Check index.html for non-blocking fonts and clean assets
console.log('1. Checking index.html rendering optimizations...');
const indexHtml = fs.readFileSync('dist/index.html', 'utf8');

// Ensure font stylesheet is non-render-blocking
assert(
  indexHtml.includes('media="print"') && indexHtml.includes('onload="this.media=\'all\'"'),
  'Google Fonts stylesheet must be loaded asynchronously with media="print" onload to avoid blocking initial paint'
);
console.log('  ✓ Google Fonts stylesheet is asynchronous & non-blocking');

// Ensure no blocking heavy scripts in index.html
assert(!indexHtml.includes('pdfjs-dist'), 'Initial index.html must not statically load pdfjs-dist');
assert(!indexHtml.includes('pdf-lib'), 'Initial index.html must not statically load pdf-lib');
assert(!indexHtml.includes('detection.worker'), 'Initial index.html must not statically load detection.worker');
console.log('  ✓ Heavy libraries (pdfjs, pdf-lib, worker) are excluded from initial HTML');

// 2. Measure Dist Assets and Chunk Sizes
console.log('\n2. Verifying bundle chunk sizes and code-splitting...');
const distAssets = fs.readdirSync('dist/assets');

let entryJsSize = 0;
let reactVendorSize = 0;
let iconsSize = 0;
let pdfjsChunkFound = false;
let pdflibChunkFound = false;

for (const file of distAssets) {
  const filePath = path.join('dist/assets', file);
  const stats = fs.statSync(filePath);
  const sizeKb = stats.size / 1024;

  if (file.startsWith('index-') && file.endsWith('.js')) {
    entryJsSize = sizeKb;
    console.log(`  ✓ Application Entry Chunk: ${file} (${sizeKb.toFixed(1)} KB)`);
  } else if (file.startsWith('react-vendor-')) {
    reactVendorSize = sizeKb;
    console.log(`  ✓ React Vendor Chunk: ${file} (${sizeKb.toFixed(1)} KB)`);
  } else if (file.startsWith('lucide-icons-')) {
    iconsSize = sizeKb;
    console.log(`  ✓ Icons Chunk: ${file} (${sizeKb.toFixed(1)} KB)`);
  } else if (file.startsWith('pdf-')) {
    pdfjsChunkFound = true;
    console.log(`  ✓ PDF.js On-Demand Chunk: ${file} (${sizeKb.toFixed(1)} KB)`);
  } else if (file.startsWith('es-')) {
    pdflibChunkFound = true;
    console.log(`  ✓ PDF-Lib On-Demand Chunk: ${file} (${sizeKb.toFixed(1)} KB)`);
  }
}

// Assertions on chunking
assert(entryJsSize > 0 && entryJsSize < 120, `Entry chunk (${entryJsSize} KB) must be ultra-light (< 120 KB)`);
assert(pdfjsChunkFound, 'PDF.js must be split into a separate on-demand chunk');
assert(pdflibChunkFound, 'PDF-Lib must be split into a separate on-demand chunk');
console.log('  ✓ Chunk splitting verified: Core app code is separated from on-demand heavy engines');

// 3. Measure Network Response Times against Local Preview Server
console.log('\n3. Measuring network latency on http://127.0.0.1:4173/ ...');
async function testNetworkResponse() {
  const start = performance.now();
  const res = await fetch('http://127.0.0.1:4173/');
  const html = await res.text();
  const duration = performance.now() - start;

  assert.strictEqual(res.status, 200);
  assert(html.includes('<div id="root"></div>'));
  console.log(`  ✓ Root HTML fetched in ${duration.toFixed(2)} ms (Status: ${res.status}, Size: ${html.length} bytes)`);

  // Extract initial script tags from HTML
  const scriptMatches = [...html.matchAll(/src="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  console.log(`  ✓ Found ${scriptMatches.length} initial script(s) to execute`);

  let totalTransferBytes = html.length;
  for (const scriptUrl of scriptMatches) {
    const sStart = performance.now();
    const sRes = await fetch(`http://127.0.0.1:4173${scriptUrl}`);
    const buf = await sRes.arrayBuffer();
    const sDur = performance.now() - sStart;
    totalTransferBytes += buf.byteLength;
    console.log(`    - ${scriptUrl}: ${(buf.byteLength / 1024).toFixed(1)} KB in ${sDur.toFixed(2)} ms`);
  }

  console.log(`  ✓ Total initial transferred payload: ${(totalTransferBytes / 1024).toFixed(1)} KB`);
  assert(
    totalTransferBytes < 350 * 1024,
    `Initial transfer payload (${(totalTransferBytes / 1024).toFixed(1)} KB) should be under 350 KB uncompressed`
  );
}

await testNetworkResponse();

console.log('\n✅ ALL LOAD SPEED OPTIMIZATION TESTS PASSED!\n');
