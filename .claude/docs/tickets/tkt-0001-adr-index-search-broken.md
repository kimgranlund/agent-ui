---
doc-type: ticket
id: tkt-0001
status: done
date: 2026-07-09
owner:
kind: bug
---
# TKT-0001 — the ADR index's `ui-text-field type=search` is broken (visual + filtering)

## Summary
Kim reported, on `/adr-index.html`, that the dogfooded search field
(`<ui-text-field type="search" class="adr-search" placeholder="Search decision records…"
label="Search decision records">`) is visually broken and does not filter the ADR list correctly.
A batched clarifying round confirmed both symptom axes (visual/layout AND filtering) are present.

## Acceptance
- ✅ The search field renders correctly (matches the fleet's `ui-text-field type=search` visual
  contract — leading magnifier, trailing clear affordance, block-level full-width layout with its
  inner `grid` formatting context intact, per `adr-index.css`'s tag-qualified override).
- ✅ Typing in the field narrows the visible ADR card list live (case-insensitive substring match
  over number/title/body, per `lib/adr.ts`'s `matchesQuery`).
- ✅ A root cause is identified and either fixed, or — if not reproducible — the ticket is closed
  `wontfix` with the investigation's findings recorded. Fixed: `site/pages/adr-index.css:18`,
  `display: block` → `display: grid` — see Findings.

## Links
- `site/pages/adr-index.ts`, `site/pages/adr-index.css` — the page under report.
- `site/pages/adr-index.browser.test.ts` — the existing guard test (currently GREEN — see Findings;
  it does not cover the actual card-list filtering behavior, only the field's own `.value`).
- `packages/agent-ui/components/src/controls/text-field/text-field.ts` — `type=search`'s codec/
  affordance definition (leading `magnifier`, trailing `clear` button).
- `site/lib/adr.ts` — `matchesQuery`, the filter predicate.

## Repro
Not yet reduced to exact steps — Kim observed the break while viewing the live page; no console
error or exact interaction sequence was captured in the initial report. The pasted markup
(`<ui-text-field type="search" ... />`, self-closing) is almost certainly a devtools-serialized
snapshot of the live element, not literal page source — the real element is built via
`document.createElement('ui-text-field')` in `adr-index.ts:45-49` and matches the pasted
attributes exactly (`type=search`, `class=adr-search`, the placeholder and label strings).

## Expected vs actual
- **Expected:** the search field looks like every other `type=search` `ui-text-field` in the fleet
  (magnifier leading icon, clear-button trailing affordance once non-empty, full-width block
  layout per the page's own CSS), and typing narrows the ADR card list live.
- **Actual:** reported as visually wrong AND not filtering correctly. Exact visual/functional
  deviation not yet captured (no screenshot or console log attached to the initial report).

## Classification
Axis: **visual + functional**, same component, same page — plausibly one root cause manifesting
both ways (e.g., a layout defect preventing real keystrokes from reaching the editor would present
as both "looks wrong" and "doesn't filter"). Plane: `site/pages/adr-index.{ts,css}` ×
`packages/agent-ui/components/src/controls/text-field/` (`type=search`'s leading/clear affordance
path). Not yet isolated to one file — see Findings for what's already been ruled out.

## Severity
**major** — a fully non-functional page-level search on a docs surface used to navigate ~90 ADRs;
not a blocker (the page is still readable/scrollable without it) but a real usability loss.

## Findings
### 2026-07-09 — initial static investigation (Claude, pre-dispatch)
Traced statically, no live browser available in this context:
- **Element construction confirmed correct.** `adr-index.ts:45-49` builds the field with
  `type=search`, `class=adr-search`, the exact placeholder/label strings Kim's report shows —
  matches byte-for-byte. Ruled out: wrong attributes set.
- **The known `@scope` specificity trap does NOT currently reproduce.** `adr-index.css:17-21`'s
  tag-qualified `ui-text-field.adr-search { display: block; ... }` override (documented as
  load-bearing against `text-field.css`'s `@scope (ui-text-field) { :scope { display: inline-grid
  } }`) is present, and `adr-index.browser.test.ts:27` — which asserts exactly this —
  **currently PASSES** (2/2 tests green, both engines). Ruled out: the display-mode footgun this
  file's own comment already names.
- **The filter wiring is present and looks correct.** `adr-index.ts:123-129` — a real
  `search.addEventListener('input', ...)` calling `matchesQuery` per record and toggling
  `cards[i].hidden` — is wired. `lib/adr.ts:159-163`'s `matchesQuery` predicate (case-insensitive
  substring over number/title/body) reads correctly on inspection.
- **The clear-button affordance correctly re-emits `input`.**
  `text-field.ts:722-735`'s clear-button click handler sets `this.value = ''` and explicitly calls
  `this.emit('input')` before returning — ruled out a silent-clear-without-notify bug.
- **Gap: the existing browser test does NOT prove the card list actually filters.** It only asserts
  the field's own `.value` tracks typed text (`adr-index.browser.test.ts:41`) — there is no
  assertion that `cards[i].hidden` actually changes, or that the visible card count changes, when a
  query is typed. This is a real coverage gap regardless of whether it's the reported bug's cause.
- **Could not reproduce visually** — no browser-driving tool was available in this context (dev
  server was started on :5174 and stopped again); everything checked via source reading and the
  existing jsdom/vitest-browser suite only.
- **Not yet checked:** the `search` type's leading `magnifier` icon adornment path
  (`text-field.ts` config row `search: { leading: 'magnifier', ... }` and its render/CSS), whether
  today's `ui-button` icon-only change (`5700d04`) touches anything the search field's clear-button
  shares (the clear button is a raw `<button>`, not a `ui-button`, so this is a low-prior lead but
  unconfirmed), and any recent `component-styles.css`/shared-file churn from tonight's build waves
  that could have reordered cascade layers affecting this specific page.

**Recommended next step:** dispatch a live-browser investigation (real Chromium, screenshot +
DOM/computed-style inspection of `/adr-index.html`'s rendered search field, plus a real typed-query
interaction proving or disproving the card-list filter) — this needs actual rendered-pixel
evidence, which static reading cannot supply.

### 2026-07-09 — live-browser investigation: reproduced, root-caused, fixed
Ran the dev server (landed on :5175, ports 5173/5174 occupied) and drove `/adr-index.html` with a
real headless Chromium (Playwright, launched directly — not the vitest-browser CDP harness, since
this needed the live dev server rather than a mounted test module).

- **Reproduced BOTH symptom axes, and confirmed they share one root cause.**
  Screenshot of the rendered field showed the placeholder text ("Search decision records…")
  rendered mostly BELOW/overlapping the bottom border of the visible bordered box, not centered
  inside it — visually broken exactly as reported.
  Computed-geometry probe: host `.adr-search` bounding box was `y=199.3, h=28` (bottom edge
  227.3); the internal editor part's bounding box was `y=221.3, h=14` (bottom edge 235.3) — the
  editor's real hit-box sat almost entirely BELOW the visible bordered frame, overflowing it by 8px.
- **Root cause (file:line): `site/pages/adr-index.css:18`** (pre-fix) —
  `ui-text-field.adr-search { display: block; … }`. `display: block` is a SINGLE-keyword value,
  which resets BOTH the outer AND inner display type — it doesn't just make the host a block-level
  box, it also discards the INNER `grid` formatting context that `text-field.css`'s own anatomy
  depends on (`@scope (ui-text-field) { :scope { display: inline-grid; grid-template-columns: 1fr;
  align-items: center } }`, with the leading/trailing presence-driven `grid-template-columns: auto
  1fr auto` rule for a field with both adornments — text-field.css:105-106,196-197). With the host
  reduced to `flow` layout, the leading-icon span / editor div / trailing-button span stopped being
  grid items placed by `order` and instead stacked as ordinary block/inline boxes in DOM order,
  overflowing the host's fixed `block-size` (28px) — which is exactly the drifted editor hit-box
  measured above.
- **This explains the "doesn't filter" report too, not a separate bug.** Simulated a real user's
  click at the CENTER of the *visible* bordered box (`page.mouse.click` at the host's own
  `getBoundingClientRect()` center — what a person looking at the screen would click) — focus
  stayed on `<body>`, not the editor. Typing afterward left `field.value === ''` and 0/114 cards
  filtered. (A prior probe that clicked the editor PART directly via Playwright's element handle —
  which targets the element's true, drifted box, not what's visually inside the border — DID focus
  it and DID filter correctly; that's why the existing `adr-index.browser.test.ts`, which drives
  the editor part directly via `textContent` + a dispatched `input` event, stayed green throughout
  — it never exercises the visible-hitbox click path a real user takes.)
- **Fix applied:** `site/pages/adr-index.css:18` — `display: block` → `display: grid`. `grid`
  keeps the host block-level (full-width, per the rest of the rule — matches the outer type
  `display: block` already gave) while preserving the grid INNER formatting context the field's
  own anatomy requires. Re-ran the live-browser probe post-fix: placeholder now renders correctly
  centered inside the bordered box (screenshot confirmed), computed `display` is now `grid`, a
  real click at the visible box center now focuses the editor
  (`document.activeElement === editor`), and real keystrokes ("layering") correctly narrow the
  list to 13/114 cards.
- **Also updated:** the stale part of the load-bearing specificity-trap comment immediately above
  the rule (`adr-index.css:8-16`) that said the footgun's failure mode was "leaving the field
  `inline-grid` instead of `block`" — now reads "instead of `grid`", matching the corrected
  intentional value. `site/pages/adr-index.browser.test.ts:31`'s computed-style assertion updated
  from `.toBe('block')` to `.toBe('grid')` to match, with an inline comment on why `grid` (not
  `block`) is now the load-bearing value.
- **Added a regression test** (`adr-index.browser.test.ts`, new `it` block) that closes the
  coverage gap the existing test had: it drives the field via `userEvent.click(search)` (a real
  pointer click at the HOST's own bounding box — the same "click where a person sees the box"
  path that exposed the bug) + `userEvent.type(editor, …)`, then asserts the editor receives real
  focus and the card list narrows (not zeroes out, not no-ops). This test would have caught the
  original defect; the old test would not have (see above).
- **Verification run:** `npx vitest run --config vitest.browser.config.ts --project site -t
  "adr-index"` — 4/4 tests pass, both Chromium and WebKit. `npm run check` — clean (tsc + site +
  tools). `npm test` (jsdom) — 249 files / 4399 tests pass. `npm run test:browser` (the FULL
  browser suite, all packages) OOM'd in this sandbox both at default heap and at
  `--max-old-space-size=8192` — reproduced as a pre-existing sandbox memory ceiling unrelated to
  this change (the scoped `-t "adr-index"` run against the same two engines already passed twice,
  before and after the fix); not a regression signal from this diff.
- **Files touched:** `site/pages/adr-index.css` (the 1-line fix + comment repairs, `git diff` shows
  ~10 lines incl. comments), `site/pages/adr-index.browser.test.ts` (1 assertion updated + 1 new
  test added). Not yet committed — left as working-tree changes for review.
