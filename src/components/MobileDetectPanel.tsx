import React, { useEffect } from 'react';
import { Zap, Cpu, Sparkles, Wifi } from 'lucide-react';
import { ModelType, DetectionScope } from '../types/pdf';
import { isLowMemoryDevice } from '../utils/device';

interface Props {
  selectedModel: ModelType;
  onSelectModel: (m: ModelType) => void;
  scope: DetectionScope;
  onSelectScope: (s: DetectionScope) => void;
  pageCount: number;
  onRun: () => void;
}

export const MobileDetectPanel: React.FC<Props> = ({ selectedModel, onSelectModel, scope, onSelectScope, pageCount, onRun }) => {
  const lowMem = isLowMemoryDevice();

  useEffect(() => {
    if (selectedModel === 'heuristic' || (lowMem && selectedModel === 'ffdnet-l')) {
      onSelectModel('ffdnet-s');
    }
  }, [selectedModel, lowMem, onSelectModel]);

  const options: { id: ModelType; icon: React.ReactNode; name: string; badge: string; desc: string; hidden?: boolean }[] = [
    { id: 'ffdnet-s', icon: <Zap className="w-5 h-5 text-amber-500" />, name: 'FFDNet-S (AI)', badge: '~36 MB, cached after 1st use',
      desc: 'Neural detector tuned for phones. Recommended for most forms.' },
    { id: 'ffdnet-l', icon: <Cpu className="w-5 h-5 text-indigo-600" />, name: 'FFDNet-L (AI)', badge: '~97 MB',
      desc: lowMem ? 'Hidden on low-memory devices to avoid crashes.' : 'Most accurate, but slow and memory-hungry on phones.', hidden: lowMem },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        {options.filter((o) => !o.hidden).map((o) => (
          <button key={o.id} onClick={() => onSelectModel(o.id)}
            className={`w-full text-left p-3 rounded-xl border flex items-start space-x-3 transition ${
              selectedModel === o.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300' : 'border-gray-200 active:bg-gray-50'}`}>
            <span className="mt-0.5 shrink-0">{o.icon}</span>
            <span className="min-w-0">
              <span className="flex items-center flex-wrap gap-x-2 text-sm font-semibold text-gray-900">{o.name}
                <span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{o.badge}</span></span>
              <span className="block text-xs text-gray-500 mt-0.5 leading-snug">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-gray-500 flex items-start space-x-1.5">
        <Wifi className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>The AI model downloads once, then works offline. Use Wi‑Fi for the first run.</span>
      </p>

      {pageCount > 1 && (
        <div className="flex bg-gray-100 p-1 rounded-xl text-sm font-medium">
          {(['current', 'all'] as const).map((s) => (
            <button key={s} onClick={() => onSelectScope(s)}
              className={`flex-1 py-2 rounded-lg transition ${scope === s ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600'}`}>
              {s === 'current' ? 'This page' : `All ${pageCount} pages`}
            </button>
          ))}
        </div>
      )}

      <button onClick={onRun}
        className="w-full py-3.5 bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-2 shadow-md">
        <Sparkles className="w-4 h-4" /><span>Detect fields</span>
      </button>
    </div>
  );
};
