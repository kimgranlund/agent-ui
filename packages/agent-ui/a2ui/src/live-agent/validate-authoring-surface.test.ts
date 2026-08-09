// validate-authoring-surface.test.ts — ADR-0178 cl.3 / SPEC-R30, the S3 half of the gate's realization
// (LLD `agent-authoring-flow.lld.md` §4, LLD-C5). S2 built the produce/prompt half — `ProduceOptions
// .authoringSurface` → `authoringBlock` — but nothing carried the per-turn flag ACROSS THE WIRE, so a
// gate-ON persona's turn still composed zero teaching bytes. This file pins the two halves S3 adds: the
// shared fail-closed validator, and the fact that BOTH hosts thread it (a one-host fix would make the
// production surface silently different from the dev one — the drift class ADR-0168's both-arms
// discipline exists to close).
//
// It sits in `src/live-agent/` for the same reason `chat-validation.test.ts`/`validate-mode.test.ts` do:
// that directory is inside the vitest+tsc include, so importing the Node-scoped `tools/agent/` module by
// relative path is what transitively typechecks it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateAuthoringSurface } from '../../tools/agent/chat-validation.ts'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

describe('validateAuthoringSurface — the fail-closed trust-boundary posture validateA2uiEnabled set', () => {
  it('accepts true/false verbatim', () => {
    expect(validateAuthoringSurface(true)).toBe(true)
    expect(validateAuthoringSurface(false)).toBe(false)
  })

  it('degrades every non-boolean to undefined — never a 400', () => {
    for (const bad of ['true', 'false', 1, 0, null, undefined, {}, []]) {
      expect(validateAuthoringSurface(bad), String(bad)).toBeUndefined()
    }
  })

  it('the degrade is genuinely CLOSED, not merely default-preserving: undefined composes zero teaching bytes', () => {
    // `a2uiEnabled`'s degrade preserves a default that happens to be ON. This gate's does the opposite —
    // `authoringBlock` requires a literal `true` — so a crafted value can only fail to enable the arm,
    // never talk the producer into teaching it. That asymmetry is the whole reason the gate is safe to
    // accept from a client at all, so it is asserted rather than assumed.
    const off = buildSystemPrompt(defaultCatalog, [])
    expect(buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, validateAuthoringSurface('true'))).toBe(off)
    expect(buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, validateAuthoringSurface(1))).toBe(off)
    expect(buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, validateAuthoringSurface(true))).not.toBe(off)
  })
})

describe('both hosts thread the validated gate into ProduceOptions (ADR-0168’s both-arms discipline)', () => {
  // The `chat-validation.test.ts` precedent, verbatim in mechanism: a source-text assertion, because
  // `worker/index.ts` must never be IMPORTED into a shared test process (its module-scope
  // `process-shim.ts` side effect would leak — vitest.config.ts's `tools` project says so).
  const ROOT = `${(process as unknown as { cwd(): string }).cwd()}/packages/agent-ui/a2ui/tools/agent`
  const devProxySrc = readFileSync(`${ROOT}/dev-proxy-plugin.ts`, 'utf8')
  const workerSrc = readFileSync(`${ROOT}/worker/index.ts`, 'utf8')

  it('each host parses `authoring` off the body and validates it through the ONE shared helper', () => {
    for (const [name, src] of [['dev proxy', devProxySrc], ['worker', workerSrc]] as const) {
      expect(src, name).toMatch(/authoring\?: unknown/)
      expect(src, name).toMatch(/const authoringSurface = validateAuthoringSurface\(authoring\)/)
    }
  })

  it('each host spreads it into produce() opts with the absent-⇒-omit-key shape', () => {
    // Omission is the contract, not a style: an absent flag must leave the opts object — and therefore
    // the composed prompt — byte-identical to a pre-S3 turn.
    for (const [name, src] of [['dev proxy', devProxySrc], ['worker', workerSrc]] as const) {
      expect(src, name).toMatch(/\.\.\.\(authoringSurface !== undefined \? \{ authoringSurface \} : \{\}\)/)
    }
  })
})
