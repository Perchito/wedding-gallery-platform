"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type QRCodeStylingType from "qr-code-styling";
import { cn } from "@/lib/cn";
import type { Gallery } from "@/lib/types";

// Themed looks for the gallery QR. All use level-H error correction so a
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
const INK_MUTED = "#75716A";
const CREAM = "#FFF9F6";
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

type CardBackground = "cream" | "rose" | "photo";

function coupleInitials(gallery: Gallery) {
  return gallery.partnerNames
    .map((n) => n.trim().charAt(0).toUpperCase())
    .filter(Boolean);
}

function displayUrl(url: string) {
  return url.split("://").pop() ?? url;
}

// Cream circle with serif initials — the code's centre monogram. Drawn via
// canvas so there's no image asset to host, and sized generously so it
// reads at arm's length on both the preview and print downloads.
function drawMonogram(initials: string[]): string {
  const size = 200;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = BLUSH_DEEP;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 56px Georgia, 'Times New Roman', serif";
  ctx.fillText(initials.join(" & "), size / 2, size / 2 + 3);

  return canvas.toDataURL("image/png");
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
}

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  gallery: Gallery;
  galleryUrl: string;
}

export function ShareSheet({ open, onClose, gallery, galleryUrl }: ShareSheetProps) {
  const [preset, setPreset] = useState<QRPreset["id"]>("rose");
  const [withLogo, setWithLogo] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloadingQR, setDownloadingQR] = useState(false);
  const [downloadingCard, setDownloadingCard] = useState(false);
  const [cardBackground, setCardBackground] = useState<CardBackground>("cream");
  const [cardPhotoUrl, setCardPhotoUrl] = useState<string | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStylingType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // qr-code-styling touches window/canvas on import, so it loads client-side only.
  const libRef = useRef<typeof import("qr-code-styling")["default"] | null>(null);

  const initials = useMemo(() => coupleInitials(gallery), [gallery]);
  const coupleLabel = useMemo(() => gallery.partnerNames.join(" & "), [gallery]);
  const activePreset = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];

  async function ensureLib() {
    if (!libRef.current) {
      const mod = await import("qr-code-styling");
      libRef.current = mod.default;
    }
    return libRef.current;
  }

  function qrOptions(width: number, margin: number) {
    return {
      width,
      height: width,
      type: "canvas" as const,
      data: galleryUrl,
      image: withLogo && initials.length > 0 ? drawMonogram(initials) : undefined,
      margin,
      qrOptions: { errorCorrectionLevel: "H" as const },
      imageOptions: {
        crossOrigin: "anonymous" as const,
        margin: 4,
        imageSize: 0.4,
      },
      backgroundOptions: { color: CREAM },
      dotsOptions: activePreset.dotsOptions,
      cornersSquareOptions: activePreset.cornersSquareOptions,
      cornersDotOptions: activePreset.cornersDotOptions,
    };
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Lib = await ensureLib();
      if (cancelled || !Lib) return;

      const options = Object.assign(qrOptions(230, 6), { type: "svg" as const });
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
    // qrOptions captures galleryUrl / initials / activePreset / withLogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryUrl, preset, initials, activePreset, withLogo]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(galleryUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      document
        .querySelector<HTMLInputElement>("#share-gallery-url")
        ?.select();
    }
  }

  async function shareNative() {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: coupleLabel + " — gallery",
        text: "Add your photos, leave a message",
        url: galleryUrl,
      });
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  }

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Fresh 1024px render rather than upscaling the preview, so printed edges
  // stay razor sharp.
  async function downloadQR() {
    if (downloadingQR) return;
    setDownloadingQR(true);
    try {
      const Lib = await ensureLib();
      if (!Lib) throw new Error("QR library unavailable");
      const hiRes = new Lib(qrOptions(1024, 24));
      const raw = await hiRes.getRawData("png");
      if (!(raw instanceof Blob)) throw new Error("No image produced");
      triggerDownload(raw, gallery.slug + "-gallery-qr.png");
    } catch (err) {
      console.error("[share] QR download failed:", err);
    } finally {
      setDownloadingQR(false);
    }
  }

  function pickCardPhoto(file: File | null) {
    if (!file) return;
    setCardPhotoUrl(URL.createObjectURL(file));
    setCardBackground("photo");
  }

  // 1200×1800 (4×6in) table card: background (cream / rosé wash / uploaded
  // photo under a cream scrim), names, styled QR on a white card, tagline, URL.
  async function downloadTableCard() {
    if (downloadingCard) return;
    setDownloadingCard(true);
    try {
      const Lib = await ensureLib();
      if (!Lib) throw new Error("QR library unavailable");

      const W = 1200;
      const H = 1800;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");

      if (cardBackground === "photo" && cardPhotoUrl) {
        const img = new Image();
        img.src = cardPhotoUrl;
        await img.decode();
        drawCover(ctx, img, W, H);
        // Cream scrim keeps the code scanning regardless of the photo.
        ctx.fillStyle = "rgba(255, 249, 246, 0.78)";
        ctx.fillRect(0, 0, W, H);
      } else if (cardBackground === "rose") {
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, CREAM);
        grad.addColorStop(0.5, BLUSH_SOFT);
        grad.addColorStop(1, CREAM);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = CREAM;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.textAlign = "center";
      ctx.fillStyle = INK;
      ctx.font = "600 96px Georgia, 'Times New Roman', serif";
      ctx.fillText(coupleLabel, W / 2, 260);
      ctx.fillStyle = INK_MUTED;
      ctx.font = "400 42px Georgia, 'Times New Roman', serif";
      ctx.fillText("Scan to share your photos and messages", W / 2, 340);

      const qrSize = 700;
      const qr = new Lib(qrOptions(qrSize, 16));
      const raw = await qr.getRawData("png");
      if (!(raw instanceof Blob)) throw new Error("No QR produced");
      const qrBitmap = await createImageBitmap(raw);

      // White card behind the code for guaranteed contrast over any background.
      const pad = 40;
      const cardW = qrSize + pad * 2;
      const qx = (W - cardW) / 2;
      const qy = 470 - pad;
      ctx.fillStyle = "#FFFFFF";
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(qx, qy, cardW, cardW, 48);
        ctx.fill();
      } else {
        ctx.fillRect(qx, qy, cardW, cardW);
      }
      ctx.drawImage(qrBitmap, (W - qrSize) / 2, 470, qrSize, qrSize);

      ctx.fillStyle = INK_MUTED;
      ctx.font = "400 44px Georgia, 'Times New Roman', serif";
      ctx.fillText(displayUrl(galleryUrl), W / 2, 1370);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("Card render failed");
      triggerDownload(blob, gallery.slug + "-table-card.png");
    } catch (err) {
      console.error("[share] Table card download failed:", err);
    } finally {
      setDownloadingCard(false);
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
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-cream px-5 pb-8 pt-3 shadow-sheet"
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

            <div className="mt-4 flex items-start justify-center gap-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className="flex flex-col items-center gap-1"
                  aria-label={"QR style: " + p.label}
                >
                  <span
                    className={cn(
                      "h-9 w-9 rounded-full border-2 transition",
                      p.swatchClass,
                      preset === p.id ? "border-ink ring-2 ring-ink/20" : "border-transparent"
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
              <div className="mx-1 h-9 w-px bg-border" />
              <button
                onClick={() => setWithLogo((v) => !v)}
                className="flex flex-col items-center gap-1"
                aria-pressed={withLogo}
                aria-label="Toggle monogram"
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full border-2 text-[10px] font-semibold transition",
                    withLogo
                      ? "border-ink bg-cream text-ink"
                      : "border-dashed border-ink-muted/40 text-ink-muted"
                  )}
                >
                  {initials.length > 0 ? initials.join("&") : "--"}
                </span>
                <span
                  className={cn(
                    "text-[10px]",
                    withLogo ? "font-semibold" : "text-ink-muted"
                  )}
                >
                  {withLogo ? "Logo on" : "No logo"}
                </span>
              </button>
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
                  Share
                </button>
              )}
              <button
                onClick={downloadQR}
                disabled={downloadingQR}
                className="flex-1 rounded-xl border border-pine py-3 text-sm font-semibold text-pine disabled:opacity-60"
              >
                {downloadingQR ? "Preparing…" : "Download QR"}
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-white/60 p-4">
              <p className="text-sm font-semibold">Make a table card</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                4x6in print PNG with your names, the QR and the link.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setCardBackground("cream")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    cardBackground === "cream"
                      ? "bg-ink text-cream"
                      : "border border-border text-ink-muted"
                  )}
                >
                  Cream
                </button>
                <button
                  onClick={() => setCardBackground("rose")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    cardBackground === "rose"
                      ? "bg-ink text-cream"
                      : "border border-border text-ink-muted"
                  )}
                >
                  Rosé wash
                </button>
                <button
                  onClick={() => {
                    if (cardPhotoUrl) setCardBackground("photo");
                    else fileInputRef.current?.click();
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    cardBackground === "photo"
                      ? "bg-ink text-cream"
                      : "border border-border text-ink-muted"
                  )}
                >
                  {cardPhotoUrl ? "Photo selected — tap to keep, upload to change" : "Your photo"}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted"
                >
                  {cardPhotoUrl ? "Change photo" : "Upload photo"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickCardPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
              <button
                onClick={downloadTableCard}
                disabled={downloadingCard}
                className="mt-3 w-full rounded-xl bg-pine py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {downloadingCard ? "Building card…" : "Download table card"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}