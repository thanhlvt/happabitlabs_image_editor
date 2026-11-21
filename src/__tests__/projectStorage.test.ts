import { describe, expect, it } from 'vitest';
import { parseProjectFile, serializeProject } from '../utils/projectStorage';
import { useEditorStore } from '../store/useEditorStore';
import type { ImageLayer } from '../types/editor';

describe('projectStorage', () => {
  it('serializes and parses a project file with canvas and layers', () => {
    const sampleLayer: ImageLayer = {
      id: 'img-1',
      name: 'Hero',
      type: 'image',
      src: 'data:image/png;base64,abc',
      naturalWidth: 400,
      naturalHeight: 300,
      cropX: 0,
      cropY: 0,
      cropWidth: 400,
      cropHeight: 300,
      x: 10,
      y: 20,
      width: 400,
      height: 300,
      rotation: 0,
      opacity: 0.75,
      visible: true,
      locked: false,
      lockAspectRatio: true,
    };

    const project = serializeProject(
      'My Banner',
      { width: 2600, height: 1080, backgroundColor: null },
      [sampleLayer]
    );

    const json = JSON.stringify(project);
    const parsed = parseProjectFile(json);

    expect(parsed.version).toBe(1);
    expect(parsed.name).toBe('My Banner');
    expect(parsed.canvas).toEqual({
      width: 2600,
      height: 1080,
      backgroundColor: null,
    });
    expect(parsed.layers).toHaveLength(1);
    expect(parsed.layers[0].opacity).toBe(0.75);
  });

  it('throws clear errors on invalid project JSON', () => {
    expect(() => parseProjectFile('not-json')).toThrow();
    expect(() => parseProjectFile(JSON.stringify({ name: 'bad' }))).toThrow();
  });

  it('loads a parsed project into useEditorStore and resets history', () => {
    const project = serializeProject(
      'Restored',
      { width: 1024, height: 1024, backgroundColor: '#111827' },
      []
    );
    useEditorStore.getState().loadProject(project);

    const state = useEditorStore.getState();
    expect(state.projectName).toBe('Restored');
    expect(state.canvas).toEqual({
      width: 1024,
      height: 1024,
      backgroundColor: '#111827',
    });
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
  });

  it('serializes, parses, and restores EditorEnvironment including panelLayout', () => {
    const project = serializeProject(
      'Studio Workspace',
      { width: 1920, height: 1080, backgroundColor: null },
      [],
      {
        panelLayout: {
          mode: 'split',
          rightWidth: 380,
          leftLayersWidth: 290,
          splitRatio: 0.65,
        },
        zoom: 0.75,
        alphaPreviewMode: 'checker-light',
        selectedLayerId: null,
        lastExportName: 'hero-banner-v3',
      }
    );

    const parsed = parseProjectFile(JSON.stringify(project));
    expect(parsed.environment?.panelLayout).toEqual({
      mode: 'split',
      rightWidth: 380,
      leftLayersWidth: 290,
      splitRatio: 0.65,
    });

    useEditorStore.getState().loadProject(parsed);
    const state = useEditorStore.getState();
    expect(state.panelLayout).toEqual({
      mode: 'split',
      rightWidth: 380,
      leftLayersWidth: 290,
      splitRatio: 0.65,
    });
    expect(state.zoom).toBe(0.75);
    expect(state.alphaPreviewMode).toBe('checker-light');
    expect(state.lastExportName).toBe('hero-banner-v3');
  });

  it('assigns unique projectId on newCanvas and preserves project id in serializeProject/parseProjectFile', () => {
    const firstId = useEditorStore.getState().projectId;
    useEditorStore.getState().newCanvas(800, 600, null, 'Second Project');
    const secondId = useEditorStore.getState().projectId;
    expect(secondId).not.toBe(firstId);

    const serialized = serializeProject(
      'Second Project',
      { width: 800, height: 600, backgroundColor: null },
      [],
      undefined,
      secondId
    );
    const parsed = parseProjectFile(JSON.stringify(serialized));
    expect(parsed.id).toBe(secondId);
  });
});
