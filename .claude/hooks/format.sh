#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): format the file Claude just changed. Fast, never blocks.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path??"")}catch{}})')
[[ -z "$file" || ! -f "$file" ]] && exit 0
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.mts|*.json|*.jsonc|*.css) ;;
  *) exit 0 ;;
esac
[[ -x node_modules/.bin/biome ]] || exit 0
node_modules/.bin/biome check --write --no-errors-on-unmatched --files-ignore-unknown=true "$file" >/dev/null 2>&1 || true
exit 0
