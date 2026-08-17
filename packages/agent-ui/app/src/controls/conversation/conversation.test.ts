import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIConversationElement } from './conversation.ts'
import type { UIConversationComposerElement } from './conversation-composer.ts'
import type { UIConversationDialogElement } from './conversation-dialog.ts'
import type { UIConversationHeaderElement } from './conversation-header.ts'
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
      handle.mountGenui('g', '<p></p>')
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

describe('ui-conversation — GH #891 SPEC-R10: the sent bubble carries display-only reference tags', () => {
  const REFS = [
    { id: 'res-menu', label: 'Menu PDF', kind: 'resource', icon: 'file-text' },
    { id: 'svc:calc:*', label: 'Calculator', kind: 'tool' }, // no icon — the mixed case, on purpose
  ]

  it('AC1 — the body is the TYPED text (never the framed text) and the bubble carries one tag per reference', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.addUserMessage('Total the dinner order', REFS)
    const bubble = log(el).querySelector('[data-part="bubble"][data-role="user"]') as HTMLElement
    const body = bubble.querySelector('[data-part="body"]') as HTMLElement
    expect(body.textContent).toBe('Total the dinner order')
    // The FRAMED text (SPEC-R4's wire/history truth, built by ui-agent-admin) must never reach a bubble.
    expect(bubble.textContent).not.toContain('## Referenced for this message')
    expect(bubble.textContent).not.toContain('### Menu PDF (resource)')

    const row = bubble.querySelector('[data-part="reference-tags"]') as HTMLElement
    expect(row, 'the tag row is attached to the bubble itself').not.toBeNull()
    expect(row.parentElement).toBe(bubble)
    expect(body.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING, 'the tags follow the body').toBeTruthy()
    const tags = [...row.querySelectorAll<HTMLElement>('[data-part="reference-tag"]')]
    expect(tags.map((t) => t.textContent)).toEqual(['Menu PDF', 'Calculator'])
    expect(tags.map((t) => t.dataset.kind)).toEqual(['resource', 'tool'])
    // DISMISS-LESS by contract: the turn is sent, so there is nothing to remove (unlike the composer chip).
    expect(row.querySelector('ui-button')).toBeNull()
    expect(row.querySelector('[data-part="reference-chip-dismiss"]')).toBeNull()
  })

  it('AC1 — the R9 glyph rides through when the reference carries one, and is simply absent when it does not', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.addUserMessage('q', REFS)
    const tags = [...log(el).querySelectorAll<HTMLElement>('[data-part="reference-tag"]')]
    const icon = tags[0]!.querySelector<HTMLElement>('[data-part="reference-tag-icon"]')!
    expect(icon.tagName.toLowerCase()).toBe('ui-icon')
    expect(icon.getAttribute('glyph')).toBe('file-text')
    expect(icon.getAttribute('data-role')).toBe('icon')
    expect(tags[0]!.firstElementChild, 'the glyph leads the label').toBe(icon)
    expect(tags[1]!.querySelector('[data-part="reference-tag-icon"]'), 'no glyph, no cell').toBeNull()
    expect([...tags[1]!.children].map((c) => (c as HTMLElement).dataset.part)).toEqual(['reference-tag-label'])
  })

  it('AC2 — a single-arg (or empty-list) addUserMessage renders the pre-R10 bubble byte-identically', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.addUserMessage('single arg') // the pre-R10 call shape, verbatim
    el.addUserMessage('empty list', [])
    el.addUserMessage('undefined', undefined)
    const bubbles = [...log(el).querySelectorAll<HTMLElement>('[data-part="bubble"][data-role="user"]')]
    expect(bubbles.length).toBe(3)
    for (const bubble of bubbles) {
      expect(bubble.querySelector('[data-part="reference-tags"]'), 'no empty row is ever appended').toBeNull()
      // The WHOLE bubble shape, not just the absence of a row: one child, the body.
      expect([...bubble.children].map((c) => (c as HTMLElement).dataset.part)).toEqual(['body'])
    }
    expect(bubbles.map((b) => b.outerHTML)).toEqual([
      '<div data-part="bubble" data-role="user"><p data-part="body">single arg</p></div>',
      '<div data-part="bubble" data-role="user"><p data-part="body">empty list</p></div>',
      '<div data-part="bubble" data-role="user"><p data-part="body">undefined</p></div>',
    ])
  })

  it('AC1 — tag text is plain text: a label carrying markup is never parsed (the addUserMessage escaping law, extended)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.addUserMessage('q', [{ id: 'x', label: '<b>Menu</b> & more', kind: 'resource' }])
    const tag = log(el).querySelector('[data-part="reference-tag-label"]') as HTMLElement
    expect(tag.textContent).toBe('<b>Menu</b> & more')
    expect(tag.querySelector('b')).toBeNull()
  })

  it('a registered content renderer never touches the tags (or the user body) — SPEC-R4 AC1 / R12 unchanged', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.setContentRenderer((text) => {
      const marker = document.createElement('div')
      marker.dataset.part = 'rendered'
      marker.textContent = `RENDERED:${text}`
      return marker
    })
    el.addUserMessage('**not rendered**', REFS)
    const bubble = log(el).querySelector('[data-part="bubble"][data-role="user"]') as HTMLElement
    expect(bubble.querySelector('[data-part="rendered"]')).toBeNull()
    expect(bubble.querySelector('[data-part="body"]')!.textContent).toBe('**not rendered**')
    expect([...bubble.querySelectorAll('[data-part="reference-tag-label"]')].map((n) => n.textContent)).toEqual([
      'Menu PDF', 'Calculator',
    ])
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
    // GH #306/ADR-0160 amendment — the narration strip is the OWNING [data-part="turn"] wrapper's own
    // child now, a sibling of the bubble (not the bubble's own child) — found via the wrapper.
    const turn1 = bubble1.parentElement as HTMLElement
    const strip1 = turn1.querySelector('[data-part="narration"]')

    const t2 = el.beginAgentTurn({ intoSurface: 'game' })
    t2.ingestLine(line({ version: 'v1.0', updateDataModel: { surfaceId: 'game', path: '/x', value: 1 } }))
    // a FRESH surfaceId inside the resumed turn stays in the same card (the ticket's "unless it has to" rule)
    t2.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'side-pot', catalogId: 'agent-ui' } }))
    t2.setNote('you drew a card')
    t2.finalize()

    expect(log(el).querySelectorAll('[data-part="bubble"][data-role="agent"]')).toHaveLength(1) // NO second card
    expect(bubble1.querySelector('[data-part="body"]')?.textContent).toBe('you drew a card') // note overwritten
    const strips = turn1.querySelectorAll('[data-part="narration"]')
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
    // GH #1061 — the closed HOST carries its own marker (conversation.css keys the dim + placeholder
    // suppression off it), and a content-bearing surface closed after rendering is NOT terminal-empty.
    expect(host.dataset.state).toBe('closed')
    expect(host.hasAttribute('data-empty-final')).toBe(false)
  })

  it('GH #1061 — close-before-finalize with NO content: the host settles terminal-empty (data-empty-final), never freezing the anticipatory placeholder', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)

    // The reported wire shape: one turn creates a surface and deletes that SAME id with no
    // updateComponents in between — `#settleTouchedHosts` skips closed records, so only
    // `#closeSurface`'s own pre-dispose finalize() can stamp the ADR-0187 brace.
    const t = el.beginAgentTurn()
    t.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's4', catalogId: 'agent-ui' } }))
    t.ingestLine(line({ version: 'v1.0', deleteSurface: { surfaceId: 's4' } }))
    t.finalize()

    const bubble = log(el).querySelector('[data-part="bubble"][data-role="agent"]') as HTMLElement
    const host = bubble.querySelector('ui-surface-host') as UISurfaceHostElement
    // The host settled terminal-empty from its OWN facts: the mount never received a root, so the
    // ':empty' copy is the truthful "Nothing was rendered for this surface.", not the frozen
    // anticipatory "appears here" promise.
    expect(host.hasAttribute('data-empty-final')).toBe(true)
    expect(host.dataset.state).toBe('closed')
    // The turn is closed history with the standard annotation…
    expect(bubble.dataset.state).toBe('closed')
    const annotation = bubble.querySelector('[data-part="annotation"]') as HTMLElement
    expect(annotation.textContent).toBe('Closed.')
    // …and the record stays KNOWN + closed: a later line re-targeting it never mints a second host.
    const t2 = el.beginAgentTurn()
    expect(() =>
      t2.ingestLine(line({ version: 'v1.0', updateComponents: { surfaceId: 's4', components: [{ id: 'root', component: 'Column', children: [] }] } })),
    ).not.toThrow()
    t2.finalize()
    expect(log(el).querySelectorAll('ui-surface-host')).toHaveLength(1)
  })
})

// GH #805 — answered A2UI cards disable their inputs. The disable-on-action + re-enable-on-update arms
// are surface-host.ts's OWN mechanism (self-wired, zero wiring here — proven there); this file's job is
// the ONE arm ui-conversation itself owns: `AgentTurnHandle.fail()` re-enabling the surface whose own
// action started the now-failed turn when that turn never sent it another line.
describe('ui-conversation — GH #805: fail() re-enables the surface its own action started', () => {
  function mountButtonSurface(el: UIConversationElement, surfaceId: string): { host: UISurfaceHostElement; button: HTMLElement & { disabled: boolean } } {
    const t = el.beginAgentTurn()
    t.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId, catalogId: 'agent-ui' } }))
    t.ingestLine(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId,
          components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } }],
        },
      }),
    )
    t.finalize()
    const hosts = log(el).querySelectorAll('ui-surface-host')
    const host = hosts[hosts.length - 1] as UISurfaceHostElement // THIS call's own fresh mount — never an earlier surface's
    const button = host.querySelector('ui-button') as HTMLElement & { disabled: boolean }
    return { host, button }
  }

  it('a click disables the card; a resumed update (TKT-0079) re-enables it — no fail() needed', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const { button } = mountButtonSurface(el, 'game')
    expect(button.disabled).toBe(false)
    button.click()
    expect(button.disabled, 'the click disabled its own card').toBe(true)

    const t2 = el.beginAgentTurn({ intoSurface: 'game' })
    t2.ingestLine(
      line({ version: 'v1.0', updateComponents: { surfaceId: 'game', components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go again', action: { action: 'go' } }] } }),
    )
    expect(button.disabled, 'a new update line re-enables the card live, mid-batch').toBe(false)
    t2.finalize()
    expect(button.disabled).toBe(false)
  })

  it('fail() re-enables the originating surface when the turn NEVER sends it another line (the ask-arm shape, GH #802/#803)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const { button } = mountButtonSurface(el, 'ask-1')
    button.click()
    expect(button.disabled).toBe(true)

    // The ask-arm's real turn: a FRESH bubble (no intoSurface — GH #802's own routing) — but the answered
    // surfaceId is passed EXPLICITLY as `disabledSurfaceId` (the agent-admin.ts GH #805-repair shape),
    // never resending the answered surfaceId at all.
    const t2 = el.beginAgentTurn({ disabledSurfaceId: 'ask-1' })
    t2.fail('network error')
    expect(button.disabled, 'a failed turn must not strand the dead card disabled').toBe(false)
  })

  it('finalize() does NOT re-enable an untouched surface — a successful ask round stays disabled as history', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const { button } = mountButtonSurface(el, 'ask-2')
    button.click()
    expect(button.disabled).toBe(true)

    const t2 = el.beginAgentTurn({ disabledSurfaceId: 'ask-2' }) // fresh round, never touches 'ask-2' again
    t2.setNote('a fresh question')
    t2.finalize()
    expect(button.disabled, 'success on an untouched surface leaves it disabled — answered history').toBe(true)
  })

  it('GH #805 repair — a KEYED claim, never a blind dequeue: two pending surfaces are each claimed ONLY by name, in either order', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const { button: buttonA } = mountButtonSurface(el, 'card-a')
    const { button: buttonB } = mountButtonSurface(el, 'card-b')
    buttonA.click()
    buttonB.click()
    expect(buttonA.disabled).toBe(true)
    expect(buttonB.disabled).toBe(true)

    // Claimed OUT OF click order — B first — proving the mechanism is keyed, not FIFO-ordered.
    const turnB = el.beginAgentTurn({ disabledSurfaceId: 'card-b' })
    const turnA = el.beginAgentTurn({ disabledSurfaceId: 'card-a' })

    turnB.fail('b failed')
    expect(buttonB.disabled, 'turnB re-enabled its OWN surface').toBe(false)
    expect(buttonA.disabled, 'turnB must never touch the OTHER surface').toBe(true)

    turnA.fail('a failed')
    expect(buttonA.disabled).toBe(false)
  })

  it('GH #805 repair — a turn naming NEITHER disabledSurfaceId NOR intoSurface (a typed intent, or a genui action turn) claims NOTHING', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const { button } = mountButtonSurface(el, 'card-c')
    button.click()
    expect(button.disabled).toBe(true)

    // An UNRELATED turn (no key at all) must never steal this pending entry — the bare-FIFO defect this
    // repair closes (a genui action's own beginAgentTurn() call shares this exact shape: it never pushed
    // anything here, and must never claim anything either).
    const unrelated = el.beginAgentTurn()
    unrelated.fail('unrelated failure')
    expect(button.disabled, 'an unrelated, unkeyed turn must never re-enable a card it has nothing to do with').toBe(true)

    // The card's OWN, correctly-keyed turn still resolves it normally.
    const t2 = el.beginAgentTurn({ disabledSurfaceId: 'card-c' })
    t2.fail('the real failure')
    expect(button.disabled).toBe(false)
  })

  it('a surface already re-enabled by its own update is a harmless no-op for a later fail() (no double-fire)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const { button } = mountButtonSurface(el, 'game-2')
    button.click()
    expect(button.disabled).toBe(true)

    const t2 = el.beginAgentTurn({ intoSurface: 'game-2' })
    t2.ingestLine(
      line({ version: 'v1.0', updateComponents: { surfaceId: 'game-2', components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Again', action: { action: 'go' } }] } }),
    )
    expect(button.disabled).toBe(false) // re-enabled by the update already
    expect(() => t2.fail('late error')).not.toThrow()
    expect(button.disabled).toBe(false)
  })

  it('GH #805 repair — a wantResponse:false action (ADR-0088 §3) never disables and never queues at all', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t = el.beginAgentTurn()
    t.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'cancel-1', catalogId: 'agent-ui' } }))
    t.ingestLine(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'cancel-1',
          components: [{ id: 'root', component: 'Button', variant: 'ghost', label: 'Cancel', action: { action: 'cancel', wantResponse: false } }],
        },
      }),
    )
    t.finalize()
    const received: unknown[] = []
    el.onClientMessage((m) => received.push(m))
    const button = log(el).querySelector('ui-button') as HTMLElement & { disabled: boolean }

    button.click()
    expect(received).toHaveLength(1) // the click still fires the client message — just never disables for it
    expect(button.disabled, 'a wantResponse:false action runs no turn — nothing would ever re-enable it').toBe(false)

    // Nothing was queued either — an unrelated later turn naming this surfaceId explicitly finds nothing
    // to re-enable (proving no false membership was ever recorded, not just that the button looks live).
    const t2 = el.beginAgentTurn({ disabledSurfaceId: 'cancel-1' })
    expect(() => t2.fail('unrelated')).not.toThrow()
    expect(button.disabled).toBe(false)
  })

  it('GH #805 repair — reset() clears the pending-disabled bookkeeping (a persona switch never misaligns the next session)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    mountButtonSurface(el, 'stale-1')
    const staleButton = log(el).querySelector('ui-button') as HTMLElement & { disabled: boolean }
    staleButton.click()
    expect(staleButton.disabled).toBe(true)

    el.reset() // a persona switch — the whole registry (and this bookkeeping) tears down

    // A FRESH session reuses the same surfaceId string (a real, if rare, possibility) — the reset must
    // have dropped the stale claim, or this turn would incorrectly find (and try to re-enable) it.
    const { button: freshButton } = mountButtonSurface(el, 'stale-1')
    freshButton.click()
    expect(freshButton.disabled).toBe(true)
    const t = el.beginAgentTurn() // an unrelated, unkeyed turn — must claim nothing regardless
    t.fail('unrelated')
    expect(freshButton.disabled, "the fresh session's own click still owns its own disable normally").toBe(true)
  })
})

describe('ui-conversation — mountGenui (genui-surface.spec.md SPEC-R5/R8): the PARALLEL per-surface mount', () => {
  it('a fresh surfaceId mounts a NEW ui-sandbox-frame inline in that turn bubble; a KNOWN id (a later turn) rebuilds the SAME host in place', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)

    const t1 = el.beginAgentTurn()
    t1.mountGenui('q3-revenue', '<p>first</p>')
    t1.finalize()

    const bubble1 = log(el).querySelectorAll('[data-part="bubble"][data-role="agent"]')[0] as HTMLElement
    const host1 = bubble1.querySelector('ui-sandbox-frame') as HTMLElement & { html: string; surfaceId: string }
    expect(host1).not.toBeNull()
    expect(host1.surfaceId).toBe('q3-revenue')
    expect(host1.html).toBe('<p>first</p>')

    const t2 = el.beginAgentTurn()
    t2.mountGenui('q3-revenue', '<p>replaced</p>')
    t2.finalize()

    const bubble2 = log(el).querySelectorAll('[data-part="bubble"][data-role="agent"]')[1] as HTMLElement
    // turn2's OWN bubble mounted NO new frame — q3-revenue is known, routed to its original bubble/host.
    expect(bubble2.querySelector('ui-sandbox-frame')).toBeNull()
    expect(bubble1.querySelectorAll('ui-sandbox-frame')).toHaveLength(1) // still exactly ONE frame, never a duplicate
    expect(host1.html).toBe('<p>replaced</p>') // SPEC-R5 replace — the SAME host's html rebuilt atomically
  })

  it('mountGenui and ingestLine mount into DISJOINT id spaces — a genui surfaceId never collides with an A2UI one', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'shared-id', catalogId: 'agent-ui' } }))
    t1.mountGenui('shared-id', '<p>genui</p>')
    t1.finalize()
    const bubble = log(el).querySelector('[data-part="bubble"][data-role="agent"]') as HTMLElement
    expect(bubble.querySelector('ui-surface-host')).not.toBeNull()
    expect(bubble.querySelector('ui-sandbox-frame')).not.toBeNull() // BOTH mounted — no collision
  })

  it("a frame's `action` event bubbles through onClientMessage, framed as {genuiAction}, distinct from an A2uiClientMessage shape", () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const received: unknown[] = []
    el.onClientMessage((m) => received.push(m))

    const t1 = el.beginAgentTurn()
    t1.mountGenui('widget', '<p>rate me</p>')
    t1.finalize()

    const host = log(el).querySelector('ui-sandbox-frame') as HTMLElement
    host.dispatchEvent(new CustomEvent('action', { detail: { surfaceId: 'widget', name: 'rate', payload: { stars: 5 } } }))

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual({ genuiAction: { surfaceId: 'widget', name: 'rate', payload: { stars: 5 } } })
  })

  it('reset() clears the genui registry — a later mountGenui on the SAME surfaceId mounts fresh, never a stale reference', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.mountGenui('q3-revenue', '<p>before reset</p>')
    t1.finalize()
    el.reset()
    expect(log(el).querySelectorAll('ui-sandbox-frame')).toHaveLength(0)

    const t2 = el.beginAgentTurn()
    t2.mountGenui('q3-revenue', '<p>after reset</p>')
    t2.finalize()
    const hosts = log(el).querySelectorAll('ui-sandbox-frame')
    expect(hosts).toHaveLength(1)
    expect((hosts[0] as HTMLElement & { html: string }).html).toBe('<p>after reset</p>')
  })

  it('the pre-connect no-op stub handle carries mountGenui too — never throws', () => {
    const el = document.createElement('ui-conversation') as UIConversationElement
    const handle = el.beginAgentTurn()
    expect(() => handle.mountGenui('x', '<p></p>')).not.toThrow()
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

  it('providers/provider/modes/mode all forward straight through to the composed child (GH #257)', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.providers = [{ id: 'anthropic', label: 'Anthropic', defaultModel: 'sonnet', models: [{ id: 'sonnet', label: 'Sonnet' }] }]
    el.provider = 'anthropic'
    el.modes = [{ id: 'default', label: 'Default' }]
    el.mode = 'default'
    await whenFlushed()
    const child = composer(el)
    expect(child.providers).toEqual(el.providers)
    expect(child.provider).toBe('anthropic')
    expect(child.modes).toEqual(el.modes)
    expect(child.mode).toBe('default')
  })

  it('mentionables/invocables forward straight through, and a committed reference rides onSubmit\'s widened second argument (GH #849)', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.mentionables = [{ id: 'res-menu', label: 'Menu PDF', kind: 'resource' }]
    el.invocables = [{ id: 'svc:calc:*', label: 'Calculator', kind: 'tool' }]
    await whenFlushed()
    const child = composer(el)
    expect(child.mentionables).toEqual(el.mentionables)
    expect(child.invocables).toEqual(el.invocables)

    const sent: [string, readonly { id: string; kind: string }[] | undefined][] = []
    el.onSubmit((text, references) => sent.push([text, references]))
    // Type a token, commit it from the composer's own typeahead, then send — the composer's grammar itself
    // is conversation-composer.test.ts's job; what this proves is the SEAM (pass-through + widened callback).
    const editor = child.querySelector('[data-part="editor"]') as HTMLElement
    editor.textContent = 'total it @men'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(child.querySelectorAll('[data-part="reference-chip"]').length, 'the commit landed in the composer').toBe(1)
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(sent).toEqual([['total it', [{ id: 'res-menu', label: 'Menu PDF', kind: 'resource' }]]])
    // The user bubble's BODY is the typed text (SPEC-R4's clause, unchanged) — and since GH #891/SPEC-R10 the
    // attachment record rides the bubble as display-only tags, because the composer's chips clear on send.
    const bubble = log(el).querySelector('[data-part="bubble"][data-role="user"]') as HTMLElement
    expect(bubble.querySelector('[data-part="body"]')!.textContent).toBe('total it')
    expect([...bubble.querySelectorAll('[data-part="reference-tag-label"]')].map((n) => n.textContent)).toEqual(['Menu PDF'])
  })

  it('capabilities forward straight through, and a flip fires ui-conversation\'s OWN onCapabilityToggle (GH #891/SPEC-R11)', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    // The default-off law first: nothing set ⇒ the composed child has no trigger and no panel at all.
    await whenFlushed()
    expect(composer(el).querySelector('[data-picker="capabilities"]')).toBeNull()
    expect(composer(el).querySelector('[data-part="capabilities-panel"]')).toBeNull()

    el.capabilities = [
      { id: 'skill:style', label: 'House style', kind: 'skill', icon: 'star', included: true },
      { id: 'tool:svc:calc:*', label: 'Calculator', kind: 'tool', included: false },
    ]
    await whenFlushed()
    const child = composer(el)
    expect(child.capabilities).toEqual(el.capabilities)

    const toggles: [string, boolean][] = []
    el.onCapabilityToggle((id, included) => toggles.push([id, included]))
    ;(child.querySelector('[data-picker="capabilities"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    await whenFlushed()
    const switches = [...child.querySelectorAll<HTMLElement>('[data-part="capability-switch"]')]
    switches[1]!.dispatchEvent(new Event('click', { bubbles: true })) // the OFF row on
    switches[0]!.dispatchEvent(new Event('click', { bubbles: true })) // the ON row off, same visit
    // The row id (a `{kind}:{id}` pair the consumer minted, colons and all) rides back VERBATIM — this
    // element never parses it — and nothing mutated locally: the prop is still the array handed down.
    expect(toggles).toEqual([['tool:svc:calc:*', true], ['skill:style', false]])
    expect(child.capabilities).toEqual(el.capabilities)
  })

  it('committing a Provider/Mode picker choice in the composed child fires ui-conversation\'s OWN onProviderChange/onModeChange (GH #257)', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.providers = [
      { id: 'a', label: 'A', defaultModel: 'm1', models: [{ id: 'm1', label: 'M1' }] },
      { id: 'b', label: 'B', defaultModel: 'm2', models: [{ id: 'm2', label: 'M2' }] },
    ]
    el.provider = 'a'
    el.modes = [{ id: 'default', label: 'Default' }, { id: 'blue-sky', label: 'Blue-sky' }]
    el.mode = 'default'
    await whenFlushed()
    const providerIds: string[] = []
    const modeIds: string[] = []
    el.onProviderChange((id) => providerIds.push(id))
    el.onModeChange((id) => modeIds.push(id))
    ;(el.querySelector('[data-part="providers-menu"] [data-value="b"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    ;(el.querySelector('[data-part="mode-menu"] [data-value="blue-sky"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(providerIds).toEqual(['b'])
    expect(modeIds).toEqual(['blue-sky'])
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

describe('ui-conversation — GH #1030/SPEC-R16: client-side capability auto-attach', () => {
  function send(el: UIConversationElement, text: string): void {
    const editor = composer(el).querySelector('[data-part="editor"]') as HTMLElement
    editor.textContent = text
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  }
  const tagsOf = (el: UIConversationElement): string[] =>
    [...log(el).querySelectorAll('[data-part="reference-tag-label"]')].map((n) => n.textContent ?? '')

  it('AC1: an exact label hit auto-attaches — resolved exactly like a committed chip, and rendered as the SAME bubble tag', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.mentionables = [{ id: 'texas-hold-em', label: "Texas Hold'em", kind: 'resource' }]
    await whenFlushed()
    const sent: [string, readonly { id: string; label: string; kind: string }[] | undefined][] = []
    el.onSubmit((text, references) => sent.push([text, references]))
    send(el, "lets play texas hold'em")
    expect(sent).toEqual([["lets play texas hold'em", [{ id: 'texas-hold-em', label: "Texas Hold'em", kind: 'resource' }]]])
    expect(tagsOf(el)).toEqual(["Texas Hold'em"])
  })

  it('AC1: the normalized match holds across label/text punctuation differences (hyphen vs space vs apostrophe)', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.invocables = [{ id: 'x', label: 'texas-holdem', kind: 'skill' }]
    await whenFlushed()
    const sent: unknown[] = []
    el.onSubmit((_text, references) => sent.push(references))
    send(el, "Let's deal some Texas Hold'em")
    expect(sent).toEqual([[{ id: 'x', label: 'texas-holdem', kind: 'skill' }]])
  })

  it('AC2: a bare word shared with the label, or text drawn from the DESCRIPTION, never attaches', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.mentionables = [{ id: 'texas-hold-em', label: "Texas Hold'em", kind: 'resource', description: 'The full rulebook' }]
    await whenFlushed()
    const sent: unknown[] = []
    el.onSubmit((_text, references) => sent.push(references))
    send(el, 'texas is a big state') // shares the WORD "texas", never the full label
    send(el, 'load the full rulebook please') // matches the DESCRIPTION, never the label
    expect(sent).toEqual([[], []]) // the composer's own stable EMPTY_REFERENCES — no explicit chip, no auto-attach
    expect(tagsOf(el)).toEqual([])
  })

  it('AC3: a DISABLED entry (absent from the reachable roster) never attaches even on an exact text hit', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.mentionables = [] // the roster IS the reachability gate — a disabled/master-off entry is never listed
    await whenFlushed()
    const sent: unknown[] = []
    el.onSubmit((_text, references) => sent.push(references))
    send(el, "lets play texas hold'em")
    expect(sent).toEqual([[]])
  })

  it('AC4: two exact hits in one message — only the FIRST (by text order) auto-attaches', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.mentionables = [
      { id: 'menu', label: 'Menu PDF', kind: 'resource' },
      { id: 'wine', label: 'Wine list', kind: 'resource' },
    ]
    await whenFlushed()
    const sent: [string, readonly { id: string }[] | undefined][] = []
    el.onSubmit((text, references) => sent.push([text, references]))
    send(el, 'bring the Wine list after the Menu PDF')
    expect(sent[0]![1]?.map((r) => r.id)).toEqual(['wine'])
  })

  // code-checker MAJOR (f06ff414 review) — a SAME-START tie (one label a word-prefix of another's) must
  // prefer the LONGER, more specific label — a naive first-wins rule would silently attach the shorter one.
  it('a same-start tie between a label and a longer label it PREFIXES resolves to the longer, more specific one', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.mentionables = [
      { id: 'wine', label: 'Wine', kind: 'resource' },
      { id: 'wine-list', label: 'Wine list', kind: 'resource' },
    ]
    await whenFlushed()
    const sent: [string, readonly { id: string }[] | undefined][] = []
    el.onSubmit((text, references) => sent.push([text, references]))
    send(el, 'bring the wine list please')
    expect(sent[0]![1]?.map((r) => r.id), 'the longer label wins the tie, never the shorter prefix').toEqual(['wine-list'])
  })

  it('AC5: an entry the user ALSO explicitly committed as a chip is never duplicated', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.mentionables = [{ id: 'menu', label: 'Menu PDF', kind: 'resource' }]
    await whenFlushed()
    const sent: [string, readonly { id: string }[] | undefined][] = []
    el.onSubmit((text, references) => sent.push([text, references]))
    const editor = composer(el).querySelector('[data-part="editor"]') as HTMLElement
    editor.textContent = '@Menu'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })) // commits the chip
    editor.textContent += 'bring the Menu PDF please'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })) // sends
    expect(sent[0]![1]?.map((r) => r.id)).toEqual(['menu']) // one reference, not two
  })

  it('an empty/unset roster (every consumer but ui-agent-admin today) matches nothing, ever — the gated-equivalence law', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const sent: unknown[] = []
    el.onSubmit((_text, references) => sent.push(references))
    send(el, "lets play texas hold'em anyway")
    expect(sent).toEqual([[]])
  })

  // code-checker MINOR (f06ff414 review) — a non-ASCII LETTER is content, never punctuation: squash must
  // not silently delete it the way an `[a-z0-9]`-only class would.
  it('a non-ASCII label letter survives the squash — matched by its real spelling, never by the letter-stripped remainder', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.mentionables = [{ id: 'uber-doc', label: 'Über', kind: 'resource' }]
    await whenFlushed()
    const sent: unknown[] = []
    el.onSubmit((_text, references) => sent.push(references))
    send(el, 'ber is not the label') // the ASCII-stripped remainder — must NOT match
    send(el, 'read Über please') // the real, accented spelling — MUST match
    expect(sent[0], 'the stripped remainder is not the real label').toEqual([])
    expect((sent[1] as readonly { id: string }[]).map((r) => r.id)).toEqual(['uber-doc'])
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

// GH #666 — the empty-log seam. It exists so a consumer's "nothing here yet" state can live INSIDE this
// element's card (border, log, bottom-pinned composer) instead of being a differently-shaped box beside it
// — agent-admin's unarmed Author column is the first consumer, and Kim's 2026-08-10 pixel ruling is why.
describe('ui-conversation — setEmptyState (GH #666)', () => {
  const empty = (): HTMLElement => {
    const node = document.createElement('div')
    node.dataset.part = 'my-empty'
    node.textContent = 'nothing here yet'
    return node
  }

  it('seats the node FIRST in the log, so real turns read below it', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.setEmptyState(empty())
    el.addUserMessage('hello')
    expect([...log(el).children].map((c) => c.getAttribute('data-part'))).toEqual(['my-empty', 'turn'])
  })

  it('a pre-connect call is honored at connect (the setContentRenderer two-sided shape)', () => {
    const el = document.createElement('ui-conversation') as UIConversationElement
    el.setEmptyState(empty())
    mount(el)
    expect(log(el).querySelector('[data-part="my-empty"]'), 'the node is seated by connected()').not.toBeNull()
  })

  it('reset() KEEPS it — a reset conversation is empty again', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const node = empty()
    el.setEmptyState(node)
    el.addUserMessage('hello')
    el.reset()
    expect([...log(el).children]).toEqual([node])
  })

  it('null removes it, and re-seating the SAME node is a no-op rather than a move', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const node = empty()
    el.setEmptyState(node)
    el.addUserMessage('hello')
    el.setEmptyState(node) // idempotent — the consumer may reflect its state unconditionally
    expect([...log(el).children].map((c) => c.getAttribute('data-part'))).toEqual(['my-empty', 'turn'])
    el.setEmptyState(null)
    expect(log(el).querySelector('[data-part="my-empty"]')).toBeNull()
    el.reset()
    expect(log(el).children.length, 'and a later reset does not resurrect it').toBe(0)
  })

  it('unset (the default) leaves reset() byte-identical for every pre-#666 consumer', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.addUserMessage('hello')
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

// ── ADR-0180 (GH #688) — the declarative composition adoption seam ─────────────────────────────────────

describe('ui-conversation — ADR-0180 declarative composition: the default (no children) path', () => {
  it("LLD test 1's own deliberate delta: the log element is now a UI-CONVERSATION-DIALOG, not a bare div", () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    expect(log(el).tagName).toBe('UI-CONVERSATION-DIALOG')
  })
})

describe('ui-conversation — ADR-0180 declarative composition: all three children authored', () => {
  it('adopts each by IDENTITY (never a second imperative surface); header untouched and first in DOM order; forwarders fire', () => {
    const el = document.createElement('ui-conversation') as UIConversationElement
    const header = document.createElement('ui-conversation-header') as UIConversationHeaderElement
    header.textContent = 'Support Agent'
    const dialog = document.createElement('ui-conversation-dialog') as UIConversationDialogElement
    const composerEl = document.createElement('ui-conversation-composer') as UIConversationComposerElement
    el.append(header, dialog, composerEl)
    mount(el)

    expect(log(el)).toBe(dialog) // #log IS the authored dialog, by identity
    expect(composer(el)).toBe(composerEl)
    expect(el.firstElementChild).toBe(header) // the header is never touched beyond canonical ordering
    expect([...el.children]).toEqual([header, dialog, composerEl])

    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    composerEl.value = 'hello agent'
    ;(composerEl.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(received, 'the adopted composer\'s own forwarders never fired').toEqual(['hello agent'])
    expect(log(el).querySelector('[data-part="bubble"][data-role="user"] [data-part="body"]')?.textContent).toBe('hello agent')
  })
})

describe('ui-conversation — ADR-0180 declarative composition: partial authoring', () => {
  it('header-only → dialog+composer created after it, canonical order asserted', () => {
    const el = document.createElement('ui-conversation') as UIConversationElement
    const header = document.createElement('ui-conversation-header') as UIConversationHeaderElement
    el.append(header)
    mount(el)
    expect([...el.children].map((c) => c.tagName)).toEqual([
      'UI-CONVERSATION-HEADER', 'UI-CONVERSATION-DIALOG', 'UI-CONVERSATION-COMPOSER',
    ])
    expect(el.firstElementChild).toBe(header)
  })

  it('composer-only → no header ever created (absent means today\'s shape minus nothing), dialog created before it', () => {
    const el = document.createElement('ui-conversation') as UIConversationElement
    const composerEl = document.createElement('ui-conversation-composer') as UIConversationComposerElement
    el.append(composerEl)
    mount(el)
    expect([...el.children].map((c) => c.tagName)).toEqual(['UI-CONVERSATION-DIALOG', 'UI-CONVERSATION-COMPOSER'])
    expect(composer(el)).toBe(composerEl)
    expect(el.querySelector('ui-conversation-header')).toBeNull()
  })

  it('dialog-with-children: author-authored initial content is PRESERVED at adoption; turns append AFTER it; reset() clears it, the empty-state node the one survivor (GH #666 parity)', () => {
    const el = document.createElement('ui-conversation') as UIConversationElement
    const dialog = document.createElement('ui-conversation-dialog') as UIConversationDialogElement
    const initial = document.createElement('p')
    initial.dataset.part = 'my-initial'
    initial.textContent = 'welcome'
    dialog.append(initial)
    el.append(dialog)
    mount(el)

    expect(log(el)).toBe(dialog)
    expect(log(el).firstElementChild).toBe(initial)
    el.addUserMessage('hello')
    expect([...log(el).children].map((c) => c.getAttribute('data-part'))).toEqual(['my-initial', 'turn'])

    const empty = document.createElement('div')
    empty.dataset.part = 'my-empty'
    el.setEmptyState(empty)
    el.reset()
    // reset()'s own replaceChildren law (unchanged by ADR-0180) — the pre-existing authored content is
    // cleared exactly like a turn would be; the empty-state node is the one survivor.
    expect([...log(el).children]).toEqual([empty])
  })
})

describe('ui-conversation — ADR-0180 declarative composition: imperative identity both paths (LLD §7 test 4)', () => {
  it('the SAME script run against a no-children mount and an all-authored mount produces IDENTICAL resulting DOM shape and callback traces', () => {
    const run = (el: UIConversationElement): { shape: (string | null)[]; calls: unknown[] } => {
      const calls: unknown[] = []
      el.onSubmit((text) => calls.push(['submit', text]))
      el.onClientMessage((m) => calls.push(['client', m]))
      el.addEventListener('action', (e) => calls.push(['action', (e as CustomEvent<{ id: string }>).detail.id]))
      const child = composer(el)
      child.value = 'hi'
      ;(child.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
      const handle = el.beginAgentTurn()
      handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'sX', catalogId: 'agent-ui' } }))
      handle.setNote('done')
      handle.finalize([{ id: 'ok', label: 'OK' }])
      ;(el.querySelector('[data-part="actions"] ui-button') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
      el.reset()
      const shape = [...log(el).children].map((c) => c.getAttribute('data-part'))
      return { shape, calls }
    }

    const bare = mount(document.createElement('ui-conversation') as UIConversationElement)
    const bareResult = run(bare)

    const authored = document.createElement('ui-conversation') as UIConversationElement
    authored.append(
      document.createElement('ui-conversation-header'),
      document.createElement('ui-conversation-dialog'),
      document.createElement('ui-conversation-composer'),
    )
    mount(authored)
    const authoredResult = run(authored)

    expect(authoredResult.shape, 'the two paths produced a different resulting [data-part] tree').toEqual(bareResult.shape)
    expect(authoredResult.calls, 'the two paths produced different callback traces').toEqual(bareResult.calls)
    // anti-vacuous: the compared trace genuinely exercised all three callback kinds.
    //
    // ADR-0187 / GH #829 (LLD §7) — the `'client'` entry is the DESIGNED new behavior, not collateral.
    // The script's stream is a bare `createSurface` with no components, so `handle.finalize()` now runs
    // the shared validator at finalize granularity and emits `VALIDATION_FAILED` (`sX:root-missing`)
    // through `onClientMessage` — exactly the wire error the abandoned-surface fix exists to surface.
    // It fires IDENTICALLY on both mount paths, which is this test's actual subject; and it is what
    // finally makes the "all three callback kinds" claim above TRUE (before this, the trace held two).
    expect(bareResult.calls.map((c) => (c as unknown[])[0])).toEqual(['submit', 'client', 'action'])
    // …and the one client message IS the finalize verdict for the abandoned surface, not an unrelated emit.
    const clientEntry = bareResult.calls.find((c) => (c as unknown[])[0] === 'client') as [string, unknown]
    expect(JSON.stringify(clientEntry[1])).toContain('sX:root-missing')
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
  const ATTR_NAMES = [
    'disclosure', 'disabled', 'receipt', 'sources', 'models', 'model', 'efforts', 'effort',
    'providers', 'provider', 'modes', 'mode', 'contextItems', 'mentionables', 'invocables', 'capabilities',
  ]

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

// ── GH #238/ADR-0159 — the live/done label-pair table (Kim's 2026-07-23 receipt-pattern ruling, part 1) ──

describe('ui-conversation — done-form labels stamp on the settle transition (GH #238/ADR-0159)', () => {
  it('a progress stage settles to its DONE form as the next stage begins: "Validating…" → "Validated"', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    const narration = el.querySelector('[data-part="narration"]')!
    const labelOf = (key: string): string | null | undefined =>
      narration.querySelector(`[data-key="${key}"] [data-role="label"]`)?.textContent

    handle.progress({ stage: 'validating' })
    expect(labelOf('t1-progress-validating'), 'live form while running').toBe('Validating…')

    handle.progress({ stage: 'content' }) // the next stage begins — validating settles done
    await whenFlushed() // the item's label re-stamp rides its reactive effect
    expect(labelOf('t1-progress-validating'), 'the done checkmark never wears an "-ing…" label').toBe('Validated')
    expect(labelOf('t1-progress-content'), 'the new current stage wears its live form').toBe('Writing the response…')

    handle.progress({ stage: 'done' }) // the settle signal — the last stage checks off in its done form
    await whenFlushed()
    expect(labelOf('t1-progress-content')).toBe('Wrote the response')
  })

  it('the factual retry/tool suffix rides BOTH forms of the pair: "Self-correcting… (round 2)" settles to "Self-corrected (round 2)"', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    const narration = el.querySelector('[data-part="narration"]')!
    const labelOf = (key: string): string | null | undefined =>
      narration.querySelector(`[data-key="${key}"] [data-role="label"]`)?.textContent

    handle.progress({ stage: 'retry', round: 2 })
    expect(labelOf('t1-progress-retry-2')).toBe('Self-correcting… (round 2)')
    handle.progress({ stage: 'tool', detail: 'fetch' })
    await whenFlushed() // the settle's label re-stamp rides the item's reactive effect
    expect(labelOf('t1-progress-retry-2'), 'the composed ordinal survives the settle').toBe('Self-corrected (round 2)')
    expect(labelOf('t1-progress-tool-fetch')).toBe('Running an integration… (fetch)')
    handle.finalize()
    await whenFlushed()
    expect(labelOf('t1-progress-tool-fetch'), 'finalize settles the current stage with its done form').toBe('Ran an integration (fetch)')
  })

  it('category entries settle to their done forms at finalize(): "Opening a new surface…" → "Opened a new surface"', async () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    const narration = el.querySelector('[data-part="narration"]')!
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }))
    handle.ingestLine(
      line({ version: 'v1.0', updateDataModel: { surfaceId: 's1', changes: [{ path: '/x', value: 1 }] } }),
    )
    const labels = (): (string | null)[] =>
      [...narration.querySelectorAll('ui-timeline-item [data-role="label"]')].map((n) => n.textContent)
    expect(labels()).toEqual(['Opening a new surface…', 'Updating data…'])
    handle.finalize()
    await whenFlushed() // the settle's label re-stamps ride the items' reactive effects
    expect(labels(), 'quiet past-tense on the settled checkmarks').toEqual(['Opened a new surface', 'Updated data'])
  })

  it('a truncated (never-finished) entry KEEPS its live form under fail() — the done form is never claimed for work not completed', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    const narration = el.querySelector('[data-part="narration"]')!
    handle.progress({ stage: 'validating' })
    handle.fail('boom')
    const label = narration.querySelector('[data-key="t1-progress-validating"] [data-role="label"]')?.textContent
    expect(label, 'the in-flight stage truncates with its progressive label intact').toBe('Validating…')
  })
})

// ── GH #239/ADR-0159 — the opt-in receipt pass-through (conversation → each turn's narration strip) ──────

describe('ui-conversation — the receipt prop opts each narration strip into the receipt pattern (GH #239/ADR-0159)', () => {
  it('receipt=true stamps oneline + receipt onto every turn\'s ui-status-stream (fresh AND resumed paths use the one creation site)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.receipt = true
    el.beginAgentTurn()
    const narration = el.querySelector('[data-part="narration"]')!
    expect(narration.hasAttribute('oneline'), 'the live one-morphing-line mode').toBe(true)
    expect(narration.hasAttribute('receipt'), 'the terminal one-line receipt').toBe(true)
    expect(narration.hasAttribute('header'), 'the ADR-0146 F8 header opt-in is unchanged').toBe(true)
  })

  it('default (receipt absent) keeps the narration strip byte-identical — neither opt-in attribute appears', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.beginAgentTurn()
    const narration = el.querySelector('[data-part="narration"]')!
    expect(narration.hasAttribute('oneline')).toBe(false)
    expect(narration.hasAttribute('receipt')).toBe(false)
    expect(narration.hasAttribute('header'), 'the pre-existing header opt-in still ships unconditionally').toBe(true)
  })
})

// ── GH #240/ADR-0159 wave B — the opt-in per-step SOURCE reveal (conversation's consumer gate) ──────────

describe("ui-conversation — the sources prop attaches each step's raw wire line(s) (GH #240/ADR-0159 wave B)", () => {
  const CREATE = line({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } })
  const DATA_1 = line({ version: 'v1.0', updateDataModel: { surfaceId: 's1', changes: [{ path: '/x', value: 1 }] } })
  const DATA_2 = line({ version: 'v1.0', updateDataModel: { surfaceId: 's1', changes: [{ path: '/x', value: 2 }] } })
  const preOf = (narration: Element, key: string): HTMLElement | null =>
    narration.querySelector(`[data-key="${key}"] [data-role="source"]`)

  it('a category entry is BORN with its wire line, and later lines of the same category accumulate (byte compare)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.sources = true
    const handle = el.beginAgentTurn()
    const narration = el.querySelector('[data-part="narration"]')!
    handle.ingestLine(CREATE)
    expect(preOf(narration, 't1-open')?.textContent, '"Opening a new surface" reveals its OWN createSurface JSONL').toBe(CREATE)
    handle.ingestLine(DATA_1)
    handle.ingestLine(DATA_2)
    expect(preOf(narration, 't1-react')?.textContent, 'every updateDataModel line of the turn, newline-joined').toBe(
      `${DATA_1}\n${DATA_2}`,
    )
    // and the reveal survives finalize (the settled trace keeps its sources)
    handle.finalize()
    expect(preOf(narration, 't1-open')?.textContent).toBe(CREATE)
  })

  it('a producer-attached progress source passes through to the stage entry (byte compare)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    el.sources = true
    const handle = el.beginAgentTurn()
    const narration = el.querySelector('[data-part="narration"]')!
    handle.progress({ stage: 'validating', source: CREATE })
    expect(preOf(narration, 't1-progress-validating')?.textContent, "the wire's own attachment, verbatim").toBe(CREATE)
  })

  it('DEFAULT (sources absent): the SAME turn renders NO reveal anywhere — byte-identical narration (the negative control)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    const narration = el.querySelector('[data-part="narration"]')!
    handle.ingestLine(CREATE)
    handle.ingestLine(DATA_1)
    handle.progress({ stage: 'validating', source: CREATE }) // even a source-CARRYING stream (the belt to the producer gate)
    handle.finalize()
    expect(narration.querySelector('[data-role="source"]'), 'no source pre, ever').toBeNull()
    expect(narration.querySelector('ui-timeline-item [data-part="detail"]'), 'no reveal disclosure composed at all').toBeNull()
  })

  it('the gate samples ONCE per turn — flipping sources mid-turn never mixes postures within one strip', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn() // sampled: off
    el.sources = true // flips AFTER the turn began
    const narration = el.querySelector('[data-part="narration"]')!
    handle.ingestLine(CREATE)
    expect(narration.querySelector('[data-role="source"]'), 'the in-flight turn keeps its sampled (off) posture').toBeNull()
    // the NEXT turn picks the new posture up
    handle.finalize()
    const t2 = el.beginAgentTurn()
    t2.ingestLine(CREATE)
    const strips = el.querySelectorAll('[data-part="narration"]')
    expect(strips[strips.length - 1]!.querySelector('[data-role="source"]')?.textContent).toBe(CREATE)
  })
})

// ── ADR-0199 / GH #1104 — the turn handle drives ui-surface-host.working (set on route, cleared at
// the single guarded endTurn — finalize() AND fail() both clear; a dead turn never leaves a card
// breathing). The prop→:state(working) mirror itself is surface-host.test.ts's; here only the WIRING.

describe('ui-conversation — ADR-0199: working set/cleared by the turn handle', () => {
  const CREATE_S = (id: string) => line({ version: 'v1.0', createSurface: { surfaceId: id, catalogId: 'agent-ui' } })
  const UPDATE_S = (id: string, text: string) =>
    line({
      version: 'v1.0',
      updateComponents: { surfaceId: id, components: [{ id: 'root', component: 'Text', text }] },
    })

  it('a fresh surface is working from its first line; finalize() clears it', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t = el.beginAgentTurn()
    t.ingestLine(CREATE_S('w1'))
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    expect(host.working, 'working mid-turn').toBe(true)
    t.finalize()
    expect(host.working, 'cleared at finalize').toBe(false)
  })

  it('the motivating case — an in-place update to a KNOWN surface sets working on the ORIGINAL host; finalize clears it', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.ingestLine(CREATE_S('game'))
    t1.finalize()
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    expect(host.working, 'settled between turns').toBe(false)
    const t2 = el.beginAgentTurn()
    t2.ingestLine(UPDATE_S('game', 'flop'))
    expect(host.working, 'the in-place mutation window breathes').toBe(true)
    t2.finalize()
    expect(host.working, 'cleared when the turn completes').toBe(false)
  })

  it('fail() clears working identically — a dead turn never leaves a card breathing', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.ingestLine(CREATE_S('doomed'))
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    expect(host.working).toBe(true)
    t1.fail('transport died')
    expect(host.working, 'cleared at fail').toBe(false)
  })

  it('a stray double-end (finalize then fail) never wedges the state (the endTurn guard)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.ingestLine(CREATE_S('dbl'))
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    t1.finalize()
    t1.fail('late duplicate') // never legal, must be inert (TKT-0034's ONE-endTurn guard)
    expect(host.working).toBe(false)
    // and the NEXT turn's known-id route sets it live again — nothing wedged.
    const t2 = el.beginAgentTurn()
    t2.ingestLine(UPDATE_S('dbl', 'again'))
    expect(host.working).toBe(true)
    t2.finalize()
    expect(host.working).toBe(false)
  })

  it('a surface closed mid-turn (deleteSurface) stops breathing immediately, not at endTurn', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.ingestLine(CREATE_S('gone'))
    t1.finalize()
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    const t2 = el.beginAgentTurn()
    t2.ingestLine(UPDATE_S('gone', 'last words'))
    expect(host.working).toBe(true)
    t2.ingestLine(line({ version: 'v1.0', deleteSurface: { surfaceId: 'gone' } }))
    expect(host.working, '#closeSurface clears working — a torn-down card must not breathe').toBe(false)
    t2.finalize() // endTurn's open-only walk skips the closed record; no throw, no resurrect
    expect(host.working).toBe(false)
  })

  // ── GH #1104 S5 repair — the REAL test-chat window. The live transport is VALIDATE-THEN-STREAM:
  // content lines land in one burst microseconds before finalize(), so a set-on-first-line wiring
  // gives a ~0 ms breathing window. A resumed turn (intoSurface — the poker action click) must set
  // `working` the moment beginAgentTurn() runs, BEFORE any line arrives — the whole "Writing the
  // response…" wait — and endTurn (finalize AND fail) must clear it even if the turn routed no line.

  it('S5: a resumed turn (intoSurface) breathes from beginAgentTurn — before ANY line arrives — and finalize clears it', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.ingestLine(CREATE_S('poker'))
    t1.finalize()
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    expect(host.working, 'settled between turns').toBe(false)
    const t2 = el.beginAgentTurn({ intoSurface: 'poker', disabledSurfaceId: 'poker' })
    expect(host.working, 'breathing the moment the turn begins — zero lines ingested yet').toBe(true)
    t2.ingestLine(UPDATE_S('poker', 'flop')) // the burst arriving at the end changes nothing
    expect(host.working).toBe(true)
    t2.finalize()
    expect(host.working, 'cleared at finalize').toBe(false)
  })

  it('S5: a resumed turn that routes NO line still clears at fail() — turn-start set rides touchedIds', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.ingestLine(CREATE_S('poker2'))
    t1.finalize()
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    const t2 = el.beginAgentTurn({ intoSurface: 'poker2' })
    expect(host.working).toBe(true)
    t2.fail('transport died mid-wait')
    expect(host.working, 'a dead turn never leaves the card breathing').toBe(false)
  })

  it('S5: an ask-answer turn (disabledSurfaceId only, intoSurface undefined) sets NOTHING at start — the answered card is not being mutated', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.ingestLine(CREATE_S('ask1'))
    t1.finalize()
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    const t2 = el.beginAgentTurn({ disabledSurfaceId: 'ask1' })
    expect(host.working, 'no breathe on the answered card').toBe(false)
    t2.finalize()
    expect(host.working).toBe(false)
  })

  // ── GH #1134 — typed-intent heuristic: a turn with NEITHER intoSurface NOR disabledSurfaceId
  // (the user typed into the composer) breathes the SOLE open surface from turn start; zero or
  // 2+ open surfaces → no heuristic (the ruled boundary — wrong-guess risk in multi-surface
  // chats explicitly out of scope). Cleared by the same guarded endTurn (finalize AND fail).

  it('GH #1134: a typed turn with exactly ONE open surface breathes it from beginAgentTurn — zero lines ingested', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.ingestLine(CREATE_S('solo'))
    t1.finalize()
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    expect(host.working, 'settled between turns').toBe(false)
    const t2 = el.beginAgentTurn() // typed intent — no intoSurface, no disabledSurfaceId
    expect(host.working, 'the sole open surface breathes the moment the typed turn begins').toBe(true)
    t2.finalize()
    expect(host.working, 'cleared at finalize').toBe(false)
  })

  it('GH #1134: the optimistic set rides touchedIds — a typed turn routing NO line still clears at fail()', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.ingestLine(CREATE_S('solo2'))
    t1.finalize()
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    const t2 = el.beginAgentTurn()
    expect(host.working).toBe(true)
    t2.fail('transport died mid-wait')
    expect(host.working, 'a dead typed turn never leaves the card breathing').toBe(false)
  })

  it('GH #1134 negative control: TWO open surfaces — the heuristic does not fire; both stay settled until the line burst', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t1 = el.beginAgentTurn()
    t1.ingestLine(CREATE_S('a'))
    t1.ingestLine(CREATE_S('b'))
    t1.finalize()
    const hosts = Array.from(log(el).querySelectorAll('ui-surface-host')) as UISurfaceHostElement[]
    expect(hosts.length).toBe(2)
    const t2 = el.beginAgentTurn() // typed intent, ambiguous target — the ruled boundary
    expect(hosts[0]!.working, 'no optimistic guess in a multi-surface chat').toBe(false)
    expect(hosts[1]!.working, 'no optimistic guess in a multi-surface chat').toBe(false)
    t2.ingestLine(UPDATE_S('b', 'the burst names the target'))
    expect(hosts[0]!.working, 'untargeted card stays settled').toBe(false)
    expect(hosts[1]!.working, 'line-burst breathing unchanged').toBe(true)
    t2.finalize()
    expect(hosts[1]!.working).toBe(false)
  })

  it('GH #1134 negative control: ZERO open surfaces — a typed turn sets nothing; a fresh mount still breathes from its first line', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t = el.beginAgentTurn() // no surface exists yet
    t.ingestLine(CREATE_S('first'))
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    expect(host.working, 'fresh-mount breathing unchanged').toBe(true)
    t.finalize()
    expect(host.working).toBe(false)
  })

  it('S5: an intoSurface naming no open record is inert (fresh-bubble routing untouched)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const t = el.beginAgentTurn({ intoSurface: 'never-created' })
    t.ingestLine(CREATE_S('fresh'))
    const host = log(el).querySelector('ui-surface-host') as UISurfaceHostElement
    expect(host.working, 'the fresh mount still breathes from its first line').toBe(true)
    t.finalize()
    expect(host.working).toBe(false)
  })
})
