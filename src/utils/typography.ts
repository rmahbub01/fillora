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

  // Auto font size calculation based on box dimensions
  if (field.multiline) {
    // For multiline text areas, scale font comfortably to fit multiple lines
    const baseSize = fieldHeightPts * 0.28;
    return Math.max(8, Math.min(16, Math.round(baseSize * 10) / 10));
  }

  // For single-line inputs, target ~60% of field height so text sits cleanly on the form line
  let size = fieldHeightPts * 0.60;
  size = Math.max(8, Math.min(26, size));

  // If text string overflows available width, scale down proportionally
  if (field.value && field.value.length > 2) {
    const padPts = 8;
    const availWidth = fieldWidthPts - padPts;
    // Average character width for Bangla & Latin is approx 0.54 of font size
    const estimatedWidth = field.value.length * (size * 0.54);
    if (estimatedWidth > availWidth && availWidth > 0) {
      size = Math.max(7, availWidth / (field.value.length * 0.54));
    }
  }

  return Math.round(size * 10) / 10;
}
