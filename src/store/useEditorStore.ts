import { create } from 'zustand';
import type {
  AlphaPreviewMode,
  CanvasConfig,
  ColorEditRule,
  CropRect,
  EditorSnapshot,
  EyedropperTarget,
  FogLayer,
  GradientStop,
  ImageAdjustments,
  ImageLayer,
  Layer,
  ToolType,
} from '../types/editor';
import { createDefaultImageAdjustments } from '../utils/imageFilters';
import {
  clamp,
  computeAspectCropRect,
  scaleLayersForResize,
  translateLayersForCrop,
} from '../utils/geometry';
import { FOG_PRESETS } from '../utils/fogPresets';
import type { LoadedImageData } from '../utils/fileHelpers';

const MAX_HISTORY = 50;

let idCounter = 1;
export function generateId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function cloneSnapshot(
  canvas: CanvasConfig,
  layers: Layer[],
  selectedLayerId: string | null
): EditorSnapshot {
  return {
    canvas: { ...canvas },
    layers: layers.map((l) =>
      l.type === 'fog'
        ? { ...l, stops: l.stops.map((s) => ({ ...s })) }
        : {
            ...l,
            adjustments: l.adjustments
              ? {
                  ...l.adjustments,
                  colorEdits: l.adjustments.colorEdits.map((c) => ({ ...c })),
                }
              : createDefaultImageAdjustments(),
          }
    ),
    selectedLayerId,
  };
}

export interface EditorState {
  canvas: CanvasConfig;
  layers: Layer[];
  selectedLayerId: string | null;
  activeTool: ToolType;
  zoom: number;
  alphaPreviewMode: AlphaPreviewMode;
  cropRect: CropRect | null;
  cropAspect: number | null;
  eyedropperTarget: EyedropperTarget | null;

  past: EditorSnapshot[];
  future: EditorSnapshot[];

  // History actions
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Canvas & file actions
  newCanvas: (width: number, height: number, backgroundColor: string | null) => void;
  setCanvasBackground: (backgroundColor: string | null) => void;
  openImageAsCanvas: (img: LoadedImageData) => void;
  insertImages: (imgs: LoadedImageData[]) => void;
  resizeCanvas: (newWidth: number, newHeight: number, scaleContent: boolean) => void;

  // Crop actions
  enterCropMode: () => void;
  cancelCropMode: () => void;
  setCropRect: (rect: CropRect) => void;
  setCropAspect: (aspect: number | null) => void;
  applyCrop: () => void;

  // Layer actions
  addFogLayer: (presetId?: string) => void;
  applyFogPreset: (layerId: string, presetId: string) => void;
  updateLayer: (id: string, patch: Partial<Layer>, recordHistory?: boolean) => void;
  updateFogStop: (
    layerId: string,
    stopId: string,
    patch: Partial<GradientStop>,
    recordHistory?: boolean
  ) => void;
  addFogStop: (layerId: string) => void;
  removeFogStop: (layerId: string, stopId: string) => void;
  updateImageAdjustments: (
    layerId: string,
    patch: Partial<ImageAdjustments>,
    recordHistory?: boolean
  ) => void;
  resetImageAdjustments: (layerId: string) => void;
  addColorEditRule: (layerId: string) => void;
  updateColorEditRule: (
    layerId: string,
    ruleId: string,
    patch: Partial<ColorEditRule>,
    recordHistory?: boolean
  ) => void;
  removeColorEditRule: (layerId: string, ruleId: string) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  moveLayerOrder: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  setSelectedLayer: (id: string | null) => void;

  // UI & tool actions
  setActiveTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setAlphaPreviewMode: (mode: AlphaPreviewMode) => void;
  startEyedropper: (layerId: string, stopId: string) => void;
  startColorEditEyedropper: (
    layerId: string,
    ruleId: string,
    field: 'sourceColor' | 'targetColor'
  ) => void;
  pickEyedropperColor: (hex: string) => void;
  cancelEyedropper: () => void;
}

const DEFAULT_CANVAS: CanvasConfig = {
  width: 1280,
  height: 720,
  backgroundColor: null,
};

export const useEditorStore = create<EditorState>((set, get) => ({
  canvas: DEFAULT_CANVAS,
  layers: [],
  selectedLayerId: null,
  activeTool: 'select',
  zoom: 1,
  alphaPreviewMode: 'checker-dark',
  cropRect: null,
  cropAspect: null,
  eyedropperTarget: null,
  past: [],
  future: [],

  pushHistory: () => {
    const { canvas, layers, selectedLayerId, past } = get();
    const snap = cloneSnapshot(canvas, layers, selectedLayerId);
    const nextPast = [...past, snap].slice(-MAX_HISTORY);
    set({ past: nextPast, future: [] });
  },

  undo: () => {
    const { past, future, canvas, layers, selectedLayerId } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const currentSnap = cloneSnapshot(canvas, layers, selectedLayerId);
    set({
      canvas: prev.canvas,
      layers: prev.layers,
      selectedLayerId: prev.selectedLayerId,
      past: past.slice(0, -1),
      future: [currentSnap, ...future].slice(0, MAX_HISTORY),
      activeTool: 'select',
      cropRect: null,
      eyedropperTarget: null,
    });
  },

  redo: () => {
    const { past, future, canvas, layers, selectedLayerId } = get();
    if (future.length === 0) return;
    const next = future[0];
    const currentSnap = cloneSnapshot(canvas, layers, selectedLayerId);
    set({
      canvas: next.canvas,
      layers: next.layers,
      selectedLayerId: next.selectedLayerId,
      past: [...past, currentSnap].slice(-MAX_HISTORY),
      future: future.slice(1),
      activeTool: 'select',
      cropRect: null,
      eyedropperTarget: null,
    });
  },

  newCanvas: (width, height, backgroundColor) => {
    get().pushHistory();
    set({
      canvas: {
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
        backgroundColor,
      },
      layers: [],
      selectedLayerId: null,
      activeTool: 'select',
      cropRect: null,
      eyedropperTarget: null,
    });
  },

  setCanvasBackground: (backgroundColor) => {
    get().pushHistory();
    set((state) => ({
      canvas: { ...state.canvas, backgroundColor },
    }));
  },

  openImageAsCanvas: (img) => {
    get().pushHistory();
    const newLayer: ImageLayer = {
      id: generateId('img'),
      name: img.name || 'Background Image',
      type: 'image',
      src: img.src,
      naturalWidth: img.width,
      naturalHeight: img.height,
      cropX: 0,
      cropY: 0,
      cropWidth: img.width,
      cropHeight: img.height,
      x: 0,
      y: 0,
      width: img.width,
      height: img.height,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      lockAspectRatio: true,
      adjustments: createDefaultImageAdjustments(),
    };
    set({
      canvas: {
        width: Math.max(1, img.width),
        height: Math.max(1, img.height),
        backgroundColor: null,
      },
      layers: [newLayer],
      selectedLayerId: newLayer.id,
      activeTool: 'select',
      cropRect: null,
      eyedropperTarget: null,
    });
  },

  insertImages: (imgs) => {
    if (imgs.length === 0) return;
    get().pushHistory();
    const { canvas, layers } = get();
    const added: ImageLayer[] = imgs.map((img, idx) => {
      // Fit within 75% of canvas if larger than canvas
      let w = img.width;
      let h = img.height;
      const maxW = canvas.width * 0.75;
      const maxH = canvas.height * 0.75;
      if (w > maxW || h > maxH) {
        const scale = Math.min(maxW / w, maxH / h);
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
      }
      const offset = idx * 24;
      return {
        id: generateId('img'),
        name: img.name || `Image ${layers.length + idx + 1}`,
        type: 'image',
        src: img.src,
        naturalWidth: img.width,
        naturalHeight: img.height,
        cropX: 0,
        cropY: 0,
        cropWidth: img.width,
        cropHeight: img.height,
        x: Math.round((canvas.width - w) / 2 + offset),
        y: Math.round((canvas.height - h) / 2 + offset),
        width: w,
        height: h,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        lockAspectRatio: true,
        adjustments: createDefaultImageAdjustments(),
      };
    });

    set({
      layers: [...layers, ...added],
      selectedLayerId: added[added.length - 1].id,
      activeTool: 'select',
    });
  },

  resizeCanvas: (newWidth, newHeight, scaleContent) => {
    const { canvas, layers } = get();
    const targetW = Math.max(1, Math.round(newWidth));
    const targetH = Math.max(1, Math.round(newHeight));
    get().pushHistory();
    set({
      canvas: { ...canvas, width: targetW, height: targetH },
      layers: scaleContent
        ? scaleLayersForResize(layers, canvas.width, canvas.height, targetW, targetH)
        : layers,
    });
  },

  enterCropMode: () => {
    const { canvas, cropAspect } = get();
    const rect = computeAspectCropRect(canvas.width, canvas.height, cropAspect);
    set({
      activeTool: 'crop',
      cropRect: rect,
      eyedropperTarget: null,
    });
  },

  cancelCropMode: () => {
    set({
      activeTool: 'select',
      cropRect: null,
    });
  },

  setCropRect: (rect) => {
    set({ cropRect: rect });
  },

  setCropAspect: (aspect) => {
    const { canvas } = get();
    const rect = computeAspectCropRect(canvas.width, canvas.height, aspect);
    set({ cropAspect: aspect, cropRect: rect });
  },

  applyCrop: () => {
    const { cropRect, canvas, layers } = get();
    if (!cropRect) return;
    get().pushHistory();
    set({
      canvas: {
        ...canvas,
        width: Math.max(1, Math.round(cropRect.width)),
        height: Math.max(1, Math.round(cropRect.height)),
      },
      layers: translateLayersForCrop(layers, cropRect),
      activeTool: 'select',
      cropRect: null,
    });
  },

  addFogLayer: (presetId = 'white-mist') => {
    get().pushHistory();
    const { canvas, layers } = get();
    const preset = FOG_PRESETS.find((p) => p.id === presetId) ?? FOG_PRESETS[0];

    const w = Math.max(60, Math.round(canvas.width * 0.65));
    const h = Math.max(60, Math.round(canvas.height * 0.45));

    const fog: FogLayer = {
      id: generateId('fog'),
      name: `Sương mờ ${layers.filter((l) => l.type === 'fog').length + 1}`,
      type: 'fog',
      x: Math.round((canvas.width - w) / 2),
      y: Math.round((canvas.height - h) / 2),
      width: w,
      height: h,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      lockAspectRatio: false,
      blurRadius: preset.config.blurRadius ?? 24,
      colorIntensity: preset.config.colorIntensity ?? 0.85,
      gradientType: preset.config.gradientType ?? 'linear',
      angle: preset.config.angle ?? 180,
      gradientSpread: preset.config.gradientSpread ?? 1,
      radialCenterX: preset.config.radialCenterX ?? 0.5,
      radialCenterY: preset.config.radialCenterY ?? 0.5,
      radialInnerRadius: preset.config.radialInnerRadius ?? 0.2,
      radialOuterRadius: preset.config.radialOuterRadius ?? 0.95,
      blurFollowsAlpha: preset.config.blurFollowsAlpha ?? true,
      borderRadius: preset.config.borderRadius ?? 0,
      stops: preset.config.stops.map((s) => ({
        ...s,
        id: generateId('stop'),
      })),
    };

    set({
      layers: [...layers, fog],
      selectedLayerId: fog.id,
      activeTool: 'select',
    });
  },

  applyFogPreset: (layerId, presetId) => {
    const preset = FOG_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    get().pushHistory();
    set((state) => ({
      layers: state.layers.map((layer) => {
        if (layer.id !== layerId || layer.type !== 'fog') return layer;
        return {
          ...layer,
          ...preset.config,
          stops: preset.config.stops.map((s) => ({
            ...s,
            id: generateId('stop'),
          })),
        };
      }),
    }));
  },

  updateLayer: (id, patch, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? ({ ...layer, ...patch } as Layer) : layer
      ),
    }));
  },

  updateFogStop: (layerId, stopId, patch, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      layers: state.layers.map((layer) => {
        if (layer.id !== layerId || layer.type !== 'fog') return layer;
        return {
          ...layer,
          stops: layer.stops.map((s) => (s.id === stopId ? { ...s, ...patch } : s)),
        };
      }),
    }));
  },

  addFogStop: (layerId) => {
    get().pushHistory();
    set((state) => ({
      layers: state.layers.map((layer) => {
        if (layer.id !== layerId || layer.type !== 'fog') return layer;
        const newStop: GradientStop = {
          id: generateId('stop'),
          offset: 0.5,
          color: layer.stops[layer.stops.length - 1]?.color ?? '#ffffff',
          alpha: 0.5,
        };
        return {
          ...layer,
          stops: [...layer.stops, newStop],
        };
      }),
    }));
  },

  removeFogStop: (layerId, stopId) => {
    get().pushHistory();
    set((state) => ({
      layers: state.layers.map((layer) => {
        if (layer.id !== layerId || layer.type !== 'fog') return layer;
        if (layer.stops.length <= 2) return layer;
        return {
          ...layer,
          stops: layer.stops.filter((s) => s.id !== stopId),
        };
      }),
    }));
  },

  updateImageAdjustments: (layerId, patch, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      layers: state.layers.map((layer) => {
        if (layer.id !== layerId || layer.type !== 'image') return layer;
        const current = layer.adjustments ?? createDefaultImageAdjustments();
        return {
          ...layer,
          adjustments: { ...current, ...patch },
        };
      }),
    }));
  },

  resetImageAdjustments: (layerId) => {
    get().pushHistory();
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === layerId && layer.type === 'image'
          ? { ...layer, adjustments: createDefaultImageAdjustments() }
          : layer
      ),
    }));
  },

  addColorEditRule: (layerId) => {
    get().pushHistory();
    set((state) => ({
      layers: state.layers.map((layer) => {
        if (layer.id !== layerId || layer.type !== 'image') return layer;
        const current = layer.adjustments ?? createDefaultImageAdjustments();
        const rule: ColorEditRule = {
          id: generateId('cedit'),
          sourceColor: '#3b82f6',
          targetColor: '#10b981',
          tolerance: 28,
          softness: 15,
        };
        return {
          ...layer,
          adjustments: {
            ...current,
            colorEdits: [...current.colorEdits, rule],
          },
        };
      }),
    }));
  },

  updateColorEditRule: (layerId, ruleId, patch, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      layers: state.layers.map((layer) => {
        if (layer.id !== layerId || layer.type !== 'image') return layer;
        const current = layer.adjustments ?? createDefaultImageAdjustments();
        return {
          ...layer,
          adjustments: {
            ...current,
            colorEdits: current.colorEdits.map((r) =>
              r.id === ruleId ? { ...r, ...patch } : r
            ),
          },
        };
      }),
    }));
  },

  removeColorEditRule: (layerId, ruleId) => {
    get().pushHistory();
    set((state) => ({
      layers: state.layers.map((layer) => {
        if (layer.id !== layerId || layer.type !== 'image') return layer;
        const current = layer.adjustments ?? createDefaultImageAdjustments();
        return {
          ...layer,
          adjustments: {
            ...current,
            colorEdits: current.colorEdits.filter((r) => r.id !== ruleId),
          },
        };
      }),
    }));
  },

  deleteLayer: (id) => {
    get().pushHistory();
    set((state) => {
      const nextLayers = state.layers.filter((l) => l.id !== id);
      const nextSelected =
        state.selectedLayerId === id
          ? nextLayers[nextLayers.length - 1]?.id ?? null
          : state.selectedLayerId;
      return {
        layers: nextLayers,
        selectedLayerId: nextSelected,
        eyedropperTarget:
          state.eyedropperTarget?.layerId === id ? null : state.eyedropperTarget,
      };
    });
  },

  duplicateLayer: (id) => {
    const target = get().layers.find((l) => l.id === id);
    if (!target) return;
    get().pushHistory();
    const copy: Layer =
      target.type === 'fog'
        ? {
            ...target,
            id: generateId('fog'),
            name: `${target.name} (Copy)`,
            x: target.x + 20,
            y: target.y + 20,
            stops: target.stops.map((s) => ({ ...s, id: generateId('stop') })),
          }
        : {
            ...target,
            id: generateId('img'),
            name: `${target.name} (Copy)`,
            x: target.x + 20,
            y: target.y + 20,
            adjustments: target.adjustments
              ? {
                  ...target.adjustments,
                  colorEdits: target.adjustments.colorEdits.map((c) => ({
                    ...c,
                    id: generateId('cedit'),
                  })),
                }
              : createDefaultImageAdjustments(),
          };

    set((state) => {
      const idx = state.layers.findIndex((l) => l.id === id);
      const next = [...state.layers];
      next.splice(idx + 1, 0, copy);
      return {
        layers: next,
        selectedLayerId: copy.id,
      };
    });
  },

  moveLayerOrder: (id, direction) => {
    const { layers } = get();
    const idx = layers.findIndex((l) => l.id === id);
    if (idx === -1) return;

    let targetIdx = idx;
    if (direction === 'up') targetIdx = Math.min(layers.length - 1, idx + 1);
    if (direction === 'down') targetIdx = Math.max(0, idx - 1);
    if (direction === 'top') targetIdx = layers.length - 1;
    if (direction === 'bottom') targetIdx = 0;

    if (targetIdx === idx) return;

    get().pushHistory();
    const next = [...layers];
    const [item] = next.splice(idx, 1);
    next.splice(targetIdx, 0, item);
    set({ layers: next });
  },

  setSelectedLayer: (id) => set({ selectedLayerId: id }),

  setActiveTool: (tool) =>
    set((state) => ({
      activeTool: tool,
      eyedropperTarget: tool === 'eyedropper' ? state.eyedropperTarget : null,
      cropRect: tool === 'crop' ? state.cropRect : null,
    })),

  setZoom: (zoom) => set({ zoom: clamp(zoom, 0.1, 5) }),

  setAlphaPreviewMode: (mode) => set({ alphaPreviewMode: mode }),

  startEyedropper: (layerId, stopId) =>
    set({
      activeTool: 'eyedropper',
      eyedropperTarget: { kind: 'fog-stop', layerId, stopId },
    }),

  startColorEditEyedropper: (layerId, ruleId, field) =>
    set({
      activeTool: 'eyedropper',
      eyedropperTarget: { kind: 'color-edit', layerId, ruleId, field },
    }),

  pickEyedropperColor: (hex) => {
    const { eyedropperTarget } = get();
    if (!eyedropperTarget) return;
    if (eyedropperTarget.kind === 'fog-stop') {
      get().updateFogStop(
        eyedropperTarget.layerId,
        eyedropperTarget.stopId,
        { color: hex },
        true
      );
    } else {
      get().updateColorEditRule(
        eyedropperTarget.layerId,
        eyedropperTarget.ruleId,
        { [eyedropperTarget.field]: hex },
        true
      );
    }
    set({
      activeTool: 'select',
      eyedropperTarget: null,
    });
  },

  cancelEyedropper: () =>
    set({
      activeTool: 'select',
      eyedropperTarget: null,
    }),
}));
