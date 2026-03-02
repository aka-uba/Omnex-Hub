#!/bin/bash
# ========================================
# Omnex Display Hub - Application Deploy
# Run as deploy user: bash 02-deploy-app.sh
# ========================================

set -euo pipefail

echo "================================================"
echo "  Omnex Display Hub - Application Deploy"
echo "================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

APP_DIR="/opt/omnex-hub"
COMPOSE_FILE="$APP_DIR/deploy/docker-compose.yml"
ENV_FILE="$APP_DIR/deploy/.env"
DOMAIN="${OMNEX_DOMAIN:-}"

# ---- Pre-checks ----
[ -d "$APP_DIR" ] || error "App directory not found: $APP_DIR"
[ -f "$COMPOSE_FILE" ] || error "docker-compose.yml not found: $COMPOSE_FILE"

if [ ! -f "$ENV_FILE" ]; then
    error "Environment file not found: $ENV_FILE\nCopy deploy/.env.example to deploy/.env and configure it."
fi

# ---- Load env ----
set -a
source "$ENV_FILE"
set +a

log "Environment loaded from $ENV_FILE"

# ---- Stop existing containers ----
log "Stopping existing containers..."
cd "$APP_DIR"
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

# ---- SSL Certificate ----
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
    if [ ! -d "$CERT_DIR" ]; then
        log "Obtaining SSL certificate for $DOMAIN..."

        # Start nginx temporarily for certbot challenge
        docker compose -f "$COMPOSE_FILE" up -d nginx

        docker compose -f "$COMPOSE_FILE" run --rm certbot \
            certbot certonly \
            --webroot \
            -w /var/www/certbot \
            -d "$DOMAIN" \
            --email "${OMNEX_ADMIN_EMAIL:-admin@omnex.local}" \
            --agree-tos \
            --no-eff-email \
            --force-renewal

        docker compose -f "$COMPOSE_FILE" down
        log "SSL certificate obtained for $DOMAIN"
    else
        log "SSL certificate already exists for $DOMAIN"
    fi
else
    warn "No domain configured (OMNEX_DOMAIN). SSL will use self-signed or be disabled."

    # Create self-signed cert for initial setup
    CERT_DIR="/opt/omnex-hub/deploy/ssl"
    if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
        log "Generating self-signed certificate..."
        mkdir -p "$CERT_DIR"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$CERT_DIR/privkey.pem" \
            -out "$CERT_DIR/fullchain.pem" \
            -subj "/CN=localhost" 2>/dev/null
    fi
fi

# ---- Build and start ----
log "Building application..."
docker compose -f "$COMPOSE_FILE" build app

log "Starting all services..."
docker compose -f "$COMPOSE_FILE" up -d

# ---- Wait for database ----
log "Waiting for database..."
for i in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${OMNEX_DB_USER:-omnex}" >/dev/null 2>&1; then
        log "Database is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Database failed to start"
    fi
    sleep 2
done

# ---- Run migrations ----
log "Running database migrations..."
docker compose -f "$COMPOSE_FILE" exec -T app php /var/www/html/tools/postgresql/migrate_seed.php || {
    warn "Migration had warnings (may be first run)"
}

# ---- Health check ----
log "Running health check..."
MAX_RETRIES=30
for i in $(seq 1 $MAX_RETRIES); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        log "Health check passed!"
        curl -s http://localhost:8080/api/health | python3 -m json.tool 2>/dev/null || true
        break
    fi
    if [ $i -eq $MAX_RETRIES ]; then
        error "Health check failed after $MAX_RETRIES attempts"
    fi
    echo "  Attempt $i/$MAX_RETRIES - HTTP $HTTP_CODE..."
    sleep 3
done

echo ""
echo "================================================"
echo "  Deploy completed successfully!"
echo "================================================"
echo ""
echo "  App:   http://localhost:8080"
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    echo "  HTTPS: https://$DOMAIN"
fi
echo ""
echo "  Containers:"
docker compose -f "$COMPOSE_FILE" ps
echo "================================================"
