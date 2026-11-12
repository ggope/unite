#!/usr/bin/env bash
# Builds a throwaway local backend for end-to-end tests: Postgres with all migrations, and PostgREST.
# Usage: bash e2e/setup.sh   (needs a local Postgres you can reach as the postgres user)
set -euo pipefail
cd "$(dirname "$0")"
DB=${DB:-unite_e2e}
mkdir -p .bin
if [ ! -x .bin/postgrest ]; then
  curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar -xJ -C .bin
fi
M=../supabase/migrations
su postgres -c "psql -q -c 'drop database if exists $DB with (force)' -c 'create database $DB'"
su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f stub.sql $(ls $M/*.sql | sed 's/^/-f /' | tr '\n' ' ') -f ../supabase/seed.sql -f grants.sql"
echo "e2e database ready"
