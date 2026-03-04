#!/bin/bash
# ========================================
# Omnex Display Hub - Automated Backup
# Full DB dump + storage + env snapshot
# with configurable retention policy
# ========================================
#
# Usage:
#   bash 04-backup.sh                                    # Backup current project
#   bash 04-backup.sh --project-dir /opt/stacks/foo      # Backup specific stack
#   bash 04-backup.sh --backup-dir /mnt/backups          # Custom backup location
#   bash 04-backup.sh --retention 7                      # Keep 7 days (default: 5)
#
# Cron (daily at 03:00):
#   0 3 * * * /opt/omnex-hub/deploy/scripts/04-backup.sh >> /var/log/omnex-backup.log 2>&1
#
# Multi-project cron:
#   0 3 * * * /opt/omnex-hub/deploy/scripts/04-backup.sh --project-dir /opt/stacks/panel >> /var/log/omnex-backup.log 2>&1
#   0 3 * * * /opt/omnex-hub/deploy/scripts/04-backup.sh --project-dir /opt/stacks/customer-a >> /var/log/omnex-backup.log 2>&1
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

# ---- Defaults ----
PROJECT_DIR=""
BACKUP_DIR="/opt/omnex-backups"
RETENTION_DAYS=5

# ---- Parse Arguments ----
while [[ $# -gt 0 ]]; do
    case $1 in
        --project-dir)  PROJECT_DIR="$2"; shift 2 ;;
        --backup-dir)   BACKUP_DIR="$2"; shift 2 ;;
        --retention)    RETENTION_DAYS="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --project-dir DIR   Project directory (auto-detected if omitted)"
            echo "  --backup-dir DIR    Backup storage directory (default: /opt/omnex-backups)"
            echo "  --retention DAYS    Days to keep backups (default: 5)"
            echo "  --help              Show this help"
            exit 0
            ;;
        *) error "Unknown option: $1. Use --help for usage." ;;
    esac
done

# ---- Detect Project Directory ----
if [ -z "$PROJECT_DIR" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    # Script is in deploy/scripts/, project is at deploy/
    CANDIDATE="$(dirname "$SCRIPT_DIR")"

    if [ -f "$CANDIDATE/docker-compose.yml" ]; then
        PROJECT_DIR="$CANDIDATE"
    elif [ -f "./docker-compose.yml" ]; then
        PROJECT_DIR="$(pwd)"
    else
        error "Cannot detect project directory. Use --project-dir"
    fi
fi

[ -d "$PROJECT_DIR" ] || error "Project directory not found: $PROJECT_DIR"

# ---- Find Compose File ----
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
[ -f "$COMPOSE_FILE" ] || error "docker-compose.yml not found: $COMPOSE_FILE"

# ---- Load Environment ----
ENV_FILE="$PROJECT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    set -a; source "$ENV_FILE"; set +a
fi

# ---- Detect Project Name ----
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$(dirname "$PROJECT_DIR")" 2>/dev/null || basename "$PROJECT_DIR")}"
# Sanitize project name for filenames
PROJECT_NAME=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9._-]/-/g')

DB_NAME="${OMNEX_DB_NAME:-omnex_hub}"
DB_USER="${OMNEX_DB_USER:-omnex}"

# ---- Timestamp & Paths ----
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_SUBDIR="$BACKUP_DIR/$PROJECT_NAME"
BACKUP_NAME="${PROJECT_NAME}_${TIMESTAMP}"
TEMP_DIR="/tmp/omnex-backup-${BACKUP_NAME}"

echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  Omnex Display Hub - Backup${NC}"
echo -e "${CYAN}================================================${NC}"
echo "  Project:   $PROJECT_NAME"
echo "  Database:  $DB_NAME"
echo "  Compose:   $COMPOSE_FILE"
echo "  Backup to: $BACKUP_SUBDIR"
echo "  Retention: $RETENTION_DAYS days"
echo "  Time:      $(date)"
echo -e "${CYAN}================================================${NC}"
echo ""

# ---- Create Directories ----
mkdir -p "$BACKUP_SUBDIR" "$TEMP_DIR"

# ---- Check Services ----
cd "$PROJECT_DIR"

# Detect compose command (might need -p for project name)
COMPOSE_CMD="docker compose -f $COMPOSE_FILE"
if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then
    COMPOSE_CMD="docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE"
fi

# Also include standalone overlay if it exists
STANDALONE_FILE="$PROJECT_DIR/docker-compose.standalone.yml"
if [ -f "$STANDALONE_FILE" ]; then
    COMPOSE_CMD="$COMPOSE_CMD -f $STANDALONE_FILE"
fi

# Check if postgres is running
if ! $COMPOSE_CMD exec -T postgres pg_isready -U "$DB_USER" >/dev/null 2>&1; then
    warn "PostgreSQL is not running. Starting it for backup..."
    $COMPOSE_CMD up -d postgres
    sleep 5
    if ! $COMPOSE_CMD exec -T postgres pg_isready -U "$DB_USER" >/dev/null 2>&1; then
        error "PostgreSQL failed to start"
    fi
fi

# ---- 1. PostgreSQL Full Dump ----
log "Dumping PostgreSQL database: $DB_NAME ..."
$COMPOSE_CMD exec -T postgres \
    pg_dump -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-privileges --clean --if-exists \
    > "$TEMP_DIR/database.sql" 2>/dev/null

if [ ! -s "$TEMP_DIR/database.sql" ]; then
    error "Database dump is empty. Backup aborted."
fi

DB_SIZE=$(du -sh "$TEMP_DIR/database.sql" | cut -f1)
DB_LINES=$(wc -l < "$TEMP_DIR/database.sql")
log "Database dump: $DB_SIZE ($DB_LINES lines)"

# ---- 2. Storage Volume ----
log "Backing up storage files..."
CONTAINER_ID=$($COMPOSE_CMD ps -q app 2>/dev/null || true)

if [ -n "$CONTAINER_ID" ]; then
    mkdir -p "$TEMP_DIR/storage"
    docker cp "$CONTAINER_ID:/var/www/html/storage/." "$TEMP_DIR/storage/" 2>/dev/null || {
        warn "Could not copy storage files (container may not be running)"
    }
    STORAGE_SIZE=$(du -sh "$TEMP_DIR/storage" 2>/dev/null | cut -f1 || echo "0")
    STORAGE_FILES=$(find "$TEMP_DIR/storage" -type f 2>/dev/null | wc -l || echo "0")
    log "Storage backup: $STORAGE_SIZE ($STORAGE_FILES files)"
else
    warn "App container not found, skipping storage backup"
    mkdir -p "$TEMP_DIR/storage"
fi

# ---- 3. Environment Snapshot ----
if [ -f "$ENV_FILE" ]; then
    # Mask sensitive values for safety
    sed -E 's/(PASSWORD|SECRET|PASS)=.*/\1=***MASKED***/g' "$ENV_FILE" > "$TEMP_DIR/env.backup"
    log "Environment snapshot saved (passwords masked)"
fi

# ---- 4. Active Nginx Config (if exists) ----
NGINX_CONF="$PROJECT_DIR/nginx/conf.d/default.conf"
if [ -f "$NGINX_CONF" ]; then
    mkdir -p "$TEMP_DIR/config"
    cp "$NGINX_CONF" "$TEMP_DIR/config/nginx-default.conf"
    log "Nginx config backed up"
fi

# ---- 5. Backup Metadata ----
cat > "$TEMP_DIR/backup-info.json" <<METAEOF
{
    "version": "1.0",
    "project": "$PROJECT_NAME",
    "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')",
    "database": {
        "name": "$DB_NAME",
        "user": "$DB_USER",
        "dump_size": "$DB_SIZE",
        "dump_lines": $DB_LINES
    },
    "storage": {
        "size": "${STORAGE_SIZE:-0}",
        "files": ${STORAGE_FILES:-0}
    },
    "host": {
        "hostname": "$(hostname)",
        "kernel": "$(uname -r)"
    },
    "compose_file": "$COMPOSE_FILE",
    "retention_days": $RETENTION_DAYS
}
METAEOF

# ---- 6. Compress Archive ----
log "Compressing backup archive..."
ARCHIVE="$BACKUP_SUBDIR/${BACKUP_NAME}.tar.gz"
tar -czf "$ARCHIVE" -C "$TEMP_DIR" .

ARCHIVE_SIZE=$(du -sh "$ARCHIVE" | cut -f1)
log "Archive created: $ARCHIVE ($ARCHIVE_SIZE)"

# ---- 7. Verify Archive ----
log "Verifying archive integrity..."
if tar -tzf "$ARCHIVE" >/dev/null 2>&1; then
    log "Archive integrity OK"
else
    error "Archive verification failed! Backup may be corrupted."
fi

# ---- 8. Cleanup Temp ----
rm -rf "$TEMP_DIR"

# ---- 9. Retention Policy ----
log "Applying retention policy: keep last $RETENTION_DAYS days..."
DELETED=0
while IFS= read -r old_backup; do
    rm -f "$old_backup"
    log "  Deleted old backup: $(basename "$old_backup")"
    DELETED=$((DELETED + 1))
done < <(find "$BACKUP_SUBDIR" -name "${PROJECT_NAME}_*.tar.gz" -type f -mtime +${RETENTION_DAYS} 2>/dev/null)

if [ $DELETED -gt 0 ]; then
    log "Removed $DELETED old backup(s)"
fi

# ---- 10. Summary ----
BACKUP_COUNT=$(find "$BACKUP_SUBDIR" -name "${PROJECT_NAME}_*.tar.gz" -type f 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_SUBDIR" 2>/dev/null | cut -f1 || echo "0")

echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "${GREEN}  Backup completed successfully!${NC}"
echo -e "${CYAN}================================================${NC}"
echo "  Archive:    $ARCHIVE"
echo "  Size:       $ARCHIVE_SIZE"
echo "  Database:   $DB_SIZE ($DB_LINES lines)"
echo "  Storage:    ${STORAGE_SIZE:-N/A} (${STORAGE_FILES:-0} files)"
echo "  Retention:  $RETENTION_DAYS days"
echo "  Total:      $BACKUP_COUNT backup(s), $TOTAL_SIZE total"
echo -e "${CYAN}================================================${NC}"
echo ""
