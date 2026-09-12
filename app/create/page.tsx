"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Calendar, MapPin, Image as ImageIcon, ArrowRight, ArrowLeft } from "lucide-react";

type Step = 1 | 2 | 3;

export default function CreateGalleryPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [partnerA, setPartnerA] = useState("");
  const [partnerB, setPartnerB] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step1Valid = partnerA.trim() && partnerB.trim() && eventDate;

  function handleHeroFile(file: File | null) {
    if (!file) return;
    if (heroPreview) URL.revokeObjectURL(heroPreview);
    setHeroFile(file);
    setHeroPreview(URL.createObjectURL(file));
  }

  function clearHero() {
    if (heroPreview) URL.revokeObjectURL(heroPreview);
    setHeroFile(null);
    setHeroPreview(null);
  }

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      // Upload the hero photo first (if one was picked) so its public URL
      // can be stored on the gallery row in the next step.
      let heroImageUrl = "";
      if (heroFile) {
        const uploadData = new FormData();
        uploadData.append("file", heroFile);
        const uploadRes = await fetch("/api/hero-upload", {
          method: "POST",
          body: uploadData,
        });
        if (!uploadRes.ok) {
          throw new Error(
            (await uploadRes.json()).error || "Failed to upload hero photo"
          );
        }
        heroImageUrl = (await uploadRes.json()).url;
      }

      const res = await fetch("/api/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerA: partnerA.trim(),
          partnerB: partnerB.trim(),
          eventDate,
          venue: venue.trim(),
          heroImageUrl,
          description: description.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create gallery");
      const gallery = await res.json();
      router.push(`/g/${gallery.slug}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create gallery");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blush-dark">
          Create Your Gallery
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Let&apos;s set up your event
        </h1>
        <p className="mt-2 text-sm text-ink-muted">Step {step} of 3</p>
        <div className="mx-auto mt-3 flex w-40 gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                s <= step ? "bg-blush-dark" : "bg-surface-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Field label="Partner 1's name" icon={<Heart size={16} />}>
              <input
                value={partnerA}
                onChange={(e) => setPartnerA(e.target.value)}
                placeholder="e.g. Mateo"
                className="input-field"
              />
            </Field>
            <Field label="Partner 2's name" icon={<Heart size={16} />}>
              <input
                value={partnerB}
                onChange={(e) => setPartnerB(e.target.value)}
                placeholder="e.g. Genesis"
                className="input-field"
              />
            </Field>
            <Field label="Event date" icon={<Calendar size={16} />}>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="input-field"
              />
            </Field>
            <Field label="Venue" icon={<MapPin size={16} />} optional>
              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. The Old Vineyard, Marbella"
                className="input-field"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="text-sm font-medium">
              <span className="mb-1 flex items-center gap-1.5">
                <span className="text-blush-dark">
                  <ImageIcon size={16} />
                </span>
                Hero photo{" "}
                <span className="font-normal text-ink-muted">(optional)</span>
              </span>
              <input
                id="hero-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleHeroFile(e.target.files?.[0] ?? null)}
              />
              {heroPreview ? (
                <div className="mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroPreview}
                    alt="Hero photo preview"
                    className="h-32 w-full rounded-lg object-cover"
                  />
                  <div className="mt-2 flex gap-2">
                    <label
                      htmlFor="hero-file-input"
                      className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-blush-dark/40"
                    >
                      Replace photo
                    </label>
                    <button
                      type="button"
                      onClick={clearHero}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="hero-file-input"
                  className="mt-1 flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-6 text-sm font-normal text-ink-muted hover:border-blush-dark/40 hover:text-blush-dark"
                >
                  <ImageIcon size={20} />
                  Choose a photo of you both
                  <span className="text-xs">JPG, PNG or WebP — up to 10 MB</span>
                </label>
              )}
            </div>
            <p className="-mt-2 text-xs text-ink-muted">
              Shown at the top of your gallery. Leave it out and the gallery
              simply opens with your names and date.
            </p>
            <Field label="Welcome message" optional>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Thank you for celebrating with us!"
                className="input-field"
              />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-ink-muted">Review</p>
            <div className="rounded-xl bg-surface-muted p-4 text-sm">
              {heroPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroPreview}
                  alt="Hero photo preview"
                  className="mb-3 h-24 w-full rounded-lg object-cover"
                />
              )}
              <p className="font-display text-lg font-semibold">
                {partnerA || "Partner 1"} &amp; {partnerB || "Partner 2"}
              </p>
              <p className="mt-1 text-ink-muted">
                {eventDate || "No date set"}
                {venue ? ` · ${venue}` : ""}
              </p>
              {description && <p className="mt-2">{description}</p>}
            </div>
            <p className="text-xs text-ink-muted">
              You&apos;ll get a unique gallery link and QR code guests can scan to
              start sharing photos immediately — no account required for
              guests.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-between gap-3">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium"
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={step === 1 && !step1Valid}
              className="flex items-center gap-1.5 rounded-full bg-blush-dark px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-full bg-blush-dark px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create Gallery"}
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <p className="mt-6 text-center text-xs text-ink-muted">
        Guests never need an account — only you do, to manage this gallery.
      </p>
    </div>
  );
}

function Field({
  label,
  icon,
  optional,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-1 flex items-center gap-1.5">
        {icon && <span className="text-blush-dark">{icon}</span>}
        {label}
        {optional && (
          <span className="font-normal text-ink-muted">(optional)</span>
        )}
      </span>
      {children}
    </label>
  );
}