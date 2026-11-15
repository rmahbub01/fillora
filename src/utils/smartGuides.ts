import type { BoundingBox, FormField } from '../types/pdf';

export interface SmartGuideLine {
  id: string;
  type: 'vertical' | 'horizontal';
  position: number; // in canvas pixels
  label?: string;   // e.g. "120px" or "Page Center"
  targetBox?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface BoxPixelPoints {
  left: number;
  centerX: number;
  right: number;
  top: number;
  centerY: number;
  bottom: number;
  width: number;
  height: number;
}

export interface TargetItemX {
  x: number;
  label?: string;
  fieldBox?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface TargetItemY {
  y: number;
  label?: string;
  fieldBox?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface SnapTargets {
  xTargets: TargetItemX[];
  yTargets: TargetItemY[];
}

export interface SnapOptions {
  candidateBox: BoundingBox; // Normalized [0, 1]
  otherFields: FormField[];
  canvasWidth: number;
  canvasHeight: number;
  threshold?: number; // In pixels, default 5px
  action: 'drag' | 'resize';
  resizeHandle?: string | null; // 'n', 's', 'e', 'w', 'nw', 'ne', 'se', 'sw'
}

export interface SnapResult {
  snappedBox: BoundingBox; // Normalized [0, 1]
  guides: SmartGuideLine[];
}

/**
 * Convert a normalized BoundingBox to pixel coordinates and calculate its reference points.
 */
export function getBoxPixelPoints(
  box: BoundingBox,
  canvasWidth: number,
  canvasHeight: number
): BoxPixelPoints {
  const left = box.x * canvasWidth;
  const top = box.y * canvasHeight;
  const width = box.width * canvasWidth;
  const height = box.height * canvasHeight;
  const right = left + width;
  const bottom = top + height;
  const centerX = left + width / 2;
  const centerY = top + height / 2;

  return {
    left,
    centerX,
    right,
    top,
    centerY,
    bottom,
    width,
    height,
  };
}

/**
 * Collect all snap targets: page boundaries & center, plus all other fields' edges & centers.
 * Works uniformly for all field types (text, checkboxes, manual fields, textareas, etc.).
 */
export function collectSnapTargets(
  otherFields: FormField[],
  canvasWidth: number,
  canvasHeight: number
): SnapTargets {
  const halfW = Math.round((canvasWidth / 2) * 10) / 10;
  const halfH = Math.round((canvasHeight / 2) * 10) / 10;

  // Page boundaries and center
  const xTargets: TargetItemX[] = [
    { x: 0, label: 'Page Left' },
    { x: halfW, label: 'Page Center' },
    { x: canvasWidth, label: 'Page Right' },
  ];

  const yTargets: TargetItemY[] = [
    { y: 0, label: 'Page Top' },
    { y: halfH, label: 'Page Center' },
    { y: canvasHeight, label: 'Page Bottom' },
  ];

  for (const other of otherFields) {
    const pts = getBoxPixelPoints(other.box, canvasWidth, canvasHeight);
    const box = {
      left: pts.left,
      top: pts.top,
      width: pts.width,
      height: pts.height,
    };

    const roundedLeft = Math.round(pts.left * 10) / 10;
    const roundedCenter = Math.round(pts.centerX * 10) / 10;
    const roundedRight = Math.round(pts.right * 10) / 10;

    xTargets.push({ x: roundedLeft, label: `${Math.round(roundedLeft)}px`, fieldBox: box });
    xTargets.push({ x: roundedCenter, label: `${Math.round(roundedCenter)}px`, fieldBox: box });
    xTargets.push({ x: roundedRight, label: `${Math.round(roundedRight)}px`, fieldBox: box });

    const roundedTop = Math.round(pts.top * 10) / 10;
    const roundedCenterY = Math.round(pts.centerY * 10) / 10;
    const roundedBottom = Math.round(pts.bottom * 10) / 10;

    yTargets.push({ y: roundedTop, label: `${Math.round(roundedTop)}px`, fieldBox: box });
    yTargets.push({ y: roundedCenterY, label: `${Math.round(roundedCenterY)}px`, fieldBox: box });
    yTargets.push({ y: roundedBottom, label: `${Math.round(roundedBottom)}px`, fieldBox: box });
  }

  return { xTargets, yTargets };
}

/**
 * Find the closest snap target for a set of candidate points within threshold.
 */
function findClosestSnap(
  candidatePoints: number[],
  targets: Array<{ val: number }>,
  threshold: number
): { offset: number; matchedTarget: number | null } {
  let minDiff = Infinity;
  let bestOffset = 0;
  let matchedTarget: number | null = null;

  for (const pt of candidatePoints) {
    for (const t of targets) {
      const diff = t.val - pt;
      const absDiff = Math.abs(diff);
      if (absDiff <= threshold && absDiff < minDiff) {
        minDiff = absDiff;
        bestOffset = diff;
        matchedTarget = t.val;
      }
    }
  }

  return { offset: bestOffset, matchedTarget };
}

/**
 * Calculate magnetic snapping and modern Photoshop-style smart guide lines across canvas.
 */
export function calculateSmartGuidesAndSnap(options: SnapOptions): SnapResult {
  const {
    candidateBox,
    otherFields,
    canvasWidth,
    canvasHeight,
    threshold = 5,
    action,
    resizeHandle = '',
  } = options;

  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return { snappedBox: candidateBox, guides: [] };
  }

  const { xTargets, yTargets } = collectSnapTargets(otherFields, canvasWidth, canvasHeight);
  const candPts = getBoxPixelPoints(candidateBox, canvasWidth, canvasHeight);

  let snappedLeft = candPts.left;
  let snappedTop = candPts.top;
  let snappedWidth = candPts.width;
  let snappedHeight = candPts.height;

  const minWidth = Math.max(4, 0.005 * canvasWidth);
  const minHeight = Math.max(4, 0.005 * canvasHeight);

  const xValTargets = xTargets.map((t) => ({ val: t.x }));
  const yValTargets = yTargets.map((t) => ({ val: t.y }));

  if (action === 'drag') {
    // Check left, center, right for X; top, center, bottom for Y
    const xCandidates = [candPts.left, candPts.centerX, candPts.right];
    const snapX = findClosestSnap(xCandidates, xValTargets, threshold);
    if (snapX.matchedTarget !== null) {
      snappedLeft += snapX.offset;
    }

    const yCandidates = [candPts.top, candPts.centerY, candPts.bottom];
    const snapY = findClosestSnap(yCandidates, yValTargets, threshold);
    if (snapY.matchedTarget !== null) {
      snappedTop += snapY.offset;
    }

    // Keep within page boundaries
    snappedLeft = Math.max(0, Math.min(canvasWidth - snappedWidth, snappedLeft));
    snappedTop = Math.max(0, Math.min(canvasHeight - snappedHeight, snappedTop));
  } else if (action === 'resize' && resizeHandle) {
    const handle = resizeHandle.toLowerCase();

    // 1. Horizontal resizing
    if (handle.includes('e')) {
      const fixedLeft = candPts.left;
      const candRight = candPts.right;
      const candCenter = (fixedLeft + candRight) / 2;

      let bestOffset = 0;
      let minDiff = Infinity;

      for (const target of xTargets) {
        const diffEdge = target.x - candRight;
        if (Math.abs(diffEdge) <= threshold && Math.abs(diffEdge) < minDiff) {
          minDiff = Math.abs(diffEdge);
          bestOffset = diffEdge;
        }

        const diffCenter = target.x - candCenter;
        if (Math.abs(diffCenter) <= threshold && Math.abs(diffCenter) < minDiff) {
          minDiff = Math.abs(diffCenter);
          bestOffset = diffCenter * 2;
        }
      }

      const newRight = Math.max(fixedLeft + minWidth, Math.min(canvasWidth, candRight + bestOffset));
      snappedLeft = fixedLeft;
      snappedWidth = newRight - fixedLeft;
    } else if (handle.includes('w')) {
      const fixedRight = candPts.right;
      const candLeft = candPts.left;
      const candCenter = (candLeft + fixedRight) / 2;

      let bestOffset = 0;
      let minDiff = Infinity;

      for (const target of xTargets) {
        const diffEdge = target.x - candLeft;
        if (Math.abs(diffEdge) <= threshold && Math.abs(diffEdge) < minDiff) {
          minDiff = Math.abs(diffEdge);
          bestOffset = diffEdge;
        }

        const diffCenter = target.x - candCenter;
        if (Math.abs(diffCenter) <= threshold && Math.abs(diffCenter) < minDiff) {
          minDiff = Math.abs(diffCenter);
          bestOffset = diffCenter * 2;
        }
      }

      const newLeft = Math.max(0, Math.min(fixedRight - minWidth, candLeft + bestOffset));
      snappedLeft = newLeft;
      snappedWidth = fixedRight - newLeft;
    }

    // 2. Vertical resizing
    if (handle.includes('s')) {
      const fixedTop = candPts.top;
      const candBottom = candPts.bottom;
      const candCenter = (fixedTop + candBottom) / 2;

      let bestOffset = 0;
      let minDiff = Infinity;

      for (const target of yTargets) {
        const diffEdge = target.y - candBottom;
        if (Math.abs(diffEdge) <= threshold && Math.abs(diffEdge) < minDiff) {
          minDiff = Math.abs(diffEdge);
          bestOffset = diffEdge;
        }

        const diffCenter = target.y - candCenter;
        if (Math.abs(diffCenter) <= threshold && Math.abs(diffCenter) < minDiff) {
          minDiff = Math.abs(diffCenter);
          bestOffset = diffCenter * 2;
        }
      }

      const newBottom = Math.max(fixedTop + minHeight, Math.min(canvasHeight, candBottom + bestOffset));
      snappedTop = fixedTop;
      snappedHeight = newBottom - fixedTop;
    } else if (handle.includes('n')) {
      const fixedBottom = candPts.bottom;
      const candTop = candPts.top;
      const candCenter = (candTop + fixedBottom) / 2;

      let bestOffset = 0;
      let minDiff = Infinity;

      for (const target of yTargets) {
        const diffEdge = target.y - candTop;
        if (Math.abs(diffEdge) <= threshold && Math.abs(diffEdge) < minDiff) {
          minDiff = Math.abs(diffEdge);
          bestOffset = diffEdge;
        }

        const diffCenter = target.y - candCenter;
        if (Math.abs(diffCenter) <= threshold && Math.abs(diffCenter) < minDiff) {
          minDiff = Math.abs(diffCenter);
          bestOffset = diffCenter * 2;
        }
      }

      const newTop = Math.max(0, Math.min(fixedBottom - minHeight, candTop + bestOffset));
      snappedTop = newTop;
      snappedHeight = fixedBottom - newTop;
    }
  }

  // Calculate final reference points of the snapped box
  const finalRight = snappedLeft + snappedWidth;
  const finalCenterX = snappedLeft + snappedWidth / 2;
  const finalBottom = snappedTop + snappedHeight;
  const finalCenterY = snappedTop + snappedHeight / 2;

  const guides: SmartGuideLine[] = [];
  const addedX = new Set<number>();
  const addedY = new Set<number>();

  // Collect vertical guidelines across canvas
  for (const target of xTargets) {
    if (
      Math.abs(snappedLeft - target.x) < 1.0 ||
      Math.abs(finalCenterX - target.x) < 1.0 ||
      Math.abs(finalRight - target.x) < 1.0
    ) {
      const rounded = Math.round(target.x * 10) / 10;
      if (!addedX.has(rounded)) {
        addedX.add(rounded);
        guides.push({
          id: `v-${rounded}`,
          type: 'vertical',
          position: rounded,
          label: target.label || `${Math.round(rounded)}px`,
          targetBox: target.fieldBox,
        });
      }
    }
  }

  // Collect horizontal guidelines across canvas
  for (const target of yTargets) {
    if (
      Math.abs(snappedTop - target.y) < 1.0 ||
      Math.abs(finalCenterY - target.y) < 1.0 ||
      Math.abs(finalBottom - target.y) < 1.0
    ) {
      const rounded = Math.round(target.y * 10) / 10;
      if (!addedY.has(rounded)) {
        addedY.add(rounded);
        guides.push({
          id: `h-${rounded}`,
          type: 'horizontal',
          position: rounded,
          label: target.label || `${Math.round(rounded)}px`,
          targetBox: target.fieldBox,
        });
      }
    }
  }

  return {
    snappedBox: {
      x: snappedLeft / canvasWidth,
      y: snappedTop / canvasHeight,
      width: snappedWidth / canvasWidth,
      height: snappedHeight / canvasHeight,
    },
    guides,
  };
}
