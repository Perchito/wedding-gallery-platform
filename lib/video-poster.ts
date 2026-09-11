"use client";

// Client-side video "processing": grab a poster frame and read duration
// without any server-side ffmpeg/transcoding step. Uploaded alongside the
// original video file.
export function captureVideoPoster(
  file: File
): Promise<{ posterBlob: Blob; durationSeconds: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    function cleanup() {
      URL.revokeObjectURL(url);
      video.remove();
    }

    video.addEventListener("loadedmetadata", () => {
      // Seek slightly in so we don't grab a black first frame.
      video.currentTime = Math.min(0.5, video.duration / 2 || 0);
    });

    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const durationSeconds = video.duration;
      const width = video.videoWidth || canvas.width;
      const height = video.videoHeight || canvas.height;
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (!blob) {
            reject(new Error("Failed to capture poster frame"));
            return;
          }
          resolve({ posterBlob: blob, durationSeconds, width, height });
        },
        "image/jpeg",
        0.8
      );
    });

    video.addEventListener("error", () => {
      cleanup();
      reject(new Error("Failed to load video for poster capture"));
    });
  });
}
