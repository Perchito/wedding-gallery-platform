"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client (anon key — respects Row Level Security).
// Safe to call from client components; throws early if env vars are
// missing so a misconfigured deploy fails loudly instead of silently
// falling back to nothing.
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase env vars are not set (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). " +
        "Check isSupabaseConfigured() before calling this."
    );
  }

  return createBrowserClient(url, anonKey);
}
