// media-src.ts: the fleet's media SOURCE gate (T-0553), the sibling of href.ts's hyperlink gate. DOM-free
// (`base` is a parameter). Every control that fetches a URL it is handed as content (ui-image, ui-avatar,
// ui-video src and poster, ui-audio, ui-product-card image) routes it through `safeMediaSrc` before an
// interior media element sees it.
//
// Two layers:
//  - a scheme allowlist: http and https (relative sources resolve to the page's own scheme), plus data:
//    and blob:, which carry their bytes inline or name a page-local object and so fetch nothing remote;
//  - an optional host origin allowlist (`setMediaOrigins`): when set, an http(s) source must be the page's
//    own origin or a listed one. Unset (the default) leaves any http(s) origin allowed, so a host that
//    renders untrusted content (an A2UI stream) narrows it to the origins it serves media from.

/** The media scheme allowlist. Widening it is a one-line, gate-visible edit. */
export const MEDIA_SRC_SCHEMES = ['https:', 'http:', 'data:', 'blob:'] as const

const FETCHED_SCHEMES: readonly string[] = ['https:', 'http:']

let allowedOrigins: ReadonlySet<string> | null = null

/** Set the host's media origin allowlist (`['https://cdn.example']`), or `null` to allow any http(s)
 *  origin (the default). The page's own origin is always allowed. Applies to sources resolved after the
 *  call; a control re-gates when its source prop next changes. */
export function setMediaOrigins(origins: readonly string[] | null): void {
  allowedOrigins = origins === null ? null : new Set(origins.map((o) => new URL(o).origin))
}

/**
 * The gate. Validates, never rewrites: returns `raw` byte-identical on allow, `null` on deny or empty.
 * Parses with `new URL(raw, base)` so the same control-character and case normalizations a fetch applies
 * are applied here (the href.ts rationale); an unparseable source is denied, fail-closed.
 */
export function safeMediaSrc(raw: string, base: string): string | null {
  if (raw.trim() === '') return null
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return null
  }
  if (!(MEDIA_SRC_SCHEMES as readonly string[]).includes(url.protocol)) return null
  if (allowedOrigins !== null && FETCHED_SCHEMES.includes(url.protocol)) {
    let page: string | null = null
    try {
      page = new URL(base).origin
    } catch {
      page = null
    }
    if (url.origin !== page && !allowedOrigins.has(url.origin)) return null
  }
  return raw
}
