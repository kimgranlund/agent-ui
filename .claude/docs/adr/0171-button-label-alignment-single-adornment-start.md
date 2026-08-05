# ADR-0171 — Button label alignment: CENTER only bare and double-adorned; a SINGLE adornment start-aligns the label (Kim's 2026-08-05 ruling, GH #442)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-05
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-05 |
> | **Proposed by** | design intake seat (agent-ui-component-design, GH #442 — the LAW itself is Kim's explicit ruling, 2026-08-05 agent-admin review; this record carries it plus the two sub-decisions the ruling left open) |
> | **Ratified by** | *(awaiting Kim — never self-flipped)* |
> | **Repairs** | `packages/agent-ui/components/src/controls/button/button.css:118-137` (the GH #293 unconditional `justify-self: center` on `[data-part='label']` — becomes structure-conditional, cl.1; the ellipsis mechanics of that comment stay in force, cl.2) · `button.md` "Slots & roles" + the icon-only section (alignment column + the row-8 clarification, cl.3) · probes: `button-css.test.ts:75-83` · `button-label-overflow.browser.test.ts:85-103` (the flip list is frozen in the LLD §4) · **on ratification:** reciprocal `Amended by ADR-0171` housekeeping rows in [ADR-0006](./0006-button-anatomy-optional-icon-slot-density-acceptance.md), [ADR-0012](./0012-button-anatomy-trailing-adornment-slot.md), and [ADR-0133](./0133-button-label-ellipsis-anatomy.md)'s Supersedes cells (the ADR-0101/0170 two-way-link precedent) |
> | **Supersedes / Superseded by** | **Amends** [ADR-0006](./0006-button-anatomy-optional-icon-slot-density-acceptance.md) + [ADR-0012](./0012-button-anatomy-trailing-adornment-slot.md) (the five-structure roster — ADR-0006's structure bullets, ADR-0012's prose, and the `button.css:141-144` comment; there is no literal table in those records — gains a per-structure LABEL-ALIGNMENT property; the grid templates, cells, pads, and the position×role split are byte-untouched) · **Amends** [ADR-0133](./0133-button-label-ellipsis-anatomy.md) (the label wrapper's alignment rule forks by structure; the wrapper, heal observer, and clip mechanics are untouched) · **Relates** GH #442 (the ruling record) · GH #293 (the centering this record narrows — its text-align rejection and clamp law stand) |

## Context

Today every labeled `ui-button` structure centers its label: `[data-part='label']` carries an
unconditional `justify-self: center` (`button.css:131-137`), landed by GH #293 so a button
stretched wider than its content doesn't render the label flush-left. That fix was fleet-correct
for the bare `[label]` case, but it applies to all four labeled structures — and in the
single-adorned ones it reads wrong: agent-admin's Add-section button renders as
`| + |……Add section……|`, the icon orphaned at the edge with dead space between it and its label.

Kim ruled the law on 2026-08-05 (GH #442, fixed input — not up for redesign here):

| # | structure | label alignment |
|---|---|---|
| 1/3 | adornment leading (icon or caret) — `[leading \| label]` | START-aligned (hugs the adornment) |
| 2/4 | adornment trailing — `[label \| trailing]` | START-aligned (adornment at end) |
| 5/6 | `[leading \| label \| trailing]` | CENTERED between them |
| 7 | bare `[label]` | CENTERED |
| 8/9 | single adornment only, no label (caret-only / icon-only) | no label |
| 10 | `\| icon \| caret \|`, no label | no label — not a legal structure today |

Two sub-decisions the ruling left to this record: row 10 (`| icon | caret |`, no label) is not
among ADR-0006/0012's five ratified structures — add or reject; and row 8 (caret-only, no
label), if it differs from today's `[icon-only]`.

The mechanical constraint the design must keep (GH #293's real content): the label wrapper's
ellipsis anchors to a box that (a) never stretches past its track and (b) genuinely overflows
when the text doesn't fit. `text-align: center` was rejected there because centered overflowing
text clips both edges and loses the end-anchored ellipsis; `justify-self: center` +
`max-inline-size: 100%` was the shape that kept the clip. That rejection is not disturbed here.

## Decision

Five clauses. The grid templates, cell sizes, edge pads, column-gap, the position×role split,
and the `[icon-only]` square (ADR-0006/0012's whole geometry law) are byte-untouched — this
record changes ONLY the label's inline alignment within its existing `1fr` track, per structure.

1. **The alignment law becomes structure-conditional.** The base
   `:scope > [data-part='label']` rule keeps `justify-self: center` (rows 5/6/7 — bare and
   double-adorned). The two single-adornment structures override it to `justify-self: start`
   with the SAME presence-driven `:has()` selectors the anatomy already uses:

   ```css
   :scope:has(> [slot='leading']):not(:has(> [slot='trailing'])):not([icon-only]) > [data-part='label'],
   :scope:has(> [slot='trailing']):not(:has(> [slot='leading'])):not([icon-only]) > [data-part='label'] {
     justify-self: start;
   }
   ```

   No new selector vocabulary: these are the exact structure conditions of the `auto 1fr` /
   `1fr auto` template rules (`button.css:177/186`), reused verbatim so alignment can never
   disagree with the template that placed the track. Trailing-only start-aligns too (Kim's rows
   2/4): the label hugs the button's start edge and the adornment sits at the end — alignment
   follows adornment COUNT, not adornment side.

2. **GH #293's ellipsis mechanics survive by construction — and the probes must prove it.**
   In CSS grid, ANY `justify-self` value other than `stretch` sizes the item to its
   fit-content width — `start` shrink-wraps exactly as `center` does — and the
   `max-inline-size: 100%` clamp plus `overflow: hidden; text-overflow: ellipsis` are untouched,
   so an overflowing label's box is still capped at the track width with the ellipsis anchored
   at the line end. `text-align` stays banned (the GH #293 pitfall). The build's browser probes
   MUST include a single-adorned overflow leg (today's overflow probes only cover the bare
   structure) proving clamp + genuine overflow + computed `ellipsis` under `justify-self: start`.

3. **Row 8 (caret-only, no label): already legal — RULED as a documentation clarification, no
   new structure.** The fifth structure `[icon-only]` is role-agnostic by construction: the
   attribute selects the single-column square, the CELL stays icon-sized, and the ROLE sizes
   the glyph (a `data-role="caret"` insets to font size and centers — the same BTN-CARET law as
   everywhere else). A caret-only button is therefore `<ui-button icon-only aria-label="…">` +
   a `data-role="caret"` adornment TODAY, and it renders correctly. The recommendation:
   keep the `icon-only` attribute name (renaming a shipped reflected attribute is churn for
   zero mechanics) and amend `button.md` to state explicitly that `icon-only` means
   "adornment-only / no label" — the attribute names the STRUCTURE, not the role inside it.

4. **Row 10 (`| icon | caret |`, no label): REJECTED as a legal structure — firm
   recommendation.** No sixth structure is added. Rationale: (a) zero consumers — no fleet
   surface composes a label-less two-adornment button, and the descriptor/docs already document
   two slots on `[icon-only]` as undefined; (b) it is semantically a different control — a
   label-less icon+caret pair is a dropdown/split trigger whose meaning has no textContent at
   all, doubling the `aria-label` burden while visually impersonating two controls; (c) the
   geometry cost is real (a new `auto auto` template, a defined inter-adornment gap, new edge-pad
   law, a sixth mutually-exclusive `:has()` arm) with no demand behind it. Named revisit
   trigger: the FIRST real consumer files an issue; the seam is a sixth structure keyed off
   `:scope[icon-only]:has(> [slot='leading']):has(> [slot='trailing'])` — additive, nothing in
   this record blocks it.

5. **The probe contract flips with the law, in the same build.** `button-css.test.ts`'s GH #293
   assertion extends to pin BOTH the base `center` and the two `start` overrides;
   `button-label-overflow.browser.test.ts`'s "leading+label centers within ITS OWN track" probe
   INVERTS to assert start-alignment (label's start edge lands at the track start — after
   icon + gap — within rounding slack); new browser probes lock the full per-structure alignment
   matrix (4 labeled structures × expected alignment) and the cl.2 single-adorned overflow leg.
   The frozen flip list is LLD §4 — the build changes no probe outside it.

## Non-goals

- **No geometry change**: grid templates, cell sizes, ½(h−icon)/h/2 pads, column-gap, the
  `[icon-only]` square, and the caret font-sizing law (BTN-CARET) are all byte-untouched.
- **No new structure** (cl.4's rejection) and no new prop/attribute/event — the law is pure CSS
  within the existing anatomy.
- **No change to the label wrapper mechanism** (ADR-0133): adoption, heal observer, no-title
  law all stand.
- **No fleet sweep beyond ui-button**: other controls with centered labels (if any) are out of
  scope; this record rules the button family only.
- **No build here** — this is the design record; the build is a later dispatch gated on
  ratification.

## Consequences

- Single-adorned buttons read as one visual unit (adornment + label clustered) instead of an
  orphaned glyph and a floating label — the GH #442 symptom class closes fleet-wide wherever
  a `ui-button` is stretched past its content.
- The alignment law is now presence-derived like everything else in the anatomy — a structure
  can never carry the wrong alignment because the selector IS the structure condition.
- The GH #293 probe's "centers within its own track" name becomes historical; the probe flips
  rather than being deleted, so the overflow/clamp coverage it carried is preserved and extended.
- `button.md`'s anatomy prose gains an alignment column and the row-8 clarification — the
  descriptor's machine surface (`attributes[]`) is unchanged, so no descriptor-gate churn.
- Buttons whose current centered-label look was relied upon (single-adorned, stretched) will
  visibly change on ratification+build. This is the point of the ruling, but it is a visual
  break: site permutation pages and gallery specimens re-baseline in the same build.
- Build plan: [`../lld/button-label-alignment.lld.md`](../lld/button-label-alignment.lld.md) ·
  decomposition: [`../decompositions/button-label-alignment.decomp.md`](../decompositions/button-label-alignment.decomp.md).
