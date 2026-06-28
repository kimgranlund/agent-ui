// container.ts — `UIContainerElement`, the FACE container surface base (ADR-0015 / ADR-0016; decomp
// g9-containers slice s2).
//
// The base every container/layout `ui-*` element extends — the FIRST non-form family. It is a plain
// `UIElement` (NOT form-associated: no `static formAssociated`, no `setFormValue`/validity — a container
// contributes nothing to a form), and it reuses the inherited single `ElementInternals` handle (acquired
// ONCE in the `UIElement` constructor) so the stateful subclasses (`ui-tabs`, `ui-modal`) set ARIA roles +
// custom states THROUGH `this.internals`, never host attributes.
//
// The base owns NO layout/surface CSS opinion in TypeScript — every visual decision lives in the CSS layer.
// What it owns is the two SPREADABLE prop sets the container family shares (the ADR-0013 `formProps`
// precedent — props.ts has no static-props prototype merge, so a base cannot hand props down by inheritance;
// instead it exposes a schema each subclass folds into its OWN `static props`):
//   • `surfaceProps` — the two signed surface axes `elevation`/`brightness` (ADR-0015): each a reflected
//     literal-union `'-3'…'3'`, default `'0'` (the neutral base). The CSS `[elevation=n]`/`[brightness=m]`
//     selectors (controls/_surface/container.css) repoint the one role-pure `--ui-container-bg`/`-tint`
//     consumption seam; the component holds zero colour opinion.
//   • `flexProps` — the shared A2UI-faithful layout grammar `align`/`justify`/`gap`/`wrap` (ADR-0016), each a
//     reflected literal-union (or boolean) the layout primitives (`ui-row`/`ui-column`/`ui-list`/`ui-grid`)
//     map 1:1 onto a CSS flex property in their OWN `@scope` block. One grammar, four consumers — no drift.
// A subclass spreads them: `static props = { ...UIContainerElement.surfaceProps, ...flexProps, … }`.
//
// Imports only same-layer `./element.ts` / `./props.ts` (the dom layer; the layering law holds —
// `reactive ← dom`). The kernel is reached transitively through `UIElement` / `prop`; nothing here touches
// `../reactive` directly. `ElementInternals` is an ambient DOM global, inherited via `UIElement`.

import { UIElement } from './element.ts'
import { prop, type PropsSchema } from './props.ts'

// The two surface axes (ADR-0015 clause 1). Both are SIGNED literal unions `'-3'…'3'` (typed strings, not
// `number` — matching `size: 'sm'|'md'|'lg'`, so a `@ts-expect-error` proves a bare number is rejected) and
// both REFLECT, so the `[elevation=n]`/`[brightness=m]` attribute selectors in container.css apply to
// JS-set values too. `'0'` LEADS the value array so an out-of-range attribute snaps back to the neutral base
// (`enumType.from` falls to `values[0]`), not a surprise elevation — the literal-union TYPE is order-independent.
const SURFACE_STEPS = ['0', '1', '2', '3', '-1', '-2', '-3'] as const

const surfaceProps = {
  // elevation → the scheme-INVERTING plane (`--c-neutral-surface-{lowest…highest}`); 0 = the neutral surface.
  elevation: { ...prop.enum(SURFACE_STEPS, '0'), reflect: true },
  // brightness → the scheme-CONSISTENT tonal wash; 0 = no wash (the neutral surface).
  brightness: { ...prop.enum(SURFACE_STEPS, '0'), reflect: true },
} satisfies PropsSchema

// The shared layout grammar (ADR-0016 clause 1). Each maps 1:1 onto a CSS flex property; the literal-union →
// CSS-keyword mapping lives in each primitive's `@scope` block (a role-pure repoint, never an inline style),
// so this set is the TYPED vocabulary only — the base owns no flex CSS. All REFLECT so the `[align]`/etc.
// selectors apply to JS-set values. `values[0]` is each prop's default (consistent snap + default).
const flexProps = {
  // align (cross-axis) → `align-items`
  align: { ...prop.enum(['start', 'center', 'end', 'stretch', 'baseline'] as const, 'start'), reflect: true },
  // justify (main-axis distribution) → `justify-content` (`between`/`around`/`evenly` → `space-*` in the CSS)
  justify: { ...prop.enum(['start', 'center', 'end', 'between', 'around', 'evenly'] as const, 'start'), reflect: true },
  // gap → `gap: var(--ui-space-{step})` — the density-responsive layout-spacing ladder (ADR-0015 cl.4), NEVER a
  // control dimension. The step vocabulary mirrors s1's `--ui-space-{none,xs,sm,md,lg,xl,2xl}` ramp 1:1.
  gap: { ...prop.enum(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const, 'none'), reflect: true },
  // wrap → `flex-wrap` (boolean presence: present ⇒ wrap)
  wrap: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

export class UIContainerElement extends UIElement {
  /** The spreadable surface axes — `elevation`/`brightness` (ADR-0015). Subclasses fold into `static props`. */
  static surfaceProps = surfaceProps

  /** The spreadable layout grammar — `align`/`justify`/`gap`/`wrap` (ADR-0016). Subclasses fold into `static props`. */
  static flexProps = flexProps
}
