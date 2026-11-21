import React from 'react';
import { ArrowRight, Pipette, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { ImageAdjustments, ImageLayer } from '../../types/editor';
import { useEditorStore } from '../../store/useEditorStore';
import {
  createDefaultImageAdjustments,
  hasActiveAdjustments,
} from '../../utils/imageFilters';

interface ImageAdjustmentsPanelProps {
  layer: ImageLayer;
}

interface SliderItem {
  key: keyof Omit<ImageAdjustments, 'colorEdits'>;
  label: string;
  min: number;
  max: number;
  accentClass: string;
}

const SLIDERS: SliderItem[] = [
  { key: 'brightness', label: 'Độ sáng (Brightness)', min: -100, max: 100, accentClass: 'accent-amber-400' },
  { key: 'contrast', label: 'Tương phản (Contrast)', min: -100, max: 100, accentClass: 'accent-amber-400' },
  { key: 'temperature', label: 'White Balance (Lạnh ↔ Ấm)', min: -100, max: 100, accentClass: 'accent-orange-400' },
  { key: 'tint', label: 'White Balance (Xanh ↔ Hồng)', min: -100, max: 100, accentClass: 'accent-pink-400' },
  { key: 'vibrance', label: 'Color Vibrance', min: -100, max: 100, accentClass: 'accent-cyan-400' },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, accentClass: 'accent-blue-500' },
];

export const ImageAdjustmentsPanel: React.FC<ImageAdjustmentsPanelProps> = ({
  layer,
}) => {
  const {
    updateImageAdjustments,
    resetImageAdjustments,
    addColorEditRule,
    updateColorEditRule,
    removeColorEditRule,
    startColorEditEyedropper,
    pushHistory,
  } = useEditorStore();

  const adj = layer.adjustments ?? createDefaultImageAdjustments();
  const modified = hasActiveAdjustments(adj);

  return (
    <div className="space-y-3.5 pt-3 border-t border-slate-800 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Chỉnh màu & Ánh sáng
        </span>
        {modified && (
          <button
            type="button"
            onClick={() => resetImageAdjustments(layer.id)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Sliders */}
      <div className="space-y-2.5">
        {SLIDERS.map((s) => {
          const val = adj[s.key];
          return (
            <div key={s.key}>
              <div className="flex items-center justify-between text-slate-300 mb-0.5">
                <span>{s.label}</span>
                <button
                  type="button"
                  title="Double-click hoặc click để đặt lại 0"
                  onClick={() =>
                    val !== 0 &&
                    updateImageAdjustments(layer.id, { [s.key]: 0 }, true)
                  }
                  className={`font-mono text-[11px] ${
                    val !== 0 ? 'text-blue-300 hover:underline' : 'text-slate-500'
                  }`}
                >
                  {val > 0 ? `+${val}` : val}
                </button>
              </div>
              <input
                type="range"
                aria-label={s.label}
                min={s.min}
                max={s.max}
                value={val}
                onPointerDown={pushHistory}
                onChange={(e) =>
                  updateImageAdjustments(
                    layer.id,
                    { [s.key]: Number(e.target.value) },
                    false
                  )
                }
                className={`w-full ${s.accentClass}`}
              />
            </div>
          );
        })}
      </div>

      {/* Color Edit (Replace Color) */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-medium">Color Edit (Thay màu)</span>
          <button
            type="button"
            onClick={() => addColorEditRule(layer.id)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
          >
            <Plus className="w-3 h-3" /> Thêm màu
          </button>
        </div>

        {adj.colorEdits.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            Chưa có quy tắc thay màu nào. Nhấn &quot;+ Thêm màu&quot; để thay một màu trong ảnh bằng màu khác.
          </p>
        ) : (
          <div className="space-y-2">
            {adj.colorEdits.map((rule) => (
              <div
                key={rule.id}
                className="bg-[#0f1115] border border-slate-800 rounded-lg p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-1.5">
                  {/* Source color + Eyedropper */}
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      aria-label="Màu gốc"
                      value={rule.sourceColor}
                      onChange={(e) =>
                        updateColorEditRule(
                          layer.id,
                          rule.id,
                          { sourceColor: e.target.value },
                          true
                        )
                      }
                      className="w-7 h-7 bg-transparent rounded border border-slate-700 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        startColorEditEyedropper(layer.id, rule.id, 'sourceColor')
                      }
                      title="Hút màu gốc từ ảnh"
                      className="p-1.5 rounded bg-slate-800 hover:bg-blue-600 text-slate-200"
                    >
                      <Pipette className="w-3 h-3" />
                    </button>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />

                  {/* Target color + Eyedropper */}
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      aria-label="Màu mới"
                      value={rule.targetColor}
                      onChange={(e) =>
                        updateColorEditRule(
                          layer.id,
                          rule.id,
                          { targetColor: e.target.value },
                          true
                        )
                      }
                      className="w-7 h-7 bg-transparent rounded border border-slate-700 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        startColorEditEyedropper(layer.id, rule.id, 'targetColor')
                      }
                      title="Hút màu đích từ ảnh"
                      className="p-1.5 rounded bg-slate-800 hover:bg-blue-600 text-slate-200"
                    >
                      <Pipette className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeColorEditRule(layer.id, rule.id)}
                    title="Xóa quy tắc thay màu"
                    className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Độ dung sai (Tolerance)</span>
                    <span className="font-mono">{rule.tolerance}%</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={rule.tolerance}
                    onPointerDown={pushHistory}
                    onChange={(e) =>
                      updateColorEditRule(
                        layer.id,
                        rule.id,
                        { tolerance: Number(e.target.value) },
                        false
                      )
                    }
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Độ mượt biên (Softness)</span>
                    <span className="font-mono">{rule.softness}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={rule.softness}
                    onPointerDown={pushHistory}
                    onChange={(e) =>
                      updateColorEditRule(
                        layer.id,
                        rule.id,
                        { softness: Number(e.target.value) },
                        false
                      )
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
