#!/usr/bin/env bash
# PostToolUse hook: scoped unit tests for risk-area files
# Risk areas: server/utils/, server/api/admin/, utils/
# Reads hook payload from stdin (Claude Code passes JSON)

source "$HOME/.nvm/nvm.sh" --no-use 2>/dev/null
nvm use 22 --silent 2>/dev/null

FILE=$(jq -r ".tool_input.file_path // empty")
[ -n "$FILE" ] || exit 0

# Only .ts files, skip .d.ts and test files themselves
[[ "$FILE" == *.ts ]] || exit 0
[[ "$FILE" == *.d.ts ]] && exit 0
[[ "$FILE" == *.test.ts ]] && exit 0
[[ "$FILE" == *.integration.test.ts ]] && exit 0

# Only risk areas defined in test-plan.md §2
if [[ "$FILE" != */server/utils/* ]] && \
   [[ "$FILE" != */server/api/admin/* ]] && \
   [[ "$FILE" != */utils/* ]]; then
  exit 0
fi

OUTPUT=$(AI_AGENT=1 npx vitest related "$FILE" --run --project unit 2>&1)
CODE=$?
[ $CODE -ne 0 ] && echo "$OUTPUT" >&2 && exit 2
exit 0
