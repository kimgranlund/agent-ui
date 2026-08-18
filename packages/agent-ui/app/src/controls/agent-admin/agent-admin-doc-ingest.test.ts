// agent-admin-doc-ingest.test.ts — GH #1211's composer→entry ingest path, end-to-end through the real
// `ui-agent-admin` component (the `agent-admin-local-patterns.test.ts` shape, reused): the Test-chat
// composer's attach button/drop/paste hand raw `File`s up (conversation-composer.ts, store-blind by
// construction — TKT-0056/GH #849/#891); this element validates, extracts, and mints a `resource` Entry
// (ADR-0132), reflecting a context chip while the attachment is in-flight/attached. jsdom cannot drive a
// real drop/paste (conversation-composer.browser.test.ts's own GH #1211 block covers those two entry
// gestures); this file drives the SAME `#handleAttach` path through the hidden file input's `change`
// event instead (the composer's own jsdom test proves that gesture reaches `onAttach` identically).

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIAgentAdminElement } from './agent-admin.ts'
import { ENTRY_KINDS } from './entries.ts'
import { entriesStoreKey, readEntries, type Entry } from '../entry-list/entry-data.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import { MAX_AGENT_KNOWLEDGE_CHARS } from './document-ingest.ts'

// The jsdom ElementInternals stub (agent-admin.test.ts verbatim) — the real component mounts real FACE
// form controls (ui-switch/ui-text-field/ui-slider) that call setFormValue/setValidity on connect.
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

// The Popover API stub (toast-region.test.ts verbatim) — jsdom carries no `showPopover`/`hidePopover` at
// all, and the rejection-toast leg below mounts a real `ui-toast-region`, which calls both unconditionally
// the moment it gains a child. The REAL top-layer truth stays toast-region.browser.test.ts's job.
const popoverOpen = new WeakMap<HTMLElement, boolean>()
beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void }
  if (typeof proto.showPopover === 'function') return // a real engine — leave the platform alone
  proto.showPopover = function (this: HTMLElement): void {
    popoverOpen.set(this, true)
  }
  proto.hidePopover = function (this: HTMLElement): void {
    if (!popoverOpen.get(this)) throw new Error('InvalidStateError: not currently showing')
    popoverOpen.set(this, false)
  }
})

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

function mount(el: UIAgentAdminElement): UIAgentAdminElement {
  el.store = createMemoryStore({})
  document.body.append(el)
  mounted.push(el)
  return el
}

/** Simulate the picker-button gesture on the Test-chat composer's own hidden file input — the SAME DOM
 *  event `conversation-composer.test.ts`'s own GH #1211 case fires; this file's job is proving what
 *  `ui-agent-admin` DOES with the `File`s once its `onAttach` handler receives them, not re-proving the
 *  composer's own gesture wiring. */
function attachFile(el: UIAgentAdminElement, file: File): void {
  const composer = el.querySelector('ui-conversation-composer') as HTMLElement
  const input = composer.querySelector('[data-part="attach-input"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function chipsOf(el: UIAgentAdminElement): HTMLElement[] {
  const composer = el.querySelector('ui-conversation-composer') as HTMLElement
  return [...composer.querySelectorAll<HTMLElement>('[data-part="context-chip"]')]
}

async function settle(): Promise<void> {
  await whenFlushed()
  await new Promise((r) => setTimeout(r, 0))
  await whenFlushed()
}

describe('ui-agent-admin — GH #1211: the composer attach path → a `resource` Entry (req-doc-ingestion.md R1/R4/R5)', () => {
  it('attaching a supported .txt file mints a `resource` entry with the extracted text and shows a chip naming it', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    await settle()

    attachFile(el, new File(['Some knowledge the agent should know.'], 'notes.txt', { type: 'text/plain' }))
    await settle()

    const entries = readEntries(el.store, ENTRY_KINDS.resource)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ label: 'notes.txt', content: 'Some knowledge the agent should know.', enabled: true, builtin: false })

    const chips = chipsOf(el)
    expect(chips).toHaveLength(1)
    expect((chips[0]!.querySelector('[data-part="context-chip-label"]') as HTMLElement).textContent).toBe('notes.txt')
    // the transient chip's id was swapped to the entry's OWN id (`#handleAttach`) — dismiss/re-read both
    // key off it from this point on.
    expect(chips[0]!.querySelector('ui-button')).not.toBeNull() // the dismiss affordance rendered
  })

  it('attaching an unsupported file type is rejected with a visible toast, never a silent drop, and mints no entry (R1 AC)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    await settle()

    attachFile(el, new File(['binary'], 'photo.png', { type: 'image/png' }))
    await settle()

    expect(readEntries(el.store, ENTRY_KINDS.resource)).toHaveLength(0)
    expect(chipsOf(el)).toHaveLength(0)
    const toast = el.querySelector('ui-toast-region ui-toast') as HTMLElement | null
    expect(toast, 'a rejection toast must render — never a silent drop').not.toBeNull()
    expect(toast!.textContent).toContain('photo.png')
  })

  it('dismissing an attached chip discards cleanly — the chip AND its resource entry are both gone (R5 AC)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    await settle()

    attachFile(el, new File(['content'], 'doc.md', { type: 'text/markdown' }))
    await settle()
    expect(readEntries(el.store, ENTRY_KINDS.resource)).toHaveLength(1)

    const dismiss = chipsOf(el)[0]!.querySelector('[data-part="context-chip-dismiss"]') as HTMLElement
    dismiss.dispatchEvent(new Event('click', { bubbles: true }))
    await settle()

    expect(chipsOf(el), 'the chip must be gone').toHaveLength(0)
    expect(readEntries(el.store, ENTRY_KINDS.resource), 'the entry it minted must be gone too — dismiss undoes the attach').toHaveLength(0)
  })

  it('refuses an attach that would push the aggregate resource-text total past MAX_AGENT_KNOWLEDGE_CHARS (R6\'s third budget), with a visible toast and no new entry minted', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    // Seed one ENABLED resource entry already sitting just under the aggregate cap.
    const existing: Entry = {
      id: 'huge-existing',
      kind: ENTRY_KINDS.resource,
      label: 'existing.txt',
      description: '',
      content: 'x'.repeat(MAX_AGENT_KNOWLEDGE_CHARS - 10),
      order: 0,
      enabled: true,
      builtin: false,
    }
    el.store!.set(entriesStoreKey(ENTRY_KINDS.resource), [existing])
    await settle()

    // A new 20-char document pushes the aggregate 10 chars past the cap.
    attachFile(el, new File(['y'.repeat(20)], 'new.txt', { type: 'text/plain' }))
    await settle()

    const entries = readEntries(el.store, ENTRY_KINDS.resource)
    expect(entries, 'no new entry minted — only the pre-seeded one remains').toHaveLength(1)
    expect(entries[0]!.id).toBe('huge-existing')
    expect(chipsOf(el), 'the rejected attach leaves no chip behind').toHaveLength(0)
    const toast = el.querySelector('ui-toast-region ui-toast') as HTMLElement | null
    expect(toast, 'a rejection toast must render — never a silent drop').not.toBeNull()
    expect(toast!.textContent).toContain('new.txt')
    expect(toast!.textContent).toContain(MAX_AGENT_KNOWLEDGE_CHARS.toLocaleString())
  })

  it('with no doc ever attached, the context-chip row starts empty/hidden — the attach button itself is revealed (this consumer DOES wire onAttach)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    await settle()
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement
    expect(composer.querySelector('[data-part="context-chips"]')!.hasAttribute('hidden')).toBe(true)
    expect(composer.querySelector('[data-part="attach"]')!.hasAttribute('hidden')).toBe(false)
  })
})
