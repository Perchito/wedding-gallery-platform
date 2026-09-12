"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type QRCodeStylingType from "qr-code-styling";
import { cn } from "@/lib/cn";
import type { Gallery } from "@/lib/types";

// Themed looks for the gallery QR. All use level-H error correction so the
// centre monogram never hurts scannability, and rounded/extra-rounded dot
// shapes keep the code feeling like wedding stationery rather than a
// shipping label.
interface QRPreset {
  id: "classic" | "rose" | "gold";
  label: string;
  swatchClass: string;
  dotsOptions: Record<string, unknown>;
  cornersSquareOptions: Record<string, unknown>;
  cornersDotOptions: Record<string, unknown>;
}

const INK = "#2D2A26";
const BLUSH_DEEP = "#C98FA4";
const BLUSH_SOFT = "#F3C5D4";
const GOLD_DEEP = "#B8935C";
const GOLD_SOFT = "#E7D3A7";

const PRESETS: QRPreset[] = [
  {
    id: "classic",
    label: "Charcoal Classic",
    swatchClass: "bg-[#2D2A26]",
    dotsOptions: { type: "rounded", color: INK },
    cornersSquareOptions: { type: "extra-rounded", color: INK },
    cornersDotOptions: { type: "dot", color: INK },
  },
  {
    id: "rose",
    label: "Rosé",
    swatchClass: "bg-gradient-to-br from-[#F3C5D4] to-[#C98FA4]",
    dotsOptions: {
      type: "classy",
      gradient: {
        type: "linear",
        rotation: Math.PI / 4,
        colorStops: [
          { offset: 0, color: BLUSH_SOFT },
          { offset: 1, color: BLUSH_DEEP },
        ],
      },
    },
    cornersSquareOptions: { type: "extra-rounded", color: BLUSH_DEEP },
    cornersDotOptions: { type: "dot", color: BLUSH_DEEP },
  },
  {
    id: "gold",
    label: "Gold Foil",
    swatchClass: "bg-gradient-to-br from-[#E7D3A7] to-[#B8935C]",
    dotsOptions: {
      type: "extra-rounded",
      gradient: {
        type: "linear",
        rotation: Math.PI / 4,
        colorStops: [
          { offset: 0, color: GOLD_SOFT },
          { offset: 1, color: GOLD_DEEP },
        ],
      },
    },
    cornersSquareOptions: { type: "extra-rounded", color: GOLD_DEEP },
    cornersDotOptions: { type: "dot", color: GOLD_DEEP },
  },
];

function coupleInitials(gallery: Gallery) {
  return gallery.partnerNames.map((n) => n.trim()[0]?.toUpperCase() ?? "").filter(Boolean);
}

// Little cream circle with serif initials — the code's centre monogram.
// Drawn to a data URI because qr-code-styling wants an image, and an
// on-the-fly canvas means no assets to host.
function drawMonogram(initials: string[]): string {
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#FFF9F6";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = BLUSH_DEEP;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 44px Georgia, 'Times New Roman', serif";
  ctx.fillText(initials.join(" & "), size / 2, size / 2 + 2);

  return canvas.toDataURL("image/png");
}

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  gallery: Gallery;
  galleryUrl: string;
}

export function ShareSheet({ open, onClose, gallery, galleryUrl }: ShareSheetProps) {
  const [preset, setPreset] = useState<QRPreset["id"]>("rose");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStylingType | null>(null);
  // Module is browser-only (touches canvas/window on import), so it comes
  // in via a dynamic import once we're mounted.
  const libRef = useRef<typeof import("qr-code-styling")["default"] | null>(null);

  const initials = useMemo(() => coupleInitials(gallery), [gallery]);
  const activePreset = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!libRef.current) {
        const mod = await import("qr-code-styling");
        if (cancelled) return;
        libRef.current = mod.default;
      }
      const Lib = libRef.current;
      if (!Lib) return;

      const options = {
        width: 230,
        height: 230,
        type: "svg" as const,
        data: galleryUrl,
        image: drawMonogram(initials),
        margin: 6,
        qrOptions: { errorCorrectionLevel: "H" as const },
        imageOptions: { crossOrigin: "anonymous" as const, margin: 2, imageSize: 0.35 },
        backgroundOptions: { color: "#FFF9F6" },
        dotsOptions: activePreset.dotsOptions,
        cornersSquareOptions: activePreset.cornersSquareOptions,
        cornersDotOptions: activePreset.cornersDotOptions,
      };

      if (!qrRef.current) {
        qrRef.current = new Lib(options);
        if (qrContainerRef.current) {
          qrContainerRef.current.innerHTML = "";
          qrRef.current.append(qrContainerRef.current);
        }
      } else {
        qrRef.current.update(options);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [galleryUrl, preset, initials, activePreset]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(galleryUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older iOS Safari: fall back to selecting the text for manual copy.
      const input = document.querySelector<HTMLInputElement>("#share-gallery-url");
      input?.select();
    }
  }

  async function shareNative() {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: `${gallery.partnerNames.join(" & ")} — gallery`,
        text: "Add your photos, leave a message 🥂",
        url: galleryUrl,
      });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  // Print-quality export: render a fresh 1024px code rather than upscaling
  // the on-screen one, so edge pixels stay razor sharp on table cards.
  async function downloadForPrint() {
    if (!libRef.current || downloading) return;
    setDownloading(true);
    try {
      const Lib = libRef.current;
      const hiRes = new Lib({
        width: 1024,
        height: 1024,
        type: "canvas",
        data: galleryUrl,
        image: drawMonogram(initials),
        margin: 24,
        qrOptions: { errorCorrectionLevel: "H" },
        imageOptions: { crossOrigin: "anonymous", margin: 12, imageSize: 0.35 },
        backgroundOptions: { color: "#FFF9F6" },
        dotsOptions: activePreset.dotsOptions,
        cornersSquareOptions: activePreset.cornersSquareOptions,
        cornersDotOptions: activePreset.cornersDotOptions,
      });
      const blob = await hiRes.getRawData("png");
      if (!(blob instanceof Blob)) throw new Error("No image produced");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${gallery.slug}-gallery-qr.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[share] QR download failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg rounded-t-3xl bg-cream px-5 pb-8 pt-3 shadow-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <h2 className="text-lg font-semibold">Share the gallery</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Point any phone camera at the code — no app needed.
            </p>

            <div className="mt-5 grid place-items-center">
              <div className="rounded-3xl border border-border bg-white p-4 shadow-sm">
                <div ref={qrContainerRef} className="h-[230px] w-[230px]" />
              </div>
            </div>

            {/* Look picker */}
            <div className="mt-4 flex justify-center gap-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className="flex flex-col items-center gap-1"
                  aria-label={`QR style: ${p.label}`}
                >
                  <span
                    className={cn(
                      "h-9 w-9 rounded-full border-2 transition",
                      p.swatchClass,
                      preset === p.id
                        ? "border-ink ring-2 ring-ink/20"
                        : "border-transparent"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px]",
                      preset === p.id ? "font-semibold" : "text-ink-muted"
                    )}
                  >
                    {p.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
              <input
                id="share-gallery-url"
                readOnly
                value={galleryUrl}
                className="min-w-0 flex-1 bg-transparent text-sm text-ink-muted"
              />
              <button
                onClick={copyLink}
                className="shrink-0 rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-white"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              {canNativeShare && (
                <button
                  onClick={shareNative}
                  className="flex-1 rounded-xl bg-blush-dark py-3 text-sm font-semibold text-white"
                >
                  Share…
                </button>
              )}
              <button
                onClick={downloadForPrint}
                disabled={downloading}
                className="flex-1 rounded-xl border border-pine py-3 text-sm font-semibold text-pine disabled:opacity-60"
              >
                {downloading ? "Preparing…" : "Download for print"}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-ink-muted">
              Print-ready 1024×1024 PNG — perfect for table cards and signage.
            </p>
          </motion.div>
        )}
      </>
    </AnimatePresence>
  );
}