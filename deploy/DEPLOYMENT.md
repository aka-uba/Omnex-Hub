# Omnex Display Hub - Production Deployment Guide

## Prerequisites

- Ubuntu 24.04 LTS server (min 2GB RAM, 20GB disk)
- Domain name pointing to server IP
- GitHub repository access

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
- Harden SSH (port 2222, key-only auth)
- Configure UFW firewall (80, 443, 2222)
- Set up Fail2Ban
- Apply kernel security parameters
- Create 2GB swap

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

## 3. First Deploy

### 3.1 Configure Environment

```bash
# Switch to deploy user
su - deploy
cd /opt/omnex-hub

# Create environment file
cp deploy/.env.example deploy/.env
nano deploy/.env
```

**Required changes in `.env`:**
- `OMNEX_DB_PASSWORD` - Strong database password
- `OMNEX_JWT_SECRET` - Random 64-char string (`openssl rand -hex 32`)
- `OMNEX_ADMIN_PASSWORD` - Admin account password
- `OMNEX_DOMAIN` - Your domain name

### 3.2 Deploy

```bash
bash deploy/scripts/02-deploy-app.sh
```

This will:
- Build Docker images
- Start all services (PostgreSQL, App, Nginx, Certbot)
- Run database migrations
- Obtain SSL certificate
- Verify health check

---

## 4. SSL Certificate

### Automatic (with domain)

Set `OMNEX_DOMAIN=yourdomain.com` in `.env`. The deploy script handles Certbot automatically. Certificates auto-renew every 12 hours via the certbot container.

### Manual renewal

```bash
docker compose -f deploy/docker-compose.yml run --rm certbot certbot renew
docker compose -f deploy/docker-compose.yml restart nginx
```

---

## 5. Continuous Deployment

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

## 6. Backup & Restore

### Create backup

```bash
# Database dump
docker compose -f deploy/docker-compose.yml exec -T postgres \
  pg_dump -U omnex omnex_hub > backup_$(date +%Y%m%d).sql

# Full backup (DB + storage)
mkdir -p /tmp/omnex-backup
docker compose -f deploy/docker-compose.yml exec -T postgres \
  pg_dump -U omnex omnex_hub > /tmp/omnex-backup/database.sql
docker cp $(docker compose -f deploy/docker-compose.yml ps -q app):/var/www/html/storage /tmp/omnex-backup/storage
tar -czf omnex-backup-$(date +%Y%m%d).tar.gz -C /tmp omnex-backup
rm -rf /tmp/omnex-backup
```

### Restore from backup

```bash
bash deploy/scripts/03-restore-backup.sh /path/to/omnex-backup-YYYYMMDD.tar.gz
```

---

## 7. Monitoring

### Health check

```bash
curl http://localhost:8080/api/health
# Expected: {"status":"ok","version":"1.0.52","service":"omnex-display-hub",...}
```

### View logs

```bash
# All services
docker compose -f deploy/docker-compose.yml logs -f

# Specific service
docker compose -f deploy/docker-compose.yml logs -f app
docker compose -f deploy/docker-compose.yml logs -f postgres
docker compose -f deploy/docker-compose.yml logs -f nginx
```

### Container status

```bash
docker compose -f deploy/docker-compose.yml ps
```

---

## 8. Troubleshooting

### App won't start

```bash
# Check app logs
docker compose -f deploy/docker-compose.yml logs app --tail=50

# Check if database is accessible
docker compose -f deploy/docker-compose.yml exec app php -r "
    require '/var/www/html/config.php';
    \$db = Database::getInstance();
    echo 'DB OK';
"
```

### Database connection issues

```bash
# Check postgres logs
docker compose -f deploy/docker-compose.yml logs postgres

# Test connection
docker compose -f deploy/docker-compose.yml exec postgres psql -U omnex -d omnex_hub -c "SELECT 1;"
```

### SSL certificate issues

```bash
# Check certificate status
docker compose -f deploy/docker-compose.yml run --rm certbot certbot certificates

# Force renewal
docker compose -f deploy/docker-compose.yml run --rm certbot certbot renew --force-renewal
docker compose -f deploy/docker-compose.yml restart nginx
```

### Nginx errors

```bash
# Test nginx config
docker compose -f deploy/docker-compose.yml exec nginx nginx -t

# View access/error logs
docker compose -f deploy/docker-compose.yml exec nginx cat /var/log/nginx/error.log
```

### Reset everything

```bash
cd /opt/omnex-hub
docker compose -f deploy/docker-compose.yml down -v  # WARNING: deletes all data!
bash deploy/scripts/02-deploy-app.sh
```

---

## Architecture

```
Internet
    |
    v
nginx:443 (SSL termination, rate limiting, security headers)
    |
    v
app:80 (PHP 8.2 + Apache, application logic)
    |
    v
postgres:5432 (PostgreSQL 18, 11 schemas, RLS)
```

### Services

| Service | Image | Purpose |
|---------|-------|---------|
| postgres | postgres:18-alpine | Database (512MB limit) |
| app | Custom PHP 8.2 Apache | Application (1GB limit) |
| nginx | nginx:alpine | Reverse proxy + SSL |
| certbot | certbot/certbot | SSL certificate management |

### Security Features

- SSH: Key-only auth, port 2222, max 3 retries
- Firewall: UFW deny-all + allow 80/443/2222
- Fail2Ban: SSH + Nginx brute force protection
- Nginx: Rate limiting, security headers, HSTS
- App: OPcache, error hiding, CSRF/XSS protection
- Database: RLS multi-tenant isolation, encrypted connections
- Docker: Non-root containers, memory limits, log rotation
