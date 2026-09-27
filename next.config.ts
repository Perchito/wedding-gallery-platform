import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Served at its own subdomain (gallery.perchito.app) via Cloudflare Tunnel
  // — no basePath needed now (that was a workaround for Tailscale Funnel's
  // 3-public-port ceiling, before the domain existed).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "gallery-api.perchito.app",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
