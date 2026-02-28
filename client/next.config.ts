import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "https://apex-cli.onrender.com"}/api/auth/:path*`,
      },
      {
        source: "/api/cli-auth/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "https://apex-cli.onrender.com"}/api/cli-auth/:path*`,
      }
    ];
  },
};

export default nextConfig;
