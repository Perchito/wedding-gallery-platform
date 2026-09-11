import Link from "next/link";
import { QrCode, Camera, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blush-dark">
        Wedding Gallery Platform
      </p>
      <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
        Scan. Snap. Share. <br className="hidden sm:block" />
        Every guest photo, in one gallery.
      </h1>
      <p className="mt-4 max-w-xl text-ink-muted">
        Guests scan a QR code and land straight in your private event gallery —
        no app to download, no account to create. Try the live demo below.
      </p>

      <Link
        href="/g/demo"
        className="mt-8 rounded-full bg-blush-dark px-6 py-3 font-semibold text-white shadow-lg shadow-blush-dark/20 transition hover:opacity-90"
      >
        View Demo Gallery — Mateo &amp; Genesis
      </Link>

      <div className="mt-14 grid max-w-3xl grid-cols-1 gap-6 text-left sm:grid-cols-3">
        <Feature
          icon={<QrCode size={20} />}
          title="Scan a QR code"
          body="Every gallery gets its own QR code guests can scan from signage or a table card."
        />
        <Feature
          icon={<Camera size={20} />}
          title="Upload in seconds"
          body="No signup. Guests take or pick photos and videos and share instantly, even offline."
        />
        <Feature
          icon={<Sparkles size={20} />}
          title="One shared gallery"
          body="Guestbook messages, voice notes, a photo hunt and the full-res gallery, all in one place."
        />
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-blush-dark">
        {icon}
      </span>
      <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>
    </div>
  );
}
