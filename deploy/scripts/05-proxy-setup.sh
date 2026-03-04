#!/bin/bash
# ========================================
# Omnex Display Hub - Shared Proxy Setup
# Starts the Traefik reverse proxy
# Run once per server before deploying stacks
# ========================================
#
# Usage:
#   bash 05-proxy-setup.sh                    # Start proxy
#   bash 05-proxy-setup.sh --stop             # Stop proxy
#   bash 05-proxy-setup.sh --status           # Show proxy status
#   bash 05-proxy-setup.sh --logs             # Show proxy logs
# ========================================

set -euo pipefail

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---- Detect Proxy Directory ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_DIR="$(dirname "$SCRIPT_DIR")/proxy"

[ -d "$PROXY_DIR" ] || error "Proxy directory not found: $PROXY_DIR"
[ -f "$PROXY_DIR/docker-compose.yml" ] || error "Proxy docker-compose.yml not found"

ACTION="${1:-start}"

case "$ACTION" in
    start|--start)
        echo -e "${CYAN}================================================${NC}"
        echo -e "${CYAN}  Omnex Display Hub - Proxy Setup${NC}"
        echo -e "${CYAN}================================================${NC}"

        # Check .env
        if [ ! -f "$PROXY_DIR/.env" ]; then
            warn "No .env file found. Copying from .env.example..."
            if [ -f "$PROXY_DIR/.env.example" ]; then
                cp "$PROXY_DIR/.env.example" "$PROXY_DIR/.env"
                warn "Please edit $PROXY_DIR/.env with your actual values!"
                warn "Required: ACME_EMAIL, PROXY_DOMAIN, DASHBOARD_AUTH"
                echo ""
                read -p "Edit .env now and press Enter to continue, or Ctrl+C to abort..."
            else
                error "No .env.example found in $PROXY_DIR"
            fi
        fi

        # Create shared Docker network (if not exists)
        if ! docker network inspect omnex-proxy >/dev/null 2>&1; then
            log "Creating shared Docker network: omnex-proxy"
            docker network create omnex-proxy
        else
            log "Shared network 'omnex-proxy' already exists"
        fi

        # Start Traefik
        log "Starting Traefik reverse proxy..."
        cd "$PROXY_DIR"
        docker compose up -d

        # Wait for Traefik to be ready
        sleep 3

        # Status
        log "Proxy status:"
        docker compose ps

        echo ""
        echo -e "${GREEN}  Proxy is running!${NC}"
        echo ""

        # Load env for display
        if [ -f "$PROXY_DIR/.env" ]; then
            set -a; source "$PROXY_DIR/.env"; set +a
            echo "  Dashboard: https://traefik.${PROXY_DOMAIN:-localhost}/dashboard/"
        fi

        echo ""
        echo "  Next: Deploy app stacks with --mode multi"
        echo -e "${CYAN}================================================${NC}"
        ;;

    stop|--stop)
        log "Stopping Traefik proxy..."
        cd "$PROXY_DIR"
        docker compose down
        log "Proxy stopped"
        ;;

    status|--status)
        cd "$PROXY_DIR"
        echo -e "${CYAN}Proxy Status:${NC}"
        docker compose ps
        echo ""
        echo -e "${CYAN}Connected Stacks:${NC}"
        docker network inspect omnex-proxy --format '{{range .Containers}}  - {{.Name}}{{"\n"}}{{end}}' 2>/dev/null || echo "  (network not found)"
        ;;

    logs|--logs)
        cd "$PROXY_DIR"
        docker compose logs -f --tail=50
        ;;

    restart|--restart)
        log "Restarting Traefik proxy..."
        cd "$PROXY_DIR"
        docker compose restart
        log "Proxy restarted"
        ;;

    *)
        echo "Usage: $0 [start|stop|status|logs|restart]"
        exit 1
        ;;
esac
