import type { MediaAsset, MediaSettings } from "./types";

export const MAX_MEDIA_ASSETS = 8;
export const MAX_MEDIA_FILE_BYTES = 12 * 1024 * 1024;
export const SUPPORTED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// The 12 MB cap above only bounds the compressed file; a highly compressed
// image can still decode to an enormous pixel buffer. Cap the decoded size
// too, once real dimensions are known. Kept modest (not e.g. 30MP) because
// up to MAX_MEDIA_ASSETS of these can be live in the tab at once.
export const MAX_MEDIA_PIXELS = 16_000_000;

export function loadMediaImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const pixels = (image.naturalWidth || image.width) * (image.naturalHeight || image.height);
      if (pixels > MAX_MEDIA_PIXELS) {
        reject(new Error("Image dimensions are too large to process."));
        return;
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error("An uploaded image could not be decoded."));
    image.src = url;
  });
}

export async function loadMediaImages(assets: MediaAsset[]) {
  // Decode one at a time, not in parallel: with up to MAX_MEDIA_ASSETS large
  // images, decoding all of them concurrently multiplies peak memory well
  // past what MAX_MEDIA_PIXELS alone bounds for a single image. A failed
  // decode doesn't stop the rest (matches addMediaFiles, which already
  // validates decodability before an asset is kept, so this mainly guards
  // against a file becoming unreadable later); its slot stays null so the
  // remaining images keep their asset index, thumbnail and sequence timing.
  const results: Array<HTMLImageElement | null> = [];
  for (const asset of assets) {
    try {
      results.push(await loadMediaImage(asset.url));
    } catch (error) {
      console.error(error);
      results.push(null);
    }
  }
  return results;
}

function drawFittedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  w: number,
  h: number,
  fit: MediaSettings["fit"],
  zoom = 1,
  offsetX = 0,
  alpha = 1
) {
  const iw = Math.max(1, image.naturalWidth || image.width);
  const ih = Math.max(1, image.naturalHeight || image.height);
  const baseScale = fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const scale = baseScale * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (w - dw) / 2 + offsetX;
  const dy = (h - dh) / 2;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(image, dx, dy, dw, dh);
  ctx.restore();
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function drawMediaFrame(
  ctx: CanvasRenderingContext2D,
  images: Array<HTMLImageElement | null>,
  w: number,
  h: number,
  timeMs: number,
  settings: MediaSettings
) {
  if (!images.length) return;
  const alpha = clamp01(settings.opacity / 100);

  if (settings.mode === "single" || images.length === 1) {
    const index = Math.max(0, Math.min(images.length - 1, settings.activeIndex));
    const image = images[index];
    if (image) drawFittedImage(ctx, image, w, h, settings.fit, 1, 0, alpha);
    return;
  }

  const duration = Math.max(150, settings.frameDurationMs);
  const totalDuration = duration * images.length;
  const localTime = ((timeMs % totalDuration) + totalDuration) % totalDuration;
  const index = Math.floor(localTime / duration) % images.length;
  const nextIndex = (index + 1) % images.length;
  const progress = (localTime % duration) / duration;
  const current = images[index];
  const next = images[nextIndex];
  if (!current && !next) return;
  const paint = (image: HTMLImageElement | null, zoom: number, offsetX: number, imageAlpha: number) => {
    if (image) drawFittedImage(ctx, image, w, h, settings.fit, zoom, offsetX, imageAlpha);
  };

  if (settings.transition === "cut") {
    paint(current, 1, 0, alpha);
    return;
  }

  if (settings.transition === "fade") {
    const transitionStart = 0.62;
    const mix = clamp01((progress - transitionStart) / (1 - transitionStart));
    paint(current, 1, 0, alpha * (1 - mix));
    if (mix > 0) paint(next, 1, 0, alpha * mix);
    return;
  }

  if (settings.transition === "zoom") {
    const transitionStart = 0.68;
    const mix = clamp01((progress - transitionStart) / (1 - transitionStart));
    paint(current, 1 + progress * 0.09, 0, alpha * (1 - mix * 0.82));
    if (mix > 0) paint(next, 1.12 - mix * 0.12, 0, alpha * mix);
    return;
  }

  const eased = progress * progress * (3 - 2 * progress);
  paint(current, 1, -eased * w, alpha);
  paint(next, 1, (1 - eased) * w, alpha);
}
