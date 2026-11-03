#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
action="${1:-help}"
deploy_api_image="${2:-}"
deploy_web_image="${3:-}"
if [[ "$action" == help ]]; then
  cat <<'HELP'
Run with sudo bash ops/aws/nexos.sh ACTION on the EC2 host.
Actions: init, check, build, bootstrap --execute, migrate --execute,
         verify-db, start --activate, deploy API_IMAGE WEB_IMAGE,
         stop, status, logs, smoke
init is for NEW environments and never replaces existing runtime files.
start launches production schedulers, even with DRY_RUN_MODE=true.
bootstrap requires an empty database. migrate requires a reviewed backup.
HELP
  exit 0
fi
if [[ "$EUID" -ne 0 ]]; then echo 'Run as root (sudo bash ...).' >&2; exit 1; fi
if [[ "$action" == init ]]; then
  install -d -m 0711 /etc/nexos
  docker run --rm --user 0 --mount "type=bind,src=$root/ops/aws,dst=/tools,readonly" \
    --mount type=bind,src=/etc/nexos,dst=/runtime \
    node:24-bookworm-slim node /tools/runtime.mjs init /runtime
  exit 0
fi
config="${NEXOS_DEPLOY_CONFIG:-/etc/nexos/deployment.conf}"
if [[ ! -f "$config" || -L "$config" || "$(stat -c %u "$config")" != 0 ]]; then
  echo 'Deployment config must be a root-owned regular file.' >&2; exit 1
fi
if (( (8#$(stat -c %a "$config") & 8#022) != 0 )); then
  echo 'Deployment config must not be writable by group/others.' >&2; exit 1
fi
set -a
# shellcheck source=/dev/null
source "$config"
set +a
if [[ "$action" == deploy ]]; then
  [[ -n "$deploy_api_image" && -n "$deploy_web_image" && -z "${4:-}" ]] || {
    echo 'Use deploy API_IMAGE WEB_IMAGE.' >&2; exit 1;
  }
  NEXOS_API_IMAGE="$deploy_api_image"
  NEXOS_WEB_IMAGE="$deploy_web_image"
fi
: "${APP_ENV_FILE:?}" "${REDIS_PASSWORD_FILE:?}" "${DATABASE_CA_FILE:?}"
: "${NEXOS_API_IMAGE:?}" "${NEXOS_WEB_IMAGE:?}"
for image in "$NEXOS_API_IMAGE" "$NEXOS_WEB_IMAGE"; do
  if [[ "$image" != *@sha256:* && ( "$image" != *:* || "$image" == *:latest || "$image" == *:local ) ]]; then
    echo 'Use versioned image tags or sha256 digests.' >&2; exit 1
  fi
done
dc() {
  docker compose -p nexos -f "$root/ops/app/compose.yml" \
    -f "$root/ops/app/compose.ca.yml" -f "$root/ops/app/compose.aws.yml" "$@"
}
check() {
  docker info >/dev/null
  dc config --quiet
  for file in "$APP_ENV_FILE" "$REDIS_PASSWORD_FILE" "$DATABASE_CA_FILE"; do
    [[ -f "$file" ]] || { echo 'A required runtime file is missing.' >&2; return 1; }
  done
  for file in "$APP_ENV_FILE" "$REDIS_PASSWORD_FILE"; do
    if [[ "$(stat -c %u "$file")" != 1000 ]] || (( (8#$(stat -c %a "$file") & 8#077) != 0 )); then
      echo 'Runtime secrets must belong to UID 1000 and have mode 0600 or stricter.' >&2; return 1
    fi
  done
  docker run --rm --network none --user 1000 \
    --mount "type=bind,src=$root/ops/aws,dst=/tools,readonly" \
    --mount "type=bind,src=$APP_ENV_FILE,dst=/run/secrets/app.env,readonly" \
    --mount "type=bind,src=$REDIS_PASSWORD_FILE,dst=/run/secrets/redis-password,readonly" \
    --mount "type=bind,src=$DATABASE_CA_FILE,dst=/run/secrets/rds-ca.pem,readonly" \
    node:24-bookworm-slim node /tools/runtime.mjs check
}
require_stopped_api() {
  if [[ -n "$(dc ps --status running -q api)" ]]; then
    echo 'Stop the API before changing the schema; stop other database writers too.' >&2; exit 1
  fi
}
case "$action" in
  check) check ;;
  build) check; dc build api web ;;
  verify-db) check; dc run --rm --no-deps db-tools ;;
  bootstrap)
    [[ "${2:-}" == --execute ]] || { echo 'Use bootstrap --execute for an EMPTY database.' >&2; exit 1; }
    check; require_stopped_api
    dc run --rm --no-deps db-tools /workspace/lib/db/scripts/bootstrap-empty-database.mjs
    dc run --rm --no-deps db-tools /workspace/lib/db/scripts/bootstrap-empty-database.mjs --execute
    dc run --rm --no-deps db-tools /workspace/lib/db/node_modules/tsx/dist/cli.mjs /workspace/lib/db/src/seed-plans.ts
    dc run --rm --no-deps db-tools
    ;;
  migrate)
    [[ "${2:-}" == --execute ]] || { echo 'Review backup/migrations, then use migrate --execute.' >&2; exit 1; }
    check; require_stopped_api
    dc run --rm --no-deps db-tools /workspace/lib/db/scripts/apply-migrations.mjs
    dc run --rm --no-deps db-tools
    ;;
  start)
    [[ "${2:-}" == --activate ]] || { echo 'Use start --activate only after reviewing pending jobs and integrations.' >&2; exit 1; }
    check
    dc run --rm --no-deps db-tools
    dc up -d --wait --wait-timeout 180 redis
    dc up -d --force-recreate --wait --wait-timeout 180 api web
    ;;
  deploy)
    check
    docker pull "$NEXOS_API_IMAGE"
    docker pull "$NEXOS_WEB_IMAGE"
    dc run --rm --no-deps db-tools
    dc up -d --wait --wait-timeout 180 redis
    dc up -d --force-recreate --wait --wait-timeout 180 api web
    curl --fail --silent --show-error --max-time 20 http://127.0.0.1:8080/api/livez
    curl --fail --silent --show-error --max-time 20 http://127.0.0.1:8080/api/readyz
    curl --fail --silent --show-error --max-time 20 --output /dev/null "http://127.0.0.1:${WEB_PORT:-8081}/"
    ;;
  stop) dc stop web api ;;
  status) dc ps ;;
  logs) dc logs --tail=100 api web redis ;;
  smoke)
    curl --fail --silent --show-error --max-time 20 http://127.0.0.1:8080/api/livez
    curl --fail --silent --show-error --max-time 20 http://127.0.0.1:8080/api/readyz
    curl --fail --silent --show-error --max-time 20 --output /dev/null http://127.0.0.1:"${WEB_PORT:-8081}"/
    echo 'Local smoke passed. Verify public HTTPS, login and realtime separately.'
    ;;
  *) echo 'Unknown action; run help.' >&2; exit 1 ;;
esac
