"use client";

import { useEffect, useRef, useState } from "react";
import { loadMediaImages } from "@/lib/media";
import { renderComposition } from "@/lib/renderComposition";
import { createEffectLayerCache } from "@/lib/renderType";
import type { MediaAsset, MediaSettings, Settings, ToolName } from "@/lib/types";

const NO_IMAGES: Array<HTMLImageElement | null> = [];

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
  // Only the "has media" case needs an effect (async decode); the empty
  // case is derived below instead of set via effect, so clearing media
  // doesn't cost an extra render.
  const [loadedImages, setLoadedImages] = useState<Array<HTMLImageElement | null>>([]);
  const images = mediaAssets.length ? loadedImages : NO_IMAGES;
  const lastPaintTimeRef = useRef(0);
  const rafAnchorRef = useRef<number | null>(null);
  const effectLayerCacheRef = useRef(createEffectLayerCache());

  useEffect(() => {
    if (!mediaAssets.length) return;
    let cancelled = false;

    loadMediaImages(mediaAssets)
      .then((loaded) => {
        if (!cancelled) setLoadedImages(loaded);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setLoadedImages([]);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaAssets]);

  // `canvas` is held in state, not a ref, specifically so this effect can
  // depend on it being attached (see the callback ref on the element
  // below). sizeCanvas() below writes canvas.width/height — a real DOM
  // element property, not React-managed data — which the immutability rule
  // can't distinguish from mutating application state.
  // eslint-disable-next-line react-hooks/immutability -- see comment above
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
      // eslint-disable-next-line react-hooks/immutability -- DOM element property write, see comment above the effect
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
        time,
        effectLayerCacheRef.current
      );
    };

    let lastPaint = -Infinity;
    const hasMediaMotion = mediaSettings.mode === "sequence" && images.length > 1;
    const hasTextMotion = mediaSettings.showText && text.trim().length > 0 && settings.animation !== "static";

    const loop = (rawTime: number) => {
      if (rafAnchorRef.current === null) {
        // First tick of this play run: anchor the raw rAF clock so the
        // virtual time below continues from lastPaintTimeRef.current instead
        // of jumping to whatever real time has passed since — otherwise
        // resuming after a pause (or any dep change while playing) skipped
        // the animation forward by however long the pause/gap lasted.
        rafAnchorRef.current = rawTime - lastPaintTimeRef.current;
      }
      const time = rawTime - rafAnchorRef.current;
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
      rafAnchorRef.current = null;
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
