import { describe, it, expect } from 'vitest'
import '../text-field/text-field.ts' // registers ui-text-field ONLY — ui-field stays undefined until the dynamic import below

// s8 — the dedicated late-define/upgrade-order probe (LLD-C1 / ADR-0051 cl.5), isolated in its own file so
// vitest's per-file module graph makes "field.ts imported AFTER the DOM already exists" deterministic: any
// OTHER test file in this folder that statically imports `./field.ts` would self-define `ui-field` at
// import time, making this scenario unreachable. The upgrade caveat this covers: custom-element UPGRADE
// follows DEFINE order, not tree order — a pre-existing `<ui-field>` markup can sit un-upgraded (a generic
// element, not yet `UIFieldElement`) while its slotted control is ALREADY a fully-defined, fully-connected
// `ui-text-field`; the field's one-shot catch-up scan at ITS OWN (later) connect is what associates it.
//
// Unaffected by task #9 (the announceFormConnect null-signal crash — see field.test.ts's header): the
// control here fully completes its OWN connectedCallback as a plain, ordinary single-element insertion
// BEFORE `ui-field` is ever defined (it isn't a custom element yet, just a generic tag) — so by the time
// `ui-field` upgrades and its catch-up scan calls `announceFormConnect()`, the control's connectionSignal
// is already long-settled (no same-batch connect race).

// jsdom lacks the ElementInternals form-association surface entirely (setFormValue/setValidity are
// undefined) — patch the SHARED PROTOTYPE once, before any control connects. A per-instance stub (the
// house convention elsewhere) doesn't fit here: the control connects the INSTANT the innerHTML below lands
// (upgrade-at-parse), before script gets a handle on it to stub per-instance.
;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = (): void => {}
;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = (): void => {}

describe('UIFieldElement — late-define/upgrade-order catch-up (LLD-C1 / ADR-0051 cl.5)', () => {
  it('a control connected BEFORE ui-field is defined still associates once the field module upgrades it', async () => {
    // Build the DOM FIRST: `<ui-field>` is an unknown/generic element (not yet defined) wrapping an
    // ALREADY-DEFINED `<ui-text-field>`, which connects normally the instant this markup lands.
    document.body.innerHTML = `
      <ui-field label="Email address">
        <ui-text-field></ui-text-field>
      </ui-field>
    `
    const field = document.querySelector('ui-field') as HTMLElement
    const control = document.querySelector('ui-text-field') as HTMLElement
    const editor = control.querySelector('[data-part="editor"]') as HTMLElement

    expect(customElements.get('ui-field')).toBeUndefined() // still un-upgraded — no listener has ever been live
    expect(editor.hasAttribute('aria-labelledby')).toBe(false) // no association possible yet

    const { UIFieldElement: FieldClass } = await import('./field.ts') // upgrade: self-defines ui-field
    expect(customElements.get('ui-field')).toBe(FieldClass)
    expect(field).toBeInstanceOf(FieldClass) // upgraded IN PLACE — same node, not re-mounted

    const labelPart = field.querySelector('[data-part="label"]') as HTMLElement
    expect(editor.getAttribute('aria-labelledby')).toBe(labelPart.id) // the catch-up scan associated it

    document.body.innerHTML = ''
  })
})
