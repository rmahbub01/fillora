import React, { useRef, useState, useEffect } from 'react';
import { FormField, CheckboxState, HorizontalAlign, VerticalAlign, FontOption, PageInfo } from '../types/pdf';
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
  Baseline,
  Minus,
  Plus,
  RotateCcw,
  Bold,
  Italic,
  Underline,
  Strikethrough,
} from 'lucide-react';

interface RightSidebarProps {
  selectedField: FormField | null;
  allFields?: FormField[];
  pageInfo?: PageInfo;
  onUpdateField: (field: FormField) => void;
  onDeleteField: (id: string) => void;
  onDuplicateField: (field: FormField) => void;
  onApplyFontGlobally: (fontFamily: string) => void;
  onApplyFontSizeGlobally?: (fontSize: number, keepCustom?: boolean) => void;
  onRevertFontSizeGlobally?: (keepCustom?: boolean) => void;
  onApplyTypographyGlobally?: (fontFamily: string, fontSize: number, keepCustom?: boolean) => void;
  allFonts: FontOption[];
  onFontUploaded: (font: FontOption) => void;
  /** Render full-width inside a mobile sheet. */
  embedded?: boolean;
}

interface FontSizeInputProps {
  value: number;
  onChange: (newSize: number) => void;
}

const FontSizeInput: React.FC<FontSizeInputProps> = ({ value, onChange }) => {
  const [localVal, setLocalVal] = useState<string>(String(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(String(value));
    }
  }, [value, isFocused]);

  const commitValue = (raw: string) => {
    const normalized = raw.replace(',', '.');
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(144, Math.max(1, Math.round(parsed * 10) / 10));
      onChange(clamped);
      setLocalVal(String(clamped));
    } else {
      setLocalVal(String(value));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
      value={isFocused ? localVal : value}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (/^[0-9]*[.,]?[0-9]*$/.test(raw)) {
          setLocalVal(raw);
          const normalized = raw.replace(',', '.');
          const parsed = parseFloat(normalized);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 144) {
            onChange(Math.round(parsed * 10) / 10);
          }
        }
      }}
      onBlur={(e) => {
        setIsFocused(false);
        commitValue(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      className="w-16 px-1.5 py-1 text-sm sm:text-xs font-mono font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-md text-center focus:bg-white focus:border-indigo-500 focus:outline-none select-text touch-manipulation"
      title="Manually insert exact font size in points (pt)"
    />
  );
};

export const RightSidebar: React.FC<RightSidebarProps> = ({
  selectedField,
  allFields = [],
  pageInfo,
  onUpdateField,
  onDeleteField,
  onDuplicateField,
  onApplyFontGlobally,
  onApplyFontSizeGlobally,
  onRevertFontSizeGlobally,
  onApplyTypographyGlobally,
  allFonts,
  onFontUploaded,
  embedded = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [keepCustomSizes, setKeepCustomSizes] = useState<boolean>(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg((curr) => (curr === msg ? null : curr));
    }, 2500);
  };

  const customCount = allFields.filter(
    (f) =>
      f.type !== 'checkbox' &&
      f.id !== selectedField?.id &&
      (f.customFontSize === true || (f.customFontSize === undefined && f.autoFontSize === false))
  ).length;

  const handleApplyFontToAll = () => {
    if (!selectedField) return;
    onApplyFontGlobally(selectedField.fontFamily);
    showFeedback(`Applied font "${selectedField.fontFamily}" to all text fields`);
  };

  const handleApplyFontSizeToAll = (targetSize: number) => {
    if (!onApplyFontSizeGlobally) return;
    onApplyFontSizeGlobally(targetSize, keepCustomSizes);
    const preservedText = keepCustomSizes && customCount > 0 ? ` (${customCount} custom preserved)` : '';
    showFeedback(`Applied ${targetSize}pt to remaining text boxes${preservedText}`);
  };

  const handleRevertFontSizeToAuto = () => {
    if (!onRevertFontSizeGlobally) return;
    onRevertFontSizeGlobally(keepCustomSizes);
    const preservedText = keepCustomSizes && customCount > 0 ? ` (${customCount} custom preserved)` : '';
    showFeedback(`Reverted text boxes to auto font size${preservedText}`);
  };

  const handleApplyBothToAll = (targetSize: number) => {
    if (!selectedField || !onApplyTypographyGlobally) return;
    onApplyTypographyGlobally(selectedField.fontFamily, targetSize, keepCustomSizes);
    const preservedText = keepCustomSizes && customCount > 0 ? ` (${customCount} custom preserved)` : '';
    showFeedback(`Applied "${selectedField.fontFamily}" & ${targetSize}pt${preservedText}`);
  };

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
      <div className={`${embedded ? 'w-full h-full' : 'w-80 border-l border-gray-200'} bg-white p-6 flex flex-col items-center justify-center text-center select-none z-20`}>
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
    <div className={`${embedded ? 'w-full' : 'w-80 border-l border-gray-200'} bg-white flex flex-col h-full z-20 overflow-y-auto`}>
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
                  className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono select-text"
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
                  type="button"
                  onClick={handleApplyFontToAll}
                  className="px-2.5 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50/90 hover:bg-indigo-100 hover:text-indigo-800 border border-indigo-200/80 rounded-lg shadow-2xs flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
                  title="Apply this font family to all text fields in the document"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Apply to all</span>
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
                    onChange={(e) =>
                      onUpdateField({
                        ...selectedField,
                        autoFontSize: e.target.checked,
                        customFontSize: !e.target.checked,
                      })
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <label htmlFor="autoSizeToggle" className="text-[11px] text-gray-500 cursor-pointer">
                    Auto-Fit
                  </label>
                </div>
              </div>

              {(() => {
                const pageWidth = pageInfo?.width ?? 595.28;
                const pageHeight = pageInfo?.height ?? 841.89;
                const effectiveSize = getEffectiveFontSizePts(
                  selectedField,
                  selectedField.box.width * pageWidth,
                  selectedField.box.height * pageHeight
                );
                const currentDisplaySize = selectedField.autoFontSize ? effectiveSize : selectedField.fontSize;
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(1, Math.round((currentDisplaySize - 0.5) * 10) / 10);
                          onUpdateField({
                            ...selectedField,
                            fontSize: next,
                            autoFontSize: false,
                            customFontSize: true,
                          });
                        }}
                        title="Decrease font size (-0.5pt)"
                        className="p-1 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition shadow-xs cursor-pointer shrink-0"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="range"
                        min="6"
                        max="72"
                        step="0.5"
                        value={currentDisplaySize}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onUpdateField({
                            ...selectedField,
                            fontSize: val,
                            autoFontSize: false,
                            customFontSize: true,
                          });
                        }}
                        className="flex-1 accent-indigo-600 cursor-pointer min-w-0"
                        title={selectedField.autoFontSize ? 'Drag slider to override auto-fit size' : 'Font size slider'}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.min(144, Math.round((currentDisplaySize + 0.5) * 10) / 10);
                          onUpdateField({
                            ...selectedField,
                            fontSize: next,
                            autoFontSize: false,
                            customFontSize: true,
                          });
                        }}
                        title="Increase font size (+0.5pt)"
                        className="p-1 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition shadow-xs cursor-pointer shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <div className="flex items-center space-x-1 shrink-0">
                        <FontSizeInput
                          value={currentDisplaySize}
                          onChange={(newSize) => {
                            onUpdateField({
                              ...selectedField,
                              fontSize: newSize,
                              autoFontSize: false,
                              customFontSize: true,
                            });
                          }}
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

                    {/* Document-wide Font Size Controls */}
                    <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-700 flex items-center space-x-1">
                          <Baseline className="w-3.5 h-3.5 text-gray-500" />
                          <span>Overlay Font Size</span>
                        </span>
                        {customCount > 0 && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200"
                            title={`${customCount} text box(es) have manually adjusted font sizes and will keep their current state`}
                          >
                            {customCount} custom kept
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyFontSizeToAll(currentDisplaySize)}
                          className="py-1.5 px-2 text-xs font-medium text-indigo-700 bg-indigo-50/90 hover:bg-indigo-100 hover:text-indigo-800 border border-indigo-200/80 rounded-lg shadow-2xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
                          title={`Apply ${currentDisplaySize}pt to remaining overlay text boxes (already changed boxes keep current size)`}
                        >
                          <Check className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Apply to all</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRevertFontSizeToAuto}
                          className="py-1.5 px-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 hover:text-gray-900 border border-gray-300 rounded-lg shadow-2xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
                          title="Revert overlay text boxes to auto font size (already changed boxes keep current size)"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                          <span>Revert auto</span>
                        </button>
                      </div>

                      <label
                        className="flex items-center space-x-1.5 text-[10px] text-gray-500 cursor-pointer select-none"
                        title="When enabled, text boxes where you have already manually adjusted the font size keep their custom size"
                      >
                        <input
                          type="checkbox"
                          checked={keepCustomSizes}
                          onChange={(e) => setKeepCustomSizes(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3 cursor-pointer"
                        />
                        <span>Keep already changed font sizes</span>
                      </label>
                    </div>

                    {/* Merged Global Action: Apply Font & Size to all */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleApplyBothToAll(currentDisplaySize)}
                        className="w-full py-1.5 px-2.5 text-xs font-medium text-indigo-700 bg-white hover:bg-indigo-50/80 border border-indigo-200/90 hover:border-indigo-300 rounded-lg shadow-2xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
                        title={`Apply font "${selectedField.fontFamily}" and size ${currentDisplaySize}pt to all overlay text boxes`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Apply Font & Size to all</span>
                      </button>
                    </div>

                    {/* Feedback Toast */}
                    {feedbackMsg && (
                      <div className="py-1.5 px-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center space-x-1.5 transition animate-in fade-in">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{feedbackMsg}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Text Formatting (Bold, Italic, Underline, Strikethrough) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Text Formatting
              </label>
              <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => onUpdateField({ ...selectedField, bold: !selectedField.bold })}
                  title={selectedField.bold ? 'Bold (Active)' : 'Bold'}
                  className={`py-1.5 flex items-center justify-center rounded transition cursor-pointer ${
                    selectedField.bold
                      ? 'bg-white text-indigo-600 shadow-xs font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateField({ ...selectedField, italic: !selectedField.italic })}
                  title={selectedField.italic ? 'Italic (Active)' : 'Italic'}
                  className={`py-1.5 flex items-center justify-center rounded transition cursor-pointer ${
                    selectedField.italic
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateField({ ...selectedField, underline: !selectedField.underline })}
                  title={selectedField.underline ? 'Underline (Active)' : 'Underline'}
                  className={`py-1.5 flex items-center justify-center rounded transition cursor-pointer ${
                    selectedField.underline
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateField({ ...selectedField, strikethrough: !selectedField.strikethrough })}
                  title={selectedField.strikethrough ? 'Strikethrough (Active)' : 'Strikethrough'}
                  className={`py-1.5 flex items-center justify-center rounded transition cursor-pointer ${
                    selectedField.strikethrough
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
              </div>
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
                  className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono select-text"
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
                    title={
                      valign === 'top'
                        ? 'Align Top'
                        : valign === 'middle'
                        ? 'Align Middle'
                        : 'Align Bottom'
                    }
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

            {/* Line Spacing / Line Height in Multiline Mode */}
            {selectedField.multiline && (
              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Baseline className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-semibold text-gray-700">Line Spacing</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {Number(selectedField.lineHeight ?? 1.35).toFixed(2)}x
                  </span>
                </div>

                {/* Quick Presets to reduce or adjust line spacing */}
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: 'Tight', value: 1.0 },
                    { label: 'Compact', value: 1.15 },
                    { label: 'Normal', value: 1.35 },
                    { label: 'Relaxed', value: 1.6 },
                  ].map((preset) => {
                    const currentVal = selectedField.lineHeight ?? 1.35;
                    const isActive = Math.abs(currentVal - preset.value) < 0.03;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => onUpdateField({ ...selectedField, lineHeight: preset.value })}
                        className={`py-1 text-[11px] rounded transition ${
                          isActive
                            ? 'bg-indigo-600 text-white font-medium shadow-xs'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                        title={`Set line spacing to ${preset.value}x`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Fine-Tuning Step Controls & Custom Numeric Input */}
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedField.lineHeight ?? 1.35;
                      const next = Math.max(0.7, Math.round((cur - 0.05) * 100) / 100);
                      onUpdateField({ ...selectedField, lineHeight: next });
                    }}
                    title="Reduce line spacing (-0.05)"
                    className="p-1 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition shadow-xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <input
                    type="range"
                    min="0.7"
                    max="2.5"
                    step="0.05"
                    value={selectedField.lineHeight ?? 1.35}
                    onChange={(e) => onUpdateField({ ...selectedField, lineHeight: parseFloat(e.target.value) })}
                    className="flex-1 accent-indigo-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedField.lineHeight ?? 1.35;
                      const next = Math.min(3.0, Math.round((cur + 0.05) * 100) / 100);
                      onUpdateField({ ...selectedField, lineHeight: next });
                    }}
                    title="Increase line spacing (+0.05)"
                    className="p-1 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  {/* Direct Numeric Input for any custom value */}
                  <div className="w-16">
                    <input
                      type="number"
                      min="0.5"
                      max="3.0"
                      step="0.05"
                      value={selectedField.lineHeight ?? 1.35}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0.5 && val <= 3.0) {
                          onUpdateField({ ...selectedField, lineHeight: val });
                        }
                      }}
                      className="w-full px-1.5 py-1 text-xs text-center font-mono bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500 select-text"
                    />
                  </div>
                </div>
              </div>
            )}
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
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      onUpdateField({
                        ...selectedField,
                        box: { ...selectedField.box, x: Math.max(0, Math.min(1, val / 100)) },
                      });
                    }
                  }}
                  className="w-full mt-0.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded font-mono select-text"
                />
              </div>
              <div>
                <span className="text-gray-400">Y:</span>
                <input
                  type="number"
                  step="0.1"
                  value={Math.round(selectedField.box.y * 1000) / 10}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      onUpdateField({
                        ...selectedField,
                        box: { ...selectedField.box, y: Math.max(0, Math.min(1, val / 100)) },
                      });
                    }
                  }}
                  className="w-full mt-0.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded font-mono select-text"
                />
              </div>
              <div>
                <span className="text-gray-400">Width:</span>
                <input
                  type="number"
                  step="0.1"
                  value={Math.round(selectedField.box.width * 1000) / 10}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      onUpdateField({
                        ...selectedField,
                        box: { ...selectedField.box, width: Math.max(0.005, Math.min(1, val / 100)) },
                      });
                    }
                  }}
                  className="w-full mt-0.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded font-mono select-text"
                />
              </div>
              <div>
                <span className="text-gray-400">Height:</span>
                <input
                  type="number"
                  step="0.1"
                  value={Math.round(selectedField.box.height * 1000) / 10}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      onUpdateField({
                        ...selectedField,
                        box: { ...selectedField.box, height: Math.max(0.005, Math.min(1, val / 100)) },
                      });
                    }
                  }}
                  className="w-full mt-0.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded font-mono select-text"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
