import React, { useEffect, useMemo, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { ImageLayer } from '../../types/editor';
import { useEditorStore } from '../../store/useEditorStore';
import {
  applyImageAdjustmentsToCanvas,
  hasActiveAdjustments,
} from '../../utils/imageFilters';
import { createLayerMaskFromSelection } from '../../utils/selectionUtils';

interface ImageNodeProps {
  layer: ImageLayer;
  isSelected: boolean;
  interactive: boolean;
  onSelect: () => void;
  nodeRef: (node: Konva.Image | null) => void;
}

export const ImageNode: React.FC<ImageNodeProps> = ({
  layer,
  isSelected,
  interactive,
  onSelect,
  nodeRef,
}) => {
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const selection = useEditorStore((s) => s.selection);

  useEffect(() => {
    let active = true;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (active) setImageEl(img);
    };
    img.src = layer.src;
    return () => {
      active = false;
    };
  }, [layer.src]);

  const { drawable, cropRect } = useMemo(() => {
    if (!imageEl) {
      return {
        drawable: null,
        cropRect: {
          x: layer.cropX,
          y: layer.cropY,
          width: layer.cropWidth,
          height: layer.cropHeight,
        },
      };
    }

    if (!hasActiveAdjustments(layer.adjustments)) {
      return {
        drawable: imageEl,
        cropRect: {
          x: layer.cropX,
          y: layer.cropY,
          width: layer.cropWidth,
          height: layer.cropHeight,
        },
      };
    }

    const natW = imageEl.naturalWidth || imageEl.width || 1;
    const natH = imageEl.naturalHeight || imageEl.height || 1;
    const maxDim = 1600;
    let targetW = natW;
    let targetH = natH;
    if (targetW > maxDim || targetH > maxDim) {
      const s = Math.min(maxDim / targetW, maxDim / targetH);
      targetW = Math.max(1, Math.round(targetW * s));
      targetH = Math.max(1, Math.round(targetH * s));
    }

    const activeSelMask =
      selection && isSelected
        ? createLayerMaskFromSelection(layer, selection, targetW, targetH)
        : undefined;

    const filtered = applyImageAdjustmentsToCanvas(
      imageEl,
      layer.adjustments,
      1600,
      activeSelMask
    );
    const scaleRatio = filtered.width / natW;

    return {
      drawable: filtered,
      cropRect: {
        x: layer.cropX * scaleRatio,
        y: layer.cropY * scaleRatio,
        width: layer.cropWidth * scaleRatio,
        height: layer.cropHeight * scaleRatio,
      },
    };
  }, [
    imageEl,
    layer,
    isSelected,
    selection,
  ]);

  if (!layer.visible || !drawable) return null;

  return (
    <KonvaImage
      ref={nodeRef}
      id={layer.id}
      image={drawable}
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
      crop={cropRect}
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

        const newW = Math.max(4, Math.round(layer.width * scaleX));
        const newH = Math.max(4, Math.round(layer.height * scaleY));

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
