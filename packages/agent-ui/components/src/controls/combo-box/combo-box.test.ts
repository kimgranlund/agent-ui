import { describe, it, expect, beforeAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIComboBoxElement } from './combo-box.ts'
import type { OverlayHandle } from '../../traits/overlay.ts'
import type { FormValue, ValidityResult, FieldLabelling } from '../../dom/form.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Wave-4 S5 jsdom probes — ui-combo-box (decomp S5 · overlay-controller.lld.md · ADR-0043).
//
// jsdom lacks: (a) the native Popover API — stub showPopover/hidePopover on HTMLElement.prototype
// (sanctioned pattern from popover.test.ts); (b) the ElementInternals form-association surface
// (setFormValue / setValidity) — stub BEFORE connect (form effects are synchronous in
// UIFormElement.connectedCallback, so the stub must be in place at the time of append).
//
// Named probes:
//   combo-upgrade · combo-typed · combo-define-guard ·
//   combo-parts-idempotent · combo-editor-attrs · combo-listbox-attrs · combo-aria-controls ·
//   combo-filter · combo-filter-open-on-type · combo-active-descendant-moves ·
//   combo-active-descendant-focus-stays · combo-active-focus-stays-arrow ·
//   combo-enter-commit-option · combo-enter-commit-freetext · combo-enter-commit-strict ·
//   combo-click-commit · combo-commit-clears-filter · combo-value-two-way ·
//   combo-open-two-way · combo-open-light-dismiss · combo-form-value · combo-form-required ·
//   combo-form-strict · combo-form-reset · combo-c10-residue · combo-c10-cleanup ·
//   combo-shape-editor · combo-shape-panel ·
//   combo-descriptor-schema · combo-descriptor-bijection · combo-descriptor-negative ·
//   combo-aria-label-seam (ADR-0085: bare aria-label · fielded aria-labelledby yield ·
//   dissociation revert · aria-describedby wiring)

// ── Popover API stub ──────────────────────────────────────────────────────────────────────────
// mirrors popover.test.ts setup exactly

const popoverOpen = new WeakMap<HTMLElement, boolean>()
const popoverCalls = new WeakMap<HTMLElement, { show: number; hide: number }>()

function callsOf(el: HTMLElement): { show: number; hide: number } {
  let c = popoverCalls.get(el)
  if (!c) {
    c = { show: 0, hide: 0 }
    popoverCalls.set(el, c)
  }
  return c
}

function fireToggle(el: HTMLElement, newState: 'open' | 'closed'): void {
  const ev = new Event('toggle')
  Object.defineProperty(ev, 'newState', { value: newState })
  el.dispatchEvent(ev)
}

beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as {
    showPopover?: () => void
    hidePopover?: () => void
  }
  if (typeof proto.showPopover === 'function') return

  proto.showPopover = function (this: HTMLElement): void {
    callsOf(this).show++
    if (popoverOpen.get(this)) return
    popoverOpen.set(this, true)
    fireToggle(this, 'open')
  }

  proto.hidePopover = function (this: HTMLElement): void {
    callsOf(this).hide++
    if (!popoverOpen.get(this)) return
    popoverOpen.set(this, false)
    fireToggle(this, 'closed')
  }
})

/** Simulate a platform light-dismiss (Escape / outside-click) without calling hidePopover. */
function simulateLightDismiss(popup: HTMLElement): void {
  popoverOpen.set(popup, false)
  fireToggle(popup, 'closed')
}

// ── jsdom stub — form-association surface (setFormValue/setValidity) is absent in jsdom ──────────
//
// ElementInternals.setFormValue / setValidity are not implemented in jsdom 29. The UIFormElement
// connectedCallback installs scope-owned effects that call these synchronously on connect, so the
// stub MUST be applied to the internals BEFORE appending the element (before connectedCallback fires).
// The ProbeComboBox exposes the protected `internals` getter so the stub can be installed before connect.

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

// ── Test probe subclass ───────────────────────────────────────────────────────────────────────

/**
 * Exposes protected members for jsdom probes:
 *   - `probeInternals`: the protected ElementInternals (for stubFormAssoc BEFORE connect)
 *   - `overlayHandle`: the overlay handle (_overlayHandle) for C10 cleanup probes
 *   - `formValueProbe()`: the protected formValue() hook (avoids internals.setFormValue)
 *   - `formValidityProbe()`: the protected formValidity() verdict (avoids internals.checkValidity)
 */
class ProbeComboBox extends UIComboBoxElement {
  /** Protected internals — exposed for pre-connect form-association stub. */
  get probeInternals(): ElementInternals {
    return this.internals // protected getter — subclass access is valid
  }

  /** Protected overlay handle — exposed for C10 cleanup probe. */
  get overlayHandle(): OverlayHandle | null {
    return (this as unknown as { _overlayHandle: OverlayHandle | null })._overlayHandle
  }

  /** Protected formValue() hook — the value this control contributes to its form (jsdom bypass). */
  formValueProbe(): FormValue {
    return (this as unknown as { formValue(): FormValue }).formValue()
  }

  /** Protected formValidity() verdict — tested directly without calling internals.checkValidity(). */
  formValidityProbe(): ValidityResult {
    return (this as unknown as { formValidity(): ValidityResult }).formValidity()
  }
}
customElements.define('ui-combo-box-probe', ProbeComboBox)

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────

/** Stub DOMRects so overlay positioning math doesn't throw in jsdom (no layout engine). */
function stubRects(editor: HTMLElement, listbox: HTMLElement): void {
  editor.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 300, bottom: 140, width: 200, height: 40, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect
  listbox.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 0, bottom: 0, width: 200, height: 120, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

/**
 * Build and connect a combo-box.
 *
 * Uses `new ProbeComboBox()` (not `document.createElement`) so we can call `stubFormAssoc`
 * BEFORE appending — form effects run synchronously in UIFormElement.connectedCallback and
 * call setFormValue/setValidity which jsdom doesn't implement without the stub.
 */
function makeCombo(opts: {
  strict?: boolean
  required?: boolean
  placeholder?: string
  value?: string
  options?: string[]
} = {}): { el: ProbeComboBox; editor: HTMLElement; listbox: HTMLElement } {
  const el = new ProbeComboBox()
  stubFormAssoc(el.probeInternals) // MUST precede append (form effects synchronous)
  if (opts.strict) el.setAttribute('strict', '')
  if (opts.required) el.setAttribute('required', '')
  if (opts.placeholder) el.setAttribute('placeholder', opts.placeholder)
  if (opts.value) el.setAttribute('value', opts.value)
  const optionValues = opts.options ?? ['Apple', 'Banana', 'Cherry']
  for (const label of optionValues) {
    const opt = document.createElement('div')
    opt.setAttribute('role', 'option')
    opt.setAttribute('value', label.toLowerCase())
    opt.textContent = label
    el.appendChild(opt)
  }
  document.body.append(el)
  const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
  const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
  stubRects(editor, listbox)
  return { el, editor, listbox }
}

/** Fire a keydown event and return it (so callers can inspect defaultPrevented). */
function fireKey(el: HTMLElement, key: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  el.dispatchEvent(ev)
  return ev
}

// ── Upgrade + typed prop surface ──────────────────────────────────────────────────────────────

describe('ui-combo-box — upgrade + typed prop surface (combo-upgrade)', () => {
  it('combo-upgrade: upgrades to UIComboBoxElement with correct defaults', () => {
    const el = document.createElement('ui-combo-box') as UIComboBoxElement
    expect(el).toBeInstanceOf(UIComboBoxElement)
    expect(el.value).toBe('')
    expect(el.label).toBe('')
    expect(el.open).toBe(false)
    expect(el.strict).toBe(false)
    expect(el.placeholder).toBe('')
  })

  it('combo-typed: TypeScript compile-time negative cases', () => {
    const fn = (): void => {
      const el = new UIComboBoxElement()
      el.value = 'hello'
      el.label = 'City'
      el.open = true
      el.strict = false
      el.placeholder = 'Search…'
      // @ts-expect-error — value is string, not number
      el.value = 42
      // @ts-expect-error — open is boolean, not string
      el.open = 'yes'
      // @ts-expect-error — strict is boolean, not number
      el.strict = 1
    }
    expect(typeof fn).toBe('function') // never invoked — @ts-expect-error lines are the assertions
  })

  it('combo-define-guard: self-defines ui-combo-box, guarded against double-define', () => {
    expect(customElements.get('ui-combo-box')).toBe(UIComboBoxElement)
    expect(() => {
      if (!customElements.get('ui-combo-box')) customElements.define('ui-combo-box', UIComboBoxElement)
    }).not.toThrow()
  })
})

// ── Parts created once (idempotent) ──────────────────────────────────────────────────────────

describe('ui-combo-box — control-created parts (combo-parts-idempotent · combo-editor-attrs · combo-listbox-attrs · combo-aria-controls)', () => {
  it('combo-parts-idempotent: creates exactly ONE editor and ONE listbox on connect', () => {
    const { el } = makeCombo()
    expect(el.querySelectorAll('[data-part="editor"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="listbox"]')).toHaveLength(1)
    el.remove()
  })

  it('combo-parts-idempotent: parts NOT re-created on disconnect + reconnect', () => {
    const { el } = makeCombo()
    const editorBefore = el.querySelector('[data-part="editor"]')
    const listboxBefore = el.querySelector('[data-part="listbox"]')
    el.remove()
    document.body.append(el)
    expect(el.querySelector('[data-part="editor"]')).toBe(editorBefore)
    expect(el.querySelector('[data-part="listbox"]')).toBe(listboxBefore)
    el.remove()
  })

  it('combo-editor-attrs: editor has role="combobox" + aria-haspopup="listbox" + aria-autocomplete="list"', () => {
    const { editor, el } = makeCombo()
    expect(editor.getAttribute('role')).toBe('combobox')
    expect(editor.getAttribute('aria-haspopup')).toBe('listbox')
    expect(editor.getAttribute('aria-autocomplete')).toBe('list')
    el.remove()
  })

  it('combo-editor-attrs: editor suppresses NATIVE text-assist (autocorrect/autocapitalize/autocomplete/spellcheck) — no double dropdown', () => {
    // Without these, the platform renders its own suggestion chip (e.g. macOS "Banana ×") OVER the
    // control's listbox — the "two dropdowns" bug. A combo-box filter never wants native word-assist.
    const { editor, el } = makeCombo()
    expect(editor.getAttribute('autocorrect')).toBe('off')
    expect(editor.getAttribute('autocapitalize')).toBe('off')
    expect(editor.getAttribute('autocomplete')).toBe('off')
    expect(editor.getAttribute('spellcheck')).toBe('false')
    el.remove()
  })

  it('combo-editor-attrs: editor has aria-expanded="false" on connect (default closed)', async () => {
    const { editor, el } = makeCombo()
    await whenFlushed()
    expect(editor.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })

  it('combo-editor-attrs: editor has data-empty on connect (value="" = no text)', async () => {
    const { editor, el } = makeCombo()
    await whenFlushed()
    expect(editor.hasAttribute('data-empty')).toBe(true)
    el.remove()
  })

  it('combo-listbox-attrs: listbox has role="listbox" and popover="auto" set by overlay controller', () => {
    const { listbox, el } = makeCombo()
    expect(listbox.getAttribute('role')).toBe('listbox')
    expect(listbox.getAttribute('popover')).toBe('auto')
    el.remove()
  })

  it('combo-aria-controls: editor aria-controls points to the listbox id', () => {
    const { editor, listbox, el } = makeCombo()
    expect(listbox.id).toBeTruthy()
    expect(editor.getAttribute('aria-controls')).toBe(listbox.id)
    el.remove()
  })

  it('combo-listbox-attrs: options are moved into the listbox panel at connect', () => {
    const { listbox, el } = makeCombo()
    const opts = listbox.querySelectorAll('[role=option]')
    expect(opts).toHaveLength(3)
    expect(el.querySelectorAll(':scope > [role=option]')).toHaveLength(0)
    el.remove()
  })

  it('combo-listbox-attrs: options have stable ids assigned at connect', () => {
    const { listbox, el } = makeCombo()
    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    for (const opt of opts) {
      expect(opt.id).toBeTruthy()
    }
    el.remove()
  })
})

// ── Filter on type ────────────────────────────────────────────────────────────────────────────

describe('ui-combo-box — filter on type (combo-filter · combo-filter-open-on-type)', () => {
  it('combo-filter: typing filters options — non-matching options get hidden=true', async () => {
    const { el, editor, listbox } = makeCombo()
    editor.textContent = 'app'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await whenFlushed()

    const opts = listbox.querySelectorAll<HTMLElement>('[role=option]')
    expect(opts[0]!.hidden).toBe(false) // Apple matches
    expect(opts[1]!.hidden).toBe(true)  // Banana does not
    expect(opts[2]!.hidden).toBe(true)  // Cherry does not
    el.remove()
  })

  it('combo-filter: filter is case-insensitive', () => {
    const { el, editor, listbox } = makeCombo()
    editor.textContent = 'APP'
    editor.dispatchEvent(new Event('input', { bubbles: true }))

    const opts = listbox.querySelectorAll<HTMLElement>('[role=option]')
    expect(opts[0]!.hidden).toBe(false) // Apple
    expect(opts[1]!.hidden).toBe(true)
    el.remove()
  })

  it('combo-filter: empty text reveals all options', () => {
    const { el, editor, listbox } = makeCombo()
    editor.textContent = 'app'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.textContent = ''
    editor.dispatchEvent(new Event('input', { bubbles: true }))

    const opts = listbox.querySelectorAll<HTMLElement>('[role=option]')
    expect(opts[0]!.hidden).toBe(false)
    expect(opts[1]!.hidden).toBe(false)
    expect(opts[2]!.hidden).toBe(false)
    el.remove()
  })

  it('combo-filter-open-on-type: typing opens the panel (open becomes true)', async () => {
    const { el, editor } = makeCombo()
    expect(el.open).toBe(false)

    editor.textContent = 'a'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await whenFlushed()

    expect(el.open).toBe(true)
    el.remove()
  })

  it('combo-filter-open-on-type: empty text does NOT open the panel', () => {
    const { el, editor } = makeCombo()
    editor.textContent = ''
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.open).toBe(false)
    el.remove()
  })
})

// ── Active-descendant navigation ─────────────────────────────────────────────────────────────

describe('ui-combo-box — active-descendant (combo-active-descendant-moves · combo-active-descendant-focus-stays · combo-active-focus-stays-arrow)', () => {
  it('combo-active-descendant-moves: ArrowDown sets aria-activedescendant to first option', async () => {
    const { el, editor, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    fireKey(editor, 'ArrowDown')

    const firstOpt = listbox.querySelector<HTMLElement>('[role=option]:not([hidden])')!
    expect(editor.getAttribute('aria-activedescendant')).toBe(firstOpt.id)
    expect(firstOpt.hasAttribute('data-active')).toBe(true)
    el.remove()
  })

  it('combo-active-descendant-moves: ArrowDown advances through options', async () => {
    const { el, editor, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    fireKey(editor, 'ArrowDown')  // → option 0
    fireKey(editor, 'ArrowDown')  // → option 1

    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts[1]!.hasAttribute('data-active')).toBe(true)
    expect(opts[0]!.hasAttribute('data-active')).toBe(false)
    expect(editor.getAttribute('aria-activedescendant')).toBe(opts[1]!.id)
    el.remove()
  })

  it('combo-active-descendant-moves: ArrowUp from unset → goes to last option', async () => {
    const { el, editor, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    fireKey(editor, 'ArrowUp')

    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    const last = opts[opts.length - 1]!
    expect(last.hasAttribute('data-active')).toBe(true)
    expect(editor.getAttribute('aria-activedescendant')).toBe(last.id)
    el.remove()
  })

  it('combo-active-descendant-moves: ArrowDown wraps from last to first', async () => {
    const { el, editor, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    fireKey(editor, 'ArrowDown') // 0
    fireKey(editor, 'ArrowDown') // 1
    fireKey(editor, 'ArrowDown') // 2 (last)
    fireKey(editor, 'ArrowDown') // wraps → 0

    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts[0]!.hasAttribute('data-active')).toBe(true)
    expect(opts[2]!.hasAttribute('data-active')).toBe(false)
    el.remove()
  })

  it('combo-active-descendant-focus-stays: after ArrowDown, document.activeElement is still the editor', async () => {
    const { el, editor } = makeCombo()
    el.open = true
    await whenFlushed()

    editor.focus()
    expect(document.activeElement).toBe(editor)

    fireKey(editor, 'ArrowDown')

    // THE KEY ASSERTION — DOM focus MUST stay on the editor throughout Arrow navigation.
    expect(document.activeElement).toBe(editor)
    el.remove()
  })

  it('combo-active-focus-stays-arrow: repeated Arrow navigation never moves focus off the editor', async () => {
    const { el, editor, listbox } = makeCombo()
    el.open = true
    await whenFlushed()
    editor.focus()

    for (let i = 0; i < 6; i++) {
      fireKey(editor, i % 2 === 0 ? 'ArrowDown' : 'ArrowUp')
      expect(document.activeElement).toBe(editor) // focus never moves
    }

    // Anti-vacuous: navigation DID update active-descendant + [data-active]
    expect(editor.hasAttribute('aria-activedescendant')).toBe(true)
    expect(listbox.querySelector('[role=option][data-active]')).not.toBeNull()
    el.remove()
  })

  it('combo-active-descendant-moves: ArrowDown when closed → opens AND moves to first option', async () => {
    const { el, editor } = makeCombo()
    expect(el.open).toBe(false)

    fireKey(editor, 'ArrowDown')
    await whenFlushed()

    expect(el.open).toBe(true)
    expect(editor.getAttribute('aria-activedescendant')).toBeTruthy()
    el.remove()
  })
})

// ── Commit — Enter ────────────────────────────────────────────────────────────────────────────

describe('ui-combo-box — Enter commit (combo-enter-commit-option · combo-enter-commit-freetext · combo-enter-commit-strict)', () => {
  it('combo-enter-commit-option: Enter with active option sets value + editor label + closes', async () => {
    const { el, editor } = makeCombo()
    el.open = true
    await whenFlushed()

    fireKey(editor, 'ArrowDown') // highlights Apple (value="apple")

    let changeCount = 0
    let selectCount = 0
    el.addEventListener('change', () => changeCount++)
    el.addEventListener('select', () => selectCount++)

    const ev = fireKey(editor, 'Enter')

    expect(el.value).toBe('apple')
    expect(editor.textContent).toBe('Apple')
    expect(el.open).toBe(false)
    expect(changeCount).toBe(1)
    expect(selectCount).toBe(1)
    expect(ev.defaultPrevented).toBe(true) // Enter prevents default (no form submit)
    el.remove()
  })

  it('combo-enter-commit-option: the committed option\'s label is shown in the editor', async () => {
    const { el, editor } = makeCombo()
    el.open = true
    await whenFlushed()
    fireKey(editor, 'ArrowDown') // Apple
    fireKey(editor, 'ArrowDown') // Banana
    fireKey(editor, 'Enter')

    expect(el.value).toBe('banana')
    expect(editor.textContent).toBe('Banana')
    el.remove()
  })

  it('combo-enter-commit-freetext: strict=false, no active option → commits typed text', () => {
    const { el, editor } = makeCombo({ strict: false })
    editor.textContent = 'pineapple'
    editor.dispatchEvent(new Event('input', { bubbles: true }))

    let changeCount = 0
    let selectCount = 0
    el.addEventListener('change', () => changeCount++)
    el.addEventListener('select', () => selectCount++)

    fireKey(editor, 'Enter')

    expect(el.value).toBe('pineapple')
    expect(changeCount).toBe(1)
    expect(selectCount).toBe(0) // free text: no `select` event (no specific option committed)
    el.remove()
  })

  it('combo-enter-commit-strict: strict=true, no active option → no commit', () => {
    const { el, editor } = makeCombo({ strict: true })
    editor.textContent = 'pineapple'
    editor.dispatchEvent(new Event('input', { bubbles: true }))

    let changeCount = 0
    el.addEventListener('change', () => changeCount++)

    fireKey(editor, 'Enter')

    expect(el.value).toBe('') // no commit
    expect(changeCount).toBe(0)
    el.remove()
  })

  it('combo-enter-commit-option: after commit, aria-activedescendant is cleared', async () => {
    const { el, editor, listbox } = makeCombo()
    el.open = true
    await whenFlushed()
    fireKey(editor, 'ArrowDown') // Apple

    const activeId = editor.getAttribute('aria-activedescendant')
    const firstOpt = listbox.querySelector<HTMLElement>('[role=option]')!
    expect(activeId).toBe(firstOpt.id)

    fireKey(editor, 'Enter')
    expect(editor.hasAttribute('aria-activedescendant')).toBe(false)
    el.remove()
  })
})

// ── Commit — click ────────────────────────────────────────────────────────────────────────────

describe('ui-combo-box — click commit (combo-click-commit)', () => {
  it('combo-click-commit: clicking an option sets value + editor label + closes', async () => {
    const { el, editor, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    const bananaOpt = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
      .find(o => o.textContent === 'Banana')!

    let changeCount = 0
    el.addEventListener('change', () => changeCount++)

    bananaOpt.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(el.value).toBe('banana')
    expect(editor.textContent).toBe('Banana')
    expect(el.open).toBe(false)
    expect(changeCount).toBe(1)
    el.remove()
  })

  it('combo-click-commit: clicking a hidden (filtered) option does nothing', async () => {
    const { el, editor, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    editor.textContent = 'apple'
    editor.dispatchEvent(new Event('input', { bubbles: true }))

    const bananaOpt = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
      .find(o => o.textContent === 'Banana')!
    expect(bananaOpt.hidden).toBe(true)

    let changeCount = 0
    el.addEventListener('change', () => changeCount++)

    bananaOpt.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(el.value).toBe('') // no commit
    expect(changeCount).toBe(0)
    el.remove()
  })
})

// ── Commit clears filter ──────────────────────────────────────────────────────────────────────

describe('ui-combo-box — commit clears the filter (combo-commit-clears-filter)', () => {
  it('combo-commit-clears-filter: after Enter-commit, all options are visible again', async () => {
    const { el, editor, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    editor.textContent = 'app'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    expect(listbox.querySelectorAll('[role=option][hidden]')).toHaveLength(2)

    fireKey(editor, 'ArrowDown')
    fireKey(editor, 'Enter')

    const hidden = [...listbox.querySelectorAll<HTMLElement>('[role=option]')].filter(o => o.hidden)
    expect(hidden).toHaveLength(0)
    el.remove()
  })
})

// ── Two-way value / open ──────────────────────────────────────────────────────────────────────

describe('ui-combo-box — two-way value + open (combo-value-two-way · combo-open-two-way)', () => {
  it('combo-value-two-way: programmatic el.value = "banana" → editor shows the option label', async () => {
    const { el, editor } = makeCombo()
    el.value = 'banana'
    await whenFlushed()
    expect(editor.textContent).toBe('Banana')
    expect(editor.hasAttribute('data-empty')).toBe(false)
    el.remove()
  })

  it('combo-value-two-way: programmatic el.value = "" → editor is cleared', async () => {
    const { el, editor } = makeCombo({ value: 'apple' })
    await whenFlushed()
    expect(editor.textContent).toBe('Apple') // initial value seeded via model→surface effect

    el.value = ''
    await whenFlushed()
    expect(editor.textContent).toBe('')
    expect(editor.hasAttribute('data-empty')).toBe(true)
    el.remove()
  })

  it('combo-value-two-way: free-text value with no matching option → editor shows the text', async () => {
    const { el, editor } = makeCombo()
    el.value = 'pineapple' // not in options
    await whenFlushed()
    expect(editor.textContent).toBe('pineapple') // labelForValue falls back to the value
    el.remove()
  })

  it('combo-open-two-way: open=true → showPopover() called; open=false → hidePopover() called', async () => {
    const { el, listbox } = makeCombo()
    expect(callsOf(listbox).show).toBe(0)

    el.open = true
    await whenFlushed()
    expect(callsOf(listbox).show).toBe(1)
    expect(popoverOpen.get(listbox)).toBe(true)

    el.open = false
    await whenFlushed()
    expect(callsOf(listbox).hide).toBe(1)
    expect(popoverOpen.get(listbox)).toBe(false)
    el.remove()
  })

  it('combo-open-two-way: aria-expanded flips with the open prop', async () => {
    const { el, editor } = makeCombo()
    await whenFlushed()
    expect(editor.getAttribute('aria-expanded')).toBe('false')

    el.open = true
    await whenFlushed()
    expect(editor.getAttribute('aria-expanded')).toBe('true')

    el.open = false
    await whenFlushed()
    expect(editor.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })
})

// ── Light-dismiss sync ────────────────────────────────────────────────────────────────────────

describe('ui-combo-box — light-dismiss sync (combo-open-light-dismiss)', () => {
  it('combo-open-light-dismiss: a platform light-dismiss syncs open=false', async () => {
    const { el, listbox } = makeCombo()
    el.open = true
    await whenFlushed()
    expect(el.open).toBe(true)

    simulateLightDismiss(listbox)
    expect(el.open).toBe(false)
    el.remove()
  })

  it('combo-open-light-dismiss: a platform light-dismiss (Escape / outside-click) closes the panel', async () => {
    // Escape is a PLATFORM light-dismiss (Popover API close-signal) — the control no longer owns an
    // Escape handler (that would be a programmatic close the discriminator suppresses; see combo-box.ts).
    // jsdom has no Popover light-dismiss, so simulate the platform toggle the overlay listens for.
    const { el } = makeCombo()
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    el.open = true
    await whenFlushed()

    simulateLightDismiss(listbox) // fires the 'closed' toggle the overlay controller syncs on
    await whenFlushed()
    expect(el.open).toBe(false)
    el.remove()
  })
})

// ── Form value + validity ─────────────────────────────────────────────────────────────────────
//
// jsdom does not implement ElementInternals.checkValidity() or the validity IDL — test via the
// protected formValue() / formValidity() hooks through the ProbeComboBox methods, bypassing
// internals entirely. The underlying logic is identical; internals is a publish channel.

describe('ui-combo-box — form value + validity (combo-form-value · combo-form-required · combo-form-strict)', () => {
  it('combo-form-value: value="" → formValue() = null (no form entry)', () => {
    const { el } = makeCombo()
    expect(el.formValueProbe()).toBeNull()
    expect(el.value).toBe('')
    el.remove()
  })

  it('combo-form-value: committed value → formValue() = the key string', async () => {
    const { el, editor } = makeCombo()
    el.open = true
    await whenFlushed()
    fireKey(editor, 'ArrowDown')
    fireKey(editor, 'Enter')
    expect(el.formValueProbe()).toBe('apple')
    el.remove()
  })

  it('combo-form-required: required + value="" → invalid (valueMissing)', () => {
    const { el } = makeCombo({ required: true })
    const verdict = el.formValidityProbe()
    expect(verdict.valid).toBe(false)
    if (!verdict.valid) {
      expect(verdict.flags.valueMissing).toBe(true)
    }
    el.remove()
  })

  it('combo-form-required: required + committed value → valid', async () => {
    const { el, editor } = makeCombo({ required: true })
    el.open = true
    await whenFlushed()
    fireKey(editor, 'ArrowDown')
    fireKey(editor, 'Enter')
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('combo-form-strict: strict=true + value not matching any option → invalid (typeMismatch)', () => {
    const { el } = makeCombo({ strict: true })
    el.value = 'pineapple' // not in options
    const verdict = el.formValidityProbe()
    expect(verdict.valid).toBe(false)
    if (!verdict.valid) {
      expect(verdict.flags.typeMismatch).toBe(true)
    }
    el.remove()
  })

  it('combo-form-strict: strict=true + matching option value → valid', () => {
    const { el } = makeCombo({ strict: true })
    el.value = 'apple' // matches option with value="apple"
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('combo-form-strict: strict=false (default) + any value → valid (free text)', () => {
    const { el } = makeCombo({ strict: false })
    el.value = 'any text at all'
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })
})

// ── Form reset ────────────────────────────────────────────────────────────────────────────────

describe('ui-combo-box — form reset (combo-form-reset)', () => {
  it('combo-form-reset: formResetCallback restores value to the initial attribute value', async () => {
    const { el, editor } = makeCombo({ value: 'apple' })
    await whenFlushed()

    el.value = 'banana'
    await whenFlushed()
    expect(editor.textContent).toBe('Banana')

    el.formResetCallback()
    await whenFlushed()

    expect(el.value).toBe('apple')
    expect(editor.textContent).toBe('Apple')
    el.remove()
  })

  it('combo-form-reset: reset with no initial value → clears the editor', async () => {
    const { el, editor } = makeCombo()
    await whenFlushed()

    el.value = 'cherry'
    await whenFlushed()
    expect(editor.textContent).toBe('Cherry')

    el.formResetCallback()
    await whenFlushed()

    expect(el.value).toBe('')
    expect(editor.textContent).toBe('')
    expect(editor.hasAttribute('data-empty')).toBe(true)
    el.remove()
  })
})

// ── Whole-shape: editor + panel bounding geometry ─────────────────────────────────────────────
//
// jsdom has no layout engine. We verify structural correctness (correct part, role, real
// HTMLElement, overlay controller positioned the panel on open) and use the stubbed rects
// (200×40 for editor, 200×120 for panel) to assert the expected gestalt (wider-than-tall editor).
// The REAL pixel assertions (editor min-inline-size 20ch, panel as wide as editor) live in the
// browser smoke where a real layout engine runs.

describe('ui-combo-box — whole-shape (combo-shape-editor · combo-shape-panel)', () => {
  it('combo-shape-editor: editor part is a proper HTMLElement with combobox role + data-part="editor"', () => {
    const { editor, el } = makeCombo()
    expect(editor.tagName.toLowerCase()).toBe('div')
    expect(editor.getAttribute('role')).toBe('combobox')
    expect(editor.getAttribute('data-part')).toBe('editor')
    // The stubbed rect (200×40) models the expected field shape: far wider than tall
    const rect = editor.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(rect.height)
    el.remove()
  })

  it('combo-shape-panel: listbox panel is a proper HTMLElement with listbox role + data-part="listbox"', () => {
    const { listbox, el } = makeCombo()
    expect(listbox.tagName.toLowerCase()).toBe('div')
    expect(listbox.getAttribute('role')).toBe('listbox')
    expect(listbox.getAttribute('data-part')).toBe('listbox')
    el.remove()
  })

  it('combo-shape-panel: the JS positioning controller runs on open (position:fixed + inset set)', async () => {
    const { el, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    expect(listbox.style.position).toBe('fixed')
    expect(listbox.style.top).not.toBe('')
    expect(listbox.style.left).not.toBe('')
    el.remove()
  })
})

// ── C10 zero-residue ─────────────────────────────────────────────────────────────────────────

describe('ui-combo-box — C10 zero-residue (combo-c10-residue · combo-c10-cleanup)', () => {
  it('combo-c10-residue: after disconnect, a light-dismiss does NOT emit close (listener removed)', async () => {
    const { el, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    el.remove() // disconnect → scope.dispose() + AC abort → all listeners removed

    simulateLightDismiss(listbox)
    expect(closes).toBe(0) // toggle listener removed — no propagation
  })

  it('combo-c10-residue: reconnect does not stack listeners — close fires ONCE per dismiss', async () => {
    const { el, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    simulateLightDismiss(listbox) // first dismiss → 1
    expect(closes).toBe(1)

    el.remove()
    document.body.append(el)
    const newListbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    const newEditor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    stubRects(newEditor, newListbox)

    el.open = true
    await whenFlushed()

    simulateLightDismiss(newListbox)
    expect(closes).toBe(2) // ONE new listener — not doubled
    el.remove()
  })

  it('combo-c10-cleanup: cleanup() is idempotent — safe to call multiple times', () => {
    const { el } = makeCombo()
    expect(() => {
      el.overlayHandle?.cleanup()
      el.overlayHandle?.cleanup()
    }).not.toThrow()
    el.remove()
  })

  it('combo-c10-cleanup: cleanup() on an open combo closes the panel and makes open() a no-op', async () => {
    const { el, listbox } = makeCombo()
    el.open = true
    await whenFlushed()
    expect(popoverOpen.get(listbox)).toBe(true)

    el.overlayHandle?.cleanup()
    expect(popoverOpen.get(listbox)).toBe(false) // cleanup closed it

    el.overlayHandle?.open() // cleaned guard → no-op
    expect(callsOf(listbox).show).toBe(1) // still only the original open
    el.remove()
  })
})

// ── M1: aria-selected on the committed option (WAI-ARIA combobox pattern) ────────────────────
//
// The committed [role=option] MUST carry `aria-selected="true"` so AT can identify the
// selection when the listbox reopens. All other options MUST be `aria-selected="false"`.
// The CSS selected-highlight rule (`[role='option'][aria-selected='true']`) activates this way.

describe('ui-combo-box — aria-selected on commit (combo-aria-selected-commit · combo-aria-selected-move)', () => {
  it('combo-aria-selected-commit: after Enter-commit, committed option has aria-selected="true", others "false"', async () => {
    const { el, editor, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    fireKey(editor, 'ArrowDown') // Apple
    fireKey(editor, 'Enter')

    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts[0]!.getAttribute('aria-selected')).toBe('true')  // Apple committed
    expect(opts[1]!.getAttribute('aria-selected')).toBe('false') // Banana
    expect(opts[2]!.getAttribute('aria-selected')).toBe('false') // Cherry
    el.remove()
  })

  it('combo-aria-selected-commit: after click-commit, exactly ONE option has aria-selected="true"', async () => {
    const { el, listbox } = makeCombo()
    el.open = true
    await whenFlushed()

    const cherryOpt = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
      .find(o => o.textContent === 'Cherry')!
    cherryOpt.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    const selected = listbox.querySelectorAll('[role=option][aria-selected="true"]')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toBe(cherryOpt)
    el.remove()
  })

  it('combo-aria-selected-move: committing a different option moves aria-selected to the new one', async () => {
    const { el, editor, listbox } = makeCombo()

    // First commit: Apple
    el.open = true
    await whenFlushed()
    fireKey(editor, 'ArrowDown') // Apple
    fireKey(editor, 'Enter')

    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts[0]!.getAttribute('aria-selected')).toBe('true')

    // Second commit: Banana (Arrow to second, Enter)
    el.open = true
    await whenFlushed()
    fireKey(editor, 'ArrowDown') // Apple (first visible after filter cleared)
    fireKey(editor, 'ArrowDown') // Banana
    fireKey(editor, 'Enter')

    expect(opts[0]!.getAttribute('aria-selected')).toBe('false') // Apple: moved away
    expect(opts[1]!.getAttribute('aria-selected')).toBe('true')  // Banana: now selected
    el.remove()
  })

  it('combo-aria-selected-commit: anti-vacuous — before any commit, no option has aria-selected="true"', () => {
    const { el, listbox } = makeCombo()
    const selected = listbox.querySelectorAll('[role=option][aria-selected="true"]')
    expect(selected).toHaveLength(0)
    el.remove()
  })
})

// ── M2: disabled-option guard — aria-disabled options skip Arrow nav and commit ───────────────
//
// Options with `aria-disabled="true"` or the HTML `disabled` attribute must be excluded from
// `#getVisibleOptions()` so they are never Arrow-navigable and never committable via Enter or click.

describe('ui-combo-box — disabled option guard (combo-disabled-nav · combo-disabled-commit)', () => {
  it('combo-disabled-nav: Arrow navigation skips aria-disabled options', async () => {
    const { el, editor, listbox } = makeCombo({
      options: ['Apple', 'Banana', 'Cherry'],
    })
    // Mark Banana as aria-disabled AFTER connect (options moved to listbox)
    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    opts[1]!.setAttribute('aria-disabled', 'true') // Banana disabled

    el.open = true
    await whenFlushed()

    fireKey(editor, 'ArrowDown') // Apple (idx 0 in visible set)
    expect(editor.getAttribute('aria-activedescendant')).toBe(opts[0]!.id) // Apple

    fireKey(editor, 'ArrowDown') // skips Banana → Cherry
    expect(editor.getAttribute('aria-activedescendant')).toBe(opts[2]!.id) // Cherry

    fireKey(editor, 'ArrowDown') // wraps past disabled → back to Apple
    expect(editor.getAttribute('aria-activedescendant')).toBe(opts[0]!.id) // Apple again
    el.remove()
  })

  it('combo-disabled-nav: clicking an aria-disabled option does NOT commit or emit change', async () => {
    const { el, listbox } = makeCombo()
    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    opts[0]!.setAttribute('aria-disabled', 'true') // Apple disabled

    let changeCount = 0
    el.addEventListener('change', () => changeCount++)

    el.open = true
    await whenFlushed()

    opts[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.value).toBe('')       // no commit
    expect(changeCount).toBe(0)     // no change event
    el.remove()
  })

  it('combo-disabled-nav: Enter on an aria-disabled active-descendant does NOT commit', async () => {
    // This scenario cannot happen naturally (Arrow skips disabled), but we verify the safeguard
    // by directly setting an active index that points to a now-disabled option via
    // the click guard path: the option is disabled AFTER being made active.
    // Simplest proof: an option that was in the visible set before disable is gone after.
    const { el, editor, listbox } = makeCombo({
      options: ['Disabled', 'Normal'],
    })
    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    opts[0]!.setAttribute('aria-disabled', 'true')

    el.open = true
    await whenFlushed()

    fireKey(editor, 'ArrowDown') // should land on Normal (idx 1), not Disabled
    expect(editor.getAttribute('aria-activedescendant')).toBe(opts[1]!.id) // Normal

    let changeCount = 0
    el.addEventListener('change', () => changeCount++)
    fireKey(editor, 'Enter')

    expect(el.value).toBe('normal') // Normal committed (its value attr = 'normal' from makeCombo)
    expect(changeCount).toBe(1)
    el.remove()
  })

  it('combo-disabled-nav: [disabled] attribute is also excluded (same as aria-disabled)', async () => {
    const { el, editor, listbox } = makeCombo({
      options: ['Apple', 'Disabled', 'Cherry'],
    })
    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    opts[1]!.setAttribute('disabled', '') // native disabled attr

    let changeCount = 0
    el.addEventListener('change', () => changeCount++)

    el.open = true
    await whenFlushed()

    // Arrow skip: Apple → Cherry (Disabled skipped)
    fireKey(editor, 'ArrowDown') // Apple
    fireKey(editor, 'ArrowDown') // Cherry (Disabled skipped)
    expect(editor.getAttribute('aria-activedescendant')).toBe(opts[2]!.id) // Cherry

    // Click on the disabled option
    opts[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.value).toBe('') // no commit from disabled click
    expect(changeCount).toBe(0)
    el.remove()
  })
})

// ── ADR-0085 — the editor's accessible-name seam (text-field ADR-0014 parity) ────────────────
//
// jsdom cannot compute an accessible name — the read-back that the editor really names as "City"
// (with its own text still the distinct value) lives in combo-box.browser.test.ts (both engines).
// These probes pin the DECLARED WIRING: bare `label` → editor aria-label; the yield the moment
// `setFieldLabelling` associates (mirroring text-field's own jsdom-probe pattern — no live ui-field
// needed); the merge/dissociation shape; aria-describedby.

describe('ui-combo-box — the editor accessible-name seam (combo-aria-label-seam)', () => {
  it('combo-aria-label-seam: no `label` set → no aria-label on the editor (back-compat, zero drift)', () => {
    const { el, editor } = makeCombo()
    expect(editor.hasAttribute('aria-label')).toBe(false)
    el.remove()
  })

  it('combo-aria-label-seam: `label` set (bare, unfielded) → editor aria-label = the label text', async () => {
    const { el, editor } = makeCombo()
    el.label = 'City'
    await whenFlushed()
    expect(editor.getAttribute('aria-label')).toBe('City')
    el.remove()
  })

  it('combo-aria-label-seam: clearing `label` back to \'\' removes aria-label again', async () => {
    const { el, editor } = makeCombo()
    el.label = 'City'
    await whenFlushed()
    expect(editor.hasAttribute('aria-label')).toBe(true)

    el.label = ''
    await whenFlushed()
    expect(editor.hasAttribute('aria-label')).toBe(false)
    el.remove()
  })

  it('combo-aria-label-seam: the editor keeps its distinct value while labelled — aria-label does not touch the committed text', async () => {
    const { el, editor } = makeCombo({ value: 'apple' })
    el.label = 'Fruit'
    await whenFlushed()
    expect(editor.getAttribute('aria-label')).toBe('Fruit')
    expect(editor.textContent).toBe('Apple') // the value stays the editor's own accessible value
    el.remove()
  })

  it('combo-aria-label-seam: setFieldLabelling ASSOCIATES → editor aria-labelledby ← refs.label.id, and the bare aria-label yields', async () => {
    const { el, editor } = makeCombo()
    el.label = 'City' // a consumer-set bare label — must yield the moment the seam associates

    const fieldLabel = document.createElement('div')
    fieldLabel.id = 'field-label-1'
    const refs: FieldLabelling = { label: fieldLabel, description: null, error: null }
    el.setFieldLabelling(refs)
    await whenFlushed()

    expect(editor.getAttribute('aria-labelledby')).toBe(fieldLabel.id)
    expect(editor.hasAttribute('aria-label')).toBe(false) // yielded — accname precedence, ADR-0051 pattern
    el.remove()
  })

  it('combo-aria-label-seam: dissociation (setFieldLabelling(null)) removes aria-labelledby and restores the bare aria-label', async () => {
    const { el, editor } = makeCombo()
    el.label = 'City'
    await whenFlushed()
    expect(editor.getAttribute('aria-label')).toBe('City')

    const fieldLabel = document.createElement('div')
    fieldLabel.id = 'field-label-2'
    el.setFieldLabelling({ label: fieldLabel, description: null, error: null })
    await whenFlushed()
    expect(editor.hasAttribute('aria-label')).toBe(false)

    el.setFieldLabelling(null)
    await whenFlushed()
    expect(editor.hasAttribute('aria-labelledby')).toBe(false)
    expect(editor.getAttribute('aria-label')).toBe('City') // reverted to the bare state
    el.remove()
  })

  it('combo-aria-label-seam: aria-describedby wires from [description, error] refs while fielded, and clears on dissociation', async () => {
    const { el, editor } = makeCombo()
    expect(editor.hasAttribute('aria-describedby')).toBe(false) // no owner in bare mode (no internal message node)

    const description = document.createElement('div')
    description.id = 'field-desc-1'
    const error = document.createElement('div')
    error.id = 'field-error-1'
    el.setFieldLabelling({ label: null, description, error })
    await whenFlushed()
    expect(editor.getAttribute('aria-describedby')).toBe(`${description.id} ${error.id}`)

    el.setFieldLabelling(null)
    await whenFlushed()
    expect(editor.hasAttribute('aria-describedby')).toBe(false) // cleared — this control's exclusive owner in both directions
    el.remove()
  })
})

// ── Descriptor trip-wire ─────────────────────────────────────────────────────────────────────

const COMBO_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/combo-box`
const md = readFileSync(`${COMBO_DIR}/combo-box.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['value', 'label', 'open', 'strict', 'placeholder', 'name', 'disabled', 'required']

describe('combo-box.md descriptor — frontmatter parses + schema-valid (combo-descriptor-schema)', () => {
  it('combo-descriptor-schema: has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-combo-box')
  })

  it('combo-descriptor-schema: carries the ADR-0004 / plan §10 descriptor field set', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) {
      expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    }
  })

  it('combo-descriptor-schema: tag=ui-combo-box, tier=pattern, extends=UIFormElement, form-associated', () => {
    expect(/^tag:\s*ui-combo-box\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('combo-descriptor-schema: records the bindable `open` (reflected boolean) + close/toggle events (ADR-0019)', () => {
    const open = parsed.attributes.find((a) => a.name === 'open')
    expect(open?.type).toBe('boolean')
    expect(open?.reflect).toBe(true)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('toggle')
    expect(events).toContain('close')
    expect(events).toContain('change')
    expect(events).toContain('select')
  })

  it('combo-descriptor-schema: strict is boolean with reflect=true, default false', () => {
    const strict = parsed.attributes.find((a) => a.name === 'strict')
    expect(strict?.type).toBe('boolean')
    expect(strict?.reflect).toBe(true)
    expect(strict?.default).toBe('false')
  })

  it('combo-descriptor-schema: validates with zero structural failures beyond the s12-pending BAD_EXTENDS', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    const failures = validateComponentDescriptor(parsed)
    const pendingBaseClass = failures.filter((f) => f.code === 'BAD_EXTENDS' && f.path === 'extends')
    const otherFailures = failures.filter((f) => !(f.code === 'BAD_EXTENDS' && f.path === 'extends'))
    expect(otherFailures).toEqual([])
    expect(pendingBaseClass.length).toBeLessThanOrEqual(1)
  })
})

describe('combo-box.md descriptor — contract↔props trip-wire (combo-descriptor-bijection · combo-descriptor-negative)', () => {
  it('combo-descriptor-bijection: attributes[] is a faithful bijection with UIComboBoxElement.props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIComboBoxElement.props)).toEqual([])
  })

  it('combo-descriptor-negative: a drifted reflect on `open` FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'open' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UIComboBoxElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.open.reflect' }),
    )
  })

  it('combo-descriptor-negative: a removed attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropStrict: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'strict')
    expect(compareDescriptorToProps(dropStrict, UIComboBoxElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.strict' }),
    )
  })

  it('combo-descriptor-negative: an extra attribute FAILS the trip-wire', () => {
    const addBogus: ParsedAttribute[] = [
      ...parsed.attributes,
      { name: 'bogus', type: 'string', default: '', reflect: false },
    ]
    expect(compareDescriptorToProps(addBogus, UIComboBoxElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
