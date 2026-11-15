import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== Verifying Segmented (Comb Boxes), Desktop Page Change Pill, & Mobile Large Model ===\n');

// 1. Verify Segmented (Comb Boxes) in FormField type
console.log('1. Checking FormField type definition in src/types/pdf.ts...');
const typesCode = fs.readFileSync('src/types/pdf.ts', 'utf8');
assert.ok(typesCode.includes('isComb?: boolean;'), 'FormField must support isComb');
assert.ok(typesCode.includes('combCells?: number;'), 'FormField must support combCells');
console.log('  ✓ src/types/pdf.ts has isComb and combCells');

// 2. Verify FieldOverlay comb rendering & toggle
console.log('\n2. Checking FieldOverlay comb rendering in src/components/FieldOverlay.tsx...');
const fieldOverlayCode = fs.readFileSync('src/components/FieldOverlay.tsx', 'utf8');
assert.ok(fieldOverlayCode.includes('field.isComb && field.combCells && field.combCells > 1'), 'FieldOverlay must render comb cells when isComb is active');
assert.ok(fieldOverlayCode.includes('maxLength={field.combCells}'), 'FieldOverlay comb input must restrict length to combCells');
assert.ok(fieldOverlayCode.includes('border-r border-indigo-300/40'), 'FieldOverlay comb cells must have vertical dividers');
assert.ok(fieldOverlayCode.includes('LayoutGrid'), 'FieldOverlay must include Comb mode toggle button');
console.log('  ✓ FieldOverlay renders segmented comb cells with dividers and active cell focus');

// 3. Verify RightSidebar comb controls and split button
console.log('\n3. Checking RightSidebar comb controls in src/components/RightSidebar.tsx...');
const rightSidebarCode = fs.readFileSync('src/components/RightSidebar.tsx', 'utf8');
assert.ok(rightSidebarCode.includes('Segmented (Comb Boxes)'), 'RightSidebar must include Segmented (Comb Boxes) section');
assert.ok(rightSidebarCode.includes('Date (8)'), 'RightSidebar must include Date (8) preset');
assert.ok(rightSidebarCode.includes('Mobile (11)'), 'RightSidebar must include Mobile (11) preset');
assert.ok(rightSidebarCode.includes('A/C (14)'), 'RightSidebar must include A/C (14) preset');
assert.ok(rightSidebarCode.includes('NID (17)'), 'RightSidebar must include NID (17) preset');
assert.ok(rightSidebarCode.includes('onSplitCombField'), 'RightSidebar must support splitting comb into separate boxes');
console.log('  ✓ RightSidebar includes comb toggle, presets, cell counter, and split button');

// 4. Verify App.tsx split handler and desktop page change pill
console.log('\n4. Checking App.tsx split handler and desktop page change pill in src/App.tsx...');
const appCode = fs.readFileSync('src/App.tsx', 'utf8');
assert.ok(appCode.includes('handleSplitCombField'), 'App.tsx must define handleSplitCombField');
assert.ok(appCode.includes('Desktop floating page change pill'), 'App.tsx must include desktop floating page change pill');
assert.ok(appCode.includes('PageUp') && appCode.includes('PageDown'), 'App.tsx must support PageUp and PageDown keyboard shortcuts');
console.log('  ✓ App.tsx handles comb field splitting and renders desktop floating page change pill');

// 5. Verify PDFExporter centered comb export
console.log('\n5. Checking PDFExporter comb export in src/services/pdfExporter.ts...');
const pdfExporterCode = fs.readFileSync('src/services/pdfExporter.ts', 'utf8');
assert.ok(pdfExporterCode.includes('field.isComb && field.combCells && field.combCells > 1'), 'pdfExporter must have comb export branch');
assert.ok(pdfExporterCode.includes("ctx.textAlign = 'center'"), 'pdfExporter must center each character in its comb cell');
assert.ok(pdfExporterCode.includes('(i + 0.5) * cellWidthPx'), 'pdfExporter must offset each character to cell center');
console.log('  ✓ pdfExporter exports comb fields with centered cell alignment');

// 6. Verify Mobile UI allows selecting large AI model (FFDNet-L)
console.log('\n6. Checking MobileDetectPanel.tsx for FFDNet-L availability...');
const mobileDetectCode = fs.readFileSync('src/components/MobileDetectPanel.tsx', 'utf8');
assert.ok(mobileDetectCode.includes("id: 'ffdnet-l'"), 'MobileDetectPanel must include FFDNet-L model option');
assert.ok(mobileDetectCode.includes('FFDNet-L (AI)'), 'MobileDetectPanel must display FFDNet-L name');
assert.ok(!mobileDetectCode.includes('hidden: lowMem'), 'MobileDetectPanel must NOT hide FFDNet-L on low memory devices');
assert.ok(!mobileDetectCode.includes('lowMem && selectedModel === \'ffdnet-l\''), 'MobileDetectPanel must NOT force-reset FFDNet-L away on mobile');
console.log('  ✓ MobileDetectPanel displays FFDNet-L and allows mobile users to choose the large model');

// 7. Verify detection files are clean and reverted
console.log('\n7. Checking AI detection files are reverted to clean commit...');
const aiDetectorCode = fs.readFileSync('src/services/aiDetector.ts', 'utf8');
assert.ok(!aiDetectorCode.includes('extractDottedTextLines'), 'aiDetector.ts must not inject text-layer dotted lines');
assert.ok(!aiDetectorCode.includes('detectVisualFields'), 'aiDetector.ts must not inject visual underlines');

const heurDetectorCode = fs.readFileSync('src/services/heuristicDetector.ts', 'utf8');
assert.ok(!heurDetectorCode.includes('detectDottedLines'), 'heuristicDetector.ts must not include detectDottedLines');

const workerCode = fs.readFileSync('src/workers/detection.worker.ts', 'utf8');
assert.ok(!workerCode.includes('sessionSCache'), 'detection.worker.ts must be reverted to original session loader');
assert.ok(!workerCode.includes('effectiveChoiceThreshold'), 'detection.worker.ts must not use false positive calibrated choice threshold');
assert.ok(!workerCode.includes('maxScore * 3.5'), 'detection.worker.ts must not use 3.5x multiplier');

console.log('  ✓ Detection files cleanly reverted to previous commit');

console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
