import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { mountSwitcher } from './provider-switcher.ts'

// provider-switcher.test.ts — jsdom smoke for the DEV-ONLY provider→model switcher after the ui-select
// dogfooding migration (Batch D). The switcher itself is stripped from the prod build (imported only under
// import.meta.env.DEV), so this is its ONLY automated coverage; it pins the ui-select wiring that a manual
// dev-loop would otherwise be the sole check of: derived options, disabled "coming soon" providers, and the
// rebuild-the-element path for dynamic model replacement.
//
// jsdom reality (established precedent: gallery.test.ts / checkbox.test.ts): ElementInternals' form-association
// surface is ABSENT in jsdom — ui-select extends UIFormElement, so stub it once at the prototype (guarded; a
// no-op if a future jsdom ships the real methods) before any specimen connects.
if (typeof ElementInternals.prototype.setFormValue !== 'function') {
  ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
  ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
}

// The committed providers.json (the switcher's single source of truth): anthropic is implemented (4 models,
// the default); openai + gemini ship implemented:false ⇒ 2 disabled provider options, 1 selectable.
const IMPLEMENTED = 'anthropic'
const DEFAULT_MODEL = 'claude-sonnet-5'

describe('mountSwitcher — the ui-select dogfooding migration (Batch D)', () => {
  let slot: HTMLElement

  beforeEach(() => {
    localStorage.clear()
    slot = document.createElement('div')
    document.body.append(slot) // ui-select needs to be CONNECTED to build its parts + move options in
  })
  afterEach(() => {
    slot.remove()
    localStorage.clear()
  })

  it('renders two ui-select controls (no native <select> remains)', async () => {
    mountSwitcher(slot)
    await whenFlushed()
    expect(slot.querySelectorAll('ui-select')).toHaveLength(2)
    expect(slot.querySelector('select')).toBeNull()
  })

  it('derives provider options from providers.json and disables the unimplemented ("coming soon") ones', async () => {
    mountSwitcher(slot)
    await whenFlushed()
    const provSel = slot.querySelectorAll('ui-select')[0]!
    // Options are moved into the internal [data-part=listbox] at connect; querySelectorAll on the host finds them.
    expect(provSel.querySelectorAll('[role=option]')).toHaveLength(3) // anthropic, openai, gemini
    expect(provSel.querySelectorAll('[role=option][disabled]')).toHaveLength(2) // openai + gemini
    expect((provSel as unknown as { value: string }).value).toBe(IMPLEMENTED)
  })

  it('populates the model select from the current provider and sets the default model', async () => {
    mountSwitcher(slot)
    await whenFlushed()
    const modelSel = slot.querySelectorAll('ui-select')[1]!
    expect(modelSel.querySelectorAll('[role=option]')).toHaveLength(4) // anthropic ships 4 models
    expect((modelSel as unknown as { value: string }).value).toBe(DEFAULT_MODEL)
  })

  it('exposes the live {provider, model} and rebuilds the model select when the provider changes', async () => {
    const ref = mountSwitcher(slot)
    await whenFlushed()
    expect(ref.get()).toEqual({ provider: IMPLEMENTED, model: DEFAULT_MODEL })

    // Drive the provider `select` seam directly (only anthropic ships implemented today, so a real roving
    // commit could not reach openai — this exercises the rebuild wiring the fillModels() replaceChildren used
    // to own): set the value + fire `select`, exactly as a committed selection would.
    const provSel = slot.querySelectorAll('ui-select')[0]!
    ;(provSel as unknown as { value: string }).value = 'openai'
    provSel.dispatchEvent(new Event('select'))
    await whenFlushed()

    expect(ref.get()).toEqual({ provider: 'openai', model: 'gpt-4.1' }) // openai.defaultModel
    const modelSel = slot.querySelectorAll('ui-select')[1]! // the swapped-in fresh element
    expect(modelSel.querySelectorAll('[role=option]')).toHaveLength(2) // openai ships 2 models
    const modelValues = [...modelSel.querySelectorAll('[role=option]')].map((o) => o.getAttribute('value'))
    expect(modelValues).toEqual(['gpt-4.1', 'gpt-4.1-mini'])
  })

  it('persists a committed model selection to localStorage', async () => {
    const ref = mountSwitcher(slot)
    await whenFlushed()
    const modelSel = slot.querySelectorAll('ui-select')[1]!
    ;(modelSel as unknown as { value: string }).value = 'claude-opus-4-8'
    modelSel.dispatchEvent(new Event('select'))
    await whenFlushed()
    expect(ref.get().model).toBe('claude-opus-4-8')
    expect(JSON.parse(localStorage.getItem('a2ui-live-provider-selection') ?? 'null')).toEqual({
      provider: IMPLEMENTED,
      model: 'claude-opus-4-8',
    })
  })
})
