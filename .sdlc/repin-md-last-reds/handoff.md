---
id: T-0158
title: "Product md: the last three reds (composer spacing, 400px render lint, nav overlay labels)"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: [T-0152]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Make `feat/root-product-md` fully green after the product / md root move (ADR-0245 Amendment 8): the three reds the re-pin lanes T-0154 to T-0157 reported and left alone, fixed at the root cause, not allowlisted.

## Intent
- Do:
  - shell-spacing-gate: `conversation-composer.css:96` (12rem, the 192 rung) and `:261` (0.625rem, the 10 rung) are literal spacing. Derive both from the ramp / n tokens so the gate passes without growing its allowlist. Kim felt the chat composer textarea was too small; keep the composer sized from the ramp so it grows with the root.
  - Render lint (`site/pages/dogfood-render.browser.test.ts`) at the 400px column, 7 findings: action-group wraps on column-chart, gauge, grid, pie-chart demos; overflow past the column on otp-field (397 > 372) and pie-chart (392 > 372); prose gap about 6px against 8 on slider-multi and textarea demos. Fix the demo pages (or the control, if the control is wrong, e.g. otp-field cell gap) so each passes; an allowlist entry only with a real reason, never to make a red green.
  - `site/pages/_page` visual narrow nav overlay-open: the overlay now truncates labels ("Status Strea...", "Descripti..."). The a07 lane kept a 320px overlay-cap law. Make labels fit at the root without truncation, preferably by deriving the cap from n instead of a fixed 320px; if that breaks the a07 overlay-cap law, re-derive the law from n, do not loosen it. View and mint the golden.
- Non-goals: other re-pins (done), skill re-vendor, the correctness batch.
- Done when: `npm run check` exit 0; shell-spacing-gate test exit 0; `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts` exit 0; the `_page` visual file exit 0; the super-shell and conversation-composer browser tests exit 0 in both engines; every minted golden viewed first.

## Context
- Branch base: `feat/root-product-md` (all four re-pin lanes merged, tip 3e29107f). Commit on `chore/repin-md-last-reds`, never push.
- Root: product / md, controls 24 / 32 / 40, h = 4n, c = ceil(n/4). A2UI canvas stays widget / md. Rules: `.claude/docs/adr/` ADR-0245, the foundations census gate, `.claude/docs/references/dogfood-lint.md`.
- Heavy gates run through `gate_lock.py run`, in the foreground. Never wait idle on a background monitor; report after each item.

## Constraints
- No literal px geometry (census gate). No hand edits to generated files. No em dashes.
- Two heavy test jobs on the machine at most.

## Closed

2026-10-14: merged as PR #1969
