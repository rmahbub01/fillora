import React, { useRef, useEffect, useState } from 'react';
import { FormField, CheckboxState } from '../types/pdf';
import { Lock, Unlock, Trash2, Check, X, Circle, Type, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface FieldOverlayProps {
  field: FormField;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChange: (updated: FormField) => void;
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

  // Calculate actual pixel dimensions inside the page viewport
  const pixelLeft = field.box.x * pageWidth * scale;
  const pixelTop = field.box.y * pageHeight * scale;
  const pixelWidth = field.box.width * pageWidth * scale;
  const pixelHeight = field.box.height * pageHeight * scale;

  // Auto-fit font size calculation
  const computedFontSize = React.useMemo(() => {
    if (!field.autoFontSize) {
      return field.fontSize * scale;
    }
    // Calculate size based on box height and text length
    const baseHeight = pixelHeight * 0.72;
    if (field.multiline) {
      return Math.max(9 * scale, Math.min(18 * scale, baseHeight * 0.45));
    }
    // For single line, fit within box height and width
    let size = Math.max(9 * scale, Math.min(22 * scale, baseHeight));
    if (field.value.length > 10) {
      const charWidthEst = size * 0.6;
      const totalWidth = field.value.length * charWidthEst;
      if (totalWidth > pixelWidth * 0.9) {
        size = Math.max(8 * scale, (pixelWidth * 0.9) / (field.value.length * 0.6));
      }
    }
    return size;
  }, [field.autoFontSize, field.fontSize, field.value, field.multiline, pixelHeight, pixelWidth, scale]);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(field.id);
    
    // Cycle states: empty -> check -> cross -> dot -> empty
    const nextStates: Record<CheckboxState, CheckboxState> = {
      empty: 'check',
      check: 'cross',
      cross: 'dot',
      dot: 'empty',
    };
    onChange({
      ...field,
      checkboxState: nextStates[field.checkboxState],
    });
  };

  const handleMouseDownMove = (e: React.MouseEvent) => {
    if (field.locked) return;
    e.stopPropagation();
    onSelect(field.id);
    setIsDragging(true);
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

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - dragStart.mouseX) / (pageWidth * scale);
      const deltaY = (e.clientY - dragStart.mouseY) / (pageHeight * scale);

      if (isDragging) {
        const newX = Math.max(0, Math.min(1 - dragStart.boxW, dragStart.boxX + deltaX));
        const newY = Math.max(0, Math.min(1 - dragStart.boxH, dragStart.boxY + deltaY));
        onChange({
          ...field,
          box: {
            ...field.box,
            x: newX,
            y: newY,
          },
        });
      } else if (isResizing) {
        let newX = dragStart.boxX;
        let newY = dragStart.boxY;
        let newW = dragStart.boxW;
        let newH = dragStart.boxH;

        if (isResizing.includes('e')) {
          newW = Math.max(0.01, Math.min(1 - newX, dragStart.boxW + deltaX));
        }
        if (isResizing.includes('s')) {
          newH = Math.max(0.01, Math.min(1 - newY, dragStart.boxH + deltaY));
        }
        if (isResizing.includes('w')) {
          const maxLeftMove = dragStart.boxX + dragStart.boxW - 0.01;
          newX = Math.max(0, Math.min(maxLeftMove, dragStart.boxX + deltaX));
          newW = dragStart.boxW - (newX - dragStart.boxX);
        }
        if (isResizing.includes('n')) {
          const maxUpMove = dragStart.boxY + dragStart.boxH - 0.01;
          newY = Math.max(0, Math.min(maxUpMove, dragStart.boxY + deltaY));
          newH = dragStart.boxH - (newY - dragStart.boxY);
        }

        onChange({
          ...field,
          box: { x: newX, y: newY, width: newW, height: newH },
        });
      }
    };

    const handleMouseUp = () => {
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
        className={`absolute group select-none transition-all flex items-center justify-center cursor-pointer ${
          isSelected
            ? 'ring-2 ring-indigo-500 shadow-md bg-indigo-50/40 z-30'
            : 'hover:ring-1 hover:ring-indigo-400/80 hover:bg-indigo-50/20 z-10'
        } ${field.locked ? 'cursor-pointer' : 'cursor-move'}`}
        style={{
          left: `${pixelLeft}px`,
          top: `${pixelTop}px`,
          width: `${pixelWidth}px`,
          height: `${pixelHeight}px`,
        }}
        title={`Checkbox: Click to toggle (${field.checkboxState}). ${field.locked ? 'Locked' : 'Unlocked (drag to move)'}`}
      >
        {/* Checkbox Symbol */}
        {field.checkboxState === 'check' && (
          <Check className="text-gray-900 stroke-[3]" style={{ width: '85%', height: '85%', color: field.color }} />
        )}
        {field.checkboxState === 'cross' && (
          <X className="text-gray-900 stroke-[3]" style={{ width: '85%', height: '85%', color: field.color }} />
        )}
        {field.checkboxState === 'dot' && (
          <div className="rounded-full bg-gray-900" style={{ width: '55%', height: '55%', backgroundColor: field.color }} />
        )}

        {/* Small lock/unlock icon indicator on hover */}
        {!field.locked && (
          <div className="absolute -top-3 -right-3 bg-amber-500 text-white p-0.5 rounded shadow text-[10px]">
            <Unlock className="w-2.5 h-2.5" />
          </div>
        )}

        {/* Resize handle when unlocked & selected */}
        {isSelected && !field.locked && (
          <div
            onMouseDown={(e) => handleMouseDownResize('se', e)}
            className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-indigo-600 rounded-sm cursor-se-resize z-40"
          />
        )}
      </div>
    );
  }

  // Text / Multiline / Signature Field
  return (
    <div
      ref={containerRef}
      onClick={() => onSelect(field.id)}
      className={`absolute group transition-shadow ${
        isSelected
          ? 'ring-2 ring-indigo-500 bg-white/70 shadow-sm z-30'
          : 'hover:ring-1 hover:ring-indigo-300 hover:bg-indigo-50/15 z-10'
      } ${!field.locked ? 'border border-dashed border-indigo-400' : ''}`}
      style={{
        left: `${pixelLeft}px`,
        top: `${pixelTop}px`,
        width: `${pixelWidth}px`,
        height: `${pixelHeight}px`,
      }}
    >
      {/* Floating control bar when selected */}
      {isSelected && (
        <div className="absolute -top-7 left-0 flex items-center space-x-1 bg-gray-900 text-white text-xs px-2 py-0.5 rounded shadow-lg z-50 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ ...field, locked: !field.locked });
            }}
            title={field.locked ? 'Click to Unlock (allow resize/reposition)' : 'Click to Lock (prevent accidental edits)'}
            className={`p-0.5 rounded transition ${field.locked ? 'text-gray-300 hover:text-white' : 'text-amber-400 hover:text-amber-300'}`}
          >
            {field.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <span className="text-[10px] text-gray-400 font-mono uppercase">{field.type}</span>
          <div className="w-[1px] h-3 bg-gray-700" />
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
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={field.value}
          onChange={(e) => onChange({ ...field, value: e.target.value })}
          onFocus={() => onSelect(field.id)}
          placeholder={isSelected ? 'Type here...' : ''}
          style={{
            fontFamily: `"${field.fontFamily}", "Noto Sans Bengali", Kalpurush, sans-serif`,
            fontSize: `${computedFontSize}px`,
            color: field.color,
            textAlign: field.hAlign,
          }}
          className="w-full h-full p-1 bg-transparent resize-none outline-none border-none leading-relaxed text-gray-900 overflow-hidden font-normal"
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={field.value}
          onChange={(e) => onChange({ ...field, value: e.target.value })}
          onFocus={() => onSelect(field.id)}
          placeholder={isSelected ? 'Type here...' : ''}
          style={{
            fontFamily: `"${field.fontFamily}", "Noto Sans Bengali", Kalpurush, sans-serif`,
            fontSize: `${computedFontSize}px`,
            color: field.color,
            textAlign: field.hAlign,
          }}
          className="w-full h-full px-1 bg-transparent outline-none border-none text-gray-900 font-normal"
        />
      )}

      {/* Resize handles when unlocked and selected */}
      {isSelected && !field.locked && (
        <>
          {/* Move handle at top center */}
          <div
            onMouseDown={handleMouseDownMove}
            title="Drag to reposition"
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-2 bg-indigo-600 rounded-full cursor-move z-40"
          />
          {/* 8 Resize points */}
          <div onMouseDown={(e) => handleMouseDownResize('nw', e)} className="absolute -top-1 -left-1 w-2 h-2 bg-indigo-600 rounded-sm cursor-nw-resize z-40" />
          <div onMouseDown={(e) => handleMouseDownResize('n', e)} className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-600 rounded-sm cursor-n-resize z-40" />
          <div onMouseDown={(e) => handleMouseDownResize('ne', e)} className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-600 rounded-sm cursor-ne-resize z-40" />
          <div onMouseDown={(e) => handleMouseDownResize('e', e)} className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-indigo-600 rounded-sm cursor-e-resize z-40" />
          <div onMouseDown={(e) => handleMouseDownResize('se', e)} className="absolute -bottom-1 -right-1 w-2 h-2 bg-indigo-600 rounded-sm cursor-se-resize z-40" />
          <div onMouseDown={(e) => handleMouseDownResize('s', e)} className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-600 rounded-sm cursor-s-resize z-40" />
          <div onMouseDown={(e) => handleMouseDownResize('sw', e)} className="absolute -bottom-1 -left-1 w-2 h-2 bg-indigo-600 rounded-sm cursor-sw-resize z-40" />
          <div onMouseDown={(e) => handleMouseDownResize('w', e)} className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-indigo-600 rounded-sm cursor-w-resize z-40" />
        </>
      )}
    </div>
  );
};
