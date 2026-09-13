// ---------------------------------------------------------------------------
// Printable "QR Wedding Card" (spec section 25) — customizable signage with
// names, date, QR code, and instructions. jsPDF only ships a handful of
// built-in font families (no arbitrary Google Fonts without embedding TTFs),
// so "typography" is exposed as a choice between those built-ins rather than
// the webfonts used elsewhere in the app.
//
// The QR code itself is rendered upstream (by the caller, via
// qr-code-styling) so every export — live preview, standalone PNG/SVG, and
// this PDF card — shares one styling pipeline instead of drifting apart.
// ---------------------------------------------------------------------------

import type { DotType, ErrorCorrectionLevel } from "qr-code-styling";

export type CardFont = "times" | "helvetica" | "courier";

export type CenterImageMode = "none" | "monogram" | "logo";

// Everything the QR wedding card customizer lets an owner tweak, persisted
// as-is in gallery_settings.qr_card_settings (jsonb) so it round-trips
// through the settings API without a bespoke shape on either side.
export interface QrCardSettings {
  partnerA: string;
  partnerB: string;
  dateLabel: string;
  tagline: string;
  instructions: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  font: CardFont;
  qrSizeMm: number;
  dotStyle: DotType;
  cornerStyleId: string;
  errorCorrection: ErrorCorrectionLevel;
  marginRatio: number;
  transparentBackground: boolean;
  centerImageMode: CenterImageMode;
  logoDataUrl: string | null;
}

export interface WeddingCardOptions {
  partnerA: string;
  partnerB: string;
  eventDateLabel: string;
  qrDataUrl: string;
  tagline: string;
  instructions: string;
  backgroundColor: string;
  textColor: string;
  font: CardFont;
  qrSizeMm: number; // 30-120
  logoDataUrl?: string | null;
  fileName: string;
}

export async function generateWeddingCardPdf(options: WeddingCardOptions) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const rgb = hexToRgbTuple(options.backgroundColor);
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(0, 0, pageW, pageH, "F");

  const textRgb = hexToRgbTuple(options.textColor);
  doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);

  let y = 22;

  if (options.logoDataUrl) {
    const logoSize = 16;
    doc.addImage(options.logoDataUrl, "PNG", (pageW - logoSize) / 2, y - 12, logoSize, logoSize);
    y += 10;
  }

  doc.setFont(options.font, "bold");
  doc.setFontSize(26);
  doc.text(`${options.partnerA} & ${options.partnerB}`, pageW / 2, y, { align: "center" });

  doc.setFont(options.font, "normal");
  doc.setFontSize(13);
  doc.text(options.eventDateLabel, pageW / 2, y + 9, { align: "center" });

  const qrSize = Math.min(options.qrSizeMm, pageW - 20, pageH - 70);
  doc.addImage(options.qrDataUrl, "PNG", (pageW - qrSize) / 2, y + 18, qrSize, qrSize);

  const afterQrY = y + 18 + qrSize + 12;

  doc.setFont(options.font, "bolditalic");
  doc.setFontSize(15);
  doc.text(options.tagline, pageW / 2, afterQrY, { align: "center" });

  doc.setFont(options.font, "normal");
  doc.setFontSize(11);
  doc.text(options.instructions, pageW / 2, afterQrY + 8, { align: "center" });

  doc.save(options.fileName);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
