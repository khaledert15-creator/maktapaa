# Maktaba production operations

## First deployment

1. Point `maktabaa.com` and `www.maktabaa.com` to the Ubuntu VPS.
2. Install Docker Engine with the Compose plugin, copy `.env.production.example` to `.env.production`, and replace every placeholder.
3. Run `docker compose --env-file .env.production -f docker-compose.production.yml build`.
4. Run a backup before every schema or application release.
5. Start with `docker compose --env-file .env.production -f docker-compose.production.yml up -d`. The one-shot `migrate` service must complete before the API becomes ready.
6. If this is a new empty production database, create the first owner once with `docker compose --env-file .env.production -f docker-compose.production.yml run --rm -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_PASSWORD -e BOOTSTRAP_ADMIN_NAME api node ./artifacts/api-server/dist/bootstrap-admin.mjs`. Pass the three values from the shell and remove them immediately afterward. The demo seed refuses to run in production unless explicitly overridden.
7. Verify `/api/healthz`, `/api/readyz`, a product page, `/sitemap.xml`, customer login, and an authorized admin workflow.

PostgreSQL is reachable only on the internal `database` network. Only Caddy publishes ports 80 and 443. Caddy obtains and renews TLS certificates automatically.

## Backups

Schedule `deploy/backup-postgres.sh` daily from the host or a dedicated backup container. Copy encrypted backups to another machine or object-storage bucket; a backup left only on the VPS is not disaster recovery. The script creates a compressed custom-format dump, validates its catalog, writes a SHA-256 file, and removes archives older than `BACKUP_RETENTION_DAYS` (14 by default).

Example cron entry:

```cron
15 2 * * * cd /opt/maktaba && set -a && . ./.env.production && set +a && BACKUP_DIR=/srv/maktaba-backups ./deploy/backup-postgres.sh >>/var/log/maktaba-backup.log 2>&1
```

Run `deploy/test-backup-restore.sh` after PostgreSQL upgrades and at least monthly. It restores into a temporary database and compares the required business table counts and a hash of shipping snapshots.

## Restore and rollback

1. Put the site in maintenance mode or stop API writes.
2. Verify the chosen archive and target database twice.
3. Run `RESTORE_DATABASE_URL=... BACKUP_FILE=... ALLOW_DATABASE_RESTORE=yes ./deploy/restore-postgres.sh`.
4. Run the API version matching that backup, then run readiness and customer/admin smoke tests.

Migrations are forward-only. Never reverse a production migration by manually deleting columns or tables. For an application-only rollback, redeploy the previous immutable image. For an incompatible schema rollback, restore the pre-deployment backup into a new database, validate it, then switch `DATABASE_URL`. This preserves the old database for investigation.

## Existing local images

Keep the local uploads directory read-only during migration. Configure the S3/R2 environment variables, then run `pnpm --filter @workspace/api-server storage:migrate-local`. The command uploads responsive variants, updates PostgreSQL only after each upload succeeds, updates primary product covers, and deliberately retains original files. Verify CDN URLs before archiving the originals.
