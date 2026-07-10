// split-pane.ts — UISplitPaneElement, the generic pane child of `ui-split` (app-surfaces-m4.lld.md LLD-C1,
// SPEC-R1/R2). A structural, non-form, non-interactive content region — the `ui-card-header`/`-content`
// regions precedent (extends `UIContainerElement` for the family base; carries no ARIA of its own; the
// AUTHOR's light-DOM children are the content, `render()` stays the inherited void). One folder, TWO real
// components (the `radio`/`radio-group` precedent, ADR-0080's radio-group special case): `ui-split-pane`
// gets its OWN `.ts`/`.css`/`.md` triple rather than being a side-effect-imported sub-element of split.ts —
// each is independently fleet-discoverable (family-coherence.test.ts keys discovery off `{name}.md`), and
// `ui-split-pane`'s per-pane props (`initial`/`min`/`max`/`collapsible`) earn their own descriptor + contract
// trip-wire (LLD-C6) exactly as `radio-group.md` does inside `radio/`.
//
// Props (LLD §2.1's code sample names this `size`; RENAMED here to `initial` — `family-coherence.test.ts`'s
// A2 invariant treats ANY attribute literally named `size` fleet-wide as the `[sm,md,lg]` sizing enum
// (ADR-0081), and this prop is a semantically UNRELATED ratio seed, not a widget-box size step. Same value,
// same behavior, a build-mechanics naming fix — not a design deviation):
//   • `initial` — an UNREFLECTED optional ratio seed (`prop.number()`, default null) — read ONCE by the
//     parent `ui-split` at connect / pane-count growth (`constrain.ts`'s `seedRatios`/`rederiveRatios`),
//     never reflected (an internal seed, not a live authored dimension — the progress.md/stat.md optional-
//     number precedent).
//   • `min`/`max` — REFLECTED CSS-length strings (default `''` ⇒ the parent applies the
//     `--ui-split-pane-min` floor / `none`). The PARENT (ui-split) resolves these into physical
//     `min-width`/`max-width` (horizontal axis) or `min-height`/`max-height` (vertical axis) via the
//     `--_pane-min`/`--_pane-max` JS geometry seam it writes onto each pane (the slider-multi
//     `--value-pct-lo/hi` precedent) — split-pane.css is axis-oblique by construction; the parent decides
//     which physical dimension the pane's floor/ceiling binds to.
//   • `collapsible` — a REFLECTED boolean gating the parent's Enter-key collapse-to-last affordance
//     (SPEC-R4) when this pane is a separator's LEADING pane. `ui-split-pane` itself does nothing with it —
//     read only by the parent.
//
// `controls → dom` is the allowed import direction (no traits needed — this leaf has no behaviour).

import { UIContainerElement } from '../../dom/container.ts'
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const splitPaneProps = {
  initial: prop.number(), // undefined ratio seed (uncontrolled) — a positive finite value; unset/invalid ⇒ equal-fill (constrain.ts)
  min: { ...prop.string(''), reflect: true }, // CSS length; '' ⇒ the --ui-split-pane-min floor (parent-applied)
  max: { ...prop.string(''), reflect: true }, // CSS length; '' ⇒ unbounded (parent-applied)
  collapsible: { ...prop.boolean(false), reflect: true }, // gates the parent's Enter-key collapse-to-last (SPEC-R4)
} satisfies PropsSchema

export interface UISplitPaneElement extends ReactiveProps<typeof splitPaneProps> {}
export class UISplitPaneElement extends UIContainerElement {
  static props = splitPaneProps
}

if (!customElements.get('ui-split-pane')) customElements.define('ui-split-pane', UISplitPaneElement)
