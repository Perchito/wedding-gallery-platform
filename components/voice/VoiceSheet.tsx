"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Pause, RotateCcw } from "lucide-react";
import { BottomSheet } from "@/components/sheets/BottomSheet";
import type { VoiceMessage } from "@/lib/types";

const MAX_SECONDS = 60;

interface VoiceSheetProps {
  open: boolean;
  onClose: () => void;
  galleryId: string;
  partnerNames: [string, string];
  guestSessionId: string;
  guestName: string | null;
  onGuestNameChange: (name: string) => void;
  onSend: (message: VoiceMessage) => void;
}

type RecordState = "idle" | "recording" | "recorded" | "unsupported" | "denied";

export function VoiceSheet({
  open,
  onClose,
  galleryId,
  partnerNames,
  guestSessionId,
  guestName,
  onGuestNameChange,
  onSend,
}: VoiceSheetProps) {
  const [state, setState] = useState<RecordState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [name, setName] = useState(guestName ?? "");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  // The browser decides the actual container/codec (e.g. iOS Safari records
  // audio/mp4, Chrome records audio/webm). The recorded blob MUST carry this
  // real type — labeling mp4 data as webm makes Safari refuse to play it
  // back and stores the upload under the wrong content type.
  const mimeTypeRef = useRef<string>("audio/webm");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mimeTypeRef.current = recorder.mimeType || "audio/webm";
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        recordedBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setSeconds(0);
      setState("recording");
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            stopRecording();
            return MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setState("denied");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setState("recorded");
  }

  function reRecord() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    recordedBlobRef.current = null;
    setAudioUrl(null);
    setSeconds(0);
    setState("idle");
  }

  function togglePlay() {
    const el = audioElRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      el.play().catch(() => setIsPlaying(false));
    }
    setIsPlaying(!isPlaying);
  }

  function fileExtFromMime(mime: string) {
    if (mime.includes("mp4")) return "m4a";
    if (mime.includes("ogg")) return "ogg";
    if (mime.includes("mpeg")) return "mp3";
    if (mime.includes("wav")) return "wav";
    return "webm";
  }

  async function handleSend() {
    if (!recordedBlobRef.current || sending) return;
    setSending(true);
    setError(null);
    onGuestNameChange(name.trim());
    try {
      const formData = new FormData();
      formData.append(
        "audio",
        recordedBlobRef.current,
        `voice-message.${fileExtFromMime(mimeTypeRef.current)}`
      );
      formData.append("guestSessionId", guestSessionId);
      formData.append("guestName", name.trim());
      formData.append("durationSeconds", String(seconds));

      const res = await fetch(`/api/galleries/${galleryId}/voice-messages`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to send");
      const saved: VoiceMessage = await res.json();
      onSend(saved);
      setSent(true);
      setTimeout(() => {
        setSent(false);
        reRecord();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send voice message");
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Leave a Voice Message"
      subtitle={`Leave a heartfelt message for ${partnerNames[0]} & ${partnerNames[1]}.`}
    >
      {sent ? (
        <p className="py-6 text-center text-sm text-blush-dark">
          Voice message sent — thank you!
        </p>
      ) : (
        <div className="flex flex-col items-center gap-5 py-4">
          {state === "unsupported" && (
            <p className="text-sm text-ink-muted">
              Voice recording isn&apos;t supported in this browser.
            </p>
          )}
          {state === "denied" && (
            <p className="text-sm text-ink-muted">
              Microphone access was denied. Please allow microphone permissions to record a message.
            </p>
          )}

          {(state === "idle" || state === "denied") && (
            <button
              onClick={startRecording}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-blush-dark text-white shadow-lg"
            >
              <Mic size={28} />
            </button>
          )}
          {state === "idle" && <p className="text-sm text-ink-muted">Start Recording</p>}

          {state === "recording" && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg animate-pulse">
                <span className="font-mono text-lg">{seconds}s</span>
              </div>
              <p className="text-sm text-ink-muted">Recording… {MAX_SECONDS - seconds}s left</p>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium"
              >
                <Square size={14} /> Stop
              </button>
            </>
          )}

          {state === "recorded" && audioUrl && (
            <div className="flex w-full flex-col items-center gap-4">
              <audio
                ref={audioElRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
              <button
                onClick={togglePlay}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-blush-dark text-white"
              >
                {isPlaying ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <p className="text-sm text-ink-muted">{seconds}s recorded</p>
              <div className="flex w-full gap-2">
                <button
                  onClick={reRecord}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-medium"
                >
                  <RotateCcw size={14} /> Re-record
                </button>
              </div>
              <label className="w-full text-sm font-medium">
                Your name <span className="font-normal text-ink-muted">(optional)</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Uncle Tom"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full rounded-lg bg-blush-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send Voice Message"}
              </button>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}