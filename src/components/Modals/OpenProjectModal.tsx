import React, { useEffect, useState } from 'react';
import { FolderOpen, Layers, Trash2, X } from 'lucide-react';
import type { ProjectFile } from '../../types/editor';
import { useEditorStore } from '../../store/useEditorStore';
import {
  deleteSavedProject,
  listSavedProjects,
} from '../../utils/projectStorage';

interface OpenProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export const OpenProjectModal: React.FC<OpenProjectModalProps> = ({
  open,
  onClose,
}) => {
  const { projectId, loadProject } = useEditorStore();
  const [projects, setProjects] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshList = async () => {
    setLoading(true);
    try {
      const list = await listSavedProjects();
      setProjects(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      refreshList();
    }
  }, [open]);

  if (!open) return null;

  const handleSelect = (proj: ProjectFile) => {
    loadProject(proj);
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, id?: string) => {
    e.stopPropagation();
    if (!id) return;
    await deleteSavedProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#181b22] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Mở Project đã lưu (IndexedDB)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2 text-xs">
          {loading ? (
            <div className="text-center text-slate-400 py-8">
              Đang tải danh sách project...
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              Chưa có project nào được lưu trong trình duyệt.
            </div>
          ) : (
            projects.map((proj) => {
              const isCurrent = proj.id === projectId;
              const dateStr = new Date(proj.savedAt).toLocaleString();
              return (
                <div
                  key={proj.id}
                  onClick={() => handleSelect(proj)}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    isCurrent
                      ? 'bg-blue-600/15 border-blue-500/70'
                      : 'bg-[#0f1115] border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100 truncate">
                        {proj.name}
                      </span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-300 text-[10px]">
                          Đang mở
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                      <span className="font-mono">
                        {proj.canvas.width} × {proj.canvas.height}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" /> {proj.layers.length} layers
                      </span>
                      <span>{dateStr}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Xóa project ${proj.name}`}
                    title="Xóa project khỏi IndexedDB"
                    onClick={(e) => handleDelete(e, proj.id)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
