[CmdletBinding()]
param()

$config = [pscustomobject]@{
  WindowsTarget = 'i686-pc-windows-msvc'
  VsTargetArch = 'x86'
  VsHostArch = 'amd64'
  BuildStepLabel = 'Build Windows x86 package'
}

& (Join-Path $PSScriptRoot 'build-windows-target.ps1') -Config $config
