#!/bin/sh
set -eu
export REDISCLI_AUTH="$(cat /run/secrets/redis_password)"
[ "$(redis-cli --raw ping)" = PONG ]
info=$(redis-cli --raw info persistence | tr -d '\r')
printf '%s\n' "$info" | grep -qx 'aof_enabled:1'
printf '%s\n' "$info" | grep -qx 'aof_last_write_status:ok'
printf '%s\n' "$info" | grep -qx 'aof_last_bgrewrite_status:ok'
printf '%s\n' "$info" | grep -qx 'rdb_last_bgsave_status:ok'
