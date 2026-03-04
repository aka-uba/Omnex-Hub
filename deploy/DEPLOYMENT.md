# Omnex Display Hub - Production Deployment Guide

## Prerequisites

- Ubuntu 24.04 LTS server (min 2GB RAM, 20GB disk)
- Domain name pointing to server IP
- GitHub repository access

---

## Deployment Modes

Omnex Display Hub supports two deployment modes:

| Mode | Use Case | Components |
|------|----------|------------|
| **Standalone** | Single server, single project | PostgreSQL + App + Nginx + Certbot |
| **Multi-project** | Multiple stacks on same server | PostgreSQL + App + Shared Traefik Proxy |

---

## 1. Server Preparation

### 1.1 Initial Setup

SSH into your server as root and run:

```bash
# Clone the repository
git clone https://github.com/aka-uba/Omnex-Hub.git /opt/omnex-hub
cd /opt/omnex-hub

# Run initial setup
sudo bash deploy/scripts/01-initial-setup.sh
```

This script will:
- Install Docker CE + Compose plugin
- Create `deploy` user with Docker access
- Create `/opt/omnex-hub` and `/opt/omnex-backups` directories
- Create shared Docker network `omnex-proxy` (for multi-project)
- Harden SSH (port 2222, key-only auth)
- Configure UFW firewall (80, 443, 2222)
- Set up Fail2Ban
- Apply kernel security parameters
- Create 4GB swap

### 1.2 SSH Key Setup

```bash
# Add your SSH public key for the deploy user
echo 'ssh-rsa YOUR_PUBLIC_KEY' >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

# Restart SSH and test new port
systemctl restart sshd
ssh -p 2222 deploy@YOUR_SERVER_IP

# Once confirmed, remove old SSH port
ufw delete allow 22/tcp
```

---

## 2. GitHub Secrets

Go to your GitHub repository > Settings > Secrets and variables > Actions, and add:

| Secret | Value |
|--------|-------|
| `SERVER_HOST` | Your server IP address |
| `SSH_PRIVATE_KEY` | Contents of deploy user's private key |
| `SSH_PORT` | `2222` |

### Generate SSH key pair for deploy:

```bash
ssh-keygen -t ed25519 -f omnex-deploy-key -C "omnex-deploy"
# Add public key to server:
cat omnex-deploy-key.pub >> /home/deploy/.ssh/authorized_keys
# Add private key content to GitHub SECRET: SSH_PRIVATE_KEY
cat omnex-deploy-key
```

---

## 3. Standalone Deployment (Single Server)

Best for: Single installation, one domain, simple setup.

### 3.1 Configure Environment

```bash
su - deploy
cd /opt/omnex-hub

# Create environment file
cp deploy/.env.example deploy/.env
nano deploy/.env
```

**Required changes in `.env`:**
- `COMPOSE_PROJECT_NAME=omnex` (keep default)
- `DEPLOY_MODE=standalone`
- `OMNEX_DB_PASS` - Strong database password
- `OMNEX_JWT_SECRET` - Random 64-char string (`openssl rand -hex 32`)
- `OMNEX_ADMIN_PASSWORD` - Admin account password
- `OMNEX_DOMAIN` - Your domain name

### 3.2 Deploy

```bash
bash deploy/scripts/02-deploy-app.sh --mode standalone
```

This will:
- Build Docker images
- Start PostgreSQL + App + Nginx + Certbot
- Obtain SSL certificate via Let's Encrypt
- Run database migrations
- Verify health check

### Architecture (Standalone)

```
Internet
    |
    v
nginx:443 (SSL termination, rate limiting, security headers)
    |
    v
app:80 (PHP 8.4 + Apache, application logic)
    |
    v
postgres:5432 (PostgreSQL 18, 11 schemas, RLS)
```

---

## 4. Multi-Project Deployment

Best for: Multiple customers/stacks on one server, domain-based routing.

### 4.1 Architecture (Multi-Project)

```
Internet
    |
    v
Traefik:443 (shared reverse proxy, auto SSL, domain routing)
    |
    +---> panel.example.com      --> Stack "panel"     (postgres + app)
    +---> customer-a.example.com --> Stack "customer-a" (postgres + app)
    +---> customer-b.example.com --> Stack "customer-b" (postgres + app)
```

Each stack gets:
- Its own PostgreSQL database (fully isolated)
- Its own app container
- Its own storage volume
- Automatic HTTPS via Let's Encrypt
- Domain-based routing via Traefik labels

### 4.2 Start Shared Proxy

```bash
su - deploy
cd /opt/omnex-hub

# Configure proxy
cp deploy/proxy/.env.example deploy/proxy/.env
nano deploy/proxy/.env
```

**Required in proxy `.env`:**
- `ACME_EMAIL` - Email for Let's Encrypt notifications
- `PROXY_DOMAIN` - Base domain (dashboard at `traefik.PROXY_DOMAIN`)
- `DASHBOARD_AUTH` - htpasswd hash (`htpasswd -nB admin`)

```bash
# Start the shared Traefik proxy
bash deploy/scripts/05-proxy-setup.sh
```

### 4.3 Deploy First Stack

```bash
# Create stack directory
mkdir -p /opt/stacks/panel
cp -r deploy/* /opt/stacks/panel/

# Configure stack
cd /opt/stacks/panel
cp .env.example .env
nano .env
```

**Stack `.env` settings:**
```env
COMPOSE_PROJECT_NAME=panel
DEPLOY_MODE=multi
OMNEX_DOMAIN=panel.example.com
APP_PORT=8081
OMNEX_DB_NAME=omnex_panel
OMNEX_DB_PASS=unique_strong_password_1
OMNEX_JWT_SECRET=unique_random_64_chars_1
```

```bash
bash scripts/02-deploy-app.sh --mode multi --project-dir /opt/stacks/panel
```

### 4.4 Deploy Additional Stacks

```bash
# Customer A stack
mkdir -p /opt/stacks/customer-a
cp -r /opt/omnex-hub/deploy/* /opt/stacks/customer-a/
cd /opt/stacks/customer-a
cp .env.example .env
nano .env
```

**Customer A `.env`:**
```env
COMPOSE_PROJECT_NAME=customer-a
DEPLOY_MODE=multi
OMNEX_DOMAIN=customer-a.example.com
APP_PORT=8082
OMNEX_DB_NAME=omnex_customer_a
OMNEX_DB_PASS=unique_strong_password_2
OMNEX_JWT_SECRET=unique_random_64_chars_2
```

```bash
bash scripts/02-deploy-app.sh --mode multi --project-dir /opt/stacks/customer-a
```

### 4.5 Port Allocation

Each stack needs a unique `APP_PORT` for localhost admin access:

| Stack | APP_PORT | Domain |
|-------|----------|--------|
| panel | 8081 | panel.example.com |
| customer-a | 8082 | customer-a.example.com |
| customer-b | 8083 | customer-b.example.com |

---

## 5. SSL Certificate

### Standalone Mode

Set `OMNEX_DOMAIN=yourdomain.com` in `.env`. The deploy script handles Certbot automatically. Certificates auto-renew every 12 hours via the certbot container.

### Multi-Project Mode

Traefik handles SSL automatically via Let's Encrypt. No manual certificate management needed. Certificates are stored in the `traefik_letsencrypt` Docker volume.

### Manual renewal (standalone only)

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.standalone.yml \
  run --rm certbot certbot renew
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.standalone.yml \
  restart nginx
```

---

## 6. Backup & Restore

### Automated Backup

```bash
# Backup current project (auto-detects directory)
bash deploy/scripts/04-backup.sh

# Backup specific stack
bash deploy/scripts/04-backup.sh --project-dir /opt/stacks/customer-a

# Custom backup directory and retention
bash deploy/scripts/04-backup.sh --backup-dir /mnt/backups --retention 7
```

**What gets backed up:**
- Full PostgreSQL dump
- Storage volume (media, renders, uploads)
- Environment snapshot (passwords masked)
- Nginx config snapshot
- Backup metadata (JSON)

**Retention:** 5 days by default (configurable with `--retention`)

### Cron Setup (Recommended)

```bash
# Daily backup at 3:00 AM - add to deploy user's crontab
crontab -e

# Single project
0 3 * * * /opt/omnex-hub/deploy/scripts/04-backup.sh >> /var/log/omnex-backup.log 2>&1

# Multi-project (one line per stack)
0 3 * * * /opt/omnex-hub/deploy/scripts/04-backup.sh --project-dir /opt/stacks/panel >> /var/log/omnex-backup-panel.log 2>&1
0 3 * * * /opt/omnex-hub/deploy/scripts/04-backup.sh --project-dir /opt/stacks/customer-a >> /var/log/omnex-backup-customer-a.log 2>&1
```

### Restore from Backup

```bash
# Restore standalone
bash deploy/scripts/03-restore-backup.sh /opt/omnex-backups/omnex/omnex_20260304_030000.tar.gz

# Restore specific stack
bash deploy/scripts/03-restore-backup.sh \
  /opt/omnex-backups/customer-a/customer-a_20260304_030000.tar.gz \
  --project-dir /opt/stacks/customer-a \
  --mode multi
```

### Backup Directory Structure

```
/opt/omnex-backups/
├── omnex/                              # Default standalone
│   ├── omnex_20260301_030000.tar.gz
│   ├── omnex_20260302_030000.tar.gz
│   └── ...
├── panel/                              # Multi-project: panel stack
│   └── ...
└── customer-a/                         # Multi-project: customer-a stack
    └── ...
```

---

## 7. Continuous Deployment

After initial setup, every push to `main` branch automatically:

1. Triggers GitHub Actions workflow
2. SSH into server
3. Pulls latest code
4. Rebuilds app container
5. Runs migrations
6. Verifies health check

### Manual deploy trigger

Go to GitHub > Actions > "Deploy to Production" > Run workflow

---

## 8. Monitoring

### Health check

```bash
# Standalone
curl http://localhost:8080/api/health

# Multi-project (per stack port)
curl http://localhost:8081/api/health  # panel
curl http://localhost:8082/api/health  # customer-a
```

### View logs

```bash
# Standalone
docker compose -p omnex -f deploy/docker-compose.yml \
  -f deploy/docker-compose.standalone.yml logs -f

# Multi-project (specific stack)
docker compose -p customer-a -f /opt/stacks/customer-a/docker-compose.yml \
  -f /opt/stacks/customer-a/docker-compose.proxy.yml logs -f app

# Traefik proxy logs
cd deploy/proxy && docker compose logs -f
```

### Container status

```bash
# All stacks
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Specific stack
docker compose -p customer-a -f /opt/stacks/customer-a/docker-compose.yml ps

# Proxy status (show connected stacks)
bash deploy/scripts/05-proxy-setup.sh --status
```

---

## 9. Troubleshooting

### App won't start

```bash
# Check app logs
docker compose -p omnex -f deploy/docker-compose.yml logs app --tail=50

# Check if database is accessible
docker compose -p omnex -f deploy/docker-compose.yml exec app php -r "
    require '/var/www/html/config.php';
    \$db = Database::getInstance();
    echo 'DB OK';
"
```

### Database connection issues

```bash
# Check postgres logs
docker compose -p omnex -f deploy/docker-compose.yml logs postgres

# Test connection
docker compose -p omnex -f deploy/docker-compose.yml exec postgres \
  psql -U omnex -d omnex_hub -c "SELECT 1;"
```

### SSL certificate issues (standalone)

```bash
docker compose -p omnex -f deploy/docker-compose.yml \
  -f deploy/docker-compose.standalone.yml \
  run --rm certbot certbot certificates

# Force renewal
docker compose -p omnex -f deploy/docker-compose.yml \
  -f deploy/docker-compose.standalone.yml \
  run --rm certbot certbot renew --force-renewal
```

### Multi-project: Stack not accessible

```bash
# Check Traefik can see the stack
docker network inspect omnex-proxy --format '{{range .Containers}}{{.Name}} {{end}}'

# Check Traefik dashboard
curl -u admin:PASSWORD https://traefik.example.com/api/http/routers

# Check app is healthy
curl http://localhost:APP_PORT/api/health
```

### Reset everything

```bash
# WARNING: deletes all data!
docker compose -p omnex -f deploy/docker-compose.yml down -v
bash deploy/scripts/02-deploy-app.sh
```

---

## 10. File Reference

### Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Base stack: PostgreSQL + App |
| `docker-compose.standalone.yml` | Overlay: Adds Nginx + Certbot |
| `docker-compose.proxy.yml` | Overlay: Adds Traefik labels + shared network |
| `docker-compose.local.yml` | Local testing (independent) |
| `proxy/docker-compose.yml` | Shared Traefik reverse proxy |

### Scripts

| Script | Purpose |
|--------|---------|
| `01-initial-setup.sh` | Server preparation (Docker, firewall, SSH) |
| `02-deploy-app.sh` | Application deployment (standalone/multi) |
| `03-restore-backup.sh` | Restore from backup archive |
| `04-backup.sh` | Automated backup with retention |
| `05-proxy-setup.sh` | Shared Traefik proxy management |

### Services

| Service | Image | Memory Limit | Purpose |
|---------|-------|-------------|---------|
| postgres | postgres:18-alpine | 2GB | Database |
| app | Custom PHP 8.4 Apache | 4GB | Application |
| nginx | nginx:alpine | - | Reverse proxy (standalone) |
| certbot | certbot/certbot | - | SSL certificates (standalone) |
| traefik | traefik:v3.3 | 512MB | Reverse proxy (multi-project) |

### Security Features

- SSH: Key-only auth, port 2222, max 3 retries
- Firewall: UFW deny-all + allow 80/443/2222
- Fail2Ban: SSH + Nginx brute force protection
- Nginx/Traefik: Rate limiting, security headers, HSTS
- App: OPcache, error hiding, CSRF/XSS protection
- Database: RLS multi-tenant isolation
- Docker: Non-root containers, memory limits, log rotation
