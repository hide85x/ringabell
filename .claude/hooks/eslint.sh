#!/usr/bin/env bash
# PostToolUse hook: ESLint on edited .ts/.vue files
# Reads hook payload from stdin (Claude Code passes JSON)

source "$HOME/.nvm/nvm.sh" --no-use 2>/dev/null
nvm use 22 --silent 2>/dev/null

FILE=$(jq -r ".tool_input.file_path // empty")
[ -n "$FILE" ] || exit 0
[[ "$FILE" == *.ts || "$FILE" == *.vue ]] || exit 0

OUTPUT=$(npx eslint --quiet "$FILE" 2>&1)
CODE=$?
[ $CODE -ne 0 ] && echo "$OUTPUT" >&2 && exit 2
exit 0
