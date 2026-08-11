import { drawMediaFrame } from "./media";
import { renderType } from "./renderType";
import type { MediaSettings, Settings, ToolName } from "./types";

export function renderComposition(
  ctx: CanvasRenderingContext2D,
  tool: ToolName,
  text: string,
  w: number,
  h: number,
  settings: Settings,
  mediaSettings: MediaSettings,
  images: HTMLImageElement[],
  timeMs = 0
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width || w, ctx.canvas.height || h);
  ctx.fillStyle = settings.backgroundColor;
  ctx.fillRect(0, 0, ctx.canvas.width || w, ctx.canvas.height || h);
  ctx.restore();

  drawMediaFrame(ctx, images, w, h, timeMs, mediaSettings);

  if (mediaSettings.showText && text.trim()) {
    renderType(ctx, tool, text, w, h, settings, timeMs, { transparentBackground: true });
  }
}
