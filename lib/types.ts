export type ToolName =
  | "blur"
  | "dither"
  | "line"
  | "slice"
  | "type"
  | "wave"
  | "pixel"
  | "halftone"
  | "outline"
  | "chromatic"
  | "scanline"
  | "warp";

export type FontName =
  | "grotesk"
  | "neo"
  | "geometric"
  | "humanist"
  | "editorial"
  | "didone"
  | "slab"
  | "mono"
  | "terminal"
  | "condensed"
  | "display"
  | "soft";

export type PaletteName = "paper" | "signal" | "blueprint" | "acid" | "night" | "custom";

export type AnimationName =
  | "static"
  | "breathe"
  | "float"
  | "jitter"
  | "orbit"
  | "swing"
  | "drift"
  | "morph";

export type MediaMode = "single" | "sequence";
export type MediaTransition = "cut" | "fade" | "zoom" | "slide";
export type MediaFit = "cover" | "contain";

export type MediaAsset = {
  id: string;
  name: string;
  url: string;
};

export type MediaSettings = {
  mode: MediaMode;
  transition: MediaTransition;
  fit: MediaFit;
  frameDurationMs: number;
  opacity: number;
  showText: boolean;
  activeIndex: number;
};

export type Settings = {
  fontSize: number;
  weight: number;
  font: FontName;
  palette: PaletteName;
  backgroundColor: string;
  foregroundColor: string;
  blur: number;
  layers: number;
  pixelSize: number;
  threshold: number;
  distortion: number;
  invert: boolean;
  lineGap: number;
  lineWidth: number;
  lineAngle: number;
  sliceHeight: number;
  sliceOffset: number;
  stretch: number;
  repeat: number;
  waveAmplitude: number;
  waveFrequency: number;
  waveSlice: number;
  pixelBlock: number;
  halftoneCell: number;
  halftoneScale: number;
  outlineWidth: number;
  outlineLayers: number;
  chromaticOffset: number;
  scanGap: number;
  scanShift: number;
  warpStrength: number;
  warpBands: number;
  animation: AnimationName;
  animationSpeed: number;
  animationIntensity: number;
};

export const defaults: Settings = {
  fontSize: 220,
  weight: 800,
  font: "grotesk",
  palette: "paper",
  backgroundColor: "#ecebe6",
  foregroundColor: "#11110f",
  blur: 7,
  layers: 5,
  pixelSize: 6,
  threshold: 0,
  distortion: 0,
  invert: false,
  lineGap: 11,
  lineWidth: 4,
  lineAngle: 0,
  sliceHeight: 22,
  sliceOffset: 40,
  stretch: 100,
  repeat: 4,
  waveAmplitude: 32,
  waveFrequency: 2.4,
  waveSlice: 8,
  pixelBlock: 12,
  halftoneCell: 13,
  halftoneScale: 92,
  outlineWidth: 3,
  outlineLayers: 4,
  chromaticOffset: 14,
  scanGap: 10,
  scanShift: 22,
  warpStrength: 54,
  warpBands: 12,
  animation: "breathe",
  animationSpeed: 1,
  animationIntensity: 55
};

export const defaultMediaSettings: MediaSettings = {
  mode: "sequence",
  transition: "fade",
  fit: "cover",
  frameDurationMs: 900,
  opacity: 100,
  showText: true,
  activeIndex: 0
};
