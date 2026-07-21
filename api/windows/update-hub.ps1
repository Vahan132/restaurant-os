<#
  EDGE-PKG-2-WIN - Update the Restaurant OS Edge Hub to a newer image.

  Pulls the newer public image and restarts. The hub keeps serving locally during
  the update, applies any new database migrations on start, and preserves its
  pairing + data on the named volumes. Safe to run during service.

  To move to a specific release, pass -Tag (writes EDGE_IMAGE_TAG into .env.edge):
    .\update-hub.ps1 -Tag edge-v0.2.0
#>
[CmdletBinding()]
param(
  [string]$InstallDir = 'C:\RestaurantOS',
  [string]$Tag
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Set-Location $InstallDir
$envFile = Join-Path $InstallDir '.env.edge'

if ($Tag) {
  $line = "EDGE_IMAGE_TAG=$Tag"
  if ((Get-Content $envFile) -match '^\s*EDGE_IMAGE_TAG=') {
    (Get-Content $envFile) -replace '^\s*EDGE_IMAGE_TAG=.*', $line | Set-Content $envFile -Encoding UTF8
  } else {
    Add-Content -Path $envFile -Value $line -Encoding UTF8
  }
  Write-Host "Pinned EDGE_IMAGE_TAG=$Tag"
}

docker compose -f docker-compose.edge.yml --env-file .env.edge pull
docker compose -f docker-compose.edge.yml --env-file .env.edge up -d
docker compose -f docker-compose.edge.yml --env-file .env.edge ps
Write-Host "Update complete."
