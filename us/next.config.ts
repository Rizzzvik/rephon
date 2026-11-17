import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep builds isolated so `next build` cannot remove files used by `next dev`.
  distDir: process.env.NEXT_BUILD_DIR || (process.env.NODE_ENV === "production" ? ".next-build" : ".next"),
};

export default nextConfig;
