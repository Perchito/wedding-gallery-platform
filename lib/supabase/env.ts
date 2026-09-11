// Central place to check whether real Supabase credentials are configured.
// Until they are, every page in this app runs on lib/mock-data.ts — see
// README "Wiring up a real backend" for how to flip this over.

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
