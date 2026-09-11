import { notFound } from "next/navigation";
import { getOwnerSchedule } from "@/lib/data/schedule";
import { ScheduleManager } from "./ScheduleManager";

export const metadata = { title: "Order of the Day — Wedding Gallery Platform" };

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ galleryId: string }>;
}) {
  const { galleryId } = await params;
  const data = await getOwnerSchedule(galleryId);
  if (!data) notFound();

  return <ScheduleManager {...data} />;
}
