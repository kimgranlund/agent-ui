import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIConversationElement } from './conversation.ts'
import type { UIConversationComposerElement } from './conversation-composer.ts'
import type { UISurfaceHostElement } from '../surface-host/surface-host.ts'
import '@agent-ui/components/components' // self-registers ui-button/ui-status-stream/ui-timeline-item
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
} from '@agent-ui/components/descriptor'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// LLD-C7 jsdom probes for ui-conversation — thread/composer/narration/per-surface registry (SPEC-R4/R5/
// R6/R7/R11). What jsdom CANNOT resolve — actual painted geometry, the scroll-follow guard's real
// scrollHeight behaviour, forced-colors — is conversation.browser.test.ts's job.

// jsdom reality (the settings.test.ts/schema.test.ts precedent) — no native ElementInternals.setFormValue/
// setValidity; the prototype is stubbed for this file's duration so the REAL composed form-associated
// ui-button parts the composer connects can connect at all.
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
  while (mounted.length) mounted.pop()?.remove()
  vi.useRealTimers()
})
function mount<T extends Element>(el: T): T {
  document.body.append(el)
  mounted.push(el)
  return el
}

const line = (obj: unknown): string => JSON.stringify(obj)

function log(el: UIConversationElement): HTMLElement {
  return el.querySelector('[data-part="log"]') as HTMLElement
}
function composer(el: UIConversationElement): UIConversationComposerElement {
  return el.querySelector('ui-conversation-composer') as UIConversationComposerElement
}

describe('ui-conversation — pre-connect calls are a documented no-op', () => {
  it('addUserMessage/reset never throw, beginAgentTurn returns an all-no-op stub handle, and warn ONCE total', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('ui-conversation') as UIConversationElement
    expect(() => el.addUserMessage('hi')).not.toThrow()
    const handle = el.beginAgentTurn()
    expect(() => {
      handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } }))
      handle.setNote('x')
      handle.finalize()
      handle.fail('x')
    }).not.toThrow()
    expect(() => el.reset()).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('onSubmit/onClientMessage register regardless of connection state (no warning, no DOM touched)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('ui-conversation') as UIConversationElement
    expect(() => el.onSubmit(() => {})).not.toThrow()
    expect(() => el.onClientMessage(() => {})).not.toThrow()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('ui-conversation — addUserMessage (SPEC-R4 AC1)', () => {
  it('appends a user bubble with the exact, unescaped text', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.addUserMessage('<b>hello</b> & goodbye')
    const bubble = log(el).querySelector('[data-part="bubble"][data-role="user"]') as HTMLElement
    expect(bubble).not.toBeNull()
    const body = bubble.querySelector('[data-part="body"]') as HTMLElement
    expect(body.textContent).toBe('<b>hello</b> & goodbye')
    expect(body.querySelector('b')).toBeNull() // never parsed as HTML
  })
})

describe('ui-conversation — per-surface registry (SPEC-R7): persistent identity across turns', () => {
  it('a fresh surfaceId mounts a NEW ui-surface-host inline in that turn bubble; a KNOWN id (a later turn) routes to the SAME host/bubble', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)

    // "root" is NEVER reconciled on resend (ADR-0128 clause 7 — the shipped IDGRAPH guard forecloses a
    // second `root` delivery) — the resend below targets a NON-root container ('group'), the exact shape
    // ADR-0128's own repro/fix targets.
    const t1 = el.beginAgentTurn()
    t1.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }))
    t1.ingestLine(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'root', component: 'Column', children: ['group'] },
            { id: 'group', component: 'Column', children: ['msg'] },
            { id: 'msg', component: 'Text', text: 'hello' },
          ],
        },
      }),
    )
    t1.finalize()

    const bubble1 = log(el).querySelectorAll('[data-part="bubble"][data-role="agent"]')[0] as HTMLElement
    const host1 = bubble1.querySelector('ui-surface-host') as UISurfaceHostElement
    expect(host1).not.toBeNull()

    const t2 = el.beginAgentTurn()
    t2.ingestLine(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'group', component: 'Column', children: ['msg', 'status'] },
            { id: 'status', component: 'Text', text: 'ready' },
          ],
        },
      }),
    )
    t2.finalize()

    const bubble2 = log(el).querySelectorAll('[data-part="bubble"][data-role="agent"]')[1] as HTMLElement
    // turn2's OWN bubble mounted NO new surface host — s1 is known, routed to its original bubble/host.
    expect(bubble2.querySelector('ui-surface-host')).toBeNull()
    expect(bubble1.querySelectorAll('ui-surface-host')).toHaveLength(1) // still exactly ONE host for s1, never a duplicate
    expect(host1.textContent).toContain('ready') // the resend genuinely reached the SAME host
  })

  it('TKT-0079: beginAgentTurn({intoSurface}) RESUMES the owning bubble — no new card; narration swaps fresh; note overwritten; a fresh surfaceId mounts in the SAME bubble', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)

    const t1 = el.beginAgentTurn()
    t1.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'game', catalogId: 'agent-ui' } }))
    t1.setNote('table dealt')
    t1.finalize()
    const bubble1 = log(el).querySelector('[data-part="bubble"][data-role="agent"]') as HTMLElement
    const strip1 = bubble1.querySelector('[data-part="narration"]')

    const t2 = el.beginAgentTurn({ intoSurface: 'game' })
    t2.ingestLine(line({ version: 'v1.0', updateDataModel: { surfaceId: 'game', path: '/x', value: 1 } }))
    // a FRESH surfaceId inside the resumed turn stays in the same card (the ticket's "unless it has to" rule)
    t2.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'side-pot', catalogId: 'agent-ui' } }))
    t2.setNote('you drew a card')
    t2.finalize()

    expect(log(el).querySelectorAll('[data-part="bubble"][data-role="agent"]')).toHaveLength(1) // NO second card
    expect(bubble1.querySelector('[data-part="body"]')?.textContent).toBe('you drew a card') // note overwritten
    const strips = bubble1.querySelectorAll('[data-part="narration"]')
    expect(strips).toHaveLength(1) // exactly one strip — the fresh one REPLACED the finalized one
    expect(strips[0]).not.toBe(strip1)
    expect(bubble1.querySelectorAll('ui-surface-host')).toHaveLength(2) // side-pot mounted HERE, not a new bubble
  })

  it('TKT-0079 negative control: an unknown (or closed) intoSurface falls through to the fresh-bubble path', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)

    const t1 = el.beginAgentTurn({ intoSurface: 'never-seen' })
    t1.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'a', catalogId: 'agent-ui' } }))
    t1.finalize()
    expect(log(el).querySelectorAll('[data-part="bubble"][data-role="agent"]')).toHaveLength(1)

    const t2 = el.beginAgentTurn()
    t2.ingestLine(line({ version: 'v1.0', deleteSurface: { surfaceId: 'a' } }))
    t2.finalize()

    const t3 = el.beginAgentTurn({ intoSurface: 'a' }) // closed record ⇒ NOT resumable
    t3.setNote('after close')
    t3.finalize()
    expect(log(el).querySelectorAll('[data-part="bubble"][data-role="agent"]')).toHaveLength(3)
  })

  it('a deleteSurface line disposes that ONE host + leaves a VISIBLE "Closed." annotation; a later line re-targeting it is recognized as KNOWN, never throws', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)

    const t1 = el.beginAgentTurn()
    t1.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'agent-ui' } }))
    t1.ingestLine(
      line({ version: 'v1.0', updateComponents: { surfaceId: 's2', components: [{ id: 'root', component: 'Column', children: [] }] } }),
    )
    t1.finalize()
    const bubble = log(el).querySelector('[data-part="bubble"][data-role="agent"]') as HTMLElement
    const host = bubble.querySelector('ui-surface-host') as UISurfaceHostElement
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement
    expect(surface.childElementCount).toBeGreaterThan(0)

    const t2 = el.beginAgentTurn()
    t2.ingestLine(line({ version: 'v1.0', deleteSurface: { surfaceId: 's2' } }))
    t2.finalize()

    expect(surface.childElementCount).toBe(0) // the host's own RendererHost was disposed
    expect(bubble.dataset.state).toBe('closed')
    const annotation = bubble.querySelector('[data-part="annotation"]') as HTMLElement
    expect(annotation).not.toBeNull()
    expect(annotation.textContent).toBe('Closed.')

    // A later line re-targeting the same, now-closed id: recognized as KNOWN, never throws, no NEW mount anywhere.
    const t3 = el.beginAgentTurn()
    expect(() =>
      t3.ingestLine(line({ version: 'v1.0', updateComponents: { surfaceId: 's2', components: [{ id: 'root', component: 'Column', children: [] }] } })),
    ).not.toThrow()
    t3.finalize()
    expect(log(el).querySelectorAll('ui-surface-host')).toHaveLength(1) // still just the ONE host ever created for s2
  })
})

describe('ui-conversation — onSubmit (SPEC-R5), forwarded from the composed ui-conversation-composer (TKT-0056)', () => {
  it('a send through the composed composer calls addUserMessage AND fires onSubmit; the value clears', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    const child = composer(el)
    child.value = '  hello agent  ' // the composer's own value prop (TKT-0058 — no nested field/form anymore)
    ;(child.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(received).toEqual(['hello agent'])
    expect(child.value).toBe('')
    const bubble = log(el).querySelector('[data-part="bubble"][data-role="user"]') as HTMLElement
    expect(bubble.querySelector('[data-part="body"]')!.textContent).toBe('hello agent') // addUserMessage was called
  })

  it('no registered onSubmit never throws (the composer\'s own empty/no-callback guards are conversation-composer.test.ts\'s job)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const child = composer(el)
    child.value = 'hi'
    expect(() => (child.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))).not.toThrow()
  })
})

describe('ui-conversation — the composed ui-conversation-composer (TKT-0056): props forwarded down, callbacks forwarded up', () => {
  it('models/model/efforts/effort/contextItems all forward straight through to the composed child', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.models = [{ id: 'a', label: 'Model A' }]
    el.model = 'a'
    el.efforts = [{ id: 'low', label: 'Low' }]
    el.effort = 'low'
    el.contextItems = [{ id: 'sel-1', label: 'Context Selection' }]
    await whenFlushed() // the forwarding effect is microtask-batched, not synchronous
    const child = composer(el)
    expect(child.models).toEqual(el.models)
    expect(child.model).toBe('a')
    expect(child.efforts).toEqual(el.efforts)
    expect(child.effort).toBe('low')
    expect(child.contextItems).toEqual(el.contextItems)
  })

  it('committing a Models/Effort picker choice in the composed child fires ui-conversation\'s OWN onModelChange/onEffortChange', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.models = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]
    el.efforts = [{ id: 'low', label: 'Low' }, { id: 'high', label: 'High' }]
    await whenFlushed()
    const modelIds: string[] = []
    const effortIds: string[] = []
    el.onModelChange((id) => modelIds.push(id))
    el.onEffortChange((id) => effortIds.push(id))
    ;(el.querySelector('[data-part="models-menu"] [data-value="b"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    ;(el.querySelector('[data-part="effort-menu"] [data-value="high"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(modelIds).toEqual(['b'])
    expect(effortIds).toEqual(['high'])
  })

  it('dismissing a context chip in the composed child fires ui-conversation\'s OWN onContextDismiss', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.contextItems = [{ id: 'sel-1', label: 'Context Selection' }]
    await whenFlushed()
    const received: string[] = []
    el.onContextDismiss((id) => received.push(id))
    ;(el.querySelector('[data-part="context-chip-dismiss"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(received).toEqual(['sel-1'])
  })

  it('onMicClick reveals the composed child\'s mic button — POST-connect registration', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const mic = el.querySelector('[data-part="mic"]') as HTMLElement
    expect(mic.hasAttribute('hidden')).toBe(true)
    let clicks = 0
    el.onMicClick(() => (clicks += 1))
    expect(mic.hasAttribute('hidden')).toBe(false)
    mic.dispatchEvent(new Event('click', { bubbles: true }))
    expect(clicks).toBe(1)
  })

  it('onMicClick registered BEFORE connect ALSO reveals the mic once composed (code-reviewer finding F1 — the conditional forwarder)', () => {
    const el = document.createElement('ui-conversation') as UIConversationElement
    let clicks = 0
    el.onMicClick(() => (clicks += 1)) // pre-connect — no composer exists yet, must not throw
    mount(el)
    const mic = el.querySelector('[data-part="mic"]') as HTMLElement
    expect(mic.hasAttribute('hidden')).toBe(false)
    mic.dispatchEvent(new Event('click', { bubbles: true }))
    expect(clicks).toBe(1)
  })

  it('an unregistered onMicClick never reveals the mic for a consumer that never asked for voice input (the a2ui-chat.ts hazard this fixes)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const mic = el.querySelector('[data-part="mic"]') as HTMLElement
    expect(mic.hasAttribute('hidden')).toBe(true)
  })
})

describe('ui-conversation — busy/re-entrancy guard (TKT-0034), forwarded to the composed child\'s `busy` prop', () => {
  it('beginAgentTurn() sets the composed child\'s busy to true; finalize() clears it', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    expect(composer(el).busy).toBe(false)
    const handle = el.beginAgentTurn()
    expect(composer(el).busy).toBe(true)
    handle.finalize()
    expect(composer(el).busy).toBe(false)
  })

  it('fail() also clears busy (not only finalize())', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    expect(composer(el).busy).toBe(true)
    handle.fail('network error')
    expect(composer(el).busy).toBe(false)
  })

  it('two overlapping turns keep busy true until BOTH end (the in-flight count, not a bare flag)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    const t2 = el.beginAgentTurn()
    expect(composer(el).busy).toBe(true)
    t1.finalize()
    expect(composer(el).busy, 't1 ended but t2 is still in flight — busy must stay true').toBe(true)
    t2.finalize()
    expect(composer(el).busy).toBe(false)
  })

  it('reset() mid-turn zeroes the in-flight count and clears busy (an abandoned handle must not stick it true)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.beginAgentTurn() // never finalize()d/fail()d — the handle is abandoned
    expect(composer(el).busy).toBe(true)
    el.reset()
    expect(composer(el).busy, 'reset() must clear busy even for an abandoned in-flight handle').toBe(false)
    // and a fresh beginAgentTurn()/finalize() cycle behaves normally afterward.
    const handle = el.beginAgentTurn()
    expect(composer(el).busy).toBe(true)
    handle.finalize()
    expect(composer(el).busy).toBe(false)
  })

  it('a re-entrant send while a turn is in flight is a no-op (the composer\'s own busy guard, TKT-0034 end-to-end)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    const child = composer(el)
    const send = child.querySelector('[data-part="send"]') as HTMLElement
    const clickSend = (): boolean => send.dispatchEvent(new Event('click', { bubbles: true }))

    child.value = 'first message'
    clickSend()
    expect(received).toEqual(['first message'])

    const handle = el.beginAgentTurn()
    child.value = 'second message'
    clickSend()
    expect(received, 'a 2nd onSubmit fired during an in-flight turn').toEqual(['first message'])
    expect(child.value, 'the typed text was NOT retained across a re-entrant send').toBe('second message')
    expect(log(el).querySelectorAll('[data-part="bubble"][data-role="user"]')).toHaveLength(1)

    handle.finalize()
    clickSend()
    expect(received).toEqual(['first message', 'second message'])
    expect(log(el).querySelectorAll('[data-part="bubble"][data-role="user"]')).toHaveLength(2)
  })
})

describe('ui-conversation — narration (SPEC-R6, ADR-0146 live-at-ingest)', () => {
  it('categories narrate LIVE-AT-INGEST — an entry appears active the moment its FIRST line is ingested, settles done at finalize, deduplicated in emission order', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    const narration = el.querySelector('[data-part="narration"]')!
    const items = () => [...narration.querySelectorAll('ui-timeline-item')] as (HTMLElement & { status: string })[]

    // no lines yet — zero category entries (the post-hoc replay is GONE; entries are live now)
    expect(items()).toHaveLength(0)

    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's3', catalogId: 'agent-ui' } }))
    // the 'open' entry appears IMMEDIATELY, active — not replayed at finalize
    expect(items()).toHaveLength(1)
    expect(items()[0].status).toBe('active')

    handle.ingestLine(
      line({ version: 'v1.0', updateComponents: { surfaceId: 's3', components: [{ id: 'root', component: 'Column', children: [] }] } }),
    )
    // the 'restructure' entry appears immediately too, in emission order — both active mid-turn
    expect(items()).toHaveLength(2)
    expect(items()[1].status).toBe('active')

    // a SECOND line of the same category does NOT add a duplicate entry (deduplicated)
    handle.ingestLine(
      line({ version: 'v1.0', updateComponents: { surfaceId: 's3', components: [{ id: 'root', component: 'Column', children: [] }] } }),
    )
    expect(items()).toHaveLength(2)

    handle.finalize()
    // both settle to done at finalize
    expect(items().map((i) => i.status)).toEqual(['done', 'done'])
  })

  it('BLANK-BUBBLE regression proof: a turn with ZERO lines and ZERO progress still shows a visible WORKING header from t=0 (ADR-0146 F8)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.beginAgentTurn() // no lines, no progress — just an opened turn
    const narration = el.querySelector('[data-part="narration"]')!
    const header = narration.querySelector('[data-part="header"]')
    expect(header, 'the narration strip must opt into the header (ADR-0146 F8)').not.toBeNull()
    expect(header!.getAttribute('data-status'), 'the header reads working (active) from construction — the blank-bubble root fix').toBe('active')
    // and there is a VISIBLE label, not just aria (today aria-only)
    expect(narration.querySelector('[data-part="header-label"]')?.textContent).toBe('Agent activity')
  })

  it('handle.progress() routes a lifecycle stage into the strip via the CLOSED code-owned label table; an unknown stage renders NOTHING (the F2 honesty guard, negative control)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    const narration = el.querySelector('[data-part="narration"]')!
    const items = () => [...narration.querySelectorAll('ui-timeline-item')] as (HTMLElement & { status: string })[]
    const labels = () => items().map((i) => i.querySelector('[data-role="label"]')?.textContent)

    handle.progress({ stage: 'reasoning' })
    expect(labels(), "reasoning renders the FIXED 'Reasoning…' label — never model text").toContain('Reasoning…')

    // 'retry' carries the round ordinal factually
    handle.progress({ stage: 'retry', round: 2 })
    expect(labels().some((l) => l === 'Self-correcting… (round 2)'), 'retry composes the real round ordinal in').toBe(true)

    // a 'retry' with NO round number never fabricates one (the F2 honesty guard applies to the ordinal too).
    // A fresh beginAgentTurn() mounts its OWN bubble/narration — read the LAST one, not the first.
    const handle2 = el.beginAgentTurn()
    handle2.progress({ stage: 'retry' })
    const narrations2 = el.querySelectorAll('[data-part="narration"]')
    const narration2 = narrations2[narrations2.length - 1]!
    const labels2 = () => [...narration2.querySelectorAll('ui-timeline-item')].map((i) => i.querySelector('[data-role="label"]')?.textContent)
    expect(labels2().some((l) => l === 'Self-correcting…'), 'an absent round omits the parenthetical entirely — never a fabricated (round 1)').toBe(true)

    // an UNKNOWN/unobserved stage renders NOTHING (the honesty guard — a stage never observed is never shown)
    const before = items().length
    handle.progress({ stage: 'almost-done' as unknown as 'reasoning' })
    expect(items().length, 'an unknown stage must add no entry').toBe(before)
  })

  it('a consumer that never calls progress() is byte-behavior-unchanged (no progress entries appear)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'sx', catalogId: 'agent-ui' } }))
    handle.finalize()
    const narration = el.querySelector('[data-part="narration"]')!
    const labels = [...narration.querySelectorAll('ui-timeline-item [data-role="label"]')].map((n) => n.textContent)
    expect(labels.some((l) => l?.includes('Reasoning') || l?.includes('Self-correcting')), 'no progress entries without progress()').toBe(false)
  })

  it('setNote renders the exact note text; no note falls back to a factual tally, never a fabricated sentence', async () => {
    vi.useFakeTimers()
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)

    const withNote = el.beginAgentTurn()
    withNote.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's4', catalogId: 'agent-ui' } }))
    withNote.setNote('Built a settings form.')
    withNote.finalize()
    const notes = () => [...el.querySelectorAll('[data-part="bubble"][data-role="agent"] [data-part="body"]')] as HTMLElement[]
    expect(notes()[0].textContent).toBe('Built a settings form.')

    const noNote = el.beginAgentTurn()
    noNote.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's5', catalogId: 'agent-ui' } }))
    noNote.finalize()
    expect(notes()[1].textContent).toMatch(/Emitted 1 A2UI message\(s\): createSurface\./)
  })

  it('the post-hoc narrateCategories replay + NARRATION_STEP_MS pacing are DELETED, not stranded (ADR-0146 live-at-ingest — grep-zero in the live code)', () => {
    const src = readFileSync(`${process.cwd()}/packages/agent-ui/app/src/controls/conversation/conversation.ts`, 'utf8') as string
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '') // strip comments (the file header documents the deletion in prose)
    expect(code, 'NARRATION_STEP_MS must be gone from the live code').not.toMatch(/NARRATION_STEP_MS/)
    expect(code, 'the narrateCategories replay must be gone from the live code').not.toMatch(/narrateCategories/)
    // anti-vacuous: the raw source DOES still mention them in the file-header prose (documenting the deletion)
    expect(src).toMatch(/narrateCategories/)
  })

  it('fail() truncates narration with an error entry, forces the header to error, adds a system bubble, and settles touched hosts (SPEC-R6 AC3, ADR-0146 F8)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's6', catalogId: 'agent-ui' } }))
    expect(() => handle.fail('network error')).not.toThrow()

    const narration = el.querySelector('[data-part="narration"]')!
    const errorItem = narration.querySelector('ui-timeline-item[status="error"]')
    expect(errorItem).not.toBeNull()
    expect(errorItem!.textContent).toMatch(/network error/)

    // ADR-0146 F8 — fail() forces the streaming header to error (the completion invariant's header-level face)
    expect(narration.querySelector('[data-part="header"]')?.getAttribute('data-status')).toBe('error')

    const system = el.querySelector('[data-part="bubble"][data-role="system"] [data-part="body"]') as HTMLElement
    expect(system.textContent).toMatch(/network error/)
  })
})

describe('ui-conversation — content-render hook (SPEC-R12, TKT-0071)', () => {
  it('AC1: unregistered — note and system-bubble text render as plain textContent, byte-identical to before the hook existed', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'r1', catalogId: 'agent-ui' } }))
    handle.setNote('**bold** stays literal')
    handle.finalize()
    const note = el.querySelector('[data-part="bubble"][data-role="agent"] [data-part="body"]') as HTMLElement
    expect(note.textContent).toBe('**bold** stays literal')
    expect(note.children.length).toBe(0) // no element children — plain text node only

    const failed = el.beginAgentTurn()
    failed.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'r1b', catalogId: 'agent-ui' } }))
    failed.fail('**err**')
    const system = el.querySelector('[data-part="bubble"][data-role="system"] [data-part="body"]') as HTMLElement
    expect(system.textContent).toBe('⚠ **err**')
    expect(system.children.length).toBe(0)
  })

  it('AC2: registered — note and system-bubble text route through the renderer, replacing the body\'s children', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.setContentRenderer((text) => {
      const span = document.createElement('span')
      span.dataset.testRendered = text
      return span
    })

    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'r2', catalogId: 'agent-ui' } }))
    handle.setNote('**bold**')
    handle.finalize()
    const note = el.querySelector('[data-part="bubble"][data-role="agent"] [data-part="body"]') as HTMLElement
    expect(note.querySelector('span')?.dataset.testRendered).toBe('**bold**')
    expect(note.textContent).toBe('') // the renderer's span carries no text of its own in this stub

    const handle2 = el.beginAgentTurn()
    handle2.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'r3', catalogId: 'agent-ui' } }))
    handle2.fail('**err**')
    const system = el.querySelector('[data-part="bubble"][data-role="system"] [data-part="body"]') as HTMLElement
    expect(system.querySelector('span')?.dataset.testRendered).toBe('⚠ **err**')
  })

  it('AC3: a registered renderer never applies to addUserMessage — user text stays unescaped/unmodified (SPEC-R4 AC1 unchanged)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.setContentRenderer((text) => {
      const span = document.createElement('span')
      span.dataset.testRendered = text
      return span
    })
    el.addUserMessage('**not rendered**')
    const body = el.querySelector('[data-part="bubble"][data-role="user"] [data-part="body"]') as HTMLElement
    expect(body.textContent).toBe('**not rendered**')
    expect(body.querySelector('span')).toBeNull()
  })
})

describe('ui-conversation — disclosure (ADR-0129 clause 3)', () => {
  it('default false: no wire dump appended even with lines this turn', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's7', catalogId: 'agent-ui' } }))
    handle.finalize()
    expect(el.querySelector('[data-part="disclosure"]')).toBeNull()
  })

  it('true: a per-turn wire dump is appended, pretty-printed', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.disclosure = true
    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's8', catalogId: 'agent-ui' } }))
    handle.finalize()
    const details = el.querySelector('[data-part="disclosure"]') as HTMLElement
    expect(details).not.toBeNull()
    const wire = details.querySelector('[data-part="wire"]') as HTMLElement
    expect(wire.textContent).toContain('"createSurface"')
  })
})

describe('ui-conversation — reset()', () => {
  it('disposes every open surface host and clears the thread', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's9', catalogId: 'agent-ui' } }))
    handle.finalize()
    expect(log(el).children.length).toBeGreaterThan(0)
    el.reset()
    expect(log(el).children.length).toBe(0)
  })
})

describe('ui-conversation — disconnect disposes every open surface host (leak-safety net)', () => {
  it('removing the element WITHOUT calling reset()/dispose() still tears down every composed RendererHost', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's10', catalogId: 'agent-ui' } }))
    handle.ingestLine(
      line({ version: 'v1.0', updateComponents: { surfaceId: 's10', components: [{ id: 'root', component: 'Column', children: [] }] } }),
    )
    handle.finalize()
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement
    expect(surface.childElementCount).toBeGreaterThan(0)

    el.remove() // disconnect — NOT reset()/dispose(); the leak-safety net must still fire
    // the surface-host CHILD's own disconnected() ALSO fires automatically (a connected subtree's removal
    // cascades disconnectedCallback to every descendant custom element) — either mechanism alone already
    // tears this down; asserting the observable OUTCOME (not which of the two mechanisms won) is what matters.
    expect(surface.childElementCount, 'the composed surface host leaked its rendered DOM past disconnect').toBe(0)
  })
})

describe('ui-conversation — SPEC-R7 AC1: persistent identity survives an ORDINARY disconnect/reconnect (regression)', () => {
  it('remove() then re-append() (a router detach/reattach, NOT moveBefore) never mints a second host for an already-seen surfaceId', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)

    const t1 = el.beginAgentTurn()
    t1.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'dup1', catalogId: 'agent-ui' } }))
    t1.ingestLine(
      line({ version: 'v1.0', updateComponents: { surfaceId: 'dup1', components: [{ id: 'root', component: 'Column', children: [] }] } }),
    )
    t1.finalize()
    expect(log(el).querySelectorAll('ui-surface-host')).toHaveLength(1)
    const bubble1 = log(el).querySelectorAll('[data-part="bubble"][data-role="agent"]')[0] as HTMLElement
    expect(bubble1.querySelectorAll('ui-surface-host')).toHaveLength(1)

    // An ORDINARY detach/reattach — the same element instance, removed then re-appended (a router
    // unmount/remount, e.g.), NOT a `moveBefore`-preserved move. `disconnected()` fires in between.
    el.remove()
    document.body.append(el)
    mounted.push(el)

    // A second turn sends ANOTHER line for the SAME, already-seen surfaceId.
    const t2 = el.beginAgentTurn()
    t2.ingestLine(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'dup1', components: [{ id: 'root', component: 'Column', children: ['btn'] }, { id: 'btn', component: 'Button', variant: 'solid', label: 'Go' }] },
      }),
    )
    t2.finalize()

    // THE FIX: exactly ONE ui-surface-host ever exists for `dup1` — it stays at its ORIGINAL bubble
    // (turn1's own), never a second mint in turn2's own bubble (SPEC-R7 AC1's "the SAME instance" clause).
    // Before the fix, `disconnected()` WIPED the registry (`.clear()`) instead of marking each record
    // `closed` — the id read back as "unknown" post-reconnect, and this exact line minted a SECOND host in
    // a SECOND bubble (a real repro the reviewer confirmed against the pre-fix code).
    expect(log(el).querySelectorAll('ui-surface-host'), 'a duplicate host was minted for an already-seen surfaceId post-reconnect').toHaveLength(1)
    const bubble2 = log(el).querySelectorAll('[data-part="bubble"][data-role="agent"]')[1] as HTMLElement
    expect(bubble2.querySelectorAll('ui-surface-host'), 'turn2 own bubble minted its OWN surface host instead of routing to turn1s').toHaveLength(0)
    expect(bubble1.querySelectorAll('ui-surface-host')).toHaveLength(1) // still exactly the ORIGINAL host, at the ORIGINAL bubble

    // disconnect's leak-safety dispose ALSO marked the surface `closed` (the SAME `deleteSurface`
    // transition, "Closed." annotation included) — a SEPARATE, already-covered SPEC-R7 AC2 concern (a
    // known-but-closed id is recognized, not silently dropped, but does not re-open); this test's own
    // scope is ONLY the no-duplicate-mint guarantee asserted above, not resuming a closed surface's render.
    expect(bubble1.dataset.state, 'the original surface was not marked closed by the disconnect teardown').toBe('closed')
    expect(bubble1.querySelector('[data-part="annotation"]')?.textContent).toBe('Closed.')
  })
})

// ── descriptor — ADR-0004 (structural + contract↔props + contract↔source) ──────────────────────────────

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/conversation`
const ts = readFileSync(`${DIR}/conversation.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/conversation.css`, 'utf8') as string

describe('conversation.md descriptor', () => {
  const md = readFileSync(`${DIR}/conversation.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['disclosure', 'disabled', 'models', 'model', 'efforts', 'effort', 'contextItems']

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-conversation')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-conversation\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UIConversationElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIConversationElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS (negative control)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => ({ ...a, reflect: false }))
    expect(compareDescriptorToProps(flipReflect, UIConversationElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.disclosure.reflect' }),
    )
  })

  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
