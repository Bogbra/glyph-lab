# Glyph Lab

Glyph Lab is a browser-based experimental typography playground built with Next.js, TypeScript and the Canvas 2D API. Users write their own text, choose an effect and typeface, animate it, tune colors and parameters, then export the result as PNG or an animated GIF.

The interface is intentionally direct: there are **no select/dropdown controls** in the creative workflow.

## What you can do

- write your own text (case and spaces are preserved);
- switch between 12 realtime typography effects;
- choose from 12 system-font stacks grouped as Sans, Serif, Mono and Display;
- set independent background and font colors;
- apply 8 motion systems and control speed/intensity;
- preview animation live on the canvas;
- export the current frame as PNG;
- export a deterministic animated GIF directly in the browser;
- use the tool on desktop, tablet and mobile.

## Effects

Blur, Dither, Line, Slice, Echo/Type, Wave, Pixel, Halftone, Outline, Chromatic, Scanline and Warp.

## Motion

Static, Breathe, Float, Jitter, Orbit, Swing, Drift and Morph.

`Morph` animates the active effect itself—for example line angle, slice offset, chromatic separation or warp strength—rather than only moving the finished artwork.

## GIF export

GIF encoding happens entirely in the browser; no user text or canvas data is uploaded to a server. The exporter uses a fixed 256-color RGB palette, streams frames straight into the encoder (rather than holding them all in memory), and renders:

- 12 fps for text-only loops, 10 fps once images are involved;
- up to 60 frames per loop;
- loop length is 2–6 seconds — for animated text it snaps to whichever whole number of cycles at the current Speed setting lands closest to 2s, so the loop always closes seamlessly; for an image sequence it follows the sequence's own frame timing, clamped to the same 2–6s range;
- the export frame is capped by total pixel area, not a fixed width — a tall or narrow composition can be wider or taller than 720 px while staying within that budget.

Static motion exports as a one-frame GIF.

## Stack

- Next.js 16
- React 19
- TypeScript
- Canvas 2D API
- custom browser-side GIF encoder
- Playwright
- GitHub Actions
- Vercel-ready deployment configuration

No external image assets, font files, analytics SDKs or server APIs are required.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The first `npm install` generates `package-lock.json`. Commit it to the repository; CI automatically switches to `npm ci` when the lockfile exists.

## Production verification

```bash
npm run typecheck
npm run build
npm run start
```

Then in another terminal:

```bash
npx playwright install chromium
npm run test:e2e
```

The Playwright configuration runs against `next build && next start`, not the development server.

## Vercel

Set the production environment variable:

```env
NEXT_PUBLIC_SITE_URL=https://your-real-domain.com
```

Then import the GitHub repository into Vercel. No database, server API, object storage or secret key is needed.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the release checklist.

## Accessibility and performance

- `prefers-reduced-motion` disables live canvas motion;
- controls are native buttons/inputs with labels and pressed states;
- the canvas preview is capped at roughly 30 fps;
- browser device-pixel-ratio is capped at 2;
- GIF export resolution is capped to avoid excessive client memory use;
- mobile layout is covered by Playwright overflow tests.

## Privacy

The creative workflow runs locally in the browser. Typed text, colors and rendered frames are not transmitted anywhere by this application.

## Renderer regression fixes

- **Line effect:** the complete line pattern is built first and intersected with the glyph mask once, preventing repeated `source-in` operations from erasing the text.
- **GIF export:** the GIF LZW encoder now advances code width at the decoder-compatible boundary, preventing large exported frames from truncating after the first rows.
