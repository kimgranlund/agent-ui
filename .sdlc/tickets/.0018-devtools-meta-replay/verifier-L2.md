<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- AC1: pass. `replay.test.ts` "every arm replays as an a2uiMeta line, interleaved with line events in the capture order" is green. The fixture holds all 10 arms, one meta event each, with line events interleaved. Run against the pre-change `replay.ts` in a throwaway worktree, 6 of the new tests go red (including this one), so the check bites.
- AC2: pass. The `readMetaLine` round-trip test and "byte-identical run over run" test are green (`npx vitest run --project packages packages/agent-ui/devtools`: 10 files, 90 tests, exit 0). Both go red against the old `replay.ts`.
- AC3: pass. The "no meta events replays exactly its line payloads" test is green. `git diff HEAD^1 HEAD` on `replay.test.ts` shows only the one base fixture split, which dropped its single `meta` event. The format and debug-export tests are untouched and pass.
- AC4: pass. The recordTurn, replayTransport, recordTurn round-trip test uses `toStrictEqual` over two turns with every arm. It checks `status: 'halt'` and `usage`, and goes red on the old `replay.ts`.
- AC5: pass. `ARM_FIXTURES` is typed `{ [K in keyof DevtoolsMeta]-?: DevtoolsMeta }`. In the throwaway worktree I added `nc?: string` to `A2uiMetaEnvelope`, and `tsc --noEmit` failed with TS2741 at `replay.test.ts(40,7)` (property 'nc' missing). The worktree is removed. `npm run check` passes on the real tree (exit 0).
- AC6: pass. `layering.test.ts` has no diff and runs inside the green devtools project. The `replay.ts` diff has 0 added `import` lines.
- AC7: pass. ADR-0239 is on disk with Status `proposed` and `Extends` ADR-0200. The highest ADR number on `origin/main` is 0238. No local or remote branch has a 0239 or higher ADR, and the only 0239 across the sibling worktrees is this one. The ADR-0200 diff is one line, the header cell, and it now says `Extended by` ADR-0239.
- AC8: pass. I read the diff hunks for SPEC R3 (body plus new AC3), R7, R10 (AC1 plus new AC4), the N1 note, agent-model SPEC-R27, and the `a2ui-jsonl-mcp` skill (`record-and-replay.md`, `SKILL.md`, `intent.md`, `evals.json` t06). Each one's old "line-only" wording is replaced by the meta-line wording. This is a doc read, not a runtime check.
- AC9: pass.
  - `site/public/adr-index.json` lists ADR-0239.
  - Re-running `node scripts/generate-sitemap.mjs` exits 0 and `git status --short` stays empty, so there is no drift.
  - `npm run check` exits 0.
  - The devtools project exits 0 (90 tests).
  - `npm test` exits 0 (687 files passed, 14191 tests passed).
- AC10: pass. Word-diff of added text shows one em dash, the ADR-0239 H1 separator. The ADR-0200 header line was rewritten, but its existing em dashes were already there. In the SPEC diff the em dash appears only on a removed line.

## Out of scope changes
None. The commit touches `replay.ts`, its test, and comment-only edits in `format.ts` and `events.ts`. The rest is ADR-0239, the ADR-0200 header cell, the two specs, the `a2ui-jsonl-mcp` skill and `adr-index.json`. All of it falls under AC7 to AC9. `recordTurn`, the `DevtoolsEvent` vocabulary and `layering.test.ts` have no code diff.

## For the next attempt
None
