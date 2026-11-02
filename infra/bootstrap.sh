#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  echo 'Buat infra/.env dari infra/.env.example dan isi secret serta PUBLIC_ORIGIN terlebih dahulu.' >&2
  exit 1
fi
mkdir -p ../ml/artifacts
docker compose --env-file .env config --quiet
docker compose --env-file .env up -d --build --wait --wait-timeout 300
echo 'Layanan berjalan. Periksa /api/ready dan /api/health pada URL aplikasi.'
