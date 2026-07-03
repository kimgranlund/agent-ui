// resolve.ts — resolve an IconName to a fresh <svg> + the imperative inject helper (LLD-C3,
// ADR-0065 clauses 2-3). Zero-dep, jsdom + browser safe: `createElementNS` + `innerHTML = body`
// parses the body in the SVG namespace (the svg element itself carries the namespace).

import { iconRegistry, type IconRegistry } from './registry.ts'
import type { IconName } from './types.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

function missingIcon(name: IconName): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('data-icon-missing', name)
  return svg
}

/** Build a fresh `<svg>` (SVG namespace) for `name` from the active pack. Unknown name / no active
 *  pack -> a non-throwing empty `<svg data-icon-missing="name">`. Each call returns a NEW element. */
export function resolveIcon(name: IconName, registry: IconRegistry = iconRegistry): SVGElement {
  const pack = registry.activePack()
  const body = registry.body(name)
  if (pack == null || body == null) return missingIcon(name)

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', pack.viewBox)
  svg.setAttribute('fill', 'currentColor') // inherits control ink
  svg.setAttribute('width', '100%') // fills its containing cell's content box
  svg.setAttribute('height', '100%')
  svg.setAttribute('aria-hidden', 'true') // decorative by default
  svg.setAttribute('focusable', 'false') // legacy-IE/Edge tab-stop guard
  svg.innerHTML = body
  return svg
}

/** Imperative sugar: replace `el`'s children with `resolveIcon(name)`. The one-liner the migration
 *  wave drops in at each audit site. */
export function setIcon(el: Element, name: IconName, registry: IconRegistry = iconRegistry): void {
  el.replaceChildren(resolveIcon(name, registry))
}
