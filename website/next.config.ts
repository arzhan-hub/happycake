import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/hackathon-assets/:path*',
        destination: 'https://www.steppebusinessclub.com/hackathon-assets/:path*',
      },
    ];
  },
};

export default nextConfig;
