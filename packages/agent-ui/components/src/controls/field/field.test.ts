import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIFieldElement } from './field.ts'
import { UIFormElement, prop, type PropsSchema } from '../../dom/index.ts'
import { UITextFieldElement } from '../text-field/text-field.ts'
import type { ValidityResult } from '../../dom/form.ts'

// s8 jsdom probes — ui-field (goals.md §G7 / decomp g7-field-form-provider slice s8, LLD-C4). The
// text-field wire (LLD-C2 §wire, LLD-C9) is the ONE control with both the NAME path and the ERROR leg
// wired this wave, so it is the association/validity-timing control throughout.
//
// Three findings surfaced while building this file (all reported to team-lead — #1 and #3 were real bugs,
// both FIXED and verified against the shipped fixes below; #2 was RULED not-a-bug, the design, and this
// file's dissociation/disconnect probes assert the corrected (ruling-given) shape instead):
//   1. task #9 (announceFormConnect's `!isConnected` guard was insufficient for a same-batch subtree
//      connect — FIXED, verified here) — this file exercises BOTH the pre-slotted ("association via the
//      passed-through connect event") and late-slotted orders freely.
//   2. `UIElement.disconnectedCallback()` disposes the connection scope BEFORE aborting the connection
//      signal, so a write made from an `abort`-triggered handler (field's `#dissociate()`) can't reach the
//      REMOVED control's own scope-owned effects — its `applyFieldLabelling`/message-effect DOM cleanup
//      (aria-labelledby/aria-describedby, the internal message node) doesn't re-apply while the control
//      stays DETACHED. RULED (team-lead): not a bug — dispose-before-abort is G1/G2 law (the zero-residue
//      proofs ride it), and a detached node's stale attributes are INERT (no AX tree observes them); the
//      NEXT connect's install-run of those same effects always resolves from the (already-cleared) signal
//      value, converging on every reconnect path (bare re-append, reparent, field+control removed
//      together). The dissociation/disconnect probes below assert exactly this: the FIELD-side state
//      clears immediately (its own direct writes); the CONTROL-side DOM state is asserted post-detach
//      (documented-inert) AND after a bare re-append + flush (cleared at the next connect).
//   3. `blur` doesn't bubble, so both `trackUserInvalid` (on the control host) and the field's gen-1
//      error-render listener registered it with `{capture:true}`; capture dispatch runs ancestor-to-target,
//      so a SYNCHRONOUS read on a single blur saw the control's `userInvalid()` gate BEFORE the control's
//      own capture listener (deeper in the tree) had flipped it. FIXED by the GEN-3 REACTIVE design (the
//      gen-2 one-microtask defer was falsified by UA-dispatch checkpoints and deleted): the error render is
//      a scope-owned effect over the association detail's `userInvalid()`/`validity()` closures
//      (field.ts:141-147) — no listeners, no defer, no ordering dependence. This file drives the
//      validity-timing probes with a single plain `blur` after `await whenFlushed()` (the flush IS the
//      trigger path).

// ── the form-association stub (jsdom lacks the whole surface — same shape as text-field.test.ts). Also
// tracks the LAST `setValidity` message so `internals.validationMessage` (absent in jsdom, but read by
// field's own `#renderValidity()` via the control's public IDL getter) resolves to something real. ────

function asMutable(internals: ElementInternals): Record<string, unknown> {
  return internals as unknown as Record<string, unknown>
}

function stubFormInternals(internals: ElementInternals): void {
  const i = asMutable(internals)
  i.setFormValue = (): void => {}
  i.validationMessage = ''
  i.setValidity = (_flags: unknown, message?: string): void => {
    i.validationMessage = message ?? ''
  }
}

// ── a probe subclass re-exposing the protected internals + formValidity (the text-field.test.ts precedent) ──

class ProbeTextField extends UITextFieldElement {
  get internalsProbe(): ElementInternals {
    return this.internals
  }
  formValidityProbe(): ValidityResult {
    return this.formValidity()
  }
}
customElements.define('ui-field-probe-text-field', ProbeTextField)

/** A fresh, internals-stubbed text-field (NOT yet connected). */
function makeControl(): ProbeTextField {
  const el = new ProbeTextField()
  stubFormInternals(el.internalsProbe)
  return el
}

const editorOf = (el: Element): HTMLElement => el.querySelector('[data-part="editor"]') as HTMLElement
const messageOf = (el: Element): HTMLElement => el.querySelector('.ui-text-field-message') as HTMLElement
const labelPartOf = (field: Element): HTMLElement => field.querySelector('[data-part="label"]') as HTMLElement
const descriptionPartOf = (field: Element): HTMLElement => field.querySelector('[data-part="description"]') as HTMLElement
const errorPartOf = (field: Element): HTMLElement => field.querySelector('[data-part="error"]') as HTMLElement

// ── association via the passed-through connect event (LLD-C4) ──────────────────────────────────────

describe('UIFieldElement — association via the passed-through connect event (LLD-C4)', () => {
  it('field + an already-slotted ui-text-field, connected TOGETHER — the editor gets aria-labelledby = the field label part id', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    field.label = 'Email address'
    const control = makeControl()
    field.append(control) // pre-slotted — both detached before the single insertion below
    document.body.append(field) // one insertion — the field connects first (ancestor-first), the control catches up
    await whenFlushed()
    expect(editorOf(control).getAttribute('aria-labelledby')).toBe(labelPartOf(field).id)
    field.remove()
  })

  it('a control appended AFTER the field is already connected also associates (late-slotted)', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    field.label = 'Name'
    document.body.append(field) // field connects first, no control yet — its connect listener is now live
    const control = makeControl()
    field.append(control) // late add — the control's OWN connect dispatch reaches the already-live listener
    await whenFlushed()
    expect(editorOf(control).getAttribute('aria-labelledby')).toBe(labelPartOf(field).id)
    field.remove()
  })
})

// ── pre-interaction negative control (decomp s2's user-invalid law) ─────────────────────────────────

describe('UIFieldElement — pre-interaction negative control', () => {
  it('invalid-but-untouched (required + empty) shows NO error (no user-invalid flash)', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    const control = makeControl()
    control.required = true
    field.append(control)
    document.body.append(field)
    await whenFlushed()
    const error = errorPartOf(field)
    expect(error.hidden).toBe(true)
    expect(error.textContent).toBe('')
    field.remove()
  })
})

// ── error timing rides the control's userInvalid gate; clears when fixed ───────────────────────────

describe('UIFieldElement — error timing (LLD-C4 #renderValidity)', () => {
  it('blur on an invalid control shows the error; fixing the value + committing clears it', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    const control = makeControl()
    control.required = true
    field.append(control)
    document.body.append(field)
    await whenFlushed()
    const editor = editorOf(control)
    const error = errorPartOf(field)

    editor.dispatchEvent(new Event('blur')) // a single, untouched blur (no prior edit) — finding 3, now fixed
    await whenFlushed()
    expect(error.hidden).toBe(false)
    const verdict = control.formValidityProbe()
    expect(error.textContent).toBe(verdict.valid ? '' : verdict.message)

    editor.textContent = 'now valid'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(error.hidden).toBe(true)
    expect(error.textContent).toBe('')
    field.remove()
  })
})

// ── ONE-message stitching + the aria-describedby retention probe (LLD-C2 §wire, F3) ────────────────

describe('UIFieldElement — one-message stitching + describedby retention (LLD-C2/LLD-C4)', () => {
  it('while associated + user-invalid, the internal message stays empty+hidden and describedby carries the field ids; the ids REMAIN after a fix', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    const control = makeControl()
    control.required = true
    field.append(control)
    document.body.append(field)
    await whenFlushed()
    const editor = editorOf(control)
    const message = messageOf(control)
    const description = descriptionPartOf(field)
    const error = errorPartOf(field)
    const label = labelPartOf(field)

    editor.dispatchEvent(new Event('blur')) // invalid + touched
    await whenFlushed()
    expect(message.hidden).toBe(true) // the control's OWN message node yields — ONE announced error
    expect(message.textContent).toBe('')
    expect(editor.getAttribute('aria-describedby')).toBe(`${description.id} ${error.id}`)

    editor.textContent = 'ok' // fix + re-commit → valid
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    // retention (F3): the describedby ids stay — only the error TEXT emptied, not the static membership
    expect(editor.getAttribute('aria-describedby')).toBe(`${description.id} ${error.id}`)
    expect(editor.getAttribute('aria-labelledby')).toBe(label.id)
    field.remove()
  })
})

// ── the dissociation round-trip (LLD-C4 — the s1-builder probe, ruling-corrected shape) ────────────

describe('UIFieldElement — the dissociation round-trip (F3-residual, corrected per ruling)', () => {
  it('associate → interact-invalid → dissociate → re-append the control BARE → the internal message node is restored', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    const control = makeControl()
    control.required = true
    field.append(control)
    document.body.append(field)
    await whenFlushed()
    const editor = editorOf(control)
    const message = messageOf(control)

    editor.dispatchEvent(new Event('blur')) // associated + user-invalid — the message stitches away
    await whenFlushed()
    expect(message.hidden).toBe(true)

    control.remove() // dissociate — field's #dissociate() runs; the control stays DETACHED for now
    await whenFlushed()

    document.body.append(control) // re-append BARE (no field) — the fresh install-run resolves from
    await whenFlushed() // the (already-cleared) fieldLabelling signal: aria-describedby/labelledby clear
    // a fresh reconnect also means a FRESH trackUserInvalid controller (interacted resets) — re-gate:
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()

    expect(editor.getAttribute('aria-describedby')).toBe(message.id) // the internal message re-referenced
    expect(message.textContent?.length).toBeGreaterThan(0) // carries the validity text again
    expect(message.hidden).toBe(false)
    control.remove()
    field.remove()
  })
})

// ── reset re-suppression, BOTH paths (LLD-C1 ui-form-reset) ─────────────────────────────────────────

describe('UIFieldElement — reset re-suppression, both platform paths', () => {
  it('(a) wrapped in a real <form>: formResetCallback (the platform per-member callback) clears + re-suppresses', async () => {
    // jsdom does not walk a form's FACE members on `form.reset()` (verified separately, matching this
    // suite's house convention of driving the lifecycle callback directly — form.test.ts/text-field.test.ts);
    // `form.reset()` is still called here for the realistic wrapping context, then the platform callback.
    const form = document.createElement('form')
    const field = document.createElement('ui-field') as UIFieldElement
    const control = makeControl()
    control.required = true
    field.append(control)
    form.append(field)
    document.body.append(form)
    await whenFlushed()
    const editor = editorOf(control)
    const error = errorPartOf(field)

    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(error.hidden).toBe(false)

    form.reset()
    control.formResetCallback()
    await whenFlushed()
    expect(error.hidden).toBe(true)
    expect(error.textContent).toBe('')
    form.remove()
  })

  it('(b) form-less (provider-direct path): formResetCallback alone clears + re-suppresses', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    const control = makeControl()
    control.required = true
    field.append(control)
    document.body.append(field)
    await whenFlushed()
    const editor = editorOf(control)
    const error = errorPartOf(field)

    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(error.hidden).toBe(false)

    control.formResetCallback()
    await whenFlushed()
    expect(error.hidden).toBe(true)
    expect(error.textContent).toBe('')
    field.remove()
  })
})

// ── dissociation on control removal (LLD-C4 m3, ruling-corrected shape) ─────────────────────────────

describe('UIFieldElement — dissociation on control removal', () => {
  it('removing the associated control empties the error; a second still-slotted control associates next (per-tenure catch-up)', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    field.label = 'Email'
    const control1 = makeControl()
    control1.required = true
    const control2 = makeControl()
    field.append(control1)
    document.body.append(field)
    await whenFlushed()
    const editor1 = editorOf(control1)
    const error = errorPartOf(field)

    editor1.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(error.hidden).toBe(false) // sanity: showing before removal

    field.append(control2) // a second control — stays un-associated (first-wins) while control1 holds the tenure
    control1.remove() // dissociate control1 — the abort listener fires #dissociate()

    await whenFlushed()
    // field's OWN direct part writes clear immediately (the error is field-owned, never effect-mediated):
    expect(error.hidden).toBe(true)
    expect(error.textContent).toBe('')
    // the documented-inert state (per the ruling): control1 is DETACHED, so its stale aria-labelledby is
    // still present — no AX tree observes a detached node, and this is the design, not a residual bug.
    expect(editor1.getAttribute('aria-labelledby')).not.toBeNull()

    // per-tenure re-arm: the re-scan associates the remaining control2 next
    expect(editorOf(control2).getAttribute('aria-labelledby')).toBe(labelPartOf(field).id)

    // the contract state: control1's labelling SIGNAL was cleared (a plain write, unaffected by scope
    // timing) — observable once control1 goes through a fresh connect's install-run (re-append it bare).
    document.body.append(control1)
    await whenFlushed()
    expect(editor1.hasAttribute('aria-labelledby')).toBe(false)
    control1.remove()
    field.remove()
  })
})

// ── field-disconnect + reconnect (LLD-C4) ───────────────────────────────────────────────────────────

describe('UIFieldElement — field-disconnect + reconnect', () => {
  it('zero residue: post-disconnect, dispatched events on the (still-nested) control no longer move the error', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    const control = makeControl()
    control.required = true
    field.append(control)
    document.body.append(field)
    await whenFlushed()
    const editor = editorOf(control)
    const error = errorPartOf(field)

    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(error.hidden).toBe(false)

    field.remove() // field + its nested control disconnect together — ac.abort() removes field's listeners
    await whenFlushed()
    // pin a known state, then prove no live listener reacts to further events on the detached subtree
    error.hidden = true
    error.textContent = 'sentinel'
    editor.dispatchEvent(new Event('blur'))
    editor.dispatchEvent(new Event('change', { bubbles: true }))
    await whenFlushed()
    expect(error.hidden).toBe(true) // untouched
    expect(error.textContent).toBe('sentinel') // untouched
  })

  it('disconnecting the field (with its control nested) then reconnecting re-associates cleanly, not stacked', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    field.label = 'Name'
    const control = makeControl()
    field.append(control)
    document.body.append(field)
    await whenFlushed()
    const editor = editorOf(control)
    expect(editor.getAttribute('aria-labelledby')).toBe(labelPartOf(field).id)

    field.remove() // field + its nested control disconnect together
    document.body.append(field) // reconnect — fresh scope/AC for both, a clean re-run of the whole flow
    await whenFlushed()
    expect(editor.getAttribute('aria-labelledby')).toBe(labelPartOf(field).id) // re-associated, not stuck
    field.remove()
  })
})

// ── the option-A bridge, both legs (ADR-0051 cl.3) ──────────────────────────────────────────────────

interface LabelledControl {
  label: string
}

class BridgeProbeControl extends UIFormElement {
  static props = { ...UIFormElement.formProps, label: prop.string() } satisfies PropsSchema
  get internalsProbe(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-field-bridge-probe', BridgeProbeControl)

function makeBridgeControl(): BridgeProbeControl & LabelledControl {
  const el = new BridgeProbeControl() as BridgeProbeControl & LabelledControl
  stubFormInternals(el.internalsProbe)
  return el
}

describe('UIFieldElement — the option-A bridge (ADR-0051 cl.3)', () => {
  it('an empty-label control gets bridged (control.label = field.label), tracking later field.label edits; cleared to "" on dissociation', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    field.label = 'Bridged name'
    const control = makeBridgeControl() // label defaults to '' — the bridge's arming condition
    field.append(control)
    document.body.append(field)
    await whenFlushed()
    expect(control.label).toBe('Bridged name')

    field.label = 'Updated name' // the bridge effect tracks the field's label prop
    await whenFlushed()
    expect(control.label).toBe('Updated name')

    control.remove() // dissociate — the bridge disposer runs (direct call, unaffected by finding 2)
    await whenFlushed()
    expect(control.label).toBe('') // bridge-owned — cleared
    field.remove()
  })

  it('a consumer-preset label is never touched, arriving or leaving', async () => {
    const field = document.createElement('ui-field') as UIFieldElement
    field.label = 'Field label'
    const control = makeBridgeControl()
    control.label = 'Consumer label' // pre-set BEFORE association — the bridge must never arm
    field.append(control)
    document.body.append(field)
    await whenFlushed()
    expect(control.label).toBe('Consumer label')

    control.remove()
    await whenFlushed()
    expect(control.label).toBe('Consumer label') // still untouched — never bridge-owned
    field.remove()
  })
})

// ── label/description prop typing (negative control) ────────────────────────────────────────────────

describe('UIFieldElement — label/description are typed string props (negative control)', () => {
  it('label/description accept strings; a non-string assignment fails at compile time', () => {
    const fn = (): void => {
      const field = new UIFieldElement()
      field.label = 'ok'
      field.description = 'also ok'
      // @ts-expect-error — label is a string prop; a number is not assignable
      field.label = 42
      // @ts-expect-error — description is a string prop; a boolean is not assignable
      field.description = true
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors are the assertion
  })
})
