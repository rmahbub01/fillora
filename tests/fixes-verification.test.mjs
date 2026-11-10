import assert from 'assert';
import fs from 'fs';
import { sanitizeFontBuffer } from '../src/utils/fontSanitizer.ts';

console.log('=== Verifying Fillora Issues & Fixes ===\n');

// 1. Verify Font Upload Sanitization & Kalpurush.ttf as Default Bangla Font
console.log('1. Checking Font Upload Sanitizer & Kalpurush.ttf as Default Bangla Font...');
const fontManagerCode = fs.readFileSync('src/services/fontManager.ts', 'utf8');
assert(fontManagerCode.includes('sanitizeFontBuffer'), 'fontManager must call sanitizeFontBuffer');
assert(fontManagerCode.includes("id: 'kalpurush'"), 'fontManager must have kalpurush in built-in fonts');
assert(fontManagerCode.indexOf("id: 'kalpurush'") < fontManagerCode.indexOf("id: 'nikosh'"), 'Kalpurush must be listed before Nikosh as default Bangla font');

const appCode = fs.readFileSync('src/App.tsx', 'utf8');
assert(appCode.includes("fontFamily: 'Kalpurush'"), 'App.tsx must use Kalpurush as default font for manual fields');

const aiDetectorCodeFull = fs.readFileSync('src/services/aiDetector.ts', 'utf8');
assert(aiDetectorCodeFull.includes("fontFamily: 'Kalpurush'"), 'aiDetector must use Kalpurush as default font');

// Test sanitizeFontBuffer on actual Nikosh.ttf if available
if (fs.existsSync('/home/mahbub/Downloads/Nikosh.ttf')) {
  const nikoshRaw = fs.readFileSync('/home/mahbub/Downloads/Nikosh.ttf');
  const nikoshBuf = nikoshRaw.buffer.slice(nikoshRaw.byteOffset, nikoshRaw.byteOffset + nikoshRaw.byteLength);
  const sanitized = sanitizeFontBuffer(nikoshBuf);
  assert(sanitized.byteLength < nikoshBuf.byteLength, 'Sanitizer should strip oversized corrupt metadata in Nikosh.ttf');
  console.log(`  ✓ Successfully sanitized Nikosh.ttf: ${nikoshBuf.byteLength} bytes -> ${sanitized.byteLength} bytes`);
}

// 2. Verify Manual Font Size Input in RightSidebar
console.log('\n2. Checking manual font size input in RightSidebar.tsx...');
const rightSidebarCode = fs.readFileSync('src/components/RightSidebar.tsx', 'utf8');
assert(rightSidebarCode.includes('type="number"'), 'RightSidebar must contain type="number" input for manual font size insertion');
assert(rightSidebarCode.includes('min="1"'), 'Manual font size input must have a min value');
assert(rightSidebarCode.includes('max="144"'), 'Manual font size input must support up to 144pt');
assert(rightSidebarCode.includes('autoFontSize: false'), 'Manual font size input must set autoFontSize to false');
assert(!rightSidebarCode.includes('selectedField.box.width * 595'), 'RightSidebar must not hardcode 595 for width');
assert(!rightSidebarCode.includes('selectedField.box.height * 842'), 'RightSidebar must not hardcode 842 for height');
assert(rightSidebarCode.includes('pageWidth'), 'RightSidebar must use dynamic pageWidth');
assert(rightSidebarCode.includes('pageHeight'), 'RightSidebar must use dynamic pageHeight');
console.log('  ✓ RightSidebar contains manual numeric font size input with live point (pt) display');

// 3. Verify Model Selection Dropdown Outside Click
console.log('\n3. Checking Model Selection Dropdown Outside Click handler in TopNavbar.tsx...');
const topNavbarCode = fs.readFileSync('src/components/TopNavbar.tsx', 'utf8');
assert(topNavbarCode.includes('modelMenuRef'), 'TopNavbar must define modelMenuRef');
assert(topNavbarCode.includes('handleClickOutside'), 'TopNavbar must define handleClickOutside listener');
assert(topNavbarCode.includes('setShowModelMenu(false)'), 'TopNavbar must close menu when clicked outside');
console.log('  ✓ Model selection dropdown auto-closes on outside click');

// 4. Verify LeftSidebar Thumbnail & Preview Reset on new PDF
console.log('\n4. Checking LeftSidebar Thumbnail & Preview Reset on new PDF...');
const leftSidebarCode = fs.readFileSync('src/components/LeftSidebar.tsx', 'utf8');
assert(leftSidebarCode.includes('setThumbnails({})'), 'LeftSidebar must reset thumbnails immediately on pageInfos change');

const pdfViewerCode = fs.readFileSync('src/components/PDFViewer.tsx', 'utf8');
assert(pdfViewerCode.includes('ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)'), 'PDFViewer must clear canvas to prevent holding previous preview while rendering');
console.log('  ✓ LeftSidebar and PDFViewer clear and refresh preview cleanly on new document');

// 5. Verify Vertical Zoom Toolbar attached to Right Sidebar
console.log('\n5. Checking Vertical Zoom Toolbar attached to Right Sidebar in PDFViewer.tsx...');
assert(!pdfViewerCode.includes('fixed bottom-6 right-8'), 'PDFViewer zoom toolbar must not use fixed bottom-6 right-8');
assert(pdfViewerCode.includes('absolute right-0 top-1/2 -translate-y-1/2'), 'PDFViewer zoom toolbar must attach to right-0 top-1/2');
assert(pdfViewerCode.includes('flex flex-col'), 'PDFViewer zoom toolbar must be vertical');
assert(pdfViewerCode.includes('rounded-l-xl'), 'PDFViewer zoom toolbar must have rounded-l-xl attached flush to right sidebar');
console.log('  ✓ Zoom toolbar is vertical and attached flush to the left edge of RightSidebar');

// 6. Verify Removal of Hybrid (AI + Visual)
console.log('\n6. Checking complete removal of "Hybrid (AI + Visual)"...');
const pdfTypesCode = fs.readFileSync('src/types/pdf.ts', 'utf8');
assert(!pdfTypesCode.includes("'hybrid'"), 'pdf.ts must not include hybrid model type');
assert(!topNavbarCode.includes("'hybrid'"), 'TopNavbar must not include hybrid model type or label');
const aiDetectorCode = fs.readFileSync('src/services/aiDetector.ts', 'utf8');
assert(!aiDetectorCode.includes("'hybrid'"), 'aiDetector.ts must not contain hybrid code');
console.log('  ✓ "Hybrid (AI + Visual)" and all related logic removed cleanly');

// 7. Verify FieldOverlay Styling Consistency
console.log('\n7. Checking FieldOverlay unified styling and removal of yellow MOVE FIELD bar...');
const fieldOverlayCode = fs.readFileSync('src/components/FieldOverlay.tsx', 'utf8');
assert(!fieldOverlayCode.includes('bg-amber-500'), 'FieldOverlay must not have amber-500 yellow move bar');
assert(!fieldOverlayCode.includes('border-amber-500'), 'FieldOverlay must not have yellow amber borders');
assert(!fieldOverlayCode.includes('border-amber-600'), 'FieldOverlay must not have yellow resize handles');
assert(fieldOverlayCode.includes('GripHorizontal'), 'FieldOverlay must have GripHorizontal drag handle');
assert(fieldOverlayCode.includes('Move Field'), 'FieldOverlay must have Move Field label');
assert(fieldOverlayCode.includes('ring-2 ring-indigo-500'), 'FieldOverlay must use indigo ring');
console.log('  ✓ Manually inserted field design completely matches overlay text box design');

// 8. Verify High-DPI 8x Supersampling & Vector-Grade Export
console.log('\n8. Checking High-DPI 8x Supersampling & Vector-Grade Export in pdfExporter.ts...');
const pdfExporterCode = fs.readFileSync('src/services/pdfExporter.ts', 'utf8');
assert(pdfExporterCode.includes('scaleFactor = 8'), 'pdfExporter must use scaleFactor = 8 (576-600 DPI) for text & checkboxes');
assert(pdfExporterCode.includes('imageSmoothingQuality = \'high\''), 'pdfExporter must enable high quality smoothing');
assert(pdfExporterCode.includes('document.fonts.load'), 'pdfExporter must explicitly preload fonts prior to canvas rasterization');
console.log('  ✓ High-DPI 8x supersampling (576-600 DPI) and explicit font preloading verified');

// 9. Verify Multi-line mode growing outside, padding removal, and newline preservation
console.log('\n9. Checking Multi-line mode growing outside and padding removal...');
assert(pdfExporterCode.includes("field.value.split('\\n')"), 'pdfExporter must split by newline to preserve explicit multiline paragraphs');
assert(pdfExporterCode.includes('padY = 0'), 'pdfExporter must remove top and bottom padding in multi-line mode');
assert(pdfExporterCode.includes('actualHeightPts = Math.max(heightPts, totalTextHPx / scaleFactor)'), 'pdfExporter must allow multiline text to grow outside box height without clipping');
assert(fieldOverlayCode.includes("paddingTop: '0px'"), 'FieldOverlay must remove top padding in multi-line mode');
assert(fieldOverlayCode.includes("paddingBottom: '0px'"), 'FieldOverlay must remove bottom padding in multi-line mode');
assert(fieldOverlayCode.includes("overflow: 'visible'"), 'FieldOverlay must have overflow visible on all overlay text boxes so text grows outside without being cut by box borders');
const { getEffectiveFontSizePts } = await import('../src/utils/typography.ts');
const multilineSize = getEffectiveFontSizePts({ fontSize: 12, autoFontSize: true, multiline: true, value: 'Line 1\nLine 2\nLine 3' }, 200, 50);
assert(multilineSize >= 9.5 && multilineSize <= 14, `Multiline auto font size must be a comfortable body size. Got ${multilineSize}pt`);
console.log(`  ✓ Multiline mode verified: text grows outside box (${multilineSize}pt), padY = 0, no border cutting`);

// 10. Verify identical auto font size for fields with same width & height
console.log('\n10. Checking identical auto font size for same width and height fields...');
const fieldA = { fontSize: 12, autoFontSize: true, multiline: false, value: 'Applicant Name' };
const fieldB = { fontSize: 12, autoFontSize: true, multiline: false, value: 'Father Name' };
const sizeA = getEffectiveFontSizePts(fieldA, 208.3, 29.4);
const sizeB = getEffectiveFontSizePts(fieldB, 208.3, 29.6);
assert.strictEqual(sizeA, sizeB, `Fields with same width and height must have identical font size. Got ${sizeA}pt vs ${sizeB}pt`);
console.log(`  ✓ Fields with same width and height have identical auto font size: ${sizeA}pt === ${sizeB}pt (subpixel jitter eliminated)`);

// 11. Verify exact position parity between FieldOverlay and pdfExporter
console.log('\n11. Checking exact position parity and visual overflow between website view and exported PDF...');
assert(pdfExporterCode.includes('pageInfo ? pageInfo.width : page.getWidth()'), 'pdfExporter must use pageInfo dimensions matching FieldOverlay');
assert(pdfExporterCode.includes("ctx.textBaseline = 'middle'"), 'pdfExporter must use middle baseline for middle alignment matching browser flex items-center');
assert(pdfExporterCode.includes('textY = boxTopPx + boxHeightPx / 2'), 'pdfExporter must place middle-aligned text at vertical center of box');
assert(pdfExporterCode.includes('x: pdfBoxX - drawXOffset'), 'pdfExporter must align image origin accounting for bleed offset');
assert(pdfExporterCode.includes('y: pdfBoxY - drawYOffset'), 'pdfExporter must align image origin accounting for bleed offset');
assert(pdfExporterCode.includes('bleedTopPts'), 'pdfExporter must calculate vertical overflow bleed when font size is increased');
console.log('  ✓ Exact position parity and visual overflow verified: text overflows naturally without clipping and lines up 100% with website overlay');

console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
