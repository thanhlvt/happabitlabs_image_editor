import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NewCanvasModal } from '../components/Modals/NewCanvasModal';
import { ExportModal } from '../components/Modals/ExportModal';
import { LayerPanel } from '../components/Panels/LayerPanel';
import { PropertiesPanel } from '../components/Panels/PropertiesPanel';
import { TopToolbar } from '../components/Toolbar/TopToolbar';
import { WorkspacePanels } from '../components/Panels/WorkspacePanels';
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

  it('PropertiesPanel Fit width, Fit height, and Align buttons transform selected image', () => {
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

    expect(screen.queryByText('Fit all')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Fit width'));
    expect(useEditorStore.getState().layers[0]).toMatchObject({
      x: 0,
      y: 150,
      width: 1000,
      height: 500,
    });

    fireEvent.click(screen.getByLabelText('Fit height'));
    expect(useEditorStore.getState().layers[0]).toMatchObject({
      x: -300,
      y: 0,
      width: 1600,
      height: 800,
    });

    fireEvent.click(screen.getByLabelText('Align left'));
    expect(useEditorStore.getState().layers[0].x).toBe(0);

    fireEvent.click(screen.getByLabelText('Align right'));
    expect(useEditorStore.getState().layers[0].x).toBe(-600);

    fireEvent.click(screen.getByLabelText('Align top'));
    expect(useEditorStore.getState().layers[0].y).toBe(0);

    fireEvent.click(screen.getByLabelText('Align bottom'));
    expect(useEditorStore.getState().layers[0].y).toBe(0);

    fireEvent.click(screen.getByLabelText('Flip horizontal'));
    expect(useEditorStore.getState().layers[0].flipX).toBe(true);

    fireEvent.click(screen.getByLabelText('Flip vertical'));
    expect(useEditorStore.getState().layers[0].flipY).toBe(true);
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

  it('FogControls supports Smooth Fade mode with Bottom offset and Height sliders', () => {
    useEditorStore.getState().addFogLayer('white-mist');
    render(<PropertiesPanel onOpenResizeModal={() => {}} />);

    fireEvent.click(screen.getByText('Smooth Fade'));
    expect(useEditorStore.getState().layers[0]).toMatchObject({
      gradientType: 'smooth-fade',
    });

    fireEvent.change(screen.getByLabelText('Khoảng cắt hẳn (Bottom / Offset)'), {
      target: { value: '25' },
    });
    fireEvent.change(screen.getByLabelText('Độ dài vùng mờ SmoothStep (Height)'), {
      target: { value: '120' },
    });

    expect(useEditorStore.getState().layers[0]).toMatchObject({
      fadeOffset: 25,
      fadeHeight: 120,
    });

    // Multi-edge toggle: add Top and Left while keeping Bottom active
    fireEvent.click(screen.getByText('Trên ↓'));
    fireEvent.click(screen.getByText('Trái →'));
    expect(useEditorStore.getState().layers[0]).toMatchObject({
      fadeEdges: ['bottom', 'top', 'left'],
    });

    // Toggle Bottom off
    fireEvent.click(screen.getByText('Dưới ↑'));
    expect(useEditorStore.getState().layers[0]).toMatchObject({
      fadeEdges: ['top', 'left'],
    });
  });

  it('TopToolbar renders New, Open, Save buttons and editable Project Name', () => {
    render(
      <TopToolbar
        onOpenNewModal={() => {}}
        onOpenResizeModal={() => {}}
        onOpenExportModal={() => {}}
      />
    );

    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Tên Project');
    fireEvent.change(nameInput, { target: { value: 'Game Banner 01' } });
    expect(useEditorStore.getState().projectName).toBe('Game Banner 01');
  });

  it('ExportModal defaults PNG compression to 8/10 and uses projectName or lastExportName', () => {
    useEditorStore.setState({
      projectName: 'Hero Banner',
      lastExportName: null,
    });
    const { rerender } = render(<ExportModal open={true} onClose={() => {}} />);

    const nameInput = screen.getByDisplayValue('Hero Banner') as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();

    expect(screen.getByText('8/10')).toBeInTheDocument();
    const slider = screen.getByLabelText('Độ nén PNG') as HTMLInputElement;
    expect(slider.value).toBe('8');

    fireEvent.change(slider, { target: { value: '10' } });
    expect(screen.getByText('10/10')).toBeInTheDocument();

    // When lastExportName exists, reopening ExportModal defaults to lastExportName
    useEditorStore.setState({ lastExportName: 'custom-exported-v2' });
    rerender(<ExportModal open={false} onClose={() => {}} />);
    rerender(<ExportModal open={true} onClose={() => {}} />);
    expect(screen.getByDisplayValue('custom-exported-v2')).toBeInTheDocument();
  });

  it('WorkspacePanels toggles between merged and split 2-column layout', () => {
    render(
      <WorkspacePanels
        canvasSlot={<div data-testid="canvas-slot" />}
        onOpenResizeModal={() => {}}
      />
    );

    expect(screen.getByText('Thuộc tính & Layers')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tách 2 cột'));

    expect(screen.getByText('Layers Panel')).toBeInTheDocument();
    expect(screen.getAllByText('Gộp chung').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getAllByText('Gộp chung')[0]);
    expect(screen.getByText('Thuộc tính & Layers')).toBeInTheDocument();
  });

  it('LayerPanel supports drag-and-drop reordering of layers', () => {
    useEditorStore.getState().addFogLayer('white-mist');
    useEditorStore.getState().addFogLayer('dark-cinematic');

    const initialLayers = useEditorStore.getState().layers;
    const firstId = initialLayers[0].id;
    const secondId = initialLayers[1].id;

    render(<LayerPanel />);

    const firstEl = screen.getByTestId(`layer-item-${firstId}`);
    const secondEl = screen.getByTestId(`layer-item-${secondId}`);

    fireEvent.dragStart(firstEl);
    fireEvent.dragOver(secondEl);
    fireEvent.drop(secondEl);

    const reordered = useEditorStore.getState().layers;
    expect(reordered[0].id).toBe(secondId);
    expect(reordered[1].id).toBe(firstId);
  });

  it('ImageAdjustmentsPanel enables Remove Background with #ffffff default and eyedropper', () => {
    useEditorStore.getState().newCanvas(800, 600, null);
    useEditorStore.getState().insertImages([
      {
        src: 'data:image/png;base64,test',
        name: 'Logo',
        width: 200,
        height: 100,
      },
    ]);

    render(<PropertiesPanel onOpenResizeModal={() => {}} />);

    fireEvent.click(screen.getByText('Xóa nền'));
    const layer = useEditorStore.getState().layers[0];
    expect(layer.type).toBe('image');
    if (layer.type === 'image') {
      expect(layer.adjustments?.backgroundRemoval).toMatchObject({
        enabled: true,
        color: '#ffffff',
      });
    }

    fireEvent.click(screen.getByText('Hút màu xóa'));
    expect(useEditorStore.getState().activeTool).toBe('eyedropper');
    useEditorStore.getState().pickEyedropperColor('#00ff00');

    const afterPick = useEditorStore.getState().layers[0];
    if (afterPick.type === 'image') {
      expect(afterPick.adjustments?.backgroundRemoval?.color).toBe('#00ff00');
      expect(afterPick.adjustments?.backgroundRemoval?.enabled).toBe(true);
    }
  });

  it('Magic Eraser toggles tool and switches between flood and circle modes', () => {
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
    fireEvent.click(screen.getByText('Mở Magic Background Eraser'));
    expect(useEditorStore.getState().activeTool).toBe('magic-eraser');

    useEditorStore.getState().setMagicEraserMode('circle');
    useEditorStore.getState().setMagicEraserRadius(45);
    useEditorStore.getState().setMagicEraserTolerance(35);

    expect(useEditorStore.getState().magicEraserMode).toBe('circle');
    expect(useEditorStore.getState().magicEraserRadius).toBe(45);
    expect(useEditorStore.getState().magicEraserTolerance).toBe(35);
  });
});
