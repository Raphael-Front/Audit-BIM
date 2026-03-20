import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
