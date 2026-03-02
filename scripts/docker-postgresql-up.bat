@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker daemon is not running.
    echo Start Docker Desktop and run this script again.
    exit /b 1
)

docker compose -f docker-compose.postgresql.yml up -d --build
if errorlevel 1 (
    echo [ERROR] Docker compose up failed.
    exit /b 1
)

echo.
echo [INFO] Running migration+seed inside app container...
docker compose -f docker-compose.postgresql.yml run --rm app php tools/postgresql/migrate_seed.php
if errorlevel 1 (
    echo [ERROR] migrate_seed failed in container.
    exit /b 1
)

echo.
echo [OK] Docker PostgreSQL stack is ready.
echo App:      http://localhost:8081
echo Postgres: localhost:5433
exit /b 0
