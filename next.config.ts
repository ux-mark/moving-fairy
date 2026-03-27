import type { NextConfig } from "next";

const lanIp = process.env.LAN_IP;

const nextConfig: NextConfig = {
  transpilePackages: ['@thefairies/design-system'],
  ...(lanIp ? { allowedDevOrigins: [lanIp] } : {}),
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      { source: '/inventory', destination: '/decisions', permanent: true },
      { source: '/chat', destination: '/decisions', permanent: true },
    ]
  },
};

export default nextConfig;
