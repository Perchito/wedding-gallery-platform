"use client";

import { useRef, useState } from "react";
import { ScanFace, ChevronLeft, ShieldCheck } from "lucide-react";
import { BottomSheet } from "@/components/sheets/BottomSheet";
import type { MediaItem } from "@/lib/types";

interface FindMeSheetProps {
  open: boolean;
  onClose: () => void;
  allMedia: MediaItem[];
  onOpenResult: (item: MediaItem) => void;
}

type Step = "intro" | "capture" | "searching" | "results" | "none";

export function FindMeSheet({ open, onClose, allMedia, onOpenResult }: FindMeSheetProps) {
  const [step, setStep] = useState<Step>("intro");
  const [results, setResults] = useState<MediaItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    setStep("intro");
    onClose();
  }

  function handleSelfie(file: File | null) {
    if (!file) return;
    setStep("searching");
    // Mock face-matching pipeline (see db/schema.sql `face_embeddings`):
    // real implementation runs detection + embedding + a vector similarity
    // search against stored embeddings for this gallery.
    setTimeout(() => {
      const photosOnly = allMedia.filter((m) => m.type === "photo");
      const sample = photosOnly
        .slice()
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(photosOnly.length * 0.35));
      if (sample.length === 0) {
        setStep("none");
      } else {
        setResults(sample);
        setStep("results");
      }
    }, 1800);
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Find My Photos" widthClass="sm:max-w-lg">
      {step === "intro" && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <ScanFace size={44} className="text-blush-dark" />
          <p className="text-sm text-ink-muted">
            Take a selfie to find photos of yourself in the gallery.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-blush-dark px-5 py-2.5 text-sm font-semibold text-white"
          >
            Take Selfie
          </button>
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-surface-muted p-3 text-left text-xs text-ink-muted">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-blush-dark" />
            <p>
              Your selfie is used only to match your face against gallery photos. The
              original selfie is deleted after processing — only a numeric face
              signature is kept, and only for as long as needed. You can ask the
              couple to delete your search data at any time. The event owner can
              disable face search entirely.
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => handleSelfie(e.target.files?.[0] ?? null)}
      />

      {step === "searching" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blush-dark border-t-transparent" />
          <p className="font-medium">Finding your photos…</p>
          <p className="text-sm text-ink-muted">Matching your face against the gallery.</p>
        </div>
      )}

      {step === "none" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-medium">No matches yet.</p>
          <p className="text-sm text-ink-muted">Some photos may still be processing.</p>
          <button
            onClick={() => setStep("intro")}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {step === "results" && (
        <div>
          <button
            onClick={() => setStep("intro")}
            className="mb-3 flex items-center gap-1 text-sm text-ink-muted"
          >
            <ChevronLeft size={16} /> Back
          </button>
          <p className="mb-3 font-display text-lg font-semibold">
            Photos With You — {results.length} found
          </p>
          <div className="grid grid-cols-3 gap-2">
            {results.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenResult(item)}
                className="aspect-square overflow-hidden rounded-lg bg-surface-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-4 w-full rounded-lg border border-border py-2.5 text-sm font-medium"
          >
            Upload More
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
