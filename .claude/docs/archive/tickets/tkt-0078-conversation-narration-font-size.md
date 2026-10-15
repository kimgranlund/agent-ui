---
doc-type: ticket
id: tkt-0078
status: done
date: 2026-07-16
owner:
kind: bug
size: small
---
# TKT-0078 — conversation narration renders at ambient 1rem, towering over the bubble's own type

## Summary
Kim's screenshot (2026-07-16, agent-admin-app.html live turn): the agent bubble's turn narration
("Opening a new surface… / Updating the surface… / Updating data…") renders visibly LARGER than
every other text in the same bubble — the finalize note beneath it ("Emitted 3 A2UI message(s)…")
is body-sized and reads as the smaller text, inverting the hierarchy (progress meta should sit
BELOW the substantive note, typographically).

## Repro
1. `npm run dev` → `agent-admin-app.html`, any live persona, send a surface-turn message.
2. Compare the narration strip's line size against the bubble's note text.

## Expected vs actual
- **Expected:** narration is compact meta-type, slotting into the bubble's existing ladder
  (`who` 0.66 · annotation/wire 0.72 · system 0.78 · body 0.86 rem) below body size.
- **Actual:** narration renders at the page-ambient 1rem — the largest text in the bubble.

## Classification
Visual axis · **component-owned lane** (the ADR-0102 triage): `ui-timeline-item` deliberately
declares NO font-size (its ADR-0122 marker ramp is geometry-only; content inherits ambient type —
correct for the display family on docs pages), and `conversation.css`'s `[data-part='narration']`
wrapper tunes only `--ui-status-stream-max-block-size`, never type. The compact register is the
CONSUMER's to set (the same consumer-tuning seam the wrapper already uses), and `ui-conversation`
never set it. Not new to the standalone page — any host page with 1rem ambient type shows it; the
docs shell's ambience merely made it less glaring.

## Severity
minor

## Acceptance
- Narration text sizes into the bubble ladder (0.78rem — the system-bubble register: meta, above
  annotation, below body), via the `[data-part='narration']` consumer wrapper — no edit to
  `ui-timeline-item`/`ui-status-stream` (their no-type-opinion posture is by design).
- Browser-verified against a live turn; gates green.

## Links
- [TKT-0076](tkt-0076-agent-admin-real-a2ui-surfaces.md) — the surface arm whose narration this sizes.
- ADR-0122 (timeline family — the geometry-only ramp) · ADR-0102 (the three-lane routing law).

## Findings

### 2026-07-16 — root-caused, fixed inline, browser-measured — CLOSED

**Root cause (confirmed in source):** `ui-timeline-item`'s ADR-0122 ramp is geometry-only —
`timeline-item.css` contains zero `font-size` declarations, and `status-stream.css` owns only the
scroll viewport, so narration content inherits ambient type by design. `conversation.css`'s
`[data-part='narration']` wrapper tuned only the `--ui-status-stream-max-block-size` knob and
never set the compact register — so the strip inherited the page's 1rem and out-sized the
bubble's whole 0.66–0.86rem ladder.

**Fix (conversation.css, the consumer wrapper):** `font-size: 0.78rem` on
`[data-part='narration']` — the bubble's existing meta register (the system-bubble row: above
annotation/wire 0.72, below body 0.86). No edit to the timeline family (its type-agnostic
posture is correct for the display controls on docs pages).

**Verified:** live page, computed styles — narration 12.48px (0.78rem) vs note 13.76px
(0.86rem); the zoomed screenshot shows the hierarchy restored (note reads larger than progress
meta). Gates: check green; the one red was the theme-provider built-CSS fixture (the documented
whole-bundle drift note — any component CSS byte reddens it), regenerated per its own banner;
6314/6314.
