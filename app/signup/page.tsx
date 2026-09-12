"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent" | "failed"
  >("idle");

  function callbackUrl() {
    // Point email-confirmation links at the origin the owner actually
    // signed up on. Without this, Supabase falls back to the project Site
    // URL — typically http://localhost:3000 — producing confirmation links
    // that don't work on the live site. The value used must also be added
    // to Supabase Dashboard → Authentication → URL Configuration →
    // Redirect URLs (see GOING-LIVE.md).
    return `${window.location.origin}/auth/callback`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: callbackUrl() },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        setError(
          "An account already exists for this email — sign in instead, or use a different email."
        );
      } else {
        setError(error.message);
      }
      return;
    }
    if (!data.session) {
      // Email confirmation is enabled on this Supabase project — this is a
      // success state, not an error: the owner confirms, then signs in.
      setAwaitingConfirmation(true);
      return;
    }
    router.push("/create");
    router.refresh();
  }

  async function handleResend() {
    setResendStatus("sending");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setResendStatus(error ? "failed" : "sent");
  }

  if (awaitingConfirmation) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
        <div className="flex flex-col items-center rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <MailCheck size={32} className="text-green-700" />
          <h1 className="mt-3 font-display text-xl font-semibold text-green-900">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-green-800">
            We&apos;ve sent a confirmation link to{" "}
            <span className="font-semibold">{email}</span>. Open it to activate
            your account, then sign in.
          </p>
          <button
            onClick={handleResend}
            disabled={resendStatus === "sending" || resendStatus === "sent"}
            className="mt-4 rounded-full border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-800 disabled:opacity-60"
          >
            {resendStatus === "sending"
              ? "Resending…"
              : resendStatus === "sent"
                ? "Sent again ✓"
                : "Resend email"}
          </button>
          {resendStatus === "failed" && (
            <p className="mt-2 text-xs text-red-600">
              Couldn&apos;t resend — wait a minute and try again.
            </p>
          )}
          <p className="mt-3 text-xs text-green-800/70">
            Check your spam/junk folder if nothing arrives within a few
            minutes.
          </p>
        </div>
        <p className="mt-4 text-center text-sm text-ink-muted">
          Already confirmed?{" "}
          <Link href="/login" className="font-medium text-blush-dark">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">Create an owner account</h1>
      <p className="mt-1 text-sm text-ink-muted">
        You&apos;ll use this to create and manage your event gallery.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="text-sm font-medium">
          Your name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blush-dark px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blush-dark">
          Sign in
        </Link>
      </p>
    </div>
  );
}