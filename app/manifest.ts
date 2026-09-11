import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mateo & Genesis — Wedding Gallery",
    short_name: "Wedding Gallery",
    description: "Scan, snap and share your favourite moments from the wedding.",
    start_url: "/g/demo",
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
