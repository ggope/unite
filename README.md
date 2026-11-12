# UNIER

See what is happening. Sign what matters. Hear what happened next.

Web app built with Next.js 15 and Supabase (Postgres, email sign-in, file storage). Hosted on Vercel. Data stays in the EU (Supabase Frankfurt, Vercel `fra1`).

## What works

- **For You feed**: full-screen, autoplaying, looping videos that learn from watch time, replays, cares, shares, follows and signatures (`src/lib/ranking.ts`). Text fades after 3.5 s; tap to show it again.
- **Signing**: email link sign-in (no password), explicit consent once, then one-tap signing with Undo. Max 10 signatures a day, enforced in the database.
- **Petitions**: search, topics, full create form, review before going live, united petitions with combined totals, "what happened next" updates.
- **Videos**: choose or create the petition first; founders post freely, others must sign first (enforced in the database). Founder / Supporter labels. Private storage, moderation queue in the admin page at `/admin`.
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

## End-to-end tests

`bash e2e/run.sh` clicks through the whole site in a real browser, as a guest, a signed-in person and a moderator: saving settings, starting, approving and signing petitions, videos, friends, messages, blocking, reports, every admin tab, data export and account deletion. It needs a local Postgres (like the database tests). It downloads PostgREST once, runs a small stand-in for Supabase auth and storage, and builds the app. `SKIP_BUILD=1` reuses the last build.

## Updates after the first launch
- **Run `supabase/migrations/0002_updates_invites.sql`** once in the SQL Editor (founder/moderator updates, friend invites).
- **Starter petitions:** `supabase/starter.sql` (edit the email on the last line first), then approve them at `/admin` (Review queue).
- **Legal pages** (`/privacy`, `/terms`, `/imprint`) are drafts in `src/lib/legal.tsx`. Fill in the highlighted placeholders and have a lawyer check them before launch.
- **Languages:** all text lives in `src/lib/i18n/dict.ts` (English and Hungarian).
- **Delivery reports and donations:** run `supabase/migrations/0005_report.sql`. Every live petition gets a printable report at `/p/ID/report`. For donations, create Stripe Payment Links and add `NEXT_PUBLIC_DONATE_URL` (and optionally `NEXT_PUBLIC_DONATE_MONTHLY_URL`) in Vercel.
- **People:** run `supabase/migrations/0006_social.sql`. Profiles at `/u/handle`, friend requests, blocking, and messages between friends at `/messages`.
- **Organiser links:** run `supabase/migrations/0007_links.sql`. Petitions can carry a website button ("Learn more", "Donate", …) shown under the petition and its videos.
- **Mylo:** run `supabase/migrations/0008_mylo.sql`. Mylo, the baby orange, gets a daily mood from public totals (signatures today vs. a usual day, wins, petitions near their goal, how grim the big news stories are). He greets visitors once a day in the corner, cheers after every signature, and has his own page at `/mylo` with the reasons and the big community goals. Moderators pin big goals in Admin → Petitions.
- **Fixes:** run `supabase/migrations/0009_fixes.sql`. It creates any missing profile rows (this is why names would not save for some accounts), lets petition lists show signature counts again, and lets people reset what their feed learned. Account deletion needs `SUPABASE_SERVICE_ROLE_KEY` set in Vercel.
- **News:** run `supabase/migrations/0003_news.sql`, add a `CRON_SECRET` environment variable in Vercel (any long random text), and redeploy. News then imports once a day; moderators can also press "Import news now" on `/admin` (News tab). Sources live in the `news_sources` table. Only headlines, a short teaser and the link are stored; the full article stays on the publisher's site.
