---
id: T-0559
title: "Theme hygiene: dead fallback colors, a toast shadow token, forced-colors polish"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: [T-0558]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The Low findings below are fixed or left with a stated reason.

## Intent
- Do: change the CSS to use the right existing tokens and roles (add a role only if none fits, in the token source and its generator, never hand-editing generated files); measure each fixed pair's contrast in light, dark and forced colors in a real browser and report before and after numbers; screenshot before and after for each touched control.
- Non-goals: palette or HCT source changes; geometry.
- Done when: each fixed pair meets the stated ratio (numbers in the report); the touched controls' tests and the dogfood render lint pass (browser runs through `scripts/gate_lock.py`); `npm run check` exits 0.

## Context
From the T-0545 theme sweep (PR 2346). Kim approved these visual changes 2026-10-28:

### Low

Proposed ticket: "Theme hygiene: drop dead literal fallbacks, a shadow token, and forced-colors polish"

1. Dead light-scheme literal fallbacks inside `var()`: `components/src/controls/calendar/calendar.css:92-116`, `:140`, `:362`, `:366`, `:380-381`, `:414`, `:430`, `:437`; `components/src/controls/color-picker/color-picker.css:45`, `:51-52`. The component tokens are always declared in the same file (calendar.css:72-84), so the `#fff`/`#0057d8`/`#767676` legs never paint, but they encode light values only. Fix: remove the fallbacks.
2. Toast shadow literal `components/src/controls/toast/toast.css:41` (`rgb(0 0 0 / 0.15)`); no elevation shadow token exists. Fix: an elevation shadow token shared with super-shell's overlay shadow.
3. Deliberate scheme-invariant literals, documented and tested: `components/src/controls/image/image.css:34` (caption scrim `oklch(0 0 0 / 65%)`), `components/src/controls/video/video.css:20` (letterbox `oklch(0 0 0)`). Fix: none needed; optionally alias to named media tokens.
4. The calendar's selected day keeps brand colors under WHCM (`calendar.css:362-367`, `forced-color-adjust: none`), ignoring the user's palette. Fix: Highlight/HighlightText in a forced-colors block.
5. A standalone `ui-segment[checked]` (no host) shows no checked state in any mode (`segment-doc` "Examples (standalone)", state probe identical in light, dark and forced) because the indicator belongs to `ui-segmented-control`. Fix: say so in `segment.md` or drop the checked example.
6. In forced colors, `ui-pie-chart` slices and legend dots all render CanvasText (`sweep/shots/pie-chart-demo.forced.png`); identity rests on order plus the printed percent, as designed. Fix: none, or vary the slice stroke dash.
7. `ui-audio` under Chromium forced-colors emulation loses the native bar's play, volume and menu glyphs (`sweep/shots/audio-demo.forced.png` vs `.light.png`); `audio.css:8-12` delegates WHCM to the UA. Unconfirmed on a real Windows host. Fix: check on Windows HC before acting.


## Constraints
Tokens and generated CSS only through their generators (AGENTS.md, Never hand-edit). Screenshots are the evidence for a look. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 23e236205278
- Changed: Theme hygiene: dead color fallbacks removed, one shared overlay shadow token, and the standalone segment state documented
- Commits: none
- Check: 1 Each Low finding fixed or left with a stated reason; each fixed pair meets the stated ratio (numb...: pass
- Check: 2 Touched controls' tests and the dogfood render lint pass (browser via gate_lock): pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: packages/agent-ui/shared/src/tokens/dimensions.test.ts:44 also... -> notes.md
