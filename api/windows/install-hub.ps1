<#
  EDGE-PKG-2-WIN - Restaurant OS Edge Hub installer (Windows)

  One command to install and start the hub on a Windows mini-PC:
    * makes sure Docker is installed AND running (installs Docker Desktop for you
      if it's missing - Ubuntu parity - and starts it if it's just not running),
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

  Exit codes (so a wrapper / scheduled task can react):
    0  success - hub is starting
    2  Docker was just installed and the machine must REBOOT; re-run afterwards
    3  winget is unavailable - Docker must be installed by hand (URL printed)
    4  Docker is installed but the engine did not become ready in time
    5  the automatic Docker install failed (details + manual URL printed)
#>
[CmdletBinding()]
param(
  [string]$Tag = 'edge-v0.1.0',                       # release to install (pin this)
  [string]$Repo = 'Vahan132/restaurant-os',          # GitHub owner/repo of the release
  [int]$Port = 3001,                                  # LAN port the hub serves on
  [string]$InstallDir = 'C:\RestaurantOS',            # where the hub files live
  [string]$CloudUrl = '',                             # optional: your platform base URL
  [int]$DockerStartTimeoutSeconds = 180,              # how long to wait for the engine
  [switch]$SkipDockerAutoInstall,                     # detect only; never auto-install
  [switch]$ConfigureBootOnPower                        # also set up unattended boot-on-power
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Known-good Docker locations, used when PATH still doesn't resolve `docker`.
$script:DockerBinDirs = @(
  (Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'),
  'C:\Program Files\Docker\Docker\resources\bin'
) | Select-Object -Unique
$script:DockerDesktopExe = @(
  (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
  'C:\Program Files\Docker\Docker\Docker Desktop.exe'
) | Select-Object -Unique

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    throw 'Please run this as Administrator (right-click PowerShell -> Run as administrator, or use install-hub.bat).'
  }
}

function Update-SessionPath {
  # THE FIX for the reported false negative: an elevated / double-clicked process
  # inherits a STALE environment block from whatever started it (Explorer, an old
  # shell) - a snapshot taken before Docker Desktop added its bin folder to the
  # Machine PATH. So `docker` looks missing even though it's installed and running.
  # Re-read the live Machine + User PATH from the registry and rebuild this
  # session's $env:Path so `docker` resolves the way a fresh shell would.
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
}

function Resolve-DockerCli {
  # Returns $true if `docker` is callable after refreshing PATH (and, if needed,
  # after adding a known Docker bin folder to this session's PATH).
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

function Get-DockerState {
  # Three distinct states, never conflated:
  #   NotInstalled - the CLI cannot be found anywhere.
  #   DaemonDown   - the CLI exists but the engine (Docker Desktop) isn't answering.
  #   Ready        - `docker info` succeeds; the engine is up.
  if (-not (Resolve-DockerCli)) { return 'NotInstalled' }
  try {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { return 'Ready' } else { return 'DaemonDown' }
  } catch { return 'DaemonDown' }
}

function Start-DockerDesktop {
  foreach ($exe in $script:DockerDesktopExe) {
    if ($exe -and (Test-Path $exe)) {
      if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
        Start-Process $exe | Out-Null
      }
      return $true
    }
  }
  return $false
}

function Wait-DockerReady {
  param([int]$TimeoutSeconds)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ($true) {
    if ((Get-DockerState) -eq 'Ready') { return $true }
    if ((Get-Date) -gt $deadline) { return $false }
    Write-Host "  ...waiting for Docker to start"
    Start-Sleep -Seconds 5
  }
}

function Install-DockerDesktop {
  # Ubuntu parity: the .sh runs `get.docker.com`; here we use winget. Returns one
  # of: NoWinget | Installed | RebootRequired | Failed.
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { return 'NoWinget' }

  # Docker Desktop needs the WSL2 platform. Turning it on requires a reboot.
  $needWslReboot = $false
  $wslReady = $false
  try { wsl.exe --status *> $null; if ($LASTEXITCODE -eq 0) { $wslReady = $true } } catch { $wslReady = $false }
  if (-not $wslReady) {
    Write-Host "  enabling WSL2 (Docker Desktop requires it)..."
    try {
      wsl.exe --install --no-distribution *> $null
      if ($LASTEXITCODE -ne 0) { wsl.exe --install *> $null }
    } catch { }
    $needWslReboot = $true
  }

  Write-Host "  installing Docker Desktop via winget (this can take several minutes)..."
  # Pipe winget's own output to the host so the user sees progress but it does NOT
  # leak into this function's return value (the caller switches on that value).
  try {
    winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements --silent | Out-Host
  } catch { }
  $code = $LASTEXITCODE

  # Decide success by whether Docker actually landed on disk, not by decoding
  # winget's exit code (reboot-required vs. success codes are not portable).
  $present = (Resolve-DockerCli) -or ($script:DockerBinDirs | Where-Object { $_ -and (Test-Path (Join-Path $_ 'docker.exe')) })
  if ($present) {
    if ($needWslReboot) { return 'RebootRequired' }
    return 'Installed'
  }
  if ($code -eq 0) {
    if ($needWslReboot) { return 'RebootRequired' }
    return 'Installed'
  }
  Write-Host "  winget exited with code $code and Docker was not found afterwards."
  return 'Failed'
}

function Show-ManualDockerHelp {
  Write-Warning @"
Couldn't install Docker automatically on this machine.

  1. Install Docker Desktop by hand (keep the WSL 2 option ticked):
       https://www.docker.com/products/docker-desktop/
  2. Restart the computer if it asks.
  3. Open Docker Desktop once and wait until it says "Engine running."
  4. Run install-hub.bat again - it will pick up from here.
"@
}

function Ensure-DockerReady {
  # Guarantees the engine is up before we touch compose - or exits with a clear,
  # jargon-light message and a distinct exit code telling the user how to resume.
  $state = Get-DockerState

  if ($state -eq 'Ready') {
    Write-Host "Docker is installed and running." -ForegroundColor Green
    return
  }

  if ($state -eq 'DaemonDown') {
    Write-Host "Docker is installed but not running yet. Starting Docker Desktop..." -ForegroundColor Cyan
    if (-not (Start-DockerDesktop)) {
      Write-Warning @"
Docker is installed but I couldn't find "Docker Desktop.exe" to start it.
  1. Open Docker Desktop from the Start menu and wait for "Engine running."
  2. Then run install-hub.bat again.
"@
      exit 4
    }
    if (Wait-DockerReady -TimeoutSeconds $DockerStartTimeoutSeconds) {
      Write-Host "Docker engine is now running." -ForegroundColor Green
      return
    }
    Write-Warning @"
Docker didn't finish starting within $DockerStartTimeoutSeconds seconds.
  1. Open Docker Desktop and wait until it says "Engine running."
  2. Then run install-hub.bat again.
"@
    exit 4
  }

  # state -eq 'NotInstalled'
  if ($SkipDockerAutoInstall) {
    Write-Warning @"
Docker Desktop isn't installed and auto-install was skipped (-SkipDockerAutoInstall).
Install it, then run install-hub.bat again:
  https://www.docker.com/products/docker-desktop/
"@
    exit 3
  }

  Write-Host "Docker Desktop isn't installed. Installing it for you..." -ForegroundColor Cyan
  switch (Install-DockerDesktop) {
    'NoWinget' {
      Write-Warning @"
This computer doesn't have 'winget' (the Windows app installer), so I can't
install Docker automatically.
"@
      Show-ManualDockerHelp
      exit 3
    }
    'Failed' {
      Show-ManualDockerHelp
      exit 5
    }
    'RebootRequired' {
      Write-Host ""
      Write-Host "Docker Desktop was installed, but Windows needs to RESTART to finish" -ForegroundColor Yellow
      Write-Host "turning on WSL2 (the piece Docker runs on)." -ForegroundColor Yellow
      Write-Host "  1. Restart this computer." -ForegroundColor Yellow
      Write-Host "  2. After it comes back, run install-hub.bat again - it will continue." -ForegroundColor Yellow
      exit 2
    }
    'Installed' {
      Write-Host "Docker Desktop installed. Starting it..." -ForegroundColor Cyan
      Start-DockerDesktop | Out-Null
      if (Wait-DockerReady -TimeoutSeconds $DockerStartTimeoutSeconds) {
        Write-Host "Docker engine is now running." -ForegroundColor Green
        return
      }
      Write-Host ""
      Write-Host "Docker Desktop was installed but the engine didn't come up yet - this" -ForegroundColor Yellow
      Write-Host "usually means Windows needs one RESTART to finish setup." -ForegroundColor Yellow
      Write-Host "  1. Restart this computer." -ForegroundColor Yellow
      Write-Host "  2. After it comes back, run install-hub.bat again." -ForegroundColor Yellow
      exit 2
    }
  }
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

# Robust Docker detection + auto-install/-start. Returns only when the engine is
# ready; otherwise it has already printed guidance and exited with a code above.
Ensure-DockerReady

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
