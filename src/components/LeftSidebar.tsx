import React, { useState, useEffect } from 'react';
import { FormField, PageInfo } from '../types/pdf';
import { pdfRenderer } from '../services/pdfRenderer';
import { Layers, FileText, CheckSquare, Lock, Unlock, Trash2, Eye, ChevronLeft, ChevronRight, Hash } from 'lucide-react';

interface LeftSidebarProps {
  pageInfos: PageInfo[];
  activePageIndex: number;
  onPageSelect: (pageIndex: number) => void;
  fields: FormField[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDeleteField: (id: string) => void;
  onClearPageFields: (pageIndex: number) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  pageInfos,
  activePageIndex,
  onPageSelect,
  fields,
  selectedFieldId,
  onSelectField,
  onToggleLock,
  onDeleteField,
  onClearPageFields,
}) => {
  const [activeTab, setActiveTab] = useState<'pages' | 'fields'>('pages');
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Lazy generate thumbnails for visible pages
  useEffect(() => {
    let isCancelled = false;

    const loadThumbs = async () => {
      for (const info of pageInfos) {
        if (!thumbnails[info.pageIndex]) {
          try {
            const dataUrl = await pdfRenderer.renderThumbnail(info.pageIndex, 140);
            if (!isCancelled) {
              setThumbnails((prev) => ({ ...prev, [info.pageIndex]: dataUrl }));
            }
          } catch (e) {
            console.warn('Thumbnail generation failed for page', info.pageIndex, e);
          }
        }
      }
    };

    if (pageInfos.length > 0) {
      loadThumbs();
    }

    return () => {
      isCancelled = true;
    };
  }, [pageInfos]);

  const currentPageFields = fields.filter((f) => f.pageIndex === activePageIndex);

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4 space-y-4 z-20">
        <button
          onClick={() => setIsCollapsed(false)}
          title="Expand Sidebar"
          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setIsCollapsed(false);
            setActiveTab('pages');
          }}
          className={`p-2 rounded-lg transition ${activeTab === 'pages' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Pages"
        >
          <Layers className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setIsCollapsed(false);
            setActiveTab('fields');
          }}
          className={`p-2 rounded-lg transition relative ${activeTab === 'fields' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Detected Fields"
        >
          <FileText className="w-5 h-5" />
          {fields.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full z-20 select-none shadow-sm">
      {/* Sidebar Header & Tabs */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex bg-gray-100 p-1 rounded-lg space-x-1 flex-1 mr-2">
          <button
            onClick={() => setActiveTab('pages')}
            className={`flex-1 py-1 px-2.5 text-xs font-medium rounded-md transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'pages'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pages ({pageInfos.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`flex-1 py-1 px-2.5 text-xs font-medium rounded-md transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'fields'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Fields ({fields.length})</span>
          </button>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          title="Collapse Sidebar"
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Pages Tab Content */}
      {activeTab === 'pages' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {pageInfos.map((info) => {
            const pageFieldCount = fields.filter((f) => f.pageIndex === info.pageIndex).length;
            const isCurrent = info.pageIndex === activePageIndex;

            return (
              <div
                key={info.pageIndex}
                onClick={() => onPageSelect(info.pageIndex)}
                className={`group cursor-pointer rounded-xl border p-2 transition-all ${
                  isCurrent
                    ? 'border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/20 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-xs bg-white'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span className={`font-semibold ${isCurrent ? 'text-indigo-600' : 'text-gray-700'}`}>
                    Page {info.pageNumber}
                  </span>
                  {pageFieldCount > 0 && (
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                      {pageFieldCount} fields
                    </span>
                  )}
                </div>

                {/* Thumbnail Preview */}
                <div className="relative bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center aspect-[1/1.4] border border-gray-100">
                  {thumbnails[info.pageIndex] ? (
                    <img
                      src={thumbnails[info.pageIndex]}
                      alt={`Page ${info.pageNumber}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-1" />
                      <span className="text-[10px]">Loading</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fields Tab Content */}
      {activeTab === 'fields' && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Page {activePageIndex + 1} Fields ({currentPageFields.length})
            </span>
            {currentPageFields.length > 0 && (
              <button
                onClick={() => onClearPageFields(activePageIndex)}
                className="text-[11px] text-red-500 hover:text-red-700 hover:underline flex items-center space-x-1"
                title="Remove all fields on this page"
              >
                <span>Clear page</span>
              </button>
            )}
          </div>

          {currentPageFields.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <FileText className="w-8 h-8 mb-2 stroke-1 text-gray-300" />
              <p className="text-xs font-medium text-gray-500">No fields detected on this page</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Click "Detect Fields" above or right-click anywhere on the PDF to add a field manually.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {currentPageFields.map((field, idx) => {
                const isSelected = selectedFieldId === field.id;
                const isFilled = field.type === 'checkbox' ? field.checkboxState !== 'empty' : field.value.trim().length > 0;

                return (
                  <div
                    key={field.id}
                    onClick={() => onSelectField(field.id)}
                    className={`group p-2 rounded-lg border text-xs transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-400'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      {field.type === 'checkbox' ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-medium text-gray-800 truncate">
                            {field.label || `Field ${idx + 1}`}
                          </span>
                          <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-gray-100 text-gray-500">
                            {field.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          {field.type === 'checkbox'
                            ? `State: ${field.checkboxState}`
                            : (field.value ? `"${field.value}"` : 'Empty')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLock(field.id);
                        }}
                        title={field.locked ? 'Locked' : 'Unlocked'}
                        className={`p-1 rounded hover:bg-gray-200 transition ${field.locked ? 'text-gray-400' : 'text-amber-500'}`}
                      >
                        {field.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteField(field.id);
                        }}
                        title="Delete Field"
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
