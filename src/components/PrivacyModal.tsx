import React from 'react';
import { ShieldCheck, Lock, Cpu, EyeOff, HardDrive, X } from 'lucide-react';
import { GithubIcon } from './GithubIcon';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Privacy-First Architecture</h2>
              <p className="text-xs text-emerald-100">Zero Server Uploads • 100% On-Device</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-gray-600 leading-relaxed">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <EyeOff className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 text-sm">No Document Transmission</h4>
              <p className="mt-0.5">
                Your PDF documents, form fields, extracted text, and filled data never leave your computer. Fillora operates entirely in your browser sandbox.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 text-sm">Local AI Inference (WebGPU & WASM)</h4>
              <p className="mt-0.5">
                FFDNet-S and FFDNet-L object detection models run directly on your device using ONNX Runtime Web. Inference is computed locally via your GPU or WebAssembly.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 text-sm">Offline-Ready & Cached Locally</h4>
              <p className="mt-0.5">
                Model weights, fonts, and assets are cached directly in your browser's Cache Storage. Once cached, Fillora functions with complete independence from the network.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 text-sm">Complex Script Typography</h4>
              <p className="mt-0.5">
                Bangla vowel signs (কার), consonant clusters (যুক্তাক্ষর), and OpenType GSUB/GPOS shaping are executed natively in your browser and flattened directly into the final PDF.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span>By</span>
            <a
              href="https://github.com/rmahbub01"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-900 hover:text-indigo-600 underline"
            >
              Mahbub Rahman
            </a>
            <span>•</span>
            <a
              href="https://github.com/rmahbub01/fillora"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-gray-600 hover:text-indigo-600 font-medium hover:underline"
            >
              <GithubIcon className="w-3.5 h-3.5 text-gray-700" />
              <span>GitHub</span>
            </a>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
};
