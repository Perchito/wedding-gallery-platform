"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Mobile browsers keep whatever pinch-zoom level a guest was at across
// client-side route changes (there's no built-in "reset zoom on navigate").
// The standard workaround: briefly force maximum-scale=1 on the viewport
// meta tag, which snaps the browser back to 1x, then restore the original
// (zoom-enabled) content so guests can still pinch-zoom on the new page.
// Skips the very first render so the initial page load isn't affected.
export function ViewportZoomReset() {
  const pathname = usePathname();
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;

    const original = viewport.getAttribute("content");
    if (!original) return;

    viewport.setAttribute("content", `${original}, maximum-scale=1`);
    const restore = window.setTimeout(() => {
      viewport.setAttribute("content", original);
    }, 100);

    return () => window.clearTimeout(restore);
  }, [pathname]);

  return null;
}
