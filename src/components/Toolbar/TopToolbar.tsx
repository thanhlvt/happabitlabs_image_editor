import React, { useRef } from 'react';
import {
  CheckCircle2,
  Download,
  FilePlus2,
  FolderInput,
  FolderOpen,
  Redo2,
  Save,
  Scaling,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import {
  downloadProjectFile,
  parseProjectFile,
  saveAutoSaveProject,
  serializeProject,
} from '../../utils/projectStorage';

interface TopToolbarProps {
  onOpenNewModal: () => void;
  onOpenProjectsModal: () => void;
  onOpenResizeModal: () => void;
  onOpenExportModal: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  onOpenNewModal,
  onOpenProjectsModal,
  onOpenResizeModal,
  onOpenExportModal,
}) => {
  const {
    projectId,
    projectName,
    lastSavedAt,
    lastExportName,
    canvas,
    layers,
    panelLayout,
    zoom,
    alphaPreviewMode,
    selectedLayerId,
    past,
    future,
    undo,
    redo,
    setProjectName,
    setLastSavedAt,
    loadProject,
  } = useEditorStore();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const project = parseProjectFile(text);
      loadProject(project);
      await saveAutoSaveProject(project);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Không thể import file project.'
      );
    }
    e.target.value = '';
  };

  const handleSaveProjectToDisc = () => {
    const project = serializeProject(
      projectName,
      canvas,
      layers,
      {
        panelLayout,
        zoom,
        alphaPreviewMode,
        selectedLayerId,
        lastExportName,
      },
      projectId
    );
    downloadProjectFile(project);
    setLastSavedAt(project.savedAt);
  };

  const savedTimeText = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <header className="h-12 bg-[#161920] border-b border-slate-800 px-3 flex items-center justify-between text-xs shrink-0">
      {/* Left: Brand & Project actions (Icon + Tooltip) */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-2 pr-3 mr-1 border-r border-slate-800">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-100">
            MistCanvas
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenNewModal}
          aria-label="New Project"
          title="New Project"
          className="p-2 rounded-md hover:bg-slate-800 text-blue-400 transition"
        >
          <FilePlus2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenProjectsModal}
          aria-label="Open Project"
          title="Open Project (chọn từ IndexedDB)"
          className="p-2 rounded-md hover:bg-slate-800 text-amber-400 transition"
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          aria-label="Import Project"
          title="Import Project (.mist.json)"
          className="p-2 rounded-md hover:bg-slate-800 text-violet-400 transition"
        >
          <FolderInput className="w-4 h-4" />
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".mist.json,.json,application/json"
          onChange={handleImportProject}
          className="hidden"
        />

        <button
          type="button"
          onClick={handleSaveProjectToDisc}
          aria-label="Save Project To Disc"
          title="Save Project To Disc (Ctrl+S)"
          className="p-2 rounded-md hover:bg-slate-800 text-cyan-400 transition"
        >
          <Save className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenResizeModal}
          aria-label="Resize"
          title="Resize Canvas"
          className="p-2 rounded-md hover:bg-slate-800 text-emerald-400 transition"
        >
          <Scaling className="w-4 h-4" />
        </button>
      </div>

      {/* Center: Project Name, Autosave status, Undo/Redo & Dimensions */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label="Tên Project"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-36 bg-[#0f1115] border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded-md px-2 py-1 text-slate-200 text-xs focus:outline-none truncate"
        />

        {savedTimeText && (
          <span
            title={`Tự động lưu lúc ${savedTimeText}`}
            className="hidden md:flex items-center gap-1 text-[11px] text-emerald-400/90"
          >
            <CheckCircle2 className="w-3 h-3" />
            Đã tự lưu
          </span>
        )}

        <div className="flex items-center gap-1 bg-[#0f1115] border border-slate-800 rounded-md p-0.5">
          <button
            onClick={undo}
            disabled={past.length === 0}
            title="Hoàn tác (Ctrl+Z)"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none text-slate-200"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            title="Làm lại (Ctrl+Y)"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none text-slate-200"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={onOpenResizeModal}
          title="Click để thay đổi kích thước Canvas"
          className="px-2.5 py-1 rounded-md bg-[#0f1115] border border-slate-800 hover:border-slate-600 text-slate-300 font-mono"
        >
          {canvas.width} × {canvas.height}
        </button>
      </div>

      {/* Right: Export */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm transition"
        >
          <Download className="w-3.5 h-3.5" />
          Export Image
        </button>
      </div>
    </header>
  );
};
