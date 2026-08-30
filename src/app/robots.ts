import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/sign-in", "/auth/"],
    },
    sitemap: "https://truckerscompare.com/sitemap.xml",
    host: "https://truckerscompare.com",
  };
}
