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

$script:DockerBinDirs = @(
  (Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'),
  'C:\Program Files\Docker\Docker\resources\bin'
) | Select-Object -Unique
$script:DockerDesktopExe = @(
  (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
  'C:\Program Files\Docker\Docker\Docker Desktop.exe'
) | Select-Object -Unique

function Update-SessionPath {
  # A logon Scheduled Task starts with the environment as it was at sign-in, which
  # may predate Docker's PATH entry. Re-read the live Machine + User PATH so
  # `docker` resolves instead of false-negativing (same fix as the installer).
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
}

function Resolve-DockerCli {
  Update-SessionPath
  if (Get-Command docker -ErrorAction SilentlyContinue) { return $true }
  foreach ($dir in $script:DockerBinDirs) {
    if ($dir -and (Test-Path (Join-Path $dir 'docker.exe'))) {
      $env:Path = "$dir;$env:Path"
      return $true
    }
  }
  return $false
}

function Test-DockerReady {
  # $true only if the Docker engine is installed AND responding. Uses `docker info`
  # (daemon reachable), not just `docker --version` (CLI present).
  if (-not (Resolve-DockerCli)) { return $false }
  try { docker info *> $null; return ($LASTEXITCODE -eq 0) } catch { return $false }
}

Set-Location $InstallDir

if (-not (Test-DockerReady)) {
  # Launch Docker Desktop if it isn't already coming up.
  $dd = $script:DockerDesktopExe | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($dd) {
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
