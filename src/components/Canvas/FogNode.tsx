import React, { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { CanvasConfig, FogLayer, Layer } from '../../types/editor';
import { useEditorStore } from '../../store/useEditorStore';
import { renderCompositeCanvas } from '../../utils/exportCanvas';
import { renderFogToCanvas } from '../../utils/fogRenderer';

interface FogNodeProps {
  layer: FogLayer;
  layerIndex: number;
  allLayers: Layer[];
  canvasConfig: CanvasConfig;
  interactive: boolean;
  onSelect: () => void;
  nodeRef: (node: Konva.Image | null) => void;
}

export const FogNode: React.FC<FogNodeProps> = ({
  layer,
  layerIndex,
  allLayers,
  canvasConfig,
  interactive,
  onSelect,
  nodeRef,
}) => {
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const [renderedCanvas, setRenderedCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!layer.visible) return;
    let cancelled = false;

    const computeFog = async () => {
      let backdrop: HTMLCanvasElement | null = null;
      if (layer.blurRadius > 0) {
        backdrop = await renderCompositeCanvas(canvasConfig, allLayers, {
          scale: 1,
          stopBeforeIndex: layerIndex,
        });
      }
      if (cancelled) return;

      // Always create a fresh canvas so React & react-konva detect the new image reference immediately
      const out = renderFogToCanvas(layer, backdrop);
      setRenderedCanvas(out);
    };

    computeFog();

    return () => {
      cancelled = true;
    };
  }, [layer, layerIndex, allLayers, canvasConfig]);

  // Force Konva layer batchDraw when offscreen canvas updates in place
  const konvaImgRef = useRef<Konva.Image | null>(null);
  useEffect(() => {
    konvaImgRef.current?.getLayer()?.batchDraw();
  });

  if (!layer.visible || !renderedCanvas) return null;

  return (
    <KonvaImage
      ref={(node) => {
        konvaImgRef.current = node;
        nodeRef(node);
      }}
      id={layer.id}
      image={renderedCanvas}
      x={layer.x + layer.width / 2}
      y={layer.y + layer.height / 2}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      scaleX={layer.flipX ? -1 : 1}
      scaleY={layer.flipY ? -1 : 1}
      opacity={layer.opacity}
      draggable={interactive && !layer.locked}
      listening={interactive && !layer.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        const node = e.target;
        updateLayer(
          layer.id,
          {
            x: Math.round(node.x() - layer.width / 2),
            y: Math.round(node.y() - layer.height / 2),
          },
          true
        );
      }}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Image;
        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());
        node.scaleX(layer.flipX ? -1 : 1);
        node.scaleY(layer.flipY ? -1 : 1);

        const newW = Math.max(8, Math.round(layer.width * scaleX));
        const newH = Math.max(8, Math.round(layer.height * scaleY));

        updateLayer(
          layer.id,
          {
            x: Math.round(node.x() - newW / 2),
            y: Math.round(node.y() - newH / 2),
            width: newW,
            height: newH,
            rotation: Math.round(node.rotation() * 10) / 10,
          },
          true
        );
      }}
    />
  );
};
