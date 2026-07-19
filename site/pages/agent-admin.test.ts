// agent-admin.test.ts (site) — ALM-C9 / TKT-0052 (ADR-0136). Two standing gates on the DEV-only live
// overlay, both DETERMINISTIC (no live key in CI):
//
//  1. The tree-shake SOURCE gate — the a2ui-chat.test.ts:218 gate mirrored verbatim: the construction that
//     causes Rolldown-Vite to tree-shake the overlay out of `vite build` (a dev-only DYNAMIC import behind
//     an `import.meta.env.DEV` guard, never a static module-scope import) is genuinely present in the page
//     source, so the static build's "no live-call code" guarantee (ADR-0131 cl.4/7) is proven, not trusted.
//  2. The model-registry LOCKSTEP trip-wire — every `SUPPORTED_MODELS` id the admin UI offers must resolve
//     against the REAL providers.json via `providerForModel`. A silent drift here (a model in the picker
//     that no implemented provider owns) would be a live-only 400 no jsdom behavior test could ever see —
//     the stub never validates against the real registry.

import { describe, it, expect } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (a2ui-chat.test.ts precedent)
import { readFileSync } from 'node:fs'
import { SUPPORTED_MODELS } from '@agent-ui/app/agent-admin-schema'
import { providerForModel } from '../../packages/agent-ui/a2ui/tools/agent/providers-config.ts'
import type { ProvidersConfig } from '../../packages/agent-ui/a2ui/tools/agent/providers-config.ts'

declare const process: { cwd(): string }

const ROOT = process.cwd()
const DEV_GUARD = ['import', 'meta', 'env', 'DEV'].join('.') // the guard token, assembled so no tooling reads it as a dotenv reference

describe('site/pages/agent-admin.ts — the live overlay is genuinely DEV-guarded + dynamically imported (SPEC-N2)', () => {
  const source = readFileSync(`${ROOT}/site/pages/agent-admin.ts`, 'utf8') as string

  it('never statically imports admin-live-runner.ts or live-proxy-transport.ts at module scope', () => {
    const staticImportLines = source.split('\n').filter((l) => /^import /.test(l))
    for (const line of staticImportLines) {
      expect(line).not.toMatch(/admin-live-runner/)
      expect(line).not.toMatch(/live-proxy-transport/)
    }
  })

  it(`wireLiveOverlay checks the DEV guard BEFORE it reaches the dynamic import`, () => {
    const fnStart = source.indexOf('function wireLiveOverlay')
    expect(fnStart, 'wireLiveOverlay() was not found').toBeGreaterThan(-1)
    const fnBody = source.slice(fnStart)
    const devGuardIdx = fnBody.indexOf(DEV_GUARD)
    const dynImportIdx = fnBody.indexOf("import('../lib/admin-live-runner.ts')")
    expect(devGuardIdx, 'the DEV guard was not found in wireLiveOverlay').toBeGreaterThan(-1)
    expect(dynImportIdx, 'the dynamic import was not found in wireLiveOverlay').toBeGreaterThan(-1)
    expect(devGuardIdx, 'the DEV guard must be checked BEFORE the dynamic import is ever reached').toBeLessThan(dynImportIdx)
  })
})

describe('site/pages/agent-admin.ts — SUPPORTED_MODELS ⊆ the real providers.json (ALM-C9 lockstep trip-wire)', () => {
  const config = JSON.parse(
    readFileSync(`${ROOT}/packages/agent-ui/a2ui/tools/agent/providers.json`, 'utf8') as string,
  ) as ProvidersConfig

  it('every model that SHIPS INCLUDED resolves to an IMPLEMENTED provider (a drift here is a live-only 400); off-by-default options must still be KNOWN providers.json ids', () => {
    expect(SUPPORTED_MODELS.length).toBeGreaterThan(0)
    for (const model of SUPPORTED_MODELS) {
      if (model.includedByDefault) {
        // ships switched ON ⇒ a live turn can reach it out of the box ⇒ must be implemented
        expect(providerForModel(config, model.id), `included-by-default id "${model.id}" resolves to no implemented provider`).toBeDefined()
      } else {
        // rev.4: the OpenAI/Gemini options ship OFF (implemented: false roadmap providers — an admin
        // switching one on gets the proxy's visible degrade, not a silent 400). The id-drift guard stays:
        // the id must exist SOMEWHERE in providers.json, implemented or not.
        const known = Object.values(config.providers).some((p) => p.models.some((m) => m.id === model.id))
        expect(known, `roster id "${model.id}" is unknown to providers.json — an id drift`).toBe(true)
      }
    }
  })
})
