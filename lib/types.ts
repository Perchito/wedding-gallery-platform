// Domain types mirroring the future Supabase/Postgres schema (see db/schema.sql).
// The Phase 1 MVP uses these as in-memory / mock-data shapes so the UI layer
// does not need to change when a real backend is wired in.

export type MediaType = "photo" | "video";

export type ProcessingStatus = "pending" | "processing" | "ready" | "failed";

export type ModerationStatus = "pending" | "approved" | "flagged" | "removed";

export interface GalleryOwner {
  id: string;
  name: string;
  email: string;
}

export interface GallerySettings {
  allowUploads: boolean;
  allowBrowsing: boolean;
  allowDownloads: boolean;
  allowGuestbook: boolean;
  allowVoiceMessages: boolean;
  allowPhotoHunt: boolean;
  allowFaceSearch: boolean;
  privacy: "public" | "private" | "password";
}

export interface Gallery {
  id: string;
  slug: string;
  eventName: string;
  partnerNames: [string, string];
  eventDate: string; // ISO date
  venue?: string;
  heroImageUrl: string;
  description?: string;
  owner: GalleryOwner;
  settings: GallerySettings;
  createdAt: string;
}

export interface Album {
  id: string;
  galleryId: string;
  name: string;
  icon: string;
  sortOrder: number;
  visibility: "public" | "hidden";
}

export type CategoryId =
  | "all"
  | "photos"
  | "videos"
  | "speeches"
  | "ceremony"
  | "couple";

export interface Category {
  id: CategoryId;
  label: string;
}

export interface MediaItem {
  id: string;
  galleryId: string;
  albumId: string;
  guestSessionId: string;
  uploaderName: string;
  type: MediaType;
  originalUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  durationSeconds?: number;
  caption?: string;
  categories: CategoryId[];
  liked: boolean;
  processingStatus: ProcessingStatus;
  moderationStatus: ModerationStatus;
  createdAt: string;
}

export interface GuestSession {
  galleryId: string;
  guestSessionId: string;
  guestName: string | null;
  createdAt: string;
}

export interface GuestbookMessage {
  id: string;
  galleryId: string;
  guestSessionId: string;
  guestName: string | null;
  message: string;
  createdAt: string;
  approvalStatus: "pending" | "approved" | "removed";
}

export interface VoiceMessage {
  id: string;
  galleryId: string;
  guestSessionId: string;
  guestName: string | null;
  audioUrl: string;
  durationSeconds: number;
  createdAt: string;
}

export interface HuntCategory {
  id: string;
  label: string;
}

export interface HuntChallenge {
  id: string;
  categoryId: string;
  title: string;
  prompt: string;
}

export interface HuntSubmission {
  challengeId: string;
  guestSessionId: string;
  mediaId: string;
  completedAt: string;
}

export interface ScheduleEntry {
  id: string;
  galleryId: string;
  time: string; // "13:00"
  title: string;
  description?: string;
  sortOrder: number;
}

export type UploadState =
  | "waiting"
  | "uploading"
  | "processing"
  | "complete"
  | "failed"
  | "queued-offline";

export interface UploadTask {
  id: string;
  file: File;
  previewUrl: string;
  type: MediaType;
  state: UploadState;
  progress: number;
  caption?: string;
  albumId: string;
  error?: string;
}

export interface GalleryStats {
  photos: number;
  videos: number;
  totalMedia: number;
  guests: number;
  messages: number;
  voiceMessages: number;
  storageUsedGb: number;
  huntAvgCompletionPct: number;
}
