# ADR-0093 — Date-range selection: a `mode="range"` flag on `ui-calendar` (swap-complete picks, single grid)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-07 |
> | **Proposed by** | system-planner — the design seat, on Kim's intake: "we should have a from → to version of the calendar that shows start and end date with days inside selection being filled colors." Rewritten in place 2026-07-07 after Kim resolved the three forks (F1 mode flag · F2 swap · F3 single pane); lawful because the record was `proposed`/never ratified — the README's append-only rule attaches at acceptance, and F1's own note anticipated exactly this repackaging. |
> | **Ratified by** | *(pending — the three design forks were resolved by Kim 2026-07-07; ratification awaits an independent doc-reviewer pass, generator ≠ critic)* |
> | **Repairs** | on ratification+build: `controls/calendar/calendar.ts` (mode flag + range machinery **in place** — no new files, no barrel/`BASE_CLASSES`/exports change) · `controls/calendar/calendar.css` (§1 line-71 `--ui-calendar-range-*` reservation REALIZED + band/WHCM rules) · `controls/calendar/calendar.md` (descriptor gains `mode`/`value-start`/`value-end` + range keyboard/aria/forced-colors rows; single-mode rows unchanged) · site calendar page (range demo) · ADR-0080 marginal table (the existing calendar row re-bases) · decomp `calendar-range.decomp-v2.json` |
> | **Supersedes / Superseded by** | None. **Extends ADR-0048** (the date/time picker family — its "range = reserved/future" scope note resolves here; reciprocal `Extended by` back-link on accept). Relates ADR-0045 (Escape stays the overlay's) · ADR-0057 (non-color signifier) · ADR-0080 (size gate) · ADR-0087 (catalog scope policy — the follow-up row edit) · ADR-0042 (the `_base/` precedent the rejected standalone-component alternative would have used). |

## Context

`ui-calendar` (ADR-0048) is a single-date control: one canonical ISO `YYYY-MM-DD` in one `value`
prop, one `aria-selected` cell, `formValue()` = one string. An interval — check-in→check-out,
report period, booking span — cannot be expressed on that surface: there is one value slot, one
selected-fill state, and no "between" rendering. ADR-0048 saw this coming and deliberately scoped
range OUT ("range tokens **reserved/future**" — `calendar.css:71` still carries the reservation);
Kim's intake now calls the wave in. The forcing constraint is the value SHAPE: a range is two
dates plus an interior, and a form-associated control's `value` participates in submission — so
"just add a second date" is an API-surface decision, not a styling patch.

Two packagings can host that shape: a sibling component (the fleet's `ui-slider-multi` precedent)
or a mode flag on the shipped control. The first draft of this ADR recommended the sibling
component precisely because a mode flag forks the value contract under one tag; **Kim ruled the
fork the other way (F1, 2026-07-07): one calendar, mode-flagged** — a product/taste call, not new
evidence, so it is recorded and designed to, not re-argued. That ruling converts the draft's
objection into this ADR's central design obligation: the mode-conditional value contract must be
made lawful and testable, not hand-waved. The ruling also **dissolves** the draft's second
constraint — that the `#`-private grid/keyboard/date-math machinery in `calendar.ts` could not be
reused by a second control without extraction: with one component there is no second consumer,
and nothing needs to move.

## Decision

We will add a **`mode` flag to `ui-calendar`** (no new component, no base extraction), with a
normative one-live-value-surface rule that keeps the mode-conditional contract from forking
silently:

1. **Mode prop + the one-live-value-surface rule.** `mode: prop.enum(['single','range'],
   'single'), reflect: true` — an enum, not a bare boolean, leaving room for foreseeable modes
   and matching the fleet's `size` enum pattern. New string props **`valueStart` / `valueEnd`**
   (kebab attrs `value-start` / `value-end` via explicit `attribute:` overrides — the
   `ui-slider-multi` shape; reflected; `''` = unset). The rule that un-forks the contract:
   **exactly one value surface is live per mode.** In `mode="single"` (the default) `value` is
   live and `valueStart`/`valueEnd` are *inert*; in `mode="range"` the pair is live and `value`
   is inert. *Inert* = held and reflected but contributing **nothing** — not to rendering, not to
   `formValue()`/`formValidity()`, not to event payloads — and **the control never writes an
   off-mode prop**: a mode switch is a reconfiguration, not a data migration (no destructive
   clearing), which also makes declarative markup upgrade-order-safe — `<ui-calendar mode="range"
   value-start="…" value-end="…">` behaves identically regardless of attribute processing order.
   Precedent: `ui-slider-multi` already ships an inherited-but-inert `value` alongside
   `valueLo`/`valueHi` (its §props note: "an inherited prop that slider-multi does not actively
   use"); this clause gives that shape a normative name. `calendar.md` states each prop's
   per-mode liveness.
2. **Range-mode value shape.** **Form submission:** a complete pair submits as FormData with
   **two entries under the same `name`** (start first — the `ui-slider-multi` `formValue()`
   precedent, and the native multi-select shape); a half-open or inverted pair contributes
   **nothing** (`null`) — a range is atomic. **Validity:** `valueMissing` (required + no complete
   pair), half-open ("select an end date"), inverted (`valueStart > valueEnd` — reachable only by
   programmatic set, never by interaction, see clause 3), `rangeUnderflow`/`rangeOverflow` per
   endpoint against `min`/`max`. **Props stay author-faithful:** the control never auto-swaps a
   programmatically set inverted pair — it stays inverted and reports invalid; reordering is a
   pick-gesture semantics (clause 3), not a prop normalization. **Events:** `select` (detail =
   the picked ISO) per endpoint pick; `change` **only when the pair completes** — the two-way-
   binding event, mirroring the single-date contract. In range mode the renderer's
   `value:{prop:'value', event:'change'}` two-way bind is inert-but-harmless (it reads a constant
   `''`); the catalog consequence is clause 7.
3. **Interaction: single grid, two picks, swap-complete.** First commit gesture (click /
   Enter/Space — the existing commit path) sets `valueStart` and enters *selecting-end*; while
   selecting, the cells between the pending start and the hovered **or keyboard-focused**
   candidate show the in-range fill as a preview (the cursor IS the "which end am I editing"
   answer: no pending start → picking start, pending start → picking end). **The second commit
   gesture completes the range regardless of direction: the committed pair is
   `[min, max]` of {pick, pending start} by lexicographic ISO compare — a pick *earlier* than the
   pending start completes by SWAP** (Kim's F2 ruling; replaces the draft's MD3 restart), so
   `valueStart <= valueEnd` always holds interactively. The swap happens **at the second commit
   gesture only** — but the preview already renders the *normalized* interval while selecting (a
   candidate earlier than the pending start previews the band `[candidate, pendingStart]`, the
   pending start keeping its endpoint mark), so the committed band is always exactly the
   previewed band: commit never surprises. Same-day second pick = a valid single-day range. A
   pick on a complete range starts a new one (`valueStart` = pick, `valueEnd` = `''`, back to
   *selecting-end*). Disabled/out-of-range cells stay commit-no-ops. **Escape is not
   intercepted** — dismissal belongs to the overlay platform (ADR-0045); an abandoned pending
   start is simply superseded by the next pick. A visually-hidden `aria-live=polite` status part
   (range mode only) announces the transitions ("Start date set — choose an end date"); the
   completion announcement names **both dates in order**, so a swapped completion is audible as
   the resulting range.
4. **Fill styling.** Range mode stamps `data-range-start` / `data-range-end` / `data-in-range` on
   cells (single mode stamps none of them — grep-provable); endpoints reuse the existing circular
   `--ui-calendar-selected-fill`/`-ink`; interior cells get a **square** (radius-0) wash from
   `--ui-calendar-range-fill`/`-ink` — the ADR-0048 reserved tokens, realized as aliases of the
   `--md-sys-color-primary-surface` / `-primary-on-surface` pair (AA-verified by the tokens seat,
   both schemes). Preview and committed interiors share one fill (the moving cursor already
   distinguishes in-progress). `aria-selected="true"` on endpoints **and** interior — the whole
   run is the selection. **Forced-colors:** the band (endpoints + interior) maps to
   `Highlight`/`HighlightText` — the band is self-delimiting, so endpoint-vs-interior needs no
   third color — while today keeps its `ButtonText` inset ring and focus its outside `Highlight`
   outline (the ADR-0048 three-state discipline, now four states). Fill-presence + the endpoint
   circles satisfy ADR-0057's non-color-signifier rule.
5. **Timezone-safety.** The in-range predicate is **lexicographic zero-padded ISO string
   comparison** (`start <= iso && iso <= end`) — the exact mechanism `calendar.ts`'s
   `isOutOfRange` already proves chronologically correct with **zero Date construction**, so the
   UTC-parse trap class the single-date control solved cannot re-enter through the range path.
   The same predicate normalizes the swap and the preview (`[min, max]` is a string compare, not
   date math). Interior marking applies to any displayed cell inside the pair — including
   `[data-outside]` cells and months containing neither endpoint (a band spanning months renders
   correctly on every grid it crosses).
6. **Machinery stays `#`-private; no extraction.** With one component there is no second
   consumer: the draft's `_base/calendar-element.ts` extraction (ADR-0042 shape) is dropped, the
   grid/keyboard/date-math machinery stays `#`-private in `calendar.ts`, and ADR-0048's
   `roving-grid` trait trigger ("extract only when a second grid control appears") still does
   **not** fire — the consumer count did not change. Range lands as guarded mode branches inside
   the existing paths (`#commitDate` becomes mode-aware; `#rebuildGrid`/`#updateCellStates` gain
   range stamping), written so `mode="single"` executes the existing code paths unchanged.
7. **Backward compatibility + A2UI.** Purely additive at the default: markup with no `mode`
   attribute is today's control, byte/behavior-identical — the existing jsdom + browser calendar
   suites, run **unmodified**, are the gate. No new control: barrel, `BASE_CLASSES`, and
   per-control `exports` are untouched; the calendar's ADR-0080 leave-one-out marginal re-bases
   instead. The shipped A2UI `Calendar` catalog row (ADR-0087 Wave B) is untouched by this
   change; the follow-up under ADR-0087's scope policy is now a **row edit, not a new row** —
   `Calendar` gains an optional `mode` property + one-way `valueStart`/`valueEnd` binds (the
   `SliderMulti` limitation applies: the row's one two-way slot stays `value`, which is inert in
   range mode, so range values bind one-way until the catalog schema grows a second two-way slot).

Decomposition (both planes, coverage-clean, v2 — the replan diff from the standalone-component
v1 manifest is stated in its `_meta`): `.claude/docs/decompositions/calendar-range.decomp-v2.json`.

## Consequences

- **The mode flag edits a shipped, gold-standard control in place.** The first draft rejected
  this packaging precisely because the value shape forks under the flag; Kim's ruling accepts
  that cost, and clause 1's one-live-surface rule is the containment: `formValue`,
  `formValidity`, events, and rendering all branch on `mode`, and every branch owes a per-mode
  test. The regression gate is the same idea the dropped extraction had — the existing
  single-date suites run unmodified — but the risk now lives inside proven code as new branches
  rather than in a refactor around it.
- **Single-date consumers carry the range code.** One module, no tree-shake seam between modes —
  `type=date`'s lazy `import()` (ADR-0048 §3) now pulls range machinery it never uses. The
  rejected sibling component would have paid a `_base`-indirection tax instead; this is the
  accepted trade. Measured, not guessed, at the integration slice: the calendar marginal
  re-bases (ADR-0080), the family budget (ADR-0049) is re-checked, and `npm run size` stays
  manual (Kim's ADR-0040 §3 ruling).
- **A mode-conditional contract is a real comprehension tax.** Two value surfaces exist on every
  instance; which one is live is a runtime question. Mitigations: the enum is reflected (DOM- and
  CSS-inspectable), `calendar.md` states per-prop liveness, and off-mode props are inert-not-
  cleared (no spooky writes to author state).
- **Swap absorbs pick order — and erases it.** A user who genuinely mistyped the start cannot
  "re-anchor" by picking earlier: that pick swap-completes instead of restarting. The recovery is
  the next pick (which starts a new range). Accepted per Kim's F2 ruling; the normalized preview
  makes the outcome visible before commit, which is the design's answer to the draft's
  "every pick's meaning stays literal" objection.
- **The band has 2px seams.** Cells sit in a CSS grid with `--ui-calendar-gap`; v1 fills cells,
  not gaps, so the run reads as a segmented band. Accepted for v1; a gap-bridging treatment
  (half-cell pseudo-elements under the endpoints, gap-spanning backgrounds) is polish, not
  contract.
- **No dual-pane view in v1** (F3, confirmed by Kim). One month grid, exactly as today; a
  side-by-side two-month presentation is a later presentational prop, not blocked by this design.
- **Typed entry is out of scope here.** The pattern guidance ("typed input first, calendar as
  assist; ranges get presets") applies to the *field* around a picker; a range text-field type
  and preset chips (Today / Last 7 days) are compositions on top of this control, not in it.
- **Stale → re-verify on build:** `calendar.{ts,css,md}` + tests · the site controls page · the
  ADR-0087 follow-up disposition for the `Calendar` row's `mode` property (allowlist/row edit) ·
  the ADR-0080 pinned marginal for calendar.

## Acceptance

Default-mode regression: the existing calendar jsdom + browser suites pass **unmodified**;
`calendar.md` single-mode rows unchanged; no `data-range-*` attribute is ever stamped in single
mode. Range mode (jsdom): the four state-machine transitions (forward-complete ·
**swap-complete** · same-day · new-range-over-complete), click ↔ Enter/Space parity; preview
normalization **in both directions** (candidate before AND after the pending start); FormData =
exactly two same-name entries when complete, zero when half-open; a programmatically set inverted
pair stays inverted and reports invalid (no auto-swap); validity per enumerated case;
`formReset`/`formStateRestore` of the pair; `change` only on completion; **inertness probes**
(`value` set in range mode contributes nothing; `valueStart`/`valueEnd` set in single mode
contribute nothing; flipping `mode` writes zero value props); contract↔props trip-wire; C10
zero-residue. In-range predicate: pure string comparison (no `new Date(` on the compare path —
grep-provable), band across a month boundary renders on both grids. Browser (Chromium + WebKit):
endpoint vs interior computed backgrounds differ; the range-ink/range-fill pair ≥ 4.5:1 both
schemes; forced-colors keeps focus/band/today/disabled distinct.

## Alternatives considered

- **A new `ui-calendar-range` component over an extracted `_base/calendar-element.ts` — this
  ADR's own first-draft recommendation.** Overruled by Kim's F1 ruling (2026-07-07), a
  product/taste call rather than new evidence; the draft's reasoning is preserved here so the
  record shows why the design changed. It argued: the value shape never forks (each control keeps
  exactly one contract), a shipped form control's surface stays untouched, and the fleet
  precedent for a dual-ended value is the sibling component (`ui-slider-multi`), not a flag. What
  it would have cost, honestly: a `_base` extraction refactor of proven `#`-private code (the
  draft's own named risk center), a permanently wider `protected` internal API, a second control
  to document/ship/navigate, and a new A2UI catalog row. Kim ruled one calendar, mode-flagged;
  the draft's clauses 2–5 survived the repackaging intact — exactly as its F1 note predicted.
- **`range` as a bare boolean attribute** — rejected: an enum (`mode`) leaves room for
  foreseeable modes (`week`, `multi`) without a future flag-vs-flag arbitration, matches the
  fleet's `size` enum pattern, and reads declaratively.
- **Auto-swapping a programmatically set inverted pair** — rejected: props stay author-faithful;
  silently rewriting an author's set is spookier than an honest `inverted` validity flag. Swap is
  a gesture semantics enforced at the single commit point, where the preview has already shown
  the user the normalized result.
- **Restart-on-earlier-second-pick (MD3)** — the draft's F2 recommendation, overruled by Kim for
  swap-complete. Its case: every pick's meaning stays literal ("this is my start"). Swap's case,
  now adopted: the user's two picks define the interval and order is a detail the control
  absorbs; the normalized preview shows the outcome before commit.
- **A single delimited `value` (ISO-8601 interval `"2026-07-01/2026-07-14"`)** — rejected as the
  primary surface: not independently bindable (A2UI/data binding wants per-endpoint props), needs
  a parse step in every consumer, and diverges from the fleet's `valueLo`/`valueHi` precedent.
  Standards-flavored but ergonomically worse; could be added later as a convenience accessor.
- **Two form entries named `name-start`/`name-end`** — rejected: the fleet precedent
  (`ui-slider-multi`) and the native analogue (multi-select) both submit repeated entries under
  the one authored `name`; suffix-mangling an author's field name is surprising.
- **Dual-pane (two side-by-side month grids) in v1** — rejected, and F3 confirmed by Kim: doubles
  shell/nav complexity for a presentational nicety; the single-grid model is the same one the
  popup body uses. Revisit as a `panes` presentational prop once the range model is proven.

## Resolved forks (Kim, 2026-07-07)

- **F1 — Component vs mode: MODE FLAG** on `ui-calendar` — overrules the draft's standalone-
  component recommendation (recorded above under Alternatives).
- **F2 — Second-pick-before-start semantics: SWAP** (reorder so start stays earlier) — overrules
  the draft's MD3 restart recommendation.
- **F3 — Grid presentation: SINGLE month grid** v1, dual-pane deferred — confirms the draft.

## Build sequencing (sizing note — this is a MEDIUM feature, not a patch)

Slices per the decomp-v2 edges; each independently gated (`npm run check && npm test`, browser
suite where named). Slices 1 is serial by construction — one writer, one file (`calendar.ts`).

1. **Mode surface + state machine + preview + form seams + status** (`calendar.ts`, serial) —
   props/arbitration, swap-complete state machine, normalized preview, mode-conditional form
   seams, aria-live part + the jsdom legs. Gate = the untouched existing suites AND the new
   range/inertness tests. The risk center of the wave: in-place surgery on a shipped control.
2. **Tokens** — realize `--ui-calendar-range-*` (AA verify, both schemes; tokens before CSS: the
   contrast probe needs real values).
3. **CSS** — band styling, WHCM leg + browser/contrast probes.
4. **Descriptor + site page** — `calendar.md` mode/pair rows + range demo; trip-wire,
   nav/coverage gates.
5. **Integration (serial)** — no barrel/exports change; re-base the calendar marginal
   (ADR-0080), re-check the family budget (ADR-0049), manual `npm run size`.

Honest size: smaller than the draft's plan — the extraction slice (its risk center) is gone, and
no new control ships. What replaces it is guarded in-place modification of proven code with the
same regression gate. Still a real control wave with cross-engine browser legs, not an afternoon.

## Erratum (2026-07-07 — post-ship gallery audit; append-only, per the ADR log's own rule)

Clause 4's `--ui-calendar-range-fill`/`-range-ink` alias of `--md-sys-color-primary-surface` /
`-primary-on-surface` was **AA-clean by the letter but visually near-invisible in practice**: a
live gallery audit (screenshots + computed-style proofs, both engines) measured the panel
background (`--md-sys-color-neutral-surface`) and the in-range fill differing by only ~0.001
OKLCH L in BOTH schemes (light 0.9336 vs 0.9347; dark 0.2598 vs 0.2592) — the endpoint contrast
math the clause cited was real (ink-vs-fill, not fill-vs-panel), but nothing in the clause checked
the fill against the surface it sits on, so the band read as a flat, undifferentiated panel.
`--ui-calendar-range-fill` is now repointed to `--md-sys-color-primary-surface-highest` (ink
unchanged, still `-primary-on-surface`) — an EXISTING token, no new one minted — giving a
0.0655/0.0722 OKLCH-L separation from the panel (light/dark; ~65×/~72× the old gap) while keeping
ink-vs-fill contrast at 12.70:1 (light) / 12.16:1 (dark), still comfortably past the AA 4.5:1 floor.
Endpoint (circular solid fill), today-ring, and forced-colors states are untouched and unaffected —
this amends only the interior-wash TOKEN CHOICE in clause 4, not its shape/structure/forced-colors
decisions. See `controls/calendar/calendar.css` (§1 token block comment) for the full measurement.
