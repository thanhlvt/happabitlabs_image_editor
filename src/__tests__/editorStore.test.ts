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

  it('copies all properties from object 1 to object 2 on selection (image and fog)', () => {
    const store = useEditorStore.getState();
    store.newCanvas(1200, 900, null);
    store.insertImages([
      {
        src: 'data:image/png;base64,img1',
        name: 'Image 1',
        width: 400,
        height: 300,
      },
      {
        src: 'data:image/png;base64,img2',
        name: 'Image 2',
        width: 200,
        height: 150,
      },
    ]);

    const [img1, img2] = useEditorStore.getState().layers;
    useEditorStore.getState().updateLayer(img1.id, {
      x: 55,
      y: 75,
      width: 500,
      height: 375,
      rotation: 25,
      flipX: true,
      flipY: false,
      opacity: 0.65,
      lockAspectRatio: false,
      adjustments: {
        brightness: 30,
        contrast: 15,
        temperature: -10,
        tint: 5,
        vibrance: 20,
        saturation: -25,
        colorEdits: [
          {
            id: 'ce1',
            sourceColor: '#ff0000',
            targetColor: '#00ff00',
            tolerance: 20,
            softness: 10,
          },
        ],
        backgroundRemoval: {
          enabled: true,
          color: '#ffffff',
          tolerance: 30,
          softness: 12,
        },
      },
    });

    // Start copy from img1, then select img2
    useEditorStore.getState().startCopyProperties(img1.id);
    expect(useEditorStore.getState().copiedPropertiesFromId).toBe(img1.id);

    useEditorStore.getState().setSelectedLayer(img2.id);
    expect(useEditorStore.getState().copiedPropertiesFromId).toBeNull();
    expect(useEditorStore.getState().selectedLayerId).toBe(img2.id);

    const updatedImg2 = useEditorStore.getState().layers[1];
    expect(updatedImg2).toMatchObject({
      id: img2.id,
      name: 'Image 2',
      x: 55,
      y: 75,
      width: 500,
      height: 375,
      rotation: 25,
      flipX: true,
      flipY: false,
      opacity: 0.65,
      lockAspectRatio: false,
    });
    if (updatedImg2.type === 'image') {
      expect(updatedImg2.src).toBe('data:image/png;base64,img2');
      expect(updatedImg2.adjustments).toMatchObject({
        brightness: 30,
        contrast: 15,
        saturation: -25,
        backgroundRemoval: {
          enabled: true,
          color: '#ffffff',
          tolerance: 30,
          softness: 12,
        },
      });
      expect(updatedImg2.adjustments?.colorEdits).toHaveLength(1);
      expect(updatedImg2.adjustments?.colorEdits[0].sourceColor).toBe('#ff0000');
      expect(updatedImg2.adjustments?.colorEdits[0].id).not.toBe('ce1');
    }

    // Undo restores img2 original bounds
    useEditorStore.getState().undo();
    const revertedImg2 = useEditorStore.getState().layers[1];
    expect(revertedImg2.width).toBe(200);
    expect(revertedImg2.opacity).toBe(1);

    // Test FogLayer -> FogLayer copy
    useEditorStore.getState().addFogLayer();
    useEditorStore.getState().addFogLayer();
    const fog1 = useEditorStore.getState().layers[2];
    const fog2 = useEditorStore.getState().layers[3];
    useEditorStore.getState().updateLayer(fog1.id, {
      x: 10,
      y: 20,
      width: 600,
      height: 400,
      opacity: 0.4,
      blurRadius: 48,
      colorIntensity: 0.85,
      angle: 135,
      stops: [
        { id: 's1', offset: 0, color: '#112233', alpha: 0.9 },
        { id: 's2', offset: 1, color: '#445566', alpha: 0.1 },
      ],
    });

    useEditorStore.getState().startCopyProperties(fog1.id);
    useEditorStore.getState().setSelectedLayer(fog2.id);

    const updatedFog2 = useEditorStore.getState().layers[3];
    expect(updatedFog2).toMatchObject({
      id: fog2.id,
      x: 10,
      y: 20,
      width: 600,
      height: 400,
      opacity: 0.4,
      blurRadius: 48,
      colorIntensity: 0.85,
      angle: 135,
    });
    if (updatedFog2.type === 'fog') {
      expect(updatedFog2.stops).toHaveLength(2);
      expect(updatedFog2.stops[0].color).toBe('#112233');
      expect(updatedFog2.stops[0].id).not.toBe('s1');
    }
  });
});
