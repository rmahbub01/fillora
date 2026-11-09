import React, { useRef, useState } from 'react';
import { ModelType, DetectionScope } from '../types/pdf';
import {
  Upload,
  Sparkles,
  Download,
  Undo2,
  Redo2,
  Type,
  CheckSquare,
  ShieldCheck,
  ChevronDown,
  BookOpen,
  Cpu,
  Zap,
} from 'lucide-react';

interface TopNavbarProps {
  onOpenFile: (file: File) => void;
  onOpenSample: (sampleName: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDetect: () => void;
  isDetecting: boolean;
  selectedModel: ModelType;
  onSelectModel: (model: ModelType) => void;
  detectionScope: DetectionScope;
  onSelectScope: (scope: DetectionScope) => void;
  onAddManualField: (type: 'text' | 'checkbox') => void;
  onExportPdf: () => void;
  isExporting: boolean;
  onOpenPrivacyModal: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  onOpenFile,
  onOpenSample,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDetect,
  isDetecting,
  selectedModel,
  onSelectModel,
  detectionScope,
  onSelectScope,
  onAddManualField,
  onExportPdf,
  isExporting,
  onOpenPrivacyModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSamplesMenu, setShowSamplesMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenFile(file);
    }
  };

  const getModelLabel = (model: ModelType) => {
    switch (model) {
      case 'ffdnet-s':
        return 'FFDNet-S (Small)';
      case 'ffdnet-l':
        return 'FFDNet-L (Large)';
      case 'heuristic':
        return 'Instant Visual';
      case 'hybrid':
        return 'Hybrid (AI + Visual)';
    }
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between z-30 select-none shadow-xs">
      {/* Brand & Open File */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
            F
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">Fillora</span>
            <span className="hidden sm:inline-block ml-1.5 px-1.5 py-0.2 text-[10px] bg-indigo-50 text-indigo-700 font-semibold rounded border border-indigo-200/60">
              AI Form Filler
            </span>
          </div>
        </div>

        <div className="w-[1px] h-5 bg-gray-200 mx-1" />

        {/* Open PDF */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-100 rounded-lg flex items-center space-x-1.5 transition"
        >
          <Upload className="w-4 h-4 text-gray-500" />
          <span>Open PDF</span>
        </button>

        {/* Sample Forms Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSamplesMenu(!showSamplesMenu)}
            className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg flex items-center space-x-1 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden md:inline">Samples</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {showSamplesMenu && (
            <div
              className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 text-xs"
              onClick={() => setShowSamplesMenu(false)}
            >
              <div className="px-3 py-1 font-semibold text-[10px] text-gray-400 uppercase tracking-wider">
                Try Sample Documents
              </div>
              <button
                onClick={() => onOpenSample('/sample-forms/bangla_citizen_application.pdf')}
                className="w-full text-left px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700 transition flex flex-col"
              >
                <span className="font-semibold text-gray-800">নাগরিক আবেদন ফরম (Bangla Citizen Form)</span>
                <span className="text-[10px] text-gray-500">Government form with complex Bangla script & checkboxes</span>
              </button>
              <button
                onClick={() => onOpenSample('/sample-forms/english_job_application.pdf')}
                className="w-full text-left px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700 transition flex flex-col"
              >
                <span className="font-semibold text-gray-800">English Job Application</span>
                <span className="text-[10px] text-gray-500">Clean job application with checkboxes and text fields</span>
              </button>
              <button
                onClick={() => onOpenSample('/sample-forms/interactive_acroform.pdf')}
                className="w-full text-left px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700 transition flex flex-col"
              >
                <span className="font-semibold text-gray-800">Interactive AcroForm Test</span>
                <span className="text-[10px] text-gray-500">PDF with pre-existing interactive AcroForm widgets</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Undo/Redo & Detect AI Controls */}
      <div className="flex items-center space-x-2">
        {/* Undo / Redo */}
        <div className="flex items-center space-x-1 bg-gray-100 p-0.5 rounded-lg">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-600 transition"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-600 transition"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="w-[1px] h-5 bg-gray-200" />

        {/* Model Selector & Scope Selector */}
        <div className="relative">
          <button
            onClick={() => setShowModelMenu(!showModelMenu)}
            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200/80 rounded-lg text-xs font-medium text-gray-700 flex items-center space-x-1.5 transition"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            <span>{getModelLabel(selectedModel)}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {showModelMenu && (
            <div
              className="absolute left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50 text-xs"
              onClick={() => setShowModelMenu(false)}
            >
              <div className="px-2 py-1 font-semibold text-[10px] text-gray-400 uppercase tracking-wider">
                Select Detection Engine
              </div>
              <button
                onClick={() => onSelectModel('ffdnet-s')}
                className={`w-full text-left p-2 rounded-lg transition mb-1 flex items-start space-x-2 ${
                  selectedModel === 'ffdnet-s' ? 'bg-indigo-50 border border-indigo-200 text-indigo-900' : 'hover:bg-gray-50'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-900 flex items-center space-x-1">
                    <span>FFDNet-S (Small)</span>
                    <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">Fast (~36MB)</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                    Lighter neural model. High speed, minimal RAM. Great for everyday forms.
                  </p>
                </div>
              </button>

              <button
                onClick={() => onSelectModel('ffdnet-l')}
                className={`w-full text-left p-2 rounded-lg transition mb-1 flex items-start space-x-2 ${
                  selectedModel === 'ffdnet-l' ? 'bg-indigo-50 border border-indigo-200 text-indigo-900' : 'hover:bg-gray-50'
                }`}
              >
                <Cpu className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-900 flex items-center space-x-1">
                    <span>FFDNet-L (Large)</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">High Accuracy (~97MB)</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                    Deep 25M-param detector. Maximum precision for complex layouts & scanned pages.
                  </p>
                </div>
              </button>

              <button
                onClick={() => onSelectModel('hybrid')}
                className={`w-full text-left p-2 rounded-lg transition flex items-start space-x-2 ${
                  selectedModel === 'hybrid' ? 'bg-indigo-50 border border-indigo-200 text-indigo-900' : 'hover:bg-gray-50'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-900">Hybrid (AI + Visual)</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                    Combines neural detection with contour underlines & native AcroForms.
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Scope Selector: Current vs All */}
        <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-medium text-gray-600">
          <button
            onClick={() => onSelectScope('current')}
            className={`px-2 py-1 rounded-md transition ${
              detectionScope === 'current' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-gray-900'
            }`}
          >
            Current
          </button>
          <button
            onClick={() => onSelectScope('all')}
            className={`px-2 py-1 rounded-md transition ${
              detectionScope === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-gray-900'
            }`}
          >
            All Pages
          </button>
        </div>

        {/* Primary Detect Button */}
        <button
          onClick={onDetect}
          disabled={isDetecting}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition active:scale-98"
        >
          {isDetecting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Detecting...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Detect Fields</span>
            </>
          )}
        </button>

        <div className="w-[1px] h-5 bg-gray-200 hidden md:block" />

        {/* Manual Add shortcuts */}
        <div className="hidden lg:flex items-center space-x-1">
          <button
            onClick={() => onAddManualField('text')}
            title="Add text field manually"
            className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
          >
            <Type className="w-4 h-4" />
          </button>
          <button
            onClick={() => onAddManualField('checkbox')}
            title="Add checkbox manually"
            className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
          >
            <CheckSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Privacy Badge & Export Flattened PDF */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenPrivacyModal}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 flex items-center space-x-1.5 transition"
          title="Privacy-First Guarantee: Click to learn more"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">100% Client-Side</span>
        </button>

        <button
          onClick={onExportPdf}
          disabled={isExporting}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition active:scale-98"
        >
          {isExporting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Flattening...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
