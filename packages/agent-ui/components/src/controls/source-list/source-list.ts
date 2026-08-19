// source-list.ts — UISourceListElement, the source-attribution aggregate leaf (ADR-0214, GH #1394 —
// the mint half of ADR-0214's booked repairs; the catalog/corpus/spec half is a LATER lane, named
// handed-off). ONE bindable `sources` prop (the `DescriptionList.rows` shape, ADR-0201's aggregate-leaf
// idiom reused verbatim — Context fact 1) renders a numbered list: index marker (array POSITION, 1-based,
// never producer-authored — marker↔row drift unrepresentable by construction) + title-as-gated-link +
// optional muted snippet. BEHAVIOUR + props + self-define ONLY; the pure hardening lives in
// source-list-model.ts (DOM-free, unit-testable), the rhythm/ink in source-list.css.
//
// THE DROP-MALFORMED-ENTRIES LAW HOLDS BY CONSTRUCTION (ADR-0214 cl.2): `cleanSources` drops any entry
// without a real title — at the codec (attribute path) AND again in the render effect (the
// table.ts/description-list.ts case-3 property-write guard, same shared hardening function) — so a
// titleless entry is unrepresentable.
//
// THE PER-ENTRY safeHref GATE (ADR-0214 cl.2/cl.3; ADR-0114 verbatim) — `../text/href.ts`'s `safeHref`
// resolver is the SOLE writer of any stamped `<a>`'s `href`/`rel`/`target` here too (the fleet's ONE
// scheme-gate module, reused rather than re-declared, Context fact 2 — the static validator's `format:
// 'safe-href'` leg does NOT descend into array items, so this component-side gate is LOAD-BEARING, not
// a belt-and-braces extra). A denied or empty href renders the title as a plain `<span>` — attribution
// survives, the link does not; never an announced-broken anchor.
//
// ONE render effect (reads `sources`): a full `replaceChildren` rebuild per change — the
// ui-stat/ui-description-list whole-swap shape (no interior user state worth preserving on a static
// receipt — no scroll, no selection, no focus).
//
// `role=list` is free here (ADR-0214 Context fact 4 — unlike ui-description-list's rejected `role=list`
// for label/value PAIRS, a numbered source list genuinely IS a list of items): minted via
// `this.internals.role` on the host (the ui-timeline/ui-list precedent, never a host `role` attribute);
// each built row carries its own real `role="listitem"` attribute (a plain light-DOM child, not a second
// host — ElementInternals applies to ONE element only).

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import { cleanSources, type SourceEntry } from './source-list-model.ts'
// GENERATED props (ADR-0173) — `static props` is generated from source-list.md's `attributes[]`; regenerate
// with `node scripts/generate-props.mjs source-list`, never hand-edit source-list.props.gen.ts.
import { props } from './source-list.props.gen.ts'
import { safeHref, LINK_REL, LINK_TARGET } from '../text/href.ts'

export interface UISourceListElement extends ReactiveProps<typeof props> {}
export class UISourceListElement extends UIElement {
  static props = props

  constructor() {
    super()
    this.internals.role = 'list' // Context fact 4 — role=list is free; a dedicated source leaf hosts its own list semantics (the ui-timeline precedent, constructor placement = semantics before insertion)
  }

  protected override connected(): void {
    this.effect(() => {
      // Re-harden on the way in (the table.ts/description-list.ts case-3 property-write guard — a direct
      // `el.sources = [...]` property write bypasses the codec; sharing ONE hardening function keeps the
      // two paths identical).
      const sources = cleanSources(this.sources)

      // Reading order index → title → snippet, row by row, IS DOM order — one replaceChildren commits the
      // whole list (whole-swap semantics, no incremental patching; the ui-stat/ui-description-list shape).
      // Index markers are the array POSITION (1-based) — never a producer-authored field (ADR-0214 cl.2).
      this.replaceChildren(...sources.map((source, i) => this.#row(i + 1, source)))
    })
  }

  /** One `<div data-part="row" role="listitem">` holding the positional index marker, the gated title,
   *  and an optional snippet — the anatomy floor (ADR-0214 cl.3). */
  #row(index: number, source: SourceEntry): HTMLElement {
    const row = document.createElement('div')
    row.setAttribute('data-part', 'row')
    row.setAttribute('role', 'listitem') // a real attribute on this plain child — internals is host-only

    const indexEl = document.createElement('span')
    indexEl.setAttribute('data-part', 'index')
    indexEl.textContent = String(index)
    row.append(indexEl)

    row.append(this.#title(source.href, source.title))

    if (source.snippet !== undefined) {
      const snippetEl = document.createElement('span')
      snippetEl.setAttribute('data-part', 'snippet')
      snippetEl.textContent = source.snippet
      row.append(snippetEl)
    }

    return row
  }

  /**
   * The title — a real gated `<a>` for an allowed href (ADR-0114's `safeHref` verbatim: byte-identical
   * value, plus the fixed `rel`/`target` policy constants), a plain `<span>` for a denied or empty href
   * (ADR-0214 cl.2's degrade — attribution survives, the link does not, never an announced-broken
   * anchor). `safeHref` is the SOLE writer of `href`/`rel`/`target` — the one call site in this file.
   */
  #title(href: string, title: string): HTMLElement {
    const gated = safeHref(href, document.baseURI)
    const el = document.createElement(gated === null ? 'span' : 'a')
    el.setAttribute('data-part', 'title')
    el.textContent = title
    if (gated !== null) {
      el.setAttribute('href', gated) // byte-identical — the gate never rewrites
      el.setAttribute('rel', LINK_REL)
      el.setAttribute('target', LINK_TARGET)
    }
    return el
  }
}

if (!customElements.get('ui-source-list')) customElements.define('ui-source-list', UISourceListElement) // idempotent self-define
