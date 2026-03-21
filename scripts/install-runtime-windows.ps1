[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$NpmMirrorRegistry = 'https://registry.npmmirror.com'
$WingetDomesticSource = 'https://mirrors.ustc.edu.cn/winget-source'
$DefaultGlobalNpmBin = Join-Path $env:AppData 'npm'
$CodexPackage = '@openai/codex'
$SourceMode = 'official'

function Show-Header {
  @(
    'FineReport Runtime Installer (Windows)',
    '',
    'The installer will install:',
    '- git',
    '- node',
    '- python3',
    '- codex',
    '- database drivers (sqlalchemy, pymysql, psycopg)'
  ) | ForEach-Object { Write-Host $_ }
}

function Select-SourceMode {
  Write-Host ''
  Write-Host 'Choose download source:'
  Write-Host '1. Official'
  Write-Host '2. Domestic mirror (winget USTC mirror + domestic npm mirror)'
  $choice = Read-Host 'Select [1/2]'
  switch ($choice) {
    '2' { $script:SourceMode = 'domestic' }
    '' { $script:SourceMode = 'official' }
    '1' { $script:SourceMode = 'official' }
    default { throw "Invalid option: $choice" }
  }
}

function Assert-Winget {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'winget not found. Please update App Installer or required Windows components first.'
  }
}

function Get-WingetVersion {
  $versionText = (& winget --version 2>&1 | Select-Object -First 1).ToString().Trim()
  if ($versionText.StartsWith('v')) {
    $versionText = $versionText.Substring(1)
  }
  return [version]$versionText
}

function Configure-WingetSource {
  if ($SourceMode -eq 'domestic') {
    Write-Host 'Configuring winget source to USTC mirror...'
    & winget source remove winget 2>$null
    $args = @('source', 'add', 'winget', $WingetDomesticSource)
    if ((Get-WingetVersion) -ge [version]'1.8.0') {
      $args += @('--trust-level', 'trusted')
    }
    & winget @args
    return
  }

  Write-Host 'Resetting winget source to official...'
  & winget source reset winget
}

function Install-WingetPackage {
  param([string]$Id)
  & winget install --id $Id -e --accept-package-agreements --accept-source-agreements
}

function Test-CommandAvailable {
  param([string[]]$Names)

  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command -and -not $command.Source.Contains('\WindowsApps\')) {
      return $true
    }
  }

  return $false
}

function Install-CorePackages {
  Write-Host ''
  Write-Host 'Installing git / node / python...'

  if (Test-CommandAvailable @('git')) {
    Write-Host 'git already installed, skip.'
  } else {
    Install-WingetPackage 'Git.Git'
  }

  if (Test-CommandAvailable @('node')) {
    Write-Host 'node already installed, skip.'
  } else {
    Install-WingetPackage 'OpenJS.NodeJS.LTS'
  }

  if (Test-CommandAvailable @('py', 'python', 'python3')) {
    Write-Host 'python already installed, skip.'
  } else {
    Install-WingetPackage 'Python.Python.3.12'
  }
}

function Get-PathEntriesFromTarget {
  param([System.EnvironmentVariableTarget]$Target)
  $raw = [Environment]::GetEnvironmentVariable('Path', $Target)
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return @()
  }
  return $raw -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
}

function Refresh-Path {
  $segments = @(
    Get-PathEntriesFromTarget 'Machine'
    Get-PathEntriesFromTarget 'User'
    $env:ProgramFiles + '\nodejs',
    $env:ProgramFiles + '\Git\cmd',
    $env:LocalAppData + '\Programs\Python\Python312',
    $env:LocalAppData + '\Programs\Python\Python312\Scripts',
    $env:LocalAppData + '\Programs\Git\cmd',
    $DefaultGlobalNpmBin
  )
  foreach ($segment in $segments) {
    if ((Test-Path $segment) -and -not ($env:Path -split ';' | Where-Object { $_ -eq $segment })) {
      $env:Path += ";$segment"
    }
  }
}

function Resolve-CommandPath {
  param(
    [string[]]$Names,
    [string[]]$FallbackPaths
  )

  foreach ($path in $FallbackPaths) {
    if (Test-Path $path) {
      return $path
    }
  }

  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command -and -not $command.Source.Contains('\WindowsApps\')) {
      return $command.Source
    }
  }

  throw "Command not found: $($Names -join ', ')"
}

function Install-DatabaseDrivers {
  Write-Host ''
  Write-Host 'Installing database drivers (SQLAlchemy + connectors)...'
  $pipPath = Resolve-CommandPath @('pip3', 'pip') @(
    (Join-Path $env:LocalAppData 'Programs\Python\Python312\Scripts\pip.exe'),
    (Join-Path $env:ProgramFiles 'Python312\Scripts\pip.exe')
  )
  $mirrorArgs = @()
  if ($SourceMode -eq 'domestic') {
    $mirrorArgs = @('-i', 'https://pypi.tuna.tsinghua.edu.cn/simple', '--trusted-host', 'pypi.tuna.tsinghua.edu.cn')
  }
  # 逐个安装，避免一个失败影响其他包
  # psycopg = psycopg3 纯 Python，无需编译，兼容所有平台（含 Windows ARM64）
  # oracledb / pymssql 在 ARM64 上可能需要 C 编译工具链，安装失败会跳过
  $packages = @('sqlalchemy', 'pymysql', 'psycopg', 'oracledb', 'pymssql')
  foreach ($pkg in $packages) {
    Write-Host "  Installing $pkg..."
    $ErrorActionPreference = 'Continue'
    & $pipPath install $pkg @mirrorArgs
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) {
      Write-Host "  [WARN] $pkg install failed, skipping (install manually if needed)"
    }
  }
}

function Install-Codex {
  Write-Host ''
  Write-Host 'Installing Codex...'
  $npmPath = Resolve-CommandPath @('npm.cmd', 'npm') @(
    (Join-Path $env:ProgramFiles 'nodejs\npm.cmd'),
    (Join-Path $env:ProgramFiles 'nodejs\npm')
  )
  $npmArgs = @('install', '-g', $CodexPackage)
  if ($SourceMode -eq 'domestic') {
    $npmArgs += @('--registry', $NpmMirrorRegistry)
  }
  & $npmPath @npmArgs
}

function Assert-CommandVersion {
  param(
    [string]$Label,
    [string[]]$Names,
    [string[]]$FallbackPaths
  )

  $commandPath = Resolve-CommandPath $Names $FallbackPaths
  $version = & $commandPath --version 2>&1 | Select-Object -First 1
  Write-Host ("[ OK ] {0} -> {1}" -f $Label, $version)
}

function Show-SourceSummary {
  Write-Host ''
  if ($SourceMode -eq 'domestic') {
    Write-Host 'Source mode: USTC winget mirror + domestic npm mirror.'
    Write-Host 'Admin permission is required for winget source replacement.'
    return
  }
  Write-Host 'Source mode: official.'
}

function Main {
  Show-Header
  Select-SourceMode
  Show-SourceSummary
  Assert-Winget
  Configure-WingetSource
  Install-CorePackages
  Refresh-Path
  Install-DatabaseDrivers
  Install-Codex
  Refresh-Path
  Write-Host ''
  Write-Host 'Verifying installed commands:'
  Assert-CommandVersion 'git' @('git') @(
    (Join-Path $env:ProgramFiles 'Git\cmd\git.exe'),
    (Join-Path $env:LocalAppData 'Programs\Git\cmd\git.exe')
  )
  Assert-CommandVersion 'node' @('node') @(
    (Join-Path $env:ProgramFiles 'nodejs\node.exe')
  )
  Assert-CommandVersion 'python3' @('py', 'python3', 'python') @(
    (Join-Path $env:LocalAppData 'Programs\Python\Python312\python.exe'),
    (Join-Path $env:ProgramFiles 'Python312\python.exe')
  )
  Assert-CommandVersion 'codex' @('codex') @(
    (Join-Path $DefaultGlobalNpmBin 'codex.cmd'),
    (Join-Path $DefaultGlobalNpmBin 'codex')
  )
  Write-Host ''
  Write-Host 'Verifying database drivers:'
  $pyPath = Resolve-CommandPath @('python3', 'python', 'py') @(
    (Join-Path $env:LocalAppData 'Programs\Python\Python312\python.exe'),
    (Join-Path $env:ProgramFiles 'Python312\python.exe')
  )
  & $pyPath -c "import sqlalchemy; print('[ OK ] sqlalchemy ->', sqlalchemy.__version__)"
  & $pyPath -c "import pymysql; print('[ OK ] pymysql ->', pymysql.__version__)"
  & $pyPath -c "import psycopg; print('[ OK ] psycopg ->', psycopg.__version__)"
  & $pyPath -c "import pymssql; print('[ OK ] pymssql ->', pymssql.__version__)"
}

Main
