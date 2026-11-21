export interface CanvasConfig {
  width: number;
  height: number;
  /** null means transparent background (RGBA alpha = 0) */
  backgroundColor: string | null;
}

export interface GradientStop {
  id: string;
  /** 0.0 to 1.0 */
  offset: number;
  /** Hex color, e.g. "#ffffff" */
  color: string;
  /** 0.0 to 1.0 */
  alpha: number;
}

export interface BaseLayer {
  id: string;
  name: string;
  type: 'image' | 'fog';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipX?: boolean;
  flipY?: boolean;
  /** Overall layer alpha (0.0 to 1.0) */
  opacity: number;
  visible: boolean;
  locked: boolean;
  lockAspectRatio: boolean;
}

export interface ColorEditRule {
  id: string;
  sourceColor: string;
  targetColor: string;
  /** 0 to 100 */
  tolerance: number;
  /** 0 to 50 */
  softness: number;
}

export interface BackgroundRemovalConfig {
  enabled: boolean;
  /** Hex color to remove, defaults to "#ffffff" */
  color: string;
  /** 0 to 100 */
  tolerance: number;
  /** 0 to 50 */
  softness: number;
}

export interface ImageAdjustments {
  /** -100 to 100 */
  brightness: number;
  /** -100 to 100 */
  contrast: number;
  /** -100 (cool) to 100 (warm) */
  temperature: number;
  /** -100 (green) to 100 (magenta) */
  tint: number;
  /** -100 to 100 */
  vibrance: number;
  /** -100 to 100 */
  saturation: number;
  colorEdits: ColorEditRule[];
  backgroundRemoval?: BackgroundRemovalConfig;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  adjustments?: ImageAdjustments;
}

export type FadeEdge = 'bottom' | 'top' | 'left' | 'right';

export interface FogLayer extends BaseLayer {
  type: 'fog';
  /** Gaussian blur radius in px (0 to 80) */
  blurRadius: number;
  /** Color overlay intensity (0.0 to 1.0) */
  colorIntensity: number;
  gradientType: 'linear' | 'radial' | 'smooth-fade';
  /** Angle in degrees (0 to 360) for linear gradient */
  angle: number;
  /** Spread / distance multiplier (0.1 to 2.0) for linear gradient */
  gradientSpread: number;
  /** Normalized center X (0.0 to 1.0) for radial gradient */
  radialCenterX: number;
  /** Normalized center Y (0.0 to 1.0) for radial gradient */
  radialCenterY: number;
  /** Normalized inner radius (0.0 to 1.0) for radial gradient */
  radialInnerRadius: number;
  /** Normalized outer radius (0.1 to 1.5) for radial gradient */
  radialOuterRadius: number;
  /** Smooth Fade (BottomFade-style) properties */
  fadeEdge?: FadeEdge;
  fadeEdges?: FadeEdge[];
  fadeOffset?: number;
  fadeHeight?: number;
  fadeColor?: string;
  fadeAlpha?: number;
  /** Whether backdrop blur fades out following gradient stop alpha */
  blurFollowsAlpha: boolean;
  /** Corner radius in px */
  borderRadius: number;
  stops: GradientStop[];
}

export type Layer = ImageLayer | FogLayer;

export type ToolType = 'select' | 'crop' | 'eyedropper' | 'magic-eraser';

export type MagicEraserMode = 'flood' | 'circle';

export type AlphaPreviewMode = 'checker-dark' | 'checker-light' | 'solid-black';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type EyedropperTarget =
  | { kind: 'fog-stop'; layerId: string; stopId: string }
  | { kind: 'fog-fade'; layerId: string }
  | { kind: 'bg-remove'; layerId: string }
  | {
    kind: 'color-edit';
    layerId: string;
    ruleId: string;
    field: 'sourceColor' | 'targetColor';
  };

export interface EditorSnapshot {
  canvas: CanvasConfig;
  layers: Layer[];
  selectedLayerId: string | null;
}

export type PanelMode = 'merged' | 'split';

export interface PanelLayoutConfig {
  mode: PanelMode;
  rightWidth: number;
  leftLayersWidth: number;
  splitRatio: number;
}

export interface EditorEnvironment {
  panelLayout: PanelLayoutConfig;
  zoom: number;
  alphaPreviewMode: AlphaPreviewMode;
  selectedLayerId: string | null;
  lastExportName: string | null;
}

export interface ProjectFile {
  version: 1;
  name: string;
  savedAt: string;
  canvas: CanvasConfig;
  layers: Layer[];
  environment?: EditorEnvironment;
}

export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';
