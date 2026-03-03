import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/app',
          destination: 'https://gapstrike-app.vercel.app',
        },
        {
          source: '/app/:path*',
          destination: 'https://gapstrike-app.vercel.app/:path*',
        },
      ],
      fallback: [
        // Proxy unhandled API routes to gapstrike-app
        // (saas-shell's own routes like /api/me, /api/logout are served first)
        {
          source: '/api/:path*',
          destination: 'https://gapstrike-app.vercel.app/api/:path*',
        },
      ],
    }
  },
};

export default nextConfig;
