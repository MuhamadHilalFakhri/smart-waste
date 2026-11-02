#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
trap 'docker compose --profile test rm -sfv test-db >/dev/null' EXIT INT TERM
docker compose --profile test build test-api
docker compose --profile test run --rm test-api
