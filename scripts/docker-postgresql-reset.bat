@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

docker compose -f docker-compose.postgresql.yml down -v
exit /b %errorlevel%
