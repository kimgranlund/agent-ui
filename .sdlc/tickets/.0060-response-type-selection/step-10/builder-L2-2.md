<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
- `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/packages/agent-ui/a2ui/src/agent/response-type.ts`: removed `render` and `in words`. `show me`, `build a` and `make me a` now count only when one of the 16 surface nouns follows within the next four words. `as a card/table/chart` and the whole-word boundary are unchanged, and text still wins a tie.
- `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/packages/agent-ui/a2ui/src/agent/response-type.test.ts`: removed the `say it in words` and `Render it` cases and changed `make me a quiz` to `make me a quiz form`. Added `describe('lexicon false positives')` with the seven no-override phrases, four phrases that must still give surface, and two that must still give text.
- `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/.claude/docs/spec/response-type-selection.spec.md`: the RTS-R6 lexicon text now matches the code, a new AC4 lists the false positives, and the status line is v0.3.
- Committed locally as c484c5cc on feat/response-type-selection. Not pushed.

## Checks
- `redck.py record handoff.md` (before any edit): recorded 3 pre-edit controls as red, exit 0.
- Criterion 1 (node detectUserOverride script): exit 0.
- Criterion 2 (vitest `-t "lexicon false positives"` plus the passed grep): exit 0.
- Criterion 3 (python check that `'render'` and `'in words'` are gone): exit 0.
- Criterion 4 (guard, vitest on response-type, layering and produce-response-type): exit 0.
- Criterion 5 (guard, vitest tools project on agent-eval): exit 0.
- Criterion 6 (guard, doc_lint on the SPEC): exit 0.
- Criterion 7 (guard, scope loop against the base sha): exit 0.
- `npx tsc -p tsconfig.json`: exit 0.

## Notes
Under the new noun gate, `make me a quiz` no longer counts as a surface override because quiz is not a surface noun. The existing test was updated to match.
