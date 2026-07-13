---
doc-type: ticket
id: tkt-0038
status: open
date: 2026-07-13
owner:
kind: bug
---
# TKT-0038 — component-preview-fleet.browser.test.ts fails on WebKit: STRUCTURAL set vs fleet CASES drift

## Summary
Flagged independently by TWO build seats this session (the TKT-0033 Form-B build and the TKT-0036
prose build), both proving it PRE-EXISTING via stash-revert against their unmodified bases:
`site/lib/component-preview-fleet.browser.test.ts` fails on WebKit — (a) the `STRUCTURAL` tag-set
assertion (~L76) misses members (`ui-status-stream` / `ui-swiper-item` / `ui-timeline` present in
one of {the `STRUCTURAL` constant imported from `component-preview.ts`, the fleet `CASES` array}
but not the other — the two have drifted apart), and (b) the `ui-swiper-pagination` /
`ui-swiper-paddles` structural-children assertions (~L50) lose structural children under WebKit.
Not seen in normal gate runs because the FULL browser suite OOMs in worktrees and the failures sit
in an unscoped file; on main the full `test:browser` sweep would surface them.

## Acceptance
- The `STRUCTURAL` set and the fleet `CASES` derivation are re-reconciled — ideally ONE derives
  from the other (a drift gate, not two hand-lists) so this class of divergence trips loudly at
  the source instead of failing as a WebKit test three waves later.
- The `ui-swiper-pagination`/`ui-swiper-paddles` WebKit structural-children failures are
  root-caused (a real cross-engine rendering difference vs a test-timing artifact) and fixed on
  the correct side (component vs test).
- `component-preview-fleet.browser.test.ts` green on BOTH engines in isolation and in the full
  suite on main.

## Repro
`npm run test:browser -- site/lib/component-preview-fleet.browser.test.ts` on current main —
WebKit leg fails on the STRUCTURAL-set assertion + the swiper structural-children assertions.
(Chromium status per the flagging reports: the tag-set drift may fail there too; verify.)

## Expected vs actual
- **Expected:** the fleet preview gate green both engines; the STRUCTURAL vocabulary single-owned.
- **Actual:** WebKit failures from a drifted hand-maintained pair + a swiper structural-children
  cross-engine gap.

## Classification
Axis: **structural (two hand-lists drifted; a gate not derived from its source) + functional
(cross-engine swiper rendering)** — planes: `site/lib/component-preview-fleet.browser.test.ts`,
`site/lib/component-preview.ts` (`STRUCTURAL`), possibly `controls/swiper/*` for the WebKit leg.

## Severity
**minor** — a docs-site test-infrastructure defect; no shipped-control behavior implicated (the
swiper leg may upgrade it if a real WebKit rendering gap is confirmed).

## Links
- `site/lib/component-preview-fleet.browser.test.ts` (~L50 swiper, ~L76 STRUCTURAL assertion) ·
  `site/lib/component-preview.ts` (the `STRUCTURAL` export) · flagged in the TKT-0033 + TKT-0036
  build reports (2026-07-13), both stash-verified pre-existing.

## Findings
