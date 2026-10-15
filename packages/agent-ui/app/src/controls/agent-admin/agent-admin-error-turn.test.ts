// agent-admin-error-turn.test.ts: T-0221. One renderer rejection sends one error turn. The renderer emits
// one client `error` per violation, all inside the same finalize (traces 2026-10-15.jsonl:113 and :114,
// `acts->bBet` and `acts->bCheck` in the same second); the admin used to defer one heal turn per message, so
// two heal turns ran in parallel. The errors a rejection sends together now ride one turn that names every
// violation.

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { createMemoryStore } from '@agent-ui/app'
import { SURFACE_A2UI_KEY } from './agent-admin-schema.ts'

// The jsdom ElementInternals stub (agent-admin-bankroll.test.ts verbatim): the admin mounts real FACE controls.
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

describe('ui-agent-admin: one renderer rejection, one error turn (T-0221)', () => {
  const mounted: Element[] = []
  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove()
  })

  it('two violations in one rejection drive ONE client turn whose error names both', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(SURFACE_A2UI_KEY, true)
    const turns: { kind: string; message?: unknown }[] = []
    el.agentSurfaceTurn = async function* (req) {
      turns.push(req.turn as { kind: string; message?: unknown })
      if (req.turn.kind === 'intent') {
        yield { kind: 'note' as const, note: 'Dealt.' }
        yield { kind: 'line' as const, line: JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui' } }) }
        yield {
          kind: 'line' as const,
          line: JSON.stringify({
            version: 'v1.0',
            updateComponents: {
              surfaceId: 'table-1',
              components: [
                { id: 'root', component: 'Column', children: ['acts'] },
                { id: 'acts', component: 'Row', children: ['bCheck', 'bBet'] }, // both dangle: two violations
              ],
            },
          }),
        }
      } else {
        // The heal delivers both buttons, so the surface finalizes clean and no further error turn runs.
        yield { kind: 'note' as const, note: 'Repaired.' }
        yield {
          kind: 'line' as const,
          line: JSON.stringify({
            version: 'v1.0',
            updateComponents: {
              surfaceId: 'table-1',
              components: [
                { id: 'bCheck', component: 'Text', text: 'Check' },
                { id: 'bBet', component: 'Text', text: 'Bet' },
              ],
            },
          }),
        }
      }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'deal'
    ;(composer.querySelector('[data-part="editor"]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    for (let i = 0; i < 40; i++) {
      await whenFlushed()
      await new Promise((r) => setTimeout(r, 5)) // GH #63: client turns are deferred to a fresh macrotask
    }

    const errorTurns = turns.filter((t) => t.kind === 'client')
    expect(errorTurns, 'one heal turn for one rejection').toHaveLength(1)
    const error = (errorTurns[0]!.message as { error: { code: string; surfaceId: string; message: string } }).error
    expect(error.code).toBe('VALIDATION_FAILED')
    expect(error.surfaceId).toBe('table-1')
    expect(error.message).toContain('acts->bCheck')
    expect(error.message).toContain('acts->bBet')
  })
})
