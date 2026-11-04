#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo 'Run this deployment command through Systems Manager as root.' >&2
  exit 1
fi

: "${AWS_DEFAULT_REGION:?}" "${NEXOS_RELEASE_BUCKET:?}" "${NEXOS_RELEASE_ID:?}"
: "${NEXOS_API_IMAGE:?}" "${NEXOS_WEB_IMAGE:?}"

if [[ "$AWS_DEFAULT_REGION" != us-east-2 ]]; then
  echo 'Unexpected AWS Region.' >&2
  exit 1
fi
if [[ ! "$NEXOS_RELEASE_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]]; then
  echo 'Invalid release bucket name.' >&2
  exit 1
fi
if [[ ! "$NEXOS_RELEASE_ID" =~ ^[0-9a-f]{40}$ &&
      ! "$NEXOS_RELEASE_ID" =~ ^manual-[0-9]{8}T[0-9]{6}Z$ ]]; then
  echo 'Invalid release identifier.' >&2
  exit 1
fi
if [[ ! "$NEXOS_API_IMAGE" =~ ^[0-9]{12}\.dkr\.ecr\.us-east-2\.amazonaws\.com/nexos-api:${NEXOS_RELEASE_ID}$ ||
      ! "$NEXOS_WEB_IMAGE" =~ ^[0-9]{12}\.dkr\.ecr\.us-east-2\.amazonaws.com/nexos-web:${NEXOS_RELEASE_ID}$ ]]; then
  echo 'Image references must be Nexos ECR images tagged with this release identifier.' >&2
  exit 1
fi

release_parent=/opt/nexos/releases
release_dir="$release_parent/$NEXOS_RELEASE_ID"
current=/opt/nexos/current
archive="/tmp/nexos-ops-${NEXOS_RELEASE_ID}.tar.gz"
checksum="$archive.sha256"
mkdir -p "$release_parent"
chmod 0755 /opt/nexos "$release_parent"

aws s3 cp "s3://${NEXOS_RELEASE_BUCKET}/releases/${NEXOS_RELEASE_ID}/ops.tar.gz" "$archive" --only-show-errors
aws s3 cp "s3://${NEXOS_RELEASE_BUCKET}/releases/${NEXOS_RELEASE_ID}/ops.tar.gz.sha256" "$checksum" --only-show-errors
expected_checksum="$(awk 'NR == 1 { print $1 }' "$checksum")"
if [[ ! "$expected_checksum" =~ ^[0-9a-f]{64}$ ]]; then
  echo 'Invalid release archive checksum.' >&2
  exit 1
fi
printf '%s  %s\n' "$expected_checksum" "$archive" | sha256sum --check --status -
install -d -m 0755 "$release_dir"
tar --no-same-owner -xzf "$archive" -C "$release_dir"
test -f "$release_dir/ops/aws/nexos.sh"
test -f "$release_dir/ops/app/compose.yml"

registry="${NEXOS_API_IMAGE%%/*}"
aws ecr get-login-password --region "$AWS_DEFAULT_REGION" |
  docker login --username AWS --password-stdin "$registry"

old_release="$(readlink -f "$current" 2>/dev/null || true)"
ln -sfnT "$release_dir" /opt/nexos/current.next
mv -Tf /opt/nexos/current.next "$current"

if bash "$current/ops/aws/nexos.sh" deploy "$NEXOS_API_IMAGE" "$NEXOS_WEB_IMAGE"; then
  echo "NexOS release $NEXOS_RELEASE_ID is healthy."
  exit 0
fi

echo 'Deployment failed; restoring the previous release.' >&2
if [[ -n "$old_release" && -d "$old_release" ]]; then
  ln -sfnT "$old_release" /opt/nexos/current.next
  mv -Tf /opt/nexos/current.next "$current"
  if ! env -u NEXOS_API_IMAGE -u NEXOS_WEB_IMAGE bash "$current/ops/aws/nexos.sh" start --activate; then
    echo 'Automatic restart of the previous release also failed; inspect SSM and container logs.' >&2
  fi
else
  bash "$current/ops/aws/nexos.sh" stop || true
  echo 'No previous release was available for automatic rollback.' >&2
fi
exit 1
