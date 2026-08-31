#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p data repos volumes overrides secrets
if [ ! -f config.json ]; then
  printf '{}\n' > config.json
fi

export HOST_ROOT="${HOST_ROOT:-$ROOT}"
export TRAEFIK_NETWORK="${TRAEFIK_NETWORK:-traefik}"

mkdir -p data/traefik data/letsencrypt
if [ ! -f data/letsencrypt/acme.json ]; then
  umask 077
  printf '{}\n' > data/letsencrypt/acme.json
fi
if [ ! -f data/traefik/acme.env ]; then
  : > data/traefik/acme.env
fi
if command -v bun >/dev/null 2>&1; then
  bun scripts/write-traefik-config.ts
elif [ ! -f data/traefik/traefik.yml ]; then
  printf '%s\n' 'entryPoints:
  web:
    address: "0.0.0.0:80"
  websecure:
    address: "0.0.0.0:443"
providers:
  docker:
    exposedByDefault: false
    network: '"${TRAEFIK_NETWORK}"'
ping: {}' > data/traefik/traefik.yml
  : > data/traefik/dynamic.yml
fi

FILES="-f docker-compose.yml"
BUNDLED=0
if docker ps --format '{{.Image}} {{.Names}}' | grep -qi traefik \
  || docker network inspect "$TRAEFIK_NETWORK" >/dev/null 2>&1; then
  echo "Reusing existing Traefik / network ${TRAEFIK_NETWORK}"
  if [ -n "${VV_HOST:-}" ]; then
    FILES="$FILES -f docker-compose.proxy.yml"
  fi
else
  echo "Starting bundled Traefik"
  FILES="$FILES -f docker-compose.traefik.yml"
  BUNDLED=1
fi

# shellcheck disable=SC2086
docker compose $FILES up -d --build
if [ "$BUNDLED" = 1 ]; then
  # env_file / 静态 ACME 配置改完后必须重建 Traefik
  # shellcheck disable=SC2086
  docker compose $FILES up -d --force-recreate --no-deps traefik
fi
# shellcheck disable=SC2086
docker compose $FILES rm -f migrate
echo "vv-deploy is up. Open http://127.0.0.1:3000"
