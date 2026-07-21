@echo off
REM EDGE-PKG-2-WIN - double-click launcher for the Edge Hub installer.
REM Elevates (UAC prompt) and runs install-hub.ps1 with execution policy bypassed,
REM so a non-technical admin never touches PowerShell settings.
setlocal

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator privileges...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-hub.ps1" %*
echo.
pause
