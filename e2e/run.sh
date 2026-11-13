#!/usr/bin/env bash
# One command for the end-to-end checks: fresh database, PostgREST, the Supabase mock, the built app, then the flows.
# Needs: a local Postgres (service postgresql start), Node, Playwright with Chromium, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
pkill -f "postgrest postgrest.conf" 2>/dev/null || true
bash setup.sh
pkill -f "postgrest postgrest.conf" 2>/dev/null || true; pkill -f mock-supabase.mjs 2>/dev/null || true; pkill -f "next start -p 3123" 2>/dev/null || true; pkill -f next-server 2>/dev/null || true
./.bin/postgrest postgrest.conf > /tmp/e2e-postgrest.log 2>&1 &
node mock-supabase.mjs > /tmp/e2e-mock.log 2>&1 &
sleep 2
ANON=$(grep ANON_KEY /tmp/e2e-mock.log | cut -d= -f2); SVC=$(grep SERVICE_KEY /tmp/e2e-mock.log | cut -d= -f2)
cd ..
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON SUPABASE_SERVICE_ROLE_KEY=$SVC CRON_SECRET=e2e NEXT_PUBLIC_SITE_URL=http://localhost:3123
# UNIER's own emails go to the mock instead of a mail server
# the AI helper that drafts team petitions talks to the mock instead of the Claude API
export ANTHROPIC_API_KEY=e2e ANTHROPIC_BASE_URL=http://localhost:54321/__claude
export SMTP_HOST=mock SMTP_USER=e2e SMTP_PASS=e2e E2E_MAIL_URL=http://localhost:54321/__mail ALERT_EMAIL=owner@e2e.test
[ "${SKIP_BUILD:-}" = 1 ] || { rm -rf .next && npm run build > /tmp/e2e-build.log 2>&1 || { tail -30 /tmp/e2e-build.log; exit 1; }; }
npx next start -p 3123 > /tmp/e2e-next.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null localhost:3123 && break; sleep 1; done
node e2e/flows.mjs
