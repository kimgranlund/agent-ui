// site/lib/specimens.ts — shared LIVE-specimen builders for the docs site (the ui-text-field pages, the G9
// container docs, the layout showcase, the card/tabs/modal demos). A demo mounts the REAL ui-* control (the
// subject under test) and surrounds it with simple page content — demo boxes, a decorative glyph — that is the
// page's OWN content, not a ui-* control being restyled. The `.demo-box` / `.demo-*` class hooks are styled
// once in pages/containers.css; the live controls keep all their own geometry/colour/surface from their
// {name}.css. Every glyph + the demo-width rationale (#74) lives HERE once, so the pattern multiplies cleanly.
import { heading } from './doc-page.ts'
import { resolveIcon } from '@agent-ui/icons'
import '@agent-ui/icons/phosphor' // registers + activates the Phosphor default pack (ADR-0066)

/**
 * applyDemoWidth — give a specimen a page-supplied display width. This is layout context, NOT a restyle of the
 * control's appearance/state (those stay in the control's own CSS). A ui-text-field now carries a ~20ch
 * min-inline-size typing-width FLOOR (`--ui-text-field-min-inline-size`, native `<input size>` parity; #74 /
 * ADR-0021), so a bare field is hittable rather than collapsed — but the width ABOVE that floor is the layout's
 * job, so a specimen still gets an explicit width here for a consistent, tidy demo. Other containers fill their
 * parent and are sized here only for the same reason. The width rationale lives here, once — call sites just
 * pass a width.
 */
export function applyDemoWidth(element: HTMLElement, width: string): void {
  element.style.inlineSize = width
}

/**
 * searchIcon — the shared decorative search glyph for an adornment POSITION (slot=leading|trailing). Resolved
 * from the REAL Phosphor `magnifying-glass` through the @agent-ui/icons adapter (ADR-0065/0066) instead of a
 * hand-drawn circle+handle — authentic pack data, `fill="currentColor"` + `width/height=100%` so it fills the
 * control's icon cell exactly like the adapter's own injected glyphs. data-role="icon" is the canonical CONTENT
 * role each control's CSS sizes to the icon cell; resolveIcon already sets aria-hidden (a decorative glyph names
 * nothing). One definition for every page that shows a leading/trailing field adornment.
 */
export function searchIcon(slot: 'leading' | 'trailing'): SVGElement {
  const svg = resolveIcon('magnifying-glass') // authentic Phosphor from the active pack (registered on import)
  svg.setAttribute('slot', slot) // POSITION (start/end cell)
  svg.setAttribute('data-role', 'icon') // CONTENT role — sized to the icon cell by the control's CSS
  return svg
}

/** el — a small element factory: a tag, string attributes, and child nodes (the live container + its content). */
export function el(tag: string, attrs: Record<string, string> = {}, children: readonly Node[] = []): HTMLElement {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  if (children.length > 0) node.append(...children)
  return node
}

/** demoBox — one labelled layout item (page demo content, NOT a ui-* control), so a container's layout reads. */
export function demoBox(label: string): HTMLElement {
  const box = document.createElement('div')
  box.className = 'demo-box'
  box.textContent = label
  return box
}

/** uiButton — a real <ui-button> specimen (dogfooded as the interactive content a container lays out). */
export function uiButton(label: string, variant = 'soft'): HTMLElement {
  const b = document.createElement('ui-button')
  b.setAttribute('variant', variant)
  b.textContent = label
  return b
}

/** exampleSection — a titled <section> wrapping one or more live specimens (the standard doc/demo block). */
export function exampleSection(title: string, ...nodes: Node[]): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, title), ...nodes)
  return section
}

/** captioned — a live specimen above a small monospace caption (the [attr] it demonstrates), as a flex column figure. */
export function captioned(caption: string, node: Node): HTMLElement {
  const figure = document.createElement('figure')
  figure.className = 'demo-figure'
  const cap = document.createElement('figcaption')
  cap.className = 'demo-caption'
  cap.textContent = caption
  figure.append(node, cap)
  return figure
}
