"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { getCreatedGalleryBySlug } from "@/lib/created-galleries";
import { formatEventDate } from "@/lib/utils";
import {
  galleryQrPngDataUrl,
  galleryQrSvgString,
  downloadDataUrl,
  downloadBlob,
  generateWeddingCardPdf,
  type CardFont,
} from "@/lib/qr";
import type { Gallery } from "@/lib/types";

interface QrCardCustomizerProps {
  slug: string;
  serverGallery: Gallery | null;
}

const FONT_OPTIONS: { id: CardFont; label: string; previewClass: string }[] = [
  { id: "times", label: "Elegant Serif", previewClass: "font-display" },
  { id: "helvetica", label: "Modern Sans", previewClass: "font-sans" },
  { id: "courier", label: "Typewriter", previewClass: "font-mono" },
];

export function QrCardCustomizer({ slug, serverGallery }: QrCardCustomizerProps) {
  const [gallery, setGallery] = useState<Gallery | null>(serverGallery);
  const [resolved, setResolved] = useState(Boolean(serverGallery));

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (serverGallery) return;
    setGallery(getCreatedGalleryBySlug(slug));
    setResolved(true);
  }, [slug, serverGallery]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [partnerA, setPartnerA] = useState("");
  const [partnerB, setPartnerB] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [tagline, setTagline] = useState("Share your memories");
  const [instructions, setInstructions] = useState("Scan to upload photos");
  const [backgroundColor, setBackgroundColor] = useState("#fdf2f8");
  const [textColor, setTextColor] = useState("#831843");
  const [accentColor, setAccentColor] = useState("#db2777");
  const [font, setFont] = useState<CardFont>("times");
  const [qrSizeMm, setQrSizeMm] = useState(70);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!gallery) return;
    setPartnerA(gallery.partnerNames[0]);
    setPartnerB(gallery.partnerNames[1]);
    setDateLabel(formatEventDate(gallery.eventDate));
  }, [gallery]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const galleryUrl = useMemo(() => {
    if (typeof window === "undefined" || !gallery) return "";
    return `${window.location.origin}/g/${gallery.slug}`;
  }, [gallery]);

  useEffect(() => {
    if (!galleryUrl) return;
    galleryQrPngDataUrl(galleryUrl, 300).then(setQrPreview);
  }, [galleryUrl]);

  function handleLogoUpload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleDownloadPdf() {
    if (!gallery) return;
    await generateWeddingCardPdf({
      partnerA,
      partnerB,
      eventDateLabel: dateLabel,
      galleryUrl,
      tagline,
      instructions,
      backgroundColor,
      textColor,
      accentColor,
      font,
      qrSizeMm,
      logoDataUrl,
      fileName: `${gallery.slug}-wedding-card.pdf`,
    });
  }

  async function handleDownloadPng() {
    if (!gallery) return;
    const dataUrl = await galleryQrPngDataUrl(galleryUrl, 1024);
    downloadDataUrl(dataUrl, `${gallery.slug}-qr-code.png`);
  }

  async function handleDownloadSvg() {
    if (!gallery) return;
    const svg = await galleryQrSvgString(galleryUrl);
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${gallery.slug}-qr-code.svg`);
  }

  if (!resolved) return null;

  if (!gallery) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="font-display text-xl font-semibold">Gallery not found</p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm text-blush-dark hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-blush-dark"
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <h1 className="font-display text-2xl font-semibold">Customize QR Wedding Card</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Printable signage guests scan to open the gallery — tweak it, then
        export as PDF, PNG, or SVG.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Partner 1" value={partnerA} onChange={setPartnerA} />
            <TextField label="Partner 2" value={partnerB} onChange={setPartnerB} />
          </div>
          <TextField label="Date label" value={dateLabel} onChange={setDateLabel} />
          <TextField label="Tagline" value={tagline} onChange={setTagline} />
          <TextField label="Instructions" value={instructions} onChange={setInstructions} />

          <div>
            <p className="mb-1.5 text-sm font-medium">Typography</p>
            <div className="flex gap-2">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFont(f.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    font === f.id
                      ? "border-blush-dark bg-blush-dark text-white"
                      : "border-border text-ink-muted"
                  } ${f.previewClass}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <ColorField label="Background" value={backgroundColor} onChange={setBackgroundColor} />
            <ColorField label="Text" value={textColor} onChange={setTextColor} />
            <ColorField label="QR / accent" value={accentColor} onChange={setAccentColor} />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">
              QR size <span className="font-normal text-ink-muted">({qrSizeMm}mm)</span>
            </p>
            <input
              type="range"
              min={40}
              max={100}
              value={qrSizeMm}
              onChange={(e) => setQrSizeMm(Number(e.target.value))}
              className="w-full accent-[var(--blush-dark)]"
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">
              Logo <span className="font-normal text-ink-muted">(optional)</span>
            </p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => logoInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-blush-dark/40"
            >
              <Upload size={12} /> {logoDataUrl ? "Replace logo" : "Upload logo"}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div
            className="flex aspect-[148/210] w-full max-w-[260px] flex-col items-center justify-start gap-3 rounded-lg p-6 text-center shadow-lg"
            style={{ backgroundColor }}
          >
            {logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoDataUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            )}
            <p
              className={`text-xl font-semibold leading-tight ${
                FONT_OPTIONS.find((f) => f.id === font)?.previewClass ?? "font-display"
              }`}
              style={{ color: textColor }}
            >
              {partnerA || "Partner 1"} &amp; {partnerB || "Partner 2"}
            </p>
            <p className="text-xs" style={{ color: textColor }}>
              {dateLabel || "Event date"}
            </p>
            {qrPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrPreview}
                alt="QR preview"
                style={{ width: `${qrSizeMm}%`, maxWidth: 140 }}
              />
            )}
            <p className="text-sm font-semibold italic" style={{ color: textColor }}>
              {tagline}
            </p>
            <p className="text-xs" style={{ color: textColor }}>
              {instructions}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2">
            <button
              onClick={handleDownloadPdf}
              className="flex items-center justify-center gap-1.5 rounded-full bg-blush-dark px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              <Download size={14} /> Download PDF Card
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPng}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2 text-xs font-medium hover:border-blush-dark/40"
              >
                QR as PNG
              </button>
              <button
                onClick={handleDownloadSvg}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2 text-xs font-medium hover:border-blush-dark/40"
              >
                QR as SVG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input-field" />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
        />
        <span className="text-xs text-ink-muted">{value}</span>
      </div>
    </label>
  );
}
