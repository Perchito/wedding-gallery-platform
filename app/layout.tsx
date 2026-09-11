import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Infant, Great_Vibes } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ViewportZoomReset } from "@/components/ViewportZoomReset";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Heading/body pairing recommended by the ui-ux-pro-max design-system search
// for "wedding celebration romantic elegant photo gallery" — see
// design-system/wedding-gallery-platform/MASTER.md. Great Vibes is reserved
// for small decorative accents only (script fonts hurt legibility at UI
// sizes); Cormorant Infant carries all display headings.
const cormorant = Cormorant_Infant({
  variable: "--font-cormorant",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const greatVibes = Great_Vibes({
  variable: "--font-great-vibes",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mateo & Genesis — Wedding Gallery",
  description:
    "Scan, snap and share your favourite moments from Mateo & Genesis's wedding.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wedding Gallery",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#db2777",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${greatVibes.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <ServiceWorkerRegister />
        <ViewportZoomReset />
      </body>
    </html>
  );
}
