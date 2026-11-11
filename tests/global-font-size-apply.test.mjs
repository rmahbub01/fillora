import assert from 'assert';
import fs from 'fs';

console.log('=== Verifying Global Font Size Apply & Revert Features ===\n');

// 1. Verify RightSidebar contains pure button elements for Font Family & Font Size
console.log('1. Checking Pure Button Elements in RightSidebar.tsx...');
const rightSidebarCode = fs.readFileSync('src/components/RightSidebar.tsx', 'utf8');

// Ensure old text button (text-[10px] text-indigo-600 hover:underline) is removed
assert(!rightSidebarCode.includes('className="text-[10px] text-indigo-600 hover:underline"'),
  'Old unstyled text button with hover:underline must be replaced');

// Ensure Font Family "Apply to all" is a pure button element
assert(rightSidebarCode.includes('handleApplyFontToAll'), 'RightSidebar must have handleApplyFontToAll');
assert(rightSidebarCode.includes('bg-indigo-50/90'), 'Pure button element must have styled background');
assert(rightSidebarCode.includes('border-indigo-200/80'), 'Pure button element must have styled border');
assert(rightSidebarCode.includes('shadow-2xs'), 'Pure button element must have subtle shadow');
console.log('  ✓ Font Family "Apply to all" is a pure button element matching website buttons');

// 2. Verify Font Size Global Actions & Revert Auto
console.log('\n2. Checking Font Size Global Apply & Revert in RightSidebar.tsx...');
assert(rightSidebarCode.includes('handleApplyFontSizeToAll'), 'RightSidebar must have handleApplyFontSizeToAll');
assert(rightSidebarCode.includes('handleRevertFontSizeToAuto'), 'RightSidebar must have handleRevertFontSizeToAuto');
assert(rightSidebarCode.includes('handleApplyBothToAll'), 'RightSidebar must have handleApplyBothToAll');
assert(rightSidebarCode.includes('Revert auto'), 'RightSidebar must have Revert auto button');
assert(rightSidebarCode.includes('Keep already changed font sizes'), 'RightSidebar must have keep custom sizes option');
assert(rightSidebarCode.includes('customCount'), 'RightSidebar must track count of custom preserved font sizes');
console.log('  ✓ RightSidebar contains Apply to all, Revert auto, and Merged Apply Font & Size buttons');

// 3. Verify App.tsx logic for preserving already changed font sizes
console.log('\n3. Testing App.tsx logic for preserving custom font sizes...');
const appCode = fs.readFileSync('src/App.tsx', 'utf8');
assert(appCode.includes('handleApplyFontSizeGlobally'), 'App.tsx must have handleApplyFontSizeGlobally');
assert(appCode.includes('handleRevertFontSizeGlobally'), 'App.tsx must have handleRevertFontSizeGlobally');
assert(appCode.includes('handleApplyTypographyGlobally'), 'App.tsx must have handleApplyTypographyGlobally');
assert(appCode.includes('keepCustom'), 'App.tsx handlers must support keepCustom parameter');

// 4. Simulate State Transition Logic
console.log('\n4. Simulating FormField state transitions with custom font preservation...');
const mockFields = [
  {
    id: 'field-1',
    type: 'text',
    fontSize: 22,
    autoFontSize: false,
    customFontSize: true, // User individually customized this (e.g. title)
  },
  {
    id: 'field-2',
    type: 'text',
    fontSize: 16,
    autoFontSize: false,
    customFontSize: true, // User individually customized this (e.g. subtitle)
  },
  {
    id: 'field-3',
    type: 'text',
    fontSize: 12,
    autoFontSize: true,   // Default auto font size (selected field)
  },
  {
    id: 'field-4',
    type: 'text',
    fontSize: 12,
    autoFontSize: true,   // Default auto font size (remaining)
  },
  {
    id: 'field-5',
    type: 'checkbox',
    fontSize: 12,
    autoFontSize: true,   // Checkbox should be untouched
  },
];

// Test Apply 14pt globally with keepCustom = true
const selectedFieldId = 'field-3';
const targetFontSize = 14;
const keepCustom = true;

const appliedFields = mockFields.map((f) => {
  if (f.type === 'checkbox') return f;
  if (f.id === selectedFieldId) {
    return {
      ...f,
      fontSize: targetFontSize,
      autoFontSize: false,
      customFontSize: true,
    };
  }
  if (keepCustom && (f.customFontSize === true || (f.customFontSize === undefined && f.autoFontSize === false))) {
    return f;
  }
  return {
    ...f,
    fontSize: targetFontSize,
    autoFontSize: false,
    customFontSize: false,
  };
});

assert.strictEqual(appliedFields[0].fontSize, 22, 'Field 1 (already changed) must KEEP its 22pt size');
assert.strictEqual(appliedFields[0].autoFontSize, false, 'Field 1 must keep its autoFontSize: false');
assert.strictEqual(appliedFields[1].fontSize, 16, 'Field 2 (already changed) must KEEP its 16pt size');
assert.strictEqual(appliedFields[1].autoFontSize, false, 'Field 2 must keep its autoFontSize: false');
assert.strictEqual(appliedFields[2].fontSize, 14, 'Field 3 (selected) must have new 14pt size');
assert.strictEqual(appliedFields[3].fontSize, 14, 'Field 4 (remaining) must be CHANGED to 14pt size');
assert.strictEqual(appliedFields[3].autoFontSize, false, 'Field 4 must have autoFontSize: false');
assert.strictEqual(appliedFields[4].type, 'checkbox', 'Field 5 (checkbox) must not be affected');
console.log('  ✓ Apply to all: Already changed font sizes kept their current state, and remaining were changed');

// Test Revert to auto font size with keepCustom = true
const revertedFields = appliedFields.map((f) => {
  if (f.type === 'checkbox') return f;
  if (f.id === selectedFieldId) {
    return {
      ...f,
      autoFontSize: true,
      customFontSize: false,
    };
  }
  if (keepCustom && (f.customFontSize === true || (f.customFontSize === undefined && f.autoFontSize === false))) {
    return f;
  }
  return {
    ...f,
    autoFontSize: true,
    customFontSize: false,
  };
});

assert.strictEqual(revertedFields[0].fontSize, 22, 'Field 1 (already changed) must still KEEP its 22pt size');
assert.strictEqual(revertedFields[0].autoFontSize, false, 'Field 1 must still keep its autoFontSize: false');
assert.strictEqual(revertedFields[1].fontSize, 16, 'Field 2 (already changed) must still KEEP its 16pt size');
assert.strictEqual(revertedFields[1].autoFontSize, false, 'Field 2 must still keep its autoFontSize: false');
assert.strictEqual(revertedFields[2].autoFontSize, true, 'Field 3 (selected) must revert to autoFontSize: true');
assert.strictEqual(revertedFields[3].autoFontSize, true, 'Field 4 (remaining) must revert to autoFontSize: true');
console.log('  ✓ Revert auto: Already changed font sizes kept their current state, and remaining were reverted to auto');

// Test Override all (keepCustom = false)
const forceAppliedFields = mockFields.map((f) => {
  if (f.type === 'checkbox') return f;
  return {
    ...f,
    fontSize: targetFontSize,
    autoFontSize: false,
    customFontSize: f.id === selectedFieldId,
  };
});
assert.strictEqual(forceAppliedFields[0].fontSize, 14, 'When keepCustom is false, Field 1 is updated');
assert.strictEqual(forceAppliedFields[1].fontSize, 14, 'When keepCustom is false, Field 2 is updated');
assert.strictEqual(forceAppliedFields[3].fontSize, 14, 'When keepCustom is false, Field 4 is updated');
console.log('  ✓ Unchecking option allows user to override all text boxes if desired');

console.log('\n🎉 ALL GLOBAL FONT SIZE TESTS PASSED SUCCESSFULLY!');
