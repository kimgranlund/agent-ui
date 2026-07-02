// form-e2e.browser.test.ts — the G7 DoD END-TO-END PROOF (goals.md §G7 final box · decomp
// g7-field-form-provider.decomp.json slice s13 · field-form-provider.lld.md §4 s13 · ADR-0050/0051).
//
// ONE realistic, keyboard-only form scenario — composed the way a consumer actually would (real
// light-DOM markup, component-styles loaded, a realistic flex container): button + text-field + checkbox
// + switch + select, EACH wrapped in its own `ui-field`, coordinated by ONE `ui-form-provider`. A single
// keyboard actor drives the whole journey — Tab / Space / Enter / Arrow only, no click/pointer input
// anywhere below the setup (the leading focus sentinel and the Submit-button wiring are setup, not probes).
//
// What is proven here (none of this resolves in jsdom — every leg needs a REAL engine):
//   [1] Tab order reaches every control, in document order, across the five ui-field wrappers.
//   [2] Each control operates by its OWN keyboard contract: type+Enter (text-field) · Space
//       (checkbox/switch) · ArrowDown-open→Arrow-navigate→Enter-commit (select, per its Wave-4 model —
//       LLD-C9 notes its trigger-text accessible name stands in this wave, the name-forwarding wire being
//       a flagged follow-up, not this one).
//   [3] The error law (LLD-C4): a single untouched blur past the required-empty text-field reveals its
//       FIELD's visible error (the ONE wired error leg this wave — LLD-C9/F4); typing + committing clears it.
//   [4] The aggregate: provider.values() matches every entered value, keyed by name; invalid()/valid()
//       track the required control's state.
//   [5] submit() (LLD-C7): the INVALID leg (false, reportValidity() anchors focus on the first invalid
//       control, no change emitted) and the VALID leg (true, ONE change with the full aggregate detail,
//       event.target === the provider).
//   [6] reset(): values restore to their defaults AND the visible error re-suppresses (no post-reset
//       danger flash — the tracker's `interacted` flag resets together with the value, LLD-C4).
//
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). No geometry/forced-colors assertions here —
// this file's whole job is the keyboard JOURNEY; the individual controls' own browser smokes already cover
// geometry/whole-shape/forced-colors (checkbox.browser.test.ts, select.browser.test.ts, et al.).
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the component sheet (pulls in field.css/form-provider.css, s12), then the self-defining family
// barrel (registers ui-field/ui-form-provider alongside the four controls under test in one line).
import { describe, it, expect, afterEach } from 'vitest'
import { server, userEvent } from '@vitest/browser/context'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'
import type { UIFormProviderElement, FormSubmitDetail } from './form-provider.ts'
import type { UIFieldElement } from '../field/field.ts'
import type { UITextFieldElement } from '../text-field/text-field.ts'
import type { UICheckboxElement } from '../checkbox/checkbox.ts'
import type { UISwitchElement } from '../switch/switch.ts'
import type { UISelectElement } from '../select/select.ts'
import type { UIButtonElement } from '../button/button.ts'

// A single queued microtask — field.ts's error-render is now a reactive `effect()` over the connect
// detail's tracked closures (design #3, landed 2026-07-01 — replaced the event-driven raw-microtask defer
// that s11 falsified for a REAL UA-driven blur); effects still flush on the next microtask, so a probe
// reading the visible error right after the triggering key event must let that microtask run first.
const microtask = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve))

// ── mount/cleanup ────────────────────────────────────────────────────────────────────────────────────
const mounted: HTMLElement[] = []
afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) mounted.pop()?.remove()
})

interface Rig {
  before: HTMLButtonElement
  provider: UIFormProviderElement
  nameField: UIFieldElement
  nameControl: UITextFieldElement
  nameEditor: HTMLElement
  nameError: HTMLElement
  subscribeControl: UICheckboxElement
  notifyControl: UISwitchElement
  planControl: UISelectElement
  planTrigger: HTMLElement
  planListbox: HTMLElement
  submitBtn: UIButtonElement
}

/**
 * Build the whole scenario as ONE realistic light-DOM tree and mount it in ONE insertion (the bulk-connect
 * leg — LLD-C1's third registration edge case). Wires the Submit button the way a consumer actually would:
 * a click listener calling `provider.submit()` (the form-provider-demo.ts site page's own pattern) —
 * `pressActivation` turns the button's own Enter/Space into a real `click()`, so this is the ONE non-probe
 * setup step standing in for "the app wired its Submit handler."
 */
function mount(): Rig {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;max-inline-size:24rem'
  wrap.innerHTML = `
    <button type="button" data-role="before-sentinel">before</button>
    <ui-form-provider>
      <ui-field label="Full name" description="Required">
        <ui-text-field name="name" required></ui-text-field>
      </ui-field>
      <ui-field label="Subscribe to the newsletter">
        <ui-checkbox name="subscribe"></ui-checkbox>
      </ui-field>
      <ui-field label="Enable notifications">
        <ui-switch name="notify"></ui-switch>
      </ui-field>
      <ui-field label="Plan">
        <ui-select name="plan" placeholder="Choose a plan">
          <div role="option" value="free">Free</div>
          <div role="option" value="pro">Pro</div>
        </ui-select>
      </ui-field>
      <ui-field label="Submit">
        <ui-button>Submit</ui-button>
      </ui-field>
    </ui-form-provider>
  `
  document.body.append(wrap)
  mounted.push(wrap)

  const provider = wrap.querySelector('ui-form-provider') as UIFormProviderElement
  const nameField = wrap.querySelector('ui-field') as UIFieldElement // the FIRST field, document order
  const nameControl = nameField.querySelector('ui-text-field') as UITextFieldElement
  const submitBtn = wrap.querySelector('ui-button') as UIButtonElement

  submitBtn.addEventListener('click', () => provider.submit())

  return {
    before: wrap.querySelector('[data-role="before-sentinel"]') as HTMLButtonElement,
    provider,
    nameField,
    nameControl,
    nameEditor: nameControl.querySelector('[data-part="editor"]') as HTMLElement,
    nameError: nameField.querySelector('[data-part="error"]') as HTMLElement,
    subscribeControl: wrap.querySelector('ui-checkbox') as UICheckboxElement,
    notifyControl: wrap.querySelector('ui-switch') as UISwitchElement,
    planControl: wrap.querySelector('ui-select') as UISelectElement,
    planTrigger: wrap.querySelector('[data-part="trigger"]') as HTMLElement,
    planListbox: wrap.querySelector('[data-part="listbox"]') as HTMLElement,
    submitBtn,
  }
}

describe('G7 DoD — Tab order does not skip a CLOSED ui-select', () => {
  // FIXED 2026-07-01 (container-box.css — the CSS root cause): `:where([data-box]) { display: flow-root }`
  // (ADR-0046) was unconditional — author-origin CSS always wins over user-agent CSS regardless of
  // specificity, so it defeated the UA's native `[popover]:not(:popover-open){display:none}` hidden-until-
  // shown rule for any panel carrying BOTH `[data-box]` and `[popover]` (rovingFocus's `tabindex=0` on the
  // current option stayed real and Tab-reachable while the panel was closed). The fix re-asserts the UA
  // semantics with a specificity-0 `:where([data-box][popover]:not(:popover-open)) { display: none }`
  // (container-box.browser.test.ts pins the computed-style law directly; this is the journey-level
  // consequence, a REAL ui-select). Chromium keeps the real-Tab journey below (the true proof).
  //
  // WebKit INSTRUMENT BRIDGE (ruled 2026-07-01 — a broken TOOL substituted while the behavior is proven by
  // other means, never a product-bug workaround that would hide broken behavior): Playwright-WebKit's
  // `userEvent.tab()` mis-skips
  // near ANY `[popover]`-attributed element regardless of state (same tool-limitation class as s11's
  // locator-engine gap) — confirmed with a minimal, zero-framework repro: three plain `<button>`s, the
  // middle bearing a bare `popover="manual"` attribute, NO `[data-box]`, NO project CSS loaded at all, and
  // `userEvent.tab()` still lands nowhere reachable. Not a source defect, so the WebKit leg asserts the
  // BEHAVIORAL EQUIVALENT instead of routing through the broken tool path: (a) the closed panel computes
  // `display:none`, (b) a closed option — inside a display:none ancestor — REFUSES focus (activeElement
  // unchanged), (c) the trigger IS focusable/reachable. Re-test trigger: restore the real-Tab form here the
  // next time a vitest-browser/Playwright upgrade is verified to fix the underlying `userEvent.tab()` gap.
  it('Tab reaches the select trigger and then the next control, never landing inside the closed listbox', async () => {
    const { before, notifyControl, planTrigger, planListbox, submitBtn } = mount()

    before.focus()
    for (let i = 0; i < 3; i++) await userEvent.tab() // before → editor → checkbox → switch
    expect(document.activeElement, 'setup: Tab did not reach the switch').toBe(notifyControl)

    if (server.browser === 'webkit') {
      // (a) the closed panel computes display:none (the CSS fix, container-box.browser.test.ts's own law)
      expect(getComputedStyle(planListbox).display, 'the closed listbox is not display:none').toBe('none')
      // (b) a closed option (display:none via its ancestor) REFUSES focus — activeElement stays put
      const closedOption = planListbox.querySelector('[role="option"]') as HTMLElement
      const beforeFocus = document.activeElement
      closedOption.focus()
      expect(document.activeElement, 'a closed-panel option accepted focus').toBe(beforeFocus)
      // (c) the trigger IS focusable/reachable
      planTrigger.focus()
      expect(document.activeElement, 'the select trigger did not accept focus').toBe(planTrigger)
      submitBtn.focus()
      expect(document.activeElement, 'the submit button did not accept focus').toBe(submitBtn)
    } else {
      await userEvent.tab() // switch → the select's trigger (should NOT land inside the closed panel)
      expect(document.activeElement, 'Tab did not land on the select trigger').toBe(planTrigger)

      await userEvent.tab() // trigger → submit (the closed panel must be skipped entirely)
      expect(document.activeElement, 'Tab did not land on the submit button').toBe(submitBtn)
    }
  })
})

describe('G7 DoD — a fielded, provider-coordinated form operates end-to-end, keyboard-only (both engines)', () => {
  it('Tab traverses every control; each operates by its own keyboard contract; the error law, the aggregate, submit(), and reset() all hold', async () => {
    const {
      before,
      provider,
      nameField,
      nameControl,
      nameEditor,
      nameError,
      subscribeControl,
      notifyControl,
      planControl,
      planTrigger,
      planListbox,
      submitBtn,
    } = mount()

    const providerChanges: CustomEvent<FormSubmitDetail>[] = []
    provider.addEventListener('change', (e) => {
      if (e.target === provider) providerChanges.push(e as CustomEvent<FormSubmitDetail>)
    })

    // ── [1] Tab order, leg 1: before → the text-field's editor part ─────────────────────────────────
    before.focus() // a deterministic starting point — not itself a probed control
    await userEvent.tab()
    expect(document.activeElement, 'Tab did not land on the text-field editor').toBe(nameEditor)

    // ── [3] the error law — leave the required field EMPTY, Tab AWAY (one plain blur) ───────────────
    await userEvent.tab() // Tab order leg 2: editor → the checkbox host
    expect(document.activeElement, 'Tab did not land on the checkbox').toBe(subscribeControl)
    await microtask() // the reactive render effect flushes on the next microtask (field.ts design #3)
    expect(nameError.hidden, 'a single untouched blur did not reveal the field error').toBe(false)
    expect(getComputedStyle(nameError).display, 'the error node has no layout box').toBe('block')
    expect(nameError.textContent, 'the error node carries no validation message').toBeTruthy()
    expect(nameField.matches(':state(user-invalid)'), ':state(user-invalid) did not arm on the field').toBe(true)

    // ── [2] Space toggles the checkbox ───────────────────────────────────────────────────────────────
    expect(subscribeControl.checked, 'checkbox started checked').toBe(false)
    await userEvent.keyboard(' ')
    expect(subscribeControl.checked, 'Space did not toggle the checkbox').toBe(true)

    // ── Tab order leg 3: checkbox → the switch host ──────────────────────────────────────────────────
    await userEvent.tab()
    expect(document.activeElement, 'Tab did not land on the switch').toBe(notifyControl)
    expect(notifyControl.checked, 'switch started checked').toBe(false)
    await userEvent.keyboard(' ')
    expect(notifyControl.checked, 'Space did not toggle the switch').toBe(true)

    // ── Tab order leg 4: switch → the select's trigger button part ─────────────────────────────────
    // INSTRUMENT BRIDGE (ruled 2026-07-01, not a product-bug workaround): Playwright-WebKit's
    // `userEvent.tab()` mis-skips near ANY `[popover]`-attributed element regardless of state — confirmed
    // with a minimal, zero-framework repro (three plain `<button>`s, the middle bearing a bare
    // `popover="manual"` attribute, NO `[data-box]`, NO project CSS loaded at all — `userEvent.tab()` still
    // lands nowhere reachable). This is the TOOL, not the product: the behavior itself is proven by (a)
    // Chromium's real Tab immediately below (the true keyboard proof) and (b) the dedicated behavioral-
    // equivalent test above (closed panel display:none, a closed option refuses focus, the trigger IS
    // reachable). So WebKit bridges this ONE hop with a direct `.focus()` rather than routing through the
    // broken tool call; every other hop in this journey stays a real Tab in both engines. Re-test trigger:
    // drop this branch and restore a real Tab here once a vitest-browser/Playwright upgrade is verified to
    // fix the underlying gap.
    if (server.browser === 'webkit') planTrigger.focus()
    else await userEvent.tab()
    expect(document.activeElement, 'Tab did not land on the select trigger').toBe(planTrigger)

    // ── [2] the select's Wave-4 keyboard model: ArrowDown opens + seeds focus, Arrow roves, Enter commits ──
    await userEvent.keyboard('{ArrowDown}')
    await planControl.updateComplete
    expect(planListbox.matches(':popover-open'), 'ArrowDown did not open the listbox').toBe(true)
    expect(planListbox.contains(document.activeElement), 'focus did not move into the listbox').toBe(true)

    await userEvent.keyboard('{ArrowDown}') // rovingFocus seeded "Free" on open — one more step lands "Pro"
    await new Promise((r) => setTimeout(r, 0))
    await planControl.updateComplete
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 0)) // the Popover toggle + restoreFocus queued task (select's own idiom)
    await planControl.updateComplete

    expect(planControl.value, 'Enter did not commit the roved option').toBe('pro')
    expect(planListbox.matches(':popover-open'), 'commit did not close the listbox').toBe(false)
    expect(document.activeElement, 'commit did not restore focus to the trigger').toBe(planTrigger)

    // ── Tab order leg 5: select trigger → the submit button (completes the FULL traversal) ──────────
    // Same INSTRUMENT BRIDGE as leg 4's full comment above — Chromium real Tab, WebKit the direct-focus
    // bridge (the tool-limitation citation, the proof-by-(a)+(b), and the re-test trigger all live there).
    if (server.browser === 'webkit') submitBtn.focus()
    else await userEvent.tab()
    expect(document.activeElement, 'Tab did not land on the submit button').toBe(submitBtn)

    // ── [4] the aggregate mid-journey: the required field is still empty → invalid()/valid() reflect it ──
    expect(provider.valid(), 'valid() is true with the required field still empty').toBe(false)
    expect(provider.invalid(), 'invalid() does not name the empty required control').toEqual([nameControl])

    // ── [5] submit(), the INVALID leg: Enter "clicks" Submit → false, reportValidity() anchors focus ──
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 0))
    expect(providerChanges, 'a change fired on an invalid submit').toHaveLength(0)
    expect(document.activeElement, 'reportValidity() did not anchor focus on the first invalid control').toBe(
      nameEditor,
    )

    // ── [2]/[3] fix the required field: type + commit via Enter (focus is already there, from the anchor) ──
    // (Chromium-only stray-newline bug — press-activation.ts's Enter keydown now consumes the default
    // action via preventDefault(), same as Space's already-explicit one — fixed fleet-wide; see the
    // dedicated regression test below.)
    await userEvent.keyboard('Ada Lovelace{Enter}')
    await microtask()
    expect(nameControl.value, 'typing did not reach the field value').toBe('Ada Lovelace')
    expect(nameError.hidden, 'the field error did not clear after fixing the value').toBe(true)
    expect(nameField.matches(':state(user-invalid)'), ':state(user-invalid) persisted after the fix').toBe(false)

    // ── [4] the aggregate, fully entered — every value, keyed by name ────────────────────────────────
    expect(provider.valid(), 'valid() is false after fixing the required field').toBe(true)
    expect(provider.invalid()).toEqual([])
    expect(provider.values()).toEqual({ name: 'Ada Lovelace', subscribe: 'on', notify: 'on', plan: 'pro' })

    // ── back to Submit, keyboard-only (Tab is a no-op on the already-set controls in between) ──────
    await userEvent.tab() // editor → checkbox
    await userEvent.tab() // checkbox → switch
    // Same INSTRUMENT BRIDGE as leg 4 above (switch → trigger → submit) — Chromium real Tab, WebKit the
    // direct-focus bridge (full citation + re-test trigger at leg 4).
    if (server.browser === 'webkit') submitBtn.focus()
    else {
      await userEvent.tab() // switch → select trigger
      await userEvent.tab() // trigger → submit
    }
    expect(document.activeElement, 'Tab did not return to the submit button').toBe(submitBtn)

    // ── [5] submit(), the VALID leg: ONE change, target === provider, the full aggregate detail ──────
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 0))
    expect(providerChanges, 'a valid submit did not emit exactly one provider change').toHaveLength(1)
    expect(providerChanges[0]?.target, 'the change did not target the provider').toBe(provider)
    expect(providerChanges[0]?.detail).toEqual({
      entries: [
        ['name', 'Ada Lovelace'],
        ['subscribe', 'on'],
        ['notify', 'on'],
        ['plan', 'pro'],
      ],
      values: { name: 'Ada Lovelace', subscribe: 'on', notify: 'on', plan: 'pro' },
    })

    // ── [6] reset(): values restore to defaults; the visible error stays SUPPRESSED (no danger flash) ──
    provider.reset()
    expect(nameControl.value, 'reset() did not restore the text-field default').toBe('')
    expect(subscribeControl.checked, 'reset() did not restore the checkbox default').toBe(false)
    expect(notifyControl.checked, 'reset() did not restore the switch default').toBe(false)
    expect(planControl.value, 'reset() did not restore the select default').toBe('')
    await microtask() // the reactive render effect flushes on tracker.reset()'s signal write (field.ts design #3)
    // the required field is EMPTY again post-reset — the danger-flash negative control: the tracker's
    // `interacted` flag resets WITH the value (LLD-C4), so no error must reappear.
    expect(nameError.hidden, 'reset() left a stale danger flash on the required-now-empty field').toBe(true)
    expect(nameField.matches(':state(user-invalid)'), 'reset() left :state(user-invalid) armed').toBe(false)
    expect(provider.values(), 'reset() aggregate did not match the (now empty/unchecked) defaults').toEqual({
      name: '',
    })
  })
})

describe('G7 DoD — typing right after an invalid submit does not corrupt the value (regression, Chromium)', () => {
  // FIXED 2026-07-01 (traits/press-activation.ts, bug-B — cross-engine e2e-caught, root-caused there): an
  // Enter keydown on the Submit button synchronously ran pressActivation → host.click() → provider.submit()
  // → reportValidity(), which refocuses the empty required text-field's contenteditable editor MID-DISPATCH
  // of that same Enter keypress. In Chromium (not WebKit), the browser's native "Enter inserts a newline"
  // contenteditable default action then applied to the NEWLY-focused editor rather than the original target
  // (the Enter keydown listener's `host.click()` call doesn't itself consume the browser's own default
  // action), leaving a stray placeholder newline that corrupted the next typed character. The fix consumes
  // the default action explicitly (`e.preventDefault()` on Enter, matching Space's already-explicit one) —
  // fleet-wide, not select/field-specific. Isolated here as the regression lock.
  it('Enter on Submit (invalid) refocuses the empty required field; typing next should not gain a leading newline', async () => {
    // A DEDICATED minimal rig (field + provider + button ONLY, no checkbox/switch/select) — the smallest
    // shape that reproduces the defect, so a real Tab reaches the Submit button in exactly one hop.
    const wrap = document.createElement('div')
    wrap.innerHTML = `
      <button type="button" data-role="before-sentinel">before</button>
      <ui-form-provider>
        <ui-field label="Name">
          <ui-text-field name="name" required></ui-text-field>
        </ui-field>
        <ui-button>Submit</ui-button>
      </ui-form-provider>
    `
    document.body.append(wrap)
    mounted.push(wrap)
    const provider = wrap.querySelector('ui-form-provider') as UIFormProviderElement
    const nameControl = wrap.querySelector('ui-text-field') as UITextFieldElement
    const nameEditor = nameControl.querySelector('[data-part="editor"]') as HTMLElement
    const before = wrap.querySelector('[data-role="before-sentinel"]') as HTMLElement
    const submitBtn = wrap.querySelector('ui-button') as UIButtonElement
    submitBtn.addEventListener('click', () => provider.submit())

    before.focus()
    await userEvent.tab() // -> editor
    await userEvent.tab() // -> submit button
    await userEvent.keyboard('{Enter}') // invalid submit — reportValidity() refocuses the editor
    await new Promise((r) => setTimeout(r, 0))
    expect(document.activeElement, 'reportValidity() did not anchor focus on the editor').toBe(nameEditor)

    await userEvent.keyboard('hi')
    expect(nameControl.value, 'the typed value gained a stray leading newline').toBe('hi')
  })
})
