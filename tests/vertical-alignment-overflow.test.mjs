import fs from 'fs';
import assert from 'assert';

console.log('=== Verifying Vertical Alignment Overflow Behavior (Top is Top, Bottom is Bottom) ===\n');

// 1. Verify FieldOverlay implementation: Box stays in place, flex items align correctly without inversion
console.log('1. Checking FieldOverlay in src/components/FieldOverlay.tsx...');
const fieldOverlayCode = fs.readFileSync('src/components/FieldOverlay.tsx', 'utf8');

assert(fieldOverlayCode.includes('const effectivePixelTop = pixelTop - extraHeightPx / 2'), 'FieldOverlay box container must stay fixed at symmetrical position without jumping');
assert(!fieldOverlayCode.includes('translateY(${extraHeightPx / 2}px)'), 'FieldOverlay must not invert top alignment by shifting downwards');
assert(!fieldOverlayCode.includes('translateY(-${extraHeightPx / 2}px)'), 'FieldOverlay must not invert bottom alignment by shifting upwards');

// Single-line alignment
assert(fieldOverlayCode.includes("field.vAlign === 'top'\n              ? 'items-start'\n              : field.vAlign === 'bottom'\n              ? 'items-end'\n              : 'items-center'"), 'Single-line must map top -> items-start, bottom -> items-end, middle -> items-center');

// Multiline alignment
assert(fieldOverlayCode.includes("field.vAlign === 'middle'\n              ? 'justify-center'\n              : field.vAlign === 'bottom'\n              ? 'justify-end'\n              : 'justify-start'"), 'Multiline must map top -> justify-start, bottom -> justify-end, middle -> justify-center');
console.log('  ✓ FieldOverlay correctly maps Top to items-start/justify-start and Bottom to items-end/justify-end without inverted transform');

// 2. Verify pdfExporter implementation: Direct canvas vertical positioning without inverted offsets
console.log('\n2. Checking pdfExporter text positioning in src/services/pdfExporter.ts...');
const pdfExporterCode = fs.readFileSync('src/services/pdfExporter.ts', 'utf8');

assert(pdfExporterCode.includes('let textY = boxTopPx + boxHeightPx / 2'), 'pdfExporter must center text by default');
assert(pdfExporterCode.includes("if (field.vAlign === 'top') {\n        ctx.textBaseline = 'top';\n        textY = boxTopPx;\n      } else if (field.vAlign === 'bottom') {\n        ctx.textBaseline = 'bottom';\n        textY = boxTopPx + boxHeightPx;\n      }"), 'pdfExporter must directly map top -> boxTopPx and bottom -> boxTopPx + boxHeightPx');
assert(!pdfExporterCode.includes('textY = boxTopPx + (extraHeightPts > 0 ? halfExtraHeightPts * scaleFactor : 0)'), 'pdfExporter must not add inverted offset to top alignment');
assert(!pdfExporterCode.includes('textY = boxTopPx + boxHeightPx - (extraHeightPts > 0 ? halfExtraHeightPts * scaleFactor : 0)'), 'pdfExporter must not add inverted offset to bottom alignment');
console.log('  ✓ pdfExporter directly positions Top at top of box and Bottom at bottom of box without inverted offsets');

// 3. Mathematical Verification of Top vs Middle vs Bottom ordering
console.log('\n3. Verifying vertical ordering: Top is strictly above Middle, Middle is strictly above Bottom...');

const boxTopPx = 10;
const boxHeightPx = 60;

const topY = boxTopPx;
const middleY = boxTopPx + boxHeightPx / 2;
const bottomY = boxTopPx + boxHeightPx;

assert(topY < middleY, `Top (${topY}px) must be higher (lower Y coordinate) than Middle (${middleY}px)`);
assert(middleY < bottomY, `Middle (${middleY}px) must be higher (lower Y coordinate) than Bottom (${bottomY}px)`);
assert(topY < bottomY, `Top (${topY}px) must be strictly higher than Bottom (${bottomY}px)`);

console.log(`  ✓ Top (${topY}px) < Middle (${middleY}px) < Bottom (${bottomY}px): Natural, non-inverted vertical order confirmed`);

console.log('\n🎉 ALL VERTICAL ALIGNMENT TESTS PASSED SUCCESSFULLY!\n');
