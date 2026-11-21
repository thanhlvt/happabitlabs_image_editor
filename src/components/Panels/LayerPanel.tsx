import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CloudFog,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { readLocalImageFile } from '../../utils/fileHelpers';
import { hexToRgbaString, normalizeStops } from '../../utils/fogRenderer';

export const LayerPanel: React.FC = () => {
  const {
    layers,
    selectedLayerId,
    setSelectedLayer,
    updateLayer,
    deleteLayer,
    duplicateLayer,
    moveLayerOrder,
    insertImages,
    addFogLayer,
  } = useEditorStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleInsert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const loaded = await Promise.all(files.map(readLocalImageFile));
    insertImages(loaded);
    e.target.value = '';
  };

  // Display top-most layer first
  const reversedLayers = [...layers].reverse();

  return (
    <div className="flex-1 flex flex-col min-h-0 text-xs">
      <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Layers ({layers.length})
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Chèn ảnh"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
          >
            <ImagePlus className="w-3 h-3 text-emerald-400" /> Ảnh
          </button>
          <button
            type="button"
            onClick={() => addFogLayer('white-mist')}
            title="Thêm Object Sương"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
          >
            <CloudFog className="w-3 h-3 text-cyan-400" /> Sương
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleInsert}
            className="hidden"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {reversedLayers.length === 0 ? (
          <div className="text-center text-slate-500 py-8 px-3">
            Chưa có layer nào. Hãy mở ảnh hoặc thêm object sương.
          </div>
        ) : (
          reversedLayers.map((layer) => {
            const isSelected = layer.id === selectedLayerId;
            const fogGradient =
              layer.type === 'fog'
                ? `linear-gradient(135deg, ${normalizeStops(layer.stops)
                    .map((s) => `${hexToRgbaString(s.color, s.alpha)} ${Math.round(s.offset * 100)}%`)
                    .join(', ')})`
                : undefined;

            return (
              <div
                key={layer.id}
                onClick={() => setSelectedLayer(layer.id)}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500/70 text-slate-100'
                    : 'bg-[#12151b] border-transparent hover:border-slate-800 text-slate-300'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-8 h-8 rounded border border-slate-700 checker-sm overflow-hidden shrink-0 flex items-center justify-center">
                  {layer.type === 'image' ? (
                    <img
                      src={layer.src}
                      alt={layer.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ background: fogGradient }}
                    />
                  )}
                </div>

                {/* Name + Alpha badge */}
                <div className="flex-1 min-w-0">
                  {editingId === layer.id ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => {
                        if (draftName.trim()) {
                          updateLayer(layer.id, { name: draftName.trim() }, true);
                        }
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (draftName.trim()) {
                            updateLayer(layer.id, { name: draftName.trim() }, true);
                          }
                          setEditingId(null);
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      className="w-full bg-[#0f1115] border border-blue-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingId(layer.id);
                        setDraftName(layer.name);
                      }}
                      className="truncate font-medium"
                    >
                      {layer.name}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span>{layer.type === 'fog' ? 'Sương mờ' : 'Ảnh'}</span>
                    {layer.opacity < 1 && (
                      <span className="text-cyan-400 font-mono">
                        α {Math.round(layer.opacity * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick actions */}
                <div
                  className="flex items-center gap-0.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => moveLayerOrder(layer.id, 'up')}
                    title="Đưa lên tầng trên"
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100 opacity-70 group-hover:opacity-100"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLayerOrder(layer.id, 'down')}
                    title="Đưa xuống tầng dưới"
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100 opacity-70 group-hover:opacity-100"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateLayer(layer.id, { visible: !layer.visible }, true)
                    }
                    title={layer.visible ? 'Ẩn layer' : 'Hiện layer'}
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100"
                  >
                    {layer.visible ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-slate-600" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateLayer(layer.id, { locked: !layer.locked }, true)
                    }
                    title={layer.locked ? 'Mở khóa' : 'Khóa'}
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100"
                  >
                    {layer.locked ? (
                      <Lock className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Unlock className="w-3 h-3 opacity-60" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateLayer(layer.id)}
                    title="Nhân bản (Ctrl+D)"
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100 hidden group-hover:inline-flex"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteLayer(layer.id)}
                    title="Xóa layer (Delete)"
                    className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
