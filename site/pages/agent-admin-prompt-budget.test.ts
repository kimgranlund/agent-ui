// agent-admin-prompt-budget.test.ts: T-0207 (ADR-0234). The prompt budget leg over each SHIPPED preset's real
// persona, not the 16 KB assumption `prompt-budget.test.ts` composes. Each preset seeds a real `ui-agent-admin`
// store; its composed persona is captured off the injected-runner seam (the `agent-admin-ambient-budget.test.ts`
// technique, never recomputed here), composed with the worst-case matrix (`a2ui/tools/agent/prompt-budget-matrix.ts`) on the
// catalog the preset resolves to, in every mode, and held under `promptBudgetFor` of that catalog. A seeded
// oversized preset shows the leg bites.
//
// MEASURED 2026-10-14 (T-0207): largest real persona 4 516 chars (croupier); worst case 130 097 chars
// (`agent-ui--croupier`, mode default) against PROMPT_CHAR_BUDGET_DERIVED 142 000, headroom 11 903. Worst base
// preset: travel, 126 792 against PROMPT_CHAR_BUDGET_BASE 141 100, headroom 14 308.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { createMemoryStore } from '@agent-ui/app'
import type { AdminTurnRequest } from '@agent-ui/app/agent-admin-schema'
import {
  A2UI_CATALOG_KEY,
  A2UI_DOMAINS_KEY,
  A2UI_LOCAL_PATTERNS_KEY,
  SURFACE_A2UI_KEY,
  resolveEffectiveCatalogId,
  sanitizeCatalog,
} from '@agent-ui/app/agent-admin-schema'
import { buildSystemPromptSections } from '../../packages/agent-ui/a2ui/src/agent/system-prompt.ts'
import { assessPromptBudget, promptBudgetFor } from '../../packages/agent-ui/a2ui/src/agent/prompt-budget.ts'
import { MODES, PERSONA_SYSTEM_CAP, catalogForId, worstArgs } from '../../packages/agent-ui/a2ui/tools/agent/prompt-budget-matrix.ts'
import { AGENT_PRESETS, presetSeed } from './agent-admin-presets.ts'
import type { AgentPreset } from './agent-admin-presets.ts'

// ── the jsdom ElementInternals stub (agent-admin-persona-file.test.ts verbatim) ─────────────────────────
let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

const mounted: Element[] = []
afterEach(() => {
  for (const el of mounted.splice(0)) el.remove()
})

interface PresetBudget {
  id: string
  catalogId: string
  personaChars: number
  /** The largest composed prompt over every mode, and its mode. */
  total: number
  mode: string
  limit: number
  over: boolean
}

/** Seed `preset`, send one turn through the real element and measure its worst-case prompt. The persona is
 *  `composeLiveSystemPrompt`'s output, the same string both the prose arm and the producer's persona seam carry. */
async function measure(preset: AgentPreset): Promise<PresetBudget> {
  const store = createMemoryStore({ initial: presetSeed(preset) })
  const catalogId = resolveEffectiveCatalogId(sanitizeCatalog(store.get(A2UI_CATALOG_KEY)), store.get(A2UI_LOCAL_PATTERNS_KEY), store.get(A2UI_DOMAINS_KEY))
  store.set(SURFACE_A2UI_KEY, false) // the prose arm answers through `agentTurn`, carrying the composed persona
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = store
  document.body.append(el)
  mounted.push(el)
  await whenFlushed()
  const calls: AdminTurnRequest[] = []
  el.agentTurn = async (req) => (calls.push(req), 'ok')
  const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
  composer.value = 'ping'
  ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
  for (let i = 0; i < 200 && calls.length === 0; i += 1) await Promise.resolve()
  expect(calls, `${preset.id}: the injected runner must have received the turn`).toHaveLength(1)
  el.remove()
  const persona = calls[0]!.system
  const resolved = catalogForId(catalogId)
  expect(resolved, `${preset.id}: catalog ${catalogId} is a base or a shipped derived catalog`).toBeDefined()
  const limit = promptBudgetFor(catalogId)
  let worst = { total: 0, mode: '' }
  for (const mode of MODES) {
    const { sections } = buildSystemPromptSections(...worstArgs(resolved!.catalog, resolved!.baseId, mode, persona))
    const { total } = assessPromptBudget(sections, limit)
    if (total > worst.total) worst = { total, mode }
  }
  return { id: preset.id, catalogId, personaChars: persona.length, ...worst, limit, over: worst.total > limit }
}

describe('T-0207: the prompt budget over each shipped preset (real composed persona)', () => {
  it('every preset composes within its catalog budget, and its persona within the proxy cap', async () => {
    expect(AGENT_PRESETS.length).toBeGreaterThan(0)
    const rows: PresetBudget[] = []
    for (const preset of AGENT_PRESETS) rows.push(await measure(preset))
    for (const r of rows) {
      expect(r.over, `${r.id} (${r.catalogId}, ${r.mode}): ${r.total} > ${r.limit}`).toBe(false)
      expect(r.personaChars, `${r.id}: the dev proxy drops a persona over ${PERSONA_SYSTEM_CAP} chars`).toBeLessThanOrEqual(PERSONA_SYSTEM_CAP)
    }
    const worst = rows.reduce((a, b) => (b.total > a.total ? b : a))
    const largest = rows.reduce((a, b) => (b.personaChars > a.personaChars ? b : a))
    console.info(`[T-0207] largest persona ${largest.personaChars} (${largest.id}); worst ${worst.total} (${worst.catalogId}, ${worst.mode}) of ${worst.limit}, headroom ${worst.limit - worst.total}`)
  }, 30_000) // composes every preset against every catalog, base plus persona shards (T-0240); 5 s is too tight on CI

  it('negative control: a seeded oversized preset goes over its budget', async () => {
    const croupier = AGENT_PRESETS.find((p) => p.id === 'croupier')!
    const r = await measure({ ...croupier, id: 'seeded-oversized', foundation: `${croupier.foundation}\n${'x'.repeat(20_000)}` })
    expect(r.catalogId).toBe('agent-ui--croupier')
    expect(r.over, `${r.total} should exceed ${r.limit}`).toBe(true)
  })
})
