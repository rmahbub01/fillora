import React, { useRef } from 'react';
import { Upload, Undo2, Redo2, Download, ShieldCheck } from 'lucide-react';

interface MobileTopBarProps {
  hasDocument: boolean;
  onOpenFile: (file: File) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportPdf: () => void;
  isExporting: boolean;
  onOpenPrivacyModal: () => void;
}

export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  hasDocument, onOpenFile, canUndo, canRedo, onUndo, onRedo, onExportPdf, isExporting, onOpenPrivacyModal,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const btn = 'p-2.5 rounded-xl text-gray-700 active:bg-gray-100 disabled:opacity-30';

  return (
    <header className="bg-white border-b border-gray-200 px-2 safe-top z-30 select-none shrink-0">
      <div className="h-12 flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-8 h-8 ml-1 mr-1.5 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-base">F</div>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onOpenFile(f); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} className={btn} aria-label="Open PDF"><Upload className="w-5 h-5" /></button>
        </div>

        <div className="flex items-center">
          <button onClick={onUndo} disabled={!canUndo} className={btn} aria-label="Undo"><Undo2 className="w-5 h-5" /></button>
          <button onClick={onRedo} disabled={!canRedo} className={btn} aria-label="Redo"><Redo2 className="w-5 h-5" /></button>
          <button onClick={onOpenPrivacyModal} className={`${btn} text-emerald-600`} aria-label="Privacy"><ShieldCheck className="w-5 h-5" /></button>
          <button
            onClick={onExportPdf}
            disabled={!hasDocument || isExporting}
            className="ml-1 px-3.5 h-9 bg-emerald-600 active:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5"
          >
            {isExporting
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Download className="w-4 h-4" />}
            <span>{isExporting ? 'Saving' : 'Export'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
