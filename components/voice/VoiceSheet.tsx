"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Pause, RotateCcw } from "lucide-react";
import { BottomSheet } from "@/components/sheets/BottomSheet";
import type { VoiceMessage } from "@/lib/types";

const MAX_SECONDS = 60;

interface VoiceSheetProps {
  open: boolean;
  onClose: () => void;
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
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
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
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
      el.play();
    }
    setIsPlaying(!isPlaying);
  }

  function handleSend() {
    onGuestNameChange(name.trim());
    onSend({
      id: `vm_${Date.now()}`,
      galleryId: "gallery_demo",
      guestSessionId,
      guestName: name.trim() || null,
      audioUrl: audioUrl ?? "",
      durationSeconds: seconds,
      createdAt: new Date().toISOString(),
    });
    setSent(true);
    setTimeout(() => {
      setSent(false);
      reRecord();
    }, 2000);
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
              <button
                onClick={handleSend}
                className="w-full rounded-lg bg-blush-dark px-4 py-2.5 text-sm font-semibold text-white"
              >
                Send Voice Message
              </button>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
