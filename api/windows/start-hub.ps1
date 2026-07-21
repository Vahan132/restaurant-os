<#
  EDGE-PKG-2-WIN - Start the Restaurant OS Edge Hub.

  Ensures the Docker engine is running (launching Docker Desktop and waiting for
  it if needed), then brings the stack up. Safe to run repeatedly - if the hub is
  already up this is a no-op. This is what the logon Scheduled Task runs after a
  power-cut so the hub returns with no human action.
#>
[CmdletBinding()]
param(
  [string]$InstallDir = 'C:\RestaurantOS',
  [int]$TimeoutSeconds = 240
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-DockerReady {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
  try { docker info *> $null; return ($LASTEXITCODE -eq 0) } catch { return $false }
}

Set-Location $InstallDir

if (-not (Test-DockerReady)) {
  # Launch Docker Desktop if it isn't already coming up.
  $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $dd) {
    if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
      Start-Process $dd | Out-Null
    }
  }
  Write-Host "Waiting for the Docker engine to start ..."
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while (-not (Test-DockerReady)) {
    if ((Get-Date) -gt $deadline) { throw "Docker engine did not become ready within $TimeoutSeconds s." }
    Start-Sleep -Seconds 5
  }
}

docker compose -f docker-compose.edge.yml --env-file .env.edge up -d
Write-Host "Hub is up."
