#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
target=${1:?Gunakan: sh restore.sh backups/TIMESTAMP}
case "$target" in backups/*) ;; *) echo 'Gunakan direktori di infra/backups' >&2; exit 1;; esac
if [ "${CONFIRM_RESTORE:-}" != "replace-current-data" ]; then
  echo 'Restore mengganti data aktif. Backup dahulu, lalu set CONFIRM_RESTORE=replace-current-data.' >&2
  exit 1
fi
sha256sum -c "$target/SHA256SUMS"
docker compose stop api
trap 'docker compose start api >/dev/null' EXIT INT TERM
docker compose run --rm --no-deps -T db sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_restore -h db --clean --if-exists --exit-on-error -U smart_waste -d smart_waste' < "$target/database.dump"
docker compose run --rm --no-deps -T --entrypoint tar api -xzf - -C /data < "$target/media.tar.gz"
echo 'Database dan media dipulihkan. File media tambahan yang tidak direferensikan tidak dihapus otomatis.'
