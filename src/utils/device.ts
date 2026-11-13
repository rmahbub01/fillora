/** Device helpers used to keep Fillora light on phones/tablets. */

export const MOBILE_QUERY = '(max-width: 767px), (pointer: coarse) and (max-width: 1024px)';

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

/** Approx. RAM in GB (Chromium only). Undefined elsewhere. */
export function deviceMemoryGB(): number | undefined {
  return (navigator as any).deviceMemory as number | undefined;
}

/** Low-memory phones should not load the 97 MB FFDNet-L model. */
export function isLowMemoryDevice(): boolean {
  const mem = deviceMemoryGB();
  return isMobileDevice() && (mem === undefined || mem <= 4);
}

/** Supersampling factor for flattening text to PNG (8 desktop, 4 mobile = ~288 DPI). */
export function exportScaleFactor(): number {
  return isMobileDevice() ? 4 : 8;
}

/** Max pixels allowed in a single page canvas (iOS Safari hard limit is ~16.7M). */
export function maxCanvasPixels(): number {
  return isMobileDevice() ? 6_000_000 : 40_000_000;
}
