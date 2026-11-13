import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FormField, ModelType, DetectionScope, PageInfo, FontOption, DetectionProgress } from './types/pdf';
import { pdfRenderer } from './services/pdfRenderer';
import { aiDetector } from './services/aiDetector';
import { pdfExporter } from './services/pdfExporter';
import { fontManager } from './services/fontManager';
import { TopNavbar } from './components/TopNavbar';
import { LeftSidebar } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { PDFViewer } from './components/PDFViewer';
import { PrivacyModal } from './components/PrivacyModal';
import { DetectionModal } from './components/DetectionModal';
import { MobileTopBar } from './components/MobileTopBar';
import { MobileBottomBar } from './components/MobileBottomBar';
import { MobileSheet } from './components/MobileSheet';
import { MobileDetectPanel } from './components/MobileDetectPanel';
import { useIsMobile } from './hooks/useIsMobile';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const App: React.FC = () => {
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1.25);
  
  // Model & Detection Scope
  const [selectedModel, setSelectedModel] = useState<ModelType>('ffdnet-s');
  const [detectionScope, setDetectionScope] = useState<DetectionScope>('current');
  const [detectionProgress, setDetectionProgress] = useState<DetectionProgress | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  // Fonts & Modals
  const [allFonts, setAllFonts] = useState<FontOption[]>(fontManager.getAllFonts());
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState<boolean>(false);

  // Mobile layout state
  const isMobile = useIsMobile();
  const [sheet, setSheet] = useState<'pages' | 'detect' | 'style' | null>(null);
  const [fitSignal, setFitSignal] = useState<number>(0);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<FormField[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isHistoryActionRef = useRef<boolean>(false);

  const pushHistory = useCallback((newFields: FormField[]) => {
    if (isHistoryActionRef.current) {
      isHistoryActionRef.current = false;
      return;
    }
    setHistory((prev) => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      return [...upToCurrent, newFields];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isHistoryActionRef.current = true;
      const targetState = history[historyIndex - 1];
      setFields(targetState);
      setHistoryIndex((prev) => prev - 1);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isHistoryActionRef.current = true;
      const targetState = history[historyIndex + 1];
      setFields(targetState);
      setHistoryIndex((prev) => prev + 1);
    }
  }, [history, historyIndex]);

  // Load a PDF file from buffer
  const loadPdfBuffer = async (buffer: ArrayBuffer, fileName: string = 'Document.pdf') => {
    try {
      // Create independent copies so the export copy is NEVER touched or detached
      const exportCopy = buffer.slice(0);
      const renderCopy = buffer.slice(0);
      
      const pages = await pdfRenderer.loadPdf(renderCopy);
      setPdfData(exportCopy);
      setPageInfos(pages);
      setActivePageIndex(0);
      setFitSignal((n) => n + 1);
      setSheet(null);
      setSelectedFieldId(null);

      // Auto-extract any native AcroForms present
      const initialAcroFields = await pdfRenderer.extractAcroForms(0);
      setFields(initialAcroFields);
      setHistory([initialAcroFields]);
      setHistoryIndex(0);
    } catch (err) {
      alert(`Error loading PDF: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleOpenFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    await loadPdfBuffer(buffer, file.name);
  };

  // Initialize fonts on mount
  useEffect(() => {
    fontManager.initBuiltInFonts().then(() => {
      setAllFonts(fontManager.getAllFonts());
    });
  }, []);

  // Update a single field
  const handleUpdateField = useCallback((updated: FormField, shouldCommit: boolean = true) => {
    setFields((prev) => {
      const next = prev.map((f) => (f.id === updated.id ? updated : f));
      if (shouldCommit) {
        pushHistory(next);
      }
      return next;
    });
  }, [pushHistory]);

  // Delete a field
  const handleDeleteField = useCallback((id: string) => {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id);
      pushHistory(next);
      return next;
    });
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  }, [selectedFieldId, pushHistory]);

  // Duplicate a field
  const handleDuplicateField = useCallback((field: FormField) => {
    const duplicated: FormField = {
      ...field,
      id: `field_dup_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      box: {
        ...field.box,
        x: Math.min(0.9, field.box.x + 0.02),
        y: Math.min(0.9, field.box.y + 0.02),
      },
      locked: false,
    };
    setFields((prev) => {
      const next = [...prev, duplicated];
      pushHistory(next);
      return next;
    });
    setSelectedFieldId(duplicated.id);
  }, [pushHistory]);

  // Add manual field at coordinates
  const handleAddManualField = useCallback((type: FormField['type'], normX: number = 0.2, normY: number = 0.2) => {
    const isCheckbox = type === 'checkbox';
    const newField: FormField = {
      id: `field_manual_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      pageIndex: activePageIndex,
      type,
      label: isCheckbox ? 'Manual Checkbox' : 'Manual Text Field',
      box: {
        x: normX,
        y: normY,
        width: isCheckbox ? 0.022 : (type === 'textarea' ? 0.40 : 0.28),
        height: isCheckbox ? 0.022 : (type === 'textarea' ? 0.08 : 0.024),
      },
      value: '',
      fontFamily: 'Kalpurush',
      fontSize: 12,
      autoFontSize: true,
      color: '#111827',
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      hAlign: 'left',
      vAlign: type === 'textarea' ? 'top' : 'middle',
      multiline: type === 'textarea',
      lineHeight: 1.35,
      checkboxState: 'empty',
      locked: false, // Unlocked when created manually so user can position
      source: 'manual',
    };

    setFields((prev) => {
      const next = [...prev, newField];
      pushHistory(next);
      return next;
    });
    setSelectedFieldId(newField.id);
  }, [activePageIndex, pushHistory]);

  // Apply font globally
  const handleApplyFontGlobally = useCallback((fontFamily: string) => {
    setFields((prev) => {
      const next = prev.map((f) => (f.type !== 'checkbox' ? { ...f, fontFamily } : f));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  // Apply font size globally to overlay text boxes
  // Already changed font size in text boxes will keep its current state (if keepCustom is true),
  // and the remaining will be changed.
  const handleApplyFontSizeGlobally = useCallback((fontSize: number, keepCustom: boolean = true) => {
    setFields((prev) => {
      const next = prev.map((f) => {
        if (f.type === 'checkbox') return f;
        if (f.id === selectedFieldId) {
          return {
            ...f,
            fontSize,
            autoFontSize: false,
            customFontSize: true,
          };
        }
        if (keepCustom && (f.customFontSize === true || (f.customFontSize === undefined && f.autoFontSize === false))) {
          return f; // Keep current state for already changed boxes
        }
        return {
          ...f,
          fontSize,
          autoFontSize: false,
          customFontSize: false,
        };
      });
      pushHistory(next);
      return next;
    });
  }, [selectedFieldId, pushHistory]);

  // Revert font size globally to auto font size
  // Already changed font size in text boxes will keep its current state (if keepCustom is true),
  // and the remaining will be reverted to auto font size.
  const handleRevertFontSizeGlobally = useCallback((keepCustom: boolean = true) => {
    setFields((prev) => {
      const next = prev.map((f) => {
        if (f.type === 'checkbox') return f;
        if (f.id === selectedFieldId) {
          return {
            ...f,
            autoFontSize: true,
            customFontSize: false,
          };
        }
        if (keepCustom && (f.customFontSize === true || (f.customFontSize === undefined && f.autoFontSize === false))) {
          return f; // Keep current state for already changed boxes
        }
        return {
          ...f,
          autoFontSize: true,
          customFontSize: false,
        };
      });
      pushHistory(next);
      return next;
    });
  }, [selectedFieldId, pushHistory]);

  // Merged global typography action (Apply Font & Size to All)
  const handleApplyTypographyGlobally = useCallback((fontFamily: string, fontSize: number, keepCustom: boolean = true) => {
    setFields((prev) => {
      const next = prev.map((f) => {
        if (f.type === 'checkbox') return f;
        const isSelected = f.id === selectedFieldId;
        const isCustom = keepCustom && (f.customFontSize === true || (f.customFontSize === undefined && f.autoFontSize === false));

        return {
          ...f,
          fontFamily,
          fontSize: isSelected ? fontSize : (isCustom ? f.fontSize : fontSize),
          autoFontSize: isSelected ? false : (isCustom ? f.autoFontSize : false),
          customFontSize: isSelected ? true : (isCustom ? f.customFontSize : false),
        };
      });
      pushHistory(next);
      return next;
    });
  }, [selectedFieldId, pushHistory]);

  // Toggle field lock
  const handleToggleLock = useCallback((id: string) => {
    setFields((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, locked: !f.locked } : f));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  // Clear fields on page
  const handleClearPageFields = useCallback((pageIdx: number) => {
    setFields((prev) => {
      const next = prev.filter((f) => f.pageIndex !== pageIdx);
      pushHistory(next);
      return next;
    });
    setSelectedFieldId(null);
  }, [pushHistory]);

  // Run AI Field Detection
  const handleDetectFields = async () => {
    if (!pdfData || pageInfos.length === 0) return;
    setIsDetecting(true);

    try {
      if (detectionScope === 'current') {
        const pageInfo = pageInfos[activePageIndex];
        if (!pageInfo) return;

        setDetectionProgress({
          status: 'detecting',
          model: selectedModel,
          currentPage: activePageIndex + 1,
          totalPages: 1,
          progressPercent: 20,
          message: `Analyzing active page ${activePageIndex + 1}...`,
        });

        const detected = await aiDetector.detectPage(
          activePageIndex,
          selectedModel,
          pageInfo,
          (pct, msg) => {
            setDetectionProgress({
              status: 'detecting',
              model: selectedModel,
              currentPage: activePageIndex + 1,
              totalPages: 1,
              progressPercent: pct,
              message: msg,
            });
          }
        );

        // Merge with existing fields (avoid duplicates)
        setFields((prev) => {
          const otherPages = prev.filter((f) => f.pageIndex !== activePageIndex);
          const next = [...otherPages, ...detected];
          pushHistory(next);
          return next;
        });
      } else {
        // All Pages
        setDetectionProgress({
          status: 'detecting',
          model: selectedModel,
          currentPage: 1,
          totalPages: pageInfos.length,
          progressPercent: 10,
          message: 'Scanning all pages...',
        });

        const detected = await aiDetector.detectAllPages(
          pageInfos.length,
          selectedModel,
          pageInfos,
          (curr, total, pct, msg) => {
            setDetectionProgress({
              status: 'detecting',
              model: selectedModel,
              currentPage: curr,
              totalPages: total,
              progressPercent: pct,
              message: msg,
            });
          }
        );

        setFields(detected);
        pushHistory(detected);
      }
    } catch (err: any) {
      setDetectionProgress({
        status: 'error',
        model: selectedModel,
        currentPage: 1,
        totalPages: 1,
        progressPercent: 0,
        message: 'Detection failed',
        error: err?.message || 'Error occurred during inference',
      });
    } finally {
      setIsDetecting(false);
      setTimeout(() => setDetectionProgress(null), 1200);
    }
  };

  // Export Flattened PDF
  const handleExportPdf = async () => {
    if (!pdfData) return;
    setIsExporting(true);

    try {
      const flattenedBytes = await pdfExporter.exportFlattenedPdf(
        pdfData,
        fields,
        pageInfos,
        'all',
        activePageIndex
      );

      const blob = new Blob([flattenedBytes as BlobPart], { type: 'application/pdf' });
      const fileName = `Fillora_Flattened_Form_${Date.now()}.pdf`;

      // Phones: open the native share sheet (Save to Files/Drive, WhatsApp, email...). Falls back to download.
      if (isMobile && typeof navigator.share === 'function' && typeof File !== 'undefined') {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: fileName });
            return;
          } catch (shareErr: any) {
            if (shareErr?.name === 'AbortError') return; // user closed the sheet
            // otherwise fall through to normal download
          }
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      alert(`Export error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Y / Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey)
      ) {
        e.preventDefault();
        handleRedo();
      }
      // Lock/Unlock: Ctrl+L
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l' && selectedFieldId) {
        e.preventDefault();
        handleToggleLock(selectedFieldId);
      }
      // Escape: Deselect
      if (e.key === 'Escape') {
        setSelectedFieldId(null);
      }
      // Delete selected field if not currently typing in an input
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFieldId) {
        const activeElem = document.activeElement;
        const isTyping = activeElem?.tagName === 'INPUT' || activeElem?.tagName === 'TEXTAREA';
        if (!isTyping) {
          e.preventDefault();
          handleDeleteField(selectedFieldId);
        }
      }
      // Tab to navigate next field
      if (e.key === 'Tab' && !e.shiftKey) {
        const pageFields = fields.filter((f) => f.pageIndex === activePageIndex);
        if (pageFields.length > 0) {
          e.preventDefault();
          const currentIdx = pageFields.findIndex((f) => f.id === selectedFieldId);
          const nextIdx = (currentIdx + 1) % pageFields.length;
          setSelectedFieldId(pageFields[nextIdx].id);
        }
      }
      // Shift+Tab to navigate previous field
      if (e.key === 'Tab' && e.shiftKey) {
        const pageFields = fields.filter((f) => f.pageIndex === activePageIndex);
        if (pageFields.length > 0) {
          e.preventDefault();
          const currentIdx = pageFields.findIndex((f) => f.id === selectedFieldId);
          const prevIdx = (currentIdx - 1 + pageFields.length) % pageFields.length;
          setSelectedFieldId(pageFields[prevIdx].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedFieldId, handleToggleLock, handleDeleteField, fields, activePageIndex]);

  // Drag and drop PDF files onto workspace
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      handleOpenFile(file);
    }
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;
  const hasDocument = pageInfos.length > 0;

  const rightSidebarProps = {
    selectedField,
    allFields: fields,
    pageInfo: selectedField
      ? (pageInfos.find((p) => p.pageIndex === selectedField.pageIndex) || pageInfos[activePageIndex])
      : pageInfos[activePageIndex],
    onUpdateField: handleUpdateField,
    onDeleteField: handleDeleteField,
    onDuplicateField: handleDuplicateField,
    onApplyFontGlobally: handleApplyFontGlobally,
    onApplyFontSizeGlobally: handleApplyFontSizeGlobally,
    onRevertFontSizeGlobally: handleRevertFontSizeGlobally,
    onApplyTypographyGlobally: handleApplyTypographyGlobally,
    allFonts,
    onFontUploaded: (newFont: FontOption) => setAllFonts((prev) => [...prev, newFont]),
  };

  const viewerProps = {
    pageIndex: activePageIndex,
    pageInfo: pageInfos[activePageIndex],
    fields,
    selectedFieldId,
    onSelectField: setSelectedFieldId,
    onUpdateField: handleUpdateField,
    onDeleteField: handleDeleteField,
    onAddField: handleAddManualField,
    zoomScale,
    onZoomChange: setZoomScale,
    onOpenFile: handleOpenFile,
    isMobile,
    fitSignal,
  };

  const detectionOverlays = (
    <>
      <PrivacyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />
      <DetectionModal
        progress={detectionProgress}
        onCancel={() => {
          aiDetector.terminate();
          setIsDetecting(false);
          setDetectionProgress(null);
        }}
      />
    </>
  );

  // ------------------------------------------------------------------ MOBILE
  if (isMobile) {
    return (
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="flex flex-col h-app w-full overflow-hidden bg-gray-100 font-sans text-gray-900"
      >
        <MobileTopBar
          hasDocument={hasDocument}
          onOpenFile={handleOpenFile}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onExportPdf={handleExportPdf}
          isExporting={isExporting}
          onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
        />

        <div className="flex-1 flex overflow-hidden relative min-h-0">
          <PDFViewer {...viewerProps} />

          {pageInfos.length > 1 && (
            <div className="absolute left-3 bottom-3 z-30 bg-white/95 backdrop-blur rounded-full shadow-md border border-gray-200 flex items-center text-xs font-semibold text-gray-700 select-none">
              <button
                aria-label="Previous page"
                disabled={activePageIndex === 0}
                onClick={() => setActivePageIndex((i) => Math.max(0, i - 1))}
                className="p-2 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-1 tabular-nums">{activePageIndex + 1} / {pageInfos.length}</span>
              <button
                aria-label="Next page"
                disabled={activePageIndex === pageInfos.length - 1}
                onClick={() => setActivePageIndex((i) => Math.min(pageInfos.length - 1, i + 1))}
                className="p-2 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <MobileBottomBar
          disabled={!hasDocument}
          isDetecting={isDetecting}
          hasSelection={!!selectedField}
          fieldCount={fields.length}
          onOpenPages={() => setSheet('pages')}
          onOpenDetect={() => setSheet('detect')}
          onOpenStyle={() => setSheet('style')}
          onAddField={(type) => handleAddManualField(type)}
        />

        <MobileSheet open={sheet === 'pages'} title="Pages & fields" onClose={() => setSheet(null)}>
          <LeftSidebar
            embedded
            pageInfos={pageInfos}
            activePageIndex={activePageIndex}
            onPageSelect={(i) => { setActivePageIndex(i); setSheet(null); }}
            fields={fields}
            selectedFieldId={selectedFieldId}
            onSelectField={(id) => { setSelectedFieldId(id); setSheet(null); }}
            onToggleLock={handleToggleLock}
            onDeleteField={handleDeleteField}
            onClearPageFields={handleClearPageFields}
          />
        </MobileSheet>

        <MobileSheet open={sheet === 'detect'} title="Detect form fields" size="auto" onClose={() => setSheet(null)}>
          <MobileDetectPanel
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            scope={detectionScope}
            onSelectScope={setDetectionScope}
            pageCount={pageInfos.length}
            onRun={() => { setSheet(null); handleDetectFields(); }}
          />
        </MobileSheet>

        <MobileSheet open={sheet === 'style'} title="Field style" onClose={() => setSheet(null)}>
          <RightSidebar embedded {...rightSidebarProps} />
        </MobileSheet>

        {detectionOverlays}
      </div>
    );
  }

  // ----------------------------------------------------------------- DESKTOP
  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex flex-col h-app w-screen overflow-hidden bg-gray-100 font-sans text-gray-900"
    >
      <TopNavbar
        onOpenFile={handleOpenFile}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDetect={handleDetectFields}
        isDetecting={isDetecting}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        detectionScope={detectionScope}
        onSelectScope={setDetectionScope}
        onAddManualField={(type) => handleAddManualField(type)}
        onExportPdf={handleExportPdf}
        isExporting={isExporting}
        onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <LeftSidebar
          pageInfos={pageInfos}
          activePageIndex={activePageIndex}
          onPageSelect={setActivePageIndex}
          fields={fields}
          selectedFieldId={selectedFieldId}
          onSelectField={setSelectedFieldId}
          onToggleLock={handleToggleLock}
          onDeleteField={handleDeleteField}
          onClearPageFields={handleClearPageFields}
        />
        <PDFViewer {...viewerProps} />
        <RightSidebar {...rightSidebarProps} />
      </div>

      {detectionOverlays}
    </div>
  );
};
