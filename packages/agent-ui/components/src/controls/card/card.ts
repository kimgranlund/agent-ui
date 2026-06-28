// card.ts — UICardElement, the surface container of the G9 card family (goals.md §G9 / decomp
// g9-containers slice s7). BEHAVIOUR + props + the opt-in ARIA role + self-define ONLY; the surface, the
// presence-driven region grid, the padding, the border and the one-level nested radius all live in card.css.
//
// `ui-card` is the FIRST non-form container with a default plane: it extends `UIContainerElement` (NOT
// form-associated — a container contributes nothing to a form) and folds the spreadable `surfaceProps`
// (elevation/brightness, ADR-0015) into its OWN `static props` — NOT `flexProps` (a card lays its regions out
// as a presence-driven grid, not a flex line; ADR-0016 governs row/column, not card). The two surface axes
// repoint the role-pure `--ui-container-bg`/`-tint` seam in controls/_surface/container.css; card.css adds the
// one card-specific surface decision the base does NOT make — an un-elevated card still reads as a SURFACE
// (the base default is `transparent`), so card.css seeds its own `--ui-container-bg: var(--c-neutral-surface)`.
//
// Content model — host-as-grid over the region SUB-ELEMENTS (`ui-card-header`/`-content`/`-footer`, the
// ratified "regions = sub-elements"): the card does NOT `render()` a wrapper, so `render()` stays the
// inherited void and the agent's light-DOM regions are never clobbered. The presence-driven grid (card.css
// `:has()`) collapses the row of an absent region — no phantom gap.
//
// ARIA is minimal + opt-in (ADR-0014 widgets-not-elements posture): a card with an author-supplied accessible
// name (`aria-label`/`aria-labelledby`) reads as a `group` THROUGH `internals` (never a host `role` attribute);
// an unnamed card stays a generic container with no role. `controls → dom` is the allowed import direction.

import type { PropsSchema, ReactiveProps } from '../../dom/index.ts'
import { UIContainerElement } from '../../dom/container.ts'
// Self-define the region sub-elements as a side effect of importing the family entry, so `ui-card` is a
// self-contained compound (the `ui-tabs` → `ui-tab`/`ui-tab-panel` precedent): importing `card.ts` — directly
// or via the controls barrel (decomp s12) — registers all four card tags, and a consumer who imports only
// `ui-card` still gets its regions. Side-effect imports (no binding needed): each module self-defines its tag.
import './card-header.ts'
import './card-content.ts'
import './card-footer.ts'

// `static props = { ...surfaceProps }` — the elevation/brightness axes only (no flexProps; a card is a grid
// surface, not a flex line). Spread, not inherited (props.ts has no static-props prototype merge — the
// ADR-0013 pattern the container base exposes `surfaceProps`/`flexProps` for).
const props = { ...UIContainerElement.surfaceProps } satisfies PropsSchema

export interface UICardElement extends ReactiveProps<typeof props> {}
export class UICardElement extends UIContainerElement {
  static props = props

  protected connected(): void {
    // Opt-in landmark: a NAMED card reads as an ARIA `group` (set THROUGH internals — never a host attribute,
    // the family discipline). An unnamed card stays a generic container (no role). The accessible name is
    // author-supplied (`aria-label` / `aria-labelledby`); read once at connect — dynamic re-naming is out of
    // this slice's scope (documented in card.md). `role` is the only ARIA a card opts into.
    if (this.hasAttribute('aria-label') || this.hasAttribute('aria-labelledby')) {
      this.internals.role = 'group'
    }
  }
}

if (!customElements.get('ui-card')) customElements.define('ui-card', UICardElement)
