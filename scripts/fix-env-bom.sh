#!/usr/bin/env bash
# Remove BOM UTF-8 (0xEF 0xBB 0xBF) de arquivos .env.local
#
# CAUSA: Vercel CLI no Windows escreve env files com encoding "UTF-8 with BOM",
#        causando Node v22+ a incluir o caractere invisível no valor da env var
#        (https://github.com/vercel/vercel/issues/7349).
#
# QUANDO RODAR: após `vercel env pull` no Windows. No Linux/macOS é no-op.
#
# Uso:
#   ./scripts/fix-env-bom.sh             # corrige .env.local de todos apps
#   ./scripts/fix-env-bom.sh path/to/env # corrige arquivo específico

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -gt 0 ]]; then
  FILES=("$@")
else
  FILES=()
  for f in apps/web/.env.local apps/patient/.env.local apps/marketing/.env.local; do
    [[ -f "$f" ]] && FILES+=("$f")
  done
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "no .env.local files found"
  exit 0
fi

total=0
for f in "${FILES[@]}"; do
  before=$(wc -c < "$f")
  # Strip all UTF-8 BOM occurrences
  perl -i -pe 's/\xef\xbb\xbf//g' "$f"
  after=$(wc -c < "$f")
  removed=$((before - after))
  if [[ $removed -gt 0 ]]; then
    bom_count=$((removed / 3))  # cada BOM = 3 bytes
    echo "✓ $f: $bom_count BOM(s) removed"
    total=$((total + bom_count))
  else
    echo "  $f: clean"
  fi
done

echo "---"
echo "Total: $total BOM(s) removed across ${#FILES[@]} file(s)"
