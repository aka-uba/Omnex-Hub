#!/bin/sh
set -eu

APP_ROOT="/var/www/html"

echo "[entrypoint] preparing storage permissions..."
mkdir -p "${APP_ROOT}/storage/logs"
chown -R www-data:www-data "${APP_ROOT}/storage"
chmod -R u+rwX,g+rwX "${APP_ROOT}/storage"

if [ "${OMNEX_SKIP_DB_BOOTSTRAP:-false}" != "true" ]; then
  echo "[entrypoint] running migrate+seed bootstrap..."
  php "${APP_ROOT}/tools/postgresql/migrate_seed.php"
else
  echo "[entrypoint] OMNEX_SKIP_DB_BOOTSTRAP=true, skipping migrate+seed."
fi

# migrate_seed.php can create logs as root; normalize ownership for Apache runtime user.
chown -R www-data:www-data "${APP_ROOT}/storage"
chmod -R u+rwX,g+rwX "${APP_ROOT}/storage"

echo "[entrypoint] starting apache..."
exec apache2-foreground
