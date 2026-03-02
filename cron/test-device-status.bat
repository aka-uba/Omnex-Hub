@echo off
REM ================================================================
REM Test Device Status Checker
REM ================================================================
REM Manual test run for check-device-status.php
REM ================================================================

echo.
echo ========================================
echo  Testing Device Status Checker...
echo ========================================
echo.

set PHP_PATH=C:\xampp\php\php.exe
set SCRIPT_PATH=%~dp0check-device-status.php

if not exist "%PHP_PATH%" (
    echo [ERROR] PHP not found: %PHP_PATH%
    pause
    exit /b 1
)

if not exist "%SCRIPT_PATH%" (
    echo [ERROR] Script not found: %SCRIPT_PATH%
    pause
    exit /b 1
)

echo [INFO] Running script...
echo.

"%PHP_PATH%" "%SCRIPT_PATH%"

echo.
echo ========================================
echo  Test completed
echo ========================================
echo.

pause
