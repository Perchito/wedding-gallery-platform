import Link from "next/link";
import { HeartCrack } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <HeartCrack size={40} className="text-blush-dark" />
      <h1 className="font-display text-3xl font-semibold">Gallery not found</h1>
      <p className="max-w-sm text-sm text-ink-muted">
        This link may have been mistyped, or the gallery it points to isn&apos;t
        public. Double-check the link, or try the demo gallery below.
      </p>
      <Link
        href="/g/demo"
        className="mt-2 rounded-full bg-blush-dark px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        View Demo Gallery
      </Link>
    </div>
  );
}
