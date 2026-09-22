"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { exportGif } from "@/lib/exportGif";
import { loadMediaImage, MAX_MEDIA_ASSETS, MAX_MEDIA_FILE_BYTES, SUPPORTED_MEDIA_TYPES } from "@/lib/media";
import { FONT_STACKS } from "@/lib/renderType";
import {
  defaultMediaSettings,
  defaults,
  type AnimationName,
  type FontName,
  type MediaAsset,
  type MediaSettings,
  type Settings,
  type ToolName
} from "@/lib/types";
import { Range } from "./Range";
import { TypeCanvas } from "./TypeCanvas";

const tools: Array<{ id: ToolName; number: string; glyph: string; description: string }> = [
  { id: "blur", number: "01", glyph: "◌", description: "Layered blur turns hard letterforms into a soft typographic field." },
  { id: "dither", number: "02", glyph: "⠿", description: "Ordered thresholds break type into a responsive pixel texture." },
  { id: "line", number: "03", glyph: "≡", description: "A line screen intersects the letterform like a print experiment." },
  { id: "slice", number: "04", glyph: "↔", description: "Horizontal bands displace alternating fragments of the word." },
  { id: "type", number: "05", glyph: "Aa", description: "Repeated impressions stretch one word into a dimensional object." },
  { id: "wave", number: "06", glyph: "∿", description: "Vertical strips move through a sine wave for a liquid typographic bend." },
  { id: "pixel", number: "07", glyph: "▦", description: "Letterforms collapse into a coarse modular pixel grid." },
  { id: "halftone", number: "08", glyph: "⠐", description: "Circular print dots rebuild the type as a halftone field." },
  { id: "outline", number: "09", glyph: "□", description: "Layered contours turn filled type into a graphic wireframe." },
  { id: "chromatic", number: "10", glyph: "RGB", description: "Offset color channels create registration-error and screen-print energy." },
  { id: "scanline", number: "11", glyph: "▤", description: "Interrupted horizontal scans shift parts of the glyph like a broken display." },
  { id: "warp", number: "12", glyph: "≈", description: "Stacked bands stretch and push the word into a warped poster form." }
];

const shuffleWords = ["FORM", "NOISE", "SHIFT", "SIGNAL", "GLYPH", "MATTER", "SYSTEM", "PRINT", "WARP", "MOTION"];

type FontCategory = "all" | "sans" | "serif" | "mono" | "display";
const fonts: Array<{ id: FontName; label: string; category: Exclude<FontCategory, "all">; sample: string; stack: string }> = [
  { id: "grotesk", label: "Grotesk", category: "sans", sample: "Ag", stack: FONT_STACKS.grotesk },
  { id: "neo", label: "Neo", category: "sans", sample: "Ag", stack: FONT_STACKS.neo },
  { id: "geometric", label: "Geometric", category: "sans", sample: "Ag", stack: FONT_STACKS.geometric },
  { id: "humanist", label: "Humanist", category: "sans", sample: "Ag", stack: FONT_STACKS.humanist },
  { id: "editorial", label: "Editorial", category: "serif", sample: "Ag", stack: FONT_STACKS.editorial },
  { id: "didone", label: "Didone", category: "serif", sample: "Ag", stack: FONT_STACKS.didone },
  { id: "slab", label: "Slab", category: "serif", sample: "Ag", stack: FONT_STACKS.slab },
  { id: "mono", label: "Mono", category: "mono", sample: "Ag", stack: FONT_STACKS.mono },
  { id: "terminal", label: "Terminal", category: "mono", sample: "Ag", stack: FONT_STACKS.terminal },
  { id: "condensed", label: "Condensed", category: "display", sample: "Ag", stack: FONT_STACKS.condensed },
  { id: "display", label: "Impact", category: "display", sample: "Ag", stack: FONT_STACKS.display },
  { id: "soft", label: "Soft", category: "display", sample: "Ag", stack: FONT_STACKS.soft }
];

const palettes = [
  { id: "paper" as const, label: "Paper", colors: ["#ecebe6", "#11110f"] as const },
  { id: "signal" as const, label: "Signal", colors: ["#ff4a2f", "#11110f"] as const },
  { id: "blueprint" as const, label: "Blue", colors: ["#1647ff", "#f4f1e8"] as const },
  { id: "acid" as const, label: "Acid", colors: ["#dfff00", "#151515"] as const },
  { id: "night" as const, label: "Night", colors: ["#11110f", "#ecebe6"] as const }
];

const colorSwatches = ["#11110f", "#ecebe6", "#ff4a2f", "#1647ff", "#dfff00", "#ff2a8a", "#00c8ff", "#ffdd00"];

const animations: Array<{ id: AnimationName; label: string; glyph: string; description: string }> = [
  { id: "static", label: "Static", glyph: "■", description: "No motion." },
  { id: "breathe", label: "Breathe", glyph: "◉", description: "Soft scale pulse." },
  { id: "float", label: "Float", glyph: "↕", description: "Vertical suspension." },
  { id: "jitter", label: "Jitter", glyph: "⌁", description: "Fast imperfect vibration." },
  { id: "orbit", label: "Orbit", glyph: "◎", description: "Circular positional loop." },
  { id: "swing", label: "Swing", glyph: "⤢", description: "Rotational pendulum." },
  { id: "drift", label: "Drift", glyph: "→", description: "Horizontal kinetic movement." },
  { id: "morph", label: "Morph", glyph: "≈", description: "Animates the active effect parameters." }
];

type Theme = "light" | "dark";
type Preset = { label: string; values: Partial<Settings> };

const presets: Record<ToolName, Preset[]> = {
  blur: [
    { label: "Mist", values: { blur: 6, layers: 8 } },
    { label: "Ghost", values: { blur: 18, layers: 5 } },
    { label: "Bloom", values: { blur: 11, layers: 11 } }
  ],
  dither: [
    { label: "Fine", values: { pixelSize: 3, threshold: 0, distortion: 0 } },
    { label: "Block", values: { pixelSize: 10, threshold: -4, distortion: 0 } },
    { label: "Broken", values: { pixelSize: 7, threshold: 4, distortion: 11 } }
  ],
  line: [
    { label: "Hairline", values: { lineGap: 8, lineWidth: 1, lineAngle: 0 } },
    { label: "Poster", values: { lineGap: 15, lineWidth: 7, lineAngle: 0 } },
    { label: "Tilt", values: { lineGap: 11, lineWidth: 3, lineAngle: -24 } }
  ],
  slice: [
    { label: "Fine", values: { sliceHeight: 8, sliceOffset: 26 } },
    { label: "Signal", values: { sliceHeight: 20, sliceOffset: 64 } },
    { label: "Break", values: { sliceHeight: 42, sliceOffset: 124 } }
  ],
  type: [
    { label: "Echo", values: { stretch: 100, repeat: 6 } },
    { label: "Wide", values: { stretch: 132, repeat: 4 } },
    { label: "Dense", values: { stretch: 75, repeat: 9 } }
  ],
  wave: [
    { label: "Soft", values: { waveAmplitude: 18, waveFrequency: 1.5, waveSlice: 6 } },
    { label: "Liquid", values: { waveAmplitude: 48, waveFrequency: 2.8, waveSlice: 5 } },
    { label: "Tight", values: { waveAmplitude: 28, waveFrequency: 5.2, waveSlice: 3 } }
  ],
  pixel: [
    { label: "Fine", values: { pixelBlock: 7 } },
    { label: "Arcade", values: { pixelBlock: 14 } },
    { label: "Mega", values: { pixelBlock: 24 } }
  ],
  halftone: [
    { label: "Print", values: { halftoneCell: 10, halftoneScale: 88 } },
    { label: "Coarse", values: { halftoneCell: 18, halftoneScale: 100 } },
    { label: "Dust", values: { halftoneCell: 7, halftoneScale: 62 } }
  ],
  outline: [
    { label: "Wire", values: { outlineWidth: 1, outlineLayers: 2 } },
    { label: "Contour", values: { outlineWidth: 3, outlineLayers: 5 } },
    { label: "Heavy", values: { outlineWidth: 6, outlineLayers: 7 } }
  ],
  chromatic: [
    { label: "Tight", values: { chromaticOffset: 5 } },
    { label: "Print", values: { chromaticOffset: 14 } },
    { label: "Split", values: { chromaticOffset: 30 } }
  ],
  scanline: [
    { label: "CRT", values: { scanGap: 7, scanShift: 8 } },
    { label: "Broken", values: { scanGap: 12, scanShift: 35 } },
    { label: "Sparse", values: { scanGap: 20, scanShift: 18 } }
  ],
  warp: [
    { label: "Soft", values: { warpStrength: 24, warpBands: 18 } },
    { label: "Poster", values: { warpStrength: 62, warpBands: 12 } },
    { label: "Melt", values: { warpStrength: 105, warpBands: 22 } }
  ]
};

function PresetStrip({ tool, apply }: { tool: ToolName; apply: (values: Partial<Settings>) => void }) {
  return (
    <div className="controlBlock">
      <div className="controlHeading">Quick states</div>
      <div className="chipRow">
        {presets[tool].map((preset) => (
          <button key={preset.label} type="button" className="chip" onClick={() => apply(preset.values)}>
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToolControls({
  tool,
  settings,
  set
}: {
  tool: ToolName;
  settings: Settings;
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
}) {
  return (
    <div className="parameterList" aria-label={`${tool} parameters`}>
      {tool === "blur" && <>
        <Range label="Blur" value={settings.blur} min={0} max={28} onChange={(v) => set("blur", v)} />
        <Range label="Layers" value={settings.layers} min={1} max={12} onChange={(v) => set("layers", v)} />
      </>}
      {tool === "dither" && <>
        <Range label="Pixel" value={settings.pixelSize} min={2} max={18} onChange={(v) => set("pixelSize", v)} />
        <Range label="Threshold" value={settings.threshold} min={-35} max={35} suffix="%" onChange={(v) => set("threshold", v)} />
        <Range label="Distort" value={settings.distortion} min={0} max={14} onChange={(v) => set("distortion", v)} />
        <button className={`switchRow ${settings.invert ? "isOn" : ""}`} onClick={() => set("invert", !settings.invert)} aria-pressed={settings.invert}>
          <span>Invert pixels</span><span className="switchTrack"><i /></span>
        </button>
      </>}
      {tool === "line" && <>
        <Range label="Gap" value={settings.lineGap} min={4} max={32} onChange={(v) => set("lineGap", v)} />
        <Range label="Stroke" value={settings.lineWidth} min={1} max={12} onChange={(v) => set("lineWidth", v)} />
        <Range label="Angle" value={settings.lineAngle} min={-45} max={45} suffix="°" onChange={(v) => set("lineAngle", v)} />
      </>}
      {tool === "slice" && <>
        <Range label="Band" value={settings.sliceHeight} min={4} max={64} onChange={(v) => set("sliceHeight", v)} />
        <Range label="Offset" value={settings.sliceOffset} min={0} max={160} onChange={(v) => set("sliceOffset", v)} />
      </>}
      {tool === "type" && <>
        <Range label="Stretch" value={settings.stretch} min={45} max={160} suffix="%" onChange={(v) => set("stretch", v)} />
        <Range label="Repeat" value={settings.repeat} min={1} max={11} onChange={(v) => set("repeat", v)} />
      </>}
      {tool === "wave" && <>
        <Range label="Amplitude" value={settings.waveAmplitude} min={0} max={90} onChange={(v) => set("waveAmplitude", v)} />
        <Range label="Frequency" value={settings.waveFrequency} min={0.5} max={7} step={0.1} onChange={(v) => set("waveFrequency", v)} />
        <Range label="Slice" value={settings.waveSlice} min={2} max={18} onChange={(v) => set("waveSlice", v)} />
      </>}
      {tool === "pixel" && <Range label="Block" value={settings.pixelBlock} min={4} max={34} onChange={(v) => set("pixelBlock", v)} />}
      {tool === "halftone" && <>
        <Range label="Cell" value={settings.halftoneCell} min={5} max={30} onChange={(v) => set("halftoneCell", v)} />
        <Range label="Dot" value={settings.halftoneScale} min={35} max={120} suffix="%" onChange={(v) => set("halftoneScale", v)} />
      </>}
      {tool === "outline" && <>
        <Range label="Stroke" value={settings.outlineWidth} min={1} max={8} onChange={(v) => set("outlineWidth", v)} />
        <Range label="Layers" value={settings.outlineLayers} min={1} max={9} onChange={(v) => set("outlineLayers", v)} />
      </>}
      {tool === "chromatic" && <Range label="Offset" value={settings.chromaticOffset} min={0} max={45} onChange={(v) => set("chromaticOffset", v)} />}
      {tool === "scanline" && <>
        <Range label="Gap" value={settings.scanGap} min={4} max={28} onChange={(v) => set("scanGap", v)} />
        <Range label="Shift" value={settings.scanShift} min={0} max={70} onChange={(v) => set("scanShift", v)} />
      </>}
      {tool === "warp" && <>
        <Range label="Strength" value={settings.warpStrength} min={0} max={130} onChange={(v) => set("warpStrength", v)} />
        <Range label="Bands" value={settings.warpBands} min={3} max={30} onChange={(v) => set("warpBands", v)} />
      </>}
    </div>
  );
}

function roundToStep(value: number, step: number) {
  return Math.round(value / step) * step;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TypePlayground() {
  const [tool, setTool] = useState<ToolName>("dither");
  const [text, setText] = useState("");
  const [settings, setSettings] = useState<Settings>(defaults);
  const [theme, setTheme] = useState<Theme>("light");
  const [fontCategory, setFontCategory] = useState<FontCategory>("all");
  const [previewPaused, setPreviewPaused] = useState(false);
  const [gifStatus, setGifStatus] = useState<string>("");
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaSettings, setMediaSettings] = useState<MediaSettings>(defaultMediaSettings);
  const [mediaMessage, setMediaMessage] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const mediaAssetsRef = useRef<MediaAsset[]>([]);

  const preferredTheme = (): Theme => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  // Deliberately not a lazy useState initializer: matchMedia isn't
  // available during SSR, and computing the real theme only on the client's
  // first render (post-hydration) would mismatch the server-rendered
  // "light" HTML. Defaulting to "light" everywhere and correcting here,
  // after mount, avoids that hydration mismatch at the cost of one extra
  // client-only render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    setTheme(preferredTheme());
  }, []);

  useEffect(() => {
    mediaAssetsRef.current = mediaAssets;
  }, [mediaAssets]);

  useEffect(() => () => {
    mediaAssetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.url));
  }, []);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((state) => ({ ...state, [key]: value }));
  const activeTool = useMemo(() => tools.find((item) => item.id === tool) ?? tools[0], [tool]);
  const activeAnimation = useMemo(() => animations.find((item) => item.id === settings.animation) ?? animations[0], [settings.animation]);
  const visibleFonts = useMemo(() => fonts.filter((font) => fontCategory === "all" || font.category === fontCategory), [fontCategory]);
  const canExport = text.trim().length > 0 || mediaAssets.length > 0;

  const setMedia = <K extends keyof MediaSettings>(key: K, value: MediaSettings[K]) =>
    setMediaSettings((state) => ({ ...state, [key]: value }));

  const addMediaFiles = async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (!incoming.length) return;
    const available = Math.max(0, MAX_MEDIA_ASSETS - mediaAssets.length);
    const candidates: MediaAsset[] = [];
    let rejected = 0;

    for (const file of incoming.slice(0, available)) {
      if (!SUPPORTED_MEDIA_TYPES.has(file.type) || file.size > MAX_MEDIA_FILE_BYTES) {
        rejected++;
        continue;
      }
      candidates.push({
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        name: file.name,
        url: URL.createObjectURL(file)
      });
    }

    if (!candidates.length) {
      setMediaMessage("Use JPG, PNG or WebP up to 12 MB each.");
      return;
    }

    setMediaMessage(candidates.length === 1 ? "Checking image…" : `Checking ${candidates.length} images…`);

    // Decode (and pixel-cap-check) each candidate before it ever becomes a
    // media asset. A slot that silently fails later would still count
    // toward the sequence's frame count and duration — better to reject it
    // here than leave a blank gap in the playback.
    const accepted: MediaAsset[] = [];
    for (const candidate of candidates) {
      try {
        await loadMediaImage(candidate.url);
        accepted.push(candidate);
      } catch (error) {
        console.error(error);
        URL.revokeObjectURL(candidate.url);
        rejected++;
      }
    }

    if (!accepted.length) {
      setMediaMessage("Those files couldn't be used — try different images.");
      return;
    }

    let newTotalLength = 0;
    setMediaAssets((current) => {
      const next = [...current, ...accepted].slice(0, MAX_MEDIA_ASSETS);
      newTotalLength = next.length;
      return next;
    });
    setMediaSettings((current) => ({ ...current, activeIndex: current.activeIndex < newTotalLength ? current.activeIndex : 0 }));
    setMediaMessage(rejected || incoming.length > available ? `Added ${accepted.length}. Some files were skipped.` : `Added ${accepted.length} image${accepted.length === 1 ? "" : "s"}.`);
    window.setTimeout(() => setMediaMessage(""), 2200);
  };

  const removeMedia = (id: string) => {
    setMediaAssets((current) => {
      const asset = current.find((item) => item.id === id);
      if (asset) URL.revokeObjectURL(asset.url);
      const next = current.filter((item) => item.id !== id);
      setMediaSettings((settings) => ({
        ...settings,
        activeIndex: Math.min(settings.activeIndex, Math.max(0, next.length - 1)),
        // The "Show text layer" switch only exists in the UI while media is
        // present, so a false value must not survive past the last image —
        // otherwise typed text becomes unreachable with an empty stage.
        showText: next.length === 0 ? true : settings.showText
      }));
      return next;
    });
  };

  const moveMedia = (id: string, direction: -1 | 1) => {
    setMediaAssets((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const clearMedia = () => {
    mediaAssets.forEach((asset) => URL.revokeObjectURL(asset.url));
    setMediaAssets([]);
    setMediaSettings(defaultMediaSettings);
    setMediaMessage("");
  };

  const setPalette = (item: (typeof palettes)[number]) => {
    setSettings((state) => ({ ...state, palette: item.id, backgroundColor: item.colors[0], foregroundColor: item.colors[1] }));
  };

  const setCustomColor = (key: "backgroundColor" | "foregroundColor", value: string) => {
    setSettings((state) => ({ ...state, palette: "custom", [key]: value }));
  };

  const randomize = () => {
    const selectedPalette = palettes[Math.floor(Math.random() * palettes.length)];
    const selectedAnimation = animations[1 + Math.floor(Math.random() * (animations.length - 1))];
    setText(shuffleWords[Math.floor(Math.random() * shuffleWords.length)]);
    setTool(tools[Math.floor(Math.random() * tools.length)].id);
    setSettings((state) => ({
      ...state,
      fontSize: 140 + Math.floor(Math.random() * 180),
      weight: [400, 600, 700, 800, 900][Math.floor(Math.random() * 5)],
      font: fonts[Math.floor(Math.random() * fonts.length)].id,
      palette: selectedPalette.id,
      backgroundColor: selectedPalette.colors[0],
      foregroundColor: selectedPalette.colors[1],
      animation: selectedAnimation.id,
      // Match the Speed/Frequency sliders' own step so a randomized value
      // doesn't display as an odd number like "1.137843…×" that the slider
      // itself could never produce.
      animationSpeed: roundToStep(0.6 + Math.random() * 1.2, 0.05),
      animationIntensity: 35 + Math.floor(Math.random() * 55),
      blur: Math.floor(Math.random() * 18),
      pixelSize: 3 + Math.floor(Math.random() * 10),
      distortion: Math.floor(Math.random() * 10),
      lineGap: 6 + Math.floor(Math.random() * 18),
      lineWidth: 1 + Math.floor(Math.random() * 7),
      lineAngle: -20 + Math.floor(Math.random() * 40),
      sliceHeight: 8 + Math.floor(Math.random() * 35),
      sliceOffset: 20 + Math.floor(Math.random() * 100),
      stretch: 70 + Math.floor(Math.random() * 60),
      repeat: 2 + Math.floor(Math.random() * 6),
      waveAmplitude: 10 + Math.floor(Math.random() * 70),
      waveFrequency: roundToStep(1 + Math.random() * 5, 0.1),
      pixelBlock: 6 + Math.floor(Math.random() * 22),
      halftoneCell: 7 + Math.floor(Math.random() * 18),
      outlineWidth: 1 + Math.floor(Math.random() * 6),
      chromaticOffset: 3 + Math.floor(Math.random() * 30),
      scanGap: 5 + Math.floor(Math.random() * 18),
      scanShift: Math.floor(Math.random() * 50),
      warpStrength: 15 + Math.floor(Math.random() * 90)
    }));
    setPreviewPaused(false);
  };

  const reset = () => {
    // "Reset all" means all — tool, font category and theme were previously
    // left untouched, which didn't match what the button claimed to do.
    setSettings(defaults);
    setText("");
    setTool("dither");
    setFontCategory("all");
    setTheme(preferredTheme());
    clearMedia();
    setPreviewPaused(false);
  };
  const applyPreset = (values: Partial<Settings>) => setSettings((current) => ({ ...current, ...values }));

  const exportPng = () => {
    if (!canExport) return;
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `glyph-lab-${tool}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleExportGif = async () => {
    if (!canExport || gifStatus) return;
    const source = stageRef.current?.querySelector("canvas");
    if (!source) return;

    try {
      const blob = await exportGif({
        tool,
        text,
        settings,
        mediaSettings,
        mediaAssets,
        sourceCanvas: source,
        onProgress: setGifStatus
      });
      const label = mediaAssets.length && !text.trim() ? "media" : `${tool}-${settings.animation}`;
      downloadBlob(blob, `glyph-lab-${label}.gif`);
      setGifStatus("GIF ready");
      window.setTimeout(() => setGifStatus(""), 1500);
    } catch (error) {
      console.error(error);
      setGifStatus("GIF export failed");
      window.setTimeout(() => setGifStatus(""), 2500);
    }
  };

  return (
    <main className={`appShell ${theme === "dark" ? "themeDark" : "themeLight"}`}>
      <header className="topbar">
        <div className="brandGroup">
          {/* The page's only h1: nothing else here was a real heading, which
              breaks screen-reader page-structure navigation. display:contents
              (see globals.css) keeps it visually invisible as an element. */}
          <h1><a className="brand" href="#workspace">GLYPH/LAB</a></h1>
          <span className="version">{tools.length} FX · {animations.length} MOTION · MEDIA</span>
        </div>
        <div className="toolStatus" aria-live="polite">
          <span>{activeTool.number}</span>
          <strong>{activeTool.id}</strong>
          <span>{activeAnimation.label} · realtime type processor</span>
        </div>
        <div className="topActions">
          {/* Also randomizes the text, not just the visual settings, so the
              accessible name says "everything" rather than "settings". */}
          <button type="button" onClick={randomize} aria-label="Shuffle everything"><span>Shuffle</span><b>↝</b></button>
          <button
            type="button"
            onClick={() => setPreviewPaused((value) => !value)}
            aria-pressed={previewPaused}
            aria-label={previewPaused ? "Play preview" : "Pause preview"}
          >
            <span>{previewPaused ? "Play" : "Pause"}</span><b>{previewPaused ? "▶" : "Ⅱ"}</b>
          </button>
          <button type="button" onClick={() => setTheme((value) => value === "light" ? "dark" : "light")} aria-label="Toggle theme"><span>Theme</span><b>◐</b></button>
          <button type="button" className="exportAction" onClick={exportPng} disabled={!canExport} aria-label="Export PNG"><span>PNG</span><b>↓</b></button>
          <button type="button" className="exportAction gifAction" onClick={handleExportGif} disabled={!canExport || Boolean(gifStatus)} aria-label="Export GIF"><span>GIF</span><b>◉</b></button>
        </div>
      </header>

      <section id="workspace" className="workspace">
        <nav className="toolRail" aria-label="Typography effects">
          {tools.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tool === item.id ? "active" : ""}
              onClick={() => setTool(item.id)}
              aria-pressed={tool === item.id}
              aria-label={`${item.id} effect`}
            >
              <span className="toolNumber">{item.number}</span>
              <span className="toolGlyph" aria-hidden="true">{item.glyph}</span>
              <span className="toolName">{item.id}</span>
            </button>
          ))}
        </nav>

        <div className="stageColumn">
          <div className="stageMeta">
            <div><span>Input</span><strong>{text.trim() || (mediaAssets.length ? `${mediaAssets.length} IMAGE${mediaAssets.length === 1 ? "" : "S"}` : "YOUR TEXT")}</strong></div>
            <div><span>Mode</span><strong>{activeTool.id} / {activeAnimation.label}</strong></div>
            <div className="stageMetaDescription">{activeTool.description}</div>
          </div>
          <div className="stage" ref={stageRef} style={{ background: settings.backgroundColor }}>
            <TypeCanvas
              tool={tool}
              text={text}
              settings={settings}
              mediaAssets={mediaAssets}
              mediaSettings={mediaSettings}
              paused={previewPaused}
            />
            {!text.trim() && !mediaAssets.length && (
              <div className="emptyStageHint">
                <span>Start here</span>
                <strong>TYPE YOUR OWN TEXT →</strong>
                <small>The canvas stays empty until you enter something.</small>
              </div>
            )}
            {!text.trim() && mediaAssets.length > 0 && <div className="imageOnlyBadge">IMAGE-ONLY GIF MODE</div>}
            <div className="stageGrid" aria-hidden="true" />
            <div className="stageBadge" aria-hidden="true">LIVE<br />CANVAS</div>
            {gifStatus && <div className="exportStatus" role="status">{gifStatus}</div>}
          </div>
        </div>

        <aside className="inspector" aria-label="Type controls">
          <section className="inspectorSection inputSection">
            <div className="sectionHeader"><span>01</span><h2>Content</h2></div>
            <label className="textControl">
              <span>Your text</span>
              <input
                aria-label="Your text"
                value={text}
                maxLength={48}
                onChange={(event) => setText(event.target.value)}
                placeholder="Type anything…"
                spellCheck={false}
                autoComplete="off"
              />
              <small>{text.length}/48 · case and spaces are preserved</small>
            </label>

            <div className="controlBlock">
              <div className="controlHeading">Typeface family</div>
              <div className="categoryTabs" role="group" aria-label="Typeface categories">
                {(["all", "sans", "serif", "mono", "display"] as FontCategory[]).map((category) => (
                  <button key={category} type="button" className={fontCategory === category ? "isSelected" : ""} onClick={() => setFontCategory(category)}>
                    {category}
                  </button>
                ))}
              </div>
              <div className="fontGrid expandedFonts">
                {visibleFonts.map((font) => (
                  <button
                    type="button"
                    key={font.id}
                    className={settings.font === font.id ? "isSelected" : ""}
                    onClick={() => set("font", font.id)}
                    aria-pressed={settings.font === font.id}
                    aria-label={font.label}
                  >
                    <strong style={{ fontFamily: font.stack }}>{font.sample}</strong><span>{font.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <Range label="Size" value={settings.fontSize} min={72} max={430} onChange={(value) => set("fontSize", value)} />
            <Range label="Weight" value={settings.weight} min={200} max={900} step={100} onChange={(value) => set("weight", value)} />
          </section>

          <section className="inspectorSection">
            <div className="sectionHeader"><span>02</span><h2>Effect</h2></div>
            <PresetStrip tool={tool} apply={applyPreset} />
            <ToolControls tool={tool} settings={settings} set={set} />
          </section>

          <section className="inspectorSection motionSection">
            <div className="sectionHeader"><span>03</span><h2>Motion</h2></div>
            <div className="motionGrid" role="group" aria-label="Animation presets">
              {animations.map((animation) => (
                <button
                  key={animation.id}
                  type="button"
                  className={settings.animation === animation.id ? "isSelected" : ""}
                  onClick={() => {
                    set("animation", animation.id);
                    setPreviewPaused(false);
                  }}
                  aria-pressed={settings.animation === animation.id}
                  title={animation.description}
                >
                  <strong>{animation.glyph}</strong>
                  <span>{animation.label}</span>
                </button>
              ))}
            </div>
            <Range label="Speed" value={settings.animationSpeed} min={0.25} max={2.5} step={0.05} suffix="×" onChange={(value) => set("animationSpeed", value)} />
            <Range label="Intensity" value={settings.animationIntensity} min={0} max={100} suffix="%" onChange={(value) => set("animationIntensity", value)} />
            <p className="motionNote">GIF export loops seamlessly at the Speed above, 12 fps (10 fps with images), 2–6s. Reduced-motion users see a static preview.</p>
          </section>

          <section className="inspectorSection mediaSection">
            <div className="sectionHeader"><span>04</span><h2>Media / GIF</h2></div>
            <label
              className="mediaDropzone"
              onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("isDragging"); }}
              onDragLeave={(event) => event.currentTarget.classList.remove("isDragging")}
              onDrop={(event) => {
                event.preventDefault();
                event.currentTarget.classList.remove("isDragging");
                addMediaFiles(event.dataTransfer.files);
              }}
            >
              <input
                aria-label="Upload background images"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(event) => {
                  if (event.target.files) addMediaFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <strong>ADD IMAGES +</strong>
              <span>Drop or choose up to {MAX_MEDIA_ASSETS} JPG / PNG / WebP files</span>
            </label>
            {mediaMessage && <p className="mediaMessage" role="status">{mediaMessage}</p>}

            {mediaAssets.length > 0 && (
              <>
                <div className="mediaThumbs" aria-label="Uploaded image sequence">
                  {mediaAssets.map((asset, index) => (
                    <div
                      key={asset.id}
                      className={`mediaThumb ${
                        mediaSettings.mode === "single" && mediaSettings.activeIndex === index ? "isSelected" : ""
                      }`}
                    >
                      <button type="button" className="mediaPreview" onClick={() => setMedia("activeIndex", index)} aria-label={`Select ${asset.name}`}>
                        {/* next/image optimizes remote/static assets; these are
                            ephemeral client-side blob: URLs with nothing to fetch
                            or optimize, so a plain img is the right tool here. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.url} alt="" />
                        <span>{String(index + 1).padStart(2, "0")}</span>
                      </button>
                      <div className="mediaThumbActions">
                        <button type="button" onClick={() => moveMedia(asset.id, -1)} disabled={index === 0} aria-label={`Move ${asset.name} left`}>←</button>
                        <button type="button" onClick={() => moveMedia(asset.id, 1)} disabled={index === mediaAssets.length - 1} aria-label={`Move ${asset.name} right`}>→</button>
                        <button type="button" onClick={() => removeMedia(asset.id)} aria-label={`Remove ${asset.name}`}>×</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="controlBlock">
                  <div className="controlHeading">Playback</div>
                  <div className="segmented">
                    {(["single", "sequence"] as const).map((mode) => (
                      <button key={mode} type="button" className={mediaSettings.mode === mode ? "isSelected" : ""} onClick={() => setMedia("mode", mode)}>{mode}</button>
                    ))}
                  </div>
                </div>

                <div className="controlBlock">
                  <div className="controlHeading">Transition</div>
                  <div className="chipRow">
                    {(["cut", "fade", "zoom", "slide"] as const).map((transition) => (
                      <button key={transition} type="button" className={`chip ${mediaSettings.transition === transition ? "isSelected" : ""}`} onClick={() => setMedia("transition", transition)}>{transition}</button>
                    ))}
                  </div>
                </div>

                <div className="controlBlock">
                  <div className="controlHeading">Image fit</div>
                  <div className="segmented">
                    {(["cover", "contain"] as const).map((fit) => (
                      <button key={fit} type="button" className={mediaSettings.fit === fit ? "isSelected" : ""} onClick={() => setMedia("fit", fit)}>{fit}</button>
                    ))}
                  </div>
                </div>

                <Range label="Frame" value={mediaSettings.frameDurationMs} min={250} max={1800} step={50} suffix="ms" onChange={(value) => setMedia("frameDurationMs", value)} />
                <Range label="Opacity" value={mediaSettings.opacity} min={10} max={100} suffix="%" onChange={(value) => setMedia("opacity", value)} />
                <button className={`switchRow ${mediaSettings.showText ? "isOn" : ""}`} onClick={() => setMedia("showText", !mediaSettings.showText)} aria-pressed={mediaSettings.showText}>
                  <span>Show text layer</span><span className="switchTrack"><i /></span>
                </button>
                <button type="button" className="clearMedia" onClick={clearMedia}>Remove all images</button>
                <p className="motionNote">Images stay in your browser. Sequence GIFs are capped to a six-second loop for predictable memory use.</p>
              </>
            )}
          </section>

          <section className="inspectorSection paletteSection">
            <div className="sectionHeader"><span>05</span><h2>Color studio</h2></div>
            <div className="paletteGrid" role="group" aria-label="Canvas palette presets">
              {palettes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={settings.palette === item.id ? "isSelected" : ""}
                  onClick={() => setPalette(item)}
                  aria-pressed={settings.palette === item.id}
                  title={item.label}
                >
                  <span className="swatchPair"><i style={{ background: item.colors[0] }} /><i style={{ background: item.colors[1] }} /></span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="colorEditors">
              <div className="colorEditor">
                <span>Background</span>
                <label className="colorWell" style={{ background: settings.backgroundColor }}>
                  <input aria-label="Background color" type="color" value={settings.backgroundColor} onChange={(event) => setCustomColor("backgroundColor", event.target.value)} />
                </label>
                <input aria-label="Background HEX" className="hexInput" value={settings.backgroundColor.toUpperCase()} readOnly />
              </div>
              <div className="colorEditor">
                <span>Font</span>
                <label className="colorWell" style={{ background: settings.foregroundColor }}>
                  <input aria-label="Font color" type="color" value={settings.foregroundColor} onChange={(event) => setCustomColor("foregroundColor", event.target.value)} />
                </label>
                <input aria-label="Font HEX" className="hexInput" value={settings.foregroundColor.toUpperCase()} readOnly />
              </div>
            </div>

            <div className="controlBlock">
              <div className="controlHeading">Quick font color</div>
              <div className="quickSwatches" aria-label="Quick color swatches">
                {colorSwatches.map((color) => (
                  <button key={color} type="button" aria-label={`Set font color ${color}`} title={`Set font to ${color}`} style={{ background: color }} onClick={() => setCustomColor("foregroundColor", color)} />
                ))}
              </div>
            </div>

            <button
              type="button"
              className="swapColors"
              onClick={() => setSettings((state) => ({ ...state, palette: "custom", backgroundColor: state.foregroundColor, foregroundColor: state.backgroundColor }))}
            >
              <span>Swap background / font</span><b>⇄</b>
            </button>
          </section>

          <div className="inspectorFooter">
            <button type="button" onClick={reset}>Reset all</button>
            <span>Text optional · multi-image GIF sequences · {tools.length} effects · {animations.length} motion loops · {fonts.length} typeface stacks · PNG + GIF export · no dropdowns.</span>
          </div>
        </aside>
      </section>
    </main>
  );
}
