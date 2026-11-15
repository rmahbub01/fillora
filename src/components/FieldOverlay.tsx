import React, { useRef, useEffect, useState } from 'react';
import { FormField, CheckboxState, BoundingBox } from '../types/pdf';
import { getEffectiveFontSizePts } from '../utils/typography';
import { isMobileDevice } from '../utils/device';
import { calculateSmartGuidesAndSnap, SmartGuideLine } from '../utils/smartGuides';
import { Lock, Unlock, Trash2, Check, X, Circle, GripHorizontal, LayoutGrid } from 'lucide-react';

interface FieldOverlayProps {
  field: FormField;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChange: (updated: FormField, shouldCommit?: boolean) => void;
  onDelete: (id: string) => void;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  otherFields?: FormField[];
  onGuidesChange?: (guides: SmartGuideLine[]) => void;
  smartGuidesEnabled?: boolean;
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
  otherFields = [],
  onGuidesChange,
  smartGuidesEnabled = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{
    pointerId?: number;
    mouseX: number;
    mouseY: number;
    boxX: number;
    boxY: number;
    boxW: number;
    boxH: number;
  }>({ mouseX: 0, mouseY: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });
  const dragDistRef = useRef<number>(0);
  const currentBoxRef = useRef(field.box);
  const multilineHeightRef = useRef<number>(0);
  const [multilineHeight, setMultilineHeight] = useState<number>(0);
  const [activeCellIndex, setActiveCellIndex] = useState<number>(0);

  currentBoxRef.current = field.box;

  // Keep fresh references for drag/resize handlers to avoid effect churn
  const fieldRef = useRef(field);
  fieldRef.current = field;

  const otherFieldsRef = useRef(otherFields);
  otherFieldsRef.current = otherFields;

  const onGuidesChangeRef = useRef(onGuidesChange);
  onGuidesChangeRef.current = onGuidesChange;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const smartGuidesEnabledRef = useRef(smartGuidesEnabled);
  smartGuidesEnabledRef.current = smartGuidesEnabled;

  const dragStartRef = useRef(dragStart);
  dragStartRef.current = dragStart;

  const isResizingRef = useRef(isResizing);
  isResizingRef.current = isResizing;

  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const pageWidthRef = useRef(pageWidth);
  pageWidthRef.current = pageWidth;

  const pageHeightRef = useRef(pageHeight);
  pageHeightRef.current = pageHeight;

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


  const handleMouseDownMove = (e: React.PointerEvent) => {
    if (field.locked) return;
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    e.stopPropagation();
    onSelect(field.id);
    setIsDragging(true);
    dragDistRef.current = 0;
    setDragStart({
      pointerId: e.pointerId,
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: field.box.x,
      boxY: field.box.y,
      boxW: field.box.width,
      boxH: field.box.height,
    });
  };

  const handleMouseDownResize = (direction: string, e: React.PointerEvent) => {
    if (field.locked) return;
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    e.stopPropagation();
    onSelect(field.id);
    setIsResizing(direction);
    setDragStart({
      pointerId: e.pointerId,
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

    const handleMouseMove = (e: PointerEvent) => {
      if (dragStartRef.current.pointerId !== undefined && e.pointerId !== dragStartRef.current.pointerId) {
        return;
      }
      const curDragStart = dragStartRef.current;
      const curPageW = pageWidthRef.current;
      const curPageH = pageHeightRef.current;
      const curScale = scaleRef.current;
      const curField = fieldRef.current;
      const curOtherFields = otherFieldsRef.current;
      const curSmartGuidesEnabled = smartGuidesEnabledRef.current;
      const curResizing = isResizingRef.current;

      const deltaX = (e.clientX - curDragStart.mouseX) / (curPageW * curScale);
      const deltaY = (e.clientY - curDragStart.mouseY) / (curPageH * curScale);
      dragDistRef.current = Math.max(
        dragDistRef.current,
        Math.hypot(e.clientX - curDragStart.mouseX, e.clientY - curDragStart.mouseY)
      );

      const canvasWidth = curPageW * curScale;
      const canvasHeight = curPageH * curScale;

      // Holding Alt / Option temporarily bypasses snapping for 100% free visual placement
      const isSnapActive = curSmartGuidesEnabled && !e.altKey;

      if (isDragging) {
        const rawX = curDragStart.boxX + deltaX;
        const rawY = curDragStart.boxY + deltaY;
        const candidateBox: BoundingBox = {
          x: rawX,
          y: rawY,
          width: curDragStart.boxW,
          height: curDragStart.boxH,
        };

        if (isSnapActive) {
          const snapResult = calculateSmartGuidesAndSnap({
            candidateBox,
            otherFields: curOtherFields,
            canvasWidth,
            canvasHeight,
            threshold: 5,
            action: 'drag',
          });

          currentBoxRef.current = snapResult.snappedBox;
          onChangeRef.current(
            {
              ...curField,
              box: snapResult.snappedBox,
            },
            false
          );
          onGuidesChangeRef.current?.(snapResult.guides);
        } else {
          const newX = Math.max(0, Math.min(1 - curDragStart.boxW, rawX));
          const newY = Math.max(0, Math.min(1 - curDragStart.boxH, rawY));
          const updatedBox = { ...curField.box, x: newX, y: newY };
          currentBoxRef.current = updatedBox;
          onChangeRef.current(
            {
              ...curField,
              box: updatedBox,
            },
            false
          );
          onGuidesChangeRef.current?.([]);
        }
      } else if (curResizing) {
        let rawX = curDragStart.boxX;
        let rawY = curDragStart.boxY;
        let rawW = curDragStart.boxW;
        let rawH = curDragStart.boxH;

        if (curResizing.includes('e')) {
          rawW = curDragStart.boxW + deltaX;
        }
        if (curResizing.includes('s')) {
          rawH = curDragStart.boxH + deltaY;
        }
        if (curResizing.includes('w')) {
          rawX = curDragStart.boxX + deltaX;
          rawW = curDragStart.boxW - deltaX;
        }
        if (curResizing.includes('n')) {
          rawY = curDragStart.boxY + deltaY;
          rawH = curDragStart.boxH - deltaY;
        }

        const candidateBox: BoundingBox = {
          x: rawX,
          y: rawY,
          width: rawW,
          height: rawH,
        };

        if (isSnapActive) {
          const snapResult = calculateSmartGuidesAndSnap({
            candidateBox,
            otherFields: curOtherFields,
            canvasWidth,
            canvasHeight,
            threshold: 5,
            action: 'resize',
            resizeHandle: curResizing,
          });

          currentBoxRef.current = snapResult.snappedBox;
          onChangeRef.current(
            {
              ...curField,
              box: snapResult.snappedBox,
            },
            false
          );
          onGuidesChangeRef.current?.(snapResult.guides);
        } else {
          let newX = curDragStart.boxX;
          let newY = curDragStart.boxY;
          let newW = curDragStart.boxW;
          let newH = curDragStart.boxH;

          if (curResizing.includes('e')) {
            newW = Math.max(0.005, Math.min(1 - newX, curDragStart.boxW + deltaX));
          }
          if (curResizing.includes('s')) {
            newH = Math.max(0.005, Math.min(1 - newY, curDragStart.boxH + deltaY));
          }
          if (curResizing.includes('w')) {
            const maxLeftMove = curDragStart.boxX + curDragStart.boxW - 0.005;
            newX = Math.max(0, Math.min(maxLeftMove, curDragStart.boxX + deltaX));
            newW = curDragStart.boxW - (newX - curDragStart.boxX);
          }
          if (curResizing.includes('n')) {
            const maxUpMove = curDragStart.boxY + curDragStart.boxH - 0.005;
            newY = Math.max(0, Math.min(maxUpMove, curDragStart.boxY + deltaY));
            newH = curDragStart.boxH - (newY - curDragStart.boxY);
          }

          const updatedBox = { x: newX, y: newY, width: newW, height: newH };
          currentBoxRef.current = updatedBox;
          onChangeRef.current(
            {
              ...curField,
              box: updatedBox,
            },
            false
          );
          onGuidesChangeRef.current?.([]);
        }
      }
    };

    const handleMouseUp = (e: PointerEvent) => {
      if (dragStartRef.current.pointerId !== undefined && e.pointerId !== dragStartRef.current.pointerId) {
        return;
      }
      const b = currentBoxRef.current;
      const cleanBox = {
        x: Math.round(b.x * 10000) / 10000,
        y: Math.round(b.y * 10000) / 10000,
        width: Math.round(b.width * 10000) / 10000,
        height: Math.round(b.height * 10000) / 10000,
      };
      // Commit final position to history once
      onChangeRef.current(
        {
          ...fieldRef.current,
          box: cleanBox,
        },
        true
      );
      setIsDragging(false);
      setIsResizing(null);
      // Clean up alignment lines immediately on mouseup/drag-end
      onGuidesChangeRef.current?.([]);
    };

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
    window.addEventListener('pointercancel', handleMouseUp);
    return () => {
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
      window.removeEventListener('pointercancel', handleMouseUp);
      onGuidesChangeRef.current?.([]);
    };
  }, [isDragging, isResizing]);

  // Checkbox Field
  if (field.type === 'checkbox') {
    return (
      <div
        ref={containerRef}
        onClick={handleCheckboxClick}
        onPointerDown={handleMouseDownMove}
        className={`absolute group select-none transition-all flex items-center justify-center ${
          isSelected
            ? 'ring-2 ring-indigo-500 ring-inset shadow-md bg-indigo-50/50 z-30'
            : 'hover:ring-1 hover:ring-indigo-400 hover:ring-inset hover:bg-indigo-50/25 z-10'
        } ${field.locked ? 'cursor-pointer' : 'cursor-move touch-none border-2 border-dashed border-indigo-400 bg-indigo-50/20'}`}
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
              onPointerDown={(e) => handleMouseDownResize('nw', e)}
              className="resize-handle absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nwse-resize z-40"
              title="Resize checkbox"
            />
            <div
              onPointerDown={(e) => handleMouseDownResize('ne', e)}
              className="resize-handle absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nesw-resize z-40"
              title="Resize checkbox"
            />
            <div
              onPointerDown={(e) => handleMouseDownResize('se', e)}
              className="resize-handle absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nwse-resize z-40"
              title="Resize checkbox"
            />
            <div
              onPointerDown={(e) => handleMouseDownResize('sw', e)}
              className="resize-handle absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nesw-resize z-40"
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
      onPointerDown={(e) => {
        if (field.locked) return;
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.closest('button') ||
          target.classList.contains('resize-handle')
        ) {
          return;
        }
        handleMouseDownMove(e);
      }}
      className={`absolute group transition-shadow ${
        isSelected
          ? 'ring-2 ring-indigo-500 ring-inset bg-white/85 shadow-sm z-30'
          : field.value
          ? 'hover:ring-1 hover:ring-indigo-300 hover:ring-inset hover:bg-white/40 z-10'
          : 'border border-indigo-200/50 bg-indigo-50/10 hover:border-indigo-400 hover:bg-indigo-50/25 z-10'
      } ${!field.locked && isSelected ? 'border border-dashed border-indigo-400' : ''} ${
        !field.locked ? 'cursor-move' : ''
      }`}
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
        <div className="absolute -top-8 left-0 flex items-center space-x-1.5 bg-gray-900 text-white text-xs px-2 py-0.5 rounded shadow-lg z-50 pointer-events-auto">
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
              onPointerDown={handleMouseDownMove}
              title="Click and drag to move this field anywhere on the PDF"
              className="flex items-center space-x-1 cursor-move select-none touch-none py-1"
            >
              <GripHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-semibold tracking-wide uppercase text-indigo-200">Move Field</span>
            </div>
          )}
          <span className="text-[10px] text-gray-400 font-mono uppercase">{field.type}</span>
          {!field.multiline && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextComb = !field.isComb;
                onChange({
                  ...field,
                  isComb: nextComb,
                  combCells: field.combCells || 11,
                  hAlign: nextComb ? 'center' : field.hAlign,
                }, true);
              }}
              title={field.isComb ? `Comb mode active (${field.combCells || 11} boxes). Click to switch to normal text.` : 'Click to enable Segmented / Comb mode (adjacent character boxes)'}
              className={`p-0.5 px-1.5 rounded text-[10px] flex items-center space-x-1 transition ${
                field.isComb
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>{field.isComb ? `${field.combCells || 11} Cells` : 'Comb'}</span>
            </button>
          )}
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
            onFocus={(e) => {
              onSelect(field.id);
              if (isMobileDevice()) {
                const el = e.currentTarget;
                setTimeout(() => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }), 300);
              }
            }}
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
      ) : field.isComb && field.combCells && field.combCells > 1 ? (
        <div
          onClick={() => {
            onSelect(field.id);
            const input = inputRef.current as HTMLInputElement | null;
            if (input) {
              input.focus();
              const targetIdx = Math.min(field.combCells! - 1, field.value.length);
              setActiveCellIndex(targetIdx);
              input.setSelectionRange(targetIdx, targetIdx + 1);
            }
          }}
          className="w-full h-full flex flex-row relative select-none cursor-text overflow-hidden"
          style={{
            fontFamily: `"${field.fontFamily}", Kalpurush, Nikosh, "Noto Sans Bengali", sans-serif`,
          }}
        >
          {Array.from({ length: field.combCells }).map((_, i) => {
            const char = field.value[i] || '';
            const isActive = isSelected && activeCellIndex === i;
            const cellW = pixelWidth / field.combCells!;
            const cellFontSize = Math.min(computedFontSize, cellW * 0.72);

            return (
              <div
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(field.id);
                  setActiveCellIndex(i);
                  const input = inputRef.current as HTMLInputElement | null;
                  if (input) {
                    input.focus();
                    input.setSelectionRange(i, i + 1);
                  }
                }}
                className={`h-full flex items-center justify-center relative transition-colors ${
                  i < field.combCells! - 1 ? 'border-r border-indigo-300/40' : ''
                } ${
                  isActive
                    ? 'bg-indigo-100/50 ring-1 ring-indigo-500 ring-inset'
                    : 'hover:bg-indigo-50/20'
                }`}
                style={{
                  width: `${100 / field.combCells!}%`,
                  fontSize: `${cellFontSize}px`,
                  fontWeight: field.bold ? 'bold' : 'normal',
                  fontStyle: field.italic ? 'italic' : 'normal',
                  color: field.color,
                }}
              >
                <span className="leading-none select-none pointer-events-none">{char}</span>
                {isActive && (
                  <span className="absolute bottom-1 w-2.5 h-[2px] bg-indigo-600 animate-pulse pointer-events-none" />
                )}
              </div>
            );
          })}

          {/* Hidden input capturing typing, arrow navigation, backspace, and paste */}
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            maxLength={field.combCells}
            value={field.value}
            onChange={(e) => {
              const val = e.target.value.slice(0, field.combCells);
              onChange({ ...field, value: val }, true);
              setActiveCellIndex(Math.min(field.combCells! - 1, val.length));
            }}
            onFocus={() => {
              onSelect(field.id);
              setActiveCellIndex(Math.min(field.combCells! - 1, field.value.length));
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                setActiveCellIndex((prev) => Math.max(0, prev - 1));
              } else if (e.key === 'ArrowRight') {
                setActiveCellIndex((prev) => Math.min(field.combCells! - 1, prev + 1));
              }
            }}
            className="absolute inset-0 opacity-0 pointer-events-none w-full h-full cursor-text"
            tabIndex={0}
            autoComplete="off"
            spellCheck={false}
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
            onFocus={(e) => {
              onSelect(field.id);
              if (isMobileDevice()) {
                const el = e.currentTarget;
                setTimeout(() => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }), 300);
              }
            }}
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
            onPointerDown={(e) => handleMouseDownResize('nw', e)}
            className="resize-handle absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nwse-resize z-40 hover:scale-125 transition-transform"
            title="Resize North-West"
          />
          {/* N */}
          <div
            onPointerDown={(e) => handleMouseDownResize('n', e)}
            className="resize-handle absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-ns-resize z-40 hover:scale-125 transition-transform"
            title="Resize Height (North)"
          />
          {/* NE */}
          <div
            onPointerDown={(e) => handleMouseDownResize('ne', e)}
            className="resize-handle absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nesw-resize z-40 hover:scale-125 transition-transform"
            title="Resize North-East"
          />
          {/* E */}
          <div
            onPointerDown={(e) => handleMouseDownResize('e', e)}
            className="resize-handle absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-ew-resize z-40 hover:scale-125 transition-transform"
            title="Resize Width (East)"
          />
          {/* SE */}
          <div
            onPointerDown={(e) => handleMouseDownResize('se', e)}
            className="resize-handle absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nwse-resize z-40 hover:scale-125 transition-transform"
            title="Resize South-East"
          />
          {/* S */}
          <div
            onPointerDown={(e) => handleMouseDownResize('s', e)}
            className="resize-handle absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-ns-resize z-40 hover:scale-125 transition-transform"
            title="Resize Height (South)"
          />
          {/* SW */}
          <div
            onPointerDown={(e) => handleMouseDownResize('sw', e)}
            className="resize-handle absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-nesw-resize z-40 hover:scale-125 transition-transform"
            title="Resize South-West"
          />
          {/* W */}
          <div
            onPointerDown={(e) => handleMouseDownResize('w', e)}
            className="resize-handle absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-xs shadow-md cursor-ew-resize z-40 hover:scale-125 transition-transform"
            title="Resize Width (West)"
          />
        </>
      )}
    </div>
  );
};
