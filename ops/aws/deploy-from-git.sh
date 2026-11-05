#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if [[ "$EUID" -ne 0 ]]; then
  echo 'Run with: sudo bash ops/aws/deploy-from-git.sh' >&2
  exit 1
fi

repo_root="$(git -C "$(dirname -- "${BASH_SOURCE[0]}")/../.." rev-parse --show-toplevel)"
git_dir="$(git -C "$repo_root" rev-parse --absolute-git-dir)"
repo_owner="$(stat -c '%U' "$git_dir")"
config="${NEXOS_DEPLOY_CONFIG:-/etc/nexos/deployment.conf}"
runtime="${repo_root}/ops/aws/nexos.sh"
previous_commit="$(runuser -u "$repo_owner" -- git -C "$repo_root" rev-parse HEAD)"
temporary_config=''
service_stopped=0
deployment_complete=0

run_git() {
  runuser -u "$repo_owner" -- git -C "$repo_root" "$@"
}

recover_on_failure() {
  local status=$?
  trap - EXIT
  if (( status != 0 && service_stopped == 1 && deployment_complete == 0 )); then
    echo 'Deployment failed; trying to restore service with the previous image configuration.' >&2
    NEXOS_DEPLOY_CONFIG="$config" bash "$runtime" start --activate || \
      echo 'Automatic service recovery failed; inspect container and database logs.' >&2
  fi
  [[ -z "$temporary_config" ]] || rm -f -- "$temporary_config"
  exit "$status"
}
trap recover_on_failure EXIT

if [[ "$(run_git branch --show-current)" != 'main' ]]; then
  echo 'Checkout main before deploying.' >&2
  exit 1
fi
remote="$(run_git remote get-url origin)"
if [[ "$remote" != 'https://github.com/tiagochini/nexosai.git' &&
      "$remote" != 'https://github.com/tiagochini/nexosai' ]]; then
  echo 'The origin remote is not the expected NexOS repository.' >&2
  exit 1
fi
if [[ -n "$(run_git status --porcelain --untracked-files=no)" ]]; then
  echo 'Tracked files have local changes. Commit or restore them before deploying.' >&2
  exit 1
fi

NEXOS_DEPLOY_CONFIG="$config" bash "$runtime" check

memory_kb="$(awk '/^MemTotal:/ { memory=$2 } /^SwapTotal:/ { swap=$2 } END { print memory + swap }' /proc/meminfo)"
if (( memory_kb < 2097152 )); then
  echo 'Build stopped before downtime: this EC2 needs at least 2 GiB total RAM and swap.' >&2
  exit 1
fi
free_kb="$(df -Pk "$repo_root" | awk 'NR == 2 { print $4 }')"
if (( free_kb < 3145728 )); then
  echo 'Build stopped before downtime: keep at least 3 GiB free on the EC2 volume.' >&2
  exit 1
fi

if [[ -t 0 ]]; then
  printf 'Confirm that an RDS backup/PITR is current and reviewed (type YES): '
  read -r backup_confirmation
else
  backup_confirmation="${NEXOS_RDS_BACKUP_CONFIRMED:-}"
fi
if [[ "$backup_confirmation" != 'YES' ]]; then
  echo 'No current RDS backup/PITR confirmation; deployment cancelled before stopping services.' >&2
  exit 1
fi

service_stopped=1
NEXOS_DEPLOY_CONFIG="$config" bash "$runtime" stop

run_git fetch origin main
if ! run_git merge-base --is-ancestor HEAD origin/main; then
  echo 'Local main is ahead of or diverged from origin/main; refusing a non-fast-forward deploy.' >&2
  exit 1
fi
run_git pull --ff-only origin main
release_id="git-$(run_git rev-parse --short=12 HEAD)"
api_image="nexos-api:${release_id}"
web_image="nexos-web:${release_id}"

temporary_config="$(mktemp /run/nexos-deploy.XXXXXX.conf)"
cp -- "$config" "$temporary_config"
python3 - "$temporary_config" "$api_image" "$web_image" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()
for key, value in (("NEXOS_API_IMAGE", sys.argv[2]), ("NEXOS_WEB_IMAGE", sys.argv[3])):
    pattern = re.compile(rf"(?m)^{key}=.*$")
    if not pattern.search(text):
        raise SystemExit(f"Deployment config is missing {key}.")
    text = pattern.sub(f"{key}={value}", text, count=1)
path.write_text(text)
PY
chown root:root "$temporary_config"
chmod 0600 "$temporary_config"

# Build before migrations so db-tools and the app use the same pulled source.
NEXOS_DEPLOY_CONFIG="$temporary_config" COMPOSE_PARALLEL_LIMIT=1 bash "$runtime" build
NEXOS_DEPLOY_CONFIG="$temporary_config" bash "$runtime" migrate --execute
NEXOS_DEPLOY_CONFIG="$temporary_config" bash "$runtime" start --activate
NEXOS_DEPLOY_CONFIG="$temporary_config" bash "$runtime" smoke

config_next="$(mktemp "${config}.next.XXXXXX")"
cp -- "$config" "$config_next"
python3 - "$config_next" "$api_image" "$web_image" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()
for key, value in (("NEXOS_API_IMAGE", sys.argv[2]), ("NEXOS_WEB_IMAGE", sys.argv[3])):
    pattern = re.compile(rf"(?m)^{key}=.*$")
    if not pattern.search(text):
        raise SystemExit(f"Deployment config is missing {key}.")
    text = pattern.sub(f"{key}={value}", text, count=1)
path.write_text(text)
PY
chown --reference="$config" "$config_next"
chmod --reference="$config" "$config_next"
mv -f -- "$config_next" "$config"

deployment_complete=1
service_stopped=0
echo "NexOS deployed from main at $(run_git rev-parse --short=12 HEAD). Previous commit: ${previous_commit:0:12}."
