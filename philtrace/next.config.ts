import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],
  compress: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        // Cache all static geo assets for 1 year (immutable after first load)
        source: '/geo/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, stale-while-revalidate=86400',
          },
        ],
      },
      {
        // Cache choropleth API for 10 minutes, serve stale for up to 1 hour
        source: '/api/map/choropleth',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=600, stale-while-revalidate=3600',
          },
        ],
      },
    ];
  },
};

export default nextConfig;


