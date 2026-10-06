#!/bin/sh
set -eu
password=$(cat /run/secrets/redis_password)
case "$password" in
  ''|*[!a-zA-Z0-9]*) echo 'Redis requires an alphanumeric secret file' >&2; exit 1 ;;
esac
[ ${#password} -ge 32 ] || { echo 'Redis secret must have at least 32 characters' >&2; exit 1; }
umask 077
cp /etc/nexos/redis.conf /tmp/nexos-redis.conf
printf '\nrequirepass %s\n' "$password" >> /tmp/nexos-redis.conf
unset password
if [ "$(id -u)" = 0 ]; then chown redis:redis /tmp/nexos-redis.conf; fi
exec /usr/local/bin/docker-entrypoint.sh redis-server /tmp/nexos-redis.conf
