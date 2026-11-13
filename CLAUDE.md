# UNIER: notes for Claude

Read this first. It carries what earlier sessions learned, so nobody has to ask the owner again.

## What UNIER is

A worldwide petition platform: "See what is happening. Sign what matters. Hear what happened next."
People watch short videos about causes, sign petitions in one tap, and see what happened after delivery.
Core idea: **unite** people who ask for the same thing (united petitions, combined totals, "already exists?" check).

- Owner: **Gug** (Hungary). Live site: https://unite-two-plum.vercel.app (no own domain yet).
- Repo: github.com/ggope/unite, branch `main`. Pushing to `main` deploys to Vercel and runs the GitHub Actions "Checks" workflow.
- Supabase project `wjcqwhvdxmklsdiyxxdo` (Frankfurt). Vercel region `fra1`. Data stays in the EU.

## Values (decide by these)

- **Privacy first.** Signatures are private; organisers, targets and the public only ever see totals. Small counts (under 10, or under 3 for share impact) are grouped or hidden. Reasons are shown only when the signer chose to, and reports never reveal who wrote a reported reason.
- **Fair moderation.** Every removal needs a written reason the author sees (EU Digital Services Act). Report counts stay public on /transparency.
- **Openness.** Open numbers as CSV (`/open/*.csv`), a public transparency page, no ads, no tracking cookies.
- **Accessible and multilingual.** Plain words, works on phones, keyboard and screen readers.

## How Gug likes to work

- **Short, simple updates.** Lead with the result. No jargon.
- Gug often says "suggest improvements" and then picks; do the chosen ones, then test and ship without further questions.
- **Mylo** (a baby orange, paper-cutout style) is UNIER's mascot and must stay an **original character**. Don't copy existing characters or brands.
- Gug wanted to **say more about the kids side** (Mylo story, kids/classroom use). Ask about it if it hasn't happened yet.

## Stack and layout

Next.js 15 App Router, React 19, TypeScript, Supabase (Postgres, auth, storage), Vercel.

- `src/app/…` pages; `src/components/…`; `src/lib/…` (i18n, supabase clients, ranking, legal texts, logo).
- `src/lib/i18n/dict.ts`: all interface text in **en, hu, de, es, fr**. Every dict is `Record<Key, string>`, so a new key must be added to **all five**. Convention: insert new keys just before `'a11y.skip'` in each dict (a small Python script works well).
- `src/lib/legal.tsx`: privacy/terms/imprint drafts with `<Ph>` placeholders still to fill (operator name, address, email). A lawyer should check them.
- `src/components/mylo/`: Mylo art (`art.ts`), the picture book (`MyloBook.tsx`, `scenes.ts`), line art for colouring pages (`lineart.ts`).
- `src/lib/logo.tsx`: the "Mylo caught in the U" logo used for icons, OG images and the rail.
- Admin is at `/admin` (moderators only), with tabs including **Launch checklist**.

## Database rules

- Migrations live in `supabase/migrations/NNNN_name.sql`, numbered in order, written to be **re-runnable** (`if not exists`, `create or replace`, `drop … if exists`).
- Row level security on every table. Prefer column-level grants and `security definer` functions with `set search_path = public`.
- Every new function: `revoke execute … from public, anon` unless anon truly needs it, then grant to the right role.
- Add tests in `supabase/tests/*.sql` and list new migrations and test files in `supabase/tests/run.sh`.
- Gug runs migrations by hand in the Supabase SQL editor. Copy each new migration to the shared project files `sql/` folder and add a line to the README "Updates after the first launch" list.
- **Run so far by Gug: 0001 to 0013. Still to run: 0014 to 0022** (Admin → Launch checklist shows the live state).
- Front end must keep working (empty, not crashing) when a newer migration has not been run yet.

## Test before every push

```
service postgresql start
cd supabase && su postgres -c "bash tests/run.sh"     # database tests
cd .. && npx tsc --noEmit                              # types
bash e2e/run.sh                                        # whole site in a real browser; SKIP_BUILD=1 reuses the build
```

Add an e2e check in `e2e/flows.mjs` for each new feature. Sign-in in e2e uses `login(ctx, user)` from `e2e/lib.mjs`; user A is a moderator.

## Ship

1. Commit to `main` and push.
2. Check Vercel: `gh api repos/ggope/unite/commits/<sha>/status --jq .state` should become `success`.
3. Check CI: `gh run list -R ggope/unite -w Checks -L 1`. If it fails fetching Google Fonts, or on the admin "declining without a reason" check (a known flake), rerun with `gh run rerun <id> -R ggope/unite --failed`.
4. Never put secrets in the repo or in chat. The notification keys are in the project files `setup/` folder.

## Still to do by Gug (before launch)

Run SQL 0014 to 0022 in order (0019 kids, 0020 quality, 0021 email signing, 0022 decision notes); set the email sender (`SMTP_*`) and `ALERT_EMAIL` in Vercel; add VAPID keys and Cloudflare Turnstile keys in Vercel; buy a domain and set `NEXT_PUBLIC_SITE_URL`; fill the legal placeholders; take down the sample petitions (one button in Admin → Launch checklist).

## Working in parallel

Several Claude threads may work on the repo at once. Keep to your area, pull/rebase before pushing, and expect `dict.ts`, `globals.css` and `e2e/flows.mjs` to be touched by others (add to them, don't reorder). Areas in progress:
- Petition life cycle (end dates, "days without an answer", appeals)
- Kids side (Mylo, easy-read, classroom): `/kids`, `/kids/teachers`, `src/components/kids/`, `src/lib/easy.ts`, migration 0019. Kids never sign or sign up there.
- Easier signing (email-only) and error alerts
- Quality check (security, accessibility, speed)
- More languages: wait until the others are merged, since it touches every text.
