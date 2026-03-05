#!/bin/bash
# ========================================
# Omnex Display Hub - Application Deploy
# Supports standalone and multi-project modes
# ========================================
#
# Usage:
#   bash 02-deploy-app.sh                                # Deploy with .env settings
#   bash 02-deploy-app.sh --mode standalone              # Explicit standalone
#   bash 02-deploy-app.sh --mode multi                   # Multi-project (Traefik)
#   bash 02-deploy-app.sh --project-dir /opt/stacks/foo  # Custom project dir
#
# Modes:
#   standalone - nginx + certbot built-in (default, single server)
#   multi      - behind shared Traefik proxy (multi-project)
#
# ========================================

set -euo pipefail

echo "================================================"
echo "  Omnex Display Hub - Application Deploy"
echo "================================================"

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---- Defaults ----
PROJECT_DIR=""
DEPLOY_MODE=""

# ---- Parse Arguments ----
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode)         DEPLOY_MODE="$2"; shift 2 ;;
        --project-dir)  PROJECT_DIR="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --mode MODE         Deploy mode: standalone (default) or multi"
            echo "  --project-dir DIR   Project directory (default: /opt/omnex-hub)"
            echo "  --help              Show this help"
            exit 0
            ;;
        *) error "Unknown option: $1" ;;
    esac
done

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
ENV_FILE="$PROJECT_DIR/.env"

# ---- Pre-checks ----
[ -d "$PROJECT_DIR" ] || error "Project directory not found: $PROJECT_DIR"
[ -f "$COMPOSE_FILE" ] || error "docker-compose.yml not found: $COMPOSE_FILE"

if [ ! -f "$ENV_FILE" ]; then
    error "Environment file not found: $ENV_FILE\nCopy .env.example to .env and configure it."
fi

# ---- Load Environment ----
set -a
source "$ENV_FILE"
set +a

log "Environment loaded from $ENV_FILE"

# ---- Resolve Deploy Mode ----
DEPLOY_MODE="${DEPLOY_MODE:-${DEPLOY_MODE:-standalone}}"
if [[ "$DEPLOY_MODE" != "standalone" && "$DEPLOY_MODE" != "multi" ]]; then
    error "Invalid deploy mode: $DEPLOY_MODE. Use 'standalone' or 'multi'"
fi

# ---- Resolve Project Name ----
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-omnex}"
DOMAIN="${OMNEX_DOMAIN:-}"
APP_PORT="${APP_PORT:-8080}"

echo ""
echo -e "${CYAN}  Mode:    $DEPLOY_MODE${NC}"
echo -e "${CYAN}  Project: $PROJECT_NAME${NC}"
echo -e "${CYAN}  Domain:  ${DOMAIN:-localhost}${NC}"
echo -e "${CYAN}  Port:    $APP_PORT (localhost admin)${NC}"
echo -e "${CYAN}  Dir:     $PROJECT_DIR${NC}"
echo ""

# ---- Build Compose Command ----
COMPOSE_CMD="docker compose -p $PROJECT_NAME -f $COMPOSE_FILE"

if [ "$DEPLOY_MODE" = "standalone" ]; then
    STANDALONE_FILE="$PROJECT_DIR/docker-compose.standalone.yml"
    [ -f "$STANDALONE_FILE" ] || error "Standalone overlay not found: $STANDALONE_FILE"
    COMPOSE_CMD="$COMPOSE_CMD -f $STANDALONE_FILE"
    log "Mode: Standalone (nginx + certbot)"
elif [ "$DEPLOY_MODE" = "multi" ]; then
    PROXY_FILE="$PROJECT_DIR/docker-compose.proxy.yml"
    [ -f "$PROXY_FILE" ] || error "Proxy overlay not found: $PROXY_FILE"
    COMPOSE_CMD="$COMPOSE_CMD -f $PROXY_FILE"
    log "Mode: Multi-project (Traefik)"

    # Verify shared proxy network exists
    if ! docker network inspect omnex-proxy >/dev/null 2>&1; then
        error "Shared proxy network 'omnex-proxy' not found.\nRun proxy setup first: bash 05-proxy-setup.sh"
    fi

    # Verify domain is set
    [ -n "$DOMAIN" ] || error "OMNEX_DOMAIN is required in multi-project mode"
fi

# ---- Stop Existing Containers ----
log "Stopping existing containers..."
cd "$PROJECT_DIR"
$COMPOSE_CMD down --remove-orphans 2>/dev/null || true

# ---- SSL Bootstrap (Standalone Only) ----
if [ "$DEPLOY_MODE" = "standalone" ]; then
    CERT_DIR="$PROJECT_DIR/ssl"
    mkdir -p "$CERT_DIR"

    # Nginx starts with this fallback cert, then real LE cert can overwrite it.
    if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
        warn "No local SSL cert found. Generating fallback self-signed certificate..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$CERT_DIR/privkey.pem" \
            -out "$CERT_DIR/fullchain.pem" \
            -subj "/CN=${DOMAIN:-localhost}" 2>/dev/null
        log "Fallback certificate created: $CERT_DIR/fullchain.pem"
    fi
fi

# ---- Build and Start ----
log "Building application..."
$COMPOSE_CMD build app

log "Starting all services..."
$COMPOSE_CMD up -d

# ---- Let's Encrypt (Standalone Only) ----
if [ "$DEPLOY_MODE" = "standalone" ] && [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    if [[ "${OMNEX_ADMIN_EMAIL:-}" == *"@omnex.local" ]] || [[ "${OMNEX_ADMIN_EMAIL:-}" == "admin@example.com" ]] || [[ "${OMNEX_ADMIN_EMAIL:-}" == "" ]]; then
        warn "OMNEX_ADMIN_EMAIL appears to be placeholder; Let's Encrypt may reject notifications."
    fi

    log "Requesting/renewing Let's Encrypt certificate for $DOMAIN..."
    if $COMPOSE_CMD run --rm certbot sh -c "certbot certonly --webroot -w /var/www/certbot -d '$DOMAIN' --email '${OMNEX_ADMIN_EMAIL:-admin@example.com}' --agree-tos --no-eff-email && cp '/etc/letsencrypt/live/$DOMAIN/fullchain.pem' /ssl/fullchain.pem && cp '/etc/letsencrypt/live/$DOMAIN/privkey.pem' /ssl/privkey.pem"; then
        log "Let's Encrypt certificate installed to deploy/ssl"
        $COMPOSE_CMD exec -T nginx nginx -s reload >/dev/null 2>&1 || $COMPOSE_CMD restart nginx
    else
        warn "Let's Encrypt certificate request failed. Fallback self-signed certificate remains active."
    fi
fi

# ---- Wait for Database ----
log "Waiting for database..."
for i in $(seq 1 30); do
    if $COMPOSE_CMD exec -T postgres pg_isready -U "${OMNEX_DB_USER:-omnex}" >/dev/null 2>&1; then
        log "Database is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Database failed to start"
    fi
    sleep 2
done

# ---- Run Migrations ----
log "Running database migrations..."
$COMPOSE_CMD exec -T app php /var/www/html/tools/postgresql/migrate_seed.php || {
    warn "Migration had warnings (may be first run)"
}

# ---- FFmpeg Check ----
log "Checking ffmpeg in app container..."
if $COMPOSE_CMD exec -T app ffmpeg -version >/dev/null 2>&1; then
    log "ffmpeg is available"
else
    error "ffmpeg is not available in app container"
fi

# ---- Health Check ----
log "Running health check..."
MAX_RETRIES=30
for i in $(seq 1 $MAX_RETRIES); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${APP_PORT}/api/health" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        log "Health check passed!"
        curl -s "http://localhost:${APP_PORT}/api/health" | python3 -m json.tool 2>/dev/null || true
        break
    fi
    if [ $i -eq $MAX_RETRIES ]; then
        error "Health check failed after $MAX_RETRIES attempts"
    fi
    echo "  Attempt $i/$MAX_RETRIES - HTTP $HTTP_CODE..."
    sleep 3
done

# ---- Summary ----
echo ""
echo "================================================"
echo -e "${GREEN}  Deploy completed successfully!${NC}"
echo "================================================"
echo ""
echo "  Mode:    $DEPLOY_MODE"
echo "  Project: $PROJECT_NAME"
echo "  Admin:   http://localhost:${APP_PORT}"
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    echo "  HTTPS:   https://$DOMAIN"
fi
echo ""
echo "  Containers:"
$COMPOSE_CMD ps
echo ""
echo "  Useful commands:"
echo "    Logs:    $COMPOSE_CMD logs -f"
echo "    Stop:    $COMPOSE_CMD down"
echo "    Restart: $COMPOSE_CMD restart"
echo "    Backup:  bash scripts/04-backup.sh --project-dir $PROJECT_DIR"
echo "================================================"
