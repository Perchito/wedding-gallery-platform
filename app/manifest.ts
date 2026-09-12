import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wedding Gallery",
    short_name: "Wedding Gallery",
    description:
      "Guests scan a QR code and share photos and videos straight into your private event gallery.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fffaf6",
    theme_color: "#b5615f",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}