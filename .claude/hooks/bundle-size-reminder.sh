#!/bin/bash
# PostToolUse observer (Edit|Write) — reminds Claude to run the MANUAL `npm run size` gate after
# touching the bundle surface (reactive/, dom/, or any barrel index.ts). `npm run size` is
# deliberately NOT wired into `check && test` (Kim's ruling, ADR-0040 §3) — bundle-size drift is
# invisible until someone remembers to run it by hand, so this hook is that reminder.
#
# Uses the PostToolUse lint-feedback channel: exit 2's stderr is fed to Claude (the tool already
# ran — this can never block the edit, only report after the fact). Never exits non-2 nonzero.
set -u

# The one matching decision, as a function so --selftest (GH #755) exercises the REAL logic.
# Reads the hook payload on stdin; exits via return code (0 quiet, 2 remind).
decide() {
  local input file_path basename match
  input=$(cat)
  file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

  [ -z "$file_path" ] && return 0

  basename=$(basename -- "$file_path")
  match=0

  case "$file_path" in
    *packages/agent-ui/components/src/reactive/*) match=1 ;;
    *packages/agent-ui/components/src/dom/*) match=1 ;;
  esac

  if [ "$basename" = "index.ts" ]; then
    case "$file_path" in
      *packages/agent-ui/components/src/*) match=1 ;;
    esac
  fi

  if [ "$match" = "1" ]; then
    echo "bundle surface touched ($file_path) — run \`npm run size\` before committing (the manual gz-budget gate, ADR-0040 §3)." >&2
    return 2
  fi

  return 0
}

# ── --selftest (GH #755): embedded fixtures through the REAL decide(), PASS/FAIL per row,
# exit 0 all-pass / 1 any-fail. Includes the audit's named trap (a non-barrel index.ts outside
# components/src must stay QUIET) + negative controls + malformed input. ──
selftest() {
  local failures=0

  check_row() {
    local expected="$1" label="$2" payload="$3" got
    printf '%s' "$payload" | decide 2>/dev/null
    got=$?
    if [ "$got" -eq "$expected" ]; then
      echo "  PASS  expected $expected got $got  $label" >&2
    else
      echo "  FAIL  expected $expected got $got  $label" >&2
      failures=$((failures + 1))
    fi
  }

  check_row 2 "reactive/ file reminds" '{"tool_input":{"file_path":"/repo/packages/agent-ui/components/src/reactive/signal.ts"}}'
  check_row 2 "dom/ file reminds" '{"tool_input":{"file_path":"/repo/packages/agent-ui/components/src/dom/props.ts"}}'
  check_row 2 "components barrel index.ts reminds" '{"tool_input":{"file_path":"/repo/packages/agent-ui/components/src/controls/index.ts"}}'
  check_row 0 "negative: a control source file is quiet" '{"tool_input":{"file_path":"/repo/packages/agent-ui/components/src/controls/button/button.ts"}}'
  check_row 0 "negative: THE NAMED TRAP — index.ts outside components/src is quiet" '{"tool_input":{"file_path":"/repo/site/lib/index.ts"}}'
  check_row 0 "negative: another package's index.ts is quiet (the matcher's scoped-to-components contract)" '{"tool_input":{"file_path":"/repo/packages/agent-ui/a2ui/src/index.ts"}}'
  check_row 0 "malformed: missing file_path is quiet" '{"tool_input":{}}'
  check_row 0 "malformed: empty stdin is quiet" ''

  if [ "$failures" -eq 0 ]; then
    echo "bundle-size-reminder --selftest: ALL PASS" >&2
    return 0
  fi
  echo "bundle-size-reminder --selftest: $failures FAILED" >&2
  return 1
}

if [ "${1:-}" = "--selftest" ]; then
  selftest
  exit $?
fi

decide
exit $?
