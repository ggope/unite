# UNIER

See what is happening. Sign what matters. Hear what happened next.

Web app built with Next.js 15 and Supabase (Postgres, email sign-in, file storage). Hosted on Vercel. Data stays in the EU (Supabase Frankfurt, Vercel `fra1`).

## What works

- **For You feed**: full-screen, autoplaying, looping videos that learn from watch time, replays, cares, shares, follows and signatures (`src/lib/ranking.ts`). Text fades after 3.5 s; tap to show it again.
- **Signing**: email link sign-in (no password), explicit consent once, then one-tap signing with Undo. Max 10 signatures a day, enforced in the database.
- **Petitions**: search, topics, full create form, review before going live, united petitions with combined totals, "what happened next" updates.
- **Videos**: choose or create the petition first; founders post freely, others must sign first (enforced in the database). Founder / Supporter labels. Private storage, moderation queue at `/moderate`.
- **Privacy**: nobody can read anyone else's signatures, only totals. Withdraw a signature, withdraw consent (deletes all signatures), delete the account.
- **Share cards**: `/api/card/<petition id>` returns a 1080×1920 story image.

## Not built yet

- News articles in the feed (needs licensed news sources).
- Adding friends (the table and "friends who signed" exist; there is no invite screen yet).
- Automatic video scanning and face blurring (videos go to the human review queue; plug in a scanning service later).
- Native iOS and Android apps.

## Set up (about 30 minutes)

1. **Supabase**: create a project at supabase.com, region **Central EU (Frankfurt)**.
   - SQL editor: run `supabase/migrations/0001_init.sql`. (Optional, for testing: `supabase/seed.sql`.)
   - Authentication → URL configuration: Site URL = your domain; add `https://YOUR-DOMAIN/auth/callback` to redirect URLs.
   - Authentication → Emails: set up custom SMTP (for example Resend or Postmark) before launch; the built-in sender is rate-limited.
2. **Vercel**: import the GitHub repository, set region to `fra1`, add the variables from `.env.example`.
3. **Make yourself a moderator** (SQL editor, after signing in once):
   `update public.profiles set is_moderator = true where id = (select id from auth.users where email = 'YOU@EXAMPLE.COM');`

## Develop

```
cp .env.example .env.local   # fill in your Supabase keys
npm install
npm run dev
npm run test:db              # schema + privacy tests on a local Postgres
```

## Updates after the first launch
- **Run `supabase/migrations/0002_updates_invites.sql`** once in the SQL Editor (founder/moderator updates, friend invites).
- **Starter petitions:** `supabase/starter.sql` (edit the email on the last line first), then approve them at `/moderate`.
- **Legal pages** (`/privacy`, `/terms`, `/imprint`) are drafts in `src/lib/legal.tsx`. Fill in the highlighted placeholders and have a lawyer check them before launch.
- **Languages:** all text lives in `src/lib/i18n/dict.ts` (English and Hungarian).
