"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { formatEventDate } from "@/lib/utils";
import {
  blobToDataUrl,
  generateWeddingCardPdf,
  type CardFont,
  type CenterImageMode,
  type QrCardSettings,
} from "@/lib/qr";
import type { Gallery } from "@/lib/types";
import type QRCodeStylingType from "qr-code-styling";
import type { CornerDotType, CornerSquareType, DotType, ErrorCorrectionLevel } from "qr-code-styling";

interface QrCardCustomizerProps {
  galleryId: string;
  serverGallery: Gallery | null;
}

const FONT_OPTIONS: { id: CardFont; label: string; previewClass: string }[] = [
  { id: "times", label: "Elegant Serif", previewClass: "font-display" },
  { id: "helvetica", label: "Modern Sans", previewClass: "font-sans" },
  { id: "courier", label: "Typewriter", previewClass: "font-mono" },
];

const DOT_STYLE_OPTIONS: { id: DotType; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "dots", label: "Dots" },
  { id: "rounded", label: "Rounded" },
  { id: "classy", label: "Classy" },
  { id: "classy-rounded", label: "Classy round" },
  { id: "extra-rounded", label: "Extra round" },
];

const CORNER_STYLE_OPTIONS: {
  id: string;
  label: string;
  square: CornerSquareType;
  dot: CornerDotType;
}[] = [
  { id: "square", label: "Square", square: "square", dot: "square" },
  { id: "rounded", label: "Rounded", square: "extra-rounded", dot: "dot" },
  { id: "dot", label: "Dot", square: "dot", dot: "dot" },
];

const ERROR_CORRECTION_OPTIONS: { id: ErrorCorrectionLevel; label: string }[] = [
  { id: "L", label: "L" },
  { id: "M", label: "M" },
  { id: "Q", label: "Q" },
  { id: "H", label: "H" },
];

// A5 page width in mm — the live preview card is drawn at this aspect ratio,
// so a QR's on-screen size can be expressed as a plain percentage of the
// card's width instead of guessing pixel widths.
const CARD_WIDTH_MM = 148;
const MIN_QR_MM = 30;
const MAX_QR_MM = 120;

const SAVE_DEBOUNCE_MS = 500;

async function saveQrCardSettings(galleryId: string, settings: QrCardSettings) {
  const res = await fetch(`/api/galleries/${galleryId}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qrCardSettings: settings }),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
}

export function QrCardCustomizer({ galleryId, serverGallery }: QrCardCustomizerProps) {
  const gallery = serverGallery;

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
  const [dotStyle, setDotStyle] = useState<DotType>("rounded");
  const [cornerStyleId, setCornerStyleId] = useState("rounded");
  const [errorCorrection, setErrorCorrection] = useState<ErrorCorrectionLevel>("M");
  const [marginRatio, setMarginRatio] = useState(0.05);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [centerImageMode, setCenterImageMode] = useState<CenterImageMode>("none");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"pdf" | "png" | "svg" | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const [cardWidthPx, setCardWidthPx] = useState(260);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStylingType | null>(null);
  const libRef = useRef<typeof import("qr-code-styling")["default"] | null>(null);
  const hydratedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load settings saved from a previous visit (any device — this now reads
  // from gallery_settings.qr_card_settings, not browser storage) before
  // anything else runs, so the autosave effect below doesn't get a chance
  // to stomp them with fresh defaults.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!gallery) return;
    const saved = gallery.settings.qrCardSettings ?? null;
    setPartnerA(saved?.partnerA ?? gallery.partnerNames[0]);
    setPartnerB(saved?.partnerB ?? gallery.partnerNames[1]);
    setDateLabel(saved?.dateLabel ?? formatEventDate(gallery.eventDate));
    if (saved?.tagline !== undefined) setTagline(saved.tagline);
    if (saved?.instructions !== undefined) setInstructions(saved.instructions);
    if (saved?.backgroundColor !== undefined) setBackgroundColor(saved.backgroundColor);
    if (saved?.textColor !== undefined) setTextColor(saved.textColor);
    if (saved?.accentColor !== undefined) setAccentColor(saved.accentColor);
    if (saved?.font !== undefined) setFont(saved.font);
    if (saved?.qrSizeMm !== undefined) setQrSizeMm(saved.qrSizeMm);
    if (saved?.dotStyle !== undefined) setDotStyle(saved.dotStyle);
    if (saved?.cornerStyleId !== undefined) setCornerStyleId(saved.cornerStyleId);
    if (saved?.errorCorrection !== undefined) setErrorCorrection(saved.errorCorrection);
    if (saved?.marginRatio !== undefined) setMarginRatio(saved.marginRatio);
    if (saved?.transparentBackground !== undefined) setTransparentBackground(saved.transparentBackground);
    if (saved?.centerImageMode !== undefined) setCenterImageMode(saved.centerImageMode);
    if (saved?.logoDataUrl !== undefined) setLogoDataUrl(saved.logoDataUrl);
    hydratedRef.current = true;
  }, [gallery]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Autosave to the gallery's own settings row, debounced — this is what
  // stands in for a save button, and (unlike the localStorage version this
  // replaced) follows the gallery to any browser or device.
  useEffect(() => {
    if (!gallery || !hydratedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus("saving");
    saveTimeoutRef.current = setTimeout(() => {
      const snapshot: QrCardSettings = {
        partnerA,
        partnerB,
        dateLabel,
        tagline,
        instructions,
        backgroundColor,
        textColor,
        accentColor,
        font,
        qrSizeMm,
        dotStyle,
        cornerStyleId,
        errorCorrection,
        marginRatio,
        transparentBackground,
        centerImageMode,
        logoDataUrl,
      };
      saveQrCardSettings(gallery.id, snapshot)
        .then(() => setSaveStatus("saved"))
        .catch((err) => {
          console.error("[qr-card] failed to save settings:", err);
          setSaveStatus("error");
        });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [
    gallery,
    partnerA,
    partnerB,
    dateLabel,
    tagline,
    instructions,
    backgroundColor,
    textColor,
    accentColor,
    font,
    qrSizeMm,
    dotStyle,
    cornerStyleId,
    errorCorrection,
    marginRatio,
    transparentBackground,
    centerImageMode,
    logoDataUrl,
  ]);

  const galleryUrl = useMemo(() => {
    if (typeof window === "undefined" || !gallery) return "";
    return `${window.location.origin}/g/${gallery.slug}`;
  }, [gallery]);

  const initials = useMemo(
    () => [partnerA, partnerB].map((n) => n.trim().charAt(0).toUpperCase()).filter(Boolean),
    [partnerA, partnerB]
  );

  const cornerStyle = CORNER_STYLE_OPTIONS.find((c) => c.id === cornerStyleId) ?? CORNER_STYLE_OPTIONS[0];

  // A logo or monogram sitting on top of the code needs a generous error
  // budget so it stays scannable — nudge weaker levels up when one is enabled.
  function selectCenterImageMode(mode: CenterImageMode) {
    setCenterImageMode(mode);
    if (mode !== "none") {
      setErrorCorrection((prev) => (prev === "L" || prev === "M" ? "H" : prev));
    }
  }

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setCardWidthPx(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  async function ensureLib() {
    if (!libRef.current) {
      const mod = await import("qr-code-styling");
      libRef.current = mod.default;
    }
    return libRef.current;
  }

  function centerImage(): string | undefined {
    if (centerImageMode === "logo") return logoDataUrl ?? undefined;
    if (centerImageMode === "monogram" && initials.length > 0) return drawMonogram(initials, accentColor);
    return undefined;
  }

  function buildQrOptions(width: number) {
    return {
      width,
      height: width,
      data: galleryUrl,
      margin: Math.round(width * marginRatio),
      image: centerImage(),
      qrOptions: { errorCorrectionLevel: errorCorrection },
      imageOptions: { crossOrigin: "anonymous" as const, margin: 4, imageSize: 0.35 },
      backgroundOptions: { color: transparentBackground ? "transparent" : "#ffffff" },
      dotsOptions: { type: dotStyle, color: accentColor },
      cornersSquareOptions: { type: cornerStyle.square, color: accentColor },
      cornersDotOptions: { type: cornerStyle.dot, color: accentColor },
    };
  }

  const previewPx = Math.max(24, Math.round((qrSizeMm / CARD_WIDTH_MM) * cardWidthPx));

  useEffect(() => {
    if (!galleryUrl) return;
    let cancelled = false;
    (async () => {
      const Lib = await ensureLib();
      if (cancelled || !Lib) return;

      const options = Object.assign(buildQrOptions(previewPx), { type: "canvas" as const });
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
    // buildQrOptions closes over every style field below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    galleryUrl,
    previewPx,
    dotStyle,
    cornerStyleId,
    errorCorrection,
    marginRatio,
    transparentBackground,
    centerImageMode,
    logoDataUrl,
    initials,
    accentColor,
  ]);

  function handleLogoUpload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(reader.result as string);
      selectCenterImageMode("logo");
    };
    reader.readAsDataURL(file);
  }

  async function handleDownloadPdf() {
    if (!gallery || downloading) return;
    setDownloading("pdf");
    try {
      const Lib = await ensureLib();
      if (!Lib) throw new Error("QR library unavailable");
      const hiRes = new Lib(Object.assign(buildQrOptions(1024), { type: "canvas" as const }));
      const raw = await hiRes.getRawData("png");
      if (!(raw instanceof Blob)) throw new Error("No QR image produced");
      const qrDataUrl = await blobToDataUrl(raw);

      await generateWeddingCardPdf({
        partnerA,
        partnerB,
        eventDateLabel: dateLabel,
        qrDataUrl,
        tagline,
        instructions,
        backgroundColor,
        textColor,
        font,
        qrSizeMm,
        logoDataUrl: centerImageMode === "logo" ? null : logoDataUrl,
        fileName: `${gallery.slug}-wedding-card.pdf`,
      });
    } catch (err) {
      console.error("[qr-card] PDF export failed:", err);
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadPng() {
    if (!gallery || downloading) return;
    setDownloading("png");
    try {
      const Lib = await ensureLib();
      if (!Lib) throw new Error("QR library unavailable");
      const hiRes = new Lib(Object.assign(buildQrOptions(1600), { type: "canvas" as const }));
      await hiRes.download({ name: `${gallery.slug}-qr-code`, extension: "png" });
    } catch (err) {
      console.error("[qr-card] PNG export failed:", err);
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadSvg() {
    if (!gallery || downloading) return;
    setDownloading("svg");
    try {
      const Lib = await ensureLib();
      if (!Lib) throw new Error("QR library unavailable");
      const hiRes = new Lib(Object.assign(buildQrOptions(1600), { type: "svg" as const }));
      await hiRes.download({ name: `${gallery.slug}-qr-code`, extension: "svg" });
    } catch (err) {
      console.error("[qr-card] SVG export failed:", err);
    } finally {
      setDownloading(null);
    }
  }

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
        href={`/dashboard/galleries/${galleryId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-blush-dark"
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <h1 className="font-display text-2xl font-semibold">Customize QR Wedding Card</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Printable signage guests scan to open the gallery — tweak it, then
        export as PDF, PNG, or SVG.
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            saveStatus === "saved"
              ? "bg-emerald-500"
              : saveStatus === "error"
                ? "bg-red-500"
                : saveStatus === "saving"
                  ? "bg-amber-400"
                  : "bg-ink-muted/40"
          }`}
        />
        {saveStatus === "saved" && "Saved to your account"}
        {saveStatus === "saving" && "Saving…"}
        {saveStatus === "error" && "Couldn't save changes — check your connection and try again"}
        {saveStatus === "idle" && "Changes save automatically as you edit"}
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
                <PillButton key={f.id} active={font === f.id} onClick={() => setFont(f.id)} className={f.previewClass}>
                  {f.label}
                </PillButton>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <ColorField label="Background" value={backgroundColor} onChange={setBackgroundColor} />
            <ColorField label="Text" value={textColor} onChange={setTextColor} />
            <ColorField label="QR pattern" value={accentColor} onChange={setAccentColor} />
          </div>

          <div className="h-px bg-border" />
          <p className="text-sm font-semibold">QR style</p>

          <div>
            <p className="mb-1.5 text-sm font-medium">Dot style</p>
            <div className="flex flex-wrap gap-2">
              {DOT_STYLE_OPTIONS.map((d) => (
                <PillButton key={d.id} active={dotStyle === d.id} onClick={() => setDotStyle(d.id)}>
                  {d.label}
                </PillButton>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Corner style</p>
            <div className="flex gap-2">
              {CORNER_STYLE_OPTIONS.map((c) => (
                <PillButton key={c.id} active={cornerStyleId === c.id} onClick={() => setCornerStyleId(c.id)}>
                  {c.label}
                </PillButton>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">
              Error correction{" "}
              <span className="font-normal text-ink-muted">
                — higher stays scannable if the center image covers part of the code
              </span>
            </p>
            <div className="flex gap-2">
              {ERROR_CORRECTION_OPTIONS.map((e) => (
                <PillButton key={e.id} active={errorCorrection === e.id} onClick={() => setErrorCorrection(e.id)}>
                  {e.label}
                </PillButton>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">
              Quiet zone <span className="font-normal text-ink-muted">({Math.round(marginRatio * 100)}%)</span>
            </p>
            <input
              type="range"
              min={0}
              max={15}
              value={Math.round(marginRatio * 100)}
              onChange={(e) => setMarginRatio(Number(e.target.value) / 100)}
              className="w-full accent-[var(--blush-dark)]"
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">QR background</p>
            <div className="flex gap-2">
              <PillButton active={!transparentBackground} onClick={() => setTransparentBackground(false)}>
                White
              </PillButton>
              <PillButton active={transparentBackground} onClick={() => setTransparentBackground(true)}>
                Transparent
              </PillButton>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Center image</p>
            <div className="flex flex-wrap items-center gap-2">
              <PillButton active={centerImageMode === "none"} onClick={() => selectCenterImageMode("none")}>
                None
              </PillButton>
              <PillButton
                active={centerImageMode === "monogram"}
                onClick={() => selectCenterImageMode("monogram")}
                disabled={initials.length === 0}
              >
                Initials
              </PillButton>
              <PillButton
                active={centerImageMode === "logo"}
                onClick={() => (logoDataUrl ? selectCenterImageMode("logo") : logoInputRef.current?.click())}
              >
                Custom logo
              </PillButton>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
              />
              {centerImageMode === "logo" && logoDataUrl && (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-blush-dark"
                >
                  <Upload size={12} /> Replace
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-border" />

          <div>
            <p className="mb-1.5 text-sm font-medium">
              QR size <span className="font-normal text-ink-muted">({qrSizeMm}mm)</span>
            </p>
            <input
              type="range"
              min={MIN_QR_MM}
              max={MAX_QR_MM}
              value={qrSizeMm}
              onChange={(e) => setQrSizeMm(Number(e.target.value))}
              className="w-full accent-[var(--blush-dark)]"
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div
            ref={cardRef}
            className="flex aspect-[148/210] w-full max-w-[260px] flex-col items-center justify-start gap-3 rounded-lg p-6 text-center shadow-lg"
            style={{ backgroundColor }}
          >
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
            <div
              ref={qrContainerRef}
              style={{ width: previewPx, height: previewPx }}
              className="shrink-0"
            />
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
              disabled={downloading !== null}
              className="flex items-center justify-center gap-1.5 rounded-full bg-blush-dark px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <Download size={14} /> {downloading === "pdf" ? "Preparing…" : "Download PDF Card"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPng}
                disabled={downloading !== null}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2 text-xs font-medium hover:border-blush-dark/40 disabled:opacity-60"
              >
                {downloading === "png" ? "Preparing…" : "QR as PNG"}
              </button>
              <button
                onClick={handleDownloadSvg}
                disabled={downloading !== null}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2 text-xs font-medium hover:border-blush-dark/40 disabled:opacity-60"
              >
                {downloading === "svg" ? "Preparing…" : "QR as SVG"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Serif initials on a transparent canvas — qr-code-styling clears the dots
// behind a center image and paints the QR's own background color there, so
// leaving this canvas transparent (no fill, no ring) lets the initials sit
// directly on whatever QR background the user picked instead of carrying a
// separate hardcoded one.
function drawMonogram(initials: string[], accentColor: string): string {
  const size = 200;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = accentColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 64px Georgia, 'Times New Roman', serif";
  ctx.fillText(initials.join(" & "), size / 2, size / 2 + 3);

  return canvas.toDataURL("image/png");
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

function PillButton({
  active,
  onClick,
  disabled,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-blush-dark bg-blush-dark text-white" : "border-border text-ink-muted"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
