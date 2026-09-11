import { getOwnerGalleryBasic } from "@/lib/data/dashboard";
import { QrCardCustomizer } from "./QrCardCustomizer";

export const metadata = { title: "Customize QR Card — Wedding Gallery Platform" };

export default async function QrCardPage({
  params,
}: {
  params: Promise<{ galleryId: string }>;
}) {
  const { galleryId } = await params;
  const gallery = await getOwnerGalleryBasic(galleryId);

  return <QrCardCustomizer galleryId={galleryId} serverGallery={gallery} />;
}
