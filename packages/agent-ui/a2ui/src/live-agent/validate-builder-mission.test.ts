// validate-builder-mission.test.ts — ADR-0182 cl.2 / SPEC-R31, the `validateAuthoringSurface` shape
// applied a second time. Unlike that gate (a persona-scoped store key), `builderMission`'s TRUE source
// is structural turn-origin (`session === 'authoring'`, derived host-side in `admin-live-runner.ts`) —
// but by the time it crosses the wire it is an ordinary untrusted boolean like any other, so the SAME
// fail-closed validator shape and both-hosts-thread discipline apply verbatim.
//
// It sits in `src/live-agent/` for the same reason `validate-authoring-surface.test.ts` does: that
// directory is inside the vitest+tsc include, so importing the Node-scoped `tools/agent/` module by
// relative path is what transitively typechecks it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateBuilderMission } from '../../tools/agent/chat-validation.ts'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

describe('validateBuilderMission — the fail-closed trust-boundary posture validateAuthoringSurface set', () => {
  it('accepts true/false verbatim', () => {
    expect(validateBuilderMission(true)).toBe(true)
    expect(validateBuilderMission(false)).toBe(false)
  })

  it('degrades every non-boolean to undefined — never a 400', () => {
    for (const bad of ['true', 'false', 1, 0, null, undefined, {}, []]) {
      expect(validateBuilderMission(bad), String(bad)).toBeUndefined()
    }
  })

  it('the degrade is genuinely CLOSED: undefined composes zero mission-teaching bytes', () => {
    const off = buildSystemPrompt(defaultCatalog, [])
    expect(
      buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, undefined, validateBuilderMission('true')),
    ).toBe(off)
    expect(
      buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, undefined, validateBuilderMission(1)),
    ).toBe(off)
    expect(
      buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, undefined, validateBuilderMission(true)),
    ).not.toBe(off)
  })

  it('is a SEPARATE gate from authoringSurface — enabling one alone never composes the others teaching', () => {
    // ADR-0182 cl.1 — the two answer different questions (may this persona author patches at all, vs.
    // is THIS turn the Builder's own dedicated interview), so a turn that authors without being the
    // Builder's own turn must NOT pick up the mission-nudge teaching, and vice versa.
    const off = buildSystemPrompt(defaultCatalog, [])
    const authoringOnly = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, true, false)
    const missionOnly = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, false, true)
    const both = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, true, true)
    expect(authoringOnly).not.toBe(off)
    expect(missionOnly).not.toBe(off)
    expect(authoringOnly).not.toBe(missionOnly)
    expect(both.length).toBeGreaterThan(authoringOnly.length)
    expect(both.length).toBeGreaterThan(missionOnly.length)
  })
})

describe('both hosts thread the validated gate into ProduceOptions (ADR-0168’s both-arms discipline)', () => {
  // The `validate-authoring-surface.test.ts` precedent, verbatim in mechanism: a source-text assertion,
  // because `worker/index.ts` must never be IMPORTED into a shared test process (its module-scope
  // `process-shim.ts` side effect would leak — vitest.config.ts's `tools` project says so).
  const ROOT = `${(process as unknown as { cwd(): string }).cwd()}/packages/agent-ui/a2ui/tools/agent`
  const devProxySrc = readFileSync(`${ROOT}/dev-proxy-plugin.ts`, 'utf8')
  const workerSrc = readFileSync(`${ROOT}/worker/index.ts`, 'utf8')

  it('each host parses `builderMission` off the body and validates it through the ONE shared helper', () => {
    for (const [name, src] of [['dev proxy', devProxySrc], ['worker', workerSrc]] as const) {
      expect(src, name).toMatch(/builderMission\?: unknown/)
      expect(src, name).toMatch(/const builderMissionGate = validateBuilderMission\(builderMission\)/)
    }
  })

  it('each host spreads it into produce() opts with the absent-⇒-omit-key shape', () => {
    for (const [name, src] of [['dev proxy', devProxySrc], ['worker', workerSrc]] as const) {
      expect(src, name).toMatch(/\.\.\.\(builderMissionGate !== undefined \? \{ builderMission: builderMissionGate \} : \{\}\)/)
    }
  })
})
