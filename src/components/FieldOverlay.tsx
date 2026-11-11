import React, { useRef, useEffect, useState } from 'react';
import { FormField, CheckboxState } from '../types/pdf';
import { getEffectiveFontSizePts } from '../utils/typography';
import { Lock, Unlock, Trash2, Check, X, Circle, GripHorizontal } from 'lucide-react';

interface FieldOverlayProps {
  field: FormField;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChange: (updated: FormField, shouldCommit?: boolean) => void;
  onDelete: (id: string) => void;
  pageWidth: number;
  pageHeight: number;
  scale: number;
}

export const FieldOverlay: React.FC<FieldOverlayProps> = ({
  field,
  isSelected,
  onSelect,
  onChange,
  onDelete,
  pageWidth,
  pageHeight,
  scale,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });
  const dragDistRef = useRef<number>(0);
  const currentBoxRef = useRef(field.box);
  const [multilineHeight, setMultilineHeight] = useState<number>(0);

  currentBoxRef.current = field.box;

  // Calculate actual pixel dimensions inside the page viewport
  const pixelLeft = field.box.x * pageWidth * scale;
  const pixelTop = field.box.y * pageHeight * scale;
  const pixelWidth = Math.max(4, field.box.width * pageWidth * scale);
  const pixelHeight = Math.max(4, field.box.height * pageHeight * scale);

  // Exact unified typography calculation matching the PDF exporter
  const fieldWidthPts = field.box.width * pageWidth;
  const fieldHeightPts = field.box.height * pageHeight;
  const effectiveFontSizePts = getEffectiveFontSizePts(field, fieldWidthPts, fieldHeightPts);
  const computedFontSize = effectiveFontSizePts * scale;

  // Headroom padding so Bengali ascenders (ি, ী, র্ক, ঁ) are never clipped by the textarea in Tight/Compact line spacing
  const padTopPx = Math.max(6, Math.ceil(computedFontSize * 0.35));
  const padBottomPx = Math.max(4, Math.ceil(computedFontSize * 0.20));

  // Auto-grow textarea height so text grows outside the box without clipping
  useEffect(() => {
    if (field.multiline && inputRef.current) {
      const textarea = inputRef.current as HTMLTextAreaElement;
      textarea.style.height = 'auto';
      const scrollH = textarea.scrollHeight;
      textarea.style.height = `${scrollH}px`;
      setMultilineHeight(scrollH);
    }
  }, [field.value, field.multiline, field.vAlign, field.lineHeight, pixelHeight, computedFontSize, scale]);


  const handleMouseDownMove = (e: React.MouseEvent) => {
    if (field.locked) return;
    e.stopPropagation();
    onSelect(field.id);
    setIsDragging(true);
    dragDistRef.current = 0;
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: field.box.x,
      boxY: field.box.y,
      boxW: field.box.width,
      boxH: field.box.height,
    });
  };

  const handleMouseDownResize = (direction: string, e: React.MouseEvent) => {
    if (field.locked) return;
    e.stopPropagation();
    onSelect(field.id);
    setIsResizing(direction);
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: field.box.x,
      boxY: field.box.y,
      boxW: field.box.width,
      boxH: field.box.height,
    });
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(field.id);

    // If mouse was dragged while unlocked, do not toggle checkbox
    if (dragDistRef.current >= 4) {
      return;
    }

    const nextStates: Record<CheckboxState, CheckboxState> = {
      empty: 'check',
      check: 'cross',
      cross: 'dot',
      dot: 'empty',
    };

    onChange({
      ...field,
      checkboxState: nextStates[field.checkboxState],
    }, true);
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - dragStart.mouseX) / (pageWidth * scale);
      const deltaY = (e.clientY - dragStart.mouseY) / (pageHeight * scale);
      dragDistRef.current += Math.hypot(e.movementX, e.movementY);

      if (isDragging) {
        const newX = Math.max(0, Math.min(1 - dragStart.boxW, dragStart.boxX + deltaX));
        const newY = Math.max(0, Math.min(1 - dragStart.boxH, dragStart.boxY + deltaY));
        const updatedBox = { ...field.box, x: newX, y: newY };
        currentBoxRef.current = updatedBox;
        onChange({
          ...field,
          box: updatedBox,
        }, false); // Smooth live update without flood-pushing history
      } else if (isResizing) {
        let newX = dragStart.boxX;
        let newY = dragStart.boxY;
        let newW = dragStart.boxW;
        let newH = dragStart.boxH;

        if (isResizing.includes('e')) {
          newW = Math.max(0.005, Math.min(1 - newX, dragStart.boxW + deltaX));
        }
        if (isResizing.includes('s')) {
          newH = Math.max(0.005, Math.min(1 - newY, dragStart.boxH + deltaY));
        }
        if (isResizing.includes('w')) {
          const maxLeftMove = dragStart.boxX + dragStart.boxW - 0.005;
          newX = Math.max(0, Math.min(maxLeftMove, dragStart.boxX + deltaX));
          newW = dragStart.boxW - (newX - dragStart.boxX);
        }
        if (isResizing.includes('n')) {
          const maxUpMove = dragStart.boxY + dragStart.boxH - 0.005;
          newY = Math.max(0, Math.min(maxUpMove, dragStart.boxY + deltaY));
          newH = dragStart.boxH - (newY - dragStart.boxY);
        }

        const updatedBox = { x: newX, y: newY, width: newW, height: newH };
        currentBoxRef.current = updatedBox;
        onChange({
          ...field,
          box: updatedBox,
        }, false);
      }
    };

    const handleMouseUp = () => {
      const b = currentBoxRef.current;
      const cleanBox = {
        x: Math.round(b.x * 10000) / 10000,
        y: Math.round(b.y * 10000) / 10000,
        width: Math.round(b.width * 10000) / 10000,
        height: Math.round(b.height * 10000) / 10000,
      };
      // Commit final position to history once
      onChange({
        ...field,
        box: cleanBox,
      }, true);
      setIsDragging(false);
      setIsResizing(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, field, onChange, pageWidth, pageHeight, scale]);

  // Checkbox Field
  if (field.type === 'checkbox') {
    return (
      <div
        ref={containerRef}
        onClick={handleCheckboxClick}
        onMouseDown={handleMouseDownMove}
        className={`absolute group select-none transition-all flex items-center justify-center ${
          isSelected
            ? 'ring-2 ring-indigo-500 ring-inset shadow-md bg-indigo-50/50 z-30'
            : 'hover:ring-1 hover:ring-indigo-400 hover:ring-inset hover:bg-indigo-50/25 z-10'
        } ${field.locked ? 'cursor-pointer' : 'cursor-move border-2 border-dashed border-indigo-400 bg-indigo-50/20'}`}
        style={{
          left: `${pixelLeft}px`,
          top: `${pixelTop}px`,
          width: `${pixelWidth}px`,
          height: `${pixelHeight}px`,
          boxSizing: 'border-box',
        }}
        title={`Checkbox: Click to toggle (${field.checkboxState}). ${field.locked ? 'Locked' : 'Unlocked (drag to move, drag corners to resize)'}`}
      >
        {/* Checkbox Symbol */}
        {field.checkboxState === 'check' && (
          <Check className="text-gray-900 stroke-[3] pointer-events-none" style={{ width: '85%', height: '85%', color: field.color }} />
        )}
        {field.checkboxState === 'cross' && (
          <X className="text-gray-900 stroke-[3] pointer-events-none" style={{ width: '85%', height: '85%', color: field.color }} />
        )}
        {field.checkboxState === 'dot' && (
          <div className="rounded-full bg-gray-900 pointer-events-none" style={{ width: '55%', height: '55%', backgroundColor: field.color }} />
        )}

        {/* Small floating control bar when selected */}
        {isSelected && (
          <div className="absolute -top-7 left-0 flex items-center space-x-1 bg-gray-900 text-white text-xs px-2 py-0.5 rounded shadow-lg z-50 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...field, locked: !field.locked }, true);
              }}
              title={field.locked ? 'Unlock (allow move/resize)' : 'Lock (freeze position)'}
              className={`p-0.5 rounded transition ${field.locked ? 'text-gray-300 hover:text-white' : 'text-indigo-400 hover:text-indigo-300'}`}
            >
              {field.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
            <span className="text-[10px] text-gray-400 font-mono uppercase">Checkbox</span>
            <div className="w-[1px] h-3 bg-gray-700" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(field.id);
              }}
              title="Delete Checkbox"
              className="p-0.5 text-red-400 hover:text-red-300 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 4 Corner Resize Handles when unlocked */}
        {!field.locked && (
          <>
            <div
              onMouseDown={(e) => handleMouseDownResize('nw', e)}
              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nwse-resize z-40"
              title="Resize checkbox"
            />
            <div
              onMouseDown={(e) => handleMouseDownResize('ne', e)}
              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nesw-resize z-40"
              title="Resize checkbox"
            />
            <div
              onMouseDown={(e) => handleMouseDownResize('se', e)}
              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nwse-resize z-40"
              title="Resize checkbox"
            />
            <div
              onMouseDown={(e) => handleMouseDownResize('sw', e)}
              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nesw-resize z-40"
              title="Resize checkbox"
            />
          </>
        )}
      </div>
    );
  }

  // Dynamic box height growth:
  // When font size is too big or text goes outside the overlay text box, the box height grows accordingly,
  // expanding evenly in both sides (up and down), keeping position and initial center at initial state.
  // The overlay text box container stays fixed in place without jumping around when changing alignments.
  // When font size is equal or smaller than normal, the box height keeps its original state (pixelHeight).
  const hasOverflowingText = Boolean(field.value && field.value.trim().length > 0);
  const neededHeightPx = field.multiline
    ? (hasOverflowingText && multilineHeight ? multilineHeight : pixelHeight)
    : (hasOverflowingText ? Math.ceil(computedFontSize * 1.35) : pixelHeight);
  const effectivePixelHeight = Math.max(pixelHeight, neededHeightPx);
  const extraHeightPx = Math.max(0, effectivePixelHeight - pixelHeight);
  const effectivePixelTop = pixelTop - extraHeightPx / 2;

  // Text / Multiline / Signature Field
  return (
    <div
      ref={containerRef}
      onClick={() => onSelect(field.id)}
      className={`absolute group transition-shadow ${
        isSelected
          ? 'ring-2 ring-indigo-500 ring-inset bg-white/85 shadow-sm z-30'
          : field.value
          ? 'hover:ring-1 hover:ring-indigo-300 hover:ring-inset hover:bg-white/40 z-10'
          : 'border border-indigo-200/50 bg-indigo-50/10 hover:border-indigo-400 hover:bg-indigo-50/25 z-10'
      } ${!field.locked && isSelected ? 'border border-dashed border-indigo-400' : ''}`}
      style={{
        left: `${pixelLeft}px`,
        top: `${effectivePixelTop}px`,
        width: `${pixelWidth}px`,
        height: `${effectivePixelHeight}px`,
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      {/* Floating control bar when selected (consistent with overlay text boxes) */}
      {isSelected && (
        <div className="absolute -top-7 left-0 flex items-center space-x-1.5 bg-gray-900 text-white text-xs px-2 py-0.5 rounded shadow-lg z-50 pointer-events-auto">
          {field.locked ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...field, locked: false }, true);
              }}
              title="Click to Unlock (allows moving and resizing with mouse)"
              className="p-0.5 rounded text-gray-300 hover:text-white transition flex items-center space-x-1"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="text-[10px]">Locked</span>
            </button>
          ) : (
            <div
              onMouseDown={handleMouseDownMove}
              title="Click and drag to move this field anywhere on the PDF"
              className="flex items-center space-x-1 cursor-move select-none"
            >
              <GripHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-semibold tracking-wide uppercase text-indigo-200">Move Field</span>
            </div>
          )}
          <span className="text-[10px] text-gray-400 font-mono uppercase">{field.type}</span>
          <div className="w-[1px] h-3 bg-gray-700" />
          {!field.locked && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...field, locked: true }, true);
              }}
              title="Lock field in place"
              className="p-0.5 text-gray-300 hover:text-white rounded transition"
            >
              <Unlock className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(field.id);
            }}
            title="Delete this field"
            className="p-0.5 text-red-400 hover:text-red-300 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Actual Input Overlay */}
      {field.multiline ? (
        <div
          onClick={() => (inputRef.current as HTMLTextAreaElement | null)?.focus()}
          className={`w-full h-full flex flex-col ${
            field.vAlign === 'middle'
              ? 'justify-center'
              : field.vAlign === 'bottom'
              ? 'justify-end'
              : 'justify-start'
          }`}
          style={{
            paddingLeft: `${Math.max(2, 4 * scale)}px`,
            paddingRight: `${Math.max(2, 4 * scale)}px`,
            paddingTop: '0px',
            paddingBottom: '0px',
            overflow: 'visible',
          }}
        >
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={field.value}
            onChange={(e) => {
              onChange({ ...field, value: e.target.value }, true);
              if (field.multiline) {
                e.target.style.height = 'auto';
                const newH = e.target.scrollHeight;
                e.target.style.height = `${newH}px`;
                setMultilineHeight(newH);
              }
            }}
            onFocus={() => onSelect(field.id)}
            placeholder="Type here..."
            rows={1}
            style={{
              fontFamily: `"${field.fontFamily}", Kalpurush, Nikosh, "Noto Sans Bengali", sans-serif`,
              fontSize: `${computedFontSize}px`,
              fontWeight: field.bold ? 'bold' : 'normal',
              fontStyle: field.italic ? 'italic' : 'normal',
              textDecoration: [field.underline && 'underline', field.strikethrough && 'line-through'].filter(Boolean).join(' ') || 'none',
              color: field.color,
              textAlign: field.hAlign,
              lineHeight: field.lineHeight ?? 1.35,
              paddingTop: `${padTopPx}px`,
              paddingBottom: `${padBottomPx}px`,
              marginTop: `-${padTopPx}px`,
              height: multilineHeight ? `${multilineHeight}px` : 'auto',
              overflow: 'visible',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}
            className="w-full bg-transparent resize-none outline-none border-none p-0 m-0 text-gray-900 font-normal placeholder:text-gray-400/50 placeholder:italic placeholder:font-normal break-words"
          />
        </div>
      ) : (
        <div
          className={`w-full h-full flex ${
            field.vAlign === 'top'
              ? 'items-start'
              : field.vAlign === 'bottom'
              ? 'items-end'
              : 'items-center'
          }`}
          style={{
            paddingLeft: `${Math.max(2, 4 * scale)}px`,
            paddingRight: `${Math.max(2, 4 * scale)}px`,
            paddingTop: '0px',
            paddingBottom: '0px',
            overflow: 'visible',
          }}
        >
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={field.value}
            onChange={(e) => onChange({ ...field, value: e.target.value }, true)}
            onFocus={() => onSelect(field.id)}
            placeholder="Type here..."
            style={{
              fontFamily: `"${field.fontFamily}", Kalpurush, Nikosh, "Noto Sans Bengali", sans-serif`,
              fontSize: `${computedFontSize}px`,
              fontWeight: field.bold ? 'bold' : 'normal',
              fontStyle: field.italic ? 'italic' : 'normal',
              textDecoration: [field.underline && 'underline', field.strikethrough && 'line-through'].filter(Boolean).join(' ') || 'none',
              color: field.color,
              textAlign: field.hAlign,
              lineHeight: 1.25,
              paddingTop: '0px',
              paddingBottom: '0px',
              overflow: 'visible',
            }}
            className="w-full bg-transparent outline-none border-none p-0 m-0 text-gray-900 font-normal placeholder:text-gray-400/50 placeholder:italic placeholder:font-normal"
          />
        </div>
      )}

      {/* 8 Prominent, Easy-to-Grab Resize Handles when UNLOCKED */}
      {!field.locked && (
        <>
          {/* NW */}
          <div
            onMouseDown={(e) => handleMouseDownResize('nw', e)}
            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nwse-resize z-40 hover:scale-125 transition-transform"
            title="Resize North-West"
          />
          {/* N */}
          <div
            onMouseDown={(e) => handleMouseDownResize('n', e)}
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-ns-resize z-40 hover:scale-125 transition-transform"
            title="Resize Height (North)"
          />
          {/* NE */}
          <div
            onMouseDown={(e) => handleMouseDownResize('ne', e)}
            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nesw-resize z-40 hover:scale-125 transition-transform"
            title="Resize North-East"
          />
          {/* E */}
          <div
            onMouseDown={(e) => handleMouseDownResize('e', e)}
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-ew-resize z-40 hover:scale-125 transition-transform"
            title="Resize Width (East)"
          />
          {/* SE */}
          <div
            onMouseDown={(e) => handleMouseDownResize('se', e)}
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nwse-resize z-40 hover:scale-125 transition-transform"
            title="Resize South-East"
          />
          {/* S */}
          <div
            onMouseDown={(e) => handleMouseDownResize('s', e)}
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-ns-resize z-40 hover:scale-125 transition-transform"
            title="Resize Height (South)"
          />
          {/* SW */}
          <div
            onMouseDown={(e) => handleMouseDownResize('sw', e)}
            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nesw-resize z-40 hover:scale-125 transition-transform"
            title="Resize South-West"
          />
          {/* W */}
          <div
            onMouseDown={(e) => handleMouseDownResize('w', e)}
            className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-ew-resize z-40 hover:scale-125 transition-transform"
            title="Resize Width (West)"
          />
        </>
      )}
    </div>
  );
};
