import type { MetadataRoute } from "next";

const SITE = "https://truckerscompare.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE, lastModified, changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE}/opportunities`,
      lastModified,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    { url: `${SITE}/compare`, lastModified, changeFrequency: "weekly", priority: 0.6 },
    {
      url: `${SITE}/profile`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
