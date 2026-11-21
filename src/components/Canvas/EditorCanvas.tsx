import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Ellipse,
  Image as KonvaImage,
  Layer as KonvaLayer,
  Line,
  Rect,
  Stage,
  Transformer,
} from 'react-konva';
import type Konva from 'konva';
import {
  BoxSelect,
  Check,
  Circle,
  CircleDot,
  ClipboardPaste,
  Copy,
  Hand,
  Layers2,
  Maximize2,
  MinusSquare,
  MousePointer2,
  Move,
  PaintBucket,
  Pipette,
  PlusSquare,
  RectangleHorizontal,
  Spline,
  Square,
  Upload,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { ImageNode } from './ImageNode';
import { FogNode } from './FogNode';
import { CropOverlay } from './CropOverlay';
import { readLocalImageFile } from '../../utils/fileHelpers';
import { renderCompositeCanvas } from '../../utils/exportCanvas';
import { rgbToHex } from '../../utils/fogRenderer';
import {
  canvasPointToImagePixel,
  eraseImageAtCanvasPoint,
} from '../../utils/magicEraser';
import {
  buildSelectionOutlineCanvas,
  copySelectionFromImageLayer,
  isPointInSelection,
  translateSelection,
} from '../../utils/selectionUtils';
import type {
  CanvasSelection,
  SelectionOperation,
  SelectionShape,
} from '../../types/editor';

const CROP_RATIOS: Array<{ label: string; value: number | null }> = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
];

export const EditorCanvas: React.FC = () => {
  const {
    canvas,
    layers,
    selectedLayerId,
    canvasMode,
    activeTool,
    zoom,
    alphaPreviewMode,
    cropRect,
    cropAspect,
    setSelectedLayer,
    setCanvasMode,
    setZoom,
    setAlphaPreviewMode,
    setCropRect,
    setCropAspect,
    applyCrop,
    cancelCropMode,
    insertImages,
    pickEyedropperColor,
    cancelEyedropper,
    magicEraserMode,
    magicEraserTolerance,
    magicEraserRadius,
    setMagicEraserMode,
    setMagicEraserTolerance,
    setMagicEraserRadius,
    setActiveTool,
    updateLayer,
    selectionShape,
    selectionOperation,
    selection,
    selectionClipboard,
    setSelectionShape,
    setSelectionOperation,
    setSelection,
    applySelectionStep,
    clearSelection,
    setSelectionClipboard,
    pasteClipboardAsLayer,
  } = useEditorStore();

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const emptyUploadInputRef = useRef<HTMLInputElement | null>(null);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [eyedropperCanvas, setEyedropperCanvas] = useState<HTMLCanvasElement | null>(null);
  const [hoverColor, setHoverColor] = useState<string | null>(null);
  const [eraserHoverPos, setEraserHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [erasing, setErasing] = useState(false);

  // View mode panning state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  // Marquee selection drawing & moving state
  const [drawingSelection, setDrawingSelection] = useState<CanvasSelection | null>(null);
  const [isMovingSelectionMode, setIsMovingSelectionMode] = useState(false);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const movingSelectionRef = useRef<{
    startX: number;
    startY: number;
    initialSelection: CanvasSelection;
  } | null>(null);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null;

  // Fit canvas to viewport helper (never upscale small canvases past 100%)
  const fitToScreen = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const pad = 80;
    const availW = Math.max(100, el.clientWidth - pad);
    const availH = Math.max(100, el.clientHeight - pad);
    const nextZoom = Math.min(availW / canvas.width, availH / canvas.height, 1);
    setZoom(Math.round(nextZoom * 100) / 100);
  }, [canvas.width, canvas.height, setZoom]);

  // Fit automatically when canvas dimensions change significantly
  useEffect(() => {
    fitToScreen();
  }, [canvas.width, canvas.height, fitToScreen]);

  // Attach Transformer to selected node
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;

    if (
      canvasMode === 'edit' &&
      activeTool === 'select' &&
      selectedLayerId &&
      selectedLayer &&
      selectedLayer.visible &&
      !selectedLayer.locked
    ) {
      const node = nodeRefs.current[selectedLayerId];
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedLayerId, selectedLayer, canvasMode, activeTool, layers]);

  // Prepare composite canvas for Eyedropper pixel sampling
  useEffect(() => {
    if (activeTool !== 'eyedropper') {
      setEyedropperCanvas(null);
      setHoverColor(null);
      return;
    }
    let active = true;
    renderCompositeCanvas(canvas, layers, { scale: 1 }).then((c) => {
      if (active) setEyedropperCanvas(c);
    });
    return () => {
      active = false;
    };
  }, [activeTool, canvas, layers]);

  const sampleColorAtStagePos = (stageX: number, stageY: number): string | null => {
    if (!eyedropperCanvas) return null;
    const px = Math.floor(stageX / zoom);
    const py = Math.floor(stageY / zoom);
    if (px < 0 || py < 0 || px >= eyedropperCanvas.width || py >= eyedropperCanvas.height) {
      return null;
    }
    const ctx = eyedropperCanvas.getContext('2d');
    if (!ctx) return null;
    const data = ctx.getImageData(px, py, 1, 1).data;
    return rgbToHex(data[0], data[1], data[2]);
  };

  const handleEmptyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length === 0) return;

    const loaded = await Promise.all(files.map(readLocalImageFile));
    insertImages(loaded);
    e.target.value = '';
  };

  // Drag & Drop local images directly onto canvas
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length === 0) return;

    const loaded = await Promise.all(files.map(readLocalImageFile));
    insertImages(loaded);
  };

  const bgClass =
    alphaPreviewMode === 'checker-light'
      ? 'checker-light'
      : alphaPreviewMode === 'solid-black'
      ? 'bg-black'
      : 'checker-dark';

  const stageWidth = Math.max(1, Math.round(canvas.width * zoom));
  const stageHeight = Math.max(1, Math.round(canvas.height * zoom));

  const handleCopySelection = async () => {
    if (!selection) return;
    const targetImg =
      selectedLayer?.type === 'image'
        ? selectedLayer
        : [...layers].reverse().find((l) => l.type === 'image' && l.visible);
    if (!targetImg || targetImg.type !== 'image') return;
    const clip = await copySelectionFromImageLayer(targetImg, selection);
    if (clip) setSelectionClipboard(clip);
  };

  const renderShapeOutline = (
    sel: CanvasSelection,
    strokeColor: string,
    fillColor: string
  ) => {
    if (sel.shape === 'lasso') {
      return (
        <Line
          points={(sel.points ?? []).flatMap((p) => [p.x, p.y])}
          closed
          stroke={strokeColor}
          strokeWidth={2 / zoom}
          dash={[6 / zoom, 4 / zoom]}
          fill={fillColor}
          listening={false}
        />
      );
    }
    if (sel.shape === 'circle' || sel.shape === 'ellipse') {
      return (
        <Ellipse
          x={sel.x + sel.width / 2}
          y={sel.y + sel.height / 2}
          radiusX={sel.width / 2}
          radiusY={sel.height / 2}
          stroke={strokeColor}
          strokeWidth={2 / zoom}
          dash={[6 / zoom, 4 / zoom]}
          fill={fillColor}
          listening={false}
        />
      );
    }
    return (
      <Rect
        x={sel.x}
        y={sel.y}
        width={sel.width}
        height={sel.height}
        stroke={strokeColor}
        strokeWidth={2 / zoom}
        dash={[6 / zoom, 4 / zoom]}
        fill={fillColor}
        listening={false}
      />
    );
  };

  return (
    <div
      ref={viewportRef}
      className={`relative flex-1 overflow-auto bg-[#0f1115] flex p-10 select-none ${
        canvasMode === 'view'
          ? isPanning
            ? 'cursor-grabbing'
            : 'cursor-grab'
          : ''
      }`}
      onWheel={(e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoom(Math.round(zoom * factor * 100) / 100);
      }}
      onPointerDown={(e) => {
        if (canvasMode !== 'view') return;
        const el = viewportRef.current;
        if (!el) return;
        setIsPanning(true);
        panStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          scrollLeft: el.scrollLeft,
          scrollTop: el.scrollTop,
        };
      }}
      onPointerMove={(e) => {
        if (!isPanning || !panStartRef.current || !viewportRef.current) return;
        const dx = e.clientX - panStartRef.current.clientX;
        const dy = e.clientY - panStartRef.current.clientY;
        viewportRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
        viewportRef.current.scrollTop = panStartRef.current.scrollTop - dy;
      }}
      onPointerUp={() => {
        setIsPanning(false);
        panStartRef.current = null;
      }}
      onPointerCancel={() => {
        setIsPanning(false);
        panStartRef.current = null;
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
    >
      {/* Marquee Selection Bar */}
      {(activeTool === 'marquee' || selection) && activeTool !== 'crop' && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#1c2029]/95 backdrop-blur border border-sky-500/60 px-3 py-1.5 rounded-lg shadow-xl text-xs">
          <BoxSelect className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="flex bg-[#0f1115] rounded-md p-0.5 border border-slate-800">
            {(
              [
                { id: 'rect', label: 'Chọn vùng Chữ nhật', Icon: RectangleHorizontal },
                { id: 'square', label: 'Chọn vùng Vuông (1:1)', Icon: Square },
                { id: 'circle', label: 'Chọn vùng Tròn (1:1)', Icon: Circle },
                { id: 'ellipse', label: 'Chọn vùng Elip', Icon: CircleDot },
                { id: 'lasso', label: 'Chọn vùng Tự do (Free Form)', Icon: Spline },
              ] as Array<{
                id: SelectionShape;
                label: string;
                Icon: React.FC<{ className?: string }>;
              }>
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                title={label}
                onClick={() => {
                  setSelectionShape(id);
                  setActiveTool('marquee');
                }}
                className={`p-1.5 rounded transition ${
                  selectionShape === id
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          <div className="flex bg-[#0f1115] rounded-md p-0.5 border border-slate-800">
            {(
              [
                { id: 'replace', label: 'Chọn vùng Mới', Icon: BoxSelect },
                { id: 'union', label: 'Select thêm vùng (+)', Icon: PlusSquare },
                { id: 'subtract', label: 'Select trừ vùng (-)', Icon: MinusSquare },
                { id: 'intersect', label: 'Select vùng giao (∩)', Icon: Layers2 },
              ] as Array<{
                id: SelectionOperation;
                label: string;
                Icon: React.FC<{ className?: string }>;
              }>
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                title={label}
                onClick={() => {
                  setSelectionOperation(id);
                  setActiveTool('marquee');
                }}
                className={`p-1.5 rounded transition ${
                  selectionOperation === id
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          {selection && (
            <>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                aria-label="Di chuyển khung vùng chọn"
                aria-pressed={isMovingSelectionMode}
                onClick={() => {
                  setIsMovingSelectionMode((v) => !v);
                  setActiveTool('marquee');
                }}
                title="Di chuyển riêng khung vùng chọn"
                className={`p-1.5 rounded transition ${
                  isMovingSelectionMode
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Copy vùng chọn"
                onClick={handleCopySelection}
                title="Copy vùng chọn (Ctrl+C)"
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Paste vùng chọn thành Layer mới"
                disabled={!selectionClipboard}
                onClick={pasteClipboardAsLayer}
                title="Paste vùng đã copy thành Layer mới (Ctrl+V)"
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-400"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Bỏ chọn vùng (Unselect)"
                onClick={clearSelection}
                title="Bỏ chọn vùng - Unselect (Esc)"
                className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Contextual Crop Bar */}
      {activeTool === 'crop' && cropRect && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#1c2029]/95 backdrop-blur border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-xl text-xs">
          <span className="text-slate-400 font-medium mr-1">Crop:</span>
          {CROP_RATIOS.map((r) => (
            <button
              key={r.label}
              onClick={() => setCropAspect(r.value)}
              className={`px-2 py-1 rounded transition ${
                cropAspect === r.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {r.label}
            </button>
          ))}
          <span className="mx-1 text-slate-500">|</span>
          <span className="text-slate-300 font-mono">
            {cropRect.width} × {cropRect.height} px
          </span>
          <button
            onClick={applyCrop}
            className="ml-2 flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            <Check className="w-3.5 h-3.5" /> Apply
          </button>
          <button
            onClick={cancelCropMode}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
          >
            <X className="w-3.5 h-3.5" /> Hủy
          </button>
        </div>
      )}

      {/* Eyedropper Banner */}
      {activeTool === 'eyedropper' && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[#1c2029]/95 backdrop-blur border border-blue-500/60 px-3.5 py-1.5 rounded-lg shadow-xl text-xs">
          <Pipette className="w-4 h-4 text-blue-400" />
          <span className="text-slate-200">Click lên ảnh để hút màu cho điểm gradient</span>
          {hoverColor && (
            <span className="flex items-center gap-1.5 font-mono text-slate-100 bg-slate-800 px-2 py-0.5 rounded">
              <span
                className="w-3.5 h-3.5 rounded-sm border border-white/30"
                style={{ backgroundColor: hoverColor }}
              />
              {hoverColor.toUpperCase()}
            </span>
          )}
          <button
            onClick={cancelEyedropper}
            className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
          >
            Hủy (Esc)
          </button>
        </div>
      )}

      {/* Magic Background Eraser Bar */}
      {activeTool === 'magic-eraser' && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 bg-[#1c2029]/95 backdrop-blur border border-cyan-500/60 px-3.5 py-1.5 rounded-lg shadow-xl text-xs">
          <Wand2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="flex bg-[#0f1115] rounded-md p-0.5 border border-slate-800">
            <button
              type="button"
              aria-label="Chế độ Loang màu theo ngưỡng"
              title="Chế độ 1: Loang màu theo ngưỡng (Flood Fill)"
              onClick={() => setMagicEraserMode('flood')}
              className={`p-1.5 rounded transition ${
                magicEraserMode === 'flood'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PaintBucket className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Chế độ Xóa hình tròn theo bán kính"
              title="Chế độ 2: Xóa toàn bộ màu trong hình tròn theo Radius"
              onClick={() => setMagicEraserMode('circle')}
              className={`p-1.5 rounded transition ${
                magicEraserMode === 'circle'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
            </button>
          </div>

          {magicEraserMode === 'flood' ? (
            <div className="flex items-center gap-2">
              <input
                type="range"
                aria-label="Ngưỡng loang màu"
                title="Ngưỡng loang màu"
                min={1}
                max={100}
                value={magicEraserTolerance}
                onChange={(e) => setMagicEraserTolerance(Number(e.target.value))}
                className="w-24 accent-cyan-400"
              />
              <span className="font-mono text-cyan-300 w-9">
                {magicEraserTolerance}%
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="range"
                aria-label="Bán kính xóa tròn"
                title="Bán kính xóa tròn (Radius px)"
                min={5}
                max={200}
                value={magicEraserRadius}
                onChange={(e) => setMagicEraserRadius(Number(e.target.value))}
                className="w-24 accent-cyan-400"
              />
              <span className="font-mono text-cyan-300 w-11">
                {magicEraserRadius}px
              </span>
            </div>
          )}

          <button
            type="button"
            aria-label="Thoát Magic Background Eraser"
            title="Thoát Magic Background Eraser (Esc)"
            onClick={() => {
              setEraserHoverPos(null);
              setActiveTool('select');
            }}
            className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Canvas Container */}
      <div
        className={`relative shrink-0 m-auto shadow-[0_0_40px_rgba(0,0,0,0.65)] ring-1 ring-slate-700/80 ${bgClass} ${
          activeTool === 'eyedropper' || activeTool === 'magic-eraser'
            ? 'cursor-crosshair'
            : activeTool === 'marquee' && isMovingSelectionMode
            ? 'cursor-move'
            : ''
        }`}
        style={{
          width: stageWidth,
          height: stageHeight,
          minWidth: stageWidth,
          minHeight: stageHeight,
        }}
        onMouseLeave={() => setEraserHoverPos(null)}
      >
        <div className="pointer-events-none absolute -top-6 left-0 text-[11px] font-mono text-slate-400">
          {canvas.width} × {canvas.height} px
        </div>
        <Stage
          width={stageWidth}
          height={stageHeight}
          scaleX={zoom}
          scaleY={zoom}
          onMouseDown={async (e) => {
            if (canvasMode === 'view') return;

            if (activeTool === 'marquee') {
              const pos = e.target.getStage()?.getPointerPosition();
              if (!pos) return;
              const cx = pos.x / zoom;
              const cy = pos.y / zoom;

              // Move existing selection frame if Move Selection mode is on, or clicking inside in 'replace' mode
              if (
                selection &&
                (isMovingSelectionMode ||
                  (selectionOperation === 'replace' &&
                    isPointInSelection(cx, cy, selection)))
              ) {
                movingSelectionRef.current = {
                  startX: cx,
                  startY: cy,
                  initialSelection: selection,
                };
                return;
              }

              marqueeStartRef.current = { x: cx, y: cy };
              if (selectionShape === 'lasso') {
                setDrawingSelection({
                  shape: 'lasso',
                  x: cx,
                  y: cy,
                  width: 1,
                  height: 1,
                  points: [{ x: cx, y: cy }],
                });
              } else {
                setDrawingSelection({
                  shape: selectionShape,
                  x: cx,
                  y: cy,
                  width: 0,
                  height: 0,
                });
              }
              return;
            }

            if (activeTool === 'eyedropper') {
              const pos = e.target.getStage()?.getPointerPosition();
              if (pos) {
                const picked = sampleColorAtStagePos(pos.x, pos.y);
                if (picked) pickEyedropperColor(picked);
              }
              return;
            }
            if (activeTool === 'magic-eraser') {
              if (erasing) return;
              const pos = e.target.getStage()?.getPointerPosition();
              if (!pos) return;
              const canvasX = pos.x / zoom;
              const canvasY = pos.y / zoom;

              // Use selected image layer if valid, else pick top-most image layer under cursor
              let target =
                selectedLayer?.type === 'image' &&
                selectedLayer.visible &&
                !selectedLayer.locked
                  ? selectedLayer
                  : null;
              if (!target) {
                for (let i = layers.length - 1; i >= 0; i--) {
                  const l = layers[i];
                  if (
                    l.type === 'image' &&
                    l.visible &&
                    !l.locked &&
                    canvasPointToImagePixel(canvasX, canvasY, l) !== null
                  ) {
                    target = l;
                    break;
                  }
                }
              }
              if (!target) return;

              setErasing(true);
              try {
                const newSrc = await eraseImageAtCanvasPoint({
                  layer: target,
                  canvasX,
                  canvasY,
                  mode: magicEraserMode,
                  tolerance: magicEraserTolerance,
                  radius: magicEraserRadius,
                  selection,
                });
                if (newSrc) {
                  updateLayer(target.id, { src: newSrc }, true);
                }
              } finally {
                setErasing(false);
              }
              return;
            }
            if (e.target === e.target.getStage()) {
              setSelectedLayer(null);
            }
          }}
          onMouseMove={(e) => {
            if (canvasMode === 'view') return;

            if (activeTool === 'marquee' && movingSelectionRef.current) {
              const pos = e.target.getStage()?.getPointerPosition();
              if (!pos) return;
              const cx = pos.x / zoom;
              const cy = pos.y / zoom;
              const { startX, startY, initialSelection } =
                movingSelectionRef.current;
              setSelection(
                translateSelection(initialSelection, cx - startX, cy - startY)
              );
              return;
            }

            if (activeTool === 'marquee' && marqueeStartRef.current) {
              const pos = e.target.getStage()?.getPointerPosition();
              if (!pos) return;
              const cx = pos.x / zoom;
              const cy = pos.y / zoom;
              const start = marqueeStartRef.current;

              if (selectionShape === 'lasso') {
                setDrawingSelection((prev) => {
                  const pts = [...(prev?.points ?? []), { x: cx, y: cy }];
                  const xs = pts.map((p) => p.x);
                  const ys = pts.map((p) => p.y);
                  const minX = Math.min(...xs);
                  const minY = Math.min(...ys);
                  return {
                    shape: 'lasso',
                    x: minX,
                    y: minY,
                    width: Math.max(1, Math.max(...xs) - minX),
                    height: Math.max(1, Math.max(...ys) - minY),
                    points: pts,
                  };
                });
              } else if (selectionShape === 'square' || selectionShape === 'circle') {
                const dx = cx - start.x;
                const dy = cy - start.y;
                const size = Math.max(Math.abs(dx), Math.abs(dy));
                const x = dx >= 0 ? start.x : start.x - size;
                const y = dy >= 0 ? start.y : start.y - size;
                setDrawingSelection({
                  shape: selectionShape,
                  x,
                  y,
                  width: size,
                  height: size,
                });
              } else {
                setDrawingSelection({
                  shape: selectionShape,
                  x: Math.min(start.x, cx),
                  y: Math.min(start.y, cy),
                  width: Math.abs(cx - start.x),
                  height: Math.abs(cy - start.y),
                });
              }
              return;
            }

            if (activeTool === 'eyedropper') {
              const pos = e.target.getStage()?.getPointerPosition();
              if (pos) {
                setHoverColor(sampleColorAtStagePos(pos.x, pos.y));
              }
              return;
            }
            if (activeTool === 'magic-eraser') {
              const pos = e.target.getStage()?.getPointerPosition();
              if (pos) {
                setEraserHoverPos({ x: pos.x, y: pos.y });
              }
            }
          }}
          onMouseUp={() => {
            if (movingSelectionRef.current) {
              movingSelectionRef.current = null;
              return;
            }
            if (activeTool === 'marquee' && marqueeStartRef.current) {
              marqueeStartRef.current = null;
              if (
                drawingSelection &&
                drawingSelection.width >= 4 &&
                drawingSelection.height >= 4
              ) {
                applySelectionStep({
                  op: selectionOperation,
                  shape: drawingSelection.shape,
                  x: drawingSelection.x,
                  y: drawingSelection.y,
                  width: drawingSelection.width,
                  height: drawingSelection.height,
                  points: drawingSelection.points,
                });
              }
              setDrawingSelection(null);
            }
          }}
        >
          <KonvaLayer>
            {/* Solid canvas background if not transparent */}
            {canvas.backgroundColor && (
              <Rect
                x={0}
                y={0}
                width={canvas.width}
                height={canvas.height}
                fill={canvas.backgroundColor}
                listening={false}
              />
            )}

            {/* Render layers in z-order */}
            {layers.map((layer, index) =>
              layer.type === 'image' ? (
                <ImageNode
                  key={layer.id}
                  layer={layer}
                  isSelected={layer.id === selectedLayerId}
                  interactive={canvasMode === 'edit' && activeTool === 'select'}
                  onSelect={() => setSelectedLayer(layer.id)}
                  nodeRef={(node) => {
                    nodeRefs.current[layer.id] = node;
                  }}
                />
              ) : (
                <FogNode
                  key={layer.id}
                  layer={layer}
                  layerIndex={index}
                  allLayers={layers}
                  canvasConfig={canvas}
                  interactive={canvasMode === 'edit' && activeTool === 'select'}
                  onSelect={() => setSelectedLayer(layer.id)}
                  nodeRef={(node) => {
                    nodeRefs.current[layer.id] = node;
                  }}
                />
              )
            )}

            {/* Current Selection Outline (stays visible while dragging a new selection) */}
            {selection &&
              (selection.steps && selection.steps.length > 1 ? (
                <KonvaImage
                  x={selection.x}
                  y={selection.y}
                  width={selection.width}
                  height={selection.height}
                  image={buildSelectionOutlineCanvas(
                    selection,
                    Math.max(1, Math.round(selection.width)),
                    Math.max(1, Math.round(selection.height)),
                    selection.x,
                    selection.y
                  )}
                  listening={false}
                />
              ) : (
                renderShapeOutline(selection, '#38bdf8', 'rgba(56, 189, 248, 0.08)')
              ))}

            {/* Live Preview of new selection being dragged */}
            {drawingSelection &&
              renderShapeOutline(
                drawingSelection,
                selectionOperation === 'subtract'
                  ? '#f87171'
                  : selectionOperation === 'intersect'
                  ? '#fbbf24'
                  : '#38bdf8',
                selectionOperation === 'subtract'
                  ? 'rgba(248, 113, 113, 0.12)'
                  : selectionOperation === 'intersect'
                  ? 'rgba(251, 191, 36, 0.12)'
                  : 'rgba(56, 189, 248, 0.12)'
              )}

            {/* Selection Transformer */}
            <Transformer
              ref={trRef}
              keepRatio={selectedLayer?.lockAspectRatio ?? false}
              anchorSize={8}
              borderStroke="#3b82f6"
              anchorStroke="#3b82f6"
              anchorFill="#ffffff"
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 8 || newBox.height < 8) return oldBox;
                return newBox;
              }}
            />

            {/* Crop Overlay */}
            {activeTool === 'crop' && cropRect && (
              <CropOverlay
                canvasWidth={canvas.width}
                canvasHeight={canvas.height}
                cropRect={cropRect}
                aspectRatio={cropAspect}
                onChange={setCropRect}
              />
            )}
          </KonvaLayer>
        </Stage>

        {/* Circle Magic Eraser cursor preview */}
        {activeTool === 'magic-eraser' &&
          magicEraserMode === 'circle' &&
          eraserHoverPos && (
            <div
              className="pointer-events-none absolute rounded-full border-2 border-cyan-400 bg-cyan-400/15 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
              style={{
                width: magicEraserRadius * 2 * zoom,
                height: magicEraserRadius * 2 * zoom,
                left: eraserHoverPos.x - magicEraserRadius * zoom,
                top: eraserHoverPos.y - magicEraserRadius * zoom,
              }}
            />
          )}

        {/* Empty state hint */}
        {layers.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className="pointer-events-auto bg-[#14171f]/85 backdrop-blur-sm border border-slate-700/60 rounded-xl px-5 py-4 max-w-xs shadow-xl">
              <Upload className="w-7 h-7 text-blue-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-200">
                Kéo & thả ảnh vào đây
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Hoặc dùng nút <span className="text-slate-200">Open</span> /{' '}
                <span className="text-slate-200">Insert</span> để bắt đầu chỉnh sửa
              </p>
              <button
                type="button"
                onClick={() => emptyUploadInputRef.current?.click()}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow transition"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload ảnh
              </button>
              <input
                ref={emptyUploadInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleEmptyUpload}
                className="hidden"
              />
            </div>
          </div>
        )}
      </div>

      {/* Drag & drop overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-40 bg-blue-600/20 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none">
          <div className="bg-[#181b22] px-6 py-4 rounded-xl shadow-2xl border border-blue-500/40 text-sm font-medium text-blue-200">
            Thả ảnh vào đây để mở hoặc chèn thành layer mới
          </div>
        </div>
      )}

      {/* Floating Zoom & Alpha Preview Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[#181b22]/95 backdrop-blur border border-slate-700/80 px-2.5 py-1 rounded-full shadow-lg text-xs">
        <div className="flex items-center bg-[#0f1115] rounded-full p-0.5 border border-slate-800 mr-1">
          <button
            type="button"
            onClick={() => setCanvasMode('view')}
            title="View Mode: Kéo để di chuyển vùng nhìn, Scroll để Zoom (H)"
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition ${
              canvasMode === 'view'
                ? 'bg-amber-500 text-slate-950 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hand className="w-3 h-3" /> View
          </button>
          <button
            type="button"
            onClick={() => setCanvasMode('edit')}
            title="Edit Mode: Kéo để di chuyển đối tượng, Scroll để Zoom"
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition ${
              canvasMode === 'edit'
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MousePointer2 className="w-3 h-3" /> Edit
          </button>
        </div>

        <button
          onClick={fitToScreen}
          title="Vừa màn hình (Ctrl+0)"
          className="px-2 py-1 rounded-full hover:bg-slate-700 text-slate-300 flex items-center gap-1"
        >
          <Maximize2 className="w-3.5 h-3.5" /> Fit
        </button>
        <button
          onClick={() => setZoom(zoom - 0.1)}
          title="Thu nhỏ"
          className="p-1 rounded-full hover:bg-slate-700 text-slate-300"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="w-11 text-center font-mono text-slate-200">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(zoom + 0.1)}
          title="Phóng to"
          className="p-1 rounded-full hover:bg-slate-700 text-slate-300"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <span className="mx-1 text-slate-600">|</span>

        <button
          onClick={() =>
            setAlphaPreviewMode(
              alphaPreviewMode === 'checker-dark'
                ? 'checker-light'
                : alphaPreviewMode === 'checker-light'
                ? 'solid-black'
                : 'checker-dark'
            )
          }
          title="Đổi nền xem trước kênh Alpha (Caro tối / Caro sáng / Đen)"
          className="px-2 py-1 rounded-full hover:bg-slate-700 text-slate-300 flex items-center gap-1.5"
        >
          <span
            className={`w-3 h-3 rounded-sm border border-slate-500 ${
              alphaPreviewMode === 'checker-light'
                ? 'checker-light'
                : alphaPreviewMode === 'solid-black'
                ? 'bg-black'
                : 'checker-sm'
            }`}
          />
          <span>
            {alphaPreviewMode === 'checker-dark'
              ? 'Caro tối'
              : alphaPreviewMode === 'checker-light'
              ? 'Caro sáng'
              : 'Nền đen'}
          </span>
        </button>
      </div>
    </div>
  );
};
