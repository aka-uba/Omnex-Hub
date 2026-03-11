#!/bin/bash
# ========================================
# Omnex Display Hub - Server Initial Setup
# Ubuntu 24.04 LTS
# Run as root: sudo bash 01-initial-setup.sh
# ========================================

set -euo pipefail

echo "================================================"
echo "  Omnex Display Hub - Server Initial Setup"
echo "================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check root
[ "$(id -u)" -eq 0 ] || error "This script must be run as root (sudo)"

# ---- System Update ----
log "Updating system packages..."
apt-get update && apt-get upgrade -y
apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    ffmpeg \
    htop \
    ufw \
    fail2ban \
    logrotate \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# ---- Docker CE ----
log "Installing Docker CE..."
if ! command -v docker &>/dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    log "Docker installed successfully"
else
    log "Docker already installed: $(docker --version)"
fi

# ---- Deploy User ----
log "Creating deploy user..."
if ! id "deploy" &>/dev/null; then
    useradd -m -s /bin/bash -G docker deploy
    mkdir -p /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    chown -R deploy:deploy /home/deploy/.ssh
    log "User 'deploy' created and added to docker group"
else
    usermod -aG docker deploy
    log "User 'deploy' already exists, ensured docker group membership"
fi

# ---- Application Directories ----
log "Creating application directories..."
mkdir -p /opt/omnex-hub
mkdir -p /opt/omnex-backups
chown deploy:deploy /opt/omnex-hub /opt/omnex-backups

# ---- Shared Docker Network (for multi-project) ----
log "Creating shared Docker network..."
if ! docker network inspect omnex-proxy >/dev/null 2>&1; then
    docker network create omnex-proxy
    log "Shared network 'omnex-proxy' created"
else
    log "Shared network 'omnex-proxy' already exists"
fi

# ---- SSH Hardening ----
log "Hardening SSH configuration..."
SSH_CONFIG="/etc/ssh/sshd_config"
cp "$SSH_CONFIG" "${SSH_CONFIG}.backup.$(date +%Y%m%d)"

# Custom SSH config
cat > /etc/ssh/sshd_config.d/omnex-hardening.conf <<'SSHEOF'
# Omnex SSH Hardening
Port 2299
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
MaxSessions 5
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowTcpForwarding no
AllowUsers deploy camlicayazilim
SSHEOF

warn "SSH port will change to 2299. Make sure you add SSH keys BEFORE restarting SSH!"
warn "Required for BOTH users:"
warn "  echo 'YOUR_KEY' >> /home/deploy/.ssh/authorized_keys"
warn "  echo 'YOUR_KEY' >> /home/camlicayazilim/.ssh/authorized_keys"
warn "PasswordAuthentication is DISABLED - key-based auth only!"

# ---- UFW Firewall ----
log "Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH (keep during transition, remove after 2299 confirmed)'
ufw allow 2299/tcp comment 'SSH (hardened port)'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
echo "y" | ufw enable
log "UFW enabled: ports 22 (transition), 2299, 80, 443 open"

# ---- Fail2Ban ----
log "Configuring Fail2Ban..."
cat > /etc/fail2ban/jail.local <<'F2BEOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = 22,2299
maxretry = 3
bantime = 7200

[nginx-http-auth]
enabled = true
port = http,https

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
F2BEOF

systemctl enable fail2ban
systemctl restart fail2ban
log "Fail2Ban configured"

# ---- Kernel Security ----
log "Applying kernel security parameters..."
cat >> /etc/sysctl.d/99-omnex-security.conf <<'SYSEOF'
# TCP SYN cookie protection
net.ipv4.tcp_syncookies = 1
# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
# Don't send ICMP redirects
net.ipv4.conf.all.send_redirects = 0
# Enable ASLR
kernel.randomize_va_space = 2
# Ignore broadcasts
net.ipv4.icmp_echo_ignore_broadcasts = 1
SYSEOF
sysctl --system

# ---- Docker Logging ----
log "Configuring Docker logging..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DOCKEREOF'
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2"
}
DOCKEREOF
systemctl restart docker

# ---- Logrotate ----
log "Configuring logrotate for application logs..."
cat > /etc/logrotate.d/omnex-hub <<'LOGEOF'
# Omnex Display Hub log rotation
/opt/omnex-hub/deploy/logs/*.log
/opt/omnex-hub/storage/logs/*.log
{
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
    maxsize 50M
}
LOGEOF
log "Logrotate configured (daily, 14 days retention, max 50MB per file)"

# ---- Swap (4GB) ----
log "Setting up swap..."
if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # swappiness=10: RAM oncelikli, swap sadece gerektiginde
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    # cache_pressure=50: inode/dentry cache dengeli tutulur
    sysctl vm.vfs_cache_pressure=50
    echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
    log "4GB swap created (swappiness=10, cache_pressure=50)"
else
    log "Swap already exists"
fi

echo ""
echo "================================================"
echo "  Initial setup complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Add SSH public keys for BOTH users:"
echo "     echo 'DEPLOY_KEY' >> /home/deploy/.ssh/authorized_keys"
echo "     chown deploy:deploy /home/deploy/.ssh/authorized_keys"
echo "     chmod 600 /home/deploy/.ssh/authorized_keys"
echo ""
echo "     echo 'CAMLICA_KEY' >> /home/camlicayazilim/.ssh/authorized_keys"
echo "     chown camlicayazilim:camlicayazilim /home/camlicayazilim/.ssh/authorized_keys"
echo "     chmod 600 /home/camlicayazilim/.ssh/authorized_keys"
echo ""
echo "  2. Test SSH on new port BEFORE restarting SSH:"
echo "     systemctl restart sshd"
echo "     ssh -p 2299 -i ~/.ssh/key deploy@\$(hostname -I | awk '{print \$1}')"
echo "     ssh -p 2299 -i ~/.ssh/key camlicayazilim@\$(hostname -I | awk '{print \$1}')"
echo ""
echo "  3. Once BOTH users confirmed on port 2299, remove old SSH port:"
echo "     ufw delete allow 22/tcp"
echo ""
echo "  4. Clone the repo and run 02-deploy-app.sh"
echo "================================================"
