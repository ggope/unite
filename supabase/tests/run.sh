#!/usr/bin/env bash
# Runs the schema and the privacy/limit tests on a throwaway local Postgres database.
set -euo pipefail
DB=${DB:-unite_test}
cd "$(dirname "$0")/.."
psql -q -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/stub_supabase.sql -f migrations/0001_init.sql -f migrations/0002_updates_invites.sql -f migrations/0003_news.sql -f migrations/0004_trust.sql -f migrations/0005_report.sql -f migrations/0006_social.sql -f migrations/0007_links.sql -f migrations/0008_mylo.sql -f seed.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/behaviour.sql -f tests/invites.sql -f tests/report.sql -f tests/social.sql -f tests/mylo.sql
echo "Database tests passed"
