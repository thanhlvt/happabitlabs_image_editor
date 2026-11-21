import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';

describe('useEditorStore', () => {
  beforeEach(() => {
    useEditorStore.setState({
      canvas: { width: 1280, height: 720, backgroundColor: null },
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
    });
  });

  it('creates a new canvas with custom size and transparent alpha background', () => {
    useEditorStore.getState().newCanvas(2600, 1080, null);
    const { canvas, layers, past } = useEditorStore.getState();
    expect(canvas).toEqual({ width: 2600, height: 1080, backgroundColor: null });
    expect(layers).toHaveLength(0);
    expect(past).toHaveLength(1);
  });

  it('opens an image as canvas and inserts additional images', () => {
    const store = useEditorStore.getState();
    store.openImageAsCanvas({
      src: 'data:image/png;base64,bg',
      name: 'Background',
      width: 1000,
      height: 500,
    });

    expect(useEditorStore.getState().canvas).toMatchObject({
      width: 1000,
      height: 500,
      backgroundColor: null,
    });
    expect(useEditorStore.getState().layers).toHaveLength(1);

    useEditorStore.getState().insertImages([
      {
        src: 'data:image/png;base64,overlay',
        name: 'Sticker',
        width: 200,
        height: 200,
      },
    ]);

    const { layers, selectedLayerId } = useEditorStore.getState();
    expect(layers).toHaveLength(2);
    expect(selectedLayerId).toBe(layers[1].id);
  });

  it('adds fog layer, updates alpha, supports eyedropper, and reorders layers', () => {
    const store = useEditorStore.getState();
    store.openImageAsCanvas({
      src: 'data:image/png;base64,bg',
      name: 'BG',
      width: 800,
      height: 600,
    });
    store.addFogLayer('white-mist');

    let state = useEditorStore.getState();
    expect(state.layers).toHaveLength(2);
    const fog = state.layers[1];
    expect(fog.type).toBe('fog');

    // Update layer alpha
    state.updateLayer(fog.id, { opacity: 0.45 }, true);
    expect(useEditorStore.getState().layers[1].opacity).toBe(0.45);

    // Eyedropper picks color for first stop
    if (fog.type === 'fog') {
      useEditorStore.getState().startEyedropper(fog.id, fog.stops[0].id);
      expect(useEditorStore.getState().activeTool).toBe('eyedropper');
      useEditorStore.getState().pickEyedropperColor('#38bdf8');
      const updatedFog = useEditorStore.getState().layers[1];
      if (updatedFog.type === 'fog') {
        expect(updatedFog.stops[0].color).toBe('#38bdf8');
      }
      expect(useEditorStore.getState().activeTool).toBe('select');
    }

    // Reorder fog layer down
    useEditorStore.getState().moveLayerOrder(fog.id, 'down');
    expect(useEditorStore.getState().layers[0].id).toBe(fog.id);

    // Drag-and-drop reorderLayers back to top, then undo
    const bottomId = useEditorStore.getState().layers[0].id;
    const topId = useEditorStore.getState().layers[1].id;
    useEditorStore.getState().reorderLayers(bottomId, topId);
    expect(useEditorStore.getState().layers[1].id).toBe(bottomId);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().layers[0].id).toBe(bottomId);
  });

  it('supports Undo and Redo across resize and crop', () => {
    const store = useEditorStore.getState();
    store.openImageAsCanvas({
      src: 'data:image/png;base64,bg',
      name: 'BG',
      width: 1000,
      height: 500,
    });
    store.resizeCanvas(2000, 1000, true);
    expect(useEditorStore.getState().canvas.width).toBe(2000);
    expect(useEditorStore.getState().layers[0].width).toBe(2000);

    // Crop
    useEditorStore.getState().enterCropMode();
    useEditorStore.getState().setCropRect({ x: 100, y: 50, width: 800, height: 400 });
    useEditorStore.getState().applyCrop();

    expect(useEditorStore.getState().canvas).toMatchObject({
      width: 800,
      height: 400,
    });
    expect(useEditorStore.getState().layers[0]).toMatchObject({
      x: -100,
      y: -50,
    });

    // Undo crop
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().canvas.width).toBe(2000);
    expect(useEditorStore.getState().layers[0].x).toBe(0);

    // Redo crop
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().canvas.width).toBe(800);
  });
});
