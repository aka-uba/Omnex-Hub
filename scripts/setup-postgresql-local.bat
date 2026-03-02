@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

for /f "usebackq tokens=1,* delims==" %%A in (".env.local") do (
    if not "%%A"=="" if /I not "%%A:~0,1"=="#" set "%%A=%%B"
)

if "%OMNEX_DB_NAME%"=="" set "OMNEX_DB_NAME=market_etiket"
if "%OMNEX_DB_HOST%"=="" set "OMNEX_DB_HOST=127.0.0.1"
if "%OMNEX_DB_PORT%"=="" set "OMNEX_DB_PORT=5432"

set "PSQL=C:\Program Files\PostgreSQL\18\bin\psql.exe"
if not exist "%PSQL%" (
    echo [ERROR] psql not found: %PSQL%
    exit /b 1
)

set "DB_EXISTS=0"
"%PSQL%" -h %OMNEX_DB_HOST% -p %OMNEX_DB_PORT% -U postgres -d postgres -w -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_database WHERE datname = '%OMNEX_DB_NAME%') THEN 1 ELSE 0 END;" > "%TEMP%\omnex_db_exists.txt"
if exist "%TEMP%\omnex_db_exists.txt" (
    set /p DB_EXISTS=<"%TEMP%\omnex_db_exists.txt"
    del "%TEMP%\omnex_db_exists.txt" >nul 2>&1
)
if not "%DB_EXISTS%"=="1" (
    "%PSQL%" -h %OMNEX_DB_HOST% -p %OMNEX_DB_PORT% -U postgres -d postgres -w -c "CREATE DATABASE %OMNEX_DB_NAME% WITH ENCODING 'UTF8' TEMPLATE template0;"
    if errorlevel 1 exit /b 1
)

php tools\postgresql\check_connection.php
if errorlevel 1 exit /b 1

php tools\postgresql\migrate_seed.php
if errorlevel 1 exit /b 1

echo.
echo [OK] PostgreSQL setup completed.
exit /b 0
