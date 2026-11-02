import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://droidputer.vercel.app/", changeFrequency: "daily", priority: 1 },
    { url: "https://droidputer.vercel.app/privacy.html", changeFrequency: "yearly", priority: 0.3 },
  ];
}
