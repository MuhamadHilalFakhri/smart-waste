#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
target=${1:?Gunakan: sh verify_backup.sh backups/TIMESTAMP}
case "$target" in backups/*) ;; *) echo 'Gunakan direktori backup di infra/backups' >&2; exit 1;; esac
sha256sum -c "$target/SHA256SUMS"
trap 'docker compose --profile test rm -sfv test-db >/dev/null' EXIT INT TERM
docker compose --profile test up -d --wait test-db
docker compose --profile test run --rm --no-deps -T test-db sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_restore -h test-db -U test -d smart_waste_test --no-owner --no-privileges --clean --if-exists --exit-on-error' < "$target/database.dump"
docker compose --profile test run --rm --no-deps -T test-db sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -h test-db -U test -d smart_waste_test -v ON_ERROR_STOP=1 -c "SELECT count(*) AS restored_users FROM users; SELECT count(*) AS restored_reports FROM reports;"'
docker compose run --rm --no-deps -T --entrypoint sh api -c 'mkdir -p /tmp/restore-check && tar -xzf - -C /tmp/restore-check && test -d /tmp/restore-check/media' < "$target/media.tar.gz"
echo 'Backup berhasil dipulihkan pada database test terisolasi; database demo tidak diubah.'
