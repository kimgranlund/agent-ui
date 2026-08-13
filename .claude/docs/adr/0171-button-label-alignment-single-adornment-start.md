# ADR-0171 — Button label alignment: CENTER only bare and double-adorned; a SINGLE adornment start-aligns the label (Kim's 2026-08-05 ruling, GH #442)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-05
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-05 |
> | **Proposed by** | design intake seat (agent-ui-component-design, GH #442 — the LAW itself is Kim's explicit ruling, 2026-08-05 agent-admin review; this record carries it plus the two sub-decisions the ruling left open) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-05, via the [`ratify ADR-0171` utterance](https://github.com/kimgranlund/agent-ui/pull/443#issuecomment-5187454117) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
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

## Amendment (2026-08-05) — single-adorned buttons SPREAD icon⟷label to opposite edges at stretch; hug-width rendering unchanged (Kim's ruling, GH [#450](https://github.com/kimgranlund/agent-ui/issues/450))

> Append-only. The Status cell, its vocabulary, and every accepted section above stay byte-untouched —
> agents never flip status; Kim's merge of the PR carrying this amendment's build is the ratifying
> utterance, and GH [#450](https://github.com/kimgranlund/agent-ui/issues/450) is the durable record of
> the ruling itself (Kim in-chat, 2026-08-05, BUGS session, screenshot on file). The ruling fixed BOTH
> the direction (spread, with design counsel on the table — §A5) and the vehicle: GH #450's open fork
> (scoped posture vs law amendment) is ruled **fleet-wide LAW AMENDMENT** — this record's cl.1 changes
> ONE alignment value (the leading-only arm), while the mechanism family (item alignment inside the
> existing `1fr` track, presence-derived selectors, GH #293's ellipsis mechanics, the whole geometry
> law) and cl.2–5 stand — which is why this is an amendment on the ruling's own instruction, not a
> supersession.

Kim's ruling (GH #450): wide single-adorned buttons lay out **adornment at the start edge, label at
the end edge** (space-between semantics) — not the start-aligned cluster cl.1 ruled:

```
│ [+                    Add skill] │
│ [+                 From library] │
```

The amended per-structure law (replaces the Context table's rows 1/3 and re-derives 2/4's rationale;
rows 5/6/7/8 unchanged):

| # | structure | label alignment (amended) |
|---|---|---|
| 1/3 | `[leading \| label]` | **END-pinned** — adornment at start edge, label at end edge (spread) |
| 2/4 | `[label \| trailing]` | **START-pinned** — label at start edge, adornment at end edge (spread; shipped bytes UNCHANGED, §A2) |
| 5/6 | `[leading \| label \| trailing]` | CENTERED (unchanged) |
| 7 | bare `[label]` | CENTERED (unchanged) |
| 8/9 | no label | n/a (unchanged) |

The law's rationale re-derives with it: cl.1's "alignment follows adornment COUNT" (the cluster
reading) retires; the amended reading is **a single adornment and its label pin to OPPOSITE edges of
the inner row**. Under that reading the shipped trailing-only behavior — which cl.1 described as a
start-CLUSTER but which the `1fr auto` template in fact renders as label-at-start /
adornment-at-end when stretched — was already the spread shape; only the leading-only arm was ever a
true cluster, and it is the one arm that mechanically changes.

### A1 — Leading-only spreads: ONE declaration flips, and hug-width rendering is NORMATIVELY identical

The `[leading | label]` structure's label overrides to `justify-self: end` (was `start`). The shared
two-arm rule at `button.css:146-149` splits — the selectors themselves are reused byte-verbatim from
the `auto 1fr` / `1fr auto` template rules, exactly as cl.1 ruled:

```css
:scope:has(> [slot='leading']):not(:has(> [slot='trailing'])):not([icon-only]) > [data-part='label'] {
  justify-self: end; /* spread: icon at start edge, label at end edge (ADR-0171 Amendment, GH #450) */
}
:scope:has(> [slot='trailing']):not(:has(> [slot='leading'])):not([icon-only]) > [data-part='label'] {
  justify-self: start; /* spread, mirrored: label at start edge, adornment at end (unchanged bytes) */
}
```

Why item alignment and not `justify-content: space-between` on the host grid: there is no container
leftover to distribute — the label's `1fr` track consumes ALL leftover space by construction
(`button.css:118-121`'s own analysis), so `space-between` over `auto 1fr` tracks moves nothing. The
lever is, as in the accepted Decision, the item's alignment inside its flexible track.

**Normative hug-width-equivalence clause.** At CONTENT (hug) width the `1fr` track resolves to
exactly the label's fit-content width (under `white-space: nowrap`, min-content == max-content), so
`start`, `end`, and `center` are pixel-indistinguishable — and the adornment⟷label separation is
exactly the grid `column-gap: var(--ui-button-gap)` (fed from `--md-sys-gap-{sm|md|lg}`), which
remains the **MINIMUM separation at every width**: a hug-width single-adorned button renders
byte-identically before and after this amendment, and the spread manifests ONLY when the button's
inline-size exceeds its content — flex/grid `stretch`, an explicit inline-size, or a
`min-inline-size` floor. A build that changes any hug-width rendering has breached this clause.

GH #293's ellipsis mechanics survive under `end` by the same construction cl.2 proved for `start`:
any non-`stretch` `justify-self` sizes the item to fit-content, and the `max-inline-size: 100%`
clamp + `overflow: hidden` + `text-overflow: ellipsis` are untouched — an overflowing label's box
fills the track (alignment is moot at overflow) with the ellipsis still end-anchored. `text-align`
stays banned.

### A2 — Trailing-only mirrors: label at start edge, adornment at end — shipped bytes UNCHANGED

The mirror (label pins to start, adornment to end) is what the shipped `1fr auto` template +
`justify-self: start` already render — the PR #448 browser assertion at
`button-label-overflow.browser.test.ts:165-179` ("label flush at the leading (h/2) edge, adornment
stays at the end") pins the amended spread shape verbatim today. The trailing arm therefore changes
ZERO bytes; only its prose rationale (cluster → spread) re-labels where touched.

### A3 — Bare and double-adorned keep the accepted centering, byte-untouched

Rows 5/6/7 are outside this amendment: the base `justify-self: center` on `[data-part='label']`
(`button.css:133-139`), the bare-structure GH #293 probe, and the double-adorned centering stand
exactly as the accepted Decision ruled them.

### A4 — Affected consumers and the probe flips (the frozen list for the amendment's build)

Consumers that manifest the change (stretched/full-width single-adorned `ui-button`s found in-tree):

- **agent-admin entry-add affordances** — the GH #450 subjects:
  `app/src/controls/agent-admin/entry-list.ts:102-110` (`[data-part='entry-add-toggle']`, "+ Add …")
  and `:123-137` (the entry-library-menu trigger, "+ From library"). Both are full-width **by
  construction**: `[data-part='entry-section']` is `flex-direction: column` with the default
  `align-items: stretch` (`agent-admin.css:235-239`), and `ui-menu`'s host is `display: contents`
  (menu.css) so the trigger stretches identically. No agent-admin CSS change is needed — the fleet
  law lands on them for free.
- Every hug-width single-adorned button fleet-wide (toast close is `icon-only`; no other stretched
  single-adorned consumer found) — unchanged by A1's hug-equivalence clause.
- Regenerated build artifacts whenever `button.css` changes (PR #448's own file list is the
  precedent): `sandbox-frame/dogfood/dogfood-assets.ts` (`node scripts/build-dogfood-assets.mjs`),
  `site/lib/__fixtures__/theme-provider-built.css`, `site/public/llms-full.txt`.
- `button.md:171-181` — the alignment table's two **start** rows re-rule per the amended table above.

The probe flips (PR #448's test surface; this list supersedes the leading-only rows of
[LLD §4](../lld/button-label-alignment.lld.md)'s flip list for the amendment build — the build
changes no probe outside it):

| probe | disposition |
|---|---|
| `button-css.test.ts:75-97` — static: BOTH single-adornment arms assert `justify-self: start` | **FLIPS** — the shared rule splits; leading-only arm asserts `end`, trailing-only arm keeps `start` |
| `button-label-overflow.browser.test.ts:85-108` — "leading+label stretched wide: START-aligns … hugging the icon, leftover at the end" | **INVERTS** — label END-pins in its track (end inset ≤ slack; the leftover lands BETWEEN icon and label) |
| `button-label-overflow.browser.test.ts:149-163` — matrix `[leading \| label]`: START-aligned | **INVERTS** — end-pinned, anti-vacuous leg moves to the start side |
| `button-label-overflow.browser.test.ts:165-179` — matrix `[label \| trailing]`: label flush at start, adornment at end | **UNCHANGED assertions** — already pins the spread; prose re-labels only |
| `button-label-overflow.browser.test.ts:181-200` (double-adorned centers) · `:134-147` (bare centers) · `:70-83` (GH #293 slotless) | **UNTOUCHED** |
| `button-label-overflow.browser.test.ts:203-230` — single-adorned overflow clamp + ellipsis "under `justify-self: start`" | **SURVIVES** — the clamp/ellipsis assertions are value-agnostic; the premise text updates to `end` and the leg must stay green under it (A1's construction) |
| NEW — a hug-width equivalence probe | the amendment's one new leg: a content-width `[leading \| label]` button measures the icon⟷label separation == `--ui-button-gap` and identical geometry to the pre-amendment cluster (A1's normative clause, pinned) |

### A5 — Rejected alternative + the design counsel on the table (honest record)

- **REJECTED: the scoped posture** (GH #450 fork option 1 — an opt-in `justify`/posture attribute, or
  agent-admin-local styling, with the cluster remaining the fleet default). Kim ruled against it:
  the fleet-wide amendment wins. What the scoped route would have bought — no visual break for other
  stretched single-adorned consumers, the cluster's icon-label binding preserved by default — is
  moot in-tree today (A4 found no OTHER stretched single-adorned consumer), and it would have minted
  the anatomy's first alignment PROP, breaking the accepted Decision's "presence-derived, never
  author-opted" property that makes wrong alignment unrepresentable.
- **Design counsel given and overruled — recorded per honest-consequences practice:** spreading
  weakens the icon-label binding (the two read as separate objects at stretch, not one labeled
  action), and edge-pinned icon⟷label is the MENU-ROW idiom — a stretched single-adorned button now
  reads closer to a list/menu row than a clustered button. Kim ruled for space-between with that
  counsel explicitly on the table (GH #450 records it). Consequence accepted: on wide surfaces the
  affordance trades button-gestalt for edge-anchored scannability.
- Visual break at stretch, second round: surfaces that re-baselined onto the PR #448 cluster
  (site permutation pages, gallery specimens) re-baseline again in the amendment's build. Hug-width
  surfaces are provably unaffected (A1's normative clause).
