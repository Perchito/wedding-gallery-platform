import { getGalleryFromSupabase } from "@/lib/data/galleries";
import { QrCardCustomizer } from "./QrCardCustomizer";

export const metadata = { title: "Customize QR Card — Wedding Gallery Platform" };

export default async function QrCardPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug = "demo" } = await searchParams;
  const serverGallery = await getGalleryFromSupabase(slug);

  return <QrCardCustomizer slug={slug} serverGallery={serverGallery} />;
}
