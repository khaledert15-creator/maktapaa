#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
umask 077

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/maktaba-$timestamp.dump"
temporary="$target.partial"
trap 'rm -f "$temporary"' EXIT

pg_dump --dbname="$DATABASE_URL" --format=custom --compress=9 --no-owner --no-acl --file="$temporary"
pg_restore --list "$temporary" >/dev/null
mv "$temporary" "$target"
if command -v sha256sum >/dev/null 2>&1; then sha256sum "$target" >"$target.sha256"; else shasum -a 256 "$target" >"$target.sha256"; fi
touch "$target.verified"
find "$BACKUP_DIR" -type f -name 'maktaba-*.dump*' -mtime "+$BACKUP_RETENTION_DAYS" -delete
printf '%s\n' "$target"
