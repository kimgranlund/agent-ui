// csp.ts — the SandboxFrameCspConfig type + the pure, fail-closed meta-CSP string builder
// (genui-surface.spec.md SPEC-R4). Zero DOM, unit-testable in plain Node/Vitest — the bar-chart /
// bar-math.ts "pure math lives beside the control" precedent (chart-family.lld.md §3), applied to a
// security-string builder instead of layout math.
//
// The four MCP-Apps-shaped categories (SPEC §5 / PRD §4 D6 survey): connectDomains → connect-src ·
// resourceDomains → img-src/font-src · frameDomains → frame-src (+ child-src) · baseUriDomains →
// base-uri. An ABSENT category is DEFAULT-DENY (SPEC-R4's v1 default floor table). `buildCsp` returns
// `undefined` — never a partial/best-effort policy — the moment ANY allow-listed entry fails the
// scheme-pinned https / no-wildcard-broader-than-one-label check: the caller (sandbox-frame.ts) treats
// `undefined` as a CSP-build failure, one of SPEC-R5's named never-paint triggers.
//
// `frame-ancestors` and the CSP `sandbox` directive are DELIBERATELY never emitted (SPEC-R4 — both are
// ignored in meta CSP; the iframe `sandbox` ATTRIBUTE, built in sandbox-frame.ts, owns sandboxing).

export interface SandboxFrameCspConfig {
  connectDomains?: readonly string[]
  resourceDomains?: readonly string[]
  frameDomains?: readonly string[]
  baseUriDomains?: readonly string[]
}

// One https origin, scheme-pinned, no wildcard broader than a single leading `*.` label (SPEC-R4 AC1:
// "an http: or bare-host entry ... the builder rejects it").
const ORIGIN_RE = /^https:\/\/(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i

/** Validate one category's domain list; `undefined` (fail-closed) the moment any entry is not a
 *  scheme-pinned https origin — never a partial allow-list. An absent category is `[]` (default-deny). */
function validDomains(domains: readonly string[] | undefined): string[] | undefined {
  if (domains === undefined) return []
  const out: string[] = []
  for (const d of domains) {
    if (!ORIGIN_RE.test(d)) return undefined
    out.push(d)
  }
  return out
}

/**
 * Compose the meta-CSP policy string from a `SandboxFrameCspConfig` (SPEC-R4's v1 default-closed
 * floor). Returns `undefined` — fail-closed, never a partial policy — the moment any allow-listed
 * entry across the four categories is not a scheme-pinned https origin.
 */
export function buildCsp(config: SandboxFrameCspConfig): string | undefined {
  const connect = validDomains(config.connectDomains)
  const resource = validDomains(config.resourceDomains)
  const frame = validDomains(config.frameDomains)
  const base = validDomains(config.baseUriDomains)
  if (connect === undefined || resource === undefined || frame === undefined || base === undefined) return undefined

  const directives = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    `img-src ${['data:', 'blob:', ...resource].join(' ')}`,
    `font-src ${['data:', ...resource].join(' ')}`,
    `connect-src ${connect.length > 0 ? connect.join(' ') : "'none'"}`,
    `frame-src ${frame.length > 0 ? frame.join(' ') : "'none'"}`,
    `child-src ${frame.length > 0 ? frame.join(' ') : "'none'"}`,
    `base-uri ${base.length > 0 ? base.join(' ') : "'none'"}`,
    "form-action 'none'",
  ]
  return directives.join('; ')
}
