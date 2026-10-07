// agent-admin-activity-steps.test.ts: T-0016 (ADR-0159 amendment, proposed): the Test Chat forwards its
// runner's neutral `step`/`footer` events into the conversation's step mode, so the strip shows per-step
// time and status, the one raw block and the footer, and NOT the legacy stage/category rows. Harness
// idioms (ElementInternals stub, composer submit, turn drain) are agent-admin-transcript-export.test.ts's.

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { createMemoryStore } from '@agent-ui/app'

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

describe('ui-agent-admin Test Chat: the runner drives the activity strip through step mode (T-0016)', () => {
  const mounted: Element[] = []
  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove()
  })

  async function runTurn(el: UIAgentAdminElement, text: string): Promise<void> {
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = text
    const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0)) // the async iterator drains on a microtask+task boundary
    await whenFlushed()
  }

  it('step and footer events become the strip rows; progress and lines add no legacy rows; the surface still mounts', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    const create = JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui' } })
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'progress' as const, progress: { stage: 'validating' as const } }
      yield { kind: 'step' as const, step: { id: 'validate', kind: 'validate', label: 'Validated', status: 'repaired' as const, durationMs: 1200, summary: 'Round 1 failed (SCHEMA), repaired in round 2', raw: create } }
      yield { kind: 'line' as const, line: create }
      yield { kind: 'step' as const, step: { id: 'open', kind: 'output', label: 'Opened a new surface', status: 'ok' as const } }
      yield { kind: 'footer' as const, footer: { rounds: 2, inputTokens: 900, outputTokens: 120, model: 'model-x' } }
    }
    await runTurn(el, 'deal me in')

    const strip = el.querySelector('[data-part="narration"]')!
    const items = [...strip.querySelectorAll(':scope > ui-timeline-item')]
    const text = (i: Element, role: string): string => i.querySelector(`:scope > [data-role="${role}"]`)?.textContent ?? ''
    expect(items.map((i) => i.getAttribute('data-activity') ?? text(i, 'label'))).toEqual(['Validated', 'Opened a new surface', 'raw', 'footer', 'model'])
    expect(text(items[0]!, 'description')).toBe('Round 1 failed (SCHEMA), repaired in round 2')
    expect(text(items[0]!, 'timestamp')).toBe('1.2s')
    expect(strip.querySelectorAll('[data-role="source"]').length, 'the raw output shows once').toBe(1)
    expect(text(items[3]!, 'text')).toBe('2 rounds · 900 input tokens · 120 output tokens')
    expect(text(items[4]!, 'text'), 'the model rides its own line').toBe('model-x')
    expect(el.querySelector('[data-part="canvas"] ui-surface-host'), 'line routing is unchanged').not.toBeNull()
  })
})
