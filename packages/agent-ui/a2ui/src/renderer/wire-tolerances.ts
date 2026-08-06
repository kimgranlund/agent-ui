// wire-tolerances.ts — GH #484 (move phase): the ONE physical registry every deliberate A2UI
// Postel-law inbound-tolerance arm lives in, consolidated out of renderer.ts/checks.ts/chat-
// validation.ts per the shape `.claude/docs/references/wire-tolerances.md`'s INDEX section
// anticipated ("Deferred — the module-move phase"). This is a PURE, mechanical relocation — every
// function below is byte-identical in BEHAVIOR to its pre-move original (proven by the SAME pinning
// tests the INDEX doc already names: `renderer.test.ts:261-275` for A1/A3, `upstream-fixtures.test.ts:
// 101-120` for A2, `checks.test.ts:132-145` for C1, `select-catalog.test.ts` for S1 — GH #487's own
// coverage rider, added the same wave). Each arm keeps its INDEX-doc id in its own doc comment so the
// mapping stays traceable.
//
// Zero-dep, browser+Node safe (no DOM, no `node:*`): `readActionSpec`/`readCheck` are imported by
// `src/renderer/*.ts` (browser); `selectCatalog` is additionally imported by `tools/agent/
// chat-validation.ts` (Node-side, re-exported there UNCHANGED so `dev-proxy-plugin.ts`/`worker/
// index.ts`'s existing `import { selectCatalog } from './chat-validation.ts'` needed no call-site
// change). This module has no opinion about its callers' runtime — it is the one direction `tools/`
// may depend on `src/`, never the reverse (the standing layering law).
//
// V1 (the upstream fixture harness's v0.9→v1.0 envelope translation) and E7 (the catalog.json
// `rejectFunctionCall` narrowing) are DELIBERATELY NOT here: V1 is test-harness-only (never a runtime
// tolerance — `SUPPORTED_VERSIONS` has no `v0.9` member, wire-tolerances.md's own V1 row says so), and
// E7 is a declarative catalog flag read by `catalog/conformance.ts`, not a parsing function to relocate.

// ── A1/A2/A3 — the Button action-prop reader (was renderer.ts `readActionSpec`) ────────────────────

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Interpret a Button's `action` prop value into the action-emission inputs (renderer.ts's
 * `#wireAction` is the sole caller). The CANONICAL inbound shape is `{ action, context?,
 * wantResponse?, submit? }` (ADR-0011 + the ADR-0054 `submit` extension, pinned in the catalog SPEC
 * §5.1/§5.2 + `catalog/default/catalog.json`): `action` is the action NAME, `context`/`wantResponse`
 * are surfaced straight off the canonical object, and `submit:true` is a CLIENT-consumed flag
 * `#wireAction` reads to gate the click — it is NEVER part of the emitted wire message (ADR-0054
 * clause 1; the outbound `A2uiAction` shape is untouched). Two fallbacks are RETAINED as documented
 * Postel's-law tolerance — not silent guesses:
 *
 * A1 — Tolerance: a bare string is the action name (no context/wantResponse/submit to surface).
 * A3 — Canonical `action` (ADR-0011); `name` is the tolerated synonym, taken only when `action` is
 *      absent. Canonical `action` wins when both keys are present.
 *
 * A2 — a THIRD tolerance arm (ADR-0169 cl.10, amends ADR-0011): upstream A2UI Basic Catalog's
 * `Action` is `{event:{name, context?}}` — normalized to `{name: event.name, context: event.context}`,
 * with `wantResponse`/`submit` staying `undefined` (upstream has neither; ADR-0088 §3's
 * undefined-vs-false distinction is preserved). The `{functionCall}` Action arm is NOT accepted here —
 * excluded v1 (ADR-0169 E7): the renderer has no client-side action-execution path.
 */
export function readActionSpec(
  spec: unknown,
): { name: string; wantResponse?: boolean; context?: Record<string, unknown>; submit?: boolean } {
  // A1 — Tolerance: a bare string is the action name (no context/wantResponse/submit to surface).
  if (typeof spec === 'string') return { name: spec }
  if (isObject(spec)) {
    // A2 (ADR-0169 cl.10): the upstream `{event:{name,context?}}` Action shape. Checked before the
    // canonical `action`/`name` arms — the two shapes are mutually exclusive on the wire, so order is
    // immaterial.
    if (isObject(spec.event) && typeof spec.event.name === 'string') {
      const out: { name: string; wantResponse?: boolean; context?: Record<string, unknown>; submit?: boolean } = {
        name: spec.event.name,
      }
      if (isObject(spec.event.context)) out.context = spec.event.context
      return out
    }
    // A3 — Canonical `action` (ADR-0011); `name` is the tolerated synonym, taken only when `action` is absent.
    const name = typeof spec.action === 'string' ? spec.action : typeof spec.name === 'string' ? spec.name : ''
    const out: { name: string; wantResponse?: boolean; context?: Record<string, unknown>; submit?: boolean } = { name }
    // `context`/`wantResponse`/`submit` surface from the canonical object (also honored on the `name`-synonym shape).
    // `wantResponse` is captured whenever the author wrote it as a real boolean — `true` OR `false` — never
    // just `=== true`: ADR-0088 §3 routes on the DISTINCTION between "explicitly false" (opt-out) and "never
    // authored" (stays `undefined` here, through `emitAction`'s own preserving assignment, to the wire).
    if (typeof spec.wantResponse === 'boolean') out.wantResponse = spec.wantResponse
    if (isObject(spec.context)) out.context = spec.context
    if (spec.submit === true) out.submit = true
    return out
  }
  return { name: '' }
}

// ── C1 — the `checks` entry reader (was checks.ts `readCheck`) ─────────────────────────────────────

/**
 * One normalised check: a `{call,args?}` function-call to evaluate + the human message to surface
 * when the call returns falsy. Internal representation only — both wire shapes map here. `call`/`args`
 * are kept as plain fields (not the full `FunctionCall` type) so this module stays independent of
 * `protocol.ts`'s import graph; `checks.ts` narrows the result into its own `Check`/`FunctionCall` shape.
 */
export interface ReadCheckResult {
  call: string
  args: Record<string, unknown> | undefined
  message: string
}

/** Args must be a plain object (not array, not null) to be valid. */
function isArgsObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * C1 — Tolerant reader for one raw `checks` entry (ADR-0029 §1 — Postel's law, mirrors the A1/A3
 * action reader above). Accepts either the flat `{call,args?,message}` shape or the
 * `condition`-wrapped `{condition:{call,args},message}` shape (the Button-example wire shape). Any
 * other shape returns `null` (skipped, non-fatal — `checks` is not user-submitted data).
 */
export function readCheck(raw: unknown): ReadCheckResult | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  // CONDITION wrapper: `{ condition: { call, args? }, message }`
  if (typeof r.condition === 'object' && r.condition !== null && typeof (r.condition as Record<string, unknown>).call === 'string') {
    const c = r.condition as Record<string, unknown>
    if (typeof r.message !== 'string') return null
    return { call: c.call as string, args: isArgsObject(c.args) ? c.args : undefined, message: r.message }
  }

  // FLAT: `{ call, args?, message }` (canonical)
  if (typeof r.call === 'string' && typeof r.message === 'string') {
    return { call: r.call, args: isArgsObject(r.args) ? r.args : undefined, message: r.message }
  }

  return null // unrecognised shape — skip
}

// ── S1 — the server-side catalog-selection fallback (was tools/agent/chat-validation.ts `selectCatalog`) ──

/** S1 (ADR-0169 cl.3) — fail-closed catalog selection: a non-string/unknown id degrades to the
 *  fallback, never a 400/500 and never a mixed catalog+prompt (the `sanitizeCatalog` discipline,
 *  server-side). Generic so no `Catalog` import is needed here — both `dev-proxy-plugin.ts` and
 *  `worker/index.ts` import it (re-exported, unchanged, from `chat-validation.ts`). */
export function selectCatalog<C>(catalogs: ReadonlyMap<string, C>, value: unknown, fallback: C): C {
  return (typeof value === 'string' ? catalogs.get(value) : undefined) ?? fallback
}
