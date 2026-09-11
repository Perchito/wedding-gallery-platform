import { notFound } from "next/navigation";
import { getGalleryAnalytics } from "@/lib/data/analytics";
import { AnalyticsView } from "./AnalyticsView";

export const metadata = { title: "Analytics — Wedding Gallery Platform" };

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ galleryId: string }>;
}) {
  const { galleryId } = await params;
  const data = await getGalleryAnalytics(galleryId);
  if (!data) notFound();

  return <AnalyticsView galleryId={galleryId} data={data} />;
}
