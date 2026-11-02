#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="backups/$stamp"
mkdir -p "$target"
# Pause all application writers while both database and media are captured.
docker compose stop api
trap 'docker compose start api >/dev/null' EXIT INT TERM
docker compose run --rm --no-deps -T db sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dump -h db -U smart_waste -d smart_waste -Fc' > "$target/database.dump"
docker compose run --rm --no-deps -T --entrypoint tar api -czf - -C /data media > "$target/media.tar.gz"
sha256sum "$target/database.dump" "$target/media.tar.gz" > "$target/SHA256SUMS"
echo "Backup tersimpan di infra/$target. Salin ke penyimpanan terpisah dan lindungi aksesnya."
