import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Glyph Lab",
    short_name: "Glyph Lab",
    description: "Browser-based motion poster studio for animated typography, local image sequences and GIF export.",
    start_url: "/",
    display: "standalone",
    background_color: "#ecebe6",
    theme_color: "#11110f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
  };
}
