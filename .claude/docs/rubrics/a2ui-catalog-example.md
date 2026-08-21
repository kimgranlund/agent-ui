# Rubric — a2ui-catalog-example (one catalog-page card)

> Status: accepted · v0.2 · 2026-08-18 (ratified by Kim 2026-08-19, the ruled "after the sweep" condition met: v0.2 survived the full 60-card run + verify round) (v0.1 same day; v0.2 resolves the two escalations the first full
> five-tier review raised — the `demonstrable` definition now encodes the fleet's ruled visibility law, B4's
> anchors decide the bare-but-recognizable case — and repairs §5's own probe list, which omitted A3's gate) ·
> Layer: rubric (the standard ONE card on `site/a2ui-catalog.html` is graded against — the eval framework the
> card screenshots feed).
> Applied by: `.claude/skills/a2ui-catalog-rendering-review` (the review procedure; runner `scripts/screenshot-a2ui-catalog.mjs`).
> Siblings: [`a2ui-catalog.md`](./a2ui-catalog.md) grades the catalog ROW (def + factory + tests); this rubric
> grades the ROW'S DEMONSTRATION — the live playground card a reader sees. Same component, different artifact.

## 1 · The unit under evaluation

One **card** = `section.catalog-item` on the catalog page, for one catalog type `T`:

| Part | DOM | Derived from (the truth to grade against) |
|---|---|---|
| **L — props panel** (left) | `component-preview .preview-knobs`, one `.knob` per prop | `catalog.json` `components[T].properties` → `a2uiKnobs()` (`site/lib/component-preview.ts`); seeds from `A2UI_INITIAL[T]` |
| **R — rendered surface** (right) | `.preview-canvas` → the renderer's output, root tag = `factories.ts` `WidgetFactory.tag` for `T` | `SAMPLE_TREES[T]` / `sampleFor()` (children), the seeded props, the target `ui-*` control's own `{name}.md` descriptor + `{name}.css` |
| **U — uses line** | `.catalog-item-uses` | `seedsUsingType(T)` (gallery seeds that render `T`) |

Nothing on the card is hand-authored per component; every expectation is **derivable**, so most checks are
mechanical. Judgment is reserved for "does the specimen make sense" (§4, B4/C3).

### 1.1 The expected-card record (Decompose step, computed, never hand-listed)

Before any check, derive `expected/<T>.json`:

```
{ type, tier, tag,                       // catalog.json + factories.ts + a2ui-catalog-tiers.ts
  role: widget|input|container|overlay,   // from def.children / value slot / factory tag (overlay = Modal/Drawer/Popover/Menu/Tooltip/…)
  props: [{ name, kind: enum|boolean|number|string|skip, values?, bindable, mapsTo, seed? }],
  demonstrable: [prop…],                 // v0.2 (resolves the v0.1 escalation): the props a LEGIBLE specimen needs —
                                          // the fleet's ruled visibility law (GH #978, A2UI_INITIAL's own comment block),
                                          // NOT every enum/text prop. A prop is demonstrable iff leaving it unset makes R
                                          // empty, meaningless, or unidentifiable (content props: label/text/src/value/
                                          // summary/data arrays); a prop whose default state is already legible (elevation,
                                          // brightness, an align default, an invisible href) is a 5-anchor refinement, not
                                          // a gate item. SAMPLE_TREES-visible content satisfies it without a seed.
  children: none|child|children, sample: <SAMPLE_TREES summary or 'generic-fallback'>,
  uses: [seedName…] }
```

`demonstrable` is the answer to "what props should this card demonstrate": a card that seeds none of them
renders an empty or meaningless R (Attachment today: all four seeds blank → a bare "File" chip).

## 2 · Method — decomposition × two review directions

The same two-axis method `frontend:component-checker` uses, applied to a demonstration instead of a control:

- **Out-in (whole → part, "Compose")**: start from the card's JOB — *show a reader what `T` is and what its
  props do* — and ask whether each part serves it: L exposes the demonstrable props with legible seeds; R shows
  a representative instance; U links real usage.
- **In-out (part → whole, "Realize")**: start from the parts as built — each knob, the seeded value, the
  rendered DOM — and ask whether they compose into a correct, sense-making whole: every knob reaches R, R is
  the right control in the right state, and the picture reads as `T` doing its real job.

Every dimension below is tagged with its direction and its type: **[gate]** = a named probe decides it
(exit code, never re-judged) · **[review]** = judgment grounded in the screenshot + the expected-card record.

## 3 · Dimensions

Scale 1–5; 1 = failure, 3 = adequate, 5 = excellent. Gate-to-promote: **every [gate] green AND no [review] < 3**.

### Axis A — L, the props panel (is the left side ok, does it reflect the component?)

| # | Dim | Dir | Type | Check | 1 → 3 → 5 |
|---|---|---|---|---|---|
| A1 | Knob completeness | in-out | gate | Set of `.knob-label` texts == set of `catalog.json` prop names for `T` (a `skip` knob still appears, with its note) | 1: a catalog prop has no knob, or a knob names a prop the catalog lacks · 3: sets equal · 5: + declared order preserved |
| A2 | Knob kind fidelity | in-out | gate | enum → `ui-select`/`ui-radio-group` with exactly the enum members; boolean → `ui-switch`/check; number → number field; string → text field; complex → labeled skip | 1: wrong control (an enum as free text) or missing enum member · 3: every kind right · 5: + `skip` note names the prop's shape (`object — edit in code`) |
| A3 | Seed sufficiency | out-in | gate+review | Every `demonstrable` prop has a non-empty seed in `A2UI_INITIAL[T]` (or a sample-tree child supplies the visible content) — [gate]: `demonstrable ∖ seeded = ∅` (overlays' `open` exempt by rule, see `A2UI_INITIAL` comment) · [review]: seeds are realistic (`invoice-2026-08.pdf`, not `Sample`) | 1: a demonstrable prop is blank and R shows nothing for it · 3: all seeded, placeholder-grade text · 5: seeds are domain-realistic and chosen to show the prop's *range* (an enum seeded to a non-default member when the default is invisible) |
| A4 | One knob per prop | in-out | gate | No duplicated `.knob-label` text; no second control row for the same prop (`example-authoring-agent`'s doubling law) | 1: doubled · 3: unique · 5: unique + no dead knob (a knob whose change provably does not alter R — see C1) |

### Axis B — R, the rendered surface (is the right side ok, does it render correctly?)

| # | Dim | Dir | Type | Check | 1 → 3 → 5 |
|---|---|---|---|---|---|
| B1 | Renders through the real renderer | in-out | gate | `.preview-canvas` has a child; its root (or first control) tag == `factories.ts` tag for `T`; zero `pageerror`/console errors and zero validator rejections during mount | 1: empty canvas, wrong tag, or an error · 3: right tag, clean console · 5: + surface passes `validate()` when re-serialized (SAMPLE tree + seeds form a valid A2UI payload) |
| B2 | Prop reflection | in-out | gate | For each non-skip knob: set a probe value (2 members for enums, toggle for booleans, a sentinel string) → the `mapsTo` target on the control changes (attribute/prop) AND the canvas re-renders (fresh renderer, N3) | 1: a knob change leaves the control unchanged · 3: every knob reflects · 5: + bindable props verified via a data-model write, not only a static prop |
| B3 | Fidelity to the control's own standard | in-out | gate+review | [gate]: R's control passes the SAME size/geometry assertions the control's own doc page/gallery uses (`{name}.css` `--ui-{name}-*` roles resolved, host box within the descriptor's size row, no overflow of `.preview-canvas`) · [review]: side-by-side with the component-mode preview of the same `ui-*` tag — the A2UI path must not look like a degraded copy | 1: clipped/overflowing/zero-size or visibly off from the ui-* rendering · 3: matches the ui-* rendering at the seeded state · 5: + matches in dark AND light, and at a narrow (414px) canvas |
| B4 | Makes sense (representative specimen) | out-in | review | Given only the screenshot + expected-card record, a reader can say what `T` is and what its job is; content quantity/kind is realistic (a `Table` with rows, a `Timeline` with ≥3 items, an `Attachment` with a name+size); no lorem "Sample content" fallback for a children-bearing type | 1: unreadable/meaningless (an empty chip, one lonely cell) or the generic fallback — a blind identification that FAILS or rests on fallback/incidental cues (a resize grip, an aspect-ratio guess) is 1 by construction · 2: blind-identifiable as `T` but content-empty (bare chrome, zero content — v0.2, decides the bare-but-recognizable case) · 3: recognizably `T` with minimal real content · 5: shows the component's *pattern* — the realistic composition an agent would actually emit (mirrors the corpus's catalog-coverage idioms) |

### Axis C — L↔R coherence and the whole card

| # | Dim | Dir | Type | Check | 1 → 3 → 5 |
|---|---|---|---|---|---|
| C1 | Seed visibility | out-in | gate | Every seeded string/enum value in L is findable in R (text content or attribute) — proves L *describes* R | 1: a seeded value is invisible in R · 3: all visible · 5: + boolean seeds visible as state (`aria-checked`, `open`) |
| C2 | Round-trip liveness | in-out | gate | Editing a knob and reverting restores an identical R (DOM snapshot equal) — the playground is a pure function of L | 1: state leaks across edits · 3: restores · 5: + no leaked top-layer (overlay closed after `open` toggled off) |
| C3 | Card gestalt | out-in | review | Title, kind label, L, R, U read as ONE explanation of `T`; U present when a shelf seed uses `T`; nothing on the card contradicts another part (label says X, canvas shows Y) | 1: contradiction or missing part · 3: coherent · 5: + U links land on the seed (anchor resolves) |

## 4 · Judgment protocol for [review] dims (B3-review, B4, A3-review, C3)

The reviewer (a fresh-context critic — `a2ui-review-agent` class, never the maker) receives, per card:
the screenshot(s) (dark; light when captured), `expected/<T>.json`, and this rubric. It answers, in order:
1. **What is this?** — name `T`, its role, and its job in one line WITHOUT reading the title (blind identify);
   a wrong identification is a B4 = 1 by construction.
2. **What should it demonstrate?** — list `demonstrable` from the record; mark which are visibly demonstrated.
3. **Out-in verdict** (A3/B4/C3) then **in-out verdict** (B3), each with the 1/3/5 anchor it matched and one
   sentence of evidence tied to a region of the image.
4. **Defect quadrant**: `L-only · R-only · L↔R · card` — routes the fix (§6).

## 5 · Runner shape (mechanical layer; extends `scripts/screenshot-a2ui-catalog.mjs`)

`scripts/eval-a2ui-catalog.mjs` — one Playwright pass over the live page, per card:

1. **Derive** the expected-card record — ALL §1.1 fields incl. `demonstrable`, `uses`, `role`, `sample`
   (v0.2: the first sweep's records omitted them, so reviewers re-derived by hand) — importing
   `catalog.json`, `defaultFactories`, tiers, and `component-preview.ts`'s exported `A2UI_INITIAL`.
2. **Probe** A1/A2/A4 (DOM vs record), **A3's gate half** (`demonstrable ∖ (seeded ∪ sample-visible) = ∅`
   — v0.2: v0.1 omitted A3 here, which is exactly how 20+ empty-specimen cards sailed through the first
   sweep's gates green), B1 (tag + console + validator), C1 (seed text search).
3. **Mutate** B2/C2: for each knob, set → assert `mapsTo` change → revert → assert DOM-equal; overlays get
   `open` toggled last and closed.
4. **Measure** B3-gate (box sizes, overflow, token resolution) and **capture**: the card (clip padded a few
   px past the section box — exact-box clips drop the uses line on pixel-parity, the v0.1 even/odd artifact),
   the same `ui-*` tag's component-mode preview (B3-review's side-by-side is unmeasurable without it — every
   v0.1 review returned `?`), and each overlay's REVEALED state (`open` toggled) so B4 is judgeable (dark;
   `--theme both`).
5. **Emit** `eval/<T>.json` (gate verdicts + measurements + screenshot paths) and `eval/summary.md`
   (one row per card: gates ✓/✗ per dim, review dims blank until judged).
6. **Judge**: dispatch [review] dims per card to the critic (batched by tier), merge scores into the summary,
   apply the gate-to-promote rule, and print the failing cards grouped by defect quadrant.
7. **Baseline**: store `eval/baseline/<T>.png` + records; later runs diff pixels (threshold) and gate deltas —
   the eval doubles as a regression harness for the catalog page.

Exit codes: 0 all cards promote · 1 any gate red or any review < 3 (listed, never silently truncated) · 2 setup.

## 6 · Findings route to owners (defect quadrant → seat)

| Quadrant / dim | Owner | Why |
|---|---|---|
| L-only (A1–A4, C1 seeds) | `example-authoring-agent` (`A2UI_INITIAL`, `SAMPLE_TREES`, knob config) | example CONTENT + knob CONFIG is its charter |
| R-only, wrong tag / prop not applied (B1, B2) | `a2ui-build-agent` (`catalog.json`, `factories.ts` `applyProp`/`mapsTo`) | catalog row mechanics |
| R-only, control renders wrong (B3) | `component-build-agent` (the `ui-*` control + css) | the control itself, A2UI path is just a consumer |
| B4 specimen not representative | `example-authoring-agent`; if the catalog TYPE itself can't express a sensible specimen → `a2ui-catalog.md` review of the row | representative-specimen law |
| R-only where the control renders RIGHT natively but wrong through A2UI (the component-mode comparison shot decides) | `a2ui-build-agent` (factory `applyProp`/child construction) — v0.2 addition: the verify round's Ladder case was unroutable without this row | path-specific degradation is catalog-side, not control-side |
| card (C3, U line) | `docs-writer` (page/harness) | page shell + derived links |

## 7 · Non-goals

- Grading the catalog row's code/tests (that is `a2ui-catalog.md`).
- Grading a full composed gallery example/payload (`a2ui-payload.md`).
- Pixel-perfect design review of the `ui-*` control itself (`component.md` / `frontend:component-checker`) — B3 only checks the A2UI path renders the SAME thing the control's own page does.
