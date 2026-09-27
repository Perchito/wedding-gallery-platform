import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Served behind the shared gateway at /wedding-gallery (see
  // ~/perchito-gateway on the server — Tailscale Funnel only allows 3 public
  // HTTPS ports, all already claimed, so every project shares one via
  // path-based routing instead of getting its own).
  basePath: "/wedding-gallery",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "perchito.tail401924.ts.net",
        pathname: "/wedding-gallery-api/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
