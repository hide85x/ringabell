#!/usr/bin/env bash
# Pre-push hook: typecheck + unit tests before push
# Install: cp .claude/hooks/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push

source "$HOME/.nvm/nvm.sh" --no-use 2>/dev/null
nvm use 22 --silent 2>/dev/null

echo "pre-push: typecheck..."
ERRORS=$(npx nuxi typecheck 2>&1 | grep -E "error TS" | grep -v "node_modules" | head -10)
if [ -n "$ERRORS" ]; then
  echo "❌ Typecheck failed:" >&2
  echo "$ERRORS" >&2
  exit 1
fi

echo "pre-push: unit tests..."
npx vitest run --project unit 2>&1
CODE=$?
if [ $CODE -ne 0 ]; then
  echo "❌ Unit tests failed" >&2
  exit 1
fi

echo "✅ Pre-push checks passed"
exit 0
