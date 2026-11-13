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
- **Access:** run `supabase/migrations/0010_grants.sql`. It fixes "permission denied for table …" errors on projects where Supabase does not give the website access to new tables by itself. Row level security still decides who sees what.
- **Privacy:** run `supabase/migrations/0011_privacy.sql`. People can download the reports they sent, and a daily clean-up (it runs with the morning news job) deletes closed reports after 12 months and unanswered friend requests after 90 days, as the privacy policy says.
- **Translations:** run `supabase/migrations/0012_translations.sql`. Each petition keeps its original language plus an optional Hungarian or English version, edited in Admin under the petition.
- **Security limits:** run `supabase/migrations/0013_security.sql`. It locks the columns people may edit on their own signatures and profiles, keeps friends-only videos and under-18 profiles private, and caps posting at 3 petitions and 10 videos a day, 20 reports an hour and 10 updates a day per petition.
- **Notifications and bot check:** run `supabase/migrations/0014_notify.sql`. It adds private notices (people see why a moderator cleared their profile), phone notifications and the optional bot check.
  - *Phone notifications:* add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in Vercel (make a pair with `npx web-push generate-vapid-keys`) and redeploy. People switch them on under You. Followers (signers follow automatically) hear about every update a moderator posts and when a petition reaches its goal. On iPhone they work once UNIER is added to the Home Screen.
  - *Bot check:* create a free Cloudflare Turnstile widget, add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel and redeploy. Then, in Supabase, Authentication → Attack Protection → enable CAPTCHA with Turnstile and paste the secret key (this protects sign-up and log-in). To also check people before they sign petitions, switch it on in Admin → People.
- **Reach and openness:** run `supabase/migrations/0015_reach.sql`. It adds share tracking ("Your impact" under You; totals only, from 3 signatures), the public `/transparency` page, the `/targets` accountability board ("Who listens"), the embed box at `/embed/<petition id>`, and German, Spanish and French. Legal pages show the English text in those three languages until they are translated by a professional.
- **Answers and open numbers:** run `supabase/migrations/0016_answers.sql`. Organisers (and moderators) can make a private answer link on a petition or its report; the target answers at `/answer/<link>` without an account, and the answer shows as "Official answer". It also adds "Mark as delivered" on the report, the reasons people chose to show, the "Popular in your country" filter on Petitions, and CSV downloads at `/open/totals.csv`, `/open/petitions.csv`, `/open/targets.csv` and `/open/countries.csv` (linked from Transparency). Mylo's story is at `/mylo/story`, and first-time visitors to the feed see a three-page intro.
- **Safety, wins and the organiser dashboard:** run `supabase/migrations/0017_safety_wins.sql` (after 0016). Shown reasons and official answers get a small flag so anyone signed in can report them; reports name a reason only by a random key, never its author. In Admin → Reports, "Hide reason" hides it and tells the signer why (their signature still counts), and "Remove" deletes an official answer. It also adds the public wins page at `/wins` and a private dashboard for each petition's organiser at `/p/<id>/dashboard` (linked from You and from the petition). The printable book with colouring pages is at `/mylo/story/print` and needs no migration.
- **Petition life cycle and appeals:** run `supabase/migrations/0018_lifecycle.sql` (after 0017). Petitions with an end date close by themselves every night (Vercel cron `/api/lifecycle`, needs `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`; moderators can also press "Close ended petitions now" in Admin → Petitions). Nobody can sign after the end date. The organiser gets a reminder under You to deliver (when it closes, and once more a week later) and can set or move the end date on their dashboard. After delivery the petition shows "days without an answer" from the target, linked to the Who listens board, and followers get a phone notification at 30 and 90 days of silence. Authors can ask for a second look at any moderator decision (petition, video, hidden reason, cleared name) for 6 months at `/appeal`; moderators decide in Admin → Appeals with a written reason, the author is told, and appeal totals are on `/transparency` (EU Digital Services Act, articles 20 and 24).
- **Signing with only an email, and error alerts:** run `supabase/migrations/0021_email_sign.sql` (after 0020). Signed-out visitors type just their email; the email's link opens a page with one Confirm button (so mail scanners cannot sign for anyone), and the signature counts. No account, no password. Only a keyed hash of the address is stored; the same link withdraws the signature later, and signing in with that email moves the signature into the account. Limits: 10 a day per email, 20 links an hour per connection, `MAIL_DAILY_CAP` (400) a day in total.
  - *Email sender:* add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` in Vercel (see `.env.example`). Without a domain, a Gmail address with an app password works (about 500 emails a day). Put the same SMTP settings in Supabase → Authentication → Emails → SMTP so login emails stop hitting Supabase's hourly limit. With a domain, switch both to Resend or Brevo for better delivery and higher limits. Until a sender is set, signing falls back to the older sign-in link.
  - *Error alerts:* set `ALERT_EMAIL`. Crashed pages, failing server calls, browser crashes, a failed news import or a failed email are logged in Admin → Errors and emailed once per kind of error (again at most every 6 hours, at most 30 a day). For "the whole site is down", add a free uptime monitor (for example UptimeRobot) for `/api/health`.
- **AI check (fewer hands needed for moderation):** run `supabase/migrations/0024_ai_moderation.sql` and add `ANTHROPIC_API_KEY` in Vercel (make one at console.anthropic.com). Claude then reads every new petition, video caption and report a few seconds after it arrives (and again each night for anything missed), labels it in the Review queue and Reports, puts the most worrying first, and drafts the reason the author would see. Choose the mode in Admin → AI check: *Off*, *Suggest* (default: labels only, people decide) or *Auto* (also publishes petitions it is very sure are fine, and takes down clear spam and scams with a note that it was automatic; the author can appeal to a person). Videos and reports always wait for a person. Possible danger (threats, child safety, self-harm, doxxing) is emailed to `ALERT_EMAIL` at once. Totals of what the AI decided are on `/transparency`. Optional: `AI_DAILY_LIMIT` (default 200 checks a day) and `AI_MODERATION_MODEL` (default `claude-opus-5-5`). Without the key, everything works as before.
- **Team petitions from trusted sources:** run `supabase/migrations/0023_team_content.sql`. Every morning at 05:30 UTC (Vercel cron `/api/team/draft`, half an hour after the news import) an AI helper reads the biggest new stories, those covered by two or more outlets or published by a trusted organisation (UN News, WHO, European Parliament, Human Rights Watch, Amnesty, TASZ, Helsinki Committee were added as sources). For each it drafts a petition with a named target and every source cited, links the story to an existing petition that already asks for it, or skips it with a reason. Drafts wait in Admin → Review queue as "From the UNIER team · drafted by AI", with what to check and an edit box; nothing goes live without a moderator. Approved ones say "From the UNIER team" and list their sources.
  - *AI key:* create a key at console.anthropic.com, set a monthly spending limit there (10 to 20 USD is plenty), and add `ANTHROPIC_API_KEY` in Vercel. About 0.05 to 0.15 USD per story looked at, up to 8 a day. `UNIER_AI_MODEL` changes the model (default `claude-opus-5-5`). Without the key nothing is drafted and nothing else changes.
  - *Team content switch:* Admin → Team content. Automatic (default) is full while people start fewer than 30 petitions a month, then less. Full: up to 3 drafts a day. Less: 1 a day, and team petitions rank lower in the feed. Off: no new drafts, and team petitions leave the feed (links and signatures keep working). Team videos use the same switch.
- **Before launch:** Admin → Launch checklist shows, live, which database updates are missing, whether sample petitions are still up (with a button to take them down), how many gaps the legal pages still have, and which Vercel settings (own domain, notification keys, bot check keys, cron secret) are not set yet. Search engines get `/sitemap.xml` and `/robots.txt`. While someone writes a petition, the start page suggests similar live petitions to join instead.
- **News:** run `supabase/migrations/0003_news.sql`, add a `CRON_SECRET` environment variable in Vercel (any long random text), and redeploy. News then imports once a day; moderators can also press "Import news now" on `/admin` (News tab). Sources live in the `news_sources` table. Only headlines, a short teaser and the link are stored; the full article stays on the publisher's site.
