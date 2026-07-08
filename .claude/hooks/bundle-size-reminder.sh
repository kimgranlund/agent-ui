#!/bin/bash
# PostToolUse observer (Edit|Write) — reminds Claude to run the MANUAL `npm run size` gate after
# touching the bundle surface (reactive/, dom/, or any barrel index.ts). `npm run size` is
# deliberately NOT wired into `check && test` (Kim's ruling, ADR-0040 §3) — bundle-size drift is
# invisible until someone remembers to run it by hand, so this hook is that reminder.
#
# Uses the PostToolUse lint-feedback channel: exit 2's stderr is fed to Claude (the tool already
# ran — this can never block the edit, only report after the fact). Never exits non-2 nonzero.
set -u
INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')

[ -z "$FILE_PATH" ] && exit 0

BASENAME=$(basename -- "$FILE_PATH")
MATCH=0

case "$FILE_PATH" in
  *packages/agent-ui/components/src/reactive/*) MATCH=1 ;;
  *packages/agent-ui/components/src/dom/*) MATCH=1 ;;
esac

if [ "$BASENAME" = "index.ts" ]; then
  case "$FILE_PATH" in
    *packages/agent-ui/components/src/*) MATCH=1 ;;
  esac
fi

if [ "$MATCH" = "1" ]; then
  echo "bundle surface touched ($FILE_PATH) — run \`npm run size\` before committing (the manual gz-budget gate, ADR-0040 §3)." >&2
  exit 2
fi

exit 0
