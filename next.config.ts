import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: { // [!code ++] // [!code focus]
    serverComponentsExternalPackages: ['grammy'], // [!code ++] // [!code focus]
  }, // [!code ++] // [!code focus]
};

export default nextConfig;
