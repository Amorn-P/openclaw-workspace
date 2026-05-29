# ============================================
# Clone all Amorn-P repos in one shot
# Usage: .\clone-all.ps1 [target-folder]
# ============================================

param(
    [string]$Target = "$HOME\Projects"
)

$repos = @(
    "Amorn-P/openclaw-workspace",
    "Amorn-P/esp32-lora",
    "Amorn-P/CherryFarm",
    "Amorn-P/Communication-core"
)

Write-Host "=== Cloning into: $Target ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $Target | Out-Null

foreach ($repo in $repos) {
    $url = "https://github.com/$repo.git"
    $name = $repo.Split('/')[1]
    $dest = Join-Path $Target $name

    if (Test-Path $dest) {
        Write-Host "[SKIP] $name already exists" -ForegroundColor Yellow
    } else {
        Write-Host "[CLONE] $url" -ForegroundColor Green
        git clone $url $dest
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[FAIL] $name — check your git auth" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== Done! ===" -ForegroundColor Cyan
