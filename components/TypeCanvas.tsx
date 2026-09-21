"use client";

import { useEffect, useRef, useState } from "react";
import { loadMediaImages } from "@/lib/media";
import { renderComposition } from "@/lib/renderComposition";
import type { MediaAsset, MediaSettings, Settings, ToolName } from "@/lib/types";

export function TypeCanvas({
  tool,
  text,
  settings,
  mediaAssets,
  mediaSettings,
  paused = false
}: {
  tool: ToolName;
  text: string;
  settings: Settings;
  mediaAssets: MediaAsset[];
  mediaSettings: MediaSettings;
  paused?: boolean;
}) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [images, setImages] = useState<Array<HTMLImageElement | null>>([]);
  const lastPaintTimeRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (!mediaAssets.length) {
      setImages([]);
      return;
    }

    loadMediaImages(mediaAssets)
      .then((loaded) => {
        if (!cancelled) setImages(loaded);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setImages([]);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaAssets]);

  useEffect(() => {
    if (!canvas) return;
    const host = canvas.parentElement;
    if (!host) return;

    let animationFrame = 0;
    let resizeFrame = 0;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sizeCanvas = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      return { dpr, width, height };
    };

    let metrics = sizeCanvas();

    const draw = (time = 0) => {
      lastPaintTimeRef.current = time;
      const ctx = canvas.getContext("2d", {
        willReadFrequently: tool === "dither" || tool === "pixel" || tool === "halftone"
      });
      if (!ctx) return;
      ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
      renderComposition(
        ctx,
        tool,
        text,
        metrics.width,
        metrics.height,
        reducedMotion ? { ...settings, animation: "static" } : settings,
        mediaSettings,
        images,
        time
      );
    };

    let lastPaint = -Infinity;
    const hasMediaMotion = mediaSettings.mode === "sequence" && images.length > 1;
    const hasTextMotion = mediaSettings.showText && text.trim().length > 0 && settings.animation !== "static";

    const loop = (time: number) => {
      if (time - lastPaint >= 1000 / 30) {
        draw(time);
        lastPaint = time;
      }
      if (!paused && !reducedMotion && (hasMediaMotion || hasTextMotion)) {
        animationFrame = requestAnimationFrame(loop);
      }
    };

    const start = () => {
      cancelAnimationFrame(animationFrame);
      if (paused) {
        // Freeze on whatever frame was last painted instead of snapping back
        // to time 0 (which reset animated text/sequences to their starting
        // pose on every pause rather than actually holding still).
        draw(lastPaintTimeRef.current);
      } else if (!reducedMotion && (hasMediaMotion || hasTextMotion)) {
        animationFrame = requestAnimationFrame(loop);
      } else {
        draw(0);
      }
    };

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        metrics = sizeCanvas();
        start();
      });
    });

    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      start();
    };

    ro.observe(host);
    motionQuery.addEventListener("change", onMotionChange);
    start();

    return () => {
      ro.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(resizeFrame);
    };
  }, [canvas, tool, text, settings, mediaSettings, images, paused]);

  return <canvas ref={setCanvas} className="typeCanvas" aria-label={`${tool} typography preview`} />;
}
