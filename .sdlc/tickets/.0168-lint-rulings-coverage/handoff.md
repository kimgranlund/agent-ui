---
id: T-0168
title: "Lint rules for the 2026-10 rulings: disabled recipe fleet-wide, 3:1 field outline, icon vs glyph, calendar cap, table pager, pill coverage, round-3 proposals"
type: feature         # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0167]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
branch: feat/0168-lint-rulings-coverage
worktree: ../agent-ui.worktrees/wave-w168
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every standing dogfood ruling from 2026-10-13/14 has a lint rule with a negative control, so a regression reds the render or compose lint instead of waiting for a dogfood pass.

## Intent
- Do (rules in `scripts/dogfood-rules.json`, render rules in `site/pages/dogfood-render.browser.test.ts`, compose rules in `scripts/dogfood-compose.mjs`; each with one injected-violation negative control):
  1. Disabled recipe fleet-wide: extend disabled-ink / disabled-edge to text-field, textarea, OTP cells, select trigger, combo-box editor; slider disabled fill vs rail and thumb height; switch off-fill edge at 3:1.
  2. 3:1 field outline: render rule using `site/lib/dogfood-contrast.ts`.
  3. Icon vs glyph: icon box is 2n inside a control or tier region and 1em in prose (Kim's ruling; rewrite T-0138's old "0.875 x font" proposal); compose rules: no `setIcon(..., 'caret-*')` inside a control (carets are glyphs), no run of U+2605 inside a `ui-*` host (use ui-rating).
  4. Calendar content cap and start alignment; table pager outside the scroll frame.
  5. Pill coverage: add multi-select trigger and the chip-like controls to `pill-radius` where the ruling applies (check each control's descriptor first; OTP cells stay round squares at radius n).
  6. Round-3 proposals in `.sdlc/notes/notes.md` (T-0138, T-0142, T-0146 to T-0150): table-scroll-cue, ring-parity, legend-gap, series-separation, chip-opaque, chart-empty-mark, diverging-zero, rating glyph-label gap, demo card clipped at 400px, prose-after-box, double-period placeholder, no em dash in picker labels, demo-caption inside a specimen, sibling figure widths, overline spacing, avatar overlap, supporting-line contrast, board letter cap height, unframed control edge. Build the ones that are mechanical; list any you judge not mechanically checkable with a reason.
  7. Re-mint the OTP empty and disabled goldens that pass only on tolerance (notes.md), after viewing.
- Non-goals: fixing new findings beyond adding an allowlist entry with an owner ticket (T-0170 grammar); CI browser lane.
- Done when: `npm run check` exit 0; `node scripts/dogfood-compose.mjs --gate` exit 0; render lint exit 0 in both engines with every new negative control red when injected; `.claude/docs/references/dogfood-lint.md` lists each new rule.

## Context
- Lint audit 2026-10-14 (rulings with no enforcing lint). Rulings: everything pill; OTP cells round squares at radius n; icon vs glyph distinct, glyph box max(8px, 2n-2c); fleet disabled recipe; 3:1 field outline; calendar content cap; table pager outside the scroll frame.
- Commit locally, never push. Heavy tests via `gate_lock.py run`, foreground; report after each rule group.

## Constraints
- Rules derive thresholds from the ramp or named JSON fields, never repeated literals. No em dashes.

## Outcome

2026-10-17 · lane: full L3 · verdict: pass · verifier: verifier-L3 (fable) · base: 946d95dc5ab6
- Changed: 22 render rules and 2 compose rules for the 2026-10 rulings, each with a biting plant (#2085)
- Commits: none
- Check: 1 `npm run check` exits 0: pass
- Check: 2 `node scripts/dogfood-compose.mjs selftest` exits 0, with cases for `caret-glyph` and `star-run`: pass
- Check: 3 `node scripts/dogfood-compose.mjs --gate` exits 0: pass
- Check: 4 render lint exits 0 in Chromium and WebKit, every new rule measured, every new negative control r...: pass
- Check: 5 the reference lists every rule (`node -e "...dogfood-rules.json...dogfood-lint.md..."` exits 0): pass
- Follow-up: note: site/pages/dogfood-render.browser.test.ts:63 SILHOUETTE_MIN = 1.3... -> notes.md
- Follow-up: note: site/pages/radio-demo.ts:67,85 and... -> notes.md
- Follow-up: note: Intent item 7 the OTP empty and disabled goldens: the builder... -> notes.md
