import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIConversationComposerElement } from './conversation-composer.ts'
import '@agent-ui/components/components' // self-registers ui-button/ui-menu/ui-icon
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

// jsdom probes for ui-conversation-composer (TKT-0056 extraction · TKT-0058 v2 unroll) — the
// message-composition field. jsdom cannot resolve CSS layout, real focus on a contenteditable, or the
// :has() focus ring — the visual frame/ring/growth-cap/click-to-focus legs are
// conversation.browser.test.ts's job.

// jsdom reality (the conversation.test.ts precedent) — no native ElementInternals.setFormValue/
// setValidity; the prototype is stubbed for this file's duration so the REAL composed ui-button
// (form-associated) parts can connect at all.
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
})
function mount<T extends Element>(el: T): T {
  document.body.append(el)
  mounted.push(el)
  return el
}

function editorOf(el: UIConversationComposerElement): HTMLElement {
  return el.querySelector('[data-part="editor"]') as HTMLElement
}
/** Type like a user: write the surface, then fire the editor's own `input` (the surface→model wire). */
function typeInto(el: UIConversationComposerElement, text: string): void {
  const editor = editorOf(el)
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
}
function pressEnter(el: UIConversationComposerElement, init: KeyboardEventInit = {}): void {
  editorOf(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init }))
}
/** GH #849 — press any key ON THE EDITOR (the typeahead's keys all ride the editor's own keydown). */
function pressKey(el: UIConversationComposerElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  editorOf(el).dispatchEvent(event)
  return event
}
function menuOf(el: UIConversationComposerElement): HTMLElement | null {
  return el.querySelector('[data-part="reference-menu"]')
}
const menuIsOpen = (el: UIConversationComposerElement): boolean => menuOf(el)?.hasAttribute('data-open') === true
function optionLabelsOf(el: UIConversationComposerElement): string[] {
  return [...(menuOf(el)?.querySelectorAll('[data-part="reference-option-label"]') ?? [])].map((n) => n.textContent ?? '')
}
function optionsOf(el: UIConversationComposerElement): HTMLElement[] {
  return [...(menuOf(el)?.querySelectorAll<HTMLElement>('[data-part="reference-option"]') ?? [])]
}
function chipLabelsOf(el: UIConversationComposerElement): string[] {
  return [...el.querySelectorAll('[data-part="reference-chip-label"]')].map((n) => n.textContent ?? '')
}

describe('ui-conversation-composer — the own editor (TKT-0058, the ui-textarea ADR-0014 pattern reused)', () => {
  it('owns a contenteditable editor part — no nested ui-text-field, no nested form (the v2 unroll)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const editor = editorOf(el)
    expect(editor.getAttribute('contenteditable')).toBe('plaintext-only')
    expect(editor.getAttribute('role')).toBe('textbox')
    expect(editor.getAttribute('aria-multiline')).toBe('true')
    expect(editor.getAttribute('aria-label')).toBe('Message')
    expect(editor.getAttribute('data-placeholder')).toBe('Ask anything..')
    expect(el.querySelector('ui-text-field'), 'the v1 nested ui-text-field must be gone').toBeNull()
    expect(el.querySelector('form'), 'the v1 nested <form> must be gone').toBeNull()
  })

  it('the `placeholder` prop is unset by default — the editor keeps its original "Ask anything.." ghost text (GH #672)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    expect(el.placeholder).toBe('Ask anything..')
    expect(editorOf(el).getAttribute('data-placeholder')).toBe('Ask anything..')
  })

  it('setting `placeholder` reflects onto the editor\'s data-placeholder attribute, even post-connect (GH #672)', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.placeholder = 'Describe the agent you want…'
    await whenFlushed()
    expect(editorOf(el).getAttribute('data-placeholder')).toBe('Describe the agent you want…')
  })

  it('surface→model: typing (editor input) flows into `value`; model→surface: a programmatic write flows back under the caret guard, toggling data-empty', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const editor = editorOf(el)
    expect(editor.hasAttribute('data-empty')).toBe(true)
    typeInto(el, 'hello')
    expect(el.value).toBe('hello') // the input wire is synchronous (a listener, not an effect)
    await whenFlushed()
    expect(editor.hasAttribute('data-empty')).toBe(false)
    el.value = 'rewritten'
    await whenFlushed()
    expect(editor.textContent).toBe('rewritten')
    el.value = ''
    await whenFlushed()
    expect(editor.textContent).toBe('')
    expect(editor.hasAttribute('data-empty')).toBe(true)
  })

  it('a raw editor `input` never escapes the host (events: [] — the part-level event is suppressed, code-reviewer LOW)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    let leaked = 0
    el.addEventListener('input', () => (leaked += 1))
    typeInto(el, 'typing')
    expect(el.value).toBe('typing') // the surface→model wire still ran (same-target listeners are unaffected by stopPropagation)
    expect(leaked, 'an internal part event escaped a component whose descriptor declares events: []').toBe(0)
  })

  it('host.focus() forwards to the editor part (the ui-textarea override precedent)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const editor = editorOf(el)
    let forwarded = 0
    editor.focus = () => (forwarded += 1) // jsdom cannot really focus a contenteditable — count the forward instead
    el.focus()
    expect(forwarded).toBe(1)
  })

  it('clicking the component area focuses the editor; clicking a button/menu/chip does NOT (LLD CVC-C8)', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.contextItems = [{ id: 'sel-1', label: 'Context Selection' }]
    el.models = [{ id: 'a', label: 'A' }]
    await whenFlushed()
    const editor = editorOf(el)
    let focused = 0
    editor.focus = () => (focused += 1)

    el.dispatchEvent(new Event('click', { bubbles: true })) // the host's own area
    expect(focused).toBe(1)
    ;(el.querySelector('[data-part="options"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true })) // row background — still the component area
    expect(focused).toBe(2)
    ;(el.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true })) // a button — its own focus
    expect(focused).toBe(2)
    ;(el.querySelector('[data-part="context-chip"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true })) // a tag
    expect(focused).toBe(2)
    ;(el.querySelector('[data-part="models-menu"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true })) // a menu
    expect(focused).toBe(2)
  })
})

describe('ui-conversation-composer — onSubmit (SPEC-R5, promoted; TKT-0058 Enter/Shift+Enter law)', () => {
  it('Enter sends exactly once with the trimmed text; the value (and surface) clear', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    typeInto(el, '  hello agent  ')
    pressEnter(el)
    expect(received).toEqual(['hello agent'])
    expect(el.value).toBe('')
    await whenFlushed()
    expect(editorOf(el).textContent).toBe('')
  })

  it('clicking Send sends too (the same path)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    typeInto(el, 'via the button')
    ;(el.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(received).toEqual(['via the button'])
  })

  it('Shift+Enter does NOT send (the multi-line newline law, LLD CVC-C7) — and is not preventDefaulted', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    typeInto(el, 'line one')
    const editor = editorOf(el)
    const shiftEnter = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true })
    editor.dispatchEvent(shiftEnter)
    expect(received).toEqual([])
    expect(shiftEnter.defaultPrevented, 'Shift+Enter must fall through to the platform newline').toBe(false)
  })

  it('Enter finalizing an IME composition does NOT send (isComposing guard)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    typeInto(el, '日本語')
    pressEnter(el, { isComposing: true })
    expect(received).toEqual([])
  })

  it('an empty/whitespace-only send is a no-op — the callback never fires', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    pressEnter(el)
    typeInto(el, '   ')
    pressEnter(el)
    expect(received).toEqual([])
  })

  it('no registered onSubmit never throws on send (a no-op consumer is legal, SPEC-R5 AC2)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    typeInto(el, 'hi')
    expect(() => pressEnter(el)).not.toThrow()
  })

  it('the in-flight `busy` guard: a send while busy is a no-op and RETAINS the typed text (TKT-0056 F2 — the synchronous backstop)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text))
    el.busy = true // the prop write is synchronous — only the disabling EFFECT is microtask-batched
    typeInto(el, 'typed during busy')
    pressEnter(el)
    expect(received, 'onSubmit must not fire while busy').toEqual([])
    expect(el.value, 'the typed text must be RETAINED, never silently dropped').toBe('typed during busy')
    el.busy = false
    pressEnter(el)
    expect(received).toEqual(['typed during busy'])
  })
})

describe('ui-conversation-composer — busy (TKT-0056, promoted; TKT-0058 own-editor disabling)', () => {
  it('disables editor/send/mic/picker-triggers and reflects [busy] on the host', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.models = [{ id: 'a', label: 'A' }]
    el.efforts = [{ id: 'low', label: 'Low' }]
    el.onMicClick(() => {})
    await whenFlushed()

    const editor = editorOf(el)
    const send = el.querySelector('[data-part="send"]') as HTMLElement & { disabled: boolean }
    const mic = el.querySelector('[data-part="mic"]') as HTMLElement & { disabled: boolean }
    const modelsTrigger = el.querySelector('[data-picker="models"]') as HTMLElement & { disabled: boolean }
    const effortTrigger = el.querySelector('[data-picker="effort"]') as HTMLElement & { disabled: boolean }

    expect(el.hasAttribute('busy')).toBe(false)
    expect(editor.getAttribute('contenteditable')).toBe('plaintext-only')
    el.busy = true
    await whenFlushed()
    expect(el.hasAttribute('busy'), 'busy reflects — the CSS dim hook').toBe(true)
    expect(editor.getAttribute('contenteditable'), 'the editor becomes non-editable').toBe('false')
    expect(editor.getAttribute('aria-disabled')).toBe('true')
    expect(send.disabled).toBe(true)
    expect(mic.disabled).toBe(true)
    expect(modelsTrigger.disabled).toBe(true)
    expect(effortTrigger.disabled).toBe(true)

    el.busy = false
    await whenFlushed()
    expect(el.hasAttribute('busy')).toBe(false)
    expect(editor.getAttribute('contenteditable')).toBe('plaintext-only')
    expect(editor.getAttribute('aria-disabled')).toBeNull()
    expect(send.disabled).toBe(false)
  })
})

describe('ui-conversation-composer — the opt-in composer capabilities', () => {
  it('models/efforts are opt-in: unset by default, no picker rendered at all', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    expect(el.querySelector('[data-part="models-menu"]')).toBeNull()
    expect(el.querySelector('[data-part="effort-menu"]')).toBeNull()
  })

  it('setting `models` renders a picker whose trigger shows the current selection (falling back to "Models")', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.models = [{ id: 'a', label: 'Model A' }, { id: 'b', label: 'Model B' }]
    await whenFlushed()
    const trigger = el.querySelector('[data-picker="models"]') as HTMLElement
    expect(trigger.textContent).toBe('Models')
    el.model = 'b'
    await whenFlushed()
    expect(trigger.textContent).toBe('Model B')
  })

  it('committing a Models item fires onModelChange with that item\'s id and never writes `model` itself', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.models = [{ id: 'a', label: 'Model A' }, { id: 'b', label: 'Model B' }]
    await whenFlushed()
    const received: string[] = []
    el.onModelChange((id) => received.push(id))
    const menu = el.querySelector('[data-part="models-menu"]') as HTMLElement
    const item = menu.querySelector('[data-value="b"]') as HTMLElement
    item.dispatchEvent(new Event('click', { bubbles: true }))
    expect(received).toEqual(['b'])
    expect(el.model).toBeUndefined() // props down, callbacks up — the picker never self-assigns
  })

  it('the Effort picker works identically, defaulting to undefined/no-picker and firing onEffortChange on commit', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    expect(el.querySelector('[data-part="effort-menu"]')).toBeNull()
    el.efforts = [{ id: 'low', label: 'Low' }, { id: 'high', label: 'High' }]
    el.effort = 'low'
    await whenFlushed()
    const trigger = el.querySelector('[data-picker="effort"]') as HTMLElement
    expect(trigger.textContent).toBe('Low')
    const received: string[] = []
    el.onEffortChange((id) => received.push(id))
    const item = (el.querySelector('[data-part="effort-menu"]') as HTMLElement).querySelector('[data-value="high"]') as HTMLElement
    item.dispatchEvent(new Event('click', { bubbles: true }))
    expect(received).toEqual(['high'])
  })

  it('contextItems is empty/hidden by default; setting it renders one dismissable chip per entry, firing onContextDismiss with that item\'s id', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const row = el.querySelector('[data-part="context-chips"]') as HTMLElement
    expect(row.hasAttribute('hidden')).toBe(true)
    el.contextItems = [{ id: 'sel-1', label: 'Context Selection' }]
    await whenFlushed()
    expect(row.hasAttribute('hidden')).toBe(false)
    const chip = el.querySelector('[data-part="context-chip"]') as HTMLElement
    expect((chip.querySelector('[data-part="context-chip-label"]') as HTMLElement).textContent).toBe('Context Selection')
    const received: string[] = []
    el.onContextDismiss((id) => received.push(id))
    ;(chip.querySelector('[data-part="context-chip-dismiss"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(received).toEqual(['sel-1'])
    // the consumer owns removal — the chip itself is NOT auto-removed by the dismiss click alone
    el.contextItems = []
    await whenFlushed()
    expect(row.hasAttribute('hidden')).toBe(true)
  })

  it('the mic button is OPT-IN — hidden by default, revealed by onMicClick, and fires on click', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const mic = el.querySelector('[data-part="mic"]') as HTMLElement
    expect(mic.hasAttribute('hidden')).toBe(true)
    let clicks = 0
    el.onMicClick(() => (clicks += 1))
    expect(mic.hasAttribute('hidden')).toBe(false)
    mic.dispatchEvent(new Event('click', { bubbles: true }))
    expect(clicks).toBe(1)
  })

  it('the send button is icon-only (arrow-up), not the old text-labeled "Send"', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const send = el.querySelector('[data-part="send"]') as HTMLElement
    expect(send.hasAttribute('icon-only')).toBe(true)
    expect(send.getAttribute('aria-label')).toBe('Send')
  })

  it('a picker commit still fires its callback after an ORDINARY disconnect/reconnect (code-reviewer HIGH regression)', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.models = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]
    await whenFlushed()

    el.remove() // an ordinary detach — NOT moveBefore
    document.body.append(el) // ...and reattach — connected() re-runs, the menu DOM is already built
    await whenFlushed()

    const received: string[] = []
    el.onModelChange((id) => received.push(id))
    const menu = el.querySelector('[data-part="models-menu"]') as HTMLElement
    ;(menu.querySelector('[data-value="b"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(received).toEqual(['b'])
  })

  it('a context-chip dismiss still fires its callback after an ORDINARY disconnect/reconnect with the SAME contextItems reference (code-reviewer MEDIUM regression)', async () => {
    // Unlike the pickers (armed once per CONNECTION via #modelsListenerArmed/#effortListenerArmed), the
    // chip row's dismiss listeners are armed inside #syncContextChips's own reference-equality-guarded
    // rebuild — if `contextItems` keeps the SAME reference across a reconnect, the guard would otherwise
    // skip the rebuild entirely, leaving the PRIOR connection's now-dead chip DOM/listeners in the tree.
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const items = [{ id: 'sel-1', label: 'Context Selection' }]
    el.contextItems = items
    await whenFlushed()

    el.remove() // an ordinary detach — NOT moveBefore
    document.body.append(el) // ...and reattach — connected() re-runs
    el.contextItems = items // the SAME array reference — the exact case the guard must not defeat
    await whenFlushed()

    const received: string[] = []
    el.onContextDismiss((id) => received.push(id))
    ;(el.querySelector('[data-part="context-chip-dismiss"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(received).toEqual(['sel-1'])
  })

  it('typing still syncs value after an ORDINARY disconnect/reconnect (the editor wires ride the connection signal)', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    typeInto(el, 'before')
    expect(el.value).toBe('before')

    el.remove()
    document.body.append(el)
    await whenFlushed()

    typeInto(el, 'after reconnect')
    expect(el.value).toBe('after reconnect')
  })
})

describe('ui-conversation-composer — GH #257 Provider/Mode pickers', () => {
  const PROVIDERS = [
    {
      id: 'anthropic',
      label: 'Anthropic',
      defaultModel: 'claude-sonnet-5',
      models: [
        { id: 'claude-sonnet-5', label: 'Sonnet 5' },
        { id: 'claude-opus-4-8', label: 'Opus 4.8' },
      ],
    },
    {
      id: 'openai',
      label: 'OpenAI',
      defaultModel: 'gpt-4.1',
      models: [{ id: 'gpt-4.1', label: 'GPT-4.1' }],
    },
    {
      id: 'gemini',
      label: 'Gemini — coming soon',
      defaultModel: 'gemini-2.5-pro',
      models: [{ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }],
      disabled: true, // the "coming soon" precedent (provider-switcher.ts) — visible, never committable
    },
  ]

  it('providers/modes are opt-in: unset by default, no picker rendered at all', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    expect(el.querySelector('[data-part="providers-menu"]')).toBeNull()
    expect(el.querySelector('[data-part="mode-menu"]')).toBeNull()
  })

  it('setting `providers` narrows the Models picker to the selected provider\'s OWN model list, never a plain `models` list', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.providers = PROVIDERS
    el.provider = 'anthropic'
    el.model = 'claude-sonnet-5'
    await whenFlushed()
    const modelsMenu = el.querySelector('[data-part="models-menu"]') as HTMLElement
    expect([...modelsMenu.querySelectorAll('[role="menuitem"]')].map((i) => (i as HTMLElement).dataset.value)).toEqual([
      'claude-sonnet-5', 'claude-opus-4-8',
    ])
  })

  it('committing a NEW provider whose model list does not contain the CURRENT model fires onModelChange with its defaultModel, alongside onProviderChange', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.providers = PROVIDERS
    el.provider = 'anthropic'
    el.model = 'claude-sonnet-5'
    await whenFlushed()
    const providerIds: string[] = []
    const modelIds: string[] = []
    el.onProviderChange((id) => providerIds.push(id))
    el.onModelChange((id) => modelIds.push(id))
    const menu = el.querySelector('[data-part="providers-menu"]') as HTMLElement
    ;(menu.querySelector('[data-value="openai"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(providerIds).toEqual(['openai'])
    expect(modelIds, 'the current model (claude-sonnet-5) does not belong to openai — must reset to its defaultModel').toEqual(['gpt-4.1'])
    // props down, callbacks up — the picker never self-assigns either prop
    expect(el.provider).toBe('anthropic')
    expect(el.model).toBe('claude-sonnet-5')
  })

  it('code-reviewer M1 — the reset-on-provider-change ORDER is a real contract: onModelChange fires BEFORE onProviderChange in the SAME commit', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.providers = PROVIDERS
    el.provider = 'anthropic'
    el.model = 'claude-sonnet-5'
    await whenFlushed()
    // ONE shared array across BOTH callbacks — a real ordering assertion, not two isolated arrays that
    // merely prove each fired (the prior test's own scope).
    const calls: ['model' | 'provider', string][] = []
    el.onModelChange((id) => calls.push(['model', id]))
    el.onProviderChange((id) => calls.push(['provider', id]))
    const menu = el.querySelector('[data-part="providers-menu"]') as HTMLElement
    ;(menu.querySelector('[data-value="openai"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(calls).toEqual([
      ['model', 'gpt-4.1'],
      ['provider', 'openai'],
    ])
  })

  it('committing a provider whose model list DOES already contain the current model does NOT fire onModelChange', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const sameModelId = { ...PROVIDERS[1]!, models: [{ id: 'claude-sonnet-5', label: 'Sonnet-alike' }], disabled: false }
    el.providers = [PROVIDERS[0]!, sameModelId]
    el.provider = 'anthropic'
    el.model = 'claude-sonnet-5'
    await whenFlushed()
    const modelIds: string[] = []
    el.onModelChange((id) => modelIds.push(id))
    const menu = el.querySelector('[data-part="providers-menu"]') as HTMLElement
    ;(menu.querySelector(`[data-value="${sameModelId.id}"]`) as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(modelIds, 'the current model already belongs to the new provider — no reset needed').toEqual([])
  })

  it('code-reviewer L1 — `providers: []` (empty, not undefined) does NOT also hide an author-set `models` list', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.providers = []
    el.models = [{ id: 'a', label: 'Model A' }]
    el.model = 'a'
    await whenFlushed()
    expect(el.querySelector('[data-part="providers-menu"]'), 'an empty providers list must hide the Provider picker').toBeNull()
    const trigger = el.querySelector('[data-picker="models"]') as HTMLElement
    expect(trigger, 'an empty (not undefined) providers list must not ALSO hide the plain models picker underneath it').not.toBeNull()
    expect(trigger.textContent).toBe('Model A')
  })

  it('a `disabled` provider option renders aria-disabled and never commits on click (ui-menu\'s own skip, menu.ts)', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.providers = PROVIDERS
    el.provider = 'anthropic'
    await whenFlushed()
    const menu = el.querySelector('[data-part="providers-menu"]') as HTMLElement
    const disabledItem = menu.querySelector('[data-value="gemini"]') as HTMLElement
    expect(disabledItem.getAttribute('aria-disabled')).toBe('true')
    const providerIds: string[] = []
    el.onProviderChange((id) => providerIds.push(id))
    disabledItem.dispatchEvent(new Event('click', { bubbles: true }))
    expect(providerIds, 'a disabled ("coming soon") option must never commit').toEqual([])
  })

  it('the Mode picker works identically to Effort — flat options, no narrowing, firing onModeChange on commit', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.modes = [{ id: 'default', label: 'Default' }, { id: 'blue-sky', label: 'Blue-sky' }]
    el.mode = 'default'
    await whenFlushed()
    const trigger = el.querySelector('[data-picker="mode"]') as HTMLElement
    expect(trigger.textContent).toBe('Default')
    const received: string[] = []
    el.onModeChange((id) => received.push(id))
    const item = (el.querySelector('[data-part="mode-menu"]') as HTMLElement).querySelector('[data-value="blue-sky"]') as HTMLElement
    item.dispatchEvent(new Event('click', { bubbles: true }))
    expect(received).toEqual(['blue-sky'])
  })

  it('a consumer that never sets providers/modes is byte-identical to before (no Provider/Mode triggers, `models`/`effort` unaffected)', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.models = [{ id: 'a', label: 'A' }]
    el.model = 'a'
    await whenFlushed()
    expect(el.querySelector('[data-picker="providers"]')).toBeNull()
    expect(el.querySelector('[data-picker="mode"]')).toBeNull()
    expect((el.querySelector('[data-picker="models"]') as HTMLElement).textContent).toBe('A')
  })
})

// ── GH #849 — the reference typeahead (capability-availability-tagging.spec.md SPEC-R5/R6/R7) ──────────
//
// jsdom carries this whole slice EXCEPT real focus + real caret geometry: the Popover API is absent (the
// panel's `data-open` is the element's own state truth, which is exactly why it exists), and jsdom has no
// selection after a programmatic `textContent` write — so `#caretOffset` falls back to end-of-text, the
// same place a typing caret sits. SPEC-R7 AC1's focus/aria-activedescendant walk under REAL keystrokes is
// conversation-composer.browser.test.ts's job.

const MENTIONABLES = [
  { id: 'res-menu', label: 'Menu PDF', kind: 'resource', description: 'Tonight’s menu' },
  { id: 'res-brand', label: 'Brand guide', kind: 'resource' },
  { id: 'res-notes', label: 'Meeting notes', kind: 'resource' },
]
const INVOCABLES = [
  { id: 'skill-style', label: 'House style', kind: 'skill' },
  { id: 'wf-review', label: 'Review flow', kind: 'workflow' },
  { id: 'mcp:calc:*', label: 'Calculator', kind: 'tool' },
]

describe('ui-conversation-composer — GH #849 SPEC-R5: the trigger grammar', () => {
  it('both rosters are opt-in: unset by default, no typeahead panel built at all, and `@`/`/` stay plain characters', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    expect(el.mentionables).toBeUndefined()
    expect(el.invocables).toBeUndefined()
    typeInto(el, '@men and /calc')
    expect(menuOf(el), 'no roster ⇒ no panel DOM of any kind').toBeNull()
    expect(el.value).toBe('@men and /calc') // the characters are ordinary text
    expect(editorOf(el).hasAttribute('aria-expanded')).toBe(false)
  })

  it('an EMPTY (not undefined) roster also makes its trigger a plain character', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = []
    typeInto(el, '@')
    expect(menuIsOpen(el)).toBe(false)
  })

  it('AC1 — `@` mid-word opens nothing; `@` at text start AND after a space both open the mention menu', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    typeInto(el, 'foo@men')
    expect(menuIsOpen(el), 'a mid-word @ is not a trigger (SPEC-R5 token-start law)').toBe(false)
    typeInto(el, '@')
    expect(menuIsOpen(el), '@ at text start opens the menu').toBe(true)
    expect(optionLabelsOf(el)).toEqual(['Menu PDF', 'Brand guide', 'Meeting notes'])
    typeInto(el, 'ask about @')
    expect(menuIsOpen(el), '@ after whitespace opens the menu').toBe(true)
    typeInto(el, 'line\n@')
    expect(menuIsOpen(el), '@ after a newline opens the menu').toBe(true)
  })

  it('AC2 — the typed token filters case-insensitively over DISPLAY names (contains, not prefix)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    typeInto(el, '@men')
    expect(optionLabelsOf(el)).toEqual(['Menu PDF'])
    typeInto(el, '@NOT')
    expect(optionLabelsOf(el)).toEqual(['Meeting notes']) // case-insensitive CONTAINS ("meetiNG NOTes")
    typeInto(el, '@zzz')
    expect(menuIsOpen(el), 'zero matches closes rather than showing an empty panel').toBe(false)
    typeInto(el, '@me')
    expect(menuIsOpen(el), 'backspacing to a matching token reopens it — the pass is stateless').toBe(true)
  })

  it('AC3 — Escape closes, keeps the typed token as PLAIN text, sends zero references, and does not reopen on further typing', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    const sent: [string, readonly { id: string }[] | undefined][] = []
    el.onSubmit((text, references) => sent.push([text, references]))
    typeInto(el, '@men')
    expect(menuIsOpen(el)).toBe(true)
    const escape = pressKey(el, 'Escape')
    expect(menuIsOpen(el)).toBe(false)
    expect(escape.defaultPrevented, 'a typeahead-only Escape is consumed, never left to an ancestor overlay').toBe(true)
    expect(el.value).toBe('@men')
    typeInto(el, '@menu')
    expect(menuIsOpen(el), 'the dismissed token stays inert however much more is typed into it').toBe(false)
    pressEnter(el)
    expect(sent).toEqual([['@menu', []]])
  })

  it('typing whitespace without committing closes the menu and leaves the token as inert text', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    typeInto(el, '@men')
    expect(menuIsOpen(el)).toBe(true)
    typeInto(el, '@men ')
    expect(menuIsOpen(el)).toBe(false)
    expect(el.value).toBe('@men ')
  })

  it('blur closes the menu (SPEC-R5 dismissal)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    typeInto(el, '@men')
    expect(menuIsOpen(el)).toBe(true)
    editorOf(el).dispatchEvent(new Event('blur'))
    expect(menuIsOpen(el)).toBe(false)
  })

  it('the `/` roster is ONE menu grouped by kind — direct-by-name, never a two-stage `/tool <name>`', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.invocables = INVOCABLES
    typeInto(el, '/')
    expect(menuIsOpen(el)).toBe(true)
    const groups = [...(menuOf(el) as HTMLElement).querySelectorAll('[data-part="reference-group"]')]
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Skill', 'Workflow', 'Tool'])
    expect(optionLabelsOf(el)).toEqual(['House style', 'Review flow', 'Calculator'])
    // filtering down to ONE kind drops the now-redundant single header
    typeInto(el, '/calc')
    expect(optionLabelsOf(el)).toEqual(['Calculator'])
    expect((menuOf(el) as HTMLElement).querySelector('[data-part="reference-group"]')).toBeNull()
  })

  it('the two triggers open their OWN roster — never the other one', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    el.invocables = INVOCABLES
    typeInto(el, '@')
    expect(optionLabelsOf(el)).toEqual(['Menu PDF', 'Brand guide', 'Meeting notes'])
    typeInto(el, '/')
    expect(optionLabelsOf(el)).toEqual(['House style', 'Review flow', 'Calculator'])
  })
})

describe('ui-conversation-composer — GH #849 SPEC-R6: the commit shape (chip + structured reference)', () => {
  it('AC1 — a commit removes the token text, renders a chip, and send delivers {kind,id,label}', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    const sent: [string, readonly { id: string; label: string; kind: string }[] | undefined][] = []
    el.onSubmit((text, references) => sent.push([text, references]))
    typeInto(el, 'total the order @men')
    pressEnter(el) // the menu is open ⇒ Enter COMMITS
    expect(el.value, 'the in-progress token text is gone from the value').toBe('total the order ')
    expect(editorOf(el).textContent).toBe('total the order ')
    expect(chipLabelsOf(el)).toEqual(['Menu PDF'])
    expect((el.querySelector('[data-part="reference-chip"]') as HTMLElement).dataset.kind).toBe('resource')
    expect((el.querySelector('[data-part="reference-chip-sigil"]') as HTMLElement).textContent).toBe('@')
    expect(sent, 'nothing was SENT by the committing Enter').toEqual([])
    pressEnter(el) // ...now a real send
    expect(sent).toEqual([['total the order', [{ id: 'res-menu', label: 'Menu PDF', kind: 'resource' }]]])
    expect(chipLabelsOf(el), 'chips clear with the text on a successful send').toEqual([])
  })

  it('a click on an option commits it too (the panel keeps the editor focused — pointerdown is preventDefaulted)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.invocables = INVOCABLES
    typeInto(el, '/')
    const pointerDown = new Event('pointerdown', { bubbles: true, cancelable: true })
    ;(menuOf(el) as HTMLElement).dispatchEvent(pointerDown)
    expect(pointerDown.defaultPrevented, 'a panel pointerdown must never move DOM focus off the editor').toBe(true)
    optionsOf(el)[2]!.dispatchEvent(new Event('click', { bubbles: true }))
    expect(chipLabelsOf(el)).toEqual(['Calculator'])
    expect(el.value).toBe('')
    expect(menuIsOpen(el)).toBe(false)
  })

  it('AC2 — a chip dismissed pre-send drops that reference; the send delivers zero references', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    const sent: [string, readonly { id: string }[] | undefined][] = []
    el.onSubmit((text, references) => sent.push([text, references]))
    typeInto(el, '@men')
    pressEnter(el)
    expect(chipLabelsOf(el)).toEqual(['Menu PDF'])
    ;(el.querySelector('[data-part="reference-chip-dismiss"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(chipLabelsOf(el)).toEqual([])
    typeInto(el, 'plain question')
    pressEnter(el)
    expect(sent).toEqual([['plain question', []]])
  })

  it('AC3 — a single-argument onSubmit consumer is unaffected (the extra argument is ignored)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    const received: string[] = []
    el.onSubmit((text) => received.push(text)) // the pre-GH #849 shape, verbatim
    typeInto(el, 'hello agent')
    pressEnter(el)
    expect(received).toEqual(['hello agent'])
  })

  it('AC3 — a roster-less composer renders none of the typeahead/chip DOM (the chip row stays hidden and empty)', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.contextItems = []
    await whenFlushed()
    expect(menuOf(el)).toBeNull()
    expect(el.querySelector('[data-part="reference-chip"]')).toBeNull()
    expect((el.querySelector('[data-part="context-chips"]') as HTMLElement).hasAttribute('hidden')).toBe(true)
  })

  it('two mentions ride one turn; the SAME entry mentioned twice is one chip (deduped by kind+id)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    const sent: [string, readonly { id: string }[] | undefined][] = []
    el.onSubmit((text, references) => sent.push([text, references]))
    typeInto(el, '@men')
    pressEnter(el)
    typeInto(el, '@brand')
    pressEnter(el)
    typeInto(el, '@menu')
    pressEnter(el)
    expect(chipLabelsOf(el)).toEqual(['Menu PDF', 'Brand guide'])
    typeInto(el, 'q')
    pressEnter(el)
    expect(sent[0]![1]!.map((r) => r.id)).toEqual(['res-menu', 'res-brand'])
  })

  it('reference chips COHABIT the chip row with consumer contextItems — and a contextItems change never wipes them', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    el.contextItems = [{ id: 'sel-1', label: 'Context Selection' }]
    await whenFlushed()
    typeInto(el, '@men')
    pressEnter(el)
    const row = el.querySelector('[data-part="context-chips"]') as HTMLElement
    expect(row.hasAttribute('hidden')).toBe(false)
    expect([...row.children].map((c) => (c as HTMLElement).dataset.part)).toEqual(['context-chip', 'reference-chip'])
    // a NEW contextItems reference rebuilds the consumer chips only — the reference chip survives, still last
    el.contextItems = [{ id: 'sel-2', label: 'Other Selection' }, { id: 'sel-3', label: 'Third' }]
    await whenFlushed()
    expect([...row.children].map((c) => (c as HTMLElement).dataset.part)).toEqual([
      'context-chip', 'context-chip', 'reference-chip',
    ])
    expect(chipLabelsOf(el)).toEqual(['Menu PDF'])
    // clearing the consumer chips leaves the row VISIBLE — it still holds a reference chip
    el.contextItems = []
    await whenFlushed()
    expect(row.hasAttribute('hidden')).toBe(false)
    expect([...row.children].map((c) => (c as HTMLElement).dataset.part)).toEqual(['reference-chip'])
  })

  it('a reference-chip dismiss still fires after an ORDINARY disconnect/reconnect (the context-chip regression, re-derived for composer-owned chips)', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    typeInto(el, '@men')
    pressEnter(el)
    expect(chipLabelsOf(el)).toEqual(['Menu PDF'])

    el.remove() // an ordinary detach — the chip DOM survives, its listeners do NOT
    document.body.append(el)
    await whenFlushed()

    expect(chipLabelsOf(el), 'the chip is rebuilt once per connect').toEqual(['Menu PDF'])
    ;(el.querySelector('[data-part="reference-chip-dismiss"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(chipLabelsOf(el)).toEqual([])
  })
})

describe('ui-conversation-composer — GH #849 SPEC-R7: keyboard, AX, and the event law', () => {
  it('the open panel is a [role=listbox] of [role=option]s; the EDITOR carries aria-expanded/-controls/-activedescendant', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    typeInto(el, '@')
    const menu = menuOf(el) as HTMLElement
    const editor = editorOf(el)
    expect(menu.getAttribute('role')).toBe('listbox')
    expect(menu.getAttribute('popover')).toBe('manual')
    expect(optionsOf(el).every((o) => o.getAttribute('role') === 'option')).toBe(true)
    expect(editor.getAttribute('role'), 'the editor role never changes — a roster-less composer is untouched').toBe('textbox')
    expect(editor.getAttribute('aria-expanded')).toBe('true')
    expect(editor.getAttribute('aria-controls')).toBe(menu.id)
    expect(editor.getAttribute('aria-activedescendant'), 'the FIRST option is highlighted on open').toBe(optionsOf(el)[0]!.id)
    expect(optionsOf(el)[0]!.hasAttribute('data-active')).toBe(true)
    pressKey(el, 'Escape')
    expect(editor.hasAttribute('aria-expanded')).toBe(false)
    expect(editor.hasAttribute('aria-controls')).toBe(false)
    expect(editor.hasAttribute('aria-activedescendant')).toBe(false)
  })

  it('ArrowDown/ArrowUp move the highlight via aria-activedescendant, wrapping at both ends', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    typeInto(el, '@')
    const editor = editorOf(el)
    const ids = optionsOf(el).map((o) => o.id)
    expect(editor.getAttribute('aria-activedescendant')).toBe(ids[0])
    const down = pressKey(el, 'ArrowDown')
    expect(down.defaultPrevented, 'Arrow is consumed by the typeahead, never left to the caret').toBe(true)
    expect(editor.getAttribute('aria-activedescendant')).toBe(ids[1])
    pressKey(el, 'ArrowDown')
    expect(editor.getAttribute('aria-activedescendant')).toBe(ids[2])
    pressKey(el, 'ArrowDown')
    expect(editor.getAttribute('aria-activedescendant'), 'wraps to the first').toBe(ids[0])
    pressKey(el, 'ArrowUp')
    expect(editor.getAttribute('aria-activedescendant'), 'wraps to the last').toBe(ids[2])
    expect(optionsOf(el).filter((o) => o.hasAttribute('data-active')).length, 'exactly one highlight').toBe(1)
  })

  it('Enter with the menu open COMMITS the highlighted item and never sends (the guard runs ahead of the Enter-sends law)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    const sent: string[] = []
    el.onSubmit((text) => sent.push(text))
    typeInto(el, 'question @')
    pressKey(el, 'ArrowDown') // highlight the SECOND option
    pressEnter(el)
    expect(sent, 'a committing Enter must not send').toEqual([])
    expect(chipLabelsOf(el)).toEqual(['Brand guide'])
    expect(menuIsOpen(el)).toBe(false)
    pressEnter(el) // the menu is closed now — the ordinary send law applies again
    expect(sent).toEqual(['question'])
  })

  it('Shift+Enter with the menu open still inserts a newline (never commits, never sends)', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    const sent: string[] = []
    el.onSubmit((text) => sent.push(text))
    typeInto(el, '@men')
    const shiftEnter = pressKey(el, 'Enter', { shiftKey: true })
    expect(shiftEnter.defaultPrevented, 'Shift+Enter must fall through to the platform newline').toBe(false)
    expect(chipLabelsOf(el)).toEqual([])
    expect(sent).toEqual([])
  })

  it('no internal menu event escapes the host — `events: []` still holds with the typeahead live', () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    const leaked: string[] = []
    for (const name of ['change', 'input', 'select', 'open', 'close', 'toggle', 'action']) {
      el.addEventListener(name, () => leaked.push(name))
    }
    typeInto(el, '@men')
    pressKey(el, 'ArrowDown')
    pressEnter(el) // commit
    pressKey(el, 'Escape')
    typeInto(el, 'q')
    pressEnter(el) // send
    expect(leaked, 'the descriptor declares events: [] — nothing may escape').toEqual([])
  })

  it('going busy closes an open typeahead (never an orphan top-layer panel over an uneditable composer)', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    typeInto(el, '@men')
    expect(menuIsOpen(el)).toBe(true)
    el.busy = true
    await whenFlushed()
    expect(menuIsOpen(el)).toBe(false)
  })

  it('a disconnect closes an open typeahead (the scope-owned disposer)', async () => {
    const el = mount(document.createElement('ui-conversation-composer') as UIConversationComposerElement)
    el.mentionables = MENTIONABLES
    typeInto(el, '@men')
    expect(menuIsOpen(el)).toBe(true)
    el.remove()
    await whenFlushed()
    expect(menuOf(el)?.hasAttribute('data-open')).toBe(false)
  })
})

// ── descriptor — ADR-0004 (structural + contract↔props + contract↔source) ──────────────────────────────

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/conversation`
const ts = readFileSync(`${DIR}/conversation-composer.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/conversation-composer.css`, 'utf8') as string

describe('conversation-composer.md descriptor', () => {
  const md = readFileSync(`${DIR}/conversation-composer.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = [
    'value', 'placeholder', 'models', 'model', 'efforts', 'effort', 'providers', 'provider', 'modes', 'mode',
    'contextItems', 'mentionables', 'invocables', 'busy',
  ]

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-conversation-composer')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-conversation-composer\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UIConversationComposerElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIConversationComposerElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS (negative control)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'busy' ? { ...a, reflect: false } : a))
    expect(compareDescriptorToProps(flipReflect, UIConversationComposerElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.busy.reflect' }),
    )
  })

  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
