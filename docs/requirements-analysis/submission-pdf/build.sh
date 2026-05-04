#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_MD="$ROOT_DIR/校园生活平台需求分析报告.md"
OUTPUT_PDF="$ROOT_DIR/校园生活平台需求分析报告.pdf"
MERMAID_DIR="$ROOT_DIR/assets/mermaid"
RENDERED_DIR="$ROOT_DIR/assets/rendered"

mkdir -p "$RENDERED_DIR"

for src in "$MERMAID_DIR"/*.mmd; do
  out="$RENDERED_DIR/$(basename "${src%.mmd}.png")"
  curl -fsSL \
    -X POST \
    -H 'Content-Type: text/plain' \
    --data-binary @"$src" \
    'https://kroki.io/mermaid/png?scale=2' \
    -o "$out"
done

pandoc "$SOURCE_MD" \
  --from markdown+raw_tex \
  --pdf-engine=xelatex \
  --resource-path="$ROOT_DIR" \
  -o "$OUTPUT_PDF"

echo "PDF generated at: $OUTPUT_PDF"
