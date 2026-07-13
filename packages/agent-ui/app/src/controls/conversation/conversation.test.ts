import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { UIConversationElement } from './conversation.ts'
import type { UISurfaceHostElement } from '../surface-host/surface-host.ts'
import '@agent-ui/components/components' // self-registers ui-button/ui-text-field/ui-status-stream/ui-timeline-item
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
// setValidity; the prototype is stubbed for this file's duration so the REAL composed ui-text-field this
// element's composer connects can connect at all.
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

describe('ui-conversation — onSubmit (SPEC-R5)', () => {
  it('fires exactly once with the trimmed text; the composer clears', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    const field = el.querySelector('[data-part="field"]') as HTMLElement & { value: string }
    const form = el.querySelector('[data-part="composer"]') as HTMLFormElement
    field.value = '  hello agent  '
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(received).toEqual(['hello agent'])
    expect(field.value).toBe('')
  })

  it('an empty/whitespace-only submit is a no-op — the callback never fires', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    const form = el.querySelector('[data-part="composer"]') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(received).toEqual([])
  })

  it('no registered onSubmit never throws on submit (a no-op consumer is legal, SPEC-R5 AC2)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const field = el.querySelector('[data-part="field"]') as HTMLElement & { value: string }
    const form = el.querySelector('[data-part="composer"]') as HTMLFormElement
    field.value = 'hi'
    expect(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))).not.toThrow()
  })
})

describe('ui-conversation — busy/re-entrancy guard (TKT-0034)', () => {
  it('a re-entrant send while a turn is in flight is a no-op (text RETAINED, no orphan bubble, no 2nd callback); send works again once finalize() runs', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    const field = el.querySelector('[data-part="field"]') as HTMLElement & { value: string; disabled: boolean }
    const sendBtn = el.querySelector('[data-part="send"]') as HTMLElement & { disabled: boolean }
    const composer = el.querySelector('[data-part="composer"]') as HTMLFormElement

    // idle (no turn yet): the composer carries none of the busy affordance
    expect(composer.hasAttribute('data-busy')).toBe(false)
    expect(composer.getAttribute('aria-busy')).toBeNull()
    expect(composer.getAttribute('aria-disabled')).toBeNull()
    expect(field.disabled).toBe(false)
    expect(sendBtn.disabled).toBe(false)

    // the FIRST send (no turn in flight yet) fires normally, same as the plain onSubmit suite above.
    field.value = 'first message'
    composer.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(received).toEqual(['first message'])
    expect(field.value).toBe('')

    // begin an agent turn — an un-finalized handle IS the in-flight state (SPEC-R8: the app's own turn loop
    // drives this; a busy-guarded onSubmit consumer, the normal pattern, would begin one here too).
    const handle = el.beginAgentTurn()

    // the composer now reflects busy — auto-tracked, zero consumer wiring.
    expect(composer.hasAttribute('data-busy')).toBe(true)
    expect(composer.getAttribute('aria-busy')).toBe('true')
    expect(composer.getAttribute('aria-disabled')).toBe('true')
    expect(field.disabled).toBe(true)
    expect(sendBtn.disabled).toBe(true)

    // THE REGRESSION (ticket repro): a re-entrant send mid-turn. Before the fix this appended an orphan user
    // bubble, cleared the field, and fired a 2nd onSubmit — silently discarding the typed text.
    field.value = 'second message'
    composer.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(received, 'a 2nd onSubmit fired during an in-flight turn').toEqual(['first message'])
    expect(field.value, 'the typed text was NOT retained across a re-entrant send').toBe('second message')
    expect(
      log(el).querySelectorAll('[data-part="bubble"][data-role="user"]'),
      'a re-entrant send minted an orphan user bubble',
    ).toHaveLength(1)

    // finalize() ends the in-flight window — the composer re-enables THE MOMENT it runs.
    handle.finalize()
    expect(composer.hasAttribute('data-busy')).toBe(false)
    expect(composer.getAttribute('aria-busy')).toBeNull()
    expect(composer.getAttribute('aria-disabled')).toBeNull()
    expect(field.disabled).toBe(false)
    expect(sendBtn.disabled).toBe(false)

    // send works again: the RETAINED text from the blocked attempt is what actually goes out.
    composer.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(received).toEqual(['first message', 'second message'])
    expect(field.value).toBe('')
    expect(log(el).querySelectorAll('[data-part="bubble"][data-role="user"]')).toHaveLength(2)
  })

  it('fail() also ends the in-flight window (not only finalize()) and re-enables the composer', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const field = el.querySelector('[data-part="field"]') as HTMLElement & { disabled: boolean }
    const composer = el.querySelector('[data-part="composer"]') as HTMLFormElement

    const handle = el.beginAgentTurn()
    expect(field.disabled).toBe(true)
    handle.fail('network error')
    expect(field.disabled).toBe(false)
    expect(composer.hasAttribute('data-busy')).toBe(false)
    expect(composer.getAttribute('aria-busy')).toBeNull()
  })

  it('two overlapping turns keep the composer busy until BOTH end (the in-flight count, not a bare flag)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const field = el.querySelector('[data-part="field"]') as HTMLElement & { disabled: boolean }

    const t1 = el.beginAgentTurn()
    const t2 = el.beginAgentTurn()
    expect(field.disabled).toBe(true)

    t1.finalize()
    expect(field.disabled, 't1 ended but t2 is still in flight — the composer must stay busy').toBe(true)

    t2.finalize()
    expect(field.disabled).toBe(false)
  })

  it('reset() mid-turn zeroes the in-flight count and re-enables the composer (an abandoned handle must not stick it disabled)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const field = el.querySelector('[data-part="field"]') as HTMLElement & { disabled: boolean }
    const composer = el.querySelector('[data-part="composer"]') as HTMLFormElement

    el.beginAgentTurn() // never finalize()d/fail()d — the handle is abandoned
    expect(field.disabled).toBe(true)

    el.reset()
    expect(field.disabled, 'reset() must clear the busy state even for an abandoned in-flight handle').toBe(false)
    expect(composer.hasAttribute('data-busy')).toBe(false)

    // and a fresh beginAgentTurn()/finalize() cycle behaves normally afterward (the count is truly zeroed,
    // not left at some stale negative/positive value a Math.max(0,…) floor would otherwise mask).
    const handle = el.beginAgentTurn()
    expect(field.disabled).toBe(true)
    handle.finalize()
    expect(field.disabled).toBe(false)
  })
})

describe('ui-conversation — narration (SPEC-R6)', () => {
  it('two distinct categories transition pending -> active -> done, in emission order, deduplicated', async () => {
    vi.useFakeTimers()
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's3', catalogId: 'agent-ui' } }))
    handle.ingestLine(
      line({ version: 'v1.0', updateComponents: { surfaceId: 's3', components: [{ id: 'root', component: 'Column', children: [] }] } }),
    )
    handle.finalize()

    const narration = el.querySelector('[data-part="narration"]')!
    const items = () => [...narration.querySelectorAll('ui-timeline-item')] as (HTMLElement & { status: string })[]
    // narrateCategories paces ONE category at a time (a genuine sequential pending->active->done per
    // category, promoted unchanged from a2ui-chat.ts) — the second entry does not exist until the first
    // has fully settled.
    expect(items()).toHaveLength(1) // 'open' only, so far
    expect(items()[0].status).toBe('pending')

    await vi.advanceTimersByTimeAsync(60)
    expect(items()[0].status).toBe('active')
    await vi.advanceTimersByTimeAsync(60)
    expect(items()[0].status).toBe('done')
    expect(items()).toHaveLength(2) // 'restructure' now appended, in emission order
    expect(items()[1].status).toBe('pending')

    await vi.advanceTimersByTimeAsync(60)
    expect(items()[1].status).toBe('active')
    await vi.advanceTimersByTimeAsync(60)
    expect(items()[1].status).toBe('done')
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

  it('fail() truncates narration with an error entry, adds a system bubble, and settles touched hosts (SPEC-R6 AC3)', () => {
    const el = mount(document.createElement('ui-conversation') as UIConversationElement)
    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 's6', catalogId: 'agent-ui' } }))
    expect(() => handle.fail('network error')).not.toThrow()

    const narration = el.querySelector('[data-part="narration"]')!
    const errorItem = narration.querySelector('ui-timeline-item[status="error"]')
    expect(errorItem).not.toBeNull()
    expect(errorItem!.textContent).toMatch(/network error/)

    const system = el.querySelector('[data-part="bubble"][data-role="system"] [data-part="body"]') as HTMLElement
    expect(system.textContent).toMatch(/network error/)
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
  const ATTR_NAMES = ['disclosure']

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
