#!/usr/bin/env bash
# PostToolUse hook: nuxi typecheck after .ts/.vue edits
# Non-blocking (exit 0/1) — shows TS errors as info, doesn't block agent

source "$HOME/.nvm/nvm.sh" --no-use 2>/dev/null
nvm use 22 --silent 2>/dev/null

FILE=$(jq -r ".tool_input.file_path // empty")
[[ "$FILE" == *.ts || "$FILE" == *.vue ]] || exit 0

ERRORS=$(npx nuxi typecheck 2>&1 | grep -E "error TS" | grep -v "node_modules" | head -10)
[ -n "$ERRORS" ] && echo "$ERRORS" >&2 && exit 2
exit 0
