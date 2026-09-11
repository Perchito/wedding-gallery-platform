"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Link2, MessageCircle, Share2, Download, CheckCircle2 } from "lucide-react";
import { BottomSheet } from "@/components/sheets/BottomSheet";
import { galleryQrPngDataUrl, galleryQrSvgString, downloadDataUrl, downloadBlob } from "@/lib/qr";
import { formatEventDate } from "@/lib/utils";
import type { Gallery } from "@/lib/types";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  gallery: Gallery;
  galleryUrl: string;
}

export function ShareSheet({ open, onClose, gallery, galleryUrl }: ShareSheetProps) {
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    galleryQrPngDataUrl(galleryUrl).then(setQrPng);
  }, [open, galleryUrl]);

  async function handleCopy() {
    await navigator.clipboard.writeText(galleryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    const text = `${gallery.partnerNames[0]} & ${gallery.partnerNames[1]} — ${formatEventDate(
      gallery.eventDate
    )}\nShare your photos here: ${galleryUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${gallery.partnerNames[0]} & ${gallery.partnerNames[1]}`,
          text: "Share your wedding photos with us!",
          url: galleryUrl,
        });
      } catch {
        // cancelled — no-op
      }
    } else {
      handleCopy();
    }
  }

  async function handleDownloadPng() {
    const dataUrl = await galleryQrPngDataUrl(galleryUrl, 1024);
    downloadDataUrl(dataUrl, `${gallery.slug}-qr-code.png`);
  }

  async function handleDownloadSvg() {
    const svg = await galleryQrSvgString(galleryUrl);
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${gallery.slug}-qr-code.svg`);
  }

  async function handleDownloadPdfCard() {
    const [{ jsPDF }, pngUrl] = await Promise.all([
      import("jspdf"),
      galleryQrPngDataUrl(galleryUrl, 800),
    ]);
    const doc = new jsPDF({ unit: "mm", format: "a5" });
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(255, 250, 246);
    doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");

    doc.setTextColor(36, 28, 25);
    doc.setFont("times", "bold");
    doc.setFontSize(26);
    doc.text(`${gallery.partnerNames[0]} & ${gallery.partnerNames[1]}`, pageW / 2, 25, {
      align: "center",
    });

    doc.setFont("times", "normal");
    doc.setFontSize(13);
    doc.text(formatEventDate(gallery.eventDate), pageW / 2, 34, { align: "center" });

    const qrSize = 70;
    doc.addImage(pngUrl, "PNG", (pageW - qrSize) / 2, 45, qrSize, qrSize);

    doc.setFont("times", "bolditalic");
    doc.setFontSize(15);
    doc.text("Share your memories", pageW / 2, 128, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.text("Scan to upload photos", pageW / 2, 136, { align: "center" });

    doc.save(`${gallery.slug}-wedding-card.pdf`);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Share Gallery" widthClass="sm:max-w-md">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-2">
          <ShareAction icon={<Link2 size={18} />} label={copied ? "Copied!" : "Copy Link"} onClick={handleCopy} />
          <ShareAction icon={<MessageCircle size={18} />} label="WhatsApp" onClick={handleWhatsApp} />
          <ShareAction icon={<Share2 size={18} />} label="Share" onClick={handleNativeShare} />
        </div>

        {copied && (
          <div className="flex items-center gap-2 text-sm text-blush-dark">
            <CheckCircle2 size={16} /> Link copied!
          </div>
        )}

        <div className="flex flex-col items-center gap-3 rounded-xl border border-border p-4">
          {qrPng && (
            <Image src={qrPng} alt="Gallery QR code" width={180} height={180} unoptimized />
          )}
          <p className="text-center text-xs text-ink-muted break-all">{galleryUrl}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <DownloadChip label="PNG" onClick={handleDownloadPng} />
            <DownloadChip label="SVG" onClick={handleDownloadSvg} />
            <DownloadChip label="Wedding Card PDF" onClick={handleDownloadPdfCard} />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

function ShareAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border py-3 text-xs font-medium text-ink-muted hover:border-blush-dark/40 hover:text-blush-dark"
    >
      {icon}
      {label}
    </button>
  );
}

function DownloadChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-blush-dark/40"
    >
      <Download size={12} />
      {label}
    </button>
  );
}
