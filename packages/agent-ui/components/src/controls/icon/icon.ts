// icon.ts — UIIconElement, the Display-class icon-adapter consumer (LLD-C5, ADR-0065/0066). The
// declarative surface over `@agent-ui/icons`: <ui-icon glyph="caret-down"> resolves the active pack's
// SVG body and injects it via `setIcon` (the cross-package edge the layering trip-wire admits — icons
// as a second lower-tier sibling, mirroring components → shared). Light-DOM, self-defining, no traits.
//
// Two props, two connected() effects — nothing else:
//   • `glyph` — reacts ONLY to glyph (and re-runs setIcon on every change); empty clears the host. Live
//     pack-swap reactivity is DEFERRED (ADR-0065 clause 4) — the registry exposes no subscribable
//     signal, so an already-rendered <ui-icon> does not auto-update when a pack is swapped AFTER first
//     render; re-setting `glyph` reflects a swap.
//   • `label` — decorative by default (aria-hidden, no role); non-empty makes the icon MEANINGFUL
//     (role=img + aria-label). ARIA via ElementInternals only — never a host attribute (the FACE rule),
//     so aria-hidden is toggled through `internals.ariaHidden`, not `setAttribute`, and is explicitly
//     CLEARED when a label is supplied (so a labelled icon is never simultaneously aria-hidden).
//
// `glyph` is typed `prop.string('')`, not `prop.enum(ICON_NAMES, ...)`, deliberately: the swappable-pack
// architecture means a consumer's own pack can register names beyond the shipped nine, so the prop stays
// an open string; the IconName cast happens only at the internal setIcon call (an unregistered name is a
// non-throwing `data-icon-missing` render, per resolve.ts).
//
// render() stays the inherited no-op — there is no template; `setIcon`/`replaceChildren` manage the host's
// only child imperatively (the fleet's existing imperative-injection idiom, ADR-0065 context).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { setIcon, type IconName } from '@agent-ui/icons'

const props = {
  glyph: prop.string(''), // an IconName; empty → renders nothing (clears the host). Renamed from `name` (TKT-0069 item 1 ruling: `name` is reserved fleet-wide for the FORM name; the A2UI catalog keeps the wire field `name`, mapped in its bespoke factory)
  label: { ...prop.string(''), reflect: true }, // non-empty → meaningful: role=img + aria-label; empty → decorative (aria-hidden)
} satisfies PropsSchema

export interface UIIconElement extends ReactiveProps<typeof props> {}
export class UIIconElement extends UIElement {
  static props = props

  protected override connected(): void {
    // glyph effect: (re)inject the active pack's svg on glyph change; an empty glyph clears the host.
    this.effect(() => {
      if (this.glyph) setIcon(this, this.glyph as IconName)
      else this.replaceChildren()
    })
    // label effect: decorative (aria-hidden) vs meaningful (role=img + aria-label). ElementInternals only.
    this.effect(() => {
      if (this.label) {
        this.internals.role = 'img'
        this.internals.ariaLabel = this.label
        this.internals.ariaHidden = null
      } else {
        this.internals.role = null
        this.internals.ariaLabel = null
        this.internals.ariaHidden = 'true'
      }
    })
  }
}

if (!customElements.get('ui-icon')) customElements.define('ui-icon', UIIconElement) // idempotent self-define
