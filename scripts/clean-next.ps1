$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$nextPath = Join-Path $root ".next"

if (Test-Path $nextPath) {
  Remove-Item -LiteralPath $nextPath -Recurse -Force
  Write-Host "Removed .next cache."
} else {
  Write-Host ".next cache not found."
}
