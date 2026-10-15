<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- 1 (data-driven hands taught): pass. Evidence: the diff `d8417cf1..HEAD` of `card-layout.md` and `game-table-chrome.md` shows the "A hand is DATA… /dealerHand or /playerHand… templated Row" and "Compute each total from the cards you list" text and the `/dealerTotal or /playerTotal… stating the total only` binding. The Croupier preset in `site/pages/agent-admin-presets.ts` says the same. `mini-skills.test.ts` has a token-budget assertion for both modules, and `vitest run packages/agent-ui/a2ui/src` passed. No `catalog.json` is in the diff.
- 2 (templated hand renders in jsdom): pass. Evidence: `templated-hand.test.ts` passed in the targeted run (7 files, 134 tests, exit 0).
- 3 (generic opt-in hook): pass. Evidence:
  - `produce.ts:1243-1250` runs the checks after validation, feeds findings to the repair round, and tallies `SEMANTIC_UNCORRECTED` / `SEMANTIC_CHECK_ERROR`.
  - `semanticChecksDeps` is called at `dev-proxy-plugin.ts:408` and `worker/index.ts:287`, both for the selected catalog.
  - `produce-semantic-checks.test.ts` covers the bound-ship and fail-open paths and passed.
- 4 (evidence fails the Croupier check with one HAND_TOTAL finding): pass. Evidence: `checks.test.ts` passed. Mutating `croupierHandConsistency` to `check: () => []` in a throwaway worktree turned 10 tests red, including "fails the evidence with exactly one finding… 17 over cards that total 14". I did not read the finding text itself; the test name stands in for that.
- 5 (scripted `produce()` run: one repair round, `rounds === 2`): pass. Evidence: `produce-semantic-checks.test.ts` passed 8/8. Disabling the call site (`if (false) {`) in the throwaway worktree turned 5 tests red, including "exactly one repair round… trace.rounds 2" and "ships with SEMANTIC_UNCORRECTED tallied", so the wiring is covered, not just the helpers.
- 6 (no checks means byte-identical; baseline moved only two entries): pass. Evidence: the test at `produce-semantic-checks.test.ts:131-141` covers absent, empty and always-passing checks and passed. The baseline diff touches only the `card-layout` and `game-table-chrome` bodies.
- 7 (croupier `seedDigest` refreshed, `seedVersion` 6): pass. Evidence: `croupier.manifest.json` has a new digest and `seedVersion` is still 6. `npx vitest run site/lib/agent-manifest` passed 17 tests, so the digest matches the drift gate.
- 8 (ADR proposed, records repaired, no new em dashes): pass. Evidence:
  - ADR-0238 header reads `Status | proposed`, "Ratified by (pending)".
  - SPEC `a2ui-live-agent` is v0.21 and `persona-catalog-composition` is v0.5.
  - The LLD, `agent-model.md`, the three skills (including `producer-order-and-yield.md` under `a2ui-jsonl-mcp`) and `a2ui/AGENTS.md` are in the diff.
  - `adr-index.json` gains an ADR-0238 entry.
  - Per-file comparison of added versus removed em dashes finds a net increase only in the ADR H1.
- 9 (gates by exit code): pass. Evidence, all exit 0:
  - `npm run check` (exit 0)
  - `npx vitest run --project packages packages/agent-ui/a2ui/src` (123 files passed, 1 skipped)
  - `npx vitest run --project tools packages/agent-ui/a2ui/tools` (29 files, 381 tests passed)
  - `npm run eval:agent-behavior -- selftest` (exit 0)
  - `npm test` (653 files passed, 2 skipped; 13445 tests passed, 7 skipped)

Builder file: no `builder-*.md` exists in the artifacts dir, so there were no builder claims to check. Steelman: I considered failing criterion 8 because the preset comment and ADR cite "T-0016" while the ticket is T-0017. A builder would answer that the criterion asks for no ticket-id match. The ticket's own acceptance criteria say nothing about it, so I dropped the finding.

## Out of scope changes
None. All 33 changed files (`git diff --stat d8417cf1 HEAD`) map to criteria 1-8 or their tests, with two extras:
- `site/lib/docs-grammar.test.ts` (+5 lines) is not named in the handoff. It sits with the ADR-0238 record repair; the full suite passes.
- `.sdlc/` is untracked, which is expected.

## For the next attempt
None
