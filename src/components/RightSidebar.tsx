import React, { useRef } from 'react';
import { FormField, CheckboxState, HorizontalAlign, VerticalAlign, FontOption } from '../types/pdf';
import { fontManager } from '../services/fontManager';
import { getEffectiveFontSizePts } from '../utils/typography';
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Lock,
  Unlock,
  Upload,
  Check,
  X,
  Circle,
  Square,
  Sparkles,
  Sliders,
  Trash2,
  Copy,
  Info,
} from 'lucide-react';

interface RightSidebarProps {
  selectedField: FormField | null;
  onUpdateField: (field: FormField) => void;
  onDeleteField: (id: string) => void;
  onDuplicateField: (field: FormField) => void;
  onApplyFontGlobally: (fontFamily: string) => void;
  allFonts: FontOption[];
  onFontUploaded: (font: FontOption) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  selectedField,
  onUpdateField,
  onDeleteField,
  onDuplicateField,
  onApplyFontGlobally,
  allFonts,
  onFontUploaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const font = await fontManager.loadCustomFont(file);
      onFontUploaded(font);
      if (selectedField) {
        onUpdateField({ ...selectedField, fontFamily: font.family });
      }
    } catch (err) {
      alert(`Could not load font file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      e.target.value = '';
    }
  };

  if (!selectedField) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 p-6 flex flex-col items-center justify-center text-center select-none z-20">
        <Sliders className="w-10 h-10 text-gray-300 mb-3 stroke-1" />
        <h3 className="text-sm font-semibold text-gray-700">Properties & Styling</h3>
        <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
          Select any form field or checkbox on the PDF to inspect and customize its font, size, alignment, and dimensions.
        </p>

        {/* Global font upload shortcut */}
        <div className="mt-8 w-full border-t border-gray-100 pt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            onChange={handleFontUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 px-3 border border-dashed border-indigo-300 rounded-xl text-xs text-indigo-600 hover:bg-indigo-50/50 flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Custom Font (TTF / OTF / WOFF / WOFF2)</span>
          </button>
          <p className="text-[10px] text-gray-400 mt-2">
            Upload custom Bangla or branded fonts to use throughout the document.
          </p>
        </div>
      </div>
    );
  }

  const isCheckbox = selectedField.type === 'checkbox';

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full z-20 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <span className="text-xs font-mono uppercase text-indigo-600 font-semibold tracking-wider">
            {selectedField.type} Field
          </span>
          <h3 className="text-sm font-bold text-gray-800 truncate">
            {selectedField.label || 'Field Properties'}
          </h3>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onDuplicateField(selectedField)}
            title="Duplicate Field"
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteField(selectedField.id)}
            title="Delete Field"
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5 text-xs text-gray-700">
        {/* Lock / Unlock Control */}
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-gray-800 flex items-center space-x-1.5">
              {selectedField.locked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-gray-600" />
                  <span>Field is Locked</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-700">Field is Unlocked</span>
                </>
              )}
            </span>
            <button
              onClick={() => onUpdateField({ ...selectedField, locked: !selectedField.locked })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                selectedField.locked
                  ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 shadow-xs'
                  : 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs'
              }`}
            >
              {selectedField.locked ? 'Unlock' : 'Lock'}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 leading-normal">
            {selectedField.locked
              ? 'Alignment is locked to the original PDF form field to prevent accidental movement.'
              : 'You can freely drag and resize the field handles on the document.'}
          </p>
        </div>

        {/* Checkbox Specific Controls */}
        {isCheckbox ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Checkbox State
              </label>
              <div className="grid grid-cols-4 gap-1.5 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => onUpdateField({ ...selectedField, checkboxState: 'empty' })}
                  className={`py-2 flex flex-col items-center justify-center rounded-lg transition ${
                    selectedField.checkboxState === 'empty'
                      ? 'bg-white text-gray-900 shadow-xs font-medium'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Empty / Unchecked"
                >
                  <Square className="w-4 h-4 mb-0.5" />
                  <span className="text-[10px]">Empty</span>
                </button>
                <button
                  onClick={() => onUpdateField({ ...selectedField, checkboxState: 'check' })}
                  className={`py-2 flex flex-col items-center justify-center rounded-lg transition ${
                    selectedField.checkboxState === 'check'
                      ? 'bg-white text-emerald-600 shadow-xs font-medium'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Checkmark (✓)"
                >
                  <Check className="w-4 h-4 mb-0.5" />
                  <span className="text-[10px]">Check</span>
                </button>
                <button
                  onClick={() => onUpdateField({ ...selectedField, checkboxState: 'cross' })}
                  className={`py-2 flex flex-col items-center justify-center rounded-lg transition ${
                    selectedField.checkboxState === 'cross'
                      ? 'bg-white text-red-600 shadow-xs font-medium'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Cross (✗)"
                >
                  <X className="w-4 h-4 mb-0.5" />
                  <span className="text-[10px]">Cross</span>
                </button>
                <button
                  onClick={() => onUpdateField({ ...selectedField, checkboxState: 'dot' })}
                  className={`py-2 flex flex-col items-center justify-center rounded-lg transition ${
                    selectedField.checkboxState === 'dot'
                      ? 'bg-white text-indigo-600 shadow-xs font-medium'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Dot (•)"
                >
                  <Circle className="w-3.5 h-3.5 mb-0.5 fill-current" />
                  <span className="text-[10px]">Dot</span>
                </button>
              </div>
            </div>

            {/* Checkbox Color */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Mark Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={selectedField.color}
                  onChange={(e) => onUpdateField({ ...selectedField, color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={selectedField.color}
                  onChange={(e) => onUpdateField({ ...selectedField, color: e.target.value })}
                  className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Text / Multiline Field Controls */
          <div className="space-y-4">
            {/* Font Family */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700">Font Family</label>
                <button
                  onClick={() => onApplyFontGlobally(selectedField.fontFamily)}
                  className="text-[10px] text-indigo-600 hover:underline"
                  title="Apply this font to all text fields in the document"
                >
                  Apply to all
                </button>
              </div>
              <select
                value={selectedField.fontFamily}
                onChange={(e) => onUpdateField({ ...selectedField, fontFamily: e.target.value })}
                className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <optgroup label="Bangla Unicode Fonts (যুক্তাক্ষর সহ)">
                  {allFonts
                    .filter((f) => f.isBangla)
                    .map((font) => (
                      <option key={font.id} value={font.family}>
                        {font.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="English & Standard Fonts">
                  {allFonts
                    .filter((f) => !f.isBangla)
                    .map((font) => (
                      <option key={font.id} value={font.family}>
                        {font.name}
                      </option>
                    ))}
                </optgroup>
              </select>

              {/* Upload Font File Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={handleFontUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 w-full py-1.5 px-2 border border-dashed border-gray-300 hover:border-indigo-400 text-gray-600 hover:text-indigo-600 rounded-lg text-[11px] flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom Font (TTF / OTF / WOFF / WOFF2)</span>
              </button>
            </div>

            {/* Font Sizing */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700">Font Size</label>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="checkbox"
                    id="autoSizeToggle"
                    checked={selectedField.autoFontSize}
                    onChange={(e) => onUpdateField({ ...selectedField, autoFontSize: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <label htmlFor="autoSizeToggle" className="text-[11px] text-gray-500 cursor-pointer">
                    Auto-Fit
                  </label>
                </div>
              </div>

              {(() => {
                const effectiveSize = getEffectiveFontSizePts(
                  selectedField,
                  selectedField.box.width * 595,
                  selectedField.box.height * 842
                );
                const currentDisplaySize = selectedField.autoFontSize ? effectiveSize : selectedField.fontSize;
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="6"
                        max="72"
                        step="0.5"
                        value={currentDisplaySize}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onUpdateField({ ...selectedField, fontSize: val, autoFontSize: false });
                        }}
                        className="flex-1 accent-indigo-600 cursor-pointer"
                        title={selectedField.autoFontSize ? 'Drag slider to override auto-fit size' : 'Font size slider'}
                      />
                      <div className="flex items-center space-x-1 shrink-0">
                        <input
                          type="number"
                          min="1"
                          max="144"
                          step="0.5"
                          value={currentDisplaySize}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              onUpdateField({
                                ...selectedField,
                                fontSize: Math.min(144, Math.max(1, Math.round(val * 10) / 10)),
                                autoFontSize: false,
                              });
                            }
                          }}
                          className="w-16 px-1.5 py-1 text-xs font-mono font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-md text-center focus:bg-white focus:border-indigo-500 focus:outline-none"
                          title="Manually insert exact font size in points (pt)"
                        />
                        <span className="text-[11px] font-mono text-gray-400">pt</span>
                      </div>
                    </div>
                    {selectedField.autoFontSize ? (
                      <p className="text-[10px] text-indigo-600 font-medium">
                        ✦ Auto-scaled to {effectiveSize}pt (edit number or slider to override)
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-400">
                        Manual font size: {selectedField.fontSize}pt (check Auto-Fit to reset)
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Text Color */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Text Color</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={selectedField.color}
                  onChange={(e) => onUpdateField({ ...selectedField, color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={selectedField.color}
                  onChange={(e) => onUpdateField({ ...selectedField, color: e.target.value })}
                  className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            {/* Text Alignment */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Horizontal Alignment
              </label>
              <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
                {(['left', 'center', 'right'] as HorizontalAlign[]).map((align) => (
                  <button
                    key={align}
                    onClick={() => onUpdateField({ ...selectedField, hAlign: align })}
                    className={`py-1 flex items-center justify-center rounded transition ${
                      selectedField.hAlign === align ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                    {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                    {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Vertical Alignment */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Vertical Alignment
              </label>
              <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
                {(['top', 'middle', 'bottom'] as VerticalAlign[]).map((valign) => (
                  <button
                    key={valign}
                    onClick={() => onUpdateField({ ...selectedField, vAlign: valign })}
                    className={`py-1 flex items-center justify-center rounded transition ${
                      selectedField.vAlign === valign ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {valign === 'top' && <AlignVerticalJustifyStart className="w-3.5 h-3.5" />}
                    {valign === 'middle' && <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />}
                    {valign === 'bottom' && <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Multiline Toggle */}
            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
              <span className="font-medium text-gray-700">Multiline Text Area</span>
              <input
                type="checkbox"
                checked={selectedField.multiline}
                onChange={(e) => onUpdateField({ ...selectedField, multiline: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Position & Dimension coordinates (editable when unlocked) */}
        {!selectedField.locked && (
          <div className="pt-3 border-t border-gray-100">
            <span className="block text-xs font-semibold text-gray-700 mb-2">
              Bounding Box (% of Page)
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-gray-400">X:</span>
                <input
                  type="number"
                  step="0.1"
                  value={Math.round(selectedField.box.x * 1000) / 10}
                  onChange={(e) =>
                    onUpdateField({
                      ...selectedField,
                      box: { ...selectedField.box, x: Number(e.target.value) / 100 },
                    })
                  }
                  className="w-full mt-0.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded font-mono"
                />
              </div>
              <div>
                <span className="text-gray-400">Y:</span>
                <input
                  type="number"
                  step="0.1"
                  value={Math.round(selectedField.box.y * 1000) / 10}
                  onChange={(e) =>
                    onUpdateField({
                      ...selectedField,
                      box: { ...selectedField.box, y: Number(e.target.value) / 100 },
                    })
                  }
                  className="w-full mt-0.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded font-mono"
                />
              </div>
              <div>
                <span className="text-gray-400">Width:</span>
                <input
                  type="number"
                  step="0.1"
                  value={Math.round(selectedField.box.width * 1000) / 10}
                  onChange={(e) =>
                    onUpdateField({
                      ...selectedField,
                      box: { ...selectedField.box, width: Number(e.target.value) / 100 },
                    })
                  }
                  className="w-full mt-0.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded font-mono"
                />
              </div>
              <div>
                <span className="text-gray-400">Height:</span>
                <input
                  type="number"
                  step="0.1"
                  value={Math.round(selectedField.box.height * 1000) / 10}
                  onChange={(e) =>
                    onUpdateField({
                      ...selectedField,
                      box: { ...selectedField.box, height: Number(e.target.value) / 100 },
                    })
                  }
                  className="w-full mt-0.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
