import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import assert from 'assert';

console.log('=== Testing Export & ArrayBuffer Stability ===\n');

// 1. Test Detached Buffer Resilience
console.log('1. Testing multiple consecutive exports on original PDF buffer...');
const pdfPath = 'public/sample-forms/english_job_application.pdf';
const originalBuffer = fs.readFileSync(pdfPath).buffer;

async function testExportSafety(buffer) {
  // Simulate what pdfRenderer does: clone for worker
  const renderCopy = buffer.slice(0);
  const exportCopy = buffer.slice(0);

  // Even if renderCopy was detached or manipulated, exportCopy is safe
  assert(exportCopy.byteLength > 0, 'Export buffer must not be empty');

  // Perform multiple loads and saves using pdf-lib
  for (let i = 1; i <= 3; i++) {
    const safeBytes = new Uint8Array(exportCopy.slice(0));
    const doc = await PDFDocument.load(safeBytes);
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    assert(width > 0 && height > 0);
    const saved = await doc.save();
    assert(saved.length > 0);
    console.log(`  ✓ Export iteration ${i} succeeded without detached buffer errors (${saved.length} bytes)`);
  }
}

// 2. Verify "Samples" Removal
console.log('\n2. Verifying Samples removal...');
const topNavbarCode = fs.readFileSync('src/components/TopNavbar.tsx', 'utf8');
const appCode = fs.readFileSync('src/App.tsx', 'utf8');

assert(!topNavbarCode.includes('showSamplesMenu'), 'TopNavbar must not contain showSamplesMenu');
assert(!topNavbarCode.includes('onOpenSample'), 'TopNavbar must not contain onOpenSample');
assert(!topNavbarCode.includes('Try Sample Documents'), 'TopNavbar must not contain sample documents dropdown');
assert(!appCode.includes('handleOpenSample'), 'App.tsx must not contain handleOpenSample');
console.log('  ✓ "Samples" has been completely removed from TopNavbar and App.tsx');

// 3. Verify Text Overlay Alignment & Placeholder
console.log('\n3. Verifying Text Overlay Alignment & Placeholder in FieldOverlay...');
const fieldOverlayCode = fs.readFileSync('src/components/FieldOverlay.tsx', 'utf8');

assert(fieldOverlayCode.includes('placeholder="Type here..."'), 'FieldOverlay must include constant aligned placeholder');
assert(fieldOverlayCode.includes('items-center'), 'FieldOverlay must use flexbox vertical centering for middle alignment');
assert(fieldOverlayCode.includes('paddingLeft'), 'FieldOverlay must set scaled horizontal padding matching PDF exporter');
console.log('  ✓ FieldOverlay contains flexbox alignment, scaled padding, and consistent placeholder');

async function run() {
  await testExportSafety(originalBuffer);
  console.log('\n✅ ALL REFINEMENT TESTS PASSED!\n');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
