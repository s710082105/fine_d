[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RootDir = Split-Path -Parent $PSScriptRoot

function Install-WingetPackage {
  param([string]$Id)

  & winget install --id $Id -e --accept-package-agreements --accept-source-agreements
}

Write-Host 'FineReport local install (Windows)'
Write-Host "Repository root: $RootDir"

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw 'winget is required before running this skeleton installer.'
}

Install-WingetPackage 'Python.Python.3.12'
Install-WingetPackage 'OpenJS.NodeJS.LTS'

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  py -m pip install uv
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  npm install -g pnpm
}

Set-Location $RootDir
py -m venv .venv
uv sync --extra dev
pnpm install
pnpm --dir apps/web install
New-Item -ItemType Directory -Force -Path workspace, generated, '.local\state', logs | Out-Null

Write-Host '[ok] python/node installed and repository dependencies prepared.'
