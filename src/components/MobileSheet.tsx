import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface MobileSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** 'tall' = up to 85% of screen, 'auto' = fit content */
  size?: 'tall' | 'auto';
  children: React.ReactNode;
}

/** Bottom sheet used on phones instead of the desktop sidebars. */
export const MobileSheet: React.FC<MobileSheetProps> = ({ open, title, onClose, size = 'tall', children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative bg-white rounded-t-2xl shadow-2xl flex flex-col animate-sheetUp safe-bottom ${
          size === 'tall' ? 'h-[80dvh]' : 'max-h-[85dvh]'
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100 shrink-0">
          <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-gray-300" />
          <h3 className="text-sm font-bold text-gray-900 mt-1.5">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-2 -mr-2 text-gray-500 rounded-lg active:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
