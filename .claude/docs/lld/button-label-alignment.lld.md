# LLD — ui-button label-alignment law (single adornment ⇒ start-aligned label; GH #442)

> Status: proposed · v0.1 · 2026-08-05 · design intake seat · Layer: LLD (implementation plan)
>
> Refines: [ADR-0171](../adr/0171-button-label-alignment-single-adornment-start.md) (proposed —
> the build starts only from the ratified text; the LAW itself is Kim's 2026-08-05 ruling and is
> not up for redesign, the ADR's two sub-decisions — row 8 clarify / row 10 reject — await the
> flip). Decomposition:
> [`../decompositions/button-label-alignment.decomp.md`](../decompositions/button-label-alignment.decomp.md).
>
> **Composes on:** the SHIPPED ui-button anatomy — host-as-grid five structures (ADR-0006/0012,
> `button.css:139-221`), the label wrapper + heal observer (ADR-0133, `button.ts` +
> `button.css:112-137`), the GH #293 clamp law (`justify-self` + `max-inline-size: 100%`), and the
> existing probe suites (`button-css.test.ts`, `button-label-overflow.browser.test.ts`,
> `button-geometry*.test.ts`, `button-states.browser.test.ts`). The geometry law is a FENCE:
> templates, cells, pads, gap, the `[icon-only]` square, and BTN-CARET change zero bytes.
>
> **Freeze discipline.** §4 is the complete probe-flip contract; a builder who finds a probe
> outside it red for this change STOPS and escalates — never a local workaround.

## 1 · Intent

Make the label's inline alignment structure-conditional: `justify-self: center` stays the base
(bare `[label]`, double-adorned `[leading|label|trailing]`); the two single-adornment structures
(`[leading|label]`, `[label|trailing]`) override to `justify-self: start` via the anatomy's own
presence selectors, so an adornment and its label read as one cluster instead of an orphaned
glyph plus a floating centered label (the agent-admin `| + |……Add section……|` symptom). GH #293's
ellipsis mechanics survive: any non-`stretch` `justify-self` sizes the wrapper to fit-content,
and the `max-inline-size: 100%` clamp + `overflow: hidden; text-overflow: ellipsis` are untouched.

## 2 · Fork sheet (component-design — a contract-changing fork on an existing control)

| Row | Decision |
|---|---|
| Tag | `ui-button` — unchanged (existing control, no new tag) |
| Anatomy | UNCHANGED structures (five, ADR-0006/0012). ONE new CSS rule: the two single-adornment structure selectors (reused verbatim from the `auto 1fr` / `1fr auto` template rules) target `> [data-part='label']` with `justify-self: start`. **The fork:** alignment joins the structure table as a per-structure property — ADR-0171 cl.1 |
| Props | UNCHANGED — no new prop; the law is presence-derived, never author-opted (a prop would be a second alignment truth) |
| Events | UNCHANGED — none touched |
| Geometry | UNCHANGED — no template/pad/gap/height change; fenced above. Alignment is not a geometry quantity (the track, its size, and its edges are identical; only the item's position within leftover space moves) |
| Tokens | UNCHANGED — no token consumed or minted; alignment is a keyword, not a themeable quantity |
| A11y | UNCHANGED — visual-only; accessible name, roles, keyboard map untouched |
| Interaction states | UNCHANGED — no state participates in alignment |
| Form participation | n/a (not form-associated) |
| Site surfaces | `button.md` prose (alignment column + row-8 "adornment-only" clarification — ADR-0171 cl.3); `site/pages/button-permutations.ts` re-baselines visually (comments only, no assertions); gallery/preview specimens unchanged in markup |
| Open forks (ADR) | (1) row 10 icon+caret-no-label: REJECT, revisit trigger named — ADR-0171 cl.4; (2) row 8 caret-only: already legal via `[icon-only]`, docs clarification only — cl.3. Both `proposed`, awaiting Kim |

Precedent sweep: no other fleet control conditions label alignment by structure (grep
`justify-self` across `controls/` — hits are button + the icon-only `justify-content`); the
presence-driven `:has()` structure selector is the established button mechanism (ADR-0006), reused
here rather than any new axis. The label wrapper's real signature verified against shipped source
(`button.css:131-137`, `button.ts` adoption) — no summary-derived API enters this design.

## 3 · The frozen CSS design (the whole diff, one file)

`packages/agent-ui/components/src/controls/button/button.css` — after the existing
`[data-part='label']` rule (which keeps `justify-self: center` as the base), add:

```css
/* Alignment law (ADR-0171, GH #442) — a SINGLE adornment start-aligns the label in its track;
   center remains the base for bare and double-adorned. Selectors reused verbatim from the
   auto 1fr / 1fr auto template rules above, so alignment can never disagree with the structure
   that placed the track. fit-content sizing + the max-inline-size clamp (GH #293) hold under
   `start` exactly as under `center` — any non-stretch justify-self shrink-wraps the item. */
:scope:has(> [slot='leading']):not(:has(> [slot='trailing'])):not([icon-only]) > [data-part='label'],
:scope:has(> [slot='trailing']):not(:has(> [slot='leading'])):not([icon-only]) > [data-part='label'] {
  justify-self: start;
}
```

Plus: the GH #293 comment block (`button.css:118-130`) gains a dated pointer sentence ("center is
the BASE; single-adorned structures override to start — ADR-0171") rather than a rewrite. No
other CSS changes. `button.ts` is byte-untouched.

> **REV 2026-08-05 (stale-record repair, `screens:component-checker` review of the fix-442-button-alignment
> build — MINOR-1):** the code comment above says the `auto 1fr` / `1fr auto` template rules are reused
> verbatim from "above" — that was this record's own error. §3 places the new override rule right after the
> base `[data-part='label']` rule, which sits ABOVE the template rules in `button.css`'s real ordering — so
> the rules being reused verbatim are BELOW, not above. The landed `button.css` comment correctly reads
> "below"; this note repairs the frozen text to match, rather than the build silently drifting from its own
> design record. No CSS/behaviour change — comment wording only, in both files.

## 4 · Probe-flip contract (frozen — the build touches NO probe outside this list)

**Flips (existing assertions that invert or extend):**

| Probe | Today | Becomes |
|---|---|---|
| `button-css.test.ts:75-83` — "GH #293: the label wrapper centers…" | asserts `justify-self: center` in the `[data-part='label']` rule + `max-inline-size: 100%` + no `text-align` | KEEPS all three (center stays the base) and EXTENDS: a new assertion that the single-adornment override rule exists — both `:has()` arms present with `justify-self: start`; title re-worded to the ADR-0171 law |
| `button-label-overflow.browser.test.ts:85-103` — "leading+label stretched wide: the label centers within ITS OWN track (GH #293)" | asserts `abs(insetStart − insetEnd) ≤ 2` within the label track | INVERTS: `insetStart ≤ 2` (label's start edge lands at the track start, i.e. flush after icon + gap) AND `insetEnd > insetStart` by a real margin (anti-vacuous: there IS leftover space, it all sits at the end); title re-worded |

**Holds (must stay green, re-verified, zero edits):**

- `button-label-overflow.browser.test.ts:54-66` — the leading-icon+label wrapper-geometry leg:
  pads only (½(h−icon) start, h/2 end), alignment-blind — untouched by the law.
- `button-label-overflow.browser.test.ts:70-83` — bare slotless stretched button still CENTERS
  (rows 7 law unchanged).
- `button-label-overflow.browser.test.ts:105-125` — bare overflowing label still clamps to track
  width + ellipsizes (the clamp law).
- `button-label-overflow.browser.test.ts:128-174` — ellipsis + heal-observer legs (ADR-0133).
- `button-geometry.browser.test.ts` — all pads/frames incl. `:330-338`'s `[leading|label]`
  regression guard (pads only, alignment-blind) and the BTN-CARET legs (`:202-233`).
- `button-states.browser.test.ts` — the BTN-CARET describe (`:236`), states, ring.
- `button-geometry.test.ts:104-122` — the per-edge asymmetry + trailing-anatomy assertions HOLD,
  but note the anchor: both tests slice `stylesBlock` from
  `indexOf(":scope:has(> [slot='leading']):not")` / `indexOf(":scope:has(> [slot='trailing']):not")`,
  and with §3's placement (right after the `[data-part='label']` rule, ABOVE the template rules)
  the NEW override rule becomes the first `indexOf` match. The assertions still pass — the slice
  from the earlier match still contains the template rules below — but the anchor no longer
  points at the rule the comment names; the builder must not "fix" the anchor reflexively, and
  must not move §3's rule below the templates to dodge it (either is an out-of-list probe edit —
  escalate if the slice idiom needs a decision).
- `button-geometry.test.ts:132-140` — icon-only `justify-content: center` (a DIFFERENT property
  on a different structure; untouched).

**New probes (added in the build):**

1. Browser, per-structure alignment matrix (the ADR-0171 cl.5 lock): four labeled structures ×
   expected alignment at a stretched width (400px) —
   `[label]` centered · `[leading|label]` start · `[label|trailing]` start (label flush at the
   h/2 start edge; adornment at end) · `[leading|label|trailing]` centered between the cells.
   Measured via boundingClientRect insets within each structure's real track (the `:85-103` probe's
   measurement idiom), ≤2px cross-engine slack, anti-vacuous leftover-space guards.
2. Browser, single-adorned overflow (ADR-0171 cl.2): `[leading|label]` at `inline-size: 80px`
   with a long label — wrapper width ≈ its track width (clamp holds under `start`),
   `scrollWidth > clientWidth` (genuine overflow), computed `text-overflow: ellipsis`.
3. jsdom (`button-css.test.ts`): the override rule's selector text pins both arms + the
   `:not([icon-only])` exclusions (so the fifth structure can never catch a stray label rule).

Both browser probes run in the existing `button-label-overflow.browser.test.ts` /
`button-geometry.browser.test.ts` shards — NO new shard, no re-monolith (the
`component-testing` shard law).

## 5 · Build sequence (one writer per file; dispatchable as ONE slice)

| Step | File(s) | Work |
|---|---|---|
| S1 | `button.css` | §3's rule + the comment pointer |
| S2 | `button-css.test.ts` · `button-label-overflow.browser.test.ts` | §4's two flips + new probes 1–3 |
| S3 | `button.md` | alignment column in the anatomy prose + the row-8 "adornment-only" clarification (ADR-0171 cl.3); frontmatter `attributes[]` untouched |
| S4 | gates | `npm run check && npm test` + `npm run test:browser` FOREGROUND, judged by exit codes |

Single-writer-safe: S1–S3 touch disjoint files; one builder runs all four in order. Site
permutation-page visual re-baseline rides the same PR (no assertions there — inspection only).

## 6 · Acceptance

- The §4 flip list is exhaustive: `npm test` + `npm run test:browser` green with NO probe edited
  outside it (a red probe outside the list = escalate, the design reopens).
- The alignment matrix probe proves all four labeled structures' alignment per Kim's table.
- The single-adorned overflow probe proves clamp + genuine overflow + rendered ellipsis under
  `justify-self: start` — GH #293's mechanics demonstrably intact.
- GH #442 gets a dated Findings comment; the issue closes on merge.
