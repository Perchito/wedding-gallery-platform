import { notFound } from "next/navigation";
import { getOwnerGalleryWithStats } from "@/lib/data/dashboard";
import { DashboardApp } from "./DashboardApp";

export const metadata = { title: "Dashboard — Wedding Gallery Platform" };

export default async function GalleryDashboardPage({
  params,
}: {
  params: Promise<{ galleryId: string }>;
}) {
  const { galleryId } = await params;
  const result = await getOwnerGalleryWithStats(galleryId);
  if (!result) notFound();

  return <DashboardApp gallery={result.gallery} stats={result.stats} initialMedia={result.media} />;
}
