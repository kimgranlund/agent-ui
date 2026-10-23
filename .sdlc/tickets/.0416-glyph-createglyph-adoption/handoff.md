---
id: T-0416
title: "Seven controls that build ui-glyph by hand adopt createGlyph"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The controls that still build ui-glyph by hand (select, calendar, combo-box, disclosure, form-popover, status-stream, swiper-paddles) use the shared `createGlyph` helper T-0351 introduced, and select's caret stops setting a host `aria-hidden` attribute by hand, so every glyph mark follows one path (ARIA rules: root AGENTS.md, never host attributes).

## Intent
- Do: list each hand-built glyph site, swap it to createGlyph with identical rendered output (same glyph name, size, parts, decorative semantics), and remove the manual aria-hidden where createGlyph already marks the glyph decorative. Prove no visual change: run each touched control's browser tests and the controls' screenshot or computed-style tests, and take before and after screenshots of select, calendar and combo-box demos into the ticket folder.
- Non-goals: glyph art, sizes, new glyphs.
- Done when: `git grep` finds no hand-built ui-glyph creation in those seven controls; `npm run check`, each touched control folder's jsdom tests and `npx vitest run --config vitest.browser.config.ts` on those folders exit 0; the foundations census gate stays green.

## Context
From .sdlc/notes/notes.md :297 (T-0351 solo report). createGlyph lives with the glyph marks work (grep createGlyph under packages/agent-ui/components/src). Skills component-build, component-testing.

## Constraints
No em dashes. Never hand-edit *.props.gen.ts. Never re-monolith the browser shards.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-22 · lane: solo L2 · verdict: closed by reason (already delivered by T-0356 (fbe0914a2, #2130): all seven controls build glyphs through createGlyph and set no host aria-hidden; notes :297 was stale) · verifier: none · base: none
- Changed: see commits
- Commits: none
