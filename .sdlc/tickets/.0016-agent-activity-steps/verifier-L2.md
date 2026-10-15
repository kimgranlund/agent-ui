<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- 1. Neutral model exists: pass. `activity-step.ts` defines `ActivityStep` (id, kind, label, status running|ok|repaired|failed, optional startedAt, durationMs, summary, raw) and `ActivityFooter` (rounds, inputTokens, outputTokens, model). `grep import` on the file returns nothing, so it imports no a2ui, catalog or DOM. `conversation.ts` re-exports the types, and `@agent-ui/app/conversation` maps to `conversation.ts` in `package.json:39`.
- 2. `steps` prop and `step()`/`footer()`: pass. `conversation.ts` has a reflected `steps` prop defaulting to false, sampled once per turn via `const withSteps = this.steps`. Handle methods `step` and `footer` exist, and `appendSettleRows` adds one "Raw output" row and an optional footer row. `progress` and `ingestLine` add no rows in step mode. Tests for upsert, live elapsed, frozen duration, repaired marker, silent legacy narration, raw once and footer pass. `npx vitest run` on the conversation, status-stream, agent-admin and site tests: 42 files, 990 tests, exit 0. The browser tests pass (below).
- 3. Opt-in default byte-identical: pass. Test "OPT-IN DEFAULT ... byte-identical" is green. Negative control in a throwaway worktree: changing step()'s gate to `if (ended) return` turned that test and the "samples ONCE per turn" test red (2 failed), so the test bites.
- 4. A2UI adapter at `site/lib/a2ui-activity.ts`: pass. `a2ui-activity.test.ts` covers per-step timing, "repaired in round 2", footer from trace, and malformed-trace degradation, all green. The NO TYPE NAMES test uses distinct words (quokka, zebra, catalog, createSurface and others) and asserts the delete row exists first, so it is not vacuous. Raw is attached once (the raw-dedup negative control below went red).
- 5. Non-A2UI fixture: pass. Test "step mode is general purpose: a plain tool-calling chat renders through it" in `conversation.test.ts` is green.
- 6. Test Chat opt-in and runner wiring: pass. `agent-admin.ts` sets `conversation.steps = true` for both the Test Chat and the builder interview. It forwards `step` and `footer` events to `handle.step`/`handle.footer`. `admin-live-runner.ts` feeds stages, trace and lines to `createA2uiActivity()`. `git diff` shows no change to `meta-line.ts`, `produce.ts` or any wire format. `agent-admin-activity-steps.test.ts` is green.
- 7. ADR-0159 amendment: pass. `0159-status-stream-receipt-pattern.md:170` is `## Amendment (2026-10-06, **proposed**)`, and line 7 still reads `Status | accepted`. The diff removes no lines from the ADR. `ls .claude/docs/adr | grep -E '^023[5-9]'` returns only the pre-existing 0235.
- 8. Records repaired: pass. The diff updates `conversation.md`, `status-stream.md` (`sourceLabel`), the `agent-model.md` glossary and its symbol table, and the `agent-authoring-flow.lld.md` opt-in line (`receipt`/`steps`).
- 9. Gates by exit code: pass. Re-run on this tree:
  - `npm run check` exit 0.
  - `npm test` exit 0 (652 files passed, 2 skipped; 13435 tests passed, 7 skipped).
  - `npm run size` exit 0.
  - Browser run of `conversation.browser.test.ts` and `status-stream.browser.test.ts` exit 0 (4 files, 164 tests).
  - `npm run e2e:admin` exit 0 (25 passed, 0 failed, with `chat-surface-render` ok).
  - The builder's `/tmp/t0016/e2e-neg.txt` shows that assertion red when the opt-in is off.
- 10. No new em dashes: pass. Per-file counts of `—` in added versus removed lines are equal in the four files that have any, so the additions are only moved pre-existing characters: `conversation.md` 1/1, `status-stream.md` 8/8, `dogfood-assets.ts` 14/14, and 0/2 and 0/3 in `agent-admin.test.ts` and `agent-admin.ts`. A word-level diff of the three files with equal counts shows 0 added words containing `—`. The new files (`activity-step.ts`, `a2ui-activity.ts`, `activity-step.test.ts`, `a2ui-activity.test.ts`, `agent-admin-activity-steps.test.ts`) have none.

Raw-dedup negative control: replacing the `Set` in `joinActivityRaw` with a plain array turned the `joinActivityRaw` test and the "raw output shows ONCE" test red (2 failed), so the dedup check bites. The throwaway worktree was removed and `git status` shows only untracked `.sdlc/`.

## Out of scope changes
None. `dogfood-assets.ts` is the generated bundle of the `status-stream` `sourceLabel` change, and word-diff shows only that change plus the length constant. `site/public/llms-full.txt` (+5 lines) is the generated mirror of the `conversation.md` change. The `agent-admin.test.ts` edit follows from the `sources` to `steps` swap. Checked with `git diff --stat d8417cf1..HEAD` and the word-diff of the dogfood bundle.

## For the next attempt
None
