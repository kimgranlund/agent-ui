# ADR-0103 — The spacing pair: `ui-radio-group` owns its interior layout (axis from `orientation` + a gap token); `ui-form-provider` stays layout-free and the Column-gap wrap is the taught idiom

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-08
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-08 *(authored)* |
> | **Proposed by** | system-planner — the design seat; tickets #31 (rental-filter-panel radios crash together) + #33 (form-provider spacing), ruled together as the two poles of one fork |
> | **Ratified by** | *(pending — Kim / orchestration-coordinator on gate; doc-reviewer pass first)* |
> | **Repairs** | on ratification+build: `controls/radio/radio-group.css` (the reserved token block at `:21-25` gains `--ui-radio-group-gap`; the `@scope` block gains the flex axis + gap rules) · `controls/radio/radio-group.md` `:94-95` + `:160-161` (the "layout-neutral / page author owns stack direction" contract paragraphs — currently also *factually* wrong: `radio-group.md:94` claims "radios stack in block flow" while `ui-radio` is `display:inline-flex` (`radio.css:82`), so they flow inline) · `site/lib/component-preview.css:108-117` (the specimen-root leg is superseded by the component owning the identical layout — delete, cite here) · radio-group test re-keys named in §Consequences · `a2ui-catalog.spec.md` §5.2 RadioGroup row note (orientation now has a visual effect) · `form-provider.css`/`form-provider.md`: one clarifying sentence citing this record (contract *unchanged*) · ADR-0091 registry: one form-rhythm mini-skill module recommended at build. Decomp: [`css-less-consumer-family.decomp.json`](../decompositions/css-less-consumer-family.decomp.json) |
> | **Supersedes / Superseded by** | Applies **ADR-0102** (lanes A and C — the chooser's two poles). Extends ADR-0095/0086 (orientation stayed on the group; this ADR finally gives it a visual referent) · relates ADR-0050 (form-provider = pure coordination, unchanged) · ADR-0091 (the teaching mechanism) · ADR-0096 (the severity vocabulary for accepting Lane C residual risk) |

## Context

The spacing pair is THE fork of the family: **who owns spacing when the consumer cannot author CSS —
the component (opinionated defaults), the catalog (new props), or the prompt (teach the wrap)?** The two
tickets sit at opposite poles of the answer, and the deciding facts are structural, not taste:

- **`ui-radio-group` cannot be fixed by composition.** Its child discovery is **direct children only**:
  `radio-group.ts:194` — `[...this.children].filter((el) => el instanceof UIRadioElement)`; roving focus,
  form value, and `#applySelection` all ride that set. A model that wraps the radios in a `Column gap`
  *inside* the group severs discovery — the taught-wrap lane is grammatically expressible but functionally
  destructive. Per ADR-0102's chooser (i), only Lane A/B remain.
- **The group already ships a layout semantic with no visual referent.** `orientation:
  'horizontal'|'vertical'` (`radio-group.ts:61`, catalog-reachable — the rental-filter seed sets
  `orientation:'horizontal'`, `catalog-coverage.ts:45`) moves ONLY the roving-focus axis; `radio-group.css`
  has zero `[orientation]` rule. Since `ui-radio` is `inline-flex`, radios flow inline with zero gap in
  BOTH orientations — the keyboard axis and the visual axis desync on every vertical group, and everything
  mashes (`ApartmentHouseStudio`, ticket #31's screenshot).
- **The site already hand-authors the missing layout, twice.** `component-preview.css:108-117` gives the
  specimen root exactly `display:flex; flex-direction:column; gap` + `[orientation='horizontal']` →
  wrapping row — its own comment says it exists "so the visual axis never desyncs from the roving-focus
  keyboard axis". `radio-group-demo.ts:29`/`radio-group-doc.ts:38` inline-style the same flex+gap. When
  every real consumer must re-author the same CSS, the component is withholding its own contract.
- **`ui-form-provider` is the opposite pole.** It is a pure coordination element (ADR-0050; "no visual
  voice", `form-provider.css` [1]/[2]) whose descendants are discovered by event bubbling — wrapping its
  children in a `Column gap` is fully compatible, already idiomatic
  (`pattern-settings-form`, `patterns.ts:36-37`), and is exactly how the fork repaired the gallery
  (`68d2a8d`: `FormProvider > Column gap='md' > fields`). The failure without the wrap is graceful —
  fields cramped but readable, nothing clipped or overlapping. Per the chooser (ii), Lane C is available.

## Decision

One rule, applied to both poles: **a value-owning group whose children must be its direct children owns
its interior layout (Lane A); a coordination wrapper whose interior the grammar can compose stays
layout-free and the composition is taught (Lane C).** Concretely:

1. **`ui-radio-group` gains component-owned layout.** In `radio-group.css`'s `@scope` block:
   `:scope { display: flex; flex-direction: column; gap: var(--ui-radio-group-gap); }` and
   `:scope[orientation='horizontal'] { flex-direction: row; flex-wrap: wrap; align-items: center; }` —
   the same flex STRUCTURE the site's specimen-root leg already authors (`component-preview.css:108-117`) —
   direction/wrap/align byte-identical; the GAP is re-based to the layout ladder's `--ui-space-sm` (0.5rem)
   where the specimen hard-coded `0.4rem` and the live pages used `--ui-space-md` (adopted-structure,
   ladder-normalized gap — review-corrected wording),
   moved to its rightful owner. The horizontal leg wraps (graceful degradation in cramped containers, the
   ADR-0016 row-side philosophy). The visual axis now *is* the roving axis — one source of truth
   (`[orientation]` reflected by `connected()`'s resolve, `radio-group.ts:87-96`).
2. **The gap is a registered token, defaulted to the layout ladder:** `--ui-radio-group-gap:
   var(--ui-space-sm)` lands in the token block whose comment reserved exactly this seat
   (`radio-group.css:21-25`: "Token registrations reserved here for future density/gap props without a
   cascade-order change"). Density-responsive for free; page authors retune per-instance with one custom
   property — the ADR-0102 override freedom.
3. **No new catalog prop.** `orientation` is already catalog-reachable and now carries the visual intent;
   the safe default (clause 1+2) makes rhythm correct with zero model uptake. A `gap` enum prop
   (`none|xs|…|2xl`, the Row/Column vocabulary) is a **foreseen Lane B extension** if live evidence shows
   models needing magnitude control — deliberately not minted on speculation.
4. **`ui-form-provider` is confirmed layout-free.** Its contract stands unchanged (Lane C): vertical rhythm
   is the **Column-gap wrap** — `FormProvider > Column gap > fields` — which the grammar expresses, every
   shipped seed/exemplar now models (generative-form `68d2a8d`, booking-reservation
   `catalog-coverage.ts:54`, pattern-settings-form), and one ADR-0091 mini-skill module ("a form's fields
   ride a Column with gap") reinforces at build time within the existing cap.
5. **Lane C residual risk, stated and accepted:** a model that never wraps renders cramped-but-readable
   fields — the graceful pole of ADR-0096's severity split (the destructive pole is what clause 1 refuses
   to leave to uptake). If gallery evidence later shows the unwrapped form to be a recurring live failure,
   the re-open is this record, escalating FormProvider to Lane A (a `display:flex; gap` default) — named
   here so the future fork is a lookup, not a debate.

## Acceptance

- Cross-engine browser legs: a bare `<ui-radio-group>` with three labeled radios renders stacked with
  computed `gap` = the `--ui-space-sm` resolution; `[orientation='horizontal']` renders one wrapping row;
  child-position assertions (the anti-vacuous rule), plus a negative control (removing the component rule
  fails the leg).
- The rental-filter-panel seed renders its horizontal type-picker with visible gaps on an unmodified A2UI
  mount — screenshot-verified.
- The two site pages (`radio-group-demo.ts:29`, `radio-group-doc.ts:38`) render **unchanged** (their inline
  styles override the new defaults — the measured blast-radius claim, asserted not assumed), after which
  their redundant inline flex declarations may be pruned to dogfood the default.
- `component-preview.css`'s specimen-root leg deleted; the preview's bare radio-group specimen still renders
  stacked-with-gap (now from the component).
- `npm run check && npm test` + `test:browser` green.

## Consequences

- **A shipped-default behavior change for page consumers of `ui-radio-group`:** block-flow inline mash →
  flex column with `--ui-space-sm` gaps. Measured reliance on the old default: **zero** — both site usages
  inline-override (`radio-group-demo.ts:29`, `radio-group-doc.ts:38`), the preview's page-level rule
  authored the very layout this ADR adopts, and no test asserts the zero-gap rendering (grep:
  `radio-group.test.ts` / `radio.browser.test.ts` assert roving/ARIA/geometry of `ui-radio`, not group
  flow). A downstream consumer relying on inline mash re-pins with one element-level rule — the override
  freedom is unchanged.
- **`radio-group.md` loses its "layout-neutral" identity paragraph** (`:94-95`, `:160-161`) — rewritten to
  the owned-layout contract in the same change (it was already factually wrong about block-flow stacking).
- **The fleet gains its second orientation-driven layout control** (after the app-shell family) and the
  group stops being the odd control whose keyboard axis and visual axis could disagree.
- **`ui-form-provider` keeps zero layout opinion** — its LLD-C8 "no visual voice" invariant and token-block
  absence stay grep-provable; the cost is the stated Lane C residual (clause 5).
- **Test/doc re-keys** (build wave): `radio-group.md` descriptor `layout:` row · new
  `radio-group.browser.test.ts` layout legs + negative control · `component-preview.css` deletion ·
  `a2ui-catalog.spec.md` §5.2 RadioGroup row (orientation's visual effect) · the ADR-0091 registry row if
  the mini-skill lands.
- **Out of scope, unchanged:** `ui-segmented-control` (owns its grid, ADR-0095), `ui-radio`'s own anatomy,
  the RadioGroup catalog row (no new prop), the renderer.

## Alternatives considered

- **Teach the wrap for radio-group too (Lane C symmetric).** Rejected: structurally impossible — direct-
  children discovery (`radio-group.ts:194`) breaks under an interposed Column; teaching a destructive idiom
  is worse than the defect (ADR-0102 chooser (i)).
- **A `gap` catalog prop on RadioGroup now (Lane B first).** Rejected as the *primary* fix: a prop with an
  unsafe default fixes nothing by default (ADR-0096 alternative 1 — uptake is probabilistic), and a prop
  with a safe default is clause 1+2 plus speculative surface. Foreseen extension, clause 3.
- **Opinionated defaults on `ui-form-provider` (Lane A symmetric — `display:flex; column; gap`).**
  Rejected: the provider's charter is coordination (ADR-0050); its descendants are arbitrary composition
  (grids, rows, cards) that a flex-column default would fight; the grammar already expresses form rhythm
  through the layout family whose *job* is rhythm; and the no-uptake failure is graceful, which Lane C's
  bar requires. Named re-open condition in clause 5.
- **A renderer-side auto-wrap (the factory injects a Column when FormProvider children lack one).**
  Rejected: invents structure the model never composed — breaks payload↔DOM faithfulness and the
  corpus/judge story (ADR-0102's rejected renderer-injection alternative).
- **Fix only the seeds (keep hand-wrapping every exemplar).** Rejected for radio-group (seeds cannot add
  gaps to a component that owns none reachable) and insufficient alone for form-provider (it IS the
  teaching lane's substrate, kept, but Lane C also wants the mini-skill + the stated residual).
