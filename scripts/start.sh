#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

mkdir -p data secrets data/traefik data/letsencrypt
# Docker 会把「不存在的文件挂载」建成目录，导致 EISDIR
if [ -d config.json ]; then
  rm -rf config.json
fi
if [ -f config.json ] && [ ! -f data/config.json ]; then
  mv config.json data/config.json
fi

VV_UID="$(id -u)"
VV_GID="$(id -g)"
if [ -S /var/run/docker.sock ]; then
  if stat -c '%g' /var/run/docker.sock >/dev/null 2>&1; then
    DOCKER_GID="$(stat -c '%g' /var/run/docker.sock)"
  else
    DOCKER_GID="$(stat -f '%g' /var/run/docker.sock)"
  fi
else
  DOCKER_GID="$VV_GID"
fi
export VV_UID VV_GID DOCKER_GID
export REPOS_DIR="${REPOS_DIR:-$ROOT/repos}"
export TRAEFIK_NETWORK="${TRAEFIK_NETWORK:-traefik}"
mkdir -p "$REPOS_DIR"

# 曾用 root 跑过的目录收回给当前用户，失败则提示
if ! chown -R "${VV_UID}:${VV_GID}" data secrets "$REPOS_DIR" 2>/dev/null; then
  echo "若容器写文件报权限错误，请执行: sudo chown -R ${VV_UID}:${VV_GID} data secrets $REPOS_DIR"
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
echo "vv-deploy is up. Open http://127.0.0.1:3009"
