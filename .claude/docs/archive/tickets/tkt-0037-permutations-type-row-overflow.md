---
doc-type: ticket
id: tkt-0037
status: done
date: 2026-07-13
owner:
kind: bug
---
# TKT-0037 — text-field-permutations' type matrix: 12 fixed columns overflow every viewport

## Summary
Kim's report (2026-07-13, screenshot of `text-field-permutations.html`'s "Type variants" section):
the type row clips off the right edge (only text/email/url/tel visible, tel cut) and the per-type
captions collide with the specimens. Suggested "maybe a 4-col grid needs a breakpoint to 2-col" —
grounding shows it's structurally worse: `typeSection()` (`text-field-permutations.ts` ~L211-213)
sets `gridTemplateColumns = repeat(${types.length}, minmax(11rem, 1fr))` with **12 parsed types**
— a single non-wrapping 12-column row with a ≥132rem minimum width, overflowing every real
viewport. Compounding: `ui-text-field`'s own `--ui-text-field-min-inline-size: 20ch` floor
(ADR-0021) exceeds the 11rem track minimum, so specimens overflow their tracks into neighbors —
the caption/field collision in the capture. The head-row/cell-row construction (all `matrix-head`s
appended, then all cells) is what forces the single-row shape — a wrap can't keep head N above
cell N.

## Acceptance
- The type section lays out with NO horizontal overflow at any viewport ≥ small-phone width: each
  type renders as a self-contained cell (its `type = X` head + specimen + caption stacked
  together), and the grid WRAPS — as many columns as genuinely fit (auto-fill/minmax keyed off the
  field's real minimum width, not 11rem), degrading to 2 then 1 columns narrow. Head↔specimen↔
  caption binding survives every wrap (the restructure, not a breakpoint bolt-on).
- The captions never overlap a specimen (the track minimum respects the ADR-0021 20ch floor).
- The permutation page's structural completeness guarantee survives: |types| cells still provable
  (the existing count-derived assertions keep deriving from the parsed enum).
- A browser assertion pins no-overflow (scrollWidth ≤ clientWidth on the matrix in a realistic
  viewport) so the regression can't silently return — the [[test-the-whole-shape]] law.
- The sibling size×state matrix (`permutations.css` `.matrix`, `max-content repeat(4, minmax(7rem,
  1fr))`) is checked for the same class of overflow at narrow widths; fixed if trivially in scope,
  else noted.

## Repro
Open `text-field-permutations.html` → "Type variants" section, any viewport narrower than ~132rem
(i.e. all of them). The row clips at the viewport edge; specimen chips overlap the caption text of
adjacent columns.

## Expected vs actual
- **Expected:** the 12 type specimens wrap into as many columns as fit, each head+specimen+caption
  a coherent cell; no clipping, no collisions.
- **Actual:** one 12-column non-wrapping row (min ≥132rem); tel and everything after clipped;
  captions collide with overflowing specimens.

## Classification
Axis: **visual/structural (fixed column count vs content-driven wrap; track minimum below the
content's own floor)** — plane: `site/pages/text-field-permutations.ts` (`typeSection`'s inline
`gridTemplateColumns` + the heads-then-cells construction) · `site/pages/permutations.css` (the
shared `.matrix` scaffold). Page-chrome only — no control source implicated.

## Severity
**minor** — a docs-page layout defect; the content is truthful and reachable by horizontal scroll
in some browsers, but the primary permutation reference renders broken at every normal width.

## Links
- `site/pages/text-field-permutations.ts` (`typeSection` ~L191-231; `gridText`/`makeField`) ·
  `site/pages/permutations.css` (`.matrix` ~L22-33) · ADR-0021 (`--ui-text-field-min-inline-size:
  20ch` — the floor the track minimum must respect) · TKT-0033/TKT-0036 (the concurrent doc-page
  redesign — different surface [API tables/prose vs permutation chrome], no file overlap).

## Findings
### 2026-07-13 — root cause + fix (inline, host)

Root cause confirmed as structural, not a missing breakpoint: `typeSection()` set an inline
`gridTemplateColumns = repeat(${types.length}, minmax(11rem, 1fr))` — 12 parsed types → one
non-wrapping ≥132rem row — and appended ALL heads then ALL cells, so the grid could not wrap
without splitting head N from cell N. The 11rem track minimum also sat below `ui-text-field`'s
20ch `min-inline-size` floor (ADR-0021), so specimens overflowed their tracks into the neighbors'
captions (the reported collision).

Fix (`text-field-permutations.ts` + `permutations.css`): each type is now ONE self-contained
`.type-card` cell (head + specimen + caption stacked), and the matrix is `.matrix--type-cards` —
`repeat(auto-fill, minmax(min(100%, 15rem), 1fr))`: wraps to the columns that fit (4-across wide,
2, then 1 narrow), the 15rem minimum clears the 20ch floor, `min(100%,…)` guards sub-15rem
viewports. Head↔specimen↔caption binding survives every wrap by construction.

Proof: NEW `text-field-permutations.browser.test.ts` (Chromium + WebKit) — per-card binding, matrix
`scrollWidth ≤ clientWidth`, page no horizontal scroll, and every specimen's box inside its card
(the whole-shape law; jsdom is blind to all of it). Non-vacuity verified by stash-reverting the fix:
all 6 assertions FAIL on the old code, pass on the fix. The sibling size×state `.matrix` (fixed
`max-content repeat(4, minmax(7rem,1fr))`) was checked: 4 × 7rem + headers ≈ ~35rem minimum — it
can pinch on narrow phones but its 7rem tracks hold the md fields without caption collision; left
as-is (out of the reported defect's scope; the auto-fill idiom is available if it ever reports).

Gates: `npm run check` exit 0 · the new browser proof 6/6 both engines.
