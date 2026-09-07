import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

