#!/bin/bash
# ============================================
# Clone all Amorn-P repos in one shot
# Usage: bash clone-all.sh [target-folder]
# ============================================

TARGET="${1:-$HOME/Projects}"

REPOS=(
    "Amorn-P/openclaw-workspace"
    "Amorn-P/esp32-lora"
    "Amorn-P/CherryFarm"
    "Amorn-P/Communication-core"
)

echo "=== Cloning into: $TARGET ==="
mkdir -p "$TARGET"

for repo in "${REPOS[@]}"; do
    url="https://github.com/$repo.git"
    name=$(basename "$repo")
    dest="$TARGET/$name"

    if [ -d "$dest" ]; then
        echo "[SKIP] $name already exists"
    else
        echo "[CLONE] $url"
        git clone "$url" "$dest" || echo "[FAIL] $name — check your git auth"
    fi
done

echo ""
echo "=== Done! ==="
