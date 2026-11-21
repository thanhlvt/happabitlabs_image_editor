import React, { useEffect, useRef } from 'react';
import { Group, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { CropRect } from '../../types/editor';
import { clampCropRect } from '../../utils/geometry';

interface CropOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  cropRect: CropRect;
  aspectRatio: number | null;
  onChange: (rect: CropRect) => void;
}

export const CropOverlay: React.FC<CropOverlayProps> = ({
  canvasWidth,
  canvasHeight,
  cropRect,
  aspectRatio,
  onChange,
}) => {
  const rectRef = useRef<Konva.Rect | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);

  useEffect(() => {
    if (trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [cropRect]);

  return (
    <Group>
      {/* Dimmed outside regions */}
      <Rect
        x={0}
        y={0}
        width={canvasWidth}
        height={cropRect.y}
        fill="rgba(0,0,0,0.58)"
        listening={false}
      />
      <Rect
        x={0}
        y={cropRect.y + cropRect.height}
        width={canvasWidth}
        height={Math.max(0, canvasHeight - (cropRect.y + cropRect.height))}
        fill="rgba(0,0,0,0.58)"
        listening={false}
      />
      <Rect
        x={0}
        y={cropRect.y}
        width={cropRect.x}
        height={cropRect.height}
        fill="rgba(0,0,0,0.58)"
        listening={false}
      />
      <Rect
        x={cropRect.x + cropRect.width}
        y={cropRect.y}
        width={Math.max(0, canvasWidth - (cropRect.x + cropRect.width))}
        height={cropRect.height}
        fill="rgba(0,0,0,0.58)"
        listening={false}
      />

      {/* Interactive crop selection box */}
      <Rect
        ref={rectRef}
        x={cropRect.x}
        y={cropRect.y}
        width={cropRect.width}
        height={cropRect.height}
        stroke="#3b82f6"
        strokeWidth={2}
        dash={[6, 4]}
        draggable
        dragBoundFunc={(pos) => ({
          x: Math.max(0, Math.min(pos.x, canvasWidth - cropRect.width)),
          y: Math.max(0, Math.min(pos.y, canvasHeight - cropRect.height)),
        })}
        onDragMove={(e) => {
          onChange(
            clampCropRect(
              {
                x: e.target.x(),
                y: e.target.y(),
                width: cropRect.width,
                height: cropRect.height,
              },
              canvasWidth,
              canvasHeight
            )
          );
        }}
        onTransformEnd={() => {
          const node = rectRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);

          const next = clampCropRect(
            {
              x: node.x(),
              y: node.y(),
              width: node.width() * scaleX,
              height: node.height() * scaleY,
            },
            canvasWidth,
            canvasHeight
          );
          onChange(next);
        }}
      />

      <Transformer
        ref={trRef}
        rotateEnabled={false}
        keepRatio={Boolean(aspectRatio)}
        anchorSize={9}
        borderStroke="#3b82f6"
        anchorStroke="#3b82f6"
        anchorFill="#ffffff"
        boundBoxFunc={(oldBox, newBox) => {
          if (newBox.width < 16 || newBox.height < 16) return oldBox;
          return newBox;
        }}
      />
    </Group>
  );
};
