import React from 'react';
import { Sparkles, Cpu, Zap, X } from 'lucide-react';
import { DetectionProgress } from '../types/pdf';

interface DetectionModalProps {
  progress: DetectionProgress | null;
  onCancel: () => void;
}

export const DetectionModal: React.FC<DetectionModalProps> = ({ progress, onCancel }) => {
  if (!progress || progress.status === 'idle') return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                AI Form Detection
              </h3>
              <span className="text-[10px] font-mono uppercase bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">
                {progress.model.toUpperCase()}
              </span>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress status message */}
        <p className="text-xs text-gray-600 mb-3 min-h-[36px] flex items-center">
          {progress.message || 'Detecting form fields...'}
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden mb-2">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
          <span>{progress.progressPercent}% Completed</span>
          {progress.totalPages > 1 && (
            <span>Page {progress.currentPage} of {progress.totalPages}</span>
          )}
        </div>

        {progress.error && (
          <div className="mt-3 p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {progress.error}
          </div>
        )}
      </div>
    </div>
  );
};
