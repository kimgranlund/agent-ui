---
id: T-0455
title: "The GenUI demo frame renders at the widget register and every pattern control passes a screenshot check there"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-25
claimed_by: claude:a8ce3b21 2026-10-25
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The GenUI demo frame (dogfood mode) renders A2UI surfaces at the widget register (`data-tier="widget" data-scale="md"`, ADR-0245 Amendments 2 and 8), and each pattern control (OptionDeck, OptionCompare, ConfirmReceipt, AmountPicker, StepFlow, Itinerary) looks right there: no oversized parts, no stretched rows, controls on the ramp.

## Context
Kim found OptionDeck "massive" on the live GenUI demo (T-0454, fixed in the control). T-0454's builder found the dogfood frame sets no `data-tier`, so decks render at the product register (32px tile) instead of widget (24px). Other pattern controls were never screenshot-checked in that frame.

## Constraints
Screenshots of the real widget are the evidence (AGENTS.md Inner loop). Fix a control at its home; no one-off heights. A finding that needs a design ruling is reported, not guessed.

## Done when
- The frame sets the widget register, with a test that fails without it.
- Before and after screenshots of each of the six controls in the frame, in the artifacts dir, and any misrender fixed with a failing-first test.
- `npm run check` plus the touched folders' tests pass, and the browser shard of each touched control passes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- A dogfood frame (asset css present) stamps `data-tier="widget" data-scale="md"` on the srcdoc `<body>` unless the model names its own, and leaves a mode-off srcdoc unstamped; pinned by the T-0455 block in `bootstrap.test.ts` (red before the change): `npx vitest run packages/agent-ui/components/src/controls/sandbox-frame` exits 0.
- A model-authored md `<ui-button>` in a real dogfood frame measures 24px after the token handshake (32px before the change, in Chromium and WebKit), pinned by the T-0455 block in `sandbox-frame.browser.test.ts`: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/sandbox-frame` exits 0.
- The regenerated dogfood assets and llms-full are fresh, and the dogfood consumers pass: `npx vitest run packages/agent-ui/app/src/controls/agent-admin/dogfood-lazy.test.ts packages/agent-ui/app/src/controls/agent-admin/dogfood-lazy.bundle.test.ts site/lib/sitemap.test.ts` exits 0.
- `npm run check` exits 0.
- Before and after screenshots of the six pattern controls in the dogfood frame sit in the artifacts dir (`before-*.png`, `after-*.png`, one per engine).

## Outcome

2026-10-25 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 609287843e27
- Changed: The GenUI dogfood frame renders surfaces at the widget register, and all six pattern controls pass a screenshot check there
- Commits: none
- Check: 1 Dogfood frame stamps data-tier/data-scale on srcdoc body; mode-off unstamped: pass
- Check: 2 md `<ui-button>` in a real dogfood frame measures 24px after the handshake: pass
- Check: 3 Regenerated dogfood assets and llms-full fresh; consumers pass: pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 Before and after screenshots of six pattern controls, one per engine, in the artifacts dir: pass
- Follow-up: note: the builder's two open items no base body font in the dogfood... -> notes.md
- Follow-up: note: Itinerary is not a frame-reachable ui- tag; its screenshots are a... -> notes.md
