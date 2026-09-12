# Going live checklist

These are the settings **outside the code** that make owner accounts and
email links work in production. Do them once, in order.

## 1. Supabase: fix confirmation email links (the `localhost` link bug)

Supabase builds email links from your project's **Site URL**, which
defaults to `http://localhost:3000` — that's why the confirmation email
contained a localhost link.

1. Supabase Dashboard → your project → **Authentication → URL Configuration**.
2. **Site URL**: set it to your live domain, e.g. `https://your-app.vercel.app`.
3. **Redirect URLs**: add **both** of these:
   - `https://your-app.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` *(keeps local development working)*
4. Save.

The app now also passes `emailRedirectTo` explicitly on signup/resend, but
Supabase silently rejects that value unless it (or the Site URL) appears in
the Redirect URLs list — so step 1–3 are still required.

## 2. Apply every database migration

The **"album not found"** error happens when a gallery gets created without
its default albums — usually because the RLS recursion fix in
`00009_fix_galleries_rls_recursion.sql` isn't applied to the live database,
so the `gallery_settings`/`albums` inserts fail.

1. Supabase Dashboard → **SQL Editor**.
2. Run every file in `supabase/migrations/` **in filename order**
   (00001 → 00011). New projects also need `db/schema.sql` before that.
3. Delete any galleries created before this fix (they have no albums) and
   recreate them via `/create` — creation now verifies the albums landed
   and shows you the real database error if they didn't.

## 3. Environment variables, everywhere the app runs

Vercel project → **Settings → Environment Variables** (and locally in
`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

All three from Supabase Dashboard → **Project Settings → API**. Redeploy
after changing them.

## 4. Email confirmation options

- **Keep it on** (recommended for production). Note that Supabase's default
  email sender only allows a handful of emails per hour — fine for you and
  a few testers. Before real customer signups, connect your own SMTP:
  **Project Settings → Authentication → SMTP Settings**.
- For quick private testing you can switch confirmation off:
  **Authentication → Sign In / Providers → Email → "Confirm email" off**.
  New signups then log straight in.

## 5. Remove the seeded demo data (optional)

Once you're happy the platform works for real accounts:

```bash
node scripts/remove-demo-gallery.mjs
```

This deletes the seeded `demo` gallery (the Mateo & Genesis rows and their
uploaded files). It needs `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. **Destructive** — only run it
when you're completely done with the demo.
