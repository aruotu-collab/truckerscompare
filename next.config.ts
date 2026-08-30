import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core"],
  outputFileTracingIncludes: {
    "/api/shiply/*": ["./node_modules/playwright-core/**/*"],
  },
};

export default nextConfig;
