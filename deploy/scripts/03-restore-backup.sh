#!/bin/bash
# ========================================
# Omnex Display Hub - Backup Restore
# Restores from .tar.gz backup archive
# ========================================
#
# Usage:
#   bash 03-restore-backup.sh /path/to/backup.tar.gz
#   bash 03-restore-backup.sh /path/to/backup.tar.gz --project-dir /opt/stacks/foo
#   bash 03-restore-backup.sh /path/to/backup.tar.gz --mode standalone
#   bash 03-restore-backup.sh /path/to/backup.tar.gz --mode multi
# ========================================

set -euo pipefail

echo "================================================"
echo "  Omnex Display Hub - Backup Restore"
echo "================================================"

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---- Parse Arguments ----
BACKUP_FILE=""
PROJECT_DIR=""
DEPLOY_MODE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --project-dir)  PROJECT_DIR="$2"; shift 2 ;;
        --mode)         DEPLOY_MODE="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: $0 BACKUP_FILE [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --project-dir DIR   Project directory (auto-detected if omitted)"
            echo "  --mode MODE         Deploy mode: standalone or multi"
            echo "  --help              Show this help"
            exit 0
            ;;
        -*)  error "Unknown option: $1" ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$1"
            fi
            shift
            ;;
    esac
done

# ---- Validation ----
[ -n "$BACKUP_FILE" ] || error "Usage: $0 /path/to/backup.tar.gz [OPTIONS]"
[ -f "$BACKUP_FILE" ] || error "Backup file not found: $BACKUP_FILE"

# ---- Detect Project Directory ----
if [ -z "$PROJECT_DIR" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    CANDIDATE="$(dirname "$SCRIPT_DIR")"

    if [ -f "$CANDIDATE/docker-compose.yml" ]; then
        PROJECT_DIR="$CANDIDATE"
    elif [ -f "/opt/omnex-hub/deploy/docker-compose.yml" ]; then
        PROJECT_DIR="/opt/omnex-hub/deploy"
    else
        error "Cannot detect project directory. Use --project-dir"
    fi
fi

COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
[ -f "$COMPOSE_FILE" ] || error "docker-compose.yml not found: $COMPOSE_FILE"

# ---- Load Environment ----
ENV_FILE="$PROJECT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    set -a; source "$ENV_FILE"; set +a
fi

# ---- Resolve Settings ----
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-omnex}"
DEPLOY_MODE="${DEPLOY_MODE:-${DEPLOY_MODE:-standalone}}"
DB_NAME="${OMNEX_DB_NAME:-omnex_hub}"
DB_USER="${OMNEX_DB_USER:-omnex}"
APP_PORT="${APP_PORT:-8080}"
RESTORE_DIR="/tmp/omnex-restore-$(date +%s)"

# ---- Build Compose Command ----
COMPOSE_CMD="docker compose -p $PROJECT_NAME -f $COMPOSE_FILE"
if [ "$DEPLOY_MODE" = "standalone" ]; then
    STANDALONE_FILE="$PROJECT_DIR/docker-compose.standalone.yml"
    [ -f "$STANDALONE_FILE" ] && COMPOSE_CMD="$COMPOSE_CMD -f $STANDALONE_FILE"
elif [ "$DEPLOY_MODE" = "multi" ]; then
    PROXY_FILE="$PROJECT_DIR/docker-compose.proxy.yml"
    [ -f "$PROXY_FILE" ] && COMPOSE_CMD="$COMPOSE_CMD -f $PROXY_FILE"
fi

echo ""
echo "  Project: $PROJECT_NAME"
echo "  Mode:    $DEPLOY_MODE"
echo "  Backup:  $BACKUP_FILE"
echo ""

# ---- Extract Backup ----
log "Extracting backup to $RESTORE_DIR..."
mkdir -p "$RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"

# ---- Find Components ----
SQL_DUMP=$(find "$RESTORE_DIR" -name "*.sql" -o -name "*.dump" | head -1)
STORAGE_DIR=$(find "$RESTORE_DIR" -type d -name "storage" | head -1)
BACKUP_INFO=$(find "$RESTORE_DIR" -name "backup-info.json" | head -1)

if [ -n "$BACKUP_INFO" ]; then
    log "Backup info:"
    cat "$BACKUP_INFO" 2>/dev/null || true
    echo ""
fi

if [ -z "$SQL_DUMP" ]; then
    warn "No SQL dump found in backup archive"
else
    log "Found SQL dump: $SQL_DUMP ($(du -sh "$SQL_DUMP" | cut -f1))"
fi

if [ -z "$STORAGE_DIR" ]; then
    warn "No storage directory found in backup archive"
else
    log "Found storage dir: $STORAGE_DIR ($(du -sh "$STORAGE_DIR" | cut -f1))"
fi

# ---- Confirm ----
echo ""
warn "This will REPLACE the current database and storage files!"
warn "Project: $PROJECT_NAME | Database: $DB_NAME"
read -p "Continue? (yes/no): " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; rm -rf "$RESTORE_DIR"; exit 0; }

# ---- Ensure PostgreSQL is Running ----
cd "$PROJECT_DIR"
$COMPOSE_CMD up -d postgres
sleep 5

# Wait for postgres
for i in $(seq 1 20); do
    if $COMPOSE_CMD exec -T postgres pg_isready -U "$DB_USER" >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

# ---- Restore Database ----
if [ -n "$SQL_DUMP" ]; then
    log "Restoring database: $DB_NAME ..."

    # Drop and recreate database
    $COMPOSE_CMD exec -T postgres \
        psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
    $COMPOSE_CMD exec -T postgres \
        psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"

    # Restore from dump
    if [[ "$SQL_DUMP" == *.dump ]]; then
        $COMPOSE_CMD exec -T postgres \
            pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges < "$SQL_DUMP"
    else
        $COMPOSE_CMD exec -T postgres \
            psql -U "$DB_USER" -d "$DB_NAME" < "$SQL_DUMP"
    fi

    log "Database restored"
fi

# ---- Restore Storage ----
if [ -n "$STORAGE_DIR" ]; then
    log "Restoring storage files..."

    CONTAINER_ID=$($COMPOSE_CMD ps -q app 2>/dev/null)
    if [ -z "$CONTAINER_ID" ]; then
        warn "App container not running, starting it..."
        $COMPOSE_CMD up -d app
        sleep 5
        CONTAINER_ID=$($COMPOSE_CMD ps -q app)
    fi

    docker cp "$STORAGE_DIR/." "$CONTAINER_ID:/var/www/html/storage/"
    $COMPOSE_CMD exec -T app chown -R www-data:www-data /var/www/html/storage

    log "Storage files restored"
fi

# ---- Run Migrations ----
log "Running pending migrations..."
$COMPOSE_CMD exec -T app php /var/www/html/tools/postgresql/migrate_seed.php || true

# ---- Restart Services ----
log "Restarting all services..."
$COMPOSE_CMD restart

# ---- Health Check ----
log "Running health check..."
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${APP_PORT}/api/health" 2>/dev/null || echo "000")
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
echo "  Project:  $PROJECT_NAME"
echo "  Database: $([ -n "$SQL_DUMP" ] && echo "Restored" || echo "Skipped")"
echo "  Storage:  $([ -n "$STORAGE_DIR" ] && echo "Restored" || echo "Skipped")"
echo "  Admin:    http://localhost:${APP_PORT}"
echo "================================================"
