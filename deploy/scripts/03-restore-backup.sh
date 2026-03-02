#!/bin/bash
# ========================================
# Omnex Display Hub - Backup Restore
# Restores from .tar.gz backup archive
# Usage: bash 03-restore-backup.sh /path/to/backup.tar.gz
# ========================================

set -euo pipefail

echo "================================================"
echo "  Omnex Display Hub - Backup Restore"
echo "================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

BACKUP_FILE="${1:-}"
APP_DIR="/opt/omnex-hub"
COMPOSE_FILE="$APP_DIR/deploy/docker-compose.yml"
RESTORE_DIR="/tmp/omnex-restore-$(date +%s)"

# ---- Validation ----
[ -n "$BACKUP_FILE" ] || error "Usage: $0 /path/to/backup.tar.gz"
[ -f "$BACKUP_FILE" ] || error "Backup file not found: $BACKUP_FILE"
[ -f "$COMPOSE_FILE" ] || error "docker-compose.yml not found: $COMPOSE_FILE"

# ---- Load env ----
ENV_FILE="$APP_DIR/deploy/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# ---- Extract backup ----
log "Extracting backup to $RESTORE_DIR..."
mkdir -p "$RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"

# ---- Find SQL dump ----
SQL_DUMP=$(find "$RESTORE_DIR" -name "*.sql" -o -name "*.dump" | head -1)
STORAGE_DIR=$(find "$RESTORE_DIR" -type d -name "storage" | head -1)

if [ -z "$SQL_DUMP" ]; then
    warn "No SQL dump found in backup archive"
else
    log "Found SQL dump: $SQL_DUMP"
fi

if [ -z "$STORAGE_DIR" ]; then
    warn "No storage directory found in backup archive"
else
    log "Found storage dir: $STORAGE_DIR"
fi

# ---- Confirm ----
echo ""
warn "This will REPLACE the current database and storage files!"
read -p "Continue? (yes/no): " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 0; }

# ---- Ensure services are running ----
cd "$APP_DIR"
docker compose -f "$COMPOSE_FILE" up -d postgres
sleep 5

# Wait for postgres
for i in $(seq 1 20); do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${OMNEX_DB_USER:-omnex}" >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

# ---- Restore database ----
if [ -n "$SQL_DUMP" ]; then
    log "Restoring database..."
    DB_NAME="${OMNEX_DB_NAME:-omnex_hub}"
    DB_USER="${OMNEX_DB_USER:-omnex}"

    # Drop and recreate database
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"

    # Restore from dump
    if [[ "$SQL_DUMP" == *.dump ]]; then
        docker compose -f "$COMPOSE_FILE" exec -T postgres \
            pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges < "$SQL_DUMP"
    else
        docker compose -f "$COMPOSE_FILE" exec -T postgres \
            psql -U "$DB_USER" -d "$DB_NAME" < "$SQL_DUMP"
    fi

    log "Database restored"
fi

# ---- Restore storage files ----
if [ -n "$STORAGE_DIR" ]; then
    log "Restoring storage files..."

    # Get the container's storage volume path
    CONTAINER_ID=$(docker compose -f "$COMPOSE_FILE" ps -q app 2>/dev/null)
    if [ -n "$CONTAINER_ID" ]; then
        docker cp "$STORAGE_DIR/." "$CONTAINER_ID:/var/www/html/storage/"
        docker compose -f "$COMPOSE_FILE" exec -T app chown -R www-data:www-data /var/www/html/storage
    else
        warn "App container not running, starting it..."
        docker compose -f "$COMPOSE_FILE" up -d app
        sleep 5
        CONTAINER_ID=$(docker compose -f "$COMPOSE_FILE" ps -q app)
        docker cp "$STORAGE_DIR/." "$CONTAINER_ID:/var/www/html/storage/"
        docker compose -f "$COMPOSE_FILE" exec -T app chown -R www-data:www-data /var/www/html/storage
    fi

    log "Storage files restored"
fi

# ---- Run migrations (apply any pending) ----
log "Running pending migrations..."
docker compose -f "$COMPOSE_FILE" exec -T app php /var/www/html/tools/postgresql/migrate_seed.php || true

# ---- Restart services ----
log "Restarting all services..."
docker compose -f "$COMPOSE_FILE" restart

# ---- Health check ----
log "Running health check..."
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    log "Health check passed!"
else
    warn "Health check returned HTTP $HTTP_CODE - check logs"
fi

# ---- Cleanup ----
rm -rf "$RESTORE_DIR"
log "Temporary files cleaned up"

echo ""
echo "================================================"
echo "  Backup restore completed!"
echo "================================================"
echo ""
echo "  Database: $([ -n "$SQL_DUMP" ] && echo "Restored" || echo "Skipped")"
echo "  Storage:  $([ -n "$STORAGE_DIR" ] && echo "Restored" || echo "Skipped")"
echo "================================================"
