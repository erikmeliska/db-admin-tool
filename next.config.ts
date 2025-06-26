import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  eslint: {
    // Ignore ESLint errors during build for Docker
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore TypeScript errors during build for Docker
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
