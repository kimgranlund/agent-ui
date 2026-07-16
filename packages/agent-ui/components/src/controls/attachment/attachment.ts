// attachment.ts — UIAttachmentElement, the Display-class FilePart-aligned compact file card (LLD-C5,
// feed-family.lld.md §4; SPEC-R8/R9/R10; ADR-0112 cl.4, fork F4). Non-interactive, non-form-associated
// leaf (extends UIElement): no events, no keyboard contract, no `[size]`/`[scale]` control geometry
// (Display class, SPEC-R20). Component-built light DOM only — `render()` stays the inherited no-op.
//
// Anatomy (SPEC-R9/R10): a decorative `<ui-icon data-part="glyph">` (aria-hidden by the icon's OWN
// default — no label is ever set on it, so no attachment-side ARIA work is needed) followed by a
// `<span data-part="body">` holding the `name` cell (falls back to the file category's label — never an
// empty title, SPEC-R8 AC2) and, when a finite non-negative `sizeBytes` is present, a `meta` cell with the
// formatted byte string (absent, not empty, when `sizeBytes` is null/non-finite/negative). One render effect,
// whole-swap per change (the stat.ts / bar-chart posture — no interior state worth preserving on a
// four-node card). The host mints NO internals ARIA (SPEC-R10): the name/meta are real DOM text, the
// accessible datum; the glyph repeats what the name/mime already carry.
//
// SCOPE FENCE (feed-family build sequence, LLD §11 Wave M1-a vs M1-c): this file ships the METADATA
// SURFACE ONLY (LLD-C4/C5). The `href` prop exists now because SPEC-R8 mints it as one of the four
// wire-mirroring props, but its RENDERING leg — the name cell becoming a native `<a>` under the shared
// ADR-0114 gate (`controls/text/href.ts`'s `safeHref`/`LINK_REL`/`LINK_TARGET`, LLD-C6) — is DEFERRED to
// the M1-c wave (with-or-after that shared gate module is confirmed integrated fleet-wide). Until then
// `href` is inert: read into no effect, rendered nowhere. Do not wire `safeHref` here — that is LLD-C6's
// own slice, coordinated with the catalog wave (SPEC-R11 AC3's single-gate-module grep).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import '../icon/icon.ts' // side-effect: defines <ui-icon>, the glyph's declarative surface (the avatar/LLD-C5 sibling-control-import idiom)
import { categoryGlyph, categoryLabel, fileCategory, formatBytes } from './attachment-meta.ts'

const props = {
  filename: prop.string(''), // optional on the A2aFilePart wire — empty falls back to the category label. Renamed from `name` (TKT-0069 item 1 ruling: `name` = the FORM name, reserved; the A2UI catalog keeps wire `name`, mapped in its bespoke factory)
  // `attribute: 'mime-type'` is load-bearing, not stylistic: Element.setAttribute lowercases the name in
  // an HTML document, so a camelCase observed-attribute name ('mimeType') would never match the always-
  // lowercase real attribute and attributeChangedCallback would silently never fire (the fleet's existing
  // multi-word props are either single-word or already reflect+kebab, e.g. slider-multi's valueLo/valueHi
  // — this is the first non-reflected multi-word prop, so the same kebab discipline applies here too).
  mimeType: { ...prop.string(''), attribute: 'mime-type' }, // drives the glyph + name fallback via fileCategory
  // Named `sizeBytes`/`size-bytes`, NOT `size` (ADR-0112 Amendment 1): the fleet-wide law
  // (family-coherence.test.ts's "a `size` attribute is always exactly [sm, md, lg]") reserves the literal
  // name `size` for the widget-tier geometry enum every sized control shares — this is unrelated byte-count
  // domain data (SPEC-R8), and reusing `size` would silently collide with that convention for any future
  // reader/consumer. Same kebab-attribute discipline as `mimeType` above (multi-word, non-reflected).
  sizeBytes: { ...prop.number(null), attribute: 'size-bytes' }, // bytes; NOT a wire field — embedder-supplied (SPEC-R8); null/non-finite/negative ⇒ no meta cell
  // SPEC-R8's fourth wire-mirroring prop. Rendering leg DEFERRED — see the file header note (LLD-C6).
  href: prop.string(''),
} satisfies PropsSchema

export interface UIAttachmentElement extends ReactiveProps<typeof props> {}
export class UIAttachmentElement extends UIElement {
  static props = props

  protected override connected(): void {
    this.effect(() => {
      const category = fileCategory(this.mimeType)
      const title = this.filename || categoryLabel(category)
      const size = formatBytes(this.sizeBytes)

      const glyph = document.createElement('ui-icon')
      glyph.setAttribute('data-part', 'glyph')
      glyph.setAttribute('glyph', categoryGlyph(category))

      // The name cell is a plain <span> in this pass — the LLD-C6 <a> leg is deferred (file header note).
      const name = document.createElement('span')
      name.setAttribute('data-part', 'name')
      name.textContent = title

      const body = document.createElement('span')
      body.setAttribute('data-part', 'body')
      body.append(name)

      if (size !== null) {
        const meta = document.createElement('span')
        meta.setAttribute('data-part', 'meta')
        meta.textContent = size
        body.append(meta)
      }

      this.replaceChildren(glyph, body)
    })
  }
}

if (!customElements.get('ui-attachment')) customElements.define('ui-attachment', UIAttachmentElement) // idempotent self-define
