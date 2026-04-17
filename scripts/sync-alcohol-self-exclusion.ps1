$ErrorActionPreference = "Stop"

$source = "C:\Users\MatthewWhite247365\247365\FCRS - Documents\Web Content\Alcohol_Self_Exclusion.html"
$repoRoot = "C:\Users\MatthewWhite247365\Desktop\taxthechurch"
$targets = @(
  (Join-Path $repoRoot "Alcohol_Self_Exclusion.html"),
  (Join-Path $repoRoot "files\Alcohol_Self_Exclusion.html")
)

if (-not (Test-Path -LiteralPath $source)) {
  throw "Source file not found: $source"
}

foreach ($target in $targets) {
  $parent = Split-Path -Parent $target
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }

  Copy-Item -LiteralPath $source -Destination $target -Force
  Write-Host "Synced: $target"
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "  git add Alcohol_Self_Exclusion.html files/Alcohol_Self_Exclusion.html"
Write-Host "  git commit -m 'chore: sync Alcohol_Self_Exclusion from local source'"
Write-Host "  git push origin main"
