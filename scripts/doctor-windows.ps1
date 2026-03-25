[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RootDir = Split-Path -Parent $PSScriptRoot
$WebPort = 18080

Write-Host 'FineReport local doctor (Windows)'
Write-Host "Root: $RootDir"
python --version
node --version
pnpm --version
uv --version

Write-Host 'browser automation check: default browser launch command is expected.'
Get-Command Start-Process | Out-Null

Write-Host "port $WebPort usage:"
$portUsage = Get-NetTCPConnection -LocalPort $WebPort -ErrorAction SilentlyContinue
if ($null -eq $portUsage) {
  Write-Host "port $WebPort not in use."
} else {
  $portUsage
}

Write-Host 'workspace writable check:'
if (-not (Test-Path $RootDir)) {
  throw 'Repository root is missing.'
}

Write-Host 'FineReport assets check:'
if (-not (Test-Path (Join-Path $RootDir 'reportlets\GettingStarted.cpt'))) {
  throw 'FineReport asset missing: reportlets\GettingStarted.cpt'
}
