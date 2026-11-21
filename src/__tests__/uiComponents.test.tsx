import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NewCanvasModal } from '../components/Modals/NewCanvasModal';
import { LayerPanel } from '../components/Panels/LayerPanel';
import { PropertiesPanel } from '../components/Panels/PropertiesPanel';
import { useEditorStore } from '../store/useEditorStore';

describe('Editor UI Components', () => {
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

  it('NewCanvasModal displays requested presets and creates canvas', () => {
    const onClose = vi.fn();
    render(<NewCanvasModal open={true} onClose={onClose} />);

    expect(screen.getByText('2600 × 1080')).toBeInTheDocument();
    expect(screen.getByText('1080 × 2600')).toBeInTheDocument();
    expect(screen.getByText('1300 × 1080')).toBeInTheDocument();
    expect(screen.getByText('1080 × 1300')).toBeInTheDocument();
    expect(screen.getByText('1024 × 1024')).toBeInTheDocument();
    expect(screen.getByText('128 × 128')).toBeInTheDocument();
    expect(screen.getByText('256 × 256')).toBeInTheDocument();
    expect(screen.getByText('512 × 512')).toBeInTheDocument();
    expect(screen.getByText('600 × 300')).toBeInTheDocument();

    fireEvent.click(screen.getByText('2600 × 1080'));
    fireEvent.click(screen.getByText('Tạo Canvas'));

    expect(useEditorStore.getState().canvas).toEqual({
      width: 2600,
      height: 1080,
      backgroundColor: null,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('LayerPanel adds fog layer and PropertiesPanel adjusts Alpha & Fog controls', () => {
    render(
      <div>
        <PropertiesPanel onOpenResizeModal={() => {}} />
        <LayerPanel />
      </div>
    );

    // Click "+ Sương" in LayerPanel
    fireEvent.click(screen.getByTitle('Thêm Object Sương'));

    expect(useEditorStore.getState().layers).toHaveLength(1);
    expect(screen.getByText('Kênh Alpha (Opacity)')).toBeInTheDocument();
    expect(screen.getByText('Khoảng cách trải Gradient')).toBeInTheDocument();
    expect(screen.getByText('Hút màu')).toBeInTheDocument();

    // Click 50% alpha preset
    fireEvent.click(screen.getByText('50%'));
    expect(useEditorStore.getState().layers[0].opacity).toBe(0.5);
  });

  it('PropertiesPanel Fit width, Fit height, and Fit all buttons resize selected image', () => {
    useEditorStore.getState().newCanvas(1000, 800, null);
    useEditorStore.getState().insertImages([
      {
        src: 'data:image/png;base64,test',
        name: 'Photo',
        width: 200,
        height: 100,
      },
    ]);

    render(<PropertiesPanel onOpenResizeModal={() => {}} />);

    fireEvent.click(screen.getByText('Fit width'));
    expect(useEditorStore.getState().layers[0]).toMatchObject({
      x: 0,
      y: 150,
      width: 1000,
      height: 500,
    });

    fireEvent.click(screen.getByText('Fit height'));
    expect(useEditorStore.getState().layers[0]).toMatchObject({
      x: -300,
      y: 0,
      width: 1600,
      height: 800,
    });

    fireEvent.click(screen.getByText('Fit all'));
    expect(useEditorStore.getState().layers[0]).toMatchObject({
      x: 0,
      y: 150,
      width: 1000,
      height: 500,
    });
  });

  it('ImageAdjustmentsPanel updates sliders, adds Color Edit rule, and resets', () => {
    useEditorStore.getState().newCanvas(800, 600, null);
    useEditorStore.getState().insertImages([
      {
        src: 'data:image/png;base64,test',
        name: 'Photo',
        width: 200,
        height: 100,
      },
    ]);

    render(<PropertiesPanel onOpenResizeModal={() => {}} />);

    const brightnessSlider = screen.getByLabelText('Độ sáng (Brightness)');
    fireEvent.change(brightnessSlider, { target: { value: '35' } });

    const layer0 = useEditorStore.getState().layers[0];
    expect(layer0.type).toBe('image');
    if (layer0.type === 'image') {
      expect(layer0.adjustments?.brightness).toBe(35);
    }

    fireEvent.click(screen.getByText('Thêm màu'));
    const afterRule = useEditorStore.getState().layers[0];
    if (afterRule.type === 'image') {
      expect(afterRule.adjustments?.colorEdits).toHaveLength(1);
    }

    fireEvent.click(screen.getByText('Reset'));
    const afterReset = useEditorStore.getState().layers[0];
    if (afterReset.type === 'image') {
      expect(afterReset.adjustments?.brightness).toBe(0);
      expect(afterReset.adjustments?.colorEdits).toHaveLength(0);
    }
  });
});
