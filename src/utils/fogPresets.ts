import type { FogLayer, GradientStop } from '../types/editor';

export interface FogPreset {
  id: string;
  label: string;
  previewCss: string;
  config: Partial<
    Pick<
      FogLayer,
      | 'blurRadius'
      | 'colorIntensity'
      | 'gradientType'
      | 'angle'
      | 'gradientSpread'
      | 'radialCenterX'
      | 'radialCenterY'
      | 'radialInnerRadius'
      | 'radialOuterRadius'
      | 'blurFollowsAlpha'
      | 'borderRadius'
    >
  > & {
    stops: Omit<GradientStop, 'id'>[];
  };
}

export const FOG_PRESETS: FogPreset[] = [
  {
    id: 'white-mist',
    label: 'Sương trắng mờ',
    previewCss: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 100%)',
    config: {
      blurRadius: 24,
      colorIntensity: 0.85,
      gradientType: 'linear',
      angle: 180,
      gradientSpread: 1,
      blurFollowsAlpha: true,
      borderRadius: 0,
      stops: [
        { offset: 0, color: '#ffffff', alpha: 0 },
        { offset: 0.45, color: '#ffffff', alpha: 0.45 },
        { offset: 1, color: '#ffffff', alpha: 0.9 },
      ],
    },
  },
  {
    id: 'dark-cinematic',
    label: 'Sương tối Cinematic',
    previewCss: 'linear-gradient(180deg, rgba(10,14,23,0) 0%, rgba(10,14,23,0.9) 100%)',
    config: {
      blurRadius: 28,
      colorIntensity: 0.9,
      gradientType: 'linear',
      angle: 180,
      gradientSpread: 1,
      blurFollowsAlpha: true,
      borderRadius: 0,
      stops: [
        { offset: 0, color: '#0a0e17', alpha: 0 },
        { offset: 0.5, color: '#0f172a', alpha: 0.55 },
        { offset: 1, color: '#090d16', alpha: 0.92 },
      ],
    },
  },
  {
    id: 'pastel-sky',
    label: 'Sương xanh Pastel',
    previewCss: 'linear-gradient(135deg, rgba(125,211,252,0.75) 0%, rgba(196,181,253,0.15) 100%)',
    config: {
      blurRadius: 20,
      colorIntensity: 0.8,
      gradientType: 'linear',
      angle: 135,
      gradientSpread: 1,
      blurFollowsAlpha: true,
      borderRadius: 0,
      stops: [
        { offset: 0, color: '#7dd3fc', alpha: 0.85 },
        { offset: 0.55, color: '#a5b4fc', alpha: 0.45 },
        { offset: 1, color: '#c4b5fd', alpha: 0 },
      ],
    },
  },
  {
    id: 'vignette-blur',
    label: 'Vignette mờ viền',
    previewCss: 'radial-gradient(circle, rgba(15,23,42,0) 25%, rgba(15,23,42,0.85) 100%)',
    config: {
      blurRadius: 30,
      colorIntensity: 0.75,
      gradientType: 'radial',
      radialCenterX: 0.5,
      radialCenterY: 0.5,
      radialInnerRadius: 0.2,
      radialOuterRadius: 0.95,
      blurFollowsAlpha: true,
      borderRadius: 0,
      stops: [
        { offset: 0, color: '#0f172a', alpha: 0 },
        { offset: 0.55, color: '#0f172a', alpha: 0.35 },
        { offset: 1, color: '#0f172a', alpha: 0.85 },
      ],
    },
  },
];

export interface CanvasSizePreset {
  label: string;
  width: number;
  height: number;
  category: 'wide' | 'square';
}

export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  // Banner / Wide / Portrait
  { label: '2600 × 1080', width: 2600, height: 1080, category: 'wide' },
  { label: '1080 × 2600', width: 1080, height: 2600, category: 'wide' },
  { label: '1920 × 1080', width: 1920, height: 1080, category: 'wide' },
  { label: '1300 × 1080', width: 1300, height: 1080, category: 'wide' },
  { label: '1080 × 1300', width: 1080, height: 1300, category: 'wide' },
  { label: '1280 × 720', width: 1280, height: 720, category: 'wide' },
  { label: '800 × 600', width: 800, height: 600, category: 'wide' },
  { label: '600 × 300', width: 600, height: 300, category: 'wide' },
  // Square / Icon
  { label: '1024 × 1024', width: 1024, height: 1024, category: 'square' },
  { label: '512 × 512', width: 512, height: 512, category: 'square' },
  { label: '256 × 256', width: 256, height: 256, category: 'square' },
  { label: '128 × 128', width: 128, height: 128, category: 'square' },
];
