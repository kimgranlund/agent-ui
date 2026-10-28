---
id: T-0488
title: "Screenshot parity sweep: every control and site demo against the derived geometry and dogfood rules"
type: spike           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A findings list of controls and site demos whose rendered look drifts from the ADR-0245 derived geometry or the dogfood rules, with screenshots, written into this file under `## Findings`, so the conductor can file fix tickets.

## Context
Tools already in the tree: `node scripts/foundations-probe.mjs` (measures each sized control against the derived geometry), `site/pages/dogfood-render.browser.test.ts` (computed radius, height, text edge, type floor, the 400px column, nested cards), `node scripts/dogfood-compose.mjs --gate`, and the allowlists `scripts/dogfood-render-allowlist.json` and `scripts/foundations-allowlist.json`. Library ramp sm 24 / md 32 / lg 40 at regular density; an A2UI surface at `data-tier="widget" data-scale="md"` is 20 / 24 / 28. Screenshots go to the git-ignored `.sdlc/runtime/tasks/0488-screenshot-parity-sweep/shots/`.

## Constraints
Read-only spike: edit nothing tracked but this handoff. Run heavy browser gates through `gate_lock.py run --name <what> -- <cmd>` from the sdlc-lite plugin scripts. Check every allowlist entry still names a real, still-needed exception. Group findings by control family with severity and a proposed ticket group. No em dashes.

## Done when
- `## Findings` in this handoff lists each drift with control or demo, measured vs expected value, a screenshot path, a severity, and a proposed ticket group, plus stale allowlist entries.

## Acceptance criteria
- `## Findings` exists in `.sdlc/tickets/0488-screenshot-parity-sweep/handoff.md`; every finding names a measured and an expected value and an existing screenshot path.
- `node scripts/foundations-probe.mjs` and `node scripts/dogfood-compose.mjs --gate` were run and their exit codes are recorded in the findings.
- `git status --short -- . ':!.sdlc'` prints nothing (no change outside `.sdlc/`; the claim's own `.sdlc/AGENTS.md` and roadmap edits are bookkeeping).
- No em dash in the added text.
- Lane: solo because size L2 (steps.py lane)

## Findings

Run 2026-10-28 at base eb742cd01, light scheme, Chromium (Playwright) for the shots; the render lint ran Chromium and WebKit. Paths below are relative to `.sdlc/runtime/tasks/0488-screenshot-parity-sweep/` (git-ignored). Expected values come from `scripts/lib/foundations-model.mjs` `resolve()` at the root register product/md, regular density, balanced radius: n 8, h 32, control radius 8, control margin 4, control gutter 2, label compensation 2, c 2, widget radius 8, card margin 24, card radius 12.

### Gates run

| Command | Exit | Result | Log |
|---|---|---|---|
| `node scripts/foundations-probe.mjs` (through gate_lock.py) | 0 | 48 rows, 16 classed controls, 7 exempt; 21 rows mismatch, 0 unruled (no `--strict`, so exit 0) | `probe.txt` |
| `node scripts/dogfood-compose.mjs --gate` | 0 | green, 0 allowlisted findings, 11 exempt paths | `compose.txt` |
| `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts` (through gate_lock.py) | 0 | 2 files (chromium, webkit), 526 tests passed | `dogfood-render.txt` |
| capture of every `site/*-demo.html`, `*-permutations.html`, `*-states.html` (101 pages) at 1000 and 400px | 0 | 202 of 202 shots, 0 page errors, 0 page-level horizontal scroll | `shots/demos/`, `shots/demos/index.json` |
| `scripts/screenshot-a2ui-catalog.mjs --theme light --crop canvas` | 0 | 82 catalog widgets, 0 empty canvases | `shots/catalog/light/` |
| overflow and radius scan over the 101 pages | 0 | see F2 to F5 | `scan.json`, `overflow-all.txt`, `matrix.txt` |

Root-register sized controls on the demo pages all match the model: 612 default ui-button at h 32 r 8, 131 sm at 24 / 6, 22 lg at 40 / 10; ui-text-field, ui-toggle and ui-textarea radii 6 / 8 / 10 at sm / md / lg; widget tier md 24 / 6 and content tier md 44 / 11 (content n 11). No height drift found on any `*-demo` page.

### F1. foundations-probe expectations are stale against the T-0374 model (tooling, Medium)

- Measured (probe "derived" column) vs probe "expected": ui-button md pad 4 inset 4 r 8 vs 8 / 6 / 16; ui-text-field, ui-select, ui-textarea md r 8 vs 16 (sm 6 vs 12, lg 10 vs 20); ui-toggle md r 8 vs 16; ui-otp-field cell md r 4 vs 8; ui-multi-select md r 10 vs 18. 21 rows in all.
- The measured values are the model's: control radius h/2 x 0.5 (balanced default, T-0374 step 6) = 8, button pad = control margin (q - 2)n/4 = 4, button label inset = gutter 2 + compensation 2 = 4, listbox 8 + c = 10, otp cell n x 0.5 = 4. The render lint (which reads `foundations-model.mjs`) is green on the same controls.
- Cause: `scripts/foundations-probe.mjs` CLASSES hard-codes the Amendment 5 pill `2 * r.n` and reads margin and label inset from the repo `packages/agent-ui/shared/src/tokens/scale.mjs` (margin n, h 4n), not from `scripts/lib/foundations-model.mjs`. The repo scale.mjs also still carries content n0 10 and brand n0 14 where the vendored model and `foundations.gen.css` use 11 and 15. So `--strict` would fail on a correct tree, and the probe cannot detect a real radius drift today.
- Screenshots: `shots/demos/button-permutations@1000.png`, `shots/demos/text-field-permutations@1000.png`.
- Proposed ticket group: G1 probe-model alignment (move the probe's CLASSES onto `foundations-model.mjs` resolve() and radiusAmounts(), and decide whether the repo scale.mjs tiers are retired or synced).

### F2. Permutation matrices overflow their card at 1000px and 400px (site, High)

- Measured: the `.matrix` card's content paints past its right border by 14px (button), 106 to 125px (toggle), 314 to 321px (text-field), 329px (textarea), 172 to 478px (otp-field) at 1000px; 122 to 718px at 400px. Expected: 0 (content inside the card; at 400px the 400px-column rule).
- Cause: `site/pages/permutations.css` `.matrix` fixes `grid-template-columns: max-content repeat(4, minmax(7rem, 1fr))`, while the text-field, textarea, toggle and otp pages emit 5 or 6 columns; columns past the 4th wrap or spill and are cut at the card edge.
- ui-otp-field: the host is 174px wide in a 144px matrix cell, so the cells of adjacent columns overlap each other (`shots/crops/otp-perm.png`). Expected: the specimen fits its cell or the column takes its min-content.
- Screenshots: `shots/demos/otp-field-permutations@1000.png`, `shots/demos/text-field-permutations@1000.png`, `shots/demos/textarea-permutations@1000.png`, `shots/demos/toggle-permutations@1000.png`, `shots/demos/button-permutations@400.png`, `shots/crops/text-field-perm-clip.png`.
- Proposed ticket group: G2 permutations pages (matrix columns from the page's own column count, a scroll or stacked layout at 400px, and the lint coverage in F3).

### F3. The render lint does not visit permutations or states pages (lint coverage, Medium)

- Measured: `site/pages/dogfood-render.browser.test.ts` line 1061 globs `./*-demo.ts` only, so the 11 `*-permutations` and `*-states` pages are outside every render rule. Expected: every docs page with live controls is linted (the ticket's own scope).
- Effect: on `button-permutations` at 400px the Subtree geometry rows squeeze ui-button labels to 7 to 10px of 42 to 56px needed (a "B" or "E" shows), and the F2 overflow; neither reds a gate. The 400px-column rule would have caught both.
- Screenshots: `shots/demos/button-permutations@400.png`.
- Proposed ticket group: G2 permutations pages (extend DEMOS to the permutations and states pages, after the F2 fix so it lands green).

### F4. ui-text-field type=color leaks the ui-swatch value text as a vertical strip (component, High)

- Measured: in the `type = color` specimen the swatch-button's composed ui-swatch renders its `[data-part="value"]` span at 8px wide by 150px tall, stacking "#3b82f6" one character per line over the field and the specimen below. Expected: the adornment shows the 2n swatch box only (16px at md) inside the 3n slot; the value is the field's own text.
- Present at both widths on `text-field-permutations`; `text-field-geometry.browser.test.ts` checks the swatch is not collapsed but not that its value part is hidden.
- Screenshots: `shots/crops/text-field-color.png`, `shots/demos/text-field-permutations@1000.png`.
- Proposed ticket group: G3 text-field color adornment (hide the swatch's value part in the adornment, or render the swatch with no visible value, plus a browser test on the value part's box).

### F5. list-demo at 400px truncates row actions and clips badge labels (site demo, Medium)

- Measured: contact-row "Message" ui-button labels get 50 to 57px of 66px needed (shown "Mess..."); four ui-badge hosts have content 5 to 12px past their right edge ("Owner", "Invited"). Expected: no truncation of a one-word action and badge content inside the badge at the 400px column.
- Screenshots: `shots/crops/list-demo-400.png`, `shots/demos/list-demo@400.png`.
- Proposed ticket group: G4 400px column fixes (the row should wrap or drop the email line before squeezing the trailing actions).

### F6. Site event-log and demo-figure radius reads as a concentric radius with no inner card (site chrome, Low, needs ruling)

- Measured: `.event-log` (134 hits over both widths, a 130px tall empty log) and `.demo-figure` (542 hits over both widths) take r 36 = card radius 12 + card margin 24. Expected per clause 3 for a leaf container holding text: its level radius, card 12 (or widget 8). The concentric formula is right only when the figure wraps a card; the event log never does.
- Also `.matrix` uses literal `border-radius: 0.75rem` and `padding: 1.25rem` (12 / 20px) where the card level is 12 / 24.
- Screenshots: `shots/crops/select-log.png`, `shots/crops/code-demo-400.png`, `shots/demos/select-demo@1000.png`.
- Proposed ticket group: G5 site chrome radii (ruling first: does a demo figure count as a card wrapper).

### Not findings (checked)

- `button-demo` "Archive the whole conversation thread" label truncates at 188 of 253px by design (a bounded 14rem button, `site/pages/button-demo.ts` line 107): `shots/demos/button-demo@1000.png`.
- `code-demo` code lines run past the figure inside ui-code's own scroll box, by design: `shots/crops/code-demo-400.png`.
- `layout-permutations` demo-figure content 16px past its edge at both widths: an intentional overflow specimen is likely; not confirmed, left for G2: `shots/demos/layout-permutations@1000.png`.
- Field inline padding (8, label inset 6, text edge 14 = 2n - c) differs from the button's (4 + 2 + 2) by rule: `dogfood-rules.json` text-edge pins both.

### Allowlists

- `scripts/foundations-allowlist.json`: `{}`, no entries.
- `scripts/dogfood-compose-allowlist.json`: `{}`, no entries.
- `scripts/dogfood-render-allowlist.json`, 5 entries. The lint fails on a listed key it no longer finds and ran green on Chromium and WebKit, so each key still fires in both engines (none carries an `@engine` suffix). Still needed, by entry:
  - `demo/icon-demo#figure-parity`: still needed, standing ruling (T-0336) that glyphs share a baseline. `shots/demos/icon-demo@1000.png`
  - `demo/line-chart-demo#dash-scale`: still needed, ruled texture dash (T-0188). `shots/demos/line-chart-demo@1000.png`
  - `demo/option-deck-demo#icon-box`: still needed, owner T-0193 pictorial disc (60px disc measured, r 50%). `shots/demos/option-deck-demo@1000.png`
  - `demo/playing-card-demo#type-floor`: still needed, ruled card-art index (T-0338, T-0189). `shots/demos/playing-card-demo@1000.png`
  - `demo/product-card-demo#icon-box`: still needed, ruled pictorial icon header (T-0338). `shots/demos/product-card-demo@1000.png`
- Stale allowlist entries: none.

### Proposed fix tickets

| Group | Findings | Severity | Size guess |
|---|---|---|---|
| G1 probe-model alignment | F1 | Medium | L2 |
| G2 permutations pages | F2, F3 | High | L2 |
| G3 text-field color adornment | F4 | High | L1 |
| G4 400px column fixes | F5 | Medium | L1 |
| G5 site chrome radii | F6 | Low | L1 after a ruling |

## Plan review
- plan defect: criterion 3 could not pass (untracked handoff, claim bookkeeping); conductor rewrote it to a check outside .sdlc/ (2026-10-28).

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: eb742cd01a35
- Changed: A screenshot parity sweep over 284 shots finds six drift groups, including overflowing permutation matrices and overlapping OTP cells
- Commits: none
- Check: 1 `## Findings` exists and every finding names a measured and an expected value and an existing scr...: pass
- Check: 2 `node scripts/foundations-probe.mjs` and `node scripts/dogfood-compose.mjs --gate` were run and t...: pass
- Check: 3 `git status --short -- . ':!.sdlc'` prints nothing: pass
- Check: 4 No em dash in the added text: pass
- Check: 5 Lane: solo because size L2: pass
- Follow-up: note: handoff.md F1: foundations-probe --strict would red a correct tree... -> notes.md
