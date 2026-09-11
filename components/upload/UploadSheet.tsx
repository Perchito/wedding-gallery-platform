"use client";

import { useRef, useState } from "react";
import { Camera, Images, Video, RotateCcw, CheckCircle2 } from "lucide-react";
import { BottomSheet } from "@/components/sheets/BottomSheet";
import { cn } from "@/lib/utils";
import { enqueueOfflineUpload, isOnline } from "@/lib/offline-queue";
import { uploadMedia } from "@/lib/upload-media";
import type { Album, MediaItem, UploadState, UploadTask } from "@/lib/types";

interface UploadSheetProps {
  open: boolean;
  onClose: () => void;
  galleryId: string;
  gallerySlug: string;
  albums: Album[];
  guestSessionId: string;
  guestName: string | null;
  onGuestNameChange: (name: string) => void;
  onUploaded: (items: MediaItem[]) => void;
}

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function randomId() {
  return `up_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function UploadSheet({
  open,
  onClose,
  galleryId,
  gallerySlug,
  albums,
  guestSessionId,
  guestName,
  onGuestNameChange,
  onUploaded,
}: UploadSheetProps) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [albumId, setAlbumId] = useState(albums[0]?.id ?? "album_main");
  const [caption, setCaption] = useState("");
  const [nameInput, setNameInput] = useState(guestName ?? "");
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTasks([]);
    setCaption("");
    setDone(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function processFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    onGuestNameChange(nameInput.trim());

    const newTasks: UploadTask[] = Array.from(fileList).map((file) => {
      const isVideo = file.type.startsWith("video/");
      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        return {
          id: randomId(),
          file,
          previewUrl: "",
          type: "video",
          state: "failed" as UploadState,
          progress: 0,
          albumId,
          caption,
          error: "Video exceeds 500MB limit",
        };
      }
      return {
        id: randomId(),
        file,
        previewUrl: URL.createObjectURL(file),
        type: isVideo ? "video" : "photo",
        state: "waiting" as UploadState,
        progress: 0,
        albumId,
        caption,
      };
    });

    setTasks((prev) => [...prev, ...newTasks]);
    newTasks.forEach((t) => (t.state === "failed" ? null : startUpload(t)));
  }

  async function startUpload(task: UploadTask) {
    if (!isOnline()) {
      await enqueueOfflineUpload({
        id: task.id,
        galleryId,
        albumId: task.albumId,
        caption: task.caption,
        guestName: nameInput.trim() || null,
        file: task.file,
        fileName: task.file.name,
        fileType: task.file.type,
        createdAt: new Date().toISOString(),
      });
      updateTask(task.id, { state: "queued-offline", progress: 0 });
      return;
    }

    updateTask(task.id, { state: "uploading", progress: 0 });

    try {
      const mediaItem = await uploadMedia({
        gallerySlug,
        file: task.file,
        albumId: task.albumId,
        caption: task.caption,
        guestSessionId,
        guestName: nameInput.trim() || null,
        onProgress: (pct) => {
          if (pct >= 100) {
            updateTask(task.id, { state: "processing", progress: 100 });
          } else {
            updateTask(task.id, { state: "uploading", progress: pct });
          }
        },
      });
      updateTask(task.id, { state: "complete", progress: 100 });
      onUploaded([mediaItem]);
      setDone(true);
    } catch (err) {
      updateTask(task.id, {
        state: "failed",
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

  function retryTask(task: UploadTask) {
    updateTask(task.id, { state: "waiting", progress: 0, error: undefined });
    startUpload(task);
  }

  function updateTask(id: string, patch: Partial<UploadTask>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title="Share Your Memories"
      subtitle={done ? undefined : "Add photos or videos to the gallery"}
    >
      {done && tasks.every((t) => t.state === "complete" || t.state === "queued-offline") ? (
        <SuccessScreen onUploadMore={reset} onDone={handleClose} tasks={tasks} />
      ) : (
        <div className="flex flex-col gap-4">
          {tasks.length === 0 && (
            <div className="grid grid-cols-3 gap-3">
              <PickButton icon={<Camera size={22} />} label="Take Photo" onClick={() => cameraInputRef.current?.click()} />
              <PickButton icon={<Video size={22} />} label="Record Video" onClick={() => cameraInputRef.current?.click()} />
              <PickButton icon={<Images size={22} />} label="Camera Roll" onClick={() => fileInputRef.current?.click()} />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,video/mp4,video/quicktime"
            multiple
            className="hidden"
            onChange={(e) => processFiles(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => processFiles(e.target.files)}
          />

          {tasks.length === 0 && (
            <div className="grid gap-3">
              <label className="text-sm font-medium">
                Your name <span className="font-normal text-ink-muted">(optional)</span>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Sofia"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium">
                Caption / message <span className="font-normal text-ink-muted">(optional)</span>
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption…"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium">
                Album <span className="font-normal text-ink-muted">(optional)</span>
                <select
                  value={albumId}
                  onChange={(e) => setAlbumId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-dashed border-border py-3 text-center text-sm text-ink-muted"
              >
                Or choose multiple files from camera roll
              </button>
            </div>
          )}

          {tasks.length > 0 && (
            <UploadProgressList tasks={tasks} onRetry={retryTask} />
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function PickButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-border py-5 text-xs font-medium text-ink-muted hover:border-blush-dark/50 hover:text-blush-dark"
    >
      {icon}
      {label}
    </button>
  );
}

function UploadProgressList({
  tasks,
  onRetry,
}: {
  tasks: UploadTask[];
  onRetry: (t: UploadTask) => void;
}) {
  const completeCount = tasks.filter((t) => t.state === "complete" || t.state === "queued-offline").length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">
        Uploading… {completeCount} / {tasks.length}
      </p>
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
            {t.previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.previewUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-ink-muted">{t.file.name}</p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  t.state === "failed" ? "bg-red-400" : "bg-blush-dark"
                )}
                style={{ width: `${t.progress}%` }}
              />
            </div>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {stateLabel(t)}
            </p>
          </div>
          {t.state === "failed" && (
            <button
              onClick={() => onRetry(t)}
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium"
            >
              <RotateCcw size={12} /> Retry
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function stateLabel(t: UploadTask) {
  switch (t.state) {
    case "waiting":
      return "Waiting…";
    case "uploading":
      return `Uploading… ${Math.round(t.progress)}%`;
    case "processing":
      return "Processing…";
    case "complete":
      return "Complete";
    case "queued-offline":
      return "Offline — queued, will upload automatically";
    case "failed":
      return t.error ?? "Failed";
    default:
      return "";
  }
}

function SuccessScreen({
  tasks,
  onUploadMore,
  onDone,
}: {
  tasks: UploadTask[];
  onUploadMore: () => void;
  onDone: () => void;
}) {
  const offlineCount = tasks.filter((t) => t.state === "queued-offline").length;
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <CheckCircle2 size={44} className="text-blush-dark" />
      <h3 className="font-display text-xl font-semibold">Beautifully shared!</h3>
      <p className="text-sm text-ink-muted">
        {offlineCount > 0
          ? `${offlineCount} photo${offlineCount > 1 ? "s" : ""} queued — they'll upload automatically once you're back online.`
          : "Your photos have been added to the gallery."}
      </p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={onUploadMore}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
        >
          Upload more
        </button>
        <button
          onClick={onDone}
          className="rounded-lg bg-blush-dark px-4 py-2 text-sm font-medium text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}
