---
id: T-0462
title: "A light-scheme solid button reads pressed at primary 750, one step past hover"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-25
claimed_by: claude:a8ce3b21 2026-10-25
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
In the light scheme a solid (filled) ui-button reads pressed one step past hover: hover at primary 650, pressed at primary 750, matching the dark scheme's distinct states.

## Context
T-0459 triage row 12 (notes.md:267), ruled a ticket by Kim 2026-10-25. `packages/agent-ui/shared/src/tokens/tokens.css:148-149` resolve both `--md-sys-color-primary-fill-hover` and `-fill-active` to `primary-650` in light, and `packages/agent-ui/components/src/controls/button/button.css:28-32` names the collapse a known regression.

## Constraints
Fix at the token home; no per-control override. The failing test lands with the fix. A before and after screenshot of the real button (rest, hover, pressed, light scheme) is the evidence. Update the button.css comment that names the regression.

## Done when
- A test that fails before the fix proves light hover and pressed resolve to different colors (650 and 750).
- Before and after screenshots in the artifacts dir.
- `npm run check` plus the button and tokens tests, and the button browser tests, pass.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-25 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 913474054077
- Changed: A light-scheme solid button reads pressed at primary 750, one step past hover, across the base tokens and all ten theme packs
- Commits: none
- Check: 1 A test that fails before the fix proves light hover and pressed resolve to different colors (650 ...: pass
- Check: 2 Before and after screenshots in the artifacts dir: pass
- Check: 3 npm run check plus the button and tokens tests, and the button browser tests, pass: pass
- Follow-up: note: packages/agent-ui/shared/src/tokens/tokens.css:145 the edited... -> notes.md
