import React from 'react';
import { Columns2, Rows2 } from 'lucide-react';
import { PropertiesPanel } from './PropertiesPanel';
import { LayerPanel } from './LayerPanel';
import { useEditorStore } from '../../store/useEditorStore';

function clampNum(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

interface WorkspacePanelsProps {
  canvasSlot: React.ReactNode;
  onOpenResizeModal: () => void;
}

export const WorkspacePanels: React.FC<WorkspacePanelsProps> = ({
  canvasSlot,
  onOpenResizeModal,
}) => {
  const layout = useEditorStore((s) => s.panelLayout);
  const setPanelLayout = useEditorStore((s) => s.setPanelLayout);

  const startDrag = (
    e: React.PointerEvent,
    onMove: (dx: number, dy: number) => void
  ) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMove = (ev: PointerEvent) => {
      onMove(ev.clientX - startX, ev.clientY - startY);
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const toggleMode = () =>
    setPanelLayout((prev) => ({
      ...prev,
      mode: prev.mode === 'merged' ? 'split' : 'merged',
    }));

  return (
    <>
      {/* Left Split Layer Panel (when mode === 'split') */}
      {layout.mode === 'split' && (
        <aside
          style={{ width: layout.leftLayersWidth }}
          className="relative bg-[#161920] border-r border-slate-800 flex flex-col shrink-0 min-h-0"
        >
          <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] bg-[#13161c] shrink-0">
            <span className="font-medium text-slate-400">Layers Panel</span>
            <button
              type="button"
              onClick={toggleMode}
              title="Gộp Thuộc tính & Layers chung 1 cột"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              <Rows2 className="w-3 h-3 text-blue-400" />
              Gộp chung
            </button>
          </div>
          <LayerPanel />

          {/* Right-edge horizontal resizer */}
          <div
            role="separator"
            aria-orientation="vertical"
            title="Kéo để đổi chiều rộng Layers Panel"
            onPointerDown={(e) => {
              const initial = layout.leftLayersWidth;
              startDrag(e, (dx) =>
                setPanelLayout((prev) => ({
                  ...prev,
                  leftLayersWidth: clampNum(initial + dx, 200, 440),
                }))
              );
            }}
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-20"
          />
        </aside>
      )}

      {/* Center Canvas */}
      {canvasSlot}

      {/* Right Inspector Sidebar */}
      <aside
        style={{ width: layout.rightWidth }}
        className="relative bg-[#161920] border-l border-slate-800 flex flex-col shrink-0 min-h-0"
      >
        {/* Left-edge horizontal resizer */}
        <div
          role="separator"
          aria-orientation="vertical"
          title="Kéo để đổi chiều rộng bảng điều khiển"
          onPointerDown={(e) => {
            const initial = layout.rightWidth;
            startDrag(e, (dx) =>
              setPanelLayout((prev) => ({
                ...prev,
                rightWidth: clampNum(initial - dx, 250, 560),
              }))
            );
          }}
          className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-20"
        />

        {/* Panel Layout Switcher Bar */}
        <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] bg-[#13161c] shrink-0">
          <span className="font-medium text-slate-400">
            {layout.mode === 'merged' ? 'Thuộc tính & Layers' : 'Thuộc tính'}
          </span>
          <button
            type="button"
            onClick={toggleMode}
            title={
              layout.mode === 'merged'
                ? 'Tách Layers & Thuộc tính làm 2 cột riêng'
                : 'Gộp Layers & Thuộc tính chung 1 cột'
            }
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            {layout.mode === 'merged' ? (
              <>
                <Columns2 className="w-3 h-3 text-cyan-400" />
                Tách 2 cột
              </>
            ) : (
              <>
                <Rows2 className="w-3 h-3 text-blue-400" />
                Gộp chung
              </>
            )}
          </button>
        </div>

        {layout.mode === 'merged' ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div
              style={{ height: `${Math.round(layout.splitRatio * 100)}%` }}
              className="min-h-0 flex flex-col overflow-hidden"
            >
              <PropertiesPanel onOpenResizeModal={onOpenResizeModal} />
            </div>

            {/* Horizontal divider to resize Properties vs Layers height */}
            <div
              role="separator"
              aria-orientation="horizontal"
              title="Kéo để co giãn tỉ lệ Thuộc tính / Layers"
              onPointerDown={(e) => {
                const parent = e.currentTarget.parentElement;
                const totalH = parent?.clientHeight || 600;
                const initialRatio = layout.splitRatio;
                startDrag(e, (_dx, dy) =>
                  setPanelLayout((prev) => ({
                    ...prev,
                    splitRatio: clampNum(initialRatio + dy / totalH, 0.2, 0.8),
                  }))
                );
              }}
              className="h-1.5 bg-[#0f1115] border-y border-slate-800 cursor-row-resize hover:bg-blue-500/40 transition-colors shrink-0 flex items-center justify-center"
            >
              <span className="w-8 h-0.5 rounded-full bg-slate-600" />
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              <LayerPanel />
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <PropertiesPanel onOpenResizeModal={onOpenResizeModal} />
          </div>
        )}
      </aside>
    </>
  );
};
