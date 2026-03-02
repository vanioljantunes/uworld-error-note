import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/app',
        destination: 'https://gapstrike-app.vercel.app',
      },
      {
        source: '/app/:path*',
        destination: 'https://gapstrike-app.vercel.app/:path*',
      },
    ]
  },
};

export default nextConfig;
