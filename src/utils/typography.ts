export interface TypographyField {
  fontSize: number;
  autoFontSize: boolean;
  multiline: boolean;
  value: string;
}

/**
 * Calculates the exact effective font size in PDF points for any form field.
 * Both the DOM editor overlay and the PDF exporter call this identical function,
 * ensuring 100% visual parity between the website view and the exported PDF.
 */
export function getEffectiveFontSizePts(
  field: TypographyField,
  fieldWidthPts: number,
  fieldHeightPts: number
): number {
  if (!field.autoFontSize) {
    return field.fontSize;
  }

  // Snap dimensions to 0.5pt to eliminate subpixel coordinate jitter between identical form fields
  const stableHeightPts = Math.round(fieldHeightPts * 2) / 2;
  const stableWidthPts = Math.round(fieldWidthPts * 2) / 2;

  // Auto font size calculation for multiline text areas
  if (field.multiline) {
    // In multi-line mode, text grows outside naturally without being clipped or shrunk to unreadable sizes.
    // Provides a stable, comfortable body font size (9.5pt to 13.5pt) based on line height.
    const baseSize = Math.min(13.5, Math.max(9.5, Math.round(stableHeightPts * 0.28 * 2) / 2));
    return Math.round(baseSize * 2) / 2;
  }

  // For single-line inputs, target ~60% of field height so text sits cleanly on the form line
  let size = stableHeightPts * 0.60;
  size = Math.max(8, Math.min(26, size));
  size = Math.round(size * 2) / 2;

  // If text string overflows available width, scale down proportionally
  if (field.value && field.value.length > 2) {
    const padPts = 8;
    const availWidth = stableWidthPts - padPts;
    // Average character width for Bangla & Latin is approx 0.54 of font size
    const estimatedWidth = field.value.length * (size * 0.54);
    if (availWidth > 0) {
      if (estimatedWidth > availWidth) {
        size = Math.max(7, availWidth / (field.value.length * 0.54));
        size = Math.round(size * 2) / 2;
      }
    } else {
      size = 7;
    }
  }

  return Math.round(size * 2) / 2;
}
