import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@thefairies/design-system'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
