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
  const handleUpdateField = useCallback((updated: FormField) => {
    setFields((prev) => {
      const next = prev.map((f) => (f.id === updated.id ? updated : f));
      pushHistory(next);
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
        width: isCheckbox ? 0.03 : 0.35,
        height: isCheckbox ? 0.025 : 0.035,
      },
      value: '',
      fontFamily: 'Kalpurush',
      fontSize: 12,
      autoFontSize: true,
      color: '#111827',
      hAlign: 'left',
      vAlign: type === 'textarea' ? 'top' : 'middle',
      multiline: type === 'textarea',
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

      // Create download trigger
      const blob = new Blob([flattenedBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Fillora_Flattened_Form_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex flex-col h-screen w-screen overflow-hidden bg-gray-100 font-sans text-gray-900"
    >
      {/* Top Navbar */}
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

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar (Thumbnails & Fields) */}
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

        {/* Center Interactive PDF Canvas */}
        <PDFViewer
          pageIndex={activePageIndex}
          pageInfo={pageInfos[activePageIndex]}
          fields={fields}
          selectedFieldId={selectedFieldId}
          onSelectField={setSelectedFieldId}
          onUpdateField={handleUpdateField}
          onDeleteField={handleDeleteField}
          onAddField={handleAddManualField}
          zoomScale={zoomScale}
          onZoomChange={setZoomScale}
          onOpenFile={handleOpenFile}
        />

        {/* Right Sidebar (Properties & Styling) */}
        <RightSidebar
          selectedField={selectedField}
          onUpdateField={handleUpdateField}
          onDeleteField={handleDeleteField}
          onDuplicateField={handleDuplicateField}
          onApplyFontGlobally={handleApplyFontGlobally}
          allFonts={allFonts}
          onFontUploaded={(newFont) => setAllFonts((prev) => [...prev, newFont])}
        />
      </div>

      {/* Privacy Guarantee Modal */}
      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      {/* Detection Progress Dialog */}
      <DetectionModal
        progress={detectionProgress}
        onCancel={() => {
          aiDetector.terminate();
          setIsDetecting(false);
          setDetectionProgress(null);
        }}
      />
    </div>
  );
};
