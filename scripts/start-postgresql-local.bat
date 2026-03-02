@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

echo Starting local server with PostgreSQL config from .env.local
echo URL: http://127.0.0.1:8080
php -S 127.0.0.1:8080 -t . index.php
