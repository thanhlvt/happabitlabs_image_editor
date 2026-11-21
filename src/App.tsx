import { useEffect, useRef, useState } from 'react';
import { TopToolbar } from './components/Toolbar/TopToolbar';
import { LeftToolRail } from './components/Toolbar/LeftToolRail';
import { EditorCanvas } from './components/Canvas/EditorCanvas';
import { WorkspacePanels } from './components/Panels/WorkspacePanels';
import { NewCanvasModal } from './components/Modals/NewCanvasModal';
import { ResizeModal } from './components/Modals/ResizeModal';
import { ExportModal } from './components/Modals/ExportModal';
import { useEditorStore } from './store/useEditorStore';
import {
  downloadProjectFile,
  loadAutoSaveProject,
  saveAutoSaveProject,
  serializeProject,
} from './utils/projectStorage';

export function App() {
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [resizeModalOpen, setResizeModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const hydratedRef = useRef(false);

  const {
    projectName,
    lastExportName,
    canvas,
    layers,
    panelLayout,
    zoom,
    alphaPreviewMode,
    selectedLayerId,
    undo,
    redo,
    setActiveTool,
    enterCropMode,
    applyCrop,
    cancelCropMode,
    cancelEyedropper,
    deleteLayer,
    duplicateLayer,
    updateLayer,
    loadProject,
    setLastSavedAt,
  } = useEditorStore();

  // Restore last autosaved project from IndexedDB on mount
  useEffect(() => {
    let active = true;
    loadAutoSaveProject().then((saved) => {
      if (!active) return;
      if (saved) {
        loadProject(saved);
      }
      hydratedRef.current = true;
    });
    return () => {
      active = false;
    };
  }, [loadProject]);

  // Auto-save to IndexedDB whenever project content or editor environment changes
  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = window.setTimeout(async () => {
      const project = serializeProject(projectName, canvas, layers, {
        panelLayout,
        zoom,
        alphaPreviewMode,
        selectedLayerId,
        lastExportName,
      });
      const ok = await saveAutoSaveProject(project);
      if (ok) {
        setLastSavedAt(project.savedAt);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    projectName,
    canvas,
    layers,
    panelLayout,
    zoom,
    alphaPreviewMode,
    selectedLayerId,
    lastExportName,
    setLastSavedAt,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isInput) return;

      const state = useEditorStore.getState();

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const project = serializeProject(
          state.projectName,
          state.canvas,
          state.layers,
          {
            panelLayout: state.panelLayout,
            zoom: state.zoom,
            alphaPreviewMode: state.alphaPreviewMode,
            selectedLayerId: state.selectedLayerId,
            lastExportName: state.lastExportName,
          }
        );
        downloadProjectFile(project);
        state.setLastSavedAt(project.savedAt);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (state.selectedLayerId) duplicateLayer(state.selectedLayerId);
        return;
      }

      if (e.key === 'Escape') {
        if (state.activeTool === 'crop') cancelCropMode();
        if (state.activeTool === 'eyedropper') cancelEyedropper();
        if (state.activeTool === 'magic-eraser') setActiveTool('select');
        return;
      }

      if (e.key === 'Enter' && state.activeTool === 'crop') {
        e.preventDefault();
        applyCrop();
        return;
      }

      if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey) {
        setActiveTool('select');
        return;
      }

      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey) {
        setActiveTool(
          state.activeTool === 'magic-eraser' ? 'select' : 'magic-eraser'
        );
        return;
      }

      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        enterCropMode();
        return;
      }

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        state.selectedLayerId
      ) {
        e.preventDefault();
        deleteLayer(state.selectedLayerId);
        return;
      }

      // Arrow key nudging for selected layer
      if (
        state.selectedLayerId &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        const layer = state.layers.find((l) => l.id === state.selectedLayerId);
        if (!layer || layer.locked) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        updateLayer(layer.id, { x: layer.x + dx, y: layer.y + dy }, true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    setActiveTool,
    enterCropMode,
    applyCrop,
    cancelCropMode,
    cancelEyedropper,
    deleteLayer,
    duplicateLayer,
    updateLayer,
  ]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f1115] text-slate-100 overflow-hidden">
      <TopToolbar
        onOpenNewModal={() => setNewModalOpen(true)}
        onOpenResizeModal={() => setResizeModalOpen(true)}
        onOpenExportModal={() => setExportModalOpen(true)}
      />

      <div className="flex-1 flex min-h-0">
        <LeftToolRail />
        <WorkspacePanels
          canvasSlot={<EditorCanvas />}
          onOpenResizeModal={() => setResizeModalOpen(true)}
        />
      </div>

      <NewCanvasModal open={newModalOpen} onClose={() => setNewModalOpen(false)} />
      <ResizeModal
        open={resizeModalOpen}
        onClose={() => setResizeModalOpen(false)}
      />
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
    </div>
  );
}

export default App;
