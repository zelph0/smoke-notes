#!/usr/bin/env bash
# Stop hook: typecheck + lint before Claude may finish. Exit 2 feeds the errors back to
# Claude, which must fix them. Unit/e2e tests run in CI, not here (keep this under ~30s).
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
input=$(cat)

# Already blocked once and still failing: let Claude stop and report instead of looping.
if [[ "$input" == *'"stop_hook_active":true'* ]]; then exit 0; fi

# Nothing changed since the last commit: nothing to check.
if git diff --quiet HEAD -- 2>/dev/null && [[ -z "$(git ls-files --others --exclude-standard 2>/dev/null)" ]]; then
  exit 0
fi

if ! output=$(SKIP_ENV_VALIDATION=1 pnpm -s typecheck 2>&1); then
  { echo "Typecheck failed. Fix these before finishing:"; echo "$output" | grep -v "^Generating route types\|Types generated" | tail -40; } >&2
  exit 2
fi
if ! output=$(pnpm -s lint 2>&1); then
  { echo "Lint failed (try \`pnpm lint:fix\`). Fix these before finishing:"; echo "$output" | tail -40; } >&2
  exit 2
fi
exit 0
