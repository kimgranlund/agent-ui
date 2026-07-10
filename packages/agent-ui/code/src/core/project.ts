// project.ts — the projection seam (LLD-C5, SPEC-C3). The ONLY core module that touches the DOM
// (document.createElement/createTextNode) — the `tokenize` half of the registry stays DOM-free
// (headless-usable); this file is what turns a token stream into light-DOM children.
//
// This is ADR-0113 escape hatch (a) made systematic: the seam builds the pre-highlighted-children shape
// that hatch always permitted, so `ui-code` needs ZERO change (unchanged by this wave, the identity root).
// With nothing registered the seam writes a single text node — byte-identical to a plain host-as-content
// `ui-code` (SPEC-C3 AC2, the identity path). A later bound `Code.code` write (plain textContent) clobbers
// the spans — plain always wins, by design (SPEC-C3 AC3, unchanged from ADR-0113).

import { tokenize } from './registry.ts'

/**
 * Replace `host`'s children with a light-DOM rendering of `tokenize(code, language)`: each classed token
 * becomes a `<span data-token="{kind}">` carrying that token's text; a `plain` token becomes a bare text
 * node — in order, so the concatenated rendered text equals `code` exactly (the SPEC-C2 invariant,
 * projected). `host` is content-agnostic (any `Element`); the LLD-C9 renderer only ever passes a fresh
 * `ui-code`, but this seam does not assert the tag (kept reusable, e.g. for a future M2 diff row).
 */
export function projectHighlight(host: Element, code: string, language: string): void {
  const tokens = tokenize(code, language)
  if (tokens.length === 1 && tokens[0].kind === 'plain') {
    // The empty-registry / verbatim path — SINGLE text node, byte-identical to a plain ui-code (SPEC-C3 AC2).
    host.replaceChildren(document.createTextNode(tokens[0].text))
    return
  }
  const frag = document.createDocumentFragment()
  for (const t of tokens) {
    if (t.kind === 'plain') {
      frag.appendChild(document.createTextNode(t.text))
    } else {
      const span = document.createElement('span')
      span.setAttribute('data-token', t.kind) // highlight.css targets this
      span.textContent = t.text // textContent — never innerHTML
      frag.appendChild(span)
    }
  }
  host.replaceChildren(frag)
}
