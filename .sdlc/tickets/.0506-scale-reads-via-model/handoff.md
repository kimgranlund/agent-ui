---
id: T-0506
title: "Tests and scripts read derived geometry from foundations-model.mjs, not the repo scale.mjs tiers directly"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L3
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 60
---

## Goal
Tests and scripts that need derived geometry read it from `scripts/lib/foundations-model.mjs` (or the generated foundations CSS), so the repo `packages/agent-ui/shared/src/tokens/scale.mjs` is read only by the generator and the model itself.

## Intent
- Do: list every reader of `tokens/scale.mjs` (grep shows generate-foundations.mjs, foundations-census.mjs, foundations-rules.mjs, foundations-model.mjs, probe/run.ts, foundations.test.ts and about a dozen *.browser.test.ts files); move each reader that is not the generator, the model or the drift test onto foundations-model.mjs exports, adding a model export only where one is missing; keep every expected value identical.
- Non-goals: changing any geometry value, the generator output, or ADR-0245 coefficients; the T-0353 alias cleanup.
- Done when: `grep -rln 'tokens/scale\.mjs' scripts packages site` lists only the generator, the model, the drift test and the vendor types (any other survivor justified in the report); `npm run check`, `node scripts/generate-foundations.mjs --check` and the touched tests (browser ones through `scripts/gate_lock.py`) exit 0.

## Context
T-0493 moved foundations-probe onto foundations-model.mjs; its builder listed the remaining direct readers. Generated foundations files are drift-gated (AGENTS.md, Never hand-edit).

## Acceptance criteria
- `grep -rln 'tokens/scale\.mjs' scripts packages site` lists only scripts/generate-foundations.mjs, scripts/lib/foundations-model.mjs, packages/agent-ui/shared/src/tokens/foundations.test.ts, the vendored scale.d.mts and scripts/foundations-census.mjs (selftest path strings, no import).
- `npm run check` exits 0.
- `node scripts/generate-foundations.mjs --check` exits 0.
- `npx vitest run packages/agent-ui/shared/src/tokens/foundations.test.ts packages/agent-ui/components/src/controls/button/button-geometry.test.ts packages/agent-ui/components/src/controls/text-field/text-field-geometry.test.ts site/lib/shell-spacing-gate.test.ts` exits 0.
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.39.0/scripts/gate_lock.py run --need compute_units=4 --nice -- npx vitest run --config vitest.browser.config.ts --project packages $(git diff --name-only 97e49c89b1b143f23e1b12f1f8c8ae393516c3e1 -- packages | grep 'browser.test.ts$')` exits 0 (the focus-timing and visual files drop out of this project by its own exclude).
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.39.0/scripts/gate_lock.py run --need compute_units=4 --nice -- npx vitest run --config vitest.browser.config.ts --project focus-timing packages/agent-ui/app/src/controls/super-shell/super-shell-responsive.browser.test.ts packages/agent-ui/code/src/editor/editor.browser.test.ts packages/agent-ui/components/src/controls/textarea/textarea.browser.test.ts packages/agent-ui/components/src/controls/toolbar/toolbar.browser.test.ts` exits 0.
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.39.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts --project visual packages/agent-ui/app/src/controls/super-shell/super-shell.visual.browser.test.ts` exits 0.
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.39.0/scripts/gate_lock.py run --need compute_units=4 --nice -- npx vitest run --config vitest.browser.config.ts --project site site/gallery.browser.test.ts site/pages/a2ui-live.browser.test.ts site/pages/command-modal-demo.browser.test.ts site/pages/gen-ui-live-narrow.browser.test.ts site/pages/highlight-doc.browser.test.ts -t '^(?!.*negative control: an unrelated fixed 12px)'` exits 0. The one test it leaves out, a2ui-live's 12px negative control, reads no resolve() value and fails the same way on main at 226589606, without this change.

## Constraints
No geometry value changes; generated files only via their scripts. No em dashes.
- Lane: full because size L3 (steps.py lane)
- Lane: solo L3 because Kim approved solo over the full chain (mechanical move, drift-gated)

## Outcome

2026-10-28 · lane: full L3 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 97e49c89b1b1
- Changed: Tests and scripts read derived geometry from foundations-model.mjs, not the repo scale.mjs tiers directly
- Commits: none
- Check: 1 grep lists only the five named files: pass
- Check: 2 `npm run check` exits 0: pass
- Check: 3 `node scripts/generate-foundations.mjs --check` exits 0: pass
- Check: 4 four unit test files: pass
- Check: 5 packages browser project on the changed browser tests: pass
- Check: 6 focus-timing project: pass
- Check: 7 visual project: pass
- Check: 8 site project with the 12px negative control excluded: pass
- Follow-up: note: red-checkpoint deviations: redck.py deviations printed no process... -> notes.md
- Follow-up: note: the a2ui-live "negative control: an unrelated fixed 12px" test was... -> notes.md
