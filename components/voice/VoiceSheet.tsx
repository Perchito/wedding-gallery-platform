"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw } from "lucide-react";
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

interface WavRecorderState {
  ctx: AudioContext;
  stream: MediaStream;
  processor: ScriptProcessorNode;
  chunks: Float32Array[];
}

// iOS Safari's MediaRecorder emits fragmented MP4, which Safari itself
// cannot play back from a blob URL (the <audio> player errors). iPhone/iPad
// guests therefore record raw PCM through the Web Audio API and get a WAV
// file instead — universally playable, including back on the same device.
function needsWavFallback() {
  const ua = navigator.userAgent;
  const isIOS =
    /iP(hone|ad|od)/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIOS || typeof MediaRecorder === "undefined";
}

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const samples = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

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
  const [name, setName] = useState(guestName ?? "");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wavRef = useRef<WavRecorderState | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  // The browser decides the actual container/codec (e.g. Chrome records
  // audio/webm). The recorded blob MUST carry this real type — labeling it
  // wrongly makes playback fail and stores the upload under a wrong type.
  const mimeTypeRef = useRef<string>("audio/webm");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (needsWavFallback()) {
        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextCtor();
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        const chunks: Float32Array[] = [];
        processor.onaudioprocess = (e) => {
          chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        };
        // ScriptProcessorNode only fires while connected to a destination;
        // route through a zero-gain node so recording never plays out loud.
        const mute = ctx.createGain();
        mute.gain.value = 0;
        source.connect(processor);
        processor.connect(mute);
        mute.connect(ctx.destination);
        wavRef.current = { ctx, stream, processor, chunks };
        mediaRecorderRef.current = null;
      } else {
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
        wavRef.current = null;
      }

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

    const wav = wavRef.current;
    if (wav) {
      const blob = encodeWav(wav.chunks, wav.ctx.sampleRate);
      recordedBlobRef.current = blob;
      mimeTypeRef.current = "audio/wav";
      setAudioUrl(URL.createObjectURL(blob));
      wav.processor.disconnect();
      wav.stream.getTracks().forEach((t) => t.stop());
      void wav.ctx.close();
      wavRef.current = null;
      setState("recorded");
      return;
    }

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
              {/* Native player bar: play/pause, seekable timeline and time
                  display on every browser. */}
              <audio
                src={audioUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full"
              />
              <p className="text-sm text-ink-muted">
                {seconds}s recorded — use the player above to listen back
              </p>
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