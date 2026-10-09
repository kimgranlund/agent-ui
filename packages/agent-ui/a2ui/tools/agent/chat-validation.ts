// chat-validation.ts — GH #108: the PAIR-allowlist trust-boundary validation shared by both HTTP
// transports (`dev-proxy-plugin.ts`'s Vite middleware and `worker/index.ts`'s Cloudflare Worker). Extracted
// here — rather than each transport re-declaring its own copy, or the Worker importing directly from
// `dev-proxy-plugin.ts` — because `dev-proxy-plugin.ts`'s module scope has a live `import { loadEnv } from
// 'vite'` and a side-effecting `process.cwd()` call, neither of which belongs in (or would even survive) a
// Workers bundle. This module has neither: zero vite/node imports, safe for both consumers.
//
// `dev-proxy-plugin.ts` re-exports everything below UNCHANGED, so its own existing tests
// (`validate-mode.test.ts`, `chat-route.test.ts`, both importing from `dev-proxy-plugin.ts`) needed no
// changes for this extraction.

import type { ProvidersConfig } from './providers-config.ts'
import { providerForModel, resolvePair } from './providers-config.ts'
import type { Turn, Effort } from '../../src/agent/agent-transport.ts'
import { GEN_UI_MODES } from '../../src/agent/gen-ui-mode.ts'
import type { GenUiMode } from '../../src/agent/gen-ui-mode.ts'
import type { GenuiSurfaceConfig } from '../../src/agent/genui-surface-config.ts'
import { RESPONSE_PREFERENCES } from '../../src/agent/response-type.ts'
import type { ResponsePreference } from '../../src/agent/response-type.ts'
import { selectCatalog as selectCatalogShared } from '../../src/renderer/wire-tolerances.ts'
// GH #516 (persona-catalog-composition SPEC-R3) — the pure, DOM-less compose step + the shipped
// persona manifests, imported by LEAF PATH (never `catalog/index.ts`/`catalog/personas/index.ts`,
// both of which pull in `@agent-ui/components`'s DOM self-define via `factories.ts` — a hard crash in
// this Node/Workers module). See `buildCatalogMap`'s own doc comment below.
import { composePersonaCatalogDocs, semanticChecksForCatalog } from '../../src/catalog/compose.ts'
import type { SemanticCheck } from '../../src/catalog/semantic-check.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../../src/catalog/personas/manifests.ts'
import { ProduceHalt } from '../../src/agent/produce.ts'
import { AgentTimeoutError } from '../../src/agent/deadlines.ts'

// GH #144: the generic fallback shown for any produce()-loop or `/chat` failure that ISN'T one of the classes
// `failureMessageFor` passes through (an upstream fault, e.g. anthropicProvider's own error message, which
// embeds up to 500 raw chars of the provider's API response body, an internal detail that must never reach
// an end user's chat log). One copy for both hosts (the dev proxy and the Worker), the GH #108 anti-fork rule.
export const GENERIC_FAILURE_MESSAGE = "I couldn't put together a valid response for that — could you try rephrasing, or try again?"

/**
 * The text a host writes for a failed turn (GH #144, T-0023, T-0024): the terminal `error` meta-line on the
 * produce route, and the `error` field of the 500 JSON body on the prose `/chat` route.
 *   · `ProduceHalt`: safe verbatim, its message names only closed failure CODES (SCHEMA/PARSE/FEED_SCOPE/...)
 *     plus model-authored A2UI id paths (GH #307), never raw upstream text.
 *   · `AgentTimeoutError` (a stalled stream, a first-byte timeout, the whole-turn deadline): its
 *     `userMessage` is plain words by construction and carries no upstream body, so it crosses verbatim and
 *     the user learns the model went quiet or the turn ran long, not that their wording was at fault.
 *   · anything else: the generic fallback above.
 */
export function failureMessageFor(err: unknown): string {
  if (err instanceof ProduceHalt) return err.message
  if (err instanceof AgentTimeoutError) return err.userMessage
  return GENERIC_FAILURE_MESSAGE
}

// ADR-0090 §4 — `mode` is trusted input at a security-adjacent boundary (Consequences): a crafted/stale
// `mode` string must NEVER reach `buildSystemPrompt` raw. Unlike `{provider,model}` (a registry lookup via
// `resolvePair`), `mode` is a closed 3-member enum, so validation is a plain membership check — an unknown
// value is defaulted silently (return `undefined`, which `produce()`/`buildSystemPrompt` already treat as
// the zero-regression default, ADR-0090 §1), never a 400. The request itself must never fail on a bad mode.
// The membership set is `GEN_UI_MODES` (`gen-ui-mode.ts`) — the single source of truth, not a local copy.
export function validateMode(mode: unknown): GenUiMode | undefined {
  return typeof mode === 'string' && (GEN_UI_MODES as readonly string[]).includes(mode) ? (mode as GenUiMode) : undefined
}

// genui-surface.spec.md SPEC-R10/R11 — `genui` is client-supplied, trusted-input-at-a-boundary shaped
// (the SAME `validateMode` posture): a crafted/malformed value must NEVER reach `buildSystemPrompt` raw,
// but must ALSO never fail the request — fail-closed to `undefined` (the modality-off degradation law),
// never a 400. `sourceBody` is length-capped at 16 KB (the SAME runaway-guard bound `personaSystem`
// already uses at both transports) — a picked pattern-source pack's body is exemplar-sized prose, never a
// multi-megabyte blob; an over-cap value degrades the FIELD to absent (never the whole `genui` object).
// `exclusive` (genui-surface-config.ts — the genui-only-consumer signal) is validated the SAME per-field
// degrade way: a non-boolean value drops just that field, never the whole `genui` object.
//
// genui-surface.spec.md v0.5 §11 (SPEC-R10 amended clause, GH #316/ADR-0162) — `dogfood` gets the
// IDENTICAL per-field degrade posture: a non-boolean value drops just that field, never the whole
// `genui` object (the `exclusive` clause above, copied).
const GENUI_SOURCE_BODY_CAP = 16_384

export function validateGenuiSurface(genui: unknown): GenuiSurfaceConfig | undefined {
  if (typeof genui !== 'object' || genui === null || Array.isArray(genui)) return undefined
  const g = genui as Record<string, unknown>
  if (typeof g.enabled !== 'boolean') return undefined
  const sourceBody = typeof g.sourceBody === 'string' && g.sourceBody.length <= GENUI_SOURCE_BODY_CAP ? g.sourceBody : undefined
  const exclusive = typeof g.exclusive === 'boolean' ? g.exclusive : undefined
  const dogfood = typeof g.dogfood === 'boolean' ? g.dogfood : undefined
  return {
    enabled: g.enabled,
    ...(sourceBody !== undefined ? { sourceBody } : {}),
    ...(exclusive !== undefined ? { exclusive } : {}),
    ...(dogfood !== undefined ? { dogfood } : {}),
  }
}

// GH #418 — `a2ui` is client-supplied, the SAME trust-boundary posture as `mode`/`genui` above: a
// crafted/malformed value must never reach `buildSystemPrompt` raw, and must never fail the request —
// fail-closed to `undefined` (⇒ `buildSystemPrompt`'s own `a2uiEnabled !== false` default, i.e. A2UI ON,
// the byte-identical-to-before-this-field-existed degradation law every sibling field here already uses).
export function validateA2uiEnabled(a2ui: unknown): boolean | undefined {
  return typeof a2ui === 'boolean' ? a2ui : undefined
}

// ADR-0178 cl.3 / SPEC-R30 — the persona-authoring gate, client-supplied, the SAME trust-boundary posture
// as `a2ui` just above: fail-closed to `undefined` on anything non-boolean, never a 400. The degradation
// is genuinely closed here rather than merely default-preserving — `buildSystemPrompt`'s `authoringBlock`
// requires a LITERAL `true`, so `undefined` composes ZERO teaching bytes. A crafted value therefore cannot
// talk the producer into teaching the personaPatch arm; it can only fail to enable it.
export function validateAuthoringSurface(authoring: unknown): boolean | undefined {
  return typeof authoring === 'boolean' ? authoring : undefined
}

// ADR-0182 cl.2 / SPEC-R31 — the builder-mission drive-to-completion gate, the SAME trust-boundary
// posture as `authoringSurface` just above: fail-closed to `undefined` on anything non-boolean,
// never a 400. Unlike `authoringSurface` (a persona-scoped store key), the TRUE source of this
// boolean is structural turn-origin (`session === 'authoring'`, derived host-side in
// `admin-live-runner.ts`) — by the time it reaches this validator it is an ordinary untrusted wire
// boolean like any other, so the same degrade law applies verbatim.
export function validateBuilderMission(builderMission: unknown): boolean | undefined {
  return typeof builderMission === 'boolean' ? builderMission : undefined
}

// produce()-route effort threading — the SAME fail-closed posture as `validateMode`/`validateGenuiSurface`
// (this file's shared trust-boundary spine), not the `/chat` route's `isChatBody` 400-on-malformed check
// below: `effort` is a closed 4-member enum (`EFFORT_VALUES`, defined below and reused here rather than
// redeclared), so an unrecognized/malformed value degrades to `undefined` — the provider's own default
// applies (the `validateMode` precedent) — never a 400. The request itself must never fail on a bad effort.
export function validateEffort(effort: unknown): Effort | undefined {
  return typeof effort === 'string' && (EFFORT_VALUES as readonly string[]).includes(effort) ? (effort as Effort) : undefined
}

// RTS-R6 AC3 / RTS-R7: the response preference (`responsePreference`, the gate) and the persona hint
// (`prefers`) share this validator, the `validateEffort` posture: only the three literals pass, anything
// else is dropped to `undefined`, never a 400.
export function validateResponsePreference(v: unknown): ResponsePreference | undefined {
  return typeof v === 'string' && (RESPONSE_PREFERENCES as readonly string[]).includes(v) ? (v as ResponsePreference) : undefined
}

/** S1 (ADR-0169 cl.3) — fail-closed catalog selection, moved to `src/renderer/wire-tolerances.ts`
 *  (GH #484 move phase — the wire-tolerance registry). Re-exported here UNCHANGED so `dev-proxy-
 *  plugin.ts`/`worker/index.ts`'s existing `import { selectCatalog } from './chat-validation.ts'`
 *  needed no call-site change. */
export const selectCatalog = selectCatalogShared

/**
 * GH #516 / persona-catalog-composition SPEC-R3 — the server-host twin of `renderer.ts`'s constructor
 * step (`composePersonaCatalogs(this.#registry, SHIPPED_PERSONA_CATALOGS)`): builds the FULL
 * `catalogId → Catalog` map both `selectCatalog` callers (`dev-proxy-plugin.ts`'s produce POST branch,
 * `worker/index.ts`'s `handleProduce`) pass to `selectCatalog` — the two base catalogs PLUS every
 * derived `<base>--<persona>` catalog `SHIPPED_PERSONA_CATALOG_MANIFESTS` composes (ADR-0169 cl.3's
 * "both hosts hold BOTH catalogs" law, widened to derived ids). Before this, a live turn's derived
 * catalogId (e.g. `agent-ui--croupier`) was NEVER a key either host's map held, so
 * `selectCatalog`'s own fail-closed fallback (ADR-0169 cl.3, SPEC-N4 — kept byte-identical, #487's
 * tests unchanged) silently degraded every derived-catalog turn to the default, masking the persona's
 * local pattern set from both the composed prompt's catalog teaching AND per-turn validation.
 *
 * ONE helper, not two host-side copies (the ADR-0168 both-arms precedent) — `dev-proxy-plugin.ts`/
 * `worker/index.ts` each already load `catalog`/`basicCatalog` their OWN way (`readFileSync` vs. a
 * static Vite/Wrangler JSON import), so this takes the two ALREADY-LOADED `Catalog` documents rather
 * than loading them itself, and does the ONE thing both hosts need identically after that: compose +
 * merge. Reject-loud on a malformed shipped persona (`CatalogComposeError`, SPEC-R2 AC3/AC6) — the
 * SAME fail-loud-at-boot posture `loadCatalog`'s own gates already have for a malformed base catalog,
 * never a half-composed production surface.
 */
/**
 * ADR-0238, GH #1795: the `ProduceDeps.semanticChecks` slice for a turn, shared by both hosts
 * (the `buildCatalogMap` precedent: one helper, never two host-side copies). `catalog` is the catalog
 * `selectCatalog` CHOSE, so an unknown or malformed client id that fell back to the default also falls back
 * to no checks. Returns `{}` when the catalog's persona declares none, so spreading it into the deps object
 * adds NOTHING and the turn is byte-identical to a host without this hook.
 */
export function semanticChecksDeps(catalog: Catalog): { semanticChecks?: readonly SemanticCheck[] } {
  const semanticChecks = semanticChecksForCatalog(catalog.catalogId, SHIPPED_PERSONA_CATALOG_MANIFESTS)
  return semanticChecks.length > 0 ? { semanticChecks } : {}
}

export function buildCatalogMap(catalog: Catalog, basicCatalog: Catalog): Map<string, Catalog> {
  const bases = new Map<string, Catalog>([
    [catalog.catalogId, catalog],
    [basicCatalog.catalogId, basicCatalog],
  ])
  const derived = composePersonaCatalogDocs(bases, SHIPPED_PERSONA_CATALOG_MANIFESTS)
  return new Map<string, Catalog>([...bases, ...derived])
}

/**
 * ALM-C6 (TKT-0052/ADR-0136) — the `/chat` route's pure validation spine, extracted so its 400/503 arms
 * are deterministically testable without a live key or a real fetch (the impure `provider.stream` path
 * stays manual live acceptance, the SPEC-R3 adapter precedent). Derives the `{provider}` server-side from
 * the bare model id (`providerForModel` — `providers.json` is the single source, the browser never names a
 * provider), then runs `resolvePair` belt-and-braces (the SAME trust-boundary check the produce route uses),
 * then reads the env key. Returns the resolved dispatch bits, or a `{status, error}` degrade — never a key.
 */
export type ChatDispatch =
  | { ok: true; provider: string; apiKey: string; endpoint: string }
  | { ok: false; status: number; error: string }

/**
 * ALM-C6 follow-up (TKT-0052 review MEDIUM-1) — the `/chat` route's own request-shape guard, a pure
 * predicate so the 400 `bad-request` arm is deterministically testable without a live key. A malformed
 * body (missing `messages`, or `system`/`model` of the wrong type) must never reach `resolveChatDispatch`/
 * `provider.stream()` — that lands the failure in the untested "impure" remainder as a 500, not a 400.
 */
export const EFFORT_VALUES = ['low', 'medium', 'high', 'xhigh'] as const

export function isChatBody(body: {
  system?: unknown
  model?: unknown
  messages?: unknown
  effort?: unknown
}): body is {
  system: string
  model: string
  messages: Turn[]
  effort?: Effort
} {
  return (
    typeof body.system === 'string' &&
    typeof body.model === 'string' &&
    Array.isArray(body.messages) &&
    // `effort` is OPTIONAL (the Figma chat-input refactor's Effort picker) — absent is valid (no dial
    // requested); present must be one of the closed four values, never forwarded as an arbitrary string.
    (body.effort === undefined || (EFFORT_VALUES as readonly unknown[]).includes(body.effort))
  )
}

export function resolveChatDispatch(
  config: ProvidersConfig,
  env: Record<string, string | undefined>,
  model: string,
): ChatDispatch {
  const providerId = providerForModel(config, model)
  if (providerId === undefined) return { ok: false, status: 400, error: 'unknown-model' }
  const pair = resolvePair(config, providerId, model) // belt-and-braces (SPEC-R12 PAIR-allowlist)
  if (!pair.ok) return { ok: false, status: 400, error: pair.reason }
  const apiKey = env[pair.envKey]
  if (apiKey === undefined || apiKey === '') return { ok: false, status: 503, error: 'no-key' }
  return { ok: true, provider: providerId, apiKey, endpoint: pair.entry.endpoint }
}
