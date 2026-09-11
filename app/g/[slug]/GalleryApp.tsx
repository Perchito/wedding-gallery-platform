"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { GalleryHero } from "@/components/gallery/GalleryHero";
import { CategoryNav } from "@/components/gallery/CategoryNav";
import { MasonryGallery } from "@/components/gallery/MasonryGallery";
import { MediaViewer } from "@/components/gallery/MediaViewer";
import { BottomNav, type BottomNavAction } from "@/components/gallery/BottomNav";
import { MoreMenuSheet } from "@/components/gallery/MoreMenuSheet";
import { UploadSheet } from "@/components/upload/UploadSheet";
import { GuestbookSheet } from "@/components/guestbook/GuestbookSheet";
import { ScheduleSheet } from "@/components/schedule/ScheduleSheet";
import {
  getOrCreateGuestSession,
  updateGuestName,
  getHuntProgress,
  markHuntChallengeComplete,
} from "@/lib/guest-session";
import { useOfflineQueueDrain } from "@/lib/offline-upload-drain";
import { useGalleryRealtime } from "@/lib/realtime/useGalleryRealtime";
import type {
  Album,
  Category,
  CategoryId,
  Gallery,
  GuestbookMessage,
  HuntCategory,
  HuntChallenge,
  MediaItem,
  ScheduleEntry,
  VoiceMessage,
} from "@/lib/types";

// Code-split secondary features so their JS only loads once a guest opens
// them (spec section 37: "do not load AI functionality, Photo Hunt, voice
// recording ... until required").
const VoiceSheet = dynamic(() =>
  import("@/components/voice/VoiceSheet").then((m) => m.VoiceSheet)
);
const HuntSheet = dynamic(() =>
  import("@/components/hunt/HuntSheet").then((m) => m.HuntSheet)
);
const FindMeSheet = dynamic(() =>
  import("@/components/findme/FindMeSheet").then((m) => m.FindMeSheet)
);
const ShareSheet = dynamic(() =>
  import("@/components/share/ShareSheet").then((m) => m.ShareSheet)
);

type SheetId =
  | "upload"
  | "guestbook"
  | "voice"
  | "hunt"
  | "findme"
  | "schedule"
  | "share"
  | "more"
  | null;

interface GalleryAppProps {
  gallery: Gallery;
  albums: Album[];
  categories: Category[];
  initialMedia: MediaItem[];
  initialMessages: GuestbookMessage[];
  initialVoiceMessages: VoiceMessage[];
  huntCategories: HuntCategory[];
  huntChallenges: HuntChallenge[];
  schedule: ScheduleEntry[];
}

export function GalleryApp({
  gallery,
  albums,
  categories,
  initialMedia,
  initialMessages,
  initialVoiceMessages,
  huntCategories,
  huntChallenges,
  schedule,
}: GalleryAppProps) {
  const [media, setMedia] = useState(initialMedia);
  const [messages, setMessages] = useState(initialMessages);
  const [, setVoiceMessages] = useState(initialVoiceMessages);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [guestSessionId, setGuestSessionId] = useState<string>("");
  const [guestName, setGuestName] = useState<string | null>(null);
  const [huntCompleted, setHuntCompleted] = useState<Set<string>>(new Set());
  const [galleryUrl, setGalleryUrl] = useState(`https://my-wedding.co.uk/g/${gallery.slug}`);
  const galleryGridRef = useRef<HTMLDivElement>(null);

  // Reads browser-only state (localStorage, window.location) that isn't
  // available during server render, so this must run as a mount effect
  // rather than during render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const session = getOrCreateGuestSession(gallery.id);
    setGuestSessionId(session.guestSessionId);
    setGuestName(session.guestName);
    setHuntCompleted(getHuntProgress(gallery.id, session.guestSessionId));
    setGalleryUrl(`${window.location.origin}/g/${gallery.slug}`);

    // Best-effort — mints a real guest_sessions row server-side so this
    // client-generated id can be referenced by media/guestbook/hunt FKs.
    fetch("/api/guest-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        galleryId: gallery.id,
        guestSessionId: session.guestSessionId,
        guestName: session.guestName,
      }),
    }).catch(() => {});
  }, [gallery.id, gallery.slug]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const counts = useMemo(() => {
    const c: Record<CategoryId, number> = {
      all: media.length,
      photos: 0,
      videos: 0,
      speeches: 0,
      ceremony: 0,
      couple: 0,
    };
    for (const item of media) {
      for (const cat of item.categories) {
        if (cat in c) c[cat] += 1;
      }
    }
    return c;
  }, [media]);

  const filteredMedia = useMemo(() => {
    if (activeCategory === "all") return media;
    return media.filter((m) => m.categories.includes(activeCategory));
  }, [media, activeCategory]);

  function handleGuestNameChange(name: string) {
    if (!name) return;
    const updated = updateGuestName(gallery.id, name);
    setGuestName(updated.guestName);
    fetch("/api/guest-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        galleryId: gallery.id,
        guestSessionId: updated.guestSessionId,
        guestName: updated.guestName,
      }),
    }).catch(() => {});
  }

  function handleToggleLike(id: string) {
    const item = media.find((m) => m.id === id);
    if (!item || !guestSessionId) return;
    const nextLiked = !item.liked;
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, liked: nextLiked } : m)));
    fetch(`/api/media/${id}/like`, {
      method: nextLiked ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestSessionId }),
    }).catch(() => {});
  }

  function handleUploaded(items: MediaItem[]) {
    setMedia((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const fresh = items.filter((m) => !existingIds.has(m.id));
      return [...fresh, ...prev];
    });
  }

  useGalleryRealtime(gallery.id, (item) => handleUploaded([item]));
  useOfflineQueueDrain(gallery.id, gallery.slug, guestSessionId, guestName, handleUploaded);

  function handleHuntComplete(challengeId: string, item: MediaItem) {
    handleUploaded([item]);
    const updated = markHuntChallengeComplete(gallery.id, guestSessionId, challengeId);
    setHuntCompleted(new Set(updated));
  }

  function openViewerFor(item: MediaItem) {
    const idx = filteredMedia.findIndex((m) => m.id === item.id);
    setViewerIndex(idx === -1 ? 0 : idx);
  }

  function handleBottomNav(action: BottomNavAction) {
    if (action === "more") setSheet("more");
    else setSheet(action);
  }

  return (
    <div className="pb-20 sm:pb-0">
      <GalleryHero
        gallery={gallery}
        photoCount={counts.photos}
        videoCount={counts.videos}
        onShare={() => setSheet("upload")}
        onFindMe={() => setSheet("findme")}
        onGuestbook={() => setSheet("guestbook")}
        onVoice={() => setSheet("voice")}
      />

      <div ref={galleryGridRef} id="gallery-grid" className="mt-4">
        <CategoryNav
          categories={categories}
          counts={counts}
          active={activeCategory}
          onChange={setActiveCategory}
        />
        <MasonryGallery items={filteredMedia} onOpen={openViewerFor} />
      </div>

      <div className="hidden justify-center gap-3 pb-10 sm:flex">
        <DesktopAction label="Guestbook" onClick={() => setSheet("guestbook")} />
        <DesktopAction label="Voice Message" onClick={() => setSheet("voice")} />
        <DesktopAction label="Photo Hunt" onClick={() => setSheet("hunt")} />
        <DesktopAction label="Order of the Day" onClick={() => setSheet("schedule")} />
        <DesktopAction label="Share Gallery" onClick={() => setSheet("share")} />
      </div>

      <BottomNav onAction={handleBottomNav} active={sheet as BottomNavAction | null} />

      {viewerIndex !== null && (
        <MediaViewer
          items={filteredMedia}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
          onToggleLike={handleToggleLike}
          canDownload={gallery.settings.allowDownloads}
        />
      )}

      <UploadSheet
        open={sheet === "upload"}
        onClose={() => setSheet(null)}
        galleryId={gallery.id}
        gallerySlug={gallery.slug}
        albums={albums}
        guestSessionId={guestSessionId}
        guestName={guestName}
        onGuestNameChange={handleGuestNameChange}
        onUploaded={handleUploaded}
      />

      <GuestbookSheet
        open={sheet === "guestbook"}
        onClose={() => setSheet(null)}
        galleryId={gallery.id}
        messages={messages}
        guestSessionId={guestSessionId}
        guestName={guestName}
        onGuestNameChange={handleGuestNameChange}
        onSend={(m) => setMessages((prev) => [...prev, m])}
      />

      <VoiceSheet
        open={sheet === "voice"}
        onClose={() => setSheet(null)}
        galleryId={gallery.id}
        partnerNames={gallery.partnerNames}
        guestSessionId={guestSessionId}
        guestName={guestName}
        onGuestNameChange={handleGuestNameChange}
        onSend={(m) => setVoiceMessages((prev) => [...prev, m])}
      />

      <HuntSheet
        open={sheet === "hunt"}
        onClose={() => setSheet(null)}
        categories={huntCategories}
        challenges={huntChallenges}
        completed={huntCompleted}
        onComplete={handleHuntComplete}
        gallerySlug={gallery.slug}
        defaultAlbumId={albums[0]?.id ?? ""}
        guestSessionId={guestSessionId}
        guestName={guestName}
      />

      <FindMeSheet
        open={sheet === "findme"}
        onClose={() => setSheet(null)}
        allMedia={media}
        onOpenResult={openViewerFor}
      />

      <ScheduleSheet
        open={sheet === "schedule"}
        onClose={() => setSheet(null)}
        eventDate={gallery.eventDate}
        entries={schedule}
      />

      <ShareSheet
        open={sheet === "share"}
        onClose={() => setSheet(null)}
        gallery={gallery}
        galleryUrl={galleryUrl}
      />

      <MoreMenuSheet
        open={sheet === "more"}
        onClose={() => setSheet(null)}
        onSchedule={() => setSheet("schedule")}
        onFindMe={() => setSheet("findme")}
        onViewAll={() => setActiveCategory("all")}
        onJumpToGallery={() =>
          galleryGridRef.current?.scrollIntoView({ behavior: "smooth" })
        }
        onShare={() => setSheet("share")}
      />
    </div>
  );
}

function DesktopAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:border-blush-dark/40 hover:text-blush-dark"
    >
      {label}
    </button>
  );
}
