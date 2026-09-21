import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return [{ url: base, lastModified: new Date(), changeFrequency: "monthly", priority: 1 }];
}
