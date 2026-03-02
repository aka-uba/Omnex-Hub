@echo off
REM ================================================================
REM Windows Task Scheduler Setup - Device Status Checker
REM ================================================================
REM
REM Bu script, check-device-status.php'yi her 1 dakikada bir
REM otomatik olarak çalıştırmak için Windows Task Scheduler'a
REM görev ekler.
REM
REM Kullanım: Bu dosyayı Yönetici olarak çalıştırın (Run as Administrator)
REM ================================================================

echo.
echo ========================================
echo  Omnex Device Status Checker Setup
echo ========================================
echo.

REM PHP yolunu belirle
set PHP_PATH=C:\xampp\php\php.exe
set SCRIPT_PATH=%~dp0check-device-status.php

REM PHP ve script varlığını kontrol et
if not exist "%PHP_PATH%" (
    echo [HATA] PHP bulunamadi: %PHP_PATH%
    echo Lutfen PHP_PATH duzenlemeyi unutmayin
    pause
    exit /b 1
)

if not exist "%SCRIPT_PATH%" (
    echo [HATA] Script bulunamadi: %SCRIPT_PATH%
    pause
    exit /b 1
)

echo [OK] PHP bulundu: %PHP_PATH%
echo [OK] Script bulundu: %SCRIPT_PATH%
echo.

REM Mevcut görevi sil (varsa)
schtasks /query /tn "OmnexDeviceStatusChecker" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Mevcut gorev siliniyor...
    schtasks /delete /tn "OmnexDeviceStatusChecker" /f >nul 2>&1
)

REM Yeni görev oluştur
echo [INFO] Task Scheduler'a gorev ekleniyor...
echo.

schtasks /create ^
    /tn "OmnexDeviceStatusChecker" ^
    /tr "\"%PHP_PATH%\" \"%SCRIPT_PATH%\"" ^
    /sc minute ^
    /mo 1 ^
    /ru "SYSTEM" ^
    /rl HIGHEST ^
    /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo  [BASARILI] Gorev basariyla eklendi!
    echo ========================================
    echo.
    echo Gorev Adi: OmnexDeviceStatusChecker
    echo Calisma Sikli: Her 1 dakikada bir
    echo PHP Yolu: %PHP_PATH%
    echo Script Yolu: %SCRIPT_PATH%
    echo.
    echo Gorevi kontrol etmek icin:
    echo   1. Task Scheduler'i acin (taskschd.msc)
    echo   2. Task Scheduler Library'de "OmnexDeviceStatusChecker" gorevini bulun
    echo   3. Sag tik ^> Run ile hemen calistirabilirsiniz
    echo.
) else (
    echo.
    echo ========================================
    echo  [HATA] Gorev eklenemedi!
    echo ========================================
    echo.
    echo Lutfen bu dosyayi Yonetici olarak calistirdiginizdan emin olun:
    echo   1. Sag tik ^> Run as Administrator
    echo.
)

pause
