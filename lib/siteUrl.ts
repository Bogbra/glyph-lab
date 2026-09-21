function normalize(url: string) {
  return url.replace(/\/+$/, "");
}

/**
 * A real production deployment (Vercel: VERCEL_ENV === "production") must set
 * NEXT_PUBLIC_SITE_URL explicitly — otherwise canonical URLs, the sitemap and
 * Open Graph metadata silently ship pointing at localhost. Local dev, CI and
 * Vercel preview builds keep working without it (falling back to the preview
 * URL Vercel already provides, or localhost).
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      return normalize(new URL(raw).toString());
    } catch {
      throw new Error(`NEXT_PUBLIC_SITE_URL is not a valid absolute URL: "${raw}"`);
    }
  }

  if (process.env.VERCEL_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be set for a production deployment.");
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
