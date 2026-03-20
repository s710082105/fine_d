[CmdletBinding()]
param()

$config = [pscustomobject]@{
  WindowsTarget = 'aarch64-pc-windows-msvc'
  VsTargetArch = 'arm64'
  VsHostArch = 'amd64'
  BuildStepLabel = 'Build Windows ARM64 package'
}

& (Join-Path $PSScriptRoot 'build-windows-target.ps1') -Config $config
