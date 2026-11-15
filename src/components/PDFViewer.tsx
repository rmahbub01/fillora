import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { FormField, PageInfo } from '../types/pdf';
import { pdfRenderer } from '../services/pdfRenderer';
import { FieldOverlay } from './FieldOverlay';
import { SmartGuidesOverlay } from './SmartGuidesOverlay';
import { SmartGuideLine } from '../utils/smartGuides';
import { GithubIcon } from './GithubIcon';
import { FilloraLogo } from './FilloraLogo';
import { Plus, CheckSquare, Type, ZoomIn, ZoomOut, Maximize2, RotateCcw, Upload, ExternalLink, Magnet } from 'lucide-react';

interface PDFViewerProps {
  pageIndex: number;
  pageInfo: PageInfo | undefined;
  fields: FormField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onUpdateField: (field: FormField, shouldCommit?: boolean) => void;
  onDeleteField: (id: string) => void;
  onAddField: (type: FormField['type'], x: number, y: number) => void;
  zoomScale: number;
  onZoomChange: (newScale: number) => void;
  onOpenFile?: (file: File) => void;
  isMobile?: boolean;
  /** Changes whenever a new PDF is opened; triggers fit-to-width on mobile. */
  fitSignal?: number;
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
  onOpenFile,
  isMobile = false,
  fitSignal = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    scale: number;
    targetZoom: number;
    startMidX: number;
    startMidY: number;
    currMidX: number;
    currMidY: number;
    currDx: number;
    currDy: number;
    originX: number;
    originY: number;
    pdfX: number;
    pdfY: number;
    viewportX: number;
    viewportY: number;
  } | null>(null);
  const pendingZoomCommitRef = useRef<{ targetScrollLeft: number; targetScrollTop: number } | null>(null);
  const lastRenderedPageRef = useRef<number | null>(null);
  const zoomRef = useRef(zoomScale);
  zoomRef.current = zoomScale;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const [smartGuides, setSmartGuides] = useState<SmartGuideLine[]>([]);
  const [smartGuidesEnabled, setSmartGuidesEnabled] = useState<boolean>(true);

  // Filter fields belonging to current active page
  const pageFields = fields.filter((f) => f.pageIndex === pageIndex);

  // Render PDF page when pageIndex or zoomScale changes
  useEffect(() => {
    let isCancelled = false;
    const isPageChange = lastRenderedPageRef.current !== pageIndex;
    lastRenderedPageRef.current = pageIndex;

    const render = async () => {
      if (!canvasRef.current || !pageInfo) return;
      // Only show full-screen spinner and clear canvas when switching pages,
      // NOT during zoom on the same page (prevents flashing white / reload feel).
      if (isPageChange) {
        setIsRendering(true);
        // Clear canvas context to prevent holding previous PDF/page preview
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      try {
        await pdfRenderer.renderPageToCanvas(pageIndex, canvasRef.current, zoomScale);
      } catch (err) {
        console.error('Render error:', err);
      } finally {
        if (!isCancelled && isPageChange) {
          setIsRendering(false);
        }
      }
    };

    render();
    return () => {
      isCancelled = true;
    };
  }, [pageIndex, zoomScale, pageInfo]);

  // Synchronously update scroll position and clear CSS transform before browser paints
  useLayoutEffect(() => {
    if (pendingZoomCommitRef.current) {
      const { targetScrollLeft, targetScrollTop } = pendingZoomCommitRef.current;
      pendingZoomCommitRef.current = null;

      if (pageWrapRef.current) {
        pageWrapRef.current.style.transform = '';
        pageWrapRef.current.style.transformOrigin = '';
        pageWrapRef.current.style.willChange = '';
      }
      if (containerRef.current) {
        containerRef.current.scrollLeft = targetScrollLeft;
        containerRef.current.scrollTop = targetScrollTop;
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollLeft = targetScrollLeft;
            containerRef.current.scrollTop = targetScrollTop;
          }
        });
      }
    }
  }, [zoomScale]);

  // Touch gesture safety: prevent native browser pull-to-refresh & pinch zoom on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // Mobile: fit page width to the screen when a document (or a different page size) loads
  useEffect(() => {
    if (!isMobile || !pageInfo || !containerRef.current) return;
    const avail = containerRef.current.clientWidth - 16;
    if (avail > 0) {
      onZoomChange(Math.max(0.3, Math.min(2.5, avail / pageInfo.width)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, fitSignal, pageInfo?.width]);

  const startPinchZoom = () => {
    if (pointersRef.current.size < 2 || !pageWrapRef.current || !containerRef.current) return;
    const [a, b] = [...pointersRef.current.values()];
    const startDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const startMidX = (a.x + b.x) / 2;
    const startMidY = (a.y + b.y) / 2;

    const containerRect = containerRef.current.getBoundingClientRect();
    const pageRect = pageWrapRef.current.getBoundingClientRect();

    const originX = startMidX - pageRect.left;
    const originY = startMidY - pageRect.top;

    const currentZoom = zoomRef.current;
    const pdfX = originX / currentZoom;
    const pdfY = originY / currentZoom;

    const viewportX = startMidX - containerRect.left;
    const viewportY = startMidY - containerRect.top;

    pinchRef.current = {
      startDist,
      startZoom: currentZoom,
      scale: 1,
      targetZoom: currentZoom,
      startMidX,
      startMidY,
      currMidX: startMidX,
      currMidY: startMidY,
      currDx: 0,
      currDy: 0,
      originX,
      originY,
      pdfX,
      pdfY,
      viewportX,
      viewportY,
    };

    pageWrapRef.current.style.transformOrigin = `${originX}px ${originY}px`;
    pageWrapRef.current.style.willChange = 'transform';
  };

  const finishPinchZoom = () => {
    const pinch = pinchRef.current;
    pinchRef.current = null;
    if (!pinch || !pageWrapRef.current || !containerRef.current || !pageInfo) {
      if (pageWrapRef.current) {
        pageWrapRef.current.style.transform = '';
        pageWrapRef.current.style.transformOrigin = '';
        pageWrapRef.current.style.willChange = '';
      }
      return;
    }

    const finalZoom = Math.max(0.3, Math.min(2.5, pinch.targetZoom));
    const hasZoomChanged = Math.abs(finalZoom - pinch.startZoom) > 0.005;
    const hasMoved = Math.hypot(pinch.currDx, pinch.currDy) > 5;

    if (!hasZoomChanged && !hasMoved) {
      pageWrapRef.current.style.transform = '';
      pageWrapRef.current.style.transformOrigin = '';
      pageWrapRef.current.style.willChange = '';
      return;
    }

    const container = containerRef.current;
    const style = window.getComputedStyle(container);
    const padLeft = parseFloat(style.paddingLeft) || (isMobile ? 8 : 32);
    const padTop = parseFloat(style.paddingTop) || (isMobile ? 8 : 32);
    const padRight = parseFloat(style.paddingRight) || (isMobile ? 8 : 32);

    const newWrapWidth = pageInfo.width * finalZoom;
    const availWidth = container.clientWidth - padLeft - padRight;

    const wrapLeft = newWrapWidth < availWidth
      ? padLeft + (availWidth - newWrapWidth) / 2
      : padLeft;
    const wrapTop = padTop;

    const focalContentX = wrapLeft + pinch.pdfX * finalZoom;
    const focalContentY = wrapTop + pinch.pdfY * finalZoom;

    const finalViewportX = pinch.viewportX + pinch.currDx;
    const finalViewportY = pinch.viewportY + pinch.currDy;

    const targetScrollLeft = Math.max(0, focalContentX - finalViewportX);
    const targetScrollTop = Math.max(0, focalContentY - finalViewportY);

    if (hasZoomChanged) {
      pendingZoomCommitRef.current = {
        targetScrollLeft,
        targetScrollTop,
      };
      onZoomChange(finalZoom);
    } else {
      pageWrapRef.current.style.transform = '';
      pageWrapRef.current.style.transformOrigin = '';
      pageWrapRef.current.style.willChange = '';
      container.scrollLeft = targetScrollLeft;
      container.scrollTop = targetScrollTop;
    }
  };

  useEffect(() => {
    const onWindowPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pinchRef.current && pointersRef.current.size >= 2 && pageWrapRef.current) {
        const [a, b] = [...pointersRef.current.values()];
        const currDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const currMidX = (a.x + b.x) / 2;
        const currMidY = (a.y + b.y) / 2;

        const dx = currMidX - pinchRef.current.startMidX;
        const dy = currMidY - pinchRef.current.startMidY;

        const ratio = currDist / pinchRef.current.startDist;
        const targetZoom = Math.max(0.3, Math.min(2.5, pinchRef.current.startZoom * ratio));
        const scale = targetZoom / pinchRef.current.startZoom;

        pinchRef.current.scale = scale;
        pinchRef.current.targetZoom = targetZoom;
        pinchRef.current.currMidX = currMidX;
        pinchRef.current.currMidY = currMidY;
        pinchRef.current.currDx = dx;
        pinchRef.current.currDy = dy;

        pageWrapRef.current.style.transformOrigin = `${pinchRef.current.originX}px ${pinchRef.current.originY}px`;
        pageWrapRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
      }
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.delete(e.pointerId);

      if (pinchRef.current && pointersRef.current.size < 2) {
        finishPinchZoom();
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [pageInfo, isMobile]);

  const handlePointerDownCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      startPinchZoom();
    }
  };

  const handleToolbarZoom = (newScale: number) => {
    if (!containerRef.current || !pageInfo) {
      onZoomChange(newScale);
      return;
    }
    const container = containerRef.current;
    const oldZoom = zoomScale;
    const finalZoom = Math.max(0.3, Math.min(2.5, newScale));
    if (Math.abs(finalZoom - oldZoom) < 0.005) return;

    const style = window.getComputedStyle(container);
    const padLeft = parseFloat(style.paddingLeft) || (isMobile ? 8 : 32);
    const padRight = parseFloat(style.paddingRight) || (isMobile ? 8 : 32);
    const padTop = parseFloat(style.paddingTop) || (isMobile ? 8 : 32);

    const availW = container.clientWidth - padLeft - padRight;
    const oldWrapW = pageInfo.width * oldZoom;
    const oldWrapLeft = oldWrapW < availW ? padLeft + (availW - oldWrapW) / 2 : padLeft;
    const oldWrapTop = padTop;

    const viewCenterX = container.clientWidth / 2;
    const viewCenterY = container.clientHeight / 2;
    const pdfCenterX = (container.scrollLeft + viewCenterX - oldWrapLeft) / oldZoom;
    const pdfCenterY = (container.scrollTop + viewCenterY - oldWrapTop) / oldZoom;

    const newWrapW = pageInfo.width * finalZoom;
    const newWrapLeft = newWrapW < availW ? padLeft + (availW - newWrapW) / 2 : padLeft;
    const newWrapTop = padTop;

    const targetScrollLeft = Math.max(0, newWrapLeft + pdfCenterX * finalZoom - viewCenterX);
    const targetScrollTop = Math.max(0, newWrapTop + pdfCenterY * finalZoom - viewCenterY);

    pendingZoomCommitRef.current = {
      targetScrollLeft,
      targetScrollTop,
    };

    onZoomChange(finalZoom);
  };

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
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-gray-100/90 select-none overflow-y-auto">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-200/80 p-8 text-center flex flex-col items-center">
          <FilloraLogo variant="hero" size={68} className="mb-4" />

          <p className="text-xs text-gray-500 mb-6 leading-relaxed">
            Drag and drop any PDF document here, or select a file from your device. All neural form detection and processing happens 100% locally on your computer.
          </p>

          <input
            id="emptyStatePdfInput"
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onOpenFile) onOpenFile(file);
            }}
            className="hidden"
          />
          <button
            onClick={() => document.getElementById('emptyStatePdfInput')?.click()}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Select PDF Document</span>
          </button>

          <div className="mt-6 pt-6 border-t border-gray-100 w-full flex items-center justify-around text-[11px] text-gray-400">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>100% Private</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>AI Form Detection</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Bangla Unicode</span>
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 w-full flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center space-x-1">
              <span>Developed by</span>
              <a
                href="https://github.com/rmahbub01"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Mahbub Rahman
              </a>
            </span>
            <a
              href="https://github.com/rmahbub01/fillora"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-gray-600 hover:text-gray-900 hover:underline transition"
            >
              <GithubIcon className="w-3.5 h-3.5 text-gray-700" />
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  const pageWidth = pageInfo.width;
  const pageHeight = pageInfo.height;

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col">
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        onContextMenu={handleCanvasContextMenu}
        onPointerDownCapture={handlePointerDownCapture}
        style={{
          touchAction: 'pan-x pan-y',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
        className={`flex-1 relative overflow-auto bg-gray-100/90 flex ${isMobile ? 'justify-start p-2 pb-24' : 'justify-center p-8'} select-none`}
      >
        {/* PDF Page Wrapper */}
        <div
          ref={pageWrapRef}
          className={`relative bg-white shadow-xl shrink-0 ${isMobile ? 'mx-auto' : 'transition-all duration-100'}`}
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
          <div className="absolute inset-0 pointer-events-none z-10">
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
                  otherFields={pageFields.filter((f) => f.id !== field.id)}
                  onGuidesChange={setSmartGuides}
                  smartGuidesEnabled={smartGuidesEnabled}
                />
              </div>
            ))}
          </div>

          {/* Smart Guides Overlay: rendered on top of all fields and canvas */}
          <SmartGuidesOverlay
            guides={smartGuides}
            width={pageWidth * zoomScale}
            height={pageHeight * zoomScale}
          />
        </div>

        {/* Right-click Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-50 min-w-[170px] text-xs text-gray-700"
            style={{
              left: `${Math.min(contextMenu.x, window.innerWidth - 190)}px`,
              top: `${Math.min(contextMenu.y, window.innerHeight - 190)}px`,
            }}
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
              className="w-full text-left px-3 py-2.5 md:py-1.5 hover:bg-indigo-50 hover:text-indigo-600 flex items-center space-x-2 transition"
            >
              <Type className="w-3.5 h-3.5 text-indigo-500" />
              <span>Add Text Box</span>
            </button>
            <button
              onClick={() => {
                onAddField('textarea', contextMenu.pageX, contextMenu.pageY);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2.5 md:py-1.5 hover:bg-indigo-50 hover:text-indigo-600 flex items-center space-x-2 transition"
            >
              <Type className="w-3.5 h-3.5 text-indigo-500" />
              <span>Add Multiline Area</span>
            </button>
            <button
              onClick={() => {
                onAddField('checkbox', contextMenu.pageX, contextMenu.pageY);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2.5 md:py-1.5 hover:bg-indigo-50 hover:text-indigo-600 flex items-center space-x-2 transition"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
              <span>Add Checkbox</span>
            </button>
          </div>
        )}
      </div>

      {/* Vertical Zoom Toolbar: attached to the left edge of the Right Sidebar */}
      <div className={isMobile
        ? "absolute right-3 bottom-3 bg-white/95 backdrop-blur-md rounded-full shadow-md border border-gray-200/90 py-1 px-2 flex items-center space-x-1 z-30 pointer-events-auto select-none"
        : "absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md rounded-l-xl shadow-md border-y border-l border-gray-200/90 py-2 px-1.5 flex flex-col items-center space-y-2 z-30 pointer-events-auto select-none"}>
        <button
          onClick={() => handleToolbarZoom(zoomScale + 0.15)}
          title="Zoom In"
          className="p-2 md:p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <span className="text-[10px] font-mono font-semibold text-gray-700 text-center py-0.5 leading-none">
          {Math.round(zoomScale * 100)}%
        </span>

        <button
          onClick={() => handleToolbarZoom(zoomScale - 0.15)}
          title="Zoom Out"
          className="p-2 md:p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <div className={isMobile ? "h-4 w-[1px] bg-gray-200" : "w-4 h-[1px] bg-gray-200"} />

        <button
          onClick={() => {
            if (isMobile && containerRef.current && pageInfo) {
              onZoomChange(Math.max(0.3, Math.min(2.5, (containerRef.current.clientWidth - 16) / pageInfo.width)));
            } else {
              onZoomChange(1.0);
            }
          }}
          title={isMobile ? "Fit to width" : "Reset Zoom to 100%"}
          className="p-2 md:p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
        >
          {isMobile ? <Maximize2 className="w-4 h-4" /> : <RotateCcw className="w-3.5 h-3.5" />}
        </button>

        <div className={isMobile ? "h-4 w-[1px] bg-gray-200" : "w-4 h-[1px] bg-gray-200"} />

        <button
          onClick={() => {
            setSmartGuidesEnabled((prev) => !prev);
            setSmartGuides([]);
          }}
          title={
            smartGuidesEnabled
              ? 'Smart Guides: ON (magnetic snapping active). Click to turn off.'
              : 'Smart Guides: OFF. Click to turn on magnetic snapping.'
          }
          className={`p-2 md:p-1.5 rounded-lg transition ${
            smartGuidesEnabled
              ? 'text-pink-600 bg-pink-50 hover:bg-pink-100'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Magnet className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
