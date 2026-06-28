// site/lib/specimens.ts — shared LIVE-specimen builders for the G9 container pages (docs · the layout
// showcase · the card/tabs/modal demos). A container demo mounts the REAL ui-* container (the subject under
// test) and fills it with simple demo-content boxes — the page's OWN content, not ui-* controls being
// restyled. The `.demo-box` / `.demo-*` class hooks are styled once in pages/containers.css; the live
// containers keep all their own geometry/colour/surface from their {name}.css.
import { heading } from './doc-page.ts'

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
