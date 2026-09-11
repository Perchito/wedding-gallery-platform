import QRCode from "qrcode";

export async function galleryQrPngDataUrl(url: string, size = 512) {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    color: { dark: "#241c19", light: "#ffffffff" },
  });
}

export async function galleryQrSvgString(url: string) {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: "#241c19", light: "#ffffff" },
  });
}

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, fileName);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Printable "QR Wedding Card" (spec section 25) — customizable signage with
// names, date, QR code, and instructions. jsPDF only ships a handful of
// built-in font families (no arbitrary Google Fonts without embedding TTFs),
// so "typography" is exposed as a choice between those built-ins rather than
// the webfonts used elsewhere in the app.
// ---------------------------------------------------------------------------

export type CardFont = "times" | "helvetica" | "courier";

export interface WeddingCardOptions {
  partnerA: string;
  partnerB: string;
  eventDateLabel: string;
  galleryUrl: string;
  tagline: string;
  instructions: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  font: CardFont;
  qrSizeMm: number; // 40-100
  logoDataUrl?: string | null;
  fileName: string;
}

export async function generateWeddingCardPdf(options: WeddingCardOptions) {
  const [{ jsPDF }, qrDataUrl] = await Promise.all([
    import("jspdf"),
    QRCode.toDataURL(options.galleryUrl, {
      width: 800,
      margin: 1,
      color: { dark: options.accentColor, light: "#ffffffff" },
    }),
  ]);

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

  const qrSize = Math.min(options.qrSizeMm, pageH - 70);
  doc.addImage(qrDataUrl, "PNG", (pageW - qrSize) / 2, y + 18, qrSize, qrSize);

  const afterQrY = y + 18 + qrSize + 12;

  doc.setFont(options.font, "bolditalic");
  doc.setFontSize(15);
  doc.text(options.tagline, pageW / 2, afterQrY, { align: "center" });

  doc.setFont(options.font, "normal");
  doc.setFontSize(11);
  doc.text(options.instructions, pageW / 2, afterQrY + 8, { align: "center" });

  doc.save(options.fileName);
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
