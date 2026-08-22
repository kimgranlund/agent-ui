// lint.ts — LLD-C1 §3.3 (GH #1584, genui-b3-judged-eval.lld.md): the deterministic evidence floor for
// rubric D4 (sandbox-reality conformance). A COUNT, never a verdict (`process.md` rule 1 — true/false
// facts are code; judgment sits above them) — the rubric's D4 anchors CITE these numbers, they never
// recompute them. Pure string scanning, no DOM, no parser dependency (a `ui-sandbox-frame` document is
// opaque HTML the judge/page must be able to inspect statelessly, in Node OR jsdom OR the browser).
//
// Zero-dep, platform-neutral (ADR-0062's pure-core discipline, mirrored from `src/corpus/*`): no
// cross-module import at all. `byteLength` below is computed via the SAME one-line, semantically-empty
// primitive `genui-line.ts`'s own `utf8ByteLength` wraps (`new TextEncoder().encode(s).length` — the
// only way to measure UTF-8 byte length in JS; there is no validation LOGIC here to drift, unlike the
// wire's actual structural gate in `record.ts`) — inlined rather than imported so this module never
// reaches across the `src/agent/` boundary at all (ADR-0137 clause 8's COMPOSITION CONTAINMENT leg,
// `gates.test.ts`, forbids a relative reach; the layering trip-wire, `layering.test.ts`, forbids the
// package's own bare-specifier door too — see `record.ts`'s header for the fuller note on that conflict).

/** The deterministic counts a `judge`/`report`/docs-page reader cites — never re-derives (LLD §3.3). */
export interface GenuiHtmlLint {
  /** UTF-8 byte length of `html` (the SAME measure `GENUI_MAX_HTML_BYTES` gates). */
  byteLength: number
  /** `src=`/`href=` on `script`/`link`/`img`/`iframe`/`video`/`audio`/`source` resolving to an
   *  `http(s)://` origin — the sandbox-reality floor: 0 is the D4 3-anchor, >0 caps the score at 2. */
  externalRefs: number
  /** Occurrences of the literal `var(--md-sys-` — the PRD-G5 token-bridge idiom in use; ≥1 is the D4
   *  3-anchor. */
  tokenRefs: number
  /** Inline `<script>` tag count (opening tags only — a well-formed document closes each it opens). */
  scriptBlocks: number
  /** Whether the document declares `<!doctype html>` (case/whitespace-insensitive, leading position). */
  hasDoctype: boolean
}

// Six external-reference-bearing tag names (LLD §3.3's own list). One shared attribute pattern: a
// `src=`/`href=` value beginning `http://` or `https://` — a relative/data:/blob: URL is NOT an external
// ref (it can never escape the sandbox's own allow-listed origin the same way, ADR-0073's containment
// posture); only an absolute http(s) origin counts.
const EXTERNAL_TAG_RE = /<(script|link|img|iframe|video|audio|source)\b([^>]*)>/gi
const HTTP_ATTR_RE = /\b(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/i

function countExternalRefs(html: string): number {
  let count = 0
  for (const match of html.matchAll(EXTERNAL_TAG_RE)) {
    const attrs = match[2] ?? ''
    if (HTTP_ATTR_RE.test(attrs)) count += 1
  }
  return count
}

function countTokenRefs(html: string): number {
  return (html.match(/var\(--md-sys-/g) ?? []).length
}

function countScriptBlocks(html: string): number {
  return (html.match(/<script\b/gi) ?? []).length
}

function detectDoctype(html: string): boolean {
  return /^\s*<!doctype\s+html/i.test(html)
}

/** Pure string scanning over `html` — total, never throws, never touches the DOM (LLD §3.3). */
export function lintGenuiHtml(html: string): GenuiHtmlLint {
  return {
    byteLength: new TextEncoder().encode(html).length,
    externalRefs: countExternalRefs(html),
    tokenRefs: countTokenRefs(html),
    scriptBlocks: countScriptBlocks(html),
    hasDoctype: detectDoctype(html),
  }
}
