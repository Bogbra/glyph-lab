# Security and privacy notes

Glyph Lab is intentionally a client-only creative application.

## Local media processing

Uploaded JPG, PNG and WebP files are processed with browser APIs only. The application creates temporary `blob:` object URLs, decodes the images locally and draws them to Canvas 2D. There is no upload API, object storage, database or analytics integration.

Object URLs are revoked when images are removed, when the media stack is reset and when the application unmounts.

## Input limits

The UI accepts at most 8 media files and rejects unsupported MIME types or files above 12 MB each. GIF output is also resolution-, duration- and frame-capped to reduce the risk of accidental browser memory exhaustion.

## Content Security Policy

The CSP permits `blob:` and `data:` images because local upload previews and canvas workflows require them. Production does not enable `unsafe-eval`; it is allowed only by the development configuration because React/Next development tooling needs it.

## Secrets

The project has no application secrets. `NEXT_PUBLIC_SITE_URL` is public configuration used for canonical metadata.
