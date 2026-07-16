#!/usr/bin/env bash
set -Eeuo pipefail

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${ALLOW_DATABASE_RESTORE:?Set ALLOW_DATABASE_RESTORE=yes after confirming the target database}"
if [[ "$ALLOW_DATABASE_RESTORE" != "yes" ]]; then echo "Refusing restore without ALLOW_DATABASE_RESTORE=yes" >&2; exit 2; fi
if [[ ! -f "$BACKUP_FILE" ]]; then echo "Backup file does not exist: $BACKUP_FILE" >&2; exit 2; fi

if [[ -f "$BACKUP_FILE.sha256" ]]; then
  if command -v sha256sum >/dev/null 2>&1; then (cd "$(dirname "$BACKUP_FILE")" && sha256sum --check "$(basename "$BACKUP_FILE").sha256");
  else expected="$(cut -d' ' -f1 "$BACKUP_FILE.sha256")"; actual="$(shasum -a 256 "$BACKUP_FILE" | cut -d' ' -f1)"; [[ "$expected" == "$actual" ]] || { echo "Backup checksum mismatch" >&2; exit 1; }; fi
fi
pg_restore --list "$BACKUP_FILE" >/dev/null
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-acl --exit-on-error "$BACKUP_FILE"
printf 'Restore completed and archive structure verified.\n'
