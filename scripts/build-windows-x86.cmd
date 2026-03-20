@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%build-windows-x86.ps1"

net session >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  echo [INFO] Requesting administrator permission...
  PowerShell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','\"%~f0\" %*' -WorkingDirectory '%CD%' -Verb RunAs"
  set "EXIT_CODE=%ERRORLEVEL%"
  if not "%EXIT_CODE%"=="0" (
    echo [ERROR] Elevation request failed with exit code: %EXIT_CODE%
    exit /b %EXIT_CODE%
  )
  exit /b 0
)

if not exist "%PS_SCRIPT%" (
  echo [ERROR] PowerShell build script not found: %PS_SCRIPT%
  exit /b 1
)

PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Build script failed with exit code: %EXIT_CODE%
)

exit /b %EXIT_CODE%
