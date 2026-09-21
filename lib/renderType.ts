import type { FontName, Settings, ToolName } from "./types";

export type RenderTypeOptions = {
  transparentBackground?: boolean;
};

export const FONT_STACKS: Record<FontName, string> = {
  grotesk: 'Arial, Helvetica, sans-serif',
  neo: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  geometric: 'Futura, "Century Gothic", Avenir, sans-serif',
  humanist: '"Trebuchet MS", "Segoe UI", sans-serif',
  editorial: 'Georgia, "Times New Roman", serif',
  didone: 'Didot, "Bodoni MT", "Times New Roman", serif',
  slab: 'Rockwell, "Roboto Slab", Georgia, serif',
  mono: '"Courier New", Courier, monospace',
  terminal: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  condensed: '"Arial Narrow", "Helvetica Neue Condensed", Arial, sans-serif',
  display: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
  soft: '"Gill Sans", "Avenir Next", Avenir, sans-serif'
};

function colors(settings: Settings) {
  return { background: settings.backgroundColor, foreground: settings.foregroundColor };
}

function clear(ctx: CanvasRenderingContext2D, w: number, h: number, settings: Settings) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = settings.backgroundColor;
  ctx.fillRect(0, 0, ctx.canvas.width || w, ctx.canvas.height || h);
  ctx.restore();
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, settings: Settings) {
  let size = Math.min(settings.fontSize, w * 0.3);
  ctx.font = `${settings.weight} ${size}px ${FONT_STACKS[settings.font]}`;
  const maxWidth = w * 0.86;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth && measured > 0) size *= maxWidth / measured;

  // Also fit the available height, not just width — a long word on a short
  // canvas would otherwise still be allowed to run past the top/bottom edge.
  const maxHeight = h * 0.6;
  if (size > maxHeight) size = maxHeight;

  // Try to keep a minimum readable size, but only use it if the text still
  // fits at that size. A fixed floor (the old code used 32px unconditionally)
  // can re-inflate size past what fitting the width just computed — long
  // text on a moderately narrow canvas would run off the edge again.
  const floor = Math.min(32, w * 0.12, h * 0.12);
  if (size < floor) {
    ctx.font = `${settings.weight} ${floor}px ${FONT_STACKS[settings.font]}`;
    const measuredAtFloor = ctx.measureText(text).width;
    if (measuredAtFloor <= maxWidth) size = floor;
  }

  return Math.max(6, size);
}

function setupText(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, settings: Settings) {
  const size = fitFont(ctx, text, w, h, settings);
  ctx.font = `${settings.weight} ${size}px ${FONT_STACKS[settings.font]}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  return size;
}

function drawBase(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, settings: Settings, alpha = 1) {
  setupText(ctx, text, w, h, settings);
  ctx.fillStyle = withAlpha(settings.foregroundColor, alpha);
  ctx.fillText(text, w / 2, h / 2);
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeOffscreen(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function textMask(text: string, w: number, h: number, s: Settings) {
  const off = makeOffscreen(w, h);
  const o = off.getContext("2d", { willReadFrequently: true });
  if (!o) return null;
  o.fillStyle = "#000";
  o.fillRect(0, 0, w, h);
  o.fillStyle = "#fff";
  setupText(o, text, w, h, s);
  o.fillText(text, w / 2, h / 2);
  return { canvas: off, ctx: o };
}

function renderBlur(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, s: Settings) {
  const count = Math.max(1, Math.round(s.layers));
  for (let i = count; i >= 1; i--) {
    ctx.save();
    ctx.filter = `blur(${(s.blur * i) / count}px)`;
    const a = 0.08 + (0.45 / count) * (count - i + 1);
    drawBase(ctx, text, w, h, s, a);
    ctx.restore();
  }
  drawBase(ctx, text, w, h, s, 0.92);
}

function bayerThreshold(x: number, y: number) {
  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];
  return (bayer[y % 4][x % 4] + 0.5) / 16;
}

function renderDither(
  ctx: CanvasRenderingContext2D,
  text: string,
  w: number,
  h: number,
  s: Settings,
  transparentBackground = false
) {
  const mask = textMask(text, w, h, s);
  if (!mask) return;
  const image = mask.ctx.getImageData(0, 0, w, h);
  const px = Math.max(2, Math.round(s.pixelSize));
  const thresholdShift = s.threshold / 100;
  const c = colors(s);
  const fg = s.invert ? c.background : c.foreground;
  const bg = s.invert ? c.foreground : c.background;
  if (!transparentBackground) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = fg;

  for (let y = 0; y < h; y += px) {
    for (let x = 0; x < w; x += px) {
      let sum = 0;
      let samples = 0;
      const step = Math.max(1, Math.floor(px / 2));
      for (let yy = y; yy < Math.min(y + px, h); yy += step) {
        for (let xx = x; xx < Math.min(x + px, w); xx += step) {
          sum += image.data[(yy * w + xx) * 4] / 255;
          samples++;
        }
      }
      const lum = samples ? sum / samples : 0;
      const t = Math.max(0, Math.min(1, bayerThreshold(Math.floor(x / px), Math.floor(y / px)) + thresholdShift));
      if (lum > t) {
        const jitter = s.distortion ? Math.sin(x * 0.091 + y * 0.037) * s.distortion : 0;
        ctx.fillRect(x + jitter, y, Math.max(1, px - 1), Math.max(1, px - 1));
      }
    }
  }
}

function renderLine(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, s: Settings) {
  // Build the text mask once.
  const textLayer = makeOffscreen(w, h);
  const textCtx = textLayer.getContext("2d");
  if (!textCtx) return;
  setupText(textCtx, text, w, h, s);
  textCtx.fillStyle = "#fff";
  textCtx.fillText(text, w / 2, h / 2);

  // Build the complete line pattern first. Do not use source-in for every
  // individual line: repeated source-in operations erase the previous line
  // intersections and can leave the final mask fully transparent.
  const lineLayer = makeOffscreen(w, h);
  const lineCtx = lineLayer.getContext("2d");
  if (!lineCtx) return;
  lineCtx.save();
  lineCtx.translate(w / 2, h / 2);
  lineCtx.rotate((s.lineAngle * Math.PI) / 180);
  lineCtx.translate(-w / 2, -h / 2);
  lineCtx.fillStyle = s.foregroundColor;
  const gap = Math.max(4, s.lineGap);
  const thick = Math.max(1, s.lineWidth);
  for (let y = -h; y < h * 2; y += gap) {
    lineCtx.fillRect(-w, y, w * 3, thick);
  }
  lineCtx.restore();

  // Intersect the finished line pattern with the text exactly once.
  lineCtx.globalCompositeOperation = "destination-in";
  lineCtx.drawImage(textLayer, 0, 0);
  lineCtx.globalCompositeOperation = "source-over";

  ctx.drawImage(lineLayer, 0, 0);
}

function renderSlice(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, s: Settings) {
  const source = makeOffscreen(w, h);
  const so = source.getContext("2d");
  if (!so) return;
  drawBase(so, text, w, h, s, 1);
  const band = Math.max(4, Math.round(s.sliceHeight));
  let index = 0;
  for (let y = 0; y < h; y += band) {
    const dir = index % 2 === 0 ? 1 : -1;
    const wave = Math.sin(index * 1.7) * 0.35 + 0.65;
    const dx = dir * s.sliceOffset * wave;
    ctx.drawImage(source, 0, y, w, band, dx, y, w, band);
    index++;
  }
}

function renderEcho(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, s: Settings) {
  const repeats = Math.max(1, Math.round(s.repeat));
  const stretch = Math.max(0.5, s.stretch / 100);
  for (let i = repeats - 1; i >= 0; i--) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    const scale = stretch + i * 0.055;
    ctx.scale(scale, 1 + i * 0.025);
    ctx.translate(-w / 2, -h / 2);
    ctx.globalAlpha = i === 0 ? 1 : 0.18;
    drawBase(ctx, text, w, h, s, 1);
    ctx.restore();
  }
}

function renderWave(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, s: Settings) {
  const source = makeOffscreen(w, h);
  const so = source.getContext("2d");
  if (!so) return;
  drawBase(so, text, w, h, s, 1);
  const slice = Math.max(2, Math.round(s.waveSlice));
  for (let x = 0; x < w; x += slice) {
    const phase = (x / Math.max(1, w)) * Math.PI * 2 * s.waveFrequency;
    const dy = Math.sin(phase) * s.waveAmplitude;
    ctx.drawImage(source, x, 0, slice, h, x, dy, slice, h);
  }
}

function renderPixel(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, s: Settings) {
  const mask = textMask(text, w, h, s);
  if (!mask) return;
  const image = mask.ctx.getImageData(0, 0, w, h);
  const block = Math.max(3, Math.round(s.pixelBlock));
  ctx.fillStyle = s.foregroundColor;
  for (let y = 0; y < h; y += block) {
    for (let x = 0; x < w; x += block) {
      const sx = Math.min(w - 1, x + Math.floor(block / 2));
      const sy = Math.min(h - 1, y + Math.floor(block / 2));
      const lum = image.data[(sy * w + sx) * 4] / 255;
      if (lum > 0.35) ctx.fillRect(x, y, Math.max(1, block - 1), Math.max(1, block - 1));
    }
  }
}

function renderHalftone(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, s: Settings) {
  const mask = textMask(text, w, h, s);
  if (!mask) return;
  const image = mask.ctx.getImageData(0, 0, w, h);
  const cell = Math.max(5, Math.round(s.halftoneCell));
  ctx.fillStyle = s.foregroundColor;
  for (let y = cell / 2; y < h; y += cell) {
    for (let x = cell / 2; x < w; x += cell) {
      const ix = Math.min(w - 1, Math.max(0, Math.round(x)));
      const iy = Math.min(h - 1, Math.max(0, Math.round(y)));
      const lum = image.data[(iy * w + ix) * 4] / 255;
      if (lum < 0.05) continue;
      const radius = (cell * 0.5) * lum * (s.halftoneScale / 100);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.7, radius), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderOutline(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, s: Settings) {
  const layers = Math.max(1, Math.round(s.outlineLayers));
  setupText(ctx, text, w, h, s);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.fillStyle = s.backgroundColor;
  for (let i = layers; i >= 1; i--) {
    ctx.strokeStyle = withAlpha(s.foregroundColor, 0.18 + (0.62 * i) / layers);
    ctx.lineWidth = Math.max(1, s.outlineWidth * i * 1.45);
    ctx.strokeText(text, w / 2, h / 2);
  }
  ctx.strokeStyle = s.foregroundColor;
  ctx.lineWidth = Math.max(1, s.outlineWidth);
  ctx.strokeText(text, w / 2, h / 2);
}

function renderChromatic(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, s: Settings) {
  const offset = s.chromaticOffset;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  setupText(ctx, text, w, h, s);
  ctx.fillStyle = "#ff2a3d";
  ctx.fillText(text, w / 2 - offset, h / 2);
  ctx.fillStyle = "#19d7ff";
  ctx.fillText(text, w / 2 + offset, h / 2);
  ctx.fillStyle = "#ffe600";
  ctx.fillText(text, w / 2, h / 2 + offset * 0.18);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.55;
  drawBase(ctx, text, w, h, s, 1);
  ctx.restore();
}

function renderScanline(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, s: Settings) {
  const source = makeOffscreen(w, h);
  const so = source.getContext("2d");
  if (!so) return;
  drawBase(so, text, w, h, s, 1);
  const gap = Math.max(4, Math.round(s.scanGap));
  let row = 0;
  for (let y = 0; y < h; y += gap) {
    const height = Math.max(1, Math.round(gap * 0.45));
    const dx = row % 3 === 0 ? s.scanShift : row % 3 === 1 ? -s.scanShift * 0.5 : 0;
    ctx.drawImage(source, 0, y, w, height, dx, y, w, height);
    row++;
  }
}

function renderWarp(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, s: Settings) {
  const source = makeOffscreen(w, h);
  const so = source.getContext("2d");
  if (!so) return;
  drawBase(so, text, w, h, s, 1);
  const bands = Math.max(3, Math.round(s.warpBands));
  const bandH = h / bands;
  for (let i = 0; i < bands; i++) {
    const y = i * bandH;
    const normalized = (i / Math.max(1, bands - 1)) * 2 - 1;
    const dx = Math.sin(normalized * Math.PI * 1.4) * s.warpStrength;
    const scaleX = 1 + Math.cos(normalized * Math.PI) * (s.warpStrength / 420);
    const destW = w * scaleX;
    ctx.drawImage(source, 0, y, w, bandH + 1, (w - destW) / 2 + dx, y, destW, bandH + 1);
  }
}

function renderStaticFrame(
  ctx: CanvasRenderingContext2D,
  tool: ToolName,
  text: string,
  w: number,
  h: number,
  settings: Settings,
  options: RenderTypeOptions
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!options.transparentBackground) {
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();

  switch (tool) {
    case "blur": return renderBlur(ctx, text, w, h, settings);
    case "dither": return renderDither(ctx, text, w, h, settings, Boolean(options.transparentBackground));
    case "line": return renderLine(ctx, text, w, h, settings);
    case "slice": return renderSlice(ctx, text, w, h, settings);
    case "type": return renderEcho(ctx, text, w, h, settings);
    case "wave": return renderWave(ctx, text, w, h, settings);
    case "pixel": return renderPixel(ctx, text, w, h, settings);
    case "halftone": return renderHalftone(ctx, text, w, h, settings);
    case "outline": return renderOutline(ctx, text, w, h, settings);
    case "chromatic": return renderChromatic(ctx, text, w, h, settings);
    case "scanline": return renderScanline(ctx, text, w, h, settings);
    case "warp": return renderWarp(ctx, text, w, h, settings);
  }
}

function animatedEffectSettings(tool: ToolName, settings: Settings, phase: number): Settings {
  if (settings.animation !== "morph") return settings;

  const amount = Math.max(0, Math.min(1, settings.animationIntensity / 100));
  const wave = Math.sin(phase);
  // Integer multiplier (not a sub-multiple like the original 0.5) so this
  // term completes a whole number of cycles in exactly one base cycle —
  // see the matching note on the jitter/morph cases in
  // applyAnimationTransform for why that matters for GIF export loops.
  const wave2 = Math.sin(phase * 2 + Math.PI / 3);
  const pulse = 0.5 + 0.5 * wave;
  const next = { ...settings };

  switch (tool) {
    case "blur":
      next.blur = Math.max(0.5, settings.blur * (0.35 + pulse * 1.45 * amount));
      next.layers = Math.max(1, Math.round(settings.layers + wave2 * 3 * amount));
      break;
    case "dither":
      next.pixelSize = Math.max(2, settings.pixelSize + wave2 * 4 * amount);
      next.distortion = Math.max(0, settings.distortion + pulse * 14 * amount);
      next.threshold = settings.threshold + wave * 24 * amount;
      break;
    case "line":
      next.lineAngle = settings.lineAngle + wave * 42 * amount;
      next.lineGap = Math.max(4, settings.lineGap * (0.65 + pulse * 0.9 * amount));
      next.lineWidth = Math.max(1, settings.lineWidth + wave2 * 2.5 * amount);
      break;
    case "slice":
      next.sliceOffset = Math.max(0, settings.sliceOffset * (0.25 + pulse * 1.75 * amount));
      next.sliceHeight = Math.max(4, settings.sliceHeight + wave2 * 12 * amount);
      break;
    case "type":
      next.stretch = Math.max(45, settings.stretch + wave * 48 * amount);
      next.repeat = Math.max(1, Math.round(settings.repeat + wave2 * 3 * amount));
      break;
    case "wave":
      next.waveAmplitude = Math.max(0, settings.waveAmplitude * (0.25 + pulse * 1.8 * amount));
      next.waveFrequency = Math.max(0.2, settings.waveFrequency + wave2 * 1.7 * amount);
      break;
    case "pixel":
      next.pixelBlock = Math.max(4, settings.pixelBlock + wave * 10 * amount);
      break;
    case "halftone":
      next.halftoneScale = Math.max(20, settings.halftoneScale + wave * 48 * amount);
      next.halftoneCell = Math.max(5, settings.halftoneCell + wave2 * 5 * amount);
      break;
    case "outline":
      next.outlineWidth = Math.max(1, settings.outlineWidth + pulse * 5 * amount);
      next.outlineLayers = Math.max(1, Math.round(settings.outlineLayers + wave2 * 3 * amount));
      break;
    case "chromatic":
      next.chromaticOffset = Math.max(0, settings.chromaticOffset + pulse * 38 * amount);
      break;
    case "scanline":
      next.scanShift = Math.max(0, settings.scanShift + wave * 52 * amount);
      next.scanGap = Math.max(4, settings.scanGap + wave2 * 4 * amount);
      break;
    case "warp":
      next.warpStrength = Math.max(0, settings.warpStrength * (0.2 + pulse * 2 * amount));
      next.warpBands = Math.max(3, Math.round(settings.warpBands + wave2 * 5 * amount));
      break;
  }

  return next;
}

function applyAnimationTransform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: Settings,
  phase: number
) {
  const amount = Math.max(0, Math.min(1, settings.animationIntensity / 100));
  let x = 0;
  let y = 0;
  let rotation = 0;
  let scale = 1;
  let alpha = 1;

  switch (settings.animation) {
    case "breathe":
      scale = 1 + Math.sin(phase) * 0.075 * amount;
      break;
    case "float":
      y = Math.sin(phase) * h * 0.055 * amount;
      break;
    case "jitter":
      // Integer frequencies (not the original 8.7/11.3/7.1) so this closes
      // seamlessly after exactly one base cycle — a GIF export can then pick
      // a loop length that matches the real animation speed instead of
      // having to fudge the speed to hit a duration that happens to close.
      x = Math.sin(phase * 9) * 10 * amount;
      y = Math.cos(phase * 11) * 8 * amount;
      rotation = Math.sin(phase * 7) * 0.018 * amount;
      break;
    case "orbit":
      x = Math.cos(phase) * w * 0.04 * amount;
      y = Math.sin(phase) * h * 0.06 * amount;
      break;
    case "swing":
      rotation = Math.sin(phase) * 0.075 * amount;
      break;
    case "drift":
      x = Math.sin(phase) * w * 0.085 * amount;
      break;
    case "morph":
      // Morph primarily changes the active effect parameters, but this tiny
      // breathing transform guarantees visible temporal movement even when a
      // user has dialled the effect itself close to a neutral value. Integer
      // frequencies (matching wave2 above) so this closes after one cycle.
      scale = 1 + Math.sin(phase * 2) * 0.025 * amount;
      rotation = Math.sin(phase * 3) * 0.008 * amount;
      break;
    case "static":
      break;
  }

  if (settings.animation === "breathe") alpha = 0.9 + Math.cos(phase) * 0.1 * amount;

  ctx.globalAlpha = alpha;
  ctx.translate(w / 2 + x, h / 2 + y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
}

let effectLayerCache: { key: string; canvas: HTMLCanvasElement } | null = null;

export function renderType(
  ctx: CanvasRenderingContext2D,
  tool: ToolName,
  text: string,
  w: number,
  h: number,
  settings: Settings,
  timeMs = 0,
  options: RenderTypeOptions = {}
) {
  // Only used to decide whether there is anything to draw — the text itself
  // is rendered untrimmed further down so leading/trailing spaces the user
  // typed are preserved, matching what the UI and README promise.
  if (!text.trim()) {
    if (!options.transparentBackground) clear(ctx, w, h, settings);
    return;
  }

  const speed = Math.max(0.1, settings.animationSpeed);
  const phase = (timeMs / 1000) * speed * Math.PI * 2;
  const frameSettings = animatedEffectSettings(tool, settings, phase);

  // Every animation except "morph" only moves/scales/rotates the finished
  // effect layer afterward (applyAnimationTransform below) — the layer
  // itself (frameSettings) doesn't change frame to frame. Re-running dither/
  // pixel/halftone's getImageData scan or blur's multi-pass filter on every
  // tick was pure waste for those; reuse the last layer when nothing that
  // would change its pixels has changed. morph's frameSettings changes every
  // frame (by design), so its cache key naturally never matches and it keeps
  // re-rendering as before.
  const cacheKey = JSON.stringify([tool, text, w, h, frameSettings, options]);
  let frame: HTMLCanvasElement;
  if (effectLayerCache && effectLayerCache.key === cacheKey) {
    frame = effectLayerCache.canvas;
  } else {
    frame = makeOffscreen(w, h);
    const frameCtx = frame.getContext("2d", {
      willReadFrequently: tool === "dither" || tool === "pixel" || tool === "halftone"
    });
    if (!frameCtx) return;
    renderStaticFrame(frameCtx, tool, text, w, h, frameSettings, options);
    effectLayerCache = { key: cacheKey, canvas: frame };
  }

  if (!options.transparentBackground) clear(ctx, w, h, settings);

  ctx.save();
  applyAnimationTransform(ctx, w, h, settings, phase);
  ctx.drawImage(frame, 0, 0);
  ctx.restore();
}
