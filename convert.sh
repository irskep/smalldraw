#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
for pdf in "$DIR"/*.pdf; do
  name=$(basename "$pdf" .pdf)
  outdir="$DIR/$name"
  mkdir -p "$outdir"
  magick -density 150 "$pdf" -rotate 90 "$outdir/page-%03d.png"
done
