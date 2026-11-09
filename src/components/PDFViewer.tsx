import React, { useRef, useEffect, useState } from 'react';
import { FormField, PageInfo } from '../types/pdf';
import { pdfRenderer } from '../services/pdfRenderer';
import { FieldOverlay } from './FieldOverlay';
import { Plus, CheckSquare, Type, ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface PDFViewerProps {
  pageIndex: number;
  pageInfo: PageInfo | undefined;
  fields: FormField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onUpdateField: (field: FormField) => void;
  onDeleteField: (id: string) => void;
  onAddField: (type: FormField['type'], x: number, y: number) => void;
  zoomScale: number;
  onZoomChange: (newScale: number) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  pageIndex,
  pageInfo,
  fields,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  onDeleteField,
  onAddField,
  zoomScale,
  onZoomChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageX: number; pageY: number } | null>(null);

  // Filter fields belonging to current active page
  const pageFields = fields.filter((f) => f.pageIndex === pageIndex);

  // Render PDF page when pageIndex or zoomScale changes
  useEffect(() => {
    let isCancelled = false;

    const render = async () => {
      if (!canvasRef.current || !pageInfo) return;
      setIsRendering(true);
      try {
        await pdfRenderer.renderPageToCanvas(pageIndex, canvasRef.current, zoomScale);
      } catch (err) {
        console.error('Render error:', err);
      } finally {
        if (!isCancelled) setIsRendering(false);
      }
    };

    render();
    return () => {
      isCancelled = true;
    };
  }, [pageIndex, zoomScale, pageInfo]);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'CANVAS') {
      onSelectField(null);
      setContextMenu(null);
    }
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!canvasRef.current || !pageInfo) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      pageX: Math.max(0, Math.min(0.9, clickX)),
      pageY: Math.max(0, Math.min(0.95, clickY)),
    });
  };

  if (!pageInfo) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 text-gray-400">
        No document loaded
      </div>
    );
  }

  const pageWidth = pageInfo.width;
  const pageHeight = pageInfo.height;

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      onContextMenu={handleCanvasContextMenu}
      className="flex-1 relative overflow-auto bg-gray-100/90 flex justify-center p-8 select-none"
    >
      {/* PDF Page Wrapper */}
      <div
        className="relative bg-white shadow-xl transition-all duration-100"
        style={{
          width: `${pageWidth * zoomScale}px`,
          height: `${pageHeight * zoomScale}px`,
        }}
      >
        {/* PDF Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-auto"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Loading overlay indicator while rendering */}
        {isRendering && (
          <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-20">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Form Field Overlays */}
        <div className="absolute inset-0 pointer-events-none">
          {pageFields.map((field) => (
            <div key={field.id} className="pointer-events-auto">
              <FieldOverlay
                field={field}
                isSelected={selectedFieldId === field.id}
                onSelect={(id) => onSelectField(id)}
                onChange={onUpdateField}
                onDelete={onDeleteField}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
                scale={zoomScale}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-50 min-w-[170px] text-xs text-gray-700"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
            Add Here
          </div>
          <button
            onClick={() => {
              onAddField('text', contextMenu.pageX, contextMenu.pageY);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 flex items-center space-x-2 transition"
          >
            <Type className="w-3.5 h-3.5 text-indigo-500" />
            <span>Add Text Box</span>
          </button>
          <button
            onClick={() => {
              onAddField('textarea', contextMenu.pageX, contextMenu.pageY);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 flex items-center space-x-2 transition"
          >
            <Type className="w-3.5 h-3.5 text-indigo-500" />
            <span>Add Multiline Area</span>
          </button>
          <button
            onClick={() => {
              onAddField('checkbox', contextMenu.pageX, contextMenu.pageY);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 flex items-center space-x-2 transition"
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
            <span>Add Checkbox</span>
          </button>
        </div>
      )}

      {/* Floating Zoom & Add Toolbar */}
      <div className="fixed bottom-6 right-8 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200/80 px-2 py-1.5 flex items-center space-x-2 z-40">
        <button
          onClick={() => onZoomChange(Math.max(0.5, zoomScale - 0.15))}
          title="Zoom Out"
          className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono font-medium text-gray-700 min-w-[40px] text-center">
          {Math.round(zoomScale * 100)}%
        </span>
        <button
          onClick={() => onZoomChange(Math.min(2.5, zoomScale + 0.15))}
          title="Zoom In"
          className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-gray-200" />
        <button
          onClick={() => onZoomChange(1.0)}
          title="Reset Zoom to 100%"
          className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
