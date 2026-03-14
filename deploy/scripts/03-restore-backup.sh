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
#   bash 03-restore-backup.sh /path/to/backup.tar.gz --yes   # Skip confirmation
#   bash 03-restore-backup.sh /path/to/backup.tar.gz --dry-run  # Test without changes
# ========================================

set -euo pipefail

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  Omnex Display Hub - Backup Restore${NC}"
echo -e "${CYAN}================================================${NC}"

# ---- Parse Arguments ----
BACKUP_FILE=""
PROJECT_DIR=""
DEPLOY_MODE=""
SKIP_CONFIRM=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --project-dir)  PROJECT_DIR="$2"; shift 2 ;;
        --mode)         DEPLOY_MODE="$2"; shift 2 ;;
        --yes|-y)       SKIP_CONFIRM=true; shift ;;
        --dry-run)      DRY_RUN=true; shift ;;
        --help|-h)
            echo "Usage: $0 BACKUP_FILE [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --project-dir DIR   Project directory (auto-detected if omitted)"
            echo "  --mode MODE         Deploy mode: standalone or multi"
            echo "  --yes, -y           Skip confirmation prompt"
            echo "  --dry-run           Extract and validate only, don't restore"
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

# ---- Verify Archive Integrity ----
log "Verifying archive integrity..."
if ! tar -tzf "$BACKUP_FILE" >/dev/null 2>&1; then
    error "Archive is corrupted or invalid: $BACKUP_FILE"
fi
log "Archive integrity OK"

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
echo "  Project:  $PROJECT_NAME"
echo "  Mode:     $DEPLOY_MODE"
echo "  Database: $DB_NAME"
echo "  Backup:   $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"
if $DRY_RUN; then
    echo -e "  Mode:     ${YELLOW}DRY RUN (no changes will be made)${NC}"
fi
echo ""

# ---- Extract Backup ----
log "Extracting backup to $RESTORE_DIR..."
mkdir -p "$RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"

# ---- Find Components ----
SQL_DUMP=$(find "$RESTORE_DIR" -maxdepth 2 -name "*.sql" -o -name "*.dump" | head -1)
STORAGE_DIR=$(find "$RESTORE_DIR" -maxdepth 2 -type d -name "storage" | head -1)
BACKUP_INFO=$(find "$RESTORE_DIR" -maxdepth 2 -name "backup-info.json" | head -1)

# ---- Show Backup Info ----
if [ -n "$BACKUP_INFO" ]; then
    log "Backup metadata:"
    cat "$BACKUP_INFO" 2>/dev/null || true
    echo ""
fi

if [ -z "$SQL_DUMP" ]; then
    warn "No SQL dump found in backup archive"
else
    SQL_SIZE=$(du -sh "$SQL_DUMP" | cut -f1)
    SQL_LINES=$(wc -l < "$SQL_DUMP")
    log "Found SQL dump: $SQL_SIZE ($SQL_LINES lines)"
fi

if [ -z "$STORAGE_DIR" ]; then
    warn "No storage directory found in backup archive"
else
    STORAGE_SIZE=$(du -sh "$STORAGE_DIR" | cut -f1)
    STORAGE_FILES=$(find "$STORAGE_DIR" -type f | wc -l)
    log "Found storage: $STORAGE_SIZE ($STORAGE_FILES files)"
fi

# ---- Dry Run: Stop Here ----
if $DRY_RUN; then
    echo ""
    log "Dry run complete. Archive is valid and contains:"
    [ -n "$SQL_DUMP" ] && log "  - Database: $SQL_SIZE ($SQL_LINES lines)"
    [ -n "$STORAGE_DIR" ] && log "  - Storage: $STORAGE_SIZE ($STORAGE_FILES files)"
    [ -n "$BACKUP_INFO" ] && log "  - Metadata: backup-info.json"
    rm -rf "$RESTORE_DIR"
    log "No changes were made."
    exit 0
fi

# ---- Confirm ----
if ! $SKIP_CONFIRM; then
    echo ""
    warn "This will REPLACE the current database and storage files!"
    warn "Project: $PROJECT_NAME | Database: $DB_NAME"
    read -p "Continue? (yes/no): " CONFIRM
    [ "$CONFIRM" = "yes" ] || { echo "Aborted."; rm -rf "$RESTORE_DIR"; exit 0; }
fi

# ---- Ensure PostgreSQL is Running ----
cd "$PROJECT_DIR"
log "Ensuring PostgreSQL is running..."
$COMPOSE_CMD up -d postgres
sleep 3

# Wait for postgres (max 40 seconds)
PG_READY=false
for i in $(seq 1 20); do
    if $COMPOSE_CMD exec -T postgres pg_isready -U "$DB_USER" >/dev/null 2>&1; then
        PG_READY=true
        break
    fi
    sleep 2
done

if ! $PG_READY; then
    error "PostgreSQL failed to become ready after 40 seconds"
fi
log "PostgreSQL is ready"

# ---- Pre-Restore: Stop App to Prevent Connections ----
log "Stopping app container to prevent database connections..."
$COMPOSE_CMD stop app 2>/dev/null || true

# ---- Restore Database ----
RESTORE_ERRORS=""
if [ -n "$SQL_DUMP" ]; then
    log "Restoring database: $DB_NAME ..."

    # Terminate existing connections to the database
    $COMPOSE_CMD exec -T postgres \
        psql -U "$DB_USER" -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
        >/dev/null 2>&1 || true

    # Drop and recreate database
    $COMPOSE_CMD exec -T postgres \
        psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>&1
    $COMPOSE_CMD exec -T postgres \
        psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>&1

    # Restore from dump
    if [[ "$SQL_DUMP" == *.dump ]]; then
        # Custom format - use pg_restore
        $COMPOSE_CMD exec -T postgres \
            pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges \
            < "$SQL_DUMP" 2>/tmp/restore_errors.txt || true
    else
        # Plain SQL format - use psql
        # --single-transaction ensures atomic restore (all or nothing)
        $COMPOSE_CMD exec -T postgres \
            psql -U "$DB_USER" -d "$DB_NAME" --single-transaction \
            < "$SQL_DUMP" 2>/tmp/restore_errors.txt || true
    fi

    # Check for real errors (filter out NOTICEs and harmless warnings)
    if [ -f /tmp/restore_errors.txt ] && [ -s /tmp/restore_errors.txt ]; then
        REAL_ERRORS=$(grep -c "^ERROR:" /tmp/restore_errors.txt 2>/dev/null || echo "0")
        if [ "$REAL_ERRORS" -gt 0 ]; then
            warn "Database restore completed with $REAL_ERRORS error(s):"
            grep "^ERROR:" /tmp/restore_errors.txt | head -10
            RESTORE_ERRORS="$REAL_ERRORS SQL error(s)"
        fi
        rm -f /tmp/restore_errors.txt
    fi

    # Verify restore by counting tables
    TABLE_COUNT=$($COMPOSE_CMD exec -T postgres \
        psql -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT COUNT(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema');" 2>/dev/null | tr -d ' ')

    if [ -z "$TABLE_COUNT" ] || [ "$TABLE_COUNT" -eq 0 ]; then
        error "Database restore failed - no tables found!"
    fi

    log "Database restored: $TABLE_COUNT tables"

    # Show key row counts
    $COMPOSE_CMD exec -T postgres \
        psql -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 'companies' as table_name, COUNT(*) FROM core.companies
        UNION ALL SELECT 'users', COUNT(*) FROM core.users
        UNION ALL SELECT 'products', COUNT(*) FROM catalog.products
        UNION ALL SELECT 'templates', COUNT(*) FROM labels.templates
        UNION ALL SELECT 'devices', COUNT(*) FROM devices.devices
        UNION ALL SELECT 'media', COUNT(*) FROM media.media
        ORDER BY table_name;" 2>/dev/null || true
fi

# ---- Restore Storage ----
if [ -n "$STORAGE_DIR" ]; then
    log "Restoring storage files..."

    # Start app if not running (needed for docker cp)
    CONTAINER_ID=$($COMPOSE_CMD ps -q app 2>/dev/null || true)
    if [ -z "$CONTAINER_ID" ]; then
        log "Starting app container for file copy..."
        $COMPOSE_CMD up -d app
        sleep 5
        CONTAINER_ID=$($COMPOSE_CMD ps -q app 2>/dev/null || true)
    fi

    if [ -n "$CONTAINER_ID" ]; then
        docker cp "$STORAGE_DIR/." "$CONTAINER_ID:/var/www/html/storage/"
        $COMPOSE_CMD exec -T app chown -R www-data:www-data /var/www/html/storage
        log "Storage files restored ($STORAGE_FILES files)"
    else
        warn "App container not available - storage restore skipped"
    fi
fi

# ---- Run Migrations ----
log "Running pending migrations..."
$COMPOSE_CMD up -d app 2>/dev/null || true
sleep 3
$COMPOSE_CMD exec -T app php /var/www/html/tools/postgresql/migrate_seed.php 2>&1 || {
    warn "Migration script returned non-zero (may be OK if no pending migrations)"
}

# ---- Restart Services ----
log "Restarting all services..."
$COMPOSE_CMD restart

# ---- Health Check ----
log "Running health check..."
sleep 5
HEALTH_OK=false
for i in $(seq 1 6); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${APP_PORT}/api/health" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        HEALTH_OK=true
        break
    fi
    sleep 3
done

# ---- Cleanup ----
rm -rf "$RESTORE_DIR"
log "Temporary files cleaned up"

# ---- Summary ----
echo ""
echo -e "${CYAN}================================================${NC}"
if $HEALTH_OK; then
    echo -e "${GREEN}  Backup restore completed successfully!${NC}"
else
    echo -e "${YELLOW}  Backup restore completed with warnings${NC}"
fi
echo -e "${CYAN}================================================${NC}"
echo ""
echo "  Project:  $PROJECT_NAME"
echo "  Database: $([ -n "$SQL_DUMP" ] && echo "Restored ($TABLE_COUNT tables)" || echo "Skipped")"
echo "  Storage:  $([ -n "$STORAGE_DIR" ] && echo "Restored ($STORAGE_FILES files)" || echo "Skipped")"
if [ -n "$RESTORE_ERRORS" ]; then
    echo -e "  Errors:   ${YELLOW}${RESTORE_ERRORS}${NC}"
fi
echo "  Health:   $(if $HEALTH_OK; then echo -e "${GREEN}OK${NC}"; else echo -e "${YELLOW}HTTP $HTTP_CODE - check logs${NC}"; fi)"
echo "  Admin:    http://localhost:${APP_PORT}"
echo ""
echo -e "${CYAN}================================================${NC}"
echo ""
