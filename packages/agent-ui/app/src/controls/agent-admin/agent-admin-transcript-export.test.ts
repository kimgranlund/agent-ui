// agent-admin-transcript-export.test.ts — GH #1154: the dev-debug bundle exported `[]` transcripts
// despite a long live SURFACE session, because `testChatTranscript()` read `#history` (prose-arm model
// memory, which the surface arm never touches). These tests drive a real surface turn through the real
// `ui-agent-admin` element and prove the export accessors now see it — the test that would have caught
// the shipped defect. Harness idioms (ElementInternals stub, composer submit, turn drain) are the
// agent-admin-bankroll.test.ts ones, verbatim.

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

describe('ui-agent-admin export transcript — GH #1154: surface turns are transcript facts', () => {
  const mounted: Element[] = []
  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove()
  })

  function composerSubmit(el: UIAgentAdminElement, text: string): void {
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = text
    const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  }

  async function runTurn(el: UIAgentAdminElement, text: string): Promise<void> {
    if (!el.isConnected) {
      document.body.append(el)
      mounted.push(el)
      await whenFlushed()
    }
    composerSubmit(el, text)
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0)) // the async iterator drains on a microtask+task boundary
    await whenFlushed()
  }

  function createSurfaceLine(id = 'table-1'): string {
    return JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: id, catalogId: 'agent-ui' } })
  }

  it('a SURFACE-arm turn (the blackjack repro) lands in testChatTranscript(), with liveTurnCount counting it', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'note' as const, note: 'Dealt: 8♠ K♦.' }
      yield { kind: 'line' as const, line: createSurfaceLine() }
    }
    expect(el.testChatTranscript()).toEqual([])
    expect(el.liveTurnCount()).toBe(0)

    await runTurn(el, 'deal me in')

    const transcript = el.testChatTranscript()
    expect(transcript).toEqual([
      { role: 'user', content: 'deal me in' },
      { role: 'assistant', content: 'Dealt: 8♠ K♦.' },
    ])
    expect(el.liveTurnCount()).toBe(1)
    // The Builder interview never ran — its transcript stays honestly empty.
    expect(el.builderInterviewTranscript()).toEqual([])
  })

  it('a prose-less surface turn (wire lines only) still records — never a silent drop', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'line' as const, line: createSurfaceLine('table-2') }
    }
    await runTurn(el, 'hit')
    const transcript = el.testChatTranscript()
    expect(transcript[0]).toEqual({ role: 'user', content: 'hit' })
    expect(transcript[1]!.role).toBe('assistant')
    expect(transcript[1]!.content).toMatch(/A2UI wire line/)
  })

  it('a STUB (prose-arm) turn still records into the export transcript — both arms feed one truth', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    // agentSurfaceTurn UNARMED ⇒ the stub prose arm answers (the static build's only path).
    await runTurn(el, 'hello')
    const transcript = el.testChatTranscript()
    expect(transcript.length).toBe(2)
    expect(transcript[0]).toEqual({ role: 'user', content: 'hello' })
    expect(transcript[1]!.role).toBe('assistant')
    expect(el.liveTurnCount()).toBe(1)
  })

  it('a FAILED surface turn is a transcript fact too (⚠-prefixed), so an all-failed session never exports empty', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    // eslint-disable-next-line require-yield
    el.agentSurfaceTurn = async function* () {
      throw new Error('proxy unreachable')
    }
    await runTurn(el, 'deal')
    const transcript = el.testChatTranscript()
    expect(transcript).toEqual([
      { role: 'user', content: 'deal' },
      { role: 'assistant', content: '⚠ proxy unreachable' },
    ])
    expect(el.liveTurnCount()).toBe(1)
  })

  it('a real persona switch (store reassignment) clears the export transcript with the rest of the thread', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'note' as const, note: 'Round 1.' }
    }
    await runTurn(el, 'deal')
    expect(el.testChatTranscript().length).toBe(2)
    el.store = createMemoryStore({}) // a REAL store identity change — GH #145's reset
    await whenFlushed()
    expect(el.testChatTranscript()).toEqual([])
    expect(el.liveTurnCount()).toBe(0)
  })
})
