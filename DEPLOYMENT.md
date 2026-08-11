# Vercel deployment checklist

## Before commit

```bash
npm install
npm audit
npm run typecheck
npm run build
```

Commit `package-lock.json` after installation.

## Browser regression suite

```bash
npx playwright install chromium webkit
npm run test:e2e
```

The test suite covers typography controls, GIF validity, mobile overflow and the multiple-image / image-only workflow.

## Vercel

Set:

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

Then connect the GitHub repository to Vercel. Framework detection should select Next.js automatically.

No database, backend service, storage bucket, API key or server-side media processing is required.

## Production smoke test

After deployment verify:

1. type text and switch through Line, Dither and Warp;
2. upload at least two JPG/PNG/WebP images;
3. verify Single and Sequence playback;
4. verify Cut, Fade, Zoom and Slide transitions;
5. disable the text layer and export an image-only GIF;
6. enable text and export a combined image + text GIF;
7. export PNG;
8. test mobile width and confirm no horizontal page overflow;
9. confirm canonical/Open Graph URLs use the production domain.
