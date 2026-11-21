import React from 'react';
import {
  AlignCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  Lock,
  Maximize,
  MoveHorizontal,
  MoveVertical,
  Scaling,
  Unlock,
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { computeAspectDimensions, computeLayerFit } from '../../utils/geometry';
import { FogControls } from './FogControls';
import { ImageAdjustmentsPanel } from './ImageAdjustmentsPanel';

interface PropertiesPanelProps {
  onOpenResizeModal: () => void;
}

const ALPHA_PRESETS = [0.25, 0.5, 0.75, 1];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  onOpenResizeModal,
}) => {
  const {
    canvas,
    layers,
    selectedLayerId,
    updateLayer,
    setCanvasBackground,
    enterCropMode,
    pushHistory,
  } = useEditorStore();

  const layer = layers.find((l) => l.id === selectedLayerId) ?? null;

  if (!layer) {
    return (
      <div className="p-3.5 space-y-3 text-xs h-full overflow-y-auto">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Canvas Settings
        </div>
        <div className="flex items-center justify-between bg-[#0f1115] border border-slate-800 rounded-lg px-3 py-2">
          <span className="text-slate-400">Kích thước</span>
          <span className="font-mono text-slate-200">
            {canvas.width} × {canvas.height} px
          </span>
        </div>

        <div>
          <label className="block text-slate-400 mb-1.5">Nền Canvas</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCanvasBackground(null)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded border ${
                canvas.backgroundColor === null
                  ? 'border-blue-500 bg-blue-600/15 text-blue-200'
                  : 'border-slate-800 bg-[#0f1115] text-slate-300'
              }`}
            >
              <span className="w-3 h-3 rounded-xs checker-sm border border-slate-500" />
              Alpha
            </button>
            <button
              type="button"
              onClick={() =>
                setCanvasBackground(canvas.backgroundColor ?? '#111827')
              }
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded border ${
                canvas.backgroundColor !== null
                  ? 'border-blue-500 bg-blue-600/15 text-blue-200'
                  : 'border-slate-800 bg-[#0f1115] text-slate-300'
              }`}
            >
              Màu nền
            </button>
            {canvas.backgroundColor !== null && (
              <input
                type="color"
                value={canvas.backgroundColor}
                onChange={(e) => setCanvasBackground(e.target.value)}
                className="w-8 h-7 bg-transparent rounded border border-slate-700 cursor-pointer"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={enterCropMode}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            <Crop className="w-3.5 h-3.5" /> Crop
          </button>
          <button
            type="button"
            onClick={onOpenResizeModal}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            <Scaling className="w-3.5 h-3.5" /> Resize
          </button>
        </div>
      </div>
    );
  }

  const aspect = layer.width / Math.max(1, layer.height);

  const handleDimensionChange = (field: 'width' | 'height', value: number) => {
    const safeVal = Math.max(4, Math.round(value));
    if (layer.lockAspectRatio) {
      const next = computeAspectDimensions(field, safeVal, aspect);
      updateLayer(layer.id, next, true);
    } else {
      updateLayer(layer.id, { [field]: safeVal }, true);
    }
  };

  return (
    <div className="p-3.5 space-y-3.5 text-xs overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {layer.type === 'fog' ? 'Thuộc tính Sương mờ' : 'Thuộc tính Ảnh'}
        </span>
        <span className="text-[11px] text-slate-500 truncate max-w-[130px]">
          {layer.name}
        </span>
      </div>

      {/* Overall Object Alpha / Opacity */}
      <div className="bg-[#0f1115] border border-slate-800 rounded-lg p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-medium">Kênh Alpha (Opacity)</span>
          <span className="font-mono text-cyan-300">
            {Math.round(layer.opacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          aria-label="Kênh Alpha (Opacity)"
          min={0}
          max={1}
          step={0.01}
          value={layer.opacity}
          onPointerDown={pushHistory}
          onChange={(e) =>
            updateLayer(layer.id, { opacity: Number(e.target.value) }, false)
          }
          className="w-full accent-cyan-400"
        />
        <div className="grid grid-cols-4 gap-1">
          {ALPHA_PRESETS.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => updateLayer(layer.id, { opacity: val }, true)}
              className={`py-0.5 rounded text-[10px] border ${
                Math.abs(layer.opacity - val) < 0.01
                  ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-800 bg-[#181b22] text-slate-400 hover:text-slate-200'
              }`}
            >
              {val * 100}%
            </button>
          ))}
        </div>
      </div>

      {/* Transform */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-400">Vị trí & Kích thước</span>
          <button
            type="button"
            onClick={() =>
              updateLayer(layer.id, { lockAspectRatio: !layer.lockAspectRatio }, true)
            }
            title={layer.lockAspectRatio ? 'Đang khóa tỉ lệ' : 'Tự do tỉ lệ'}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
              layer.lockAspectRatio
                ? 'border-blue-500/60 bg-blue-600/15 text-blue-300'
                : 'border-slate-800 bg-[#0f1115] text-slate-400'
            }`}
          >
            {layer.lockAspectRatio ? (
              <Lock className="w-3 h-3" />
            ) : (
              <Unlock className="w-3 h-3" />
            )}
            Tỉ lệ
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center bg-[#0f1115] border border-slate-800 rounded px-2 py-1">
            <span className="text-slate-500 w-5">X</span>
            <input
              type="number"
              value={layer.x}
              onChange={(e) =>
                updateLayer(layer.id, { x: Number(e.target.value) || 0 }, true)
              }
              className="w-full bg-transparent text-slate-100 focus:outline-none font-mono"
            />
          </label>
          <label className="flex items-center bg-[#0f1115] border border-slate-800 rounded px-2 py-1">
            <span className="text-slate-500 w-5">Y</span>
            <input
              type="number"
              value={layer.y}
              onChange={(e) =>
                updateLayer(layer.id, { y: Number(e.target.value) || 0 }, true)
              }
              className="w-full bg-transparent text-slate-100 focus:outline-none font-mono"
            />
          </label>
          <label className="flex items-center bg-[#0f1115] border border-slate-800 rounded px-2 py-1">
            <span className="text-slate-500 w-5">W</span>
            <input
              type="number"
              min={4}
              value={layer.width}
              onChange={(e) =>
                handleDimensionChange('width', Number(e.target.value) || 4)
              }
              className="w-full bg-transparent text-slate-100 focus:outline-none font-mono"
            />
          </label>
          <label className="flex items-center bg-[#0f1115] border border-slate-800 rounded px-2 py-1">
            <span className="text-slate-500 w-5">H</span>
            <input
              type="number"
              min={4}
              value={layer.height}
              onChange={(e) =>
                handleDimensionChange('height', Number(e.target.value) || 4)
              }
              className="w-full bg-transparent text-slate-100 focus:outline-none font-mono"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center flex-1 bg-[#0f1115] border border-slate-800 rounded px-2 py-1">
            <span className="text-slate-500 mr-2">Xoay</span>
            <input
              type="number"
              value={layer.rotation}
              onChange={(e) =>
                updateLayer(layer.id, { rotation: Number(e.target.value) || 0 }, true)
              }
              className="w-full bg-transparent text-slate-100 focus:outline-none font-mono"
            />
            <span className="text-slate-500">°</span>
          </label>
          <button
            type="button"
            aria-label="Flip horizontal"
            title="Lật ngang (Flip horizontal)"
            aria-pressed={Boolean(layer.flipX)}
            onClick={() => updateLayer(layer.id, { flipX: !layer.flipX }, true)}
            className={`p-1.5 rounded transition ${
              layer.flipX
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <FlipHorizontal2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Flip vertical"
            title="Lật dọc (Flip vertical)"
            aria-pressed={Boolean(layer.flipY)}
            onClick={() => updateLayer(layer.id, { flipY: !layer.flipY }, true)}
            className={`p-1.5 rounded transition ${
              layer.flipY
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <FlipVertical2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              updateLayer(
                layer.id,
                {
                  x: Math.round((canvas.width - layer.width) / 2),
                  y: Math.round((canvas.height - layer.height) / 2),
                },
                true
              )
            }
            title="Căn giữa Canvas"
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              updateLayer(
                layer.id,
                { x: 0, y: 0, width: canvas.width, height: canvas.height, rotation: 0 },
                true
              )
            }
            title="Kéo giãn vừa khít Canvas"
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-6 gap-1 pt-0.5">
          <button
            type="button"
            aria-label="Align left"
            title="Căn trái (Align left)"
            onClick={() => updateLayer(layer.id, { x: 0 }, true)}
            className="flex items-center justify-center py-1.5 rounded bg-[#0f1115] border border-slate-800 hover:border-blue-500/60 hover:text-blue-300 text-slate-300 transition"
          >
            <AlignHorizontalJustifyStart className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Align right"
            title="Căn phải (Align right)"
            onClick={() =>
              updateLayer(layer.id, { x: Math.round(canvas.width - layer.width) }, true)
            }
            className="flex items-center justify-center py-1.5 rounded bg-[#0f1115] border border-slate-800 hover:border-blue-500/60 hover:text-blue-300 text-slate-300 transition"
          >
            <AlignHorizontalJustifyEnd className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Align top"
            title="Căn trên (Align top)"
            onClick={() => updateLayer(layer.id, { y: 0 }, true)}
            className="flex items-center justify-center py-1.5 rounded bg-[#0f1115] border border-slate-800 hover:border-blue-500/60 hover:text-blue-300 text-slate-300 transition"
          >
            <AlignVerticalJustifyStart className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Align bottom"
            title="Căn dưới (Align bottom)"
            onClick={() =>
              updateLayer(layer.id, { y: Math.round(canvas.height - layer.height) }, true)
            }
            className="flex items-center justify-center py-1.5 rounded bg-[#0f1115] border border-slate-800 hover:border-blue-500/60 hover:text-blue-300 text-slate-300 transition"
          >
            <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Fit width"
            title="Fit width (Resize vừa chiều rộng canvas)"
            onClick={() =>
              updateLayer(
                layer.id,
                computeLayerFit(layer, canvas.width, canvas.height, 'width'),
                true
              )
            }
            className="flex items-center justify-center py-1.5 rounded bg-[#0f1115] border border-slate-800 hover:border-cyan-500/60 hover:text-cyan-300 text-slate-300 transition"
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Fit height"
            title="Fit height (Resize vừa chiều cao canvas)"
            onClick={() =>
              updateLayer(
                layer.id,
                computeLayerFit(layer, canvas.width, canvas.height, 'height'),
                true
              )
            }
            className="flex items-center justify-center py-1.5 rounded bg-[#0f1115] border border-slate-800 hover:border-cyan-500/60 hover:text-cyan-300 text-slate-300 transition"
          >
            <MoveVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Fog-specific or Image-specific controls */}
      {layer.type === 'fog' ? (
        <FogControls layer={layer} />
      ) : (
        <ImageAdjustmentsPanel layer={layer} />
      )}
    </div>
  );
};
