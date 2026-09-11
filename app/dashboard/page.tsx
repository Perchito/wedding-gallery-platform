import { DEMO_GALLERY, MEDIA_ITEMS, getGalleryStats } from "@/lib/mock-data";
import { DashboardApp } from "./DashboardApp";

export const metadata = { title: "Dashboard — Wedding Gallery Platform" };

export default function DashboardPage() {
  const stats = getGalleryStats(MEDIA_ITEMS);
  return (
    <DashboardApp gallery={DEMO_GALLERY} stats={stats} initialMedia={MEDIA_ITEMS} />
  );
}
