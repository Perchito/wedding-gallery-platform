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
