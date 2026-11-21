import React, { useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Pipette, Plus, Trash2 } from 'lucide-react';
import type { FogLayer } from '../../types/editor';
import { useEditorStore } from '../../store/useEditorStore';
import { FOG_PRESETS } from '../../utils/fogPresets';
import {
  computeSmoothFadeStops,
  getActiveFadeEdges,
  hexToRgbaString,
  normalizeStops,
} from '../../utils/fogRenderer';

interface FogControlsProps {
  layer: FogLayer;
}

const QUICK_ANGLES = [0, 45, 90, 180, 270];

export const FogControls: React.FC<FogControlsProps> = ({ layer }) => {
  const {
    canvas,
    updateLayer,
    updateFogStop,
    addFogStop,
    removeFogStop,
    applyFogPreset,
    startEyedropper,
    startFogFadeEyedropper,
    pushHistory,
  } = useEditorStore();

  const [selectedStopId, setSelectedStopId] = useState<string>(
    layer.stops[0]?.id ?? ''
  );

  useEffect(() => {
    if (!layer.stops.some((s) => s.id === selectedStopId)) {
      setSelectedStopId(layer.stops[0]?.id ?? '');
    }
  }, [layer.stops, selectedStopId]);

  const activeStop = layer.stops.find((s) => s.id === selectedStopId) ?? layer.stops[0];
  const sortedStops = normalizeStops(layer.stops);

  const gradientBarCss = `linear-gradient(90deg, ${sortedStops
    .map((s) => `${hexToRgbaString(s.color, s.alpha)} ${Math.round(s.offset * 100)}%`)
    .join(', ')})`;

  const applyAspectPreset = (ratio: number | 'full') => {
    if (ratio === 'full') {
      updateLayer(
        layer.id,
        {
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
          rotation: 0,
        },
        true
      );
      return;
    }
    const newH = Math.max(16, Math.round(layer.width / ratio));
    updateLayer(layer.id, { height: newH, lockAspectRatio: true }, true);
  };

  return (
    <div className="space-y-4 pt-3 border-t border-slate-800 text-xs">
      {/* Aspect Ratio & Size Presets for Fog */}
      <div>
        <div className="text-[11px] font-medium text-slate-400 mb-1.5">
          Tỉ lệ khung Sương (Aspect Ratio)
        </div>
        <div className="grid grid-cols-6 gap-1">
          {[
            { label: 'Free', val: null },
            { label: '1:1', val: 1 },
            { label: '16:9', val: 16 / 9 },
            { label: '4:3', val: 4 / 3 },
            { label: '2:1', val: 2 },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.val === null) {
                  updateLayer(layer.id, { lockAspectRatio: false }, true);
                } else {
                  applyAspectPreset(item.val);
                }
              }}
              className="py-1 rounded bg-[#0f1115] border border-slate-800 hover:border-blue-500/60 text-slate-300 text-[10px]"
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => applyAspectPreset('full')}
            title="Phủ kín toàn bộ Canvas"
            className="py-1 rounded bg-[#0f1115] border border-slate-800 hover:border-blue-500/60 text-cyan-300 text-[10px]"
          >
            Full
          </button>
        </div>
      </div>

      {/* 1-Click Fog Presets */}
      <div>
        <div className="text-[11px] font-medium text-slate-400 mb-1.5">
          Mẫu Sương nhanh (Presets)
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {FOG_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyFogPreset(layer.id, preset.id)}
              title={preset.label}
              className="group flex flex-col items-center gap-1"
            >
              <div className="w-full h-7 rounded border border-slate-700 group-hover:border-blue-400 overflow-hidden checker-sm">
                <div className="w-full h-full" style={{ background: preset.previewCss }} />
              </div>
              <span className="text-[10px] text-slate-400 group-hover:text-slate-200 truncate w-full text-center">
                {preset.label.split(' ')[1] || preset.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Blur & Intensity */}
      <div className="space-y-2.5">
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>Độ mờ nền (Blur)</span>
            <span className="font-mono text-slate-400">{layer.blurRadius}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={80}
            value={layer.blurRadius}
            onPointerDown={pushHistory}
            onChange={(e) =>
              updateLayer(layer.id, { blurRadius: Number(e.target.value) }, false)
            }
            className="w-full accent-cyan-400"
          />
        </div>

        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>Mức độ phủ màu sương</span>
            <span className="font-mono text-slate-400">
              {Math.round(layer.colorIntensity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={layer.colorIntensity}
            onPointerDown={pushHistory}
            onChange={(e) =>
              updateLayer(layer.id, { colorIntensity: Number(e.target.value) }, false)
            }
            className="w-full accent-cyan-400"
          />
        </div>

        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={layer.blurFollowsAlpha}
            onChange={(e) =>
              updateLayer(layer.id, { blurFollowsAlpha: e.target.checked }, true)
            }
            className="accent-cyan-400"
          />
          <span>Mờ nền tan dần theo độ trong suốt gradient</span>
        </label>
      </div>

      {/* Gradient Type, Direction & Distance */}
      <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-medium">Kiểu Gradient</span>
          <div className="flex bg-[#0f1115] rounded-md p-0.5 border border-slate-800">
            {(
              [
                { id: 'linear', label: 'Linear' },
                { id: 'radial', label: 'Radial' },
                { id: 'smooth-fade', label: 'Smooth Fade' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => updateLayer(layer.id, { gradientType: t.id }, true)}
                className={`px-2 py-0.5 rounded text-[11px] ${
                  layer.gradientType === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {layer.gradientType === 'smooth-fade' ? (
          (() => {
            const activeEdges = getActiveFadeEdges(layer);
            const hasVertical =
              activeEdges.includes('bottom') || activeEdges.includes('top');
            const hasHorizontal =
              activeEdges.includes('left') || activeEdges.includes('right');
            const span =
              hasVertical && hasHorizontal
                ? Math.max(layer.width, layer.height)
                : hasHorizontal
                ? layer.width
                : layer.height;

            const fadeOffset = layer.fadeOffset ?? 0;
            const fadeHeight = layer.fadeHeight ?? 90;
            const fadeColor = layer.fadeColor ?? '#ffffff';
            const fadeAlpha = layer.fadeAlpha ?? 1;
            const fadeStops = computeSmoothFadeStops(span, fadeOffset, fadeHeight);
            const previewCss = `linear-gradient(90deg, ${fadeStops
              .map(
                (st) =>
                  `${hexToRgbaString(fadeColor, st.alpha * fadeAlpha)} ${Math.round(
                    st.level * 100
                  )}%`
              )
              .join(', ')})`;

            const toggleEdge = (edgeId: 'bottom' | 'top' | 'left' | 'right') => {
              const exists = activeEdges.includes(edgeId);
              const nextEdges = exists
                ? activeEdges.filter((e) => e !== edgeId)
                : [...activeEdges, edgeId];
              updateLayer(layer.id, { fadeEdges: nextEdges }, true);
            };

            return (
              <div className="space-y-2.5 bg-[#0f1115] border border-slate-800 rounded-lg p-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400">
                      Chọn cạnh mờ (chọn nhiều)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateLayer(
                          layer.id,
                          {
                            fadeEdges:
                              activeEdges.length === 4
                                ? ['bottom']
                                : ['bottom', 'top', 'left', 'right'],
                          },
                          true
                        )
                      }
                      className="text-[10px] text-blue-400 hover:text-blue-300"
                    >
                      {activeEdges.length === 4 ? 'Chỉ Dưới' : 'Chọn cả 4'}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        { id: 'bottom', label: 'Dưới ↑' },
                        { id: 'top', label: 'Trên ↓' },
                        { id: 'left', label: 'Trái →' },
                        { id: 'right', label: 'Phải ←' },
                      ] as const
                    ).map((e) => {
                      const isActive = activeEdges.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => toggleEdge(e.id)}
                          className={`py-1 rounded border text-[10px] transition ${
                            isActive
                              ? 'bg-blue-600/25 border-blue-500 text-blue-200 font-medium'
                              : 'bg-[#181b22] border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {e.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preview bar */}
                <div className="h-4 rounded border border-slate-700 checker-sm overflow-hidden">
                  <div className="w-full h-full" style={{ background: previewCss }} />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>Khoảng cắt hẳn (Bottom / Offset)</span>
                    <span className="font-mono text-slate-400">{fadeOffset} px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      aria-label="Khoảng cắt hẳn (Bottom / Offset)"
                      min={0}
                      max={Math.max(10, Math.round(span))}
                      value={fadeOffset}
                      onPointerDown={pushHistory}
                      onChange={(e) =>
                        updateLayer(
                          layer.id,
                          { fadeOffset: Number(e.target.value) },
                          false
                        )
                      }
                      className="flex-1 accent-blue-500"
                    />
                    <input
                      type="number"
                      min={0}
                      max={Math.max(10, Math.round(span))}
                      value={fadeOffset}
                      onChange={(e) =>
                        updateLayer(
                          layer.id,
                          { fadeOffset: Math.max(0, Number(e.target.value) || 0) },
                          true
                        )
                      }
                      className="w-14 bg-[#181b22] border border-slate-700 rounded px-1.5 py-0.5 font-mono text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>Độ dài vùng mờ SmoothStep (Height)</span>
                    <span className="font-mono text-slate-400">{fadeHeight} px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      aria-label="Độ dài vùng mờ SmoothStep (Height)"
                      min={0}
                      max={Math.max(10, Math.round(span))}
                      value={fadeHeight}
                      onPointerDown={pushHistory}
                      onChange={(e) =>
                        updateLayer(
                          layer.id,
                          { fadeHeight: Number(e.target.value) },
                          false
                        )
                      }
                      className="flex-1 accent-cyan-400"
                    />
                    <input
                      type="number"
                      min={0}
                      max={Math.max(10, Math.round(span))}
                      value={fadeHeight}
                      onChange={(e) =>
                        updateLayer(
                          layer.id,
                          { fadeHeight: Math.max(0, Number(e.target.value) || 0) },
                          true
                        )
                      }
                      className="w-14 bg-[#181b22] border border-slate-700 rounded px-1.5 py-0.5 font-mono text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={fadeColor}
                    onChange={(e) =>
                      updateLayer(layer.id, { fadeColor: e.target.value }, true)
                    }
                    className="w-24 bg-[#181b22] border border-slate-700 rounded px-2 py-1 font-mono text-slate-100 uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => startFogFadeEyedropper(layer.id)}
                    title="Hút màu trực tiếp từ ảnh"
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-blue-600 text-slate-200 transition"
                  >
                    <Pipette className="w-3.5 h-3.5" />
                    <span>Hút màu</span>
                  </button>
                </div>

                <div onPointerDown={pushHistory}>
                  <HexColorPicker
                    color={fadeColor}
                    onChange={(color) =>
                      updateLayer(layer.id, { fadeColor: color }, false)
                    }
                    style={{ width: '100%', height: '96px' }}
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>Alpha vùng đục</span>
                    <span className="font-mono text-slate-400">
                      {Math.round(fadeAlpha * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={fadeAlpha}
                    onPointerDown={pushHistory}
                    onChange={(e) =>
                      updateLayer(
                        layer.id,
                        { fadeAlpha: Number(e.target.value) },
                        false
                      )
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>
            );
          })()
        ) : layer.gradientType === 'linear' ? (
          <>
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Góc hướng (Angle)</span>
                <span className="font-mono text-slate-400">{layer.angle}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={layer.angle}
                onPointerDown={pushHistory}
                onChange={(e) =>
                  updateLayer(layer.id, { angle: Number(e.target.value) }, false)
                }
                className="w-full accent-blue-500 mb-1.5"
              />
              <div className="grid grid-cols-5 gap-1">
                {QUICK_ANGLES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => updateLayer(layer.id, { angle: a }, true)}
                    className={`py-0.5 rounded border text-[10px] ${
                      layer.angle === a
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-[#0f1115] border-slate-800 text-slate-400'
                    }`}
                  >
                    {a}°
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Khoảng cách trải Gradient</span>
                <span className="font-mono text-slate-400">
                  {Math.round(layer.gradientSpread * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={2}
                step={0.05}
                value={layer.gradientSpread}
                onPointerDown={pushHistory}
                onChange={(e) =>
                  updateLayer(layer.id, { gradientSpread: Number(e.target.value) }, false)
                }
                className="w-full accent-blue-500"
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Tâm X</span>
                  <span>{Math.round(layer.radialCenterX * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={layer.radialCenterX}
                  onPointerDown={pushHistory}
                  onChange={(e) =>
                    updateLayer(layer.id, { radialCenterX: Number(e.target.value) }, false)
                  }
                  className="w-full accent-blue-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Tâm Y</span>
                  <span>{Math.round(layer.radialCenterY * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={layer.radialCenterY}
                  onPointerDown={pushHistory}
                  onChange={(e) =>
                    updateLayer(layer.id, { radialCenterY: Number(e.target.value) }, false)
                  }
                  className="w-full accent-blue-500"
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>Bán kính trong (Inner)</span>
                <span className="font-mono text-slate-400">
                  {Math.round(layer.radialInnerRadius * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.9}
                step={0.02}
                value={layer.radialInnerRadius}
                onPointerDown={pushHistory}
                onChange={(e) =>
                  updateLayer(layer.id, { radialInnerRadius: Number(e.target.value) }, false)
                }
                className="w-full accent-blue-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>Bán kính ngoài (Outer / Khoảng cách)</span>
                <span className="font-mono text-slate-400">
                  {Math.round(layer.radialOuterRadius * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.5}
                step={0.02}
                value={layer.radialOuterRadius}
                onPointerDown={pushHistory}
                onChange={(e) =>
                  updateLayer(layer.id, { radialOuterRadius: Number(e.target.value) }, false)
                }
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Gradient Stops + Color Picker + Eyedropper (for Linear & Radial) */}
      {layer.gradientType !== 'smooth-fade' && (
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-medium">Điểm màu & Alpha Gradient</span>
          <button
            type="button"
            onClick={() => addFogStop(layer.id)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
          >
            <Plus className="w-3 h-3" /> Thêm điểm
          </button>
        </div>

        {/* Visual Gradient Bar */}
        <div className="h-5 rounded-md border border-slate-700 checker-sm overflow-hidden">
          <div className="w-full h-full" style={{ background: gradientBarCss }} />
        </div>

        {/* Stop pills */}
        <div className="flex flex-wrap gap-1.5">
          {sortedStops.map((stop, idx) => (
            <button
              key={stop.id}
              type="button"
              onClick={() => setSelectedStopId(stop.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] ${
                activeStop?.id === stop.id
                  ? 'border-blue-500 bg-blue-600/20 text-white'
                  : 'border-slate-800 bg-[#0f1115] text-slate-300'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full border border-white/40"
                style={{ backgroundColor: hexToRgbaString(stop.color, stop.alpha) }}
              />
              <span>#{idx + 1}</span>
              <span className="text-slate-400">{Math.round(stop.offset * 100)}%</span>
            </button>
          ))}
        </div>

        {/* Active Stop Editor */}
        {activeStop && (
          <div className="bg-[#0f1115] border border-slate-800 rounded-lg p-2.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={activeStop.color}
                  onChange={(e) =>
                    updateFogStop(layer.id, activeStop.id, { color: e.target.value }, true)
                  }
                  className="w-24 bg-[#181b22] border border-slate-700 rounded px-2 py-1 font-mono text-slate-100 uppercase"
                />
                <button
                  type="button"
                  onClick={() => startEyedropper(layer.id, activeStop.id)}
                  title="Hút màu trực tiếp từ ảnh (Eyedropper)"
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-blue-600 text-slate-200 transition"
                >
                  <Pipette className="w-3.5 h-3.5" />
                  <span>Hút màu</span>
                </button>
              </div>
              {layer.stops.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeFogStop(layer.id, activeStop.id)}
                  title="Xóa điểm màu này"
                  className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div onPointerDown={pushHistory}>
              <HexColorPicker
                color={activeStop.color}
                onChange={(color) =>
                  updateFogStop(layer.id, activeStop.id, { color }, false)
                }
                style={{ width: '100%', height: '110px' }}
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>Vị trí điểm (Position)</span>
                <span className="font-mono text-slate-400">
                  {Math.round(activeStop.offset * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={activeStop.offset}
                onPointerDown={pushHistory}
                onChange={(e) =>
                  updateFogStop(
                    layer.id,
                    activeStop.id,
                    { offset: Number(e.target.value) },
                    false
                  )
                }
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>Độ mờ điểm này (Stop Alpha)</span>
                <span className="font-mono text-slate-400">
                  {Math.round(activeStop.alpha * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={activeStop.alpha}
                onPointerDown={pushHistory}
                onChange={(e) =>
                  updateFogStop(
                    layer.id,
                    activeStop.id,
                    { alpha: Number(e.target.value) },
                    false
                  )
                }
                className="w-full accent-cyan-400"
              />
            </div>
          </div>
        )}
        </div>
      )}

      {/* Border Radius */}
      <div>
        <div className="flex justify-between text-slate-300 mb-1">
          <span>Bo góc (Border Radius)</span>
          <span className="font-mono text-slate-400">{layer.borderRadius}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={200}
          value={layer.borderRadius}
          onPointerDown={pushHistory}
          onChange={(e) =>
            updateLayer(layer.id, { borderRadius: Number(e.target.value) }, false)
          }
          className="w-full accent-blue-500"
        />
      </div>
    </div>
  );
};
