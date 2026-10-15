---
id: T-0117
title: "ui-text kicker is too large after the cut (section kicker 15 to 17px instead of 11 to 14)"
type: bug
status: done
size: L2
priority: P1
depends: []
created: 2026-10-13
router: .sdlc/AGENTS.md
---

## Goal
Kim 2026-10-13 (screenshot of the docs nav): kickers are way too large since the foundations cut. The docs nav group headings (FEED & STATUS, TYPOGRAPHY & MEDIA PRIMITIVES, DATA & REPORTING) wrap and shout. Cause: packages/agent-ui/components/src/controls/text/text.css maps ui-text variant=kicker to --md-sys-type-section-kicker (body x 1.125 = 15 / 16 / 17px; the lane a03 delta table row "kicker 11 to 15"), but today's kicker was 11 / 12 / 14px: a label over a group, not an eyebrow above a heading.

## Scope (one brief paragraph, per the Inner loop rule)
Map the kicker variant (all three sizes in text.css, plus any other production reader of --md-sys-type-section-kicker used for a small uppercase label: grep packages/ and site/) to the field-label role --md-sys-type-field-label (about 11px at md) so the rendered size is within 1px of today's; keep weight and tracking as today. Re-pin the text browser test and the geometry rows, update the ADR-0245 delta table row and its derive.out evidence only if a number there is now wrong (append-only amendment note if the ADR is already accepted), update the descriptor text.md, and re-mint only the goldens that show a kicker (docs nav, text, the docs-chrome ones) after eye review. Verify with a screenshot of the docs nav before and after at 400px and 1000px in the ticket folder, viewed. Local gate: npm run check plus the touched folders' tests and the visual shard; no per-ticket verifier; regenerate generated files with their scripts; no em dashes; commit locally, do not push; report in one short message.

## Closed

2026-10-13: merged as #1933
