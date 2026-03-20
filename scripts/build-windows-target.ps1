[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [pscustomobject]$Config
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$CorepackInstallDirectory = Join-Path $env:AppData 'npm'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$WindowsSdkRoot = 'C:\Program Files (x86)\Windows Kits\10\Lib'
$VisualStudioRootCandidates = @(
  'C:\Program Files (x86)\Microsoft Visual Studio\2022',
  'C:\Program Files\Microsoft Visual Studio\2022'
)
$VisualStudioEditionCandidates = @('BuildTools', 'Community', 'Professional', 'Enterprise')
$VisualStudioInstallHint = 'winget install -e --id Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements --accept-source-agreements --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --includeRecommended"'
$VisualStudioArm64Hint = 'winget install -e --id Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements --accept-source-agreements --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Tools.ARM64 --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --includeRecommended"'

function Assert-Windows {
  if ($env:OS -ne 'Windows_NT') {
    throw 'This script must run on Windows.'
  }
}

function Assert-Command {
  param(
    [string]$Name,
    [string]$Hint
  )
  if (Get-Command $Name -ErrorAction SilentlyContinue) {
    return
  }

  throw "$Name not found. $Hint"
}

function Invoke-Step {
  param(
    [string]$Label,
    [scriptblock]$Action
  )

  Write-Host ''
  Write-Host ("==> {0}" -f $Label)
  & $Action
}

function Get-VisualStudioInstallRoots {
  $roots = @()
  foreach ($basePath in $VisualStudioRootCandidates) {
    foreach ($edition in $VisualStudioEditionCandidates) {
      $candidate = Join-Path $basePath $edition
      if (Test-Path $candidate) {
        $roots += $candidate
      }
    }
  }
  return $roots
}

function Get-MsvcVersionRoots {
  $roots = @()
  foreach ($installRoot in Get-VisualStudioInstallRoots) {
    $msvcRoot = Join-Path $installRoot 'VC\Tools\MSVC'
    if (-not (Test-Path $msvcRoot)) {
      continue
    }

    $roots += Get-ChildItem $msvcRoot -Directory -ErrorAction SilentlyContinue |
      Sort-Object Name -Descending |
      Select-Object -ExpandProperty FullName
  }
  return $roots
}

function Get-TargetCompilerPaths {
  param([pscustomobject]$BuildConfig)

  $paths = @()
  foreach ($root in Get-MsvcVersionRoots) {
    $binRoot = Join-Path $root 'bin'
    if (-not (Test-Path $binRoot)) {
      continue
    }

    foreach ($hostDir in Get-ChildItem $binRoot -Directory -Filter 'Host*' -ErrorAction SilentlyContinue) {
      $compilerPath = Join-Path $hostDir.FullName ($BuildConfig.VsTargetArch + '\cl.exe')
      if (Test-Path $compilerPath) {
        $paths += $compilerPath
      }
    }
  }
  return $paths
}

function Get-TargetMsvcRuntimeLibPaths {
  param([pscustomobject]$BuildConfig)

  $paths = @()
  foreach ($root in Get-MsvcVersionRoots) {
    $runtimePath = Join-Path $root ('lib\' + $BuildConfig.VsTargetArch + '\msvcrt.lib')
    if (Test-Path $runtimePath) {
      $paths += $runtimePath
    }
  }
  return $paths
}

function Get-WindowsSdkLibraryPaths {
  param([pscustomobject]$BuildConfig)

  $paths = @()
  if (-not (Test-Path $WindowsSdkRoot)) {
    return $paths
  }

  foreach ($versionDir in Get-ChildItem $WindowsSdkRoot -Directory -ErrorAction SilentlyContinue) {
    $umPath = Join-Path $versionDir.FullName ('um\' + $BuildConfig.VsTargetArch + '\kernel32.lib')
    $ucrtPath = Join-Path $versionDir.FullName ('ucrt\' + $BuildConfig.VsTargetArch + '\ucrt.lib')
    if ((Test-Path $umPath) -and (Test-Path $ucrtPath)) {
      $paths += $umPath
      $paths += $ucrtPath
    }
  }
  return $paths
}

function Get-TargetInstallHint {
  param([pscustomobject]$BuildConfig)

  if ($BuildConfig.VsTargetArch -eq 'arm64') {
    return $VisualStudioArm64Hint
  }
  return $VisualStudioInstallHint
}

function Install-VisualStudioToolchain {
  param([pscustomobject]$BuildConfig)

  Assert-Command 'winget' 'Install App Installer / winget first.'
  $installCommand = Get-TargetInstallHint -BuildConfig $BuildConfig
  Write-Host $installCommand
  & cmd.exe /c $installCommand
}

function Assert-InstalledToolchain {
  param([pscustomobject]$BuildConfig)

  $compilerPaths = Get-TargetCompilerPaths -BuildConfig $BuildConfig
  if (-not $compilerPaths) {
    throw ("MSVC compiler for target {0} is not installed. Install Visual Studio Build Tools with: {1}" -f $BuildConfig.VsTargetArch, (Get-TargetInstallHint -BuildConfig $BuildConfig))
  }

  $runtimePaths = Get-TargetMsvcRuntimeLibPaths -BuildConfig $BuildConfig
  if (-not $runtimePaths) {
    throw ("MSVC runtime libraries for target {0} are not installed. Missing msvcrt.lib under VC\\Tools\\MSVC\\*\\lib\\{0}. Install: {1}" -f $BuildConfig.VsTargetArch, (Get-TargetInstallHint -BuildConfig $BuildConfig))
  }

  $sdkPaths = Get-WindowsSdkLibraryPaths -BuildConfig $BuildConfig
  if (-not $sdkPaths) {
    throw ("Windows SDK libraries for target {0} are not installed. Missing kernel32.lib / ucrt.lib under Windows Kits. Install: {1}" -f $BuildConfig.VsTargetArch, $VisualStudioInstallHint)
  }
}

function Resolve-VsDevShellPath {
  foreach ($installRoot in Get-VisualStudioInstallRoots) {
    $scriptPath = Join-Path $installRoot 'Common7\Tools\Launch-VsDevShell.ps1'
    if (Test-Path $scriptPath) {
      return $scriptPath
    }
  }
  return $null
}

function Resolve-CommandPath {
  param([string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    return $null
  }
  return $command.Source
}

function Format-CommandPath {
  param([string]$ResolvedPath)

  if ($ResolvedPath) {
    return $ResolvedPath
  }
  return '<not found>'
}

function Test-ResolvedPathForTarget {
  param(
    [string]$ResolvedPath,
    [string]$TargetArch,
    [string]$CommandName
  )

  if (-not $ResolvedPath) {
    return $false
  }

  $expectedSuffix = ('\' + $TargetArch + '\' + $CommandName).ToLowerInvariant()
  return $ResolvedPath.ToLowerInvariant().EndsWith($expectedSuffix)
}

function Assert-ActiveToolchainForTarget {
  param([pscustomobject]$BuildConfig)

  $clPath = Resolve-CommandPath -Name 'cl.exe'
  $linkPath = Resolve-CommandPath -Name 'link.exe'
  $environmentTarget = $env:VSCMD_ARG_TGT_ARCH

  if (-not (Test-ResolvedPathForTarget -ResolvedPath $clPath -TargetArch $BuildConfig.VsTargetArch -CommandName 'cl.exe')) {
    throw ("Active cl.exe does not target {0}. Current path: {1}" -f $BuildConfig.VsTargetArch, (Format-CommandPath -ResolvedPath $clPath))
  }

  if (-not (Test-ResolvedPathForTarget -ResolvedPath $linkPath -TargetArch $BuildConfig.VsTargetArch -CommandName 'link.exe')) {
    throw ("Active link.exe does not target {0}. Current path: {1}" -f $BuildConfig.VsTargetArch, (Format-CommandPath -ResolvedPath $linkPath))
  }

  if ($environmentTarget -and ($environmentTarget -ne $BuildConfig.VsTargetArch)) {
    throw ("Visual Studio shell target arch mismatch. Current VSCMD_ARG_TGT_ARCH={0}, expected {1}." -f $environmentTarget, $BuildConfig.VsTargetArch)
  }
}

function Ensure-VsBuildEnvironment {
  param([pscustomobject]$BuildConfig)

  try {
    Assert-InstalledToolchain -BuildConfig $BuildConfig
  }
  catch {
    Write-Host $_.Exception.Message
    Invoke-Step 'Install Visual Studio build tools' { Install-VisualStudioToolchain -BuildConfig $BuildConfig }
    Assert-InstalledToolchain -BuildConfig $BuildConfig
  }

  if (
    (Test-ResolvedPathForTarget -ResolvedPath (Resolve-CommandPath -Name 'cl.exe') -TargetArch $BuildConfig.VsTargetArch -CommandName 'cl.exe') -and
    (Test-ResolvedPathForTarget -ResolvedPath (Resolve-CommandPath -Name 'link.exe') -TargetArch $BuildConfig.VsTargetArch -CommandName 'link.exe')
  ) {
    Assert-ActiveToolchainForTarget -BuildConfig $BuildConfig
    return
  }

  $vsShell = Resolve-VsDevShellPath
  if (-not $vsShell) {
    throw ("Visual Studio developer shell not found. Install Visual Studio Build Tools with: {0}" -f (Get-TargetInstallHint -BuildConfig $BuildConfig))
  }

  Write-Host ''
  Write-Host '==> Load Visual Studio developer shell'
  & $vsShell -Arch $BuildConfig.VsTargetArch -HostArch $BuildConfig.VsHostArch
  Assert-ActiveToolchainForTarget -BuildConfig $BuildConfig
}

function Ensure-Pnpm {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Host 'pnpm already available, skip Corepack enable.'
    return
  }
  & corepack enable pnpm --install-directory $CorepackInstallDirectory
}

function Ensure-RustTarget {
  param([pscustomobject]$BuildConfig)

  $installedTargets = & rustup target list --installed
  if ($installedTargets -contains $BuildConfig.WindowsTarget) {
    Write-Host ("Rust target already installed: {0}" -f $BuildConfig.WindowsTarget)
    return
  }
  & rustup target add $BuildConfig.WindowsTarget
}

function Invoke-WindowsBuild {
  param([pscustomobject]$BuildConfig)

  Assert-Windows
  Set-Location $ProjectRoot
  Assert-Command 'git' 'Install Git first.'
  Assert-Command 'node' 'Install Node.js first.'
  Assert-Command 'corepack' 'Install Node.js with Corepack support first.'
  Assert-Command 'cargo' 'Install Rust/Cargo first.'
  Assert-Command 'rustup' 'Install rustup first.'

  Invoke-Step 'Enable Corepack' { Ensure-Pnpm }
  Assert-Command 'pnpm' 'Run corepack prepare pnpm@latest --activate if pnpm is still missing.'
  Invoke-Step 'Ensure Rust target' { Ensure-RustTarget -BuildConfig $BuildConfig }
  Ensure-VsBuildEnvironment -BuildConfig $BuildConfig
  Invoke-Step 'Install pnpm dependencies' { pnpm install }
  Invoke-Step 'Run frontend tests' { pnpm test }
  Invoke-Step 'Run Rust tests' { cargo test --manifest-path .\src-tauri\Cargo.toml -- --nocapture }
  Invoke-Step $BuildConfig.BuildStepLabel { pnpm tauri build --target $BuildConfig.WindowsTarget }
}

Invoke-WindowsBuild -BuildConfig $Config
