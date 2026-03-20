[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$NpmMirrorRegistry = 'https://registry.npmmirror.com'
$SourceMode = 'official'

function Show-Header {
  @(
    'FineReport Runtime Installer (Windows)',
    '',
    '将安装以下组件：',
    '- git',
    '- node',
    '- python3',
    '- codex'
  ) | ForEach-Object { Write-Host $_ }
}

function Select-SourceMode {
  Write-Host ''
  Write-Host '请选择下载源：'
  Write-Host '1. 官方源'
  Write-Host '2. 国内源'
  $choice = Read-Host '输入选项 [1/2]'
  switch ($choice) {
    '2' { $script:SourceMode = 'domestic' }
    '' { $script:SourceMode = 'official' }
    '1' { $script:SourceMode = 'official' }
    default { throw "无效选项: $choice" }
  }
}

function Assert-Winget {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw '未检测到 winget，请先升级 App Installer 或系统组件后再执行本脚本。'
  }
}

function Install-WingetPackage {
  param([string]$Id)
  & winget install --id $Id -e --accept-package-agreements --accept-source-agreements
}

function Install-CorePackages {
  Write-Host ''
  Write-Host '开始安装 git / node / python。'
  Install-WingetPackage 'Git.Git'
  Install-WingetPackage 'OpenJS.NodeJS.LTS'
  Install-WingetPackage 'Python.Python.3.12'
}

function Refresh-Path {
  $segments = @(
    $env:ProgramFiles + '\nodejs',
    $env:LocalAppData + '\Programs\Python\Python312',
    $env:LocalAppData + '\Programs\Python\Python312\Scripts',
    $env:LocalAppData + '\Programs\Git\cmd'
  )
  foreach ($segment in $segments) {
    if (Test-Path $segment -and -not ($env:Path -split ';' | Where-Object { $_ -eq $segment })) {
      $env:Path += ";$segment"
    }
  }
}

function Install-Codex {
  Write-Host ''
  Write-Host '开始安装 Codex。'
  if ($SourceMode -eq 'domestic') {
    $env:npm_config_registry = $NpmMirrorRegistry
  }
  & npm install -g @openai/codex
}

function Assert-CommandVersion {
  param([string]$CommandName)
  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "$CommandName 未安装成功"
  }
  $version = & $CommandName --version 2>&1 | Select-Object -First 1
  Write-Host ("[ OK ] {0} -> {1}" -f $CommandName, $version)
}

function Show-SourceSummary {
  Write-Host ''
  if ($SourceMode -eq 'domestic') {
    Write-Host '当前源配置：winget 官方源，npm 国内源。'
    return
  }
  Write-Host '当前源配置：官方源。'
}

function Main {
  Show-Header
  Select-SourceMode
  Show-SourceSummary
  Assert-Winget
  Install-CorePackages
  Refresh-Path
  Install-Codex
  Refresh-Path
  Write-Host ''
  Write-Host '安装结果校验：'
  Assert-CommandVersion 'git'
  Assert-CommandVersion 'node'
  Assert-CommandVersion 'python'
  Assert-CommandVersion 'codex'
}

Main
