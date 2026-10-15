<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- #1 Fragment jsdom (ui-field labels, date-row, no ui-calendar, card surface): pass. Evidence: `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/concierge` shows 2 files, 29 tests passed.
- #2 Real-engine look and round trip (Chromium and WebKit): pass. Evidence: `npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/a2ui/src/catalog/personas/concierge` exit 0, 10 tests passed (project config pins chromium and webkit instances). The after screenshots agree with the test: all four labels are visible, dates are compact and side by side at 1000px and stacked at 400px, the summary has label-left and value-right (bold) rows with dividers from row 2, and Reserve is a full-width 36px pill. In after-measure.json the 400px form is x=32, w=336 and the field rects are x=51, w=298, so the ink is inset 19px.
- #3 Required marker only on the field's own label: pass. Evidence: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/field` exit 0, 16 tests passed. Negative control: the new field.browser.test.ts copied into a throwaway worktree at base 69679a73 fails both chromium and webkit on "the mark lands on the field label only, never on a slotted control's own [data-part=label] (T-0085)" (2 failed, 14 passed). The check bites.
- #4 Wire contract unchanged, budget and baseline hold: pass. Evidence: `git diff --stat 69679a73 HEAD` touches only concierge/{factories.ts, index.ts, factories.test.ts, concierge.browser.test.ts}, field.css and field.browser.test.ts, with no catalog.json, selection.json or prompt edit. `npx vitest run --project packages .../prompt-budget.test.ts .../prompt-equivalence.test.ts` shows 2 files, 52 tests passed.
- #5 Standing gate: pass. Evidence: `npm run check` exit 0 (tsc, check:site, check:tools, check:scripts; the log tail shows the testkit selftest negative control ok).
- #6 Screenshots: pass. Evidence: screens/ holds before and after at 400 and 1000 for stay details, booking and basic booking, plus after-stay-details-date-open-400 and -1000, plus the before and after measure JSON. I viewed the after stay-details at 400 and 1000 and the date-open at 1000.

Field.css regression sweep (the accepted out-of-scope file):
- `ui-field`'s own label, description and error parts are direct children (field.ts:#ensureParts prepends and appends them), so the child combinator `:scope >` loses nothing.
- Other `ui-field` consumers pass, each run on the built tree: the `packages` project select, combo-box, form-provider and calendar.browser (10 files, 302 tests), the calendar visual golden (`--project visual`, 4 tests), and a2ui date-field-a2ui-mount (packages-rest, 8 tests with the concierge browser test).
- The CSS-only part is stylesheet scope, so consumers in the site and app packages were not re-run. They are covered by CI's full suite.

## Out of scope changes
packages/agent-ui/components/src/controls/field/field.css and field.browser.test.ts. The lead accepted this; the sweep above found no regression. Nothing in croupier, quizmaster, product-card, board-grid or game-hud.

## For the next attempt
None.

NOTES, open items, none a fail:
- The date popover opens on today's month (October 2026), not on the field's selected date (November 2026). The screenshot shows this.
- Dates display as ISO (2026-11-14).
- The summary prints true or false for booleans.
- ADR-0243 Amendment 2 does not mention BookingForm's 36px button.
- Not re-run: the site and app browser tests that mount `ui-field` (entry-list, settings, workbench and the other site pages). They are covered by CI.
