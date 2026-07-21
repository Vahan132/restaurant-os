<#
  EDGE-PKG-2-WIN - Restaurant OS Edge Hub installer (Windows)

  One command to install and start the hub on a Windows mini-PC:
    * downloads the public compose + env template from the GitHub Release,
    * generates the required auth secrets into .env.edge (nothing to hand-edit),
    * opens the LAN port in Windows Firewall,
    * pulls the public image and brings the stack up.

  No registry credentials are ever needed (the image is public). The hub's
  identity + keys arrive later, when you pair it at /setup.

  Run from an elevated PowerShell (Run as Administrator), or just double-click
  install-hub.bat which elevates for you.

  Examples:
    .\install-hub.ps1                       # uses defaults below
    .\install-hub.ps1 -Tag edge-v0.1.0 -Port 3001 -ConfigureBootOnPower
#>
[CmdletBinding()]
param(
  [string]$Tag = 'edge-v0.1.0',                       # release to install (pin this)
  [string]$Repo = 'Vahan132/restaurant-os',          # GitHub owner/repo of the release
  [int]$Port = 3001,                                  # LAN port the hub serves on
  [string]$InstallDir = 'C:\RestaurantOS',            # where the hub files live
  [string]$CloudUrl = '',                             # optional: your platform base URL
  [switch]$ConfigureBootOnPower                        # also set up unattended boot-on-power
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    throw 'Please run this as Administrator (right-click PowerShell -> Run as administrator, or use install-hub.bat).'
  }
}

function Test-DockerReady {
  # $true only if the Docker engine is installed AND responding.
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
  try { docker info *> $null; return ($LASTEXITCODE -eq 0) } catch { return $false }
}

function New-Secret {
  # 24 random bytes -> 48 hex chars (well above the 16-char minimum).
  $bytes = New-Object 'System.Byte[]' 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

function Set-EnvValue {
  param([string]$Path, [string]$Key, [string]$Value)
  $line = "$Key=$Value"
  if (Test-Path $Path) {
    $content = Get-Content $Path
    if ($content -match "^\s*$([regex]::Escape($Key))=") {
      (Get-Content $Path) -replace "^\s*$([regex]::Escape($Key))=.*", $line | Set-Content $Path -Encoding UTF8
      return
    }
  }
  Add-Content -Path $Path -Value $line -Encoding UTF8
}

function Get-ReleaseAsset {
  param([string]$Name, [string]$OutFile)
  $url = "https://github.com/$Repo/releases/download/$Tag/$Name"
  Write-Host "  downloading $Name ..."
  Invoke-WebRequest -Uri $url -OutFile $OutFile -UseBasicParsing
}

# ---- 1. Preconditions -------------------------------------------------------
Assert-Admin

Write-Host "Restaurant OS Edge Hub installer" -ForegroundColor Cyan
Write-Host "  release : $Tag"
Write-Host "  folder  : $InstallDir"
Write-Host "  port    : $Port"
Write-Host ""

if (-not (Test-DockerReady)) {
  Write-Warning @"
Docker Desktop isn't installed or isn't running.

  1. Install Docker Desktop (WSL2 backend):
       https://www.docker.com/products/docker-desktop/
  2. Launch Docker Desktop once and wait for it to say "Engine running".
  3. Re-run this installer.
"@
  return
}

# ---- 2. Files ---------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Set-Location $InstallDir

Get-ReleaseAsset -Name 'docker-compose.edge.yml' -OutFile (Join-Path $InstallDir 'docker-compose.edge.yml')
if (-not (Test-Path (Join-Path $InstallDir '.env.edge.example'))) {
  Get-ReleaseAsset -Name '.env.edge.example' -OutFile (Join-Path $InstallDir '.env.edge.example')
}

# ---- 3. Environment + secrets ----------------------------------------------
$envFile = Join-Path $InstallDir '.env.edge'
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $InstallDir '.env.edge.example') $envFile
  Write-Host "Generating auth secrets into .env.edge ..."
  foreach ($k in 'JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','CONSUMER_JWT_ACCESS_SECRET','CONSUMER_JWT_REFRESH_SECRET') {
    Set-EnvValue -Path $envFile -Key $k -Value (New-Secret)
  }
  Set-EnvValue -Path $envFile -Key 'EDGE_IMAGE_TAG' -Value $Tag
  if ($CloudUrl) { Set-EnvValue -Path $envFile -Key 'CLOUD_URL' -Value $CloudUrl }
  Set-EnvValue -Path $envFile -Key 'PORT' -Value $Port
} else {
  Write-Host ".env.edge already exists - keeping your settings (not regenerating secrets)."
}

# ---- 4. Firewall (LAN access from tablets/phones on the branch network) ------
$ruleName = "RestaurantOS Hub $Port"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $Port -Profile Any | Out-Null
  Write-Host "Opened inbound TCP $Port in Windows Firewall."
}

# ---- 5. Bring the stack up --------------------------------------------------
Write-Host "Pulling the public image and starting the hub ..." -ForegroundColor Cyan
docker compose -f docker-compose.edge.yml --env-file .env.edge pull
docker compose -f docker-compose.edge.yml --env-file .env.edge up -d

# ---- 6. Optional: unattended boot-on-power ----------------------------------
if ($ConfigureBootOnPower) {
  $boot = Join-Path $PSScriptRoot 'enable-boot-on-power.ps1'
  if (Test-Path $boot) { & $boot -InstallDir $InstallDir } else {
    Write-Warning "enable-boot-on-power.ps1 not found next to the installer - run it separately."
  }
}

# ---- 7. Where to go next ----------------------------------------------------
$lan = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } |
        Select-Object -First 1 -ExpandProperty IPAddress)
Write-Host ""
Write-Host "Done. The hub is starting." -ForegroundColor Green
Write-Host "  On this machine : http://localhost:$Port/setup"
if ($lan) { Write-Host "  From a tablet   : http://$lan`:$Port/setup" }
Write-Host ""
Write-Host "Open that page, enter your pairing code, and the hub takes over from there."
