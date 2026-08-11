import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Glyph Lab — Animated Browser Typography Playground",
  description: "Create animated typography and image-sequence GIFs in the browser with realtime effects, custom colors, motion loops, local media uploads, PNG export and GIF export.",
  applicationName: "Glyph Lab",
  keywords: ["typography", "generative design", "creative coding", "canvas", "type design", "animation", "gif maker", "motion poster"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Glyph Lab — Animated Typography Playground",
    description: "Write your own text, add local images, transform the composition with realtime effects and motion, then export PNG or GIF.",
    type: "website",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Glyph Lab animated typography playground" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Glyph Lab — Animated Typography Playground",
    description: "Realtime browser typography and image-sequence composition with effects, motion and GIF export.",
    images: ["/opengraph-image"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecebe6" },
    { media: "(prefers-color-scheme: dark)", color: "#11110f" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
