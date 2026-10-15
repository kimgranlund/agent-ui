<!-- role=builder level=L2 model=opus effort=low -->
## Status
inherited red: the em-dash guard (`(guard)` diff over merge-base with main). The 6 lines still flagged are all red at base c484c5cc, and the step made none of them.

## Changes
- `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/.claude/docs/spec/a2ui-live-agent.spec.md`: bumped to v0.23 with a changelog line, and added an amendment pointer table at the head of section 3. Rows SPEC-R4, R5, R6 and R11 point to `response-type-selection.spec.md` (RTS-R8; R3 and R5; R7 and R11; R2).
- `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/.claude/docs/lld/a2ui-live-agent.lld.md`: added a status-line fold note and two new rows, `LLD-C3 (ADR-0242 fold)` and `LLD-C10 (ADR-0242 fold)`. New rows rather than edits to the existing rows, because the existing rows carry em dashes.
- `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/.claude/docs/references/agent-model.md`: glossary entries for `render_surface` and `textDelta`.
- `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/.claude/skills/a2ui-jsonl-mcp/references/producer-order-and-yield.md`: a paragraph on the tool round, and `textDelta` lines added to the yield order (the list is renumbered 1 to 5).
- `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/.claude/docs/prd/response-type-selection.prd.md`: Result cells filled for K3 (call counts, TTFT left pending-live), K4, K5, K6 and K7. New section "8. Known limitations" covers the RESIDUAL override-lexicon misfires and the two limits ADR-0242 already lists.
- `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/.claude/docs/adr/0242-render-surface-terminal-tool-response-type.md`: a Consequences bullet for the override-lexicon limit. Status stays `proposed`.
- `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/CHANGELOG.md`: a 2026-10-09 (T-0060) entry.
- `site/public/changelog-index.json` (from `generate-sitemap.mjs`) and `site/public/llms-full.txt` (from `generate-llms-full.mjs`): regenerated.
- `packages/agent-ui/a2ui/tools/agent/worker/index.ts`: the two T-0060 spreads moved to their own line with their own comment (handoff note 1).
- Comment-only em-dash fixes in lines earlier steps added or changed: `a2ui/src/agent/produce.ts` (2 comments), `a2ui/src/agent/session.ts`, `app/.../agent-admin/agent-admin{,-schema,.test}.ts`, `app/.../conversation/conversation{,.test}.ts`, `site/lib/admin-live-runner{,.test}.ts`, `site/lib/plan-runner{,.test}.ts`.
- Two local commits on `feat/response-type-selection`: db7d3d82 and 40ee9510. Nothing pushed.

## Checks
- `redck.py record` before any edit: exit 0, 4 red controls recorded.
- The four (red) criteria after the edits: all exit 0.
- doc_lint over the 6 listed docs: exit 0.
- `npx vitest run --project site site/lib/docs-grammar.test.ts site/lib/adr.test.ts site/lib/sitemap.test.ts`: exit 0 (202 tests).
- Scope guard: exit 0.
- `npm run check`: exit 0, run both before and after the final edits.
- `npm test -- --maxWorkers=4`, first run: exit 1. One failure: `site/lib/llms.test.ts`, because llms-full.txt was stale after my changelog entry. I regenerated it and the targeted test passed.
- `npm test -- --maxWorkers=4`, rerun: exit 0 (705 files passed, 2 skipped; 14,732 tests passed, 7 skipped).
- `npm run eval:agent-behavior -- selftest`: exit 0 (16 turns, 0 mismatches, pins ok). This is the K3, K4 and K5 evidence.
- Em-dash guard on HEAD: exit 1 with 6 lines.
- Em-dash guard at base, in a throwaway worktree under `.worktrees/tmp/0060-s9-builder-L2/base` (since removed): exit 1 with 29 lines. The 6 lines left on HEAD are among those 29.

## Notes
- The 6 remaining em-dash lines:
  - `assets.gen.ts`, the `grammar.md` entry.
  - `prompt-equivalence.baseline.json`, the default, defaultExplicit, specific and blueSky entries.
  - The `produce.ts` repair message string ("Re-emit the COMPLETE corrected A2UI JSONL — nothing else").
- The generated files hold the whole prompt as one line. `grammar.md` alone already has 71 em dashes, so any grammar change makes the guard fire on these lines. Clearing them would mean a prompt rewrite plus a baseline recapture, which is outside this step. The `produce.ts` string is runtime feedback to the model, and I left it unchanged. The guard probably needs to exclude `*.gen.ts` and `*.baseline.json` and the planner should decide that.
- The agent-admin `text-delta` to `handle.textDelta` mapping (`agent-admin.ts:3689`) still has no direct test. No existing test injects `surfaceTurn`, so adding one is not cheap here. It needs a follow-up ticket.
- K1, K2 and the TTFT half of K3 are left `pending` / `pending-live` for the conductor. `live-baseline.txt` is already present (43 cases, false-surface 1/23, missed-surface 0/20), but I did not copy it into the PRD.
- The K5 limitation is documented, not fixed: the lexicon wording I recorded in PRD section 8 and ADR-0242 comes from the step 10 verifier's RESIDUAL note. Whether to tighten the lexicon is a close-out decision.
