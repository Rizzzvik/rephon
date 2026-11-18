import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OpenNext expects Next.js production output in the standard `.next` directory.
  distDir: ".next",
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
