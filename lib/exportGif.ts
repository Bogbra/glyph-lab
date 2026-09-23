import { GifEncoder } from "./gif";
import { loadMediaImages } from "./media";
import { renderComposition } from "./renderComposition";
import { createEffectLayerCache } from "./renderType";
import type { MediaAsset, MediaSettings, Settings, ToolName } from "./types";

export type ExportGifInput = {
  tool: ToolName;
  text: string;
  settings: Settings;
  mediaSettings: MediaSettings;
  mediaAssets: MediaAsset[];
  sourceCanvas: HTMLCanvasElement;
  onProgress?: (message: string) => void;
};

export async function exportGif({
  tool,
  text,
  settings,
  mediaSettings,
  mediaAssets,
  sourceCanvas,
  onProgress
}: ExportGifInput): Promise<Blob> {
  onProgress?.("Preparing GIF…");
  const loadedImages = await loadMediaImages(mediaAssets);
  const cssWidth = Math.max(1, sourceCanvas.clientWidth);
  const cssHeight = Math.max(1, sourceCanvas.clientHeight);

  // Render at the live preview's own pixel size first. Every effect
  // parameter (blur radius, pixel size, line gap, chromatic offset, …)
  // is tuned in absolute canvas pixels, so rendering straight at a
  // smaller export size made the GIF look different from the preview —
  // more/less blurred, coarser or finer pixelation, etc. Downscaling a
  // faithful render afterward keeps it a true picture of the preview.
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = cssWidth;
  renderCanvas.height = cssHeight;
  const renderCtx = renderCanvas.getContext("2d", { willReadFrequently: true });
  if (!renderCtx) throw new Error("Canvas export is unavailable in this browser.");

  // Cap the exported frame by total pixel count, not just width, so a
  // tall narrow stage can't produce an unbounded number of rows — each
  // frame (and the whole animated GIF held across up to 60 of them)
  // stays bounded regardless of the stage's aspect ratio.
  const maxPixels = mediaAssets.length ? 600 * 450 : 720 * 540;
  const pixelScale = Math.min(1, Math.sqrt(maxPixels / (cssWidth * cssHeight)));
  const width = Math.max(160, Math.round(cssWidth * pixelScale));
  const height = Math.max(120, Math.round(cssHeight * pixelScale));
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportCtx = exportCanvas.getContext("2d", { willReadFrequently: true });
  if (!exportCtx) throw new Error("Canvas export is unavailable in this browser.");
  exportCtx.imageSmoothingEnabled = true;
  exportCtx.imageSmoothingQuality = "high";

  const fps = mediaAssets.length ? 10 : 12;
  const hasMediaSequence = mediaSettings.mode === "sequence" && loadedImages.length > 1;
  const hasTextMotion = mediaSettings.showText && text.trim().length > 0 && settings.animation !== "static";
  const animated = hasMediaSequence || hasTextMotion;
  const requestedMediaDuration = hasMediaSequence ? mediaSettings.frameDurationMs * loadedImages.length : 0;
  const targetDuration = animated ? Math.min(6000, Math.max(2000, requestedMediaDuration || 0)) : 100;

  // Every animation now completes a whole cycle in exactly one base
  // cycle (see the integer frequencies in renderType.ts), so instead of
  // nudging animationSpeed away from what the user actually chose,
  // snap the export's total duration to a whole number of cycles at the
  // real speed — the loop closes and the speed stays truthful to the
  // Speed slider. The cycle count itself must be chosen from within the
  // 2-6s window (not rounded first and clamped after): clamping an
  // already-rounded duration can round back down to a non-integer number
  // of cycles — e.g. at speed 0.6 (a ~1667ms cycle), rounding to the
  // nearest cycle gives ~1667ms, which the old code then clamped up to
  // 2000ms, leaving 1.2 cycles and a visible jump at the loop seam.
  let totalDuration = targetDuration;
  if (hasTextMotion) {
    const baseCycleMs = 1000 / Math.max(0.1, settings.animationSpeed);
    const minCycles = Math.max(1, Math.ceil(2000 / baseCycleMs));
    const maxCycles = Math.max(minCycles, Math.floor(6000 / baseCycleMs));
    const naturalCycles = Math.round(targetDuration / baseCycleMs);
    const cycles = Math.min(maxCycles, Math.max(minCycles, naturalCycles));
    totalDuration = cycles * baseCycleMs;
  }

  const exportMediaSettings = hasMediaSequence && requestedMediaDuration > totalDuration
    ? { ...mediaSettings, frameDurationMs: totalDuration / loadedImages.length }
    : mediaSettings;
  const frameCount = animated ? Math.min(60, Math.max(2, Math.ceil((totalDuration / 1000) * fps))) : 1;
  const frameDelay = animated ? totalDuration / frameCount : 100;

  const encoder = new GifEncoder(width, height, animated);
  // Own cache, separate from the live preview's: export renders at the
  // stage's raw CSS size while the preview renders at a DPR-scaled size,
  // so sharing one cache would just evict itself between the two.
  const exportEffectLayerCache = createEffectLayerCache();

  for (let frame = 0; frame < frameCount; frame++) {
    const time = frame * frameDelay;
    renderComposition(renderCtx, tool, text, cssWidth, cssHeight, settings, exportMediaSettings, loadedImages, time, exportEffectLayerCache);
    exportCtx.clearRect(0, 0, width, height);
    exportCtx.drawImage(renderCanvas, 0, 0, cssWidth, cssHeight, 0, 0, width, height);
    // Encoding happens frame by frame (not after collecting all of
    // them), so only the current frame's pixels are ever held at once.
    encoder.addFrame(exportCtx.getImageData(0, 0, width, height), frameDelay);
    if (frame % 4 === 0) {
      onProgress?.(`Rendering GIF ${frame + 1}/${frameCount}`);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }

  return encoder.finish();
}
