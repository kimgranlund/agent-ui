---
id: T-0463
title: "The GenUI dogfood frame carries the base body font, so plain model text reads in the fleet font"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0455]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-25
claimed_by: claude:a8ce3b21 2026-10-25
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Plain text a model writes in the GenUI dogfood frame reads in the fleet's base body font and text styles, not the browser's default serif.

## Context
T-0455 found the dogfood bundle carries no base body font: `base-styles.css` is not in the `scripts/build-dogfood-assets.mjs` entry. Kim ruled 2026-10-25 to add it, knowing it changes the ADR-0162 asset set and restyles plain model HTML.

## Constraints
Regenerate `sandbox-frame/dogfood/dogfood-assets.ts` with its script; keep the asset freshness and bundle-size gates green (report the size delta). Before and after screenshots of a plain-HTML surface in the frame.

## Done when
- A test that fails before the change proves the frame body computes the fleet font family.
- Before and after screenshots in the artifacts dir.
- `npm run check` plus the sandbox-frame tests and browser tests pass.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The T-0463 browser case (frame body computes the fleet sans family and the body-medium size and line height) failed before the change (Chromium got Times, WebKit -webkit-standard) and passes after: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/sandbox-frame` exit 0.
- The asset freshness gate and the dogfood bundle-size and lazy trip-wires stay green: `npx vitest run packages/agent-ui/components/src/controls/sandbox-frame packages/agent-ui/app/src/controls/agent-admin/dogfood-lazy.test.ts packages/agent-ui/app/src/controls/agent-admin/dogfood-lazy.bundle.test.ts packages/agent-ui/components/src/controls/barrels.test.ts` exit 0.
- Before and after screenshots exist: `ls .sdlc/runtime/tasks/0463-dogfood-base-font/before-plain-html-chromium.png .sdlc/runtime/tasks/0463-dogfood-base-font/after-plain-html-chromium.png .sdlc/runtime/tasks/0463-dogfood-base-font/before-plain-html-webkit.png .sdlc/runtime/tasks/0463-dogfood-base-font/after-plain-html-webkit.png` exit 0.
- `npm run check` exit 0.

## Outcome

2026-10-25 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 6053aa6d0d3c
- Changed: The GenUI dogfood frame carries the base body font, so plain model text reads in the fleet font
- Commits: none
- Check: 1 T-0463 browser case fails before, passes after: pass
- Check: 2 asset freshness plus dogfood bundle-size and lazy trip-wires green: pass
- Check: 3 before and after screenshots exist: pass
- Check: 4 `npm run check`: pass
- Follow-up: note: base.css also sets body margin 0 and the surface background, so... -> notes.md
