#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
temporary_root="$(mktemp -d)"
temporary_database="maktaba_restore_test_$(date +%s)_$RANDOM"
base_url="${DATABASE_URL%/*}"
restore_url="$base_url/$temporary_database"
cleanup() { dropdb --if-exists --maintenance-db="$DATABASE_URL" "$temporary_database" >/dev/null 2>&1 || true; rm -rf "$temporary_root"; }
trap cleanup EXIT

snapshot_sql="select json_build_object(
  'products',(select count(*) from products),
  'customers',(select count(*) from customers),
  'orders',(select count(*) from orders),
  'inventory',(select count(*) from stock_movements),
  'coupons',(select count(*) from coupons),
  'employees',(select count(*) from users),
  'audit_logs',(select count(*) from audit_logs),
  'shipping_snapshots',(select count(*) from orders where shipping_rule_snapshot is not null),
  'shipping_snapshot_hash',(select coalesce(md5(string_agg(id::text||coalesce(shipping_rule_snapshot::text,''),'|' order by id)),'') from orders)
)::text"
before="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "$snapshot_sql")"

BACKUP_DIR="$temporary_root" BACKUP_RETENTION_DAYS=1 DATABASE_URL="$DATABASE_URL" "$(dirname "$0")/backup-postgres.sh" >/dev/null
backup_file="$(find "$temporary_root" -name 'maktaba-*.dump' -type f -print -quit)"
createdb --maintenance-db="$DATABASE_URL" "$temporary_database"
RESTORE_DATABASE_URL="$restore_url" BACKUP_FILE="$backup_file" ALLOW_DATABASE_RESTORE=yes "$(dirname "$0")/restore-postgres.sh" >/dev/null
after="$(psql "$restore_url" -v ON_ERROR_STOP=1 -Atc "$snapshot_sql")"

if [[ "$before" != "$after" ]]; then printf 'Backup verification mismatch.\nBefore: %s\nAfter:  %s\n' "$before" "$after" >&2; exit 1; fi
printf 'Backup and restore verified: %s\n' "$after"
