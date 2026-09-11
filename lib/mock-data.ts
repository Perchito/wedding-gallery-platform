import type {
  Album,
  Category,
  Gallery,
  GalleryStats,
  GuestbookMessage,
  HuntCategory,
  HuntChallenge,
  MediaItem,
  ScheduleEntry,
  VoiceMessage,
} from "./types";

// ---------------------------------------------------------------------------
// Demo event: Mateo & Genesis, 20 March 2026
// All media below is placeholder imagery (picsum.photos, seeded for stable
// dimensions/aspect ratios) standing in for real uploaded photos/videos.
// Swap `originalUrl`/`thumbnailUrl`/`previewUrl` for real storage URLs once
// the upload pipeline (see db/schema.sql + README) is wired to Supabase/R2.
// ---------------------------------------------------------------------------

export const DEMO_GALLERY: Gallery = {
  id: "gallery_demo",
  slug: "demo",
  eventName: "Mateo & Genesis",
  partnerNames: ["Mateo", "Genesis"],
  eventDate: "2026-03-20",
  venue: "The Old Vineyard, Marbella",
  heroImageUrl: "https://picsum.photos/seed/mateo-genesis-hero/1600/1000",
  description:
    "Thank you for celebrating with us! Scan, snap and share your favourite moments from our day.",
  owner: {
    id: "user_owner_1",
    name: "Mateo",
    email: "lmateocc99@gmail.com",
  },
  settings: {
    allowUploads: true,
    allowBrowsing: true,
    allowDownloads: true,
    allowGuestbook: true,
    allowVoiceMessages: true,
    allowPhotoHunt: true,
    privacy: "public",
  },
  createdAt: "2026-01-05T10:00:00.000Z",
};

export const ALBUMS: Album[] = [
  { id: "album_main", galleryId: "gallery_demo", name: "Main Gallery", icon: "images", sortOrder: 0, visibility: "public" },
  { id: "album_ceremony", galleryId: "gallery_demo", name: "Ceremony", icon: "church", sortOrder: 1, visibility: "public" },
  { id: "album_speeches", galleryId: "gallery_demo", name: "Speeches", icon: "mic", sortOrder: 2, visibility: "public" },
  { id: "album_couple", galleryId: "gallery_demo", name: "Couple", icon: "heart", sortOrder: 3, visibility: "public" },
];

export const CATEGORIES: Category[] = [
  { id: "all", label: "All" },
  { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" },
  { id: "speeches", label: "Speeches" },
  { id: "ceremony", label: "Ceremony" },
  { id: "couple", label: "Couple" },
];

const GUEST_NAMES = [
  "Sofia R.", "James P.", "Aunt Carol", "Diego M.", "Lucia F.",
  "Uncle Tom", "Isabella G.", "Marco V.", "Emma W.", "Noah B.",
  "Camila S.", "Liam H.", null,
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

// A range of aspect ratios so the masonry layout has natural height variance.
const ASPECTS: [number, number][] = [
  [4, 5], [3, 4], [1, 1], [4, 3], [3, 2], [5, 4], [2, 3], [16, 9],
];

function buildMedia(): MediaItem[] {
  const items: MediaItem[] = [];
  const specs: { category: MediaItem["categories"]; album: string; count: number; type: "photo" | "video" }[] = [
    { category: ["ceremony"], album: "album_ceremony", count: 10, type: "photo" },
    { category: ["ceremony", "videos"], album: "album_ceremony", count: 2, type: "video" },
    { category: ["couple"], album: "album_couple", count: 12, type: "photo" },
    { category: ["couple", "videos"], album: "album_couple", count: 2, type: "video" },
    { category: ["speeches"], album: "album_speeches", count: 6, type: "photo" },
    { category: ["speeches", "videos"], album: "album_speeches", count: 3, type: "video" },
    { category: [], album: "album_main", count: 20, type: "photo" },
  ];

  let counter = 0;
  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      counter++;
      const [aw, ah] = pick(ASPECTS, counter);
      const width = 900;
      const height = Math.round((width * ah) / aw);
      const seed = `mg-${spec.type}-${counter}`;
      const isVideo = spec.type === "video";
      items.push({
        id: `media_${counter}`,
        galleryId: "gallery_demo",
        albumId: spec.album,
        guestSessionId: `guest_${counter % 9}`,
        uploaderName: pick(GUEST_NAMES, counter) ?? "Guest",
        type: spec.type,
        originalUrl: `https://picsum.photos/seed/${seed}/${width * 2}/${height * 2}`,
        thumbnailUrl: `https://picsum.photos/seed/${seed}/480/${Math.round((480 * ah) / aw)}`,
        previewUrl: `https://picsum.photos/seed/${seed}/${width}/${height}`,
        width,
        height,
        durationSeconds: isVideo ? 12 + (counter % 40) : undefined,
        caption: counter % 5 === 0 ? "What a magical moment ❤️" : undefined,
        categories: ["photos", ...spec.category].filter(
          (c, idx, self) => self.indexOf(c) === idx
        ) as MediaItem["categories"],
        liked: counter % 7 === 0,
        processingStatus: "ready",
        moderationStatus: "approved",
        createdAt: new Date(Date.now() - counter * 1000 * 60 * 7).toISOString(),
      });
    }
  }

  // Videos shouldn't carry the "photos" category.
  return items.map((m) =>
    m.type === "video"
      ? { ...m, categories: m.categories.filter((c) => c !== "photos") }
      : m
  );
}

export const MEDIA_ITEMS: MediaItem[] = buildMedia();

export const GUESTBOOK_MESSAGES: GuestbookMessage[] = [
  {
    id: "msg_1",
    galleryId: "gallery_demo",
    guestSessionId: "guest_2",
    guestName: "Aunt Carol",
    message: "Wishing you both a lifetime of love and laughter. Beautiful day!",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    approvalStatus: "approved",
  },
  {
    id: "msg_2",
    galleryId: "gallery_demo",
    guestSessionId: "guest_5",
    guestName: "Lucia F.",
    message: "Cried happy tears during the vows. So happy for you two!",
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    approvalStatus: "approved",
  },
  {
    id: "msg_3",
    galleryId: "gallery_demo",
    guestSessionId: "guest_7",
    guestName: null,
    message: "Congratulations Mateo & Genesis! What a party.",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    approvalStatus: "approved",
  },
];

export const VOICE_MESSAGES: VoiceMessage[] = [
  {
    id: "vm_1",
    galleryId: "gallery_demo",
    guestSessionId: "guest_3",
    guestName: "Uncle Tom",
    audioUrl: "",
    durationSeconds: 34,
    createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
];

export const HUNT_CATEGORIES: HuntCategory[] = [
  { id: "couple", label: "The Couple" },
  { id: "ceremony", label: "Ceremony" },
  { id: "food", label: "Food & Drink" },
  { id: "guests", label: "Guests & Fun" },
  { id: "details", label: "Details" },
  { id: "ideas", label: "My Ideas" },
];

export const HUNT_CHALLENGES: HuntChallenge[] = [
  { id: "hunt_first_kiss", categoryId: "couple", title: "First Kiss", prompt: "Capture the first kiss!" },
  { id: "hunt_first_dance", categoryId: "couple", title: "First Dance", prompt: "Capture this moment!" },
  { id: "hunt_cake", categoryId: "couple", title: "Cutting the Cake", prompt: "Get the cake-cutting shot!" },
  { id: "hunt_tears", categoryId: "couple", title: "Happy Tears", prompt: "Find someone shedding a happy tear." },
  { id: "hunt_cheer", categoryId: "ceremony", title: "Big Cheer", prompt: "Capture the crowd cheering!" },
  { id: "hunt_toast", categoryId: "food", title: "Glasses Raised", prompt: "Snap a toast in full swing." },
  { id: "hunt_dancer", categoryId: "guests", title: "Best Dancer", prompt: "Who owns the dance floor?" },
  { id: "hunt_speech", categoryId: "guests", title: "The Speech", prompt: "Catch a speech mid-flow." },
  { id: "hunt_golden_hour", categoryId: "details", title: "Golden Hour Shot", prompt: "Find that perfect golden-hour light." },
  { id: "hunt_group", categoryId: "ideas", title: "Group Shot", prompt: "Rally a group photo!" },
];

export const SCHEDULE: ScheduleEntry[] = [
  { id: "sch_1", galleryId: "gallery_demo", time: "13:00", title: "Ceremony", sortOrder: 0 },
  { id: "sch_2", galleryId: "gallery_demo", time: "14:00", title: "Drinks Reception", sortOrder: 1 },
  { id: "sch_3", galleryId: "gallery_demo", time: "15:30", title: "Photography", sortOrder: 2 },
  { id: "sch_4", galleryId: "gallery_demo", time: "17:00", title: "Dinner", sortOrder: 3 },
  { id: "sch_5", galleryId: "gallery_demo", time: "19:00", title: "Speeches", sortOrder: 4 },
  { id: "sch_6", galleryId: "gallery_demo", time: "20:00", title: "First Dance", sortOrder: 5 },
  { id: "sch_7", galleryId: "gallery_demo", time: "20:30", title: "Party", sortOrder: 6 },
];

export function getGalleryStats(media: MediaItem[]): GalleryStats {
  const photos = media.filter((m) => m.type === "photo").length;
  const videos = media.filter((m) => m.type === "video").length;
  return {
    photos,
    videos,
    totalMedia: photos + videos,
    guests: new Set(media.map((m) => m.guestSessionId)).size + 60,
    messages: GUESTBOOK_MESSAGES.length + 29,
    voiceMessages: VOICE_MESSAGES.length + 17,
    storageUsedGb: 4.7,
    huntAvgCompletionPct: 64,
  };
}

export function getGalleryBySlug(slug: string): Gallery | null {
  if (slug === "demo") return DEMO_GALLERY;
  return null;
}
