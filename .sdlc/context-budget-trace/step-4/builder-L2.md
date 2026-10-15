<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
- `.claude/docs/adr/0234-turn-trace-prompt-budget-and-token-usage.md`: new ADR. Status `proposed`, Ratified by `pending Kim`. Cites ADR-0073/0088/0146/0200/0232 and #1809/#1797, and carries all six clauses. The H1 is the only U+2014 dash.
- `site/public/adr-index.json`: regenerated with `node scripts/generate-sitemap.mjs`. It now has the `#adr-0234` entry.
- `site/lib/docs-grammar.test.ts`: `233` added to `KNOWN_GAPS`, with a reserved-in-flight note for the no-barrels lane (the 192/193 precedent).
- `.claude/docs/spec/a2ui-live-agent.spec.md`:
  - header bumped to v0.19 with a changelog entry, and the TurnTrace definition updated;
  - SPEC-R6 gains a whole-prompt budget paragraph and AC8, plus a matching AC8 row in the traceability table;
  - the typed contract gains `prompt?`/`usage?` and the `TokenUsage`, `PromptSection` and `PromptBudgetReport` types;
  - the SSE note covers usage extraction and `PROMPT_OVER_BUDGET`;
  - SPEC-R29 AC3 and SPEC-R30 AC3 now read "apart from `trace.prompt` (ADR-0234)", each on its own physical line.
- `.claude/docs/lld/a2ui-live-agent.lld.md`:
  - LLD-C3 covers the budget report, the halt and the usage sum;
  - LLD-C4 covers `buildSystemPromptSections`;
  - LLD-C10 covers `newUsageCollector` and one usage event per request;
  - in the module tree, the `meta-line.ts` row gains the new types and a new `prompt-budget.ts` row sits beside `selection-guidance.ts`.
- `.claude/docs/spec/devtools-harness.spec.md`: SPEC-R7 `turn-end` is now `{status, lines, ms, usage?}`, latched from the meta trace, with capture version 1.
- `.claude/skills/a2ui-jsonl-mcp/references/record-and-replay.md`: states that `turn-end` carries an optional `usage`.
- `.claude/skills/a2ui-prompt-authoring/SKILL.md`: a whole-prompt budget bullet beside the selection-guidance one.
- `packages/agent-ui/a2ui/AGENTS.md`: a byte-pinned prompt stack bullet naming `prompt-budget.test.ts`.
- `.claude/docs/references/agent-model.md`: a `**prompt budget**` glossary entry after selection guidance.
- `packages/agent-ui/a2ui/src/agent/selection-guidance.ts`: a comment-only cross-reference to `prompt-budget.ts`.

## Checks
- AC1 (ADR exists with Status `proposed` and every citation): PASS
- AC2 (`#adr-0234` in `site/public/adr-index.json`): PASS
- AC3 guard `npx vitest run --project site site/lib/docs-grammar.test.ts site/lib/sitemap.test.ts site/lib/adr.test.ts`: exit 0, 199 tests passed
- AC4 (SPEC and LLD strings): PASS
- AC5 (`apart from trace.prompt` count): PASS, count 3 (at least 2 required)
- AC6 (devtools SPEC and record-and-replay): PASS
- AC7 (skill, entry file, glossary, comment): PASS
- AC8 guard (prompt-equivalence baseline unchanged against base): PASS
- AC9 guard (U+2014 dash counts): PASS
- AC10 guard `npm run check`: exit 0
- AC11 guard `npm test`: exit 0. 631 test files passed and 1 skipped; 12737 tests passed and 6 skipped.
- AC12 guard (changed-file allowlist): PASS
- `doc_lint.py` on the 5 touched docs under `.claude/docs`: each exits 0 but prints "not a functional document". The only copy found is in the plugin trash dir, so this check effectively tested nothing.

## Notes
- The tree I started from already had steps 1-2 in the base wip commit `dce7f6fe`. Step 3 was uncommitted: changes to `providers/anthropic.ts` and the new `anthropic-usage.test.ts`. No gate went red, so I made no code fixes.
- No-change dispositions (all left untouched):
  - `a2ui-chat.spec.md` (:46, :121) and `a2ui-chat.lld.md` (:29, :128, :222) name consumed fields only.
  - `app-surfaces-m2.lld.md:139` has no field list.
  - `genui-surface.spec.md:145,429` and `line-framing-and-heal.md:87` name single fields only. `genui-surface.spec.md:43,564` are prompt-byte claims, not stream claims.
  - `producer-order-and-yield.md` needs no change.
  - `gh716-builder-mission.spec-amendment.md:71-74` is a dated amendment sheet and stays. `git grep -n "gate OFF whose model" .claude/docs/spec` finds only SPEC-R30 AC3, now at `a2ui-live-agent.spec.md:1167`.
  - `roadmap.md` and `plan.md` have 0 hits for #1797 or #1809.
  - The root `AGENTS.md` Gates line already covers the budget leg, which runs inside `npm test`.
  - ADR-0232 is untouched.
- Two ADR claims were written from the step 1-3 code and not traced line by line:
  - an over-budget halt fires before any provider call (`produce.ts:1025`);
  - `buildSystemPrompt` delegates to `buildSystemPromptSections`, so their output is byte-identical.
