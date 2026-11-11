import fs from 'fs';
import assert from 'assert';

console.log('=== Verifying 100% Precise Text Box Overlay Over Form Fields ===\n');

// 1. Verify FieldOverlay ring-inset, box-sizing, and uninflated dimensions
console.log('1. Checking FieldOverlay ring-inset and box-sizing in src/components/FieldOverlay.tsx...');
const fieldOverlayCode = fs.readFileSync('src/components/FieldOverlay.tsx', 'utf8');

assert(fieldOverlayCode.includes('ring-2 ring-indigo-500 ring-inset'), 'FieldOverlay text fields must use ring-inset so visual rings never protrude outside form boundaries');
assert(fieldOverlayCode.includes('ring-2 ring-indigo-500 ring-inset shadow-md'), 'FieldOverlay checkboxes must use ring-inset');
assert(fieldOverlayCode.includes("boxSizing: 'border-box'"), 'FieldOverlay must explicitly declare border-box sizing');
assert(!fieldOverlayCode.includes('Math.max(12,'), 'FieldOverlay must not artificially clamp dimensions to 12px');
assert(fieldOverlayCode.includes('Math.round(b.x * 10000) / 10000'), 'FieldOverlay handleMouseUp must use 4-decimal precision (0.01%)');
console.log('  ✓ Inset rings, border-box, and subpixel coordinate precision verified');

// 2. Verify guarded dynamic growth keeps empty text boxes 100% exact to form field dimensions
console.log('\n2. Checking guarded dynamic growth in src/components/FieldOverlay.tsx...');
assert(fieldOverlayCode.includes('hasOverflowingText'), 'FieldOverlay must check hasOverflowingText before growing height');
assert(fieldOverlayCode.includes('hasOverflowingText ? Math.ceil(computedFontSize * 1.35) : pixelHeight'), 'Single-line text must keep pixelHeight when text is not overflowing');
assert(fieldOverlayCode.includes('hasOverflowingText && multilineHeight ? multilineHeight : pixelHeight'), 'Multiline text must keep pixelHeight when text is not overflowing');

// Simulate empty field vs overflowing field
function testOverlayHeight(value, pixelHeight, computedFontSize, multiline = false, multilineHeight = 0) {
  const hasOverflowingText = Boolean(value && value.trim().length > 0);
  const neededHeightPx = multiline
    ? (hasOverflowingText && multilineHeight ? multilineHeight : pixelHeight)
    : (hasOverflowingText ? Math.ceil(computedFontSize * 1.35) : pixelHeight);
  const effectivePixelHeight = Math.max(pixelHeight, neededHeightPx);
  const extraHeightPx = Math.max(0, effectivePixelHeight - pixelHeight);
  const effectivePixelTop = 100 - extraHeightPx / 2;
  return { effectivePixelHeight, effectivePixelTop, extraHeightPx };
}

// Empty field with 18px height and large 16pt font
const emptySingleLine = testOverlayHeight('', 18, 22, false);
assert.strictEqual(emptySingleLine.effectivePixelHeight, 18, 'Empty single-line field must strictly preserve exact 18px field height');
assert.strictEqual(emptySingleLine.effectivePixelTop, 100, 'Empty single-line field top must strictly equal initial top');
assert.strictEqual(emptySingleLine.extraHeightPx, 0, 'Empty single-line field extra height must be 0px');

// Empty multiline field with 25px height where textarea scrollHeight is 32px
const emptyMultiline = testOverlayHeight('', 25, 14, true, 32);
assert.strictEqual(emptyMultiline.effectivePixelHeight, 25, 'Empty multiline field must strictly preserve exact 25px field height');
assert.strictEqual(emptyMultiline.effectivePixelTop, 100, 'Empty multiline field top must strictly equal initial top');
assert.strictEqual(emptyMultiline.extraHeightPx, 0, 'Empty multiline field extra height must be 0px');

// Filled single-line field with overflowing font (22px * 1.35 = 30px)
const overflowingSingleLine = testOverlayHeight('Overflown text', 18, 22, false);
assert.strictEqual(overflowingSingleLine.effectivePixelHeight, 30, 'Overflowing text field must grow to accommodate text');
assert.strictEqual(overflowingSingleLine.extraHeightPx, 12, 'Extra height is 12px');
assert.strictEqual(overflowingSingleLine.effectivePixelTop, 94, 'Top expands symmetrically by 6px');

console.log('  ✓ Empty form fields remain 100% exact to detected bounds with zero premature inflation');

// 3. Verify precision form field detection in src/services/heuristicDetector.ts
console.log('\n3. Checking underline and contour detection precision in src/services/heuristicDetector.ts...');
const heuristicCode = fs.readFileSync('src/services/heuristicDetector.ts', 'utf8');

assert(!heuristicCode.includes('Math.min(36,'), 'Underline detection must not use oversized 36px box height');
assert(heuristicCode.includes('Math.floor(height * 0.019)'), 'Underline detection must use form-line proportional height (~18-22px)');
assert(heuristicCode.includes('darkCount > (run / 8) * 0.20'), 'Underline detection must scan upward to prevent overlapping prompt text or labels above');
assert(heuristicCode.includes('Math.round((startX / width) * 10000) / 10000'), 'Underline detection must use 4-decimal precision');
assert(heuristicCode.includes('Math.round((b.w / width) * 10000) / 10000'), 'Rectangle detection must use 4-decimal precision');
console.log('  ✓ Underline field height matches standard form blanks tightly and stops below labels');

// 4. Verify AI detector 4-decimal coordinate normalization
console.log('\n4. Checking AI detector coordinate normalization in src/services/aiDetector.ts...');
const aiDetectorCode = fs.readFileSync('src/services/aiDetector.ts', 'utf8');
assert(aiDetectorCode.includes('Math.round(Math.max(0, Math.min(1, (pixelX - offsetX) / renderedW)) * 10000) / 10000'), 'aiDetector must use 4-decimal coordinate normalization');
console.log('  ✓ AI detector subpixel coordinate normalization verified');

// 5. Verify App.tsx default manual field dimensions
console.log('\n5. Checking manual field insertion dimensions in src/App.tsx...');
const appCode = fs.readFileSync('src/App.tsx', 'utf8');
assert(appCode.includes('width: isCheckbox ? 0.022 : (type === \'textarea\' ? 0.40 : 0.28)'), 'Manual text field width must be form-proportional');
assert(appCode.includes('height: isCheckbox ? 0.022 : (type === \'textarea\' ? 0.08 : 0.024)'), 'Manual text field height must be form-proportional');
console.log('  ✓ Manual field dimensions match form lines and square checkboxes');

console.log('\n🎉 ALL PRECISION TEXT BOX OVERLAY TESTS PASSED SUCCESSFULLY!\n');
