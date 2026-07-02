import { describe, it, expect } from 'vitest'
import '../calendar/calendar.ts' // registers ui-calendar BEFORE any text-field connects — so the internal
// <ui-calendar> a type=date field creates upgrades (and connects) SYNCHRONOUSLY, reproducing the exact
// nested-member shape the fix (dom/form.ts) closes. text-field.test.ts never imports this module, so its
// own date-type probes never actually upgrade a calendar — this file exists BECAUSE that combination
// matters (the real app / the barrel registers both).
import '../text-field/text-field.ts' // registers ui-text-field
import { UIFormProviderElement } from './form-provider.ts'
import type { UITextFieldElement } from '../text-field/text-field.ts'

// form-provider-date.test.ts — the REAL repro shape for the nested-member guard (dom/form.ts): a NEW file
// beside form-provider.test.ts (s9's file), NOT an addition to it. Flagged in the build handoff — s9's
// file conventions were left untouched rather than assumed; this scenario needs BOTH a real ui-text-field
// AND a real ui-calendar registered, neither of which form-provider.test.ts's own MemberEl fixture (a bare
// UIFormElement leaf) exercises.
//
// The bug (A2UI patterns-page-caught, coordinator-ruled): `ui-text-field type=date` creates its own
// internal `<ui-calendar>` (itself a `UIFormElement`, for its unrelated internal value-picking UI) and
// appends it INSIDE itself. Wrapped in a `ui-form-provider`, the provider's catch-up scan
// (`querySelectorAll('*')` + `instanceof`) used to discover the calendar as a phantom SECOND member —
// its aggregate reads fed back into the field's own effects, an unbounded write-loop (the kernel's
// ~100-wave budget throw). The fix (dom/form.ts `#dispatchFormConnect`/`#hasFormElementAncestor`): a
// `UIFormElement` never announces when it has a `UIFormElement` ancestor — the calendar is an INTERNAL
// PART of the text-field, never a registry member.
//
// jsdom lacks the ElementInternals form-association surface (setFormValue/setValidity) — patch the SHARED
// PROTOTYPE once (the field-late-define.test.ts precedent), NOT per-instance: the internal <ui-calendar>
// is created and connects DEEP inside ui-text-field's own connected() (the type=date effect), before any
// script gets a handle on it to stub per-instance.
;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = (): void => {}
;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = (): void => {}

describe('ui-form-provider + ui-text-field type=date — the nested-calendar phantom-member repro (fixed)', () => {
  it('converges to exactly ONE registered member (the text-field); no write-loop throw', () => {
    const provider = new UIFormProviderElement()
    const field = document.createElement('ui-text-field') as UITextFieldElement
    field.setAttribute('type', 'date')
    field.setAttribute('name', 'd')
    provider.append(field) // offline — the field's own connect (and its internal calendar's) fires on the bulk insert below

    // The repro: pre-fix, this threw the kernel's ~100-wave write-loop budget error (calendar↔field↔
    // provider aggregation feedback). Post-fix, the calendar never announces at all — nothing to loop.
    expect(() => document.body.append(provider)).not.toThrow()

    expect(provider.controls).toHaveLength(1) // exactly the text-field — the calendar never registers
    expect(provider.controls).toContain(field)

    // Anti-vacuous: confirm the internal <ui-calendar> actually exists and upgraded (a real UIFormElement,
    // not an inert generic tag) — otherwise this probe would trivially pass without exercising the shape.
    const calendar = field.querySelector('ui-calendar')
    expect(calendar, 'setup: the internal <ui-calendar> was never created — the repro shape is vacuous').not.toBeNull()
    expect(customElements.get('ui-calendar'), 'setup: ui-calendar never upgraded — the repro shape is vacuous').toBeDefined()

    provider.remove()
  })
})
