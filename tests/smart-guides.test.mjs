import assert from 'assert';
import {
  getBoxPixelPoints,
  collectSnapTargets,
  calculateSmartGuidesAndSnap,
} from '../src/utils/smartGuides.ts';

console.log('=== Fillora Smart Guides (Alignment & Snapping) Test Suite ===\n');

// Canvas dimensions
const canvasWidth = 600;
const canvasHeight = 800;

// 1. Test Bounding Box Reference Points Calculation (left, center, right, top, center, bottom)
console.log('1. Testing Bounding Box Reference Points Calculation...');
{
  const box = { x: 0.1, y: 0.2, width: 0.3, height: 0.25 };
  const pts = getBoxPixelPoints(box, canvasWidth, canvasHeight);

  assert.strictEqual(pts.left, 60);
  assert.strictEqual(pts.width, 180);
  assert.strictEqual(pts.right, 240);
  assert.strictEqual(pts.centerX, 150);

  assert.strictEqual(pts.top, 160);
  assert.strictEqual(pts.height, 200);
  assert.strictEqual(pts.bottom, 360);
  assert.strictEqual(pts.centerY, 260);

  console.log('  ✓ Correctly calculated box edges and centers in pixel coordinates.');
}

// 2. Test Page Boundaries, Centers & Snap Targets Collection
console.log('\n2. Testing Page Boundaries, Centers & Target Collection...');
{
  const otherField = {
    id: 'f1',
    pageIndex: 0,
    type: 'text',
    box: { x: 0.2, y: 0.3, width: 0.2, height: 0.1 }, // left: 120, center: 180, right: 240, top: 240, center: 280, bottom: 320
    value: '',
    fontFamily: 'Kalpurush',
    fontSize: 12,
    autoFontSize: true,
    color: '#000000',
    hAlign: 'left',
    vAlign: 'middle',
    multiline: false,
    checkboxState: 'empty',
    locked: false,
    source: 'manual',
  };

  const targets = collectSnapTargets([otherField], canvasWidth, canvasHeight);
  const xVals = targets.xTargets.map((t) => t.x);
  const yVals = targets.yTargets.map((t) => t.y);

  // Check page boundaries: 0, center (300), width (600)
  assert(xVals.includes(0), 'Missing page left boundary (0)');
  assert(xVals.includes(300), 'Missing page center boundary (300)');
  assert(xVals.includes(600), 'Missing page right boundary (600)');

  // Check page Y boundaries: 0, center (400), height (800)
  assert(yVals.includes(0), 'Missing page top boundary (0)');
  assert(yVals.includes(400), 'Missing page center boundary (400)');
  assert(yVals.includes(800), 'Missing page bottom boundary (800)');

  // Check field reference points: 120, 180, 240
  assert(xVals.includes(120), 'Missing target field left (120)');
  assert(xVals.includes(180), 'Missing target field center (180)');
  assert(xVals.includes(240), 'Missing target field right (240)');

  // Check field Y reference points: 240, 280, 320
  assert(yVals.includes(240), 'Missing target field top (240)');
  assert(yVals.includes(280), 'Missing target field center (280)');
  assert(yVals.includes(320), 'Missing target field bottom (320)');

  console.log('  ✓ Page boundaries (edges & centers) and target field points collected correctly.');
}

// 3. Test Drag Snapping within 5px Threshold & Full Canvas Guide Line
console.log('\n3. Testing Drag Snapping within 5px Threshold & Canvas Guide Line...');
{
  const targetField = {
    id: 'f1',
    pageIndex: 0,
    type: 'text',
    box: { x: 100 / canvasWidth, y: 100 / canvasHeight, width: 100 / canvasWidth, height: 40 / canvasHeight }, // left: 100, right: 200, center: 150, top: 100, bottom: 140
    value: '',
    fontFamily: 'Kalpurush',
    fontSize: 12,
    autoFontSize: true,
    color: '#000000',
    hAlign: 'left',
    vAlign: 'middle',
    multiline: false,
    checkboxState: 'empty',
    locked: false,
    source: 'manual',
  };

  // Drag candidate: left is at 103px (within 3px of targetField left 100px)
  const candidateBox = {
    x: 103 / canvasWidth,
    y: 300 / canvasHeight,
    width: 80 / canvasWidth,
    height: 30 / canvasHeight,
  };

  const result = calculateSmartGuidesAndSnap({
    candidateBox,
    otherFields: [targetField],
    canvasWidth,
    canvasHeight,
    threshold: 5,
    action: 'drag',
  });

  // Candidate left should have snapped from 103px to exactly 100px!
  const snappedLeftPx = Math.round(result.snappedBox.x * canvasWidth);
  assert.strictEqual(snappedLeftPx, 100, `Expected snapped left to be 100px, got ${snappedLeftPx}px`);

  // An alignment guide line should be present at x = 100
  const vGuide = result.guides.find((g) => g.type === 'vertical' && Math.abs(g.position - 100) < 1);
  assert(vGuide, 'Expected vertical alignment guide at x = 100');
  assert.strictEqual(vGuide.position, 100);
  assert(vGuide.label);

  console.log('  ✓ Successfully snapped left edge and generated canvas alignment guide.');
}

// 4. Test Magnetic Release when Beyond 5px Threshold
console.log('\n4. Testing Magnetic Release Beyond 5px Threshold...');
{
  const targetField = {
    id: 'f1',
    pageIndex: 0,
    type: 'text',
    box: { x: 100 / canvasWidth, y: 200 / canvasHeight, width: 100 / canvasWidth, height: 40 / canvasHeight },
    value: '',
    fontFamily: 'Kalpurush',
    fontSize: 12,
    autoFontSize: true,
    color: '#000000',
    hAlign: 'left',
    vAlign: 'middle',
    multiline: false,
    checkboxState: 'empty',
    locked: false,
    source: 'manual',
  };

  // Candidate left is at 60px (width 50: left=60, center=85, right=110; target points: 0, 100, 150, 200, 300, 600)
  const candidateBox = {
    x: 60 / canvasWidth,
    y: 350 / canvasHeight,
    width: 50 / canvasWidth,
    height: 30 / canvasHeight,
  };

  const result = calculateSmartGuidesAndSnap({
    candidateBox,
    otherFields: [targetField],
    canvasWidth,
    canvasHeight,
    threshold: 5,
    action: 'drag',
  });

  const snappedLeftPx = Math.round(result.snappedBox.x * canvasWidth);
  assert.strictEqual(snappedLeftPx, 60, `Expected unsnapped left at 60px, got ${snappedLeftPx}px`);
  assert.strictEqual(result.guides.length, 0, 'Expected 0 guide lines when beyond threshold');

  console.log('  ✓ Beyond 5px threshold, position is not snapped and no guideline is rendered.');
}

// 5. Test Simultaneous X & Y Snapping and Guide Lines
console.log('\n5. Testing Simultaneous X and Y Alignment Guides...');
{
  const fieldA = {
    id: 'fa',
    pageIndex: 0,
    type: 'text',
    box: { x: 200 / canvasWidth, y: 150 / canvasHeight, width: 100 / canvasWidth, height: 50 / canvasHeight },
    value: '',
    fontFamily: 'Kalpurush',
    fontSize: 12,
    autoFontSize: true,
    color: '#000000',
    hAlign: 'left',
    vAlign: 'middle',
    multiline: false,
    checkboxState: 'empty',
    locked: false,
    source: 'manual',
  };

  // Candidate is near fieldA: left = 202 (target 200), top = 148 (target 150)
  const candidateBox = {
    x: 202 / canvasWidth,
    y: 148 / canvasHeight,
    width: 100 / canvasWidth,
    height: 50 / canvasHeight,
  };

  const result = calculateSmartGuidesAndSnap({
    candidateBox,
    otherFields: [fieldA],
    canvasWidth,
    canvasHeight,
    threshold: 5,
    action: 'drag',
  });

  const snappedLeft = Math.round(result.snappedBox.x * canvasWidth);
  const snappedTop = Math.round(result.snappedBox.y * canvasHeight);
  assert.strictEqual(snappedLeft, 200);
  assert.strictEqual(snappedTop, 150);

  // Both vertical and horizontal guidelines should be present
  const hasVertical = result.guides.some((g) => g.type === 'vertical' && Math.abs(g.position - 200) < 1);
  const hasHorizontal = result.guides.some((g) => g.type === 'horizontal' && Math.abs(g.position - 150) < 1);
  assert(hasVertical, 'Expected vertical guide line at x = 200');
  assert(hasHorizontal, 'Expected horizontal guide line at y = 150');

  console.log('  ✓ Simultaneous X and Y snapping and guideline generation verified.');
}

// 6. Test Snapping during Resizing (East handle)
console.log('\n6. Testing Resizing Snapping (East handle)...');
{
  const targetField = {
    id: 'f1',
    pageIndex: 0,
    type: 'text',
    box: { x: 300 / canvasWidth, y: 100 / canvasHeight, width: 50 / canvasWidth, height: 50 / canvasHeight }, // left at 300
    value: '',
    fontFamily: 'Kalpurush',
    fontSize: 12,
    autoFontSize: true,
    color: '#000000',
    hAlign: 'left',
    vAlign: 'middle',
    multiline: false,
    checkboxState: 'empty',
    locked: false,
    source: 'manual',
  };

  // Candidate resizing East handle: left is fixed at 100px, width is 198px (right = 298px, within 2px of 300px)
  const candidateBox = {
    x: 100 / canvasWidth,
    y: 100 / canvasHeight,
    width: 198 / canvasWidth,
    height: 50 / canvasHeight,
  };

  const result = calculateSmartGuidesAndSnap({
    candidateBox,
    otherFields: [targetField],
    canvasWidth,
    canvasHeight,
    threshold: 5,
    action: 'resize',
    resizeHandle: 'e',
  });

  const snappedLeft = Math.round(result.snappedBox.x * canvasWidth);
  const snappedRight = Math.round((result.snappedBox.x + result.snappedBox.width) * canvasWidth);

  assert.strictEqual(snappedLeft, 100, 'Left should remain fixed at 100 during East resize');
  assert.strictEqual(snappedRight, 300, `Right edge should snap to 300px, got ${snappedRight}px`);

  const vGuide = result.guides.find((g) => g.type === 'vertical' && Math.abs(g.position - 300) < 1);
  assert(vGuide, 'Expected vertical guide at x = 300 during East resize snap');

  console.log('  ✓ Resizing East handle snaps right edge and renders guide line.');
}

// 7. Test Page Center Snapping (300px)
console.log('\n7. Testing Page Center Snapping...');
{
  // Candidate center near canvas center (300px).
  // Width = 100px. Left at 248px (center = 298px, 2px away from 300px).
  const candidateBox = {
    x: 248 / canvasWidth,
    y: 100 / canvasHeight,
    width: 100 / canvasWidth,
    height: 50 / canvasHeight,
  };

  const result = calculateSmartGuidesAndSnap({
    candidateBox,
    otherFields: [],
    canvasWidth,
    canvasHeight,
    threshold: 5,
    action: 'drag',
  });

  const snappedCenterX = Math.round((result.snappedBox.x + result.snappedBox.width / 2) * canvasWidth);
  assert.strictEqual(snappedCenterX, 300, `Expected element center to snap to page center (300px), got ${snappedCenterX}px`);

  const pageCenterGuide = result.guides.find((g) => g.type === 'vertical' && Math.abs(g.position - 300) < 1);
  assert(pageCenterGuide, 'Expected page center vertical guide at x = 300');

  console.log('  ✓ Successfully snapped to page center boundary.');
}

// 8. Test Page Outer Boundary Snapping (Left 0px)
console.log('\n8. Testing Page Outer Boundary Snapping...');
{
  const candidateLeftEdge = {
    x: 3 / canvasWidth,
    y: 100 / canvasHeight,
    width: 100 / canvasWidth,
    height: 50 / canvasHeight,
  };
  const leftEdgeResult = calculateSmartGuidesAndSnap({
    candidateBox: candidateLeftEdge,
    otherFields: [],
    canvasWidth,
    canvasHeight,
    threshold: 5,
    action: 'drag',
  });
  const snappedLeftEdge = Math.round(leftEdgeResult.snappedBox.x * canvasWidth);
  assert.strictEqual(snappedLeftEdge, 0, `Expected snap to left page boundary 0px, got ${snappedLeftEdge}px`);
  assert(leftEdgeResult.guides.some((g) => g.type === 'vertical' && Math.abs(g.position - 0) < 1));
  console.log('  ✓ Successfully snapped to left page boundary (0px).');
}

console.log('\n=== All Smart Guides & Snapping Tests Passed! ===\n');
