@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ENV_FILE=%~1"
if "%ENV_FILE%"=="" set "ENV_FILE=.env.local"
if not exist "%ENV_FILE%" (
    echo [ERROR] Env file not found: %ENV_FILE%
    endlocal & exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    set "KEY=%%A"
    set "VAL=%%B"
    if not "!KEY!"=="" if /I not "!KEY:~0,1!"=="#" (
        endlocal & set "%%A=%%B" & setlocal EnableExtensions EnableDelayedExpansion
    )
)

endlocal & exit /b 0
