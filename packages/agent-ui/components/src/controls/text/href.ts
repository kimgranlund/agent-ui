// href.ts — the fleet's hyperlink SCHEME GATE (ADR-0114, SPEC-R8/R12; LLD-C1). DOM-free (no `document`
// import — `base` is a parameter): the canonical home BOTH text.ts's component gate AND a2ui's static
// validator (`conformance.ts`) import from, and the shared module a future feed-family `ui-attachment`
// href leg reuses (ADR-0114's cross-family reconciliation) — one policy constant, every enforcement site
// imports it rather than re-declaring it.
//
// Widening the scheme set is a ONE-LINE, gate-visible edit (ADR-0114 fork F1) — never a per-call-site
// change. Do not rename any export: `SAFE_HREF_SCHEMES` / `safeHref` / `LINK_REL` / `LINK_TARGET` are the
// frozen shape a concurrent build imports verbatim.

/** The fleet scheme allowlist — ONE constant, imported by every enforcement site (the component gate +
 *  the a2ui validator's first line). Widening it is a one-line, gate-visible edit (ADR-0114 fork F1). */
export const SAFE_HREF_SCHEMES = ['https:', 'http:', 'mailto:'] as const

/**
 * The component gate (SPEC-R8, normative verdict procedure). Validates; NEVER rewrites — returns the
 * author's string byte-identical on allow, `null` on deny OR no-destination:
 *  - `raw.trim() === ''` → `null` (no destination — the default-`''`/whitespace self-link trap, SPEC-R8
 *    AC7: `new URL('', base)` would otherwise mint a self-link, so this check runs BEFORE parsing).
 *  - `new URL(raw, base)` throws → `null` (unparseable = denied, fail-closed).
 *  - the resolved `url.protocol` is not in `SAFE_HREF_SCHEMES` → `null` (denied).
 *  - else → `raw` (allowed — byte-identical, never rewritten; the anchor's own resolution equals this
 *    parse by construction, since both resolve against the same `base`).
 *
 * Parsing with `new URL` is load-bearing (SPEC-R8): it applies the SAME control-character/whitespace
 * normalizations navigation itself would, so `"java\nscript:…"` and `" JAVASCRIPT:…"` are denied as their
 * normalized selves — a string-prefix check is non-conformant and would miss exactly this smuggling class.
 *
 * `base` is a parameter (the component passes `document.baseURI`) so this module stays DOM-free — the
 * validator side reuses `SAFE_HREF_SCHEMES` without inheriting a `document` dependency.
 */
export function safeHref(raw: string, base: string): string | null {
  if (raw.trim() === '') return null // no destination — never parsed (the self-link trap)
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return null // unparseable — denied, fail-closed
  }
  if (!(SAFE_HREF_SCHEMES as readonly string[]).includes(url.protocol)) return null // denied scheme
  return raw // allowed — byte-identical, never rewritten
}

/** The fixed anchor policy (ADR-0114 fork F3 — no props at v1): component-set constants, applied ONLY
 *  alongside an allowed `href`, never author-supplied. Exported alongside the gate so a future
 *  `ui-attachment` href leg shares this one module instead of minting a second copy. */
export const LINK_REL = 'noopener noreferrer'
export const LINK_TARGET = '_blank'
