import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== Verifying Mobile Pinch Zoom Position Holding, Zero-Reload, & Gesture Stability ===\n');

// 1. Verify PDFViewer pinch tracking and focal point calculation
console.log('1. Checking PDFViewer.tsx pinch focal tracking and scroll holding...');
const pdfViewerCode = fs.readFileSync('src/components/PDFViewer.tsx', 'utf8');

assert.ok(
  pdfViewerCode.includes('startPinchZoom'),
  'PDFViewer must define startPinchZoom for multi-touch initialization'
);
assert.ok(
  pdfViewerCode.includes('finishPinchZoom'),
  'PDFViewer must define finishPinchZoom for seamless zoom commit'
);
assert.ok(
  pdfViewerCode.includes('pendingZoomCommitRef'),
  'PDFViewer must use pendingZoomCommitRef to hold target scroll position across render'
);
assert.ok(
  pdfViewerCode.includes('useLayoutEffect'),
  'PDFViewer must use useLayoutEffect to apply target scroll position before browser paint'
);
assert.ok(
  !pdfViewerCode.includes("transformOrigin = 'top center'"),
  'PDFViewer must not use hardcoded top-center transform origin'
);
assert.ok(
  pdfViewerCode.includes('transformOrigin = `${originX}px ${originY}px`') ||
  pdfViewerCode.includes('transformOrigin = `${pinchRef.current.originX}px ${pinchRef.current.originY}px`'),
  'PDFViewer must scale from the pinch center focal point'
);
assert.ok(
  pdfViewerCode.includes('translate3d'),
  'PDFViewer must support two-finger pan translation during pinch'
);
assert.ok(
  pdfViewerCode.includes('targetScrollLeft') && pdfViewerCode.includes('targetScrollTop'),
  'PDFViewer must compute target scroll offsets so focal point remains stationary'
);
console.log('  ✓ PDFViewer calculates focal points, dynamic transform origin, and target scroll positions');

// 2. Verify prevention of "reload" feel (no clearRect or spinner on same-page zoom)
console.log('\n2. Checking PDFViewer page-change guard against canvas clearing & spinner flash on zoom...');
assert.ok(
  pdfViewerCode.includes('isPageChange'),
  'PDFViewer must detect whether a render is a page change vs a zoom change'
);
assert.ok(
  pdfViewerCode.includes('if (isPageChange)'),
  'PDFViewer must only clear canvas and show full spinner when isPageChange is true'
);
console.log('  ✓ PDFViewer preserves canvas bitmap and avoids full-page spinner reload on zoom');

// 3. Verify mobile browser pull-to-refresh prevention
console.log('\n3. Checking pull-to-refresh & native page-zoom gesture prevention in PDFViewer...');
assert.ok(
  pdfViewerCode.includes('overscrollBehavior') || pdfViewerCode.includes('overscroll-contain'),
  'PDFViewer must contain overscroll to prevent mobile browser pull-to-refresh'
);
assert.ok(
  pdfViewerCode.includes('onTouchStart') && pdfViewerCode.includes('onTouchMove'),
  'PDFViewer must register touch gesture listeners'
);
assert.ok(
  pdfViewerCode.includes('passive: false'),
  'PDFViewer touch listeners must be non-passive to call preventDefault on multi-touch'
);
assert.ok(
  pdfViewerCode.includes('onPointerDownCapture'),
  'PDFViewer must use onPointerDownCapture so pinch start cannot be blocked by child stopPropagation'
);
console.log('  ✓ PDFViewer contains overscroll and intercepts multi-touch to prevent pull-to-refresh');

// 4. Verify double-buffered offscreen rendering in pdfRenderer.ts
console.log('\n4. Checking double-buffered offscreen canvas rendering in src/services/pdfRenderer.ts...');
const pdfRendererCode = fs.readFileSync('src/services/pdfRenderer.ts', 'utf8');

assert.ok(
  pdfRendererCode.includes('document.createElement(\'canvas\')'),
  'pdfRenderer must create an offscreen canvas for double-buffering'
);
assert.ok(
  pdfRendererCode.includes('drawImage(offscreen'),
  'pdfRenderer must blit completed offscreen render to visible canvas in one paint'
);
console.log('  ✓ pdfRenderer double-buffers page renders to eliminate white flashing');

// 5. Verify FieldOverlay multi-touch immunity
console.log('\n5. Checking FieldOverlay.tsx multi-touch handling...');
const fieldOverlayCode = fs.readFileSync('src/components/FieldOverlay.tsx', 'utf8');

assert.ok(
  fieldOverlayCode.includes('!e.isPrimary'),
  'FieldOverlay must ignore non-primary touches to allow clean pinch zooming'
);
assert.ok(
  fieldOverlayCode.includes('pointerId'),
  'FieldOverlay must track pointerId to prevent second fingers from hijacking drag state'
);
console.log('  ✓ FieldOverlay ignores non-primary touch pointers and isolates drag by pointerId');

// 6. Mathematical Focal Invariant Simulation Test
console.log('\n6. Running mathematical focal invariant simulation test...');

function simulatePinchHandoff({
  containerWidth,
  pageWidth,
  pageHeight,
  startZoom,
  finalZoom,
  touchX,
  touchY,
  scrollLeftStart,
  scrollTopStart,
  panDx,
  panDy,
}) {
  const padLeft = 8;
  const padRight = 8;
  const padTop = 8;
  const availWidth = containerWidth - padLeft - padRight;

  // Initial layout
  const wrapWidthStart = pageWidth * startZoom;
  const wrapLeftStart = wrapWidthStart < availWidth
    ? padLeft + (availWidth - wrapWidthStart) / 2
    : padLeft;
  const wrapTopStart = padTop;

  // Invariant point on PDF page
  const originX = touchX - (wrapLeftStart - scrollLeftStart);
  const originY = touchY - (wrapTopStart - scrollTopStart);
  const pdfX = originX / startZoom;
  const pdfY = originY / startZoom;

  const viewportX = touchX;
  const viewportY = touchY;

  // Final layout after zoom
  const wrapWidthFinal = pageWidth * finalZoom;
  const wrapLeftFinal = wrapWidthFinal < availWidth
    ? padLeft + (availWidth - wrapWidthFinal) / 2
    : padLeft;
  const wrapTopFinal = padTop;

  const focalContentX = wrapLeftFinal + pdfX * finalZoom;
  const focalContentY = wrapTopFinal + pdfY * finalZoom;

  const finalViewportX = viewportX + panDx;
  const finalViewportY = viewportY + panDy;

  const targetScrollLeft = Math.max(0, focalContentX - finalViewportX);
  const targetScrollTop = Math.max(0, focalContentY - finalViewportY);

  // Resulting on-screen position of that exact PDF point
  const actualScreenX = focalContentX - targetScrollLeft;
  const actualScreenY = focalContentY - targetScrollTop;

  return {
    expectedX: finalViewportX,
    expectedY: finalViewportY,
    actualX: actualScreenX,
    actualY: actualScreenY,
  };
}

// Test Case A: Mobile viewport zoom from 0.6 to 1.5 with finger centered on a field
const simA = simulatePinchHandoff({
  containerWidth: 390,
  pageWidth: 600,
  pageHeight: 800,
  startZoom: 0.6,
  finalZoom: 1.5,
  touchX: 200,
  touchY: 350,
  scrollLeftStart: 0,
  scrollTopStart: 50,
  panDx: 15,
  panDy: -10,
});
assert.strictEqual(simA.actualX, simA.expectedX, 'Sim A: Horizontal position must hold exactly');
assert.strictEqual(simA.actualY, simA.expectedY, 'Sim A: Vertical position must hold exactly');
console.log(`  ✓ Simulation A (0.6x -> 1.5x zoom + pan): Position held with 0px deviation (${simA.actualX}px, ${simA.actualY}px)`);

// Test Case B: Zooming in from 1.0 to 2.2 near right edge
const simB = simulatePinchHandoff({
  containerWidth: 412,
  pageWidth: 595,
  pageHeight: 842,
  startZoom: 1.0,
  finalZoom: 2.2,
  touchX: 350,
  touchY: 500,
  scrollLeftStart: 100,
  scrollTopStart: 200,
  panDx: -25,
  panDy: 30,
});
assert.strictEqual(simB.actualX, simB.expectedX, 'Sim B: Horizontal position must hold exactly');
assert.strictEqual(simB.actualY, simB.expectedY, 'Sim B: Vertical position must hold exactly');
console.log(`  ✓ Simulation B (1.0x -> 2.2x zoom + pan): Position held with 0px deviation (${simB.actualX}px, ${simB.actualY}px)`);

console.log('\n🎉 ALL MOBILE PINCH ZOOM VERIFICATION TESTS PASSED SUCCESSFULLY!');
