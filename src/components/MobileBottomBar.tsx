import React, { useState } from 'react';
import { Layers, Sparkles, Plus, Sliders, Type, CheckSquare, AlignLeft } from 'lucide-react';

interface MobileBottomBarProps {
  disabled: boolean;
  isDetecting: boolean;
  hasSelection: boolean;
  fieldCount: number;
  onOpenPages: () => void;
  onOpenDetect: () => void;
  onOpenStyle: () => void;
  onAddField: (type: 'text' | 'textarea' | 'checkbox') => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  disabled, isDetecting, hasSelection, fieldCount, onOpenPages, onOpenDetect, onOpenStyle, onAddField,
}) => {
  const [addOpen, setAddOpen] = useState(false);
  const item = 'flex-1 flex flex-col items-center justify-center py-1.5 text-[11px] font-medium rounded-xl active:bg-gray-100 disabled:opacity-40';

  return (
    <nav className="bg-white border-t border-gray-200 safe-bottom z-30 shrink-0 relative select-none">
      {addOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAddOpen(false)} />
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-40 bg-white rounded-2xl shadow-xl border border-gray-200 p-1.5 flex space-x-1">
            {([
              ['text', Type, 'Text'],
              ['textarea', AlignLeft, 'Multiline'],
              ['checkbox', CheckSquare, 'Checkbox'],
            ] as const).map(([t, Icon, label]) => (
              <button key={t} onClick={() => { onAddField(t); setAddOpen(false); }}
                className="w-20 py-2.5 flex flex-col items-center text-[11px] font-medium text-gray-700 rounded-xl active:bg-indigo-50">
                <Icon className="w-5 h-5 mb-0.5 text-indigo-600" />{label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex items-stretch px-2 pt-1 h-14">
        <button className={item} disabled={disabled} onClick={onOpenPages}>
          <span className="relative"><Layers className="w-5 h-5 text-gray-600" />
            {fieldCount > 0 && <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] leading-4 text-center">{fieldCount}</span>}
          </span>
          <span className="text-gray-600">Pages</span>
        </button>

        <button className={`${item} text-indigo-700`} disabled={disabled || isDetecting} onClick={onOpenDetect}>
          <span className="w-10 h-8 -mt-3 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
            {isDetecting
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Sparkles className="w-5 h-5" />}
          </span>
          <span>Detect</span>
        </button>

        <button className={item} disabled={disabled} onClick={() => setAddOpen((v) => !v)}>
          <Plus className="w-5 h-5 text-gray-600" /><span className="text-gray-600">Add</span>
        </button>

        <button className={item} disabled={disabled || !hasSelection} onClick={onOpenStyle}>
          <Sliders className={`w-5 h-5 ${hasSelection ? 'text-indigo-600' : 'text-gray-400'}`} />
          <span className={hasSelection ? 'text-indigo-700' : 'text-gray-500'}>Style</span>
        </button>
      </div>
    </nav>
  );
};
