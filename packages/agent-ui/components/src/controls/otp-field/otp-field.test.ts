import { describe, it, expect } from 'vitest'
import { UIOtpFieldElement, cleanLength } from './otp-field.ts'
import { reduce, normalize, firstEmptyOf, routeBeforeInput, type OtpState } from './model.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// S2-a jsdom probes — ui-otp-field (code-entry-control.lld.md §11, GH #490).
//
// Two layers: [A] the PURE model (model.ts) — reduce/routeBeforeInput/normalize/firstEmptyOf, exercised
// directly with zero DOM (the fleet's pure-core testing shape); [B] the CONTROL — real beforeinput/keydown/
// composition/focus/blur events dispatched at a live UIOtpFieldElement, proving the wiring applies the
// reducer's results correctly (value/active/events/echo). A real ClipboardEvent+DataTransfer paste and a
// real pointerdown-with-layout are BOTH left to the browser leg (otp-field.browser.test.ts) per the LLD's own
// split — jsdom cannot measure layout and has no working DataTransfer; every paste-split arm is still fully
// covered here via a multi-character `insertText` (§3 row 2 routes it through the SAME §5 path a real paste
// takes), and the nearest-cell-CENTER pointer-index math (MINOR-4) is covered with each cell's own stubbed
// `getBoundingClientRect`.

const S = (value: string, active: number): OtpState => ({ value, active })

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// [A] the pure model — model.ts
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

describe('normalize (§5)', () => {
  it('strips every non-digit — separators, whitespace, letters', () => {
    expect(normalize('424 242')).toBe('424242')
    expect(normalize('code: 424242')).toBe('424242')
    expect(normalize('a-b-c')).toBe('')
    expect(normalize('123abc456')).toBe('123456')
    expect(normalize('')).toBe('')
  })
})

describe('firstEmptyOf (§3)', () => {
  it('= min(len, n-1)', () => {
    expect(firstEmptyOf(0, 6)).toBe(0)
    expect(firstEmptyOf(3, 6)).toBe(3)
    expect(firstEmptyOf(6, 6)).toBe(5) // a full code parks at the LAST cell
    expect(firstEmptyOf(0, 1)).toBe(0)
  })
})

describe('reduce — focus (first-empty rule)', () => {
  it('parks active at firstEmpty; a full code parks at the last cell', () => {
    expect(reduce(S('', 0), { type: 'focus' }, 6).state.active).toBe(0)
    expect(reduce(S('12', 5), { type: 'focus' }, 6).state.active).toBe(2)
    expect(reduce(S('123456', 0), { type: 'focus' }, 6).state.active).toBe(5)
  })
  it('is an active-only move — never changed, never echoed', () => {
    const r = reduce(S('12', 5), { type: 'focus' }, 6)
    expect(r.changed).toBe(false)
    expect(r.echo).toBeNull()
    expect(r.state.value).toBe('12')
  })
  it('a no-op focus (already at firstEmpty) returns the SAME state reference (unchanged)', () => {
    const state = S('12', 2)
    const r = reduce(state, { type: 'focus' }, 6)
    expect(r.state).toBe(state)
  })
})

describe('reduce — digit (§3 table)', () => {
  it('overwrites at the active cell and auto-advances', () => {
    const r = reduce(S('', 0), { type: 'digit', digit: '4' }, 6)
    expect(r.state).toEqual({ value: '4', active: 1 })
    expect(r.changed).toBe(true)
    expect(r.echo).toEqual({ kind: 'digit', digit: '4' })
  })
  it('appends when active === len', () => {
    expect(reduce(S('12', 2), { type: 'digit', digit: '3' }, 6).state.value).toBe('123')
  })
  it('overwrites an already-filled cell in place (arrow-then-type)', () => {
    const r = reduce(S('123456', 2), { type: 'digit', digit: '9' }, 6)
    expect(r.state.value).toBe('129456')
    expect(r.state.active).toBe(3) // auto-advance clamps to firstEmpty of a full code = 5, but +1 from 2 = 3
  })
  it('auto-advance never passes firstEmpty (full code stays parked at the last cell)', () => {
    const r = reduce(S('12345', 5), { type: 'digit', digit: '6' }, 6)
    expect(r.state).toEqual({ value: '123456', active: 5 })
  })
  it('a non-digit character is filtered — no-op, no event (§3 table)', () => {
    const state = S('12', 2)
    const r = reduce(state, { type: 'digit', digit: 'a' }, 6)
    expect(r.state).toBe(state)
    expect(r.changed).toBe(false)
  })
  it('fires the completion echo/commit exactly on the len<N -> len===N edge', () => {
    const r = reduce(S('12345', 5), { type: 'digit', digit: '6' }, 6)
    expect(r.completed).toBe(true)
    expect(r.echo).toEqual({ kind: 'complete' })
  })
  it('does NOT re-fire completion when the code was already full (overwrite-in-place)', () => {
    const r = reduce(S('123456', 5), { type: 'digit', digit: '9' }, 6)
    expect(r.completed).toBe(false)
    expect(r.echo).toEqual({ kind: 'digit', digit: '9' })
  })
})

describe('reduce — backspace (§3 table, both arms)', () => {
  it('filled-cell arm: splices out the active cell, active stays', () => {
    const r = reduce(S('123', 1), { type: 'backspace' }, 6)
    expect(r.state).toEqual({ value: '13', active: 1 })
    expect(r.echo).toEqual({ kind: 'clear' })
  })
  it('empty-cell arm (active === len): walks back one, then splices', () => {
    const r = reduce(S('12', 2), { type: 'backspace' }, 6)
    expect(r.state).toEqual({ value: '1', active: 1 })
  })
  it('walk-back at active=1,len=1 lands at active=0 after the splice', () => {
    const r = reduce(S('1', 1), { type: 'backspace' }, 6)
    expect(r.state).toEqual({ value: '', active: 0 })
  })
  it('an empty value is a no-op', () => {
    const state = S('', 0)
    const r = reduce(state, { type: 'backspace' }, 6)
    expect(r.state).toBe(state)
    expect(r.changed).toBe(false)
  })
  it('preserves the no-gaps contiguity invariant after every backspace', () => {
    let state: OtpState = { value: '123456', active: 5 }
    for (let i = 0; i < 6; i++) {
      const r = reduce(state, { type: 'backspace' }, 6)
      expect(r.state.value).toMatch(/^[0-9]*$/)
      state = r.state
    }
    expect(state.value).toBe('')
  })
})

describe('reduce — delete forward (§3 table)', () => {
  it('= the filled-cell backspace arm at the active cell (splice, stay)', () => {
    const r = reduce(S('123', 0), { type: 'delete' }, 6)
    expect(r.state).toEqual({ value: '23', active: 0 })
    expect(r.echo).toEqual({ kind: 'clear' })
  })
  it('no-op when the active cell is empty (nothing after the caret)', () => {
    const state = S('12', 2)
    const r = reduce(state, { type: 'delete' }, 6)
    expect(r.state).toBe(state)
    expect(r.changed).toBe(false)
  })
})

describe('reduce — arrow / Home / End (§3 table, clamps at 0 and firstEmpty)', () => {
  it('ArrowLeft clamps at 0', () => {
    expect(reduce(S('123', 0), { type: 'arrow-left' }, 6).state.active).toBe(0)
    expect(reduce(S('123', 2), { type: 'arrow-left' }, 6).state.active).toBe(1)
  })
  it('ArrowRight never passes firstEmpty', () => {
    expect(reduce(S('12', 0), { type: 'arrow-right' }, 6).state.active).toBe(1)
    expect(reduce(S('12', 2), { type: 'arrow-right' }, 6).state.active).toBe(2) // firstEmpty(2,6)=2, already there
  })
  it('Home jumps to 0; End jumps to firstEmpty', () => {
    expect(reduce(S('123', 3), { type: 'home' }, 6).state.active).toBe(0)
    expect(reduce(S('123', 0), { type: 'end' }, 6).state.active).toBe(3)
    expect(reduce(S('123456', 0), { type: 'end' }, 6).state.active).toBe(5)
  })
  it('all four are active-only moves — never changed, never echoed', () => {
    for (const action of [{ type: 'arrow-left' as const }, { type: 'arrow-right' as const }, { type: 'home' as const }, { type: 'end' as const }]) {
      const r = reduce(S('12', 1), action, 6)
      expect(r.changed).toBe(false)
      expect(r.echo).toBeNull()
    }
  })
})

describe('reduce — pointer-down (§3 table)', () => {
  it('a = min(k, firstEmpty) — a click past the fill clamps to the first empty cell', () => {
    expect(reduce(S('12', 0), { type: 'pointer-down', index: 5 }, 6).state.active).toBe(2)
    expect(reduce(S('12', 0), { type: 'pointer-down', index: 1 }, 6).state.active).toBe(1)
    expect(reduce(S('123456', 0), { type: 'pointer-down', index: 3 }, 6).state.active).toBe(3)
  })
})

describe('reduce — Enter / Escape (§3 table)', () => {
  it('Enter never mutates value; signals commit', () => {
    const r = reduce(S('12', 1), { type: 'enter' }, 6)
    expect(r.state.value).toBe('12')
    expect(r.changed).toBe(false)
    expect(r.commit).toBe(true)
  })
  it('Escape is a deliberate no-op (no clear-on-escape)', () => {
    const state = S('12', 1)
    const r = reduce(state, { type: 'escape' }, 6)
    expect(r.state).toBe(state)
  })
})

describe('reduce — the total default arm (unnamed/noop actions)', () => {
  it('noop returns the same state, unchanged', () => {
    const state = S('12', 1)
    expect(reduce(state, { type: 'noop' }, 6).state).toBe(state)
  })
})

describe('reduce — paste (§5, full replace / partial forward-write / garbage)', () => {
  it('a full-length paste (digits.length >= N) replaces the WHOLE value from ANY active cell', () => {
    const r = reduce(S('99', 1), { type: 'paste', text: '424242' }, 6)
    expect(r.state).toEqual({ value: '424242', active: 5 })
    expect(r.completed).toBe(true)
    expect(r.echo).toEqual({ kind: 'complete' })
  })
  it('a paste LONGER than N truncates to the first N digits', () => {
    const r = reduce(S('', 0), { type: 'paste', text: '1234567890123' }, 6)
    expect(r.state.value).toBe('123456')
  })
  it('re-pasting a full code over an ALREADY-complete code still fires completion (unconditional, §5)', () => {
    const r = reduce(S('111111', 5), { type: 'paste', text: '222222' }, 6)
    expect(r.state.value).toBe('222222')
    expect(r.completed).toBe(true)
  })
  it('a partial paste (digits.length < N) writes FORWARD from the active cell, overwriting', () => {
    const r = reduce(S('12', 0), { type: 'paste', text: '99' }, 6)
    expect(r.state).toEqual({ value: '99', active: 2 })
    expect(r.echo).toEqual({ kind: 'paste', count: 2 })
  })
  it('a partial paste from a mid active cell overwrites forward and clamps to N', () => {
    const r = reduce(S('12', 1), { type: 'paste', text: '789' }, 4)
    // value.slice(0,1)='1' + '789' + value.slice(4)='' → '1789', sliced to N=4 → '1789'
    expect(r.state.value).toBe('1789')
  })
  it('"424 242" and "code: 424242" both normalize clean', () => {
    expect(reduce(S('', 0), { type: 'paste', text: '424 242' }, 6).state.value).toBe('424242')
    expect(reduce(S('', 0), { type: 'paste', text: 'code: 424242' }, 6).state.value).toBe('424242')
  })
  it('an all-garbage paste is a no-op — no event, no error', () => {
    const state = S('12', 1)
    const r = reduce(state, { type: 'paste', text: 'abc-def' }, 6)
    expect(r.state).toBe(state)
    expect(r.changed).toBe(false)
    expect(r.echo).toBeNull()
  })
  it('preserves the no-gaps invariant after a partial paste', () => {
    const r = reduce(S('1', 1), { type: 'paste', text: '23' }, 6)
    expect(r.state.value).toMatch(/^[0-9]*$/)
    expect(r.state.value).toBe('123')
  })
})

// ── beforeinput routing — TOTAL over the inputType space (§3) ───────────────────────────────────────

describe('routeBeforeInput — the totality table (§3)', () => {
  it('single-digit insertText → the Digit arm', () => {
    expect(routeBeforeInput({ inputType: 'insertText', data: '7', transferText: null, collapsed: true })).toEqual({ type: 'digit', digit: '7' })
  })
  it('single non-digit insertText → the default (no-op) arm', () => {
    expect(routeBeforeInput({ inputType: 'insertText', data: 'x', transferText: null, collapsed: true })).toEqual({ type: 'noop' })
  })
  it('multi-character insertText → the paste path (§3 row 2)', () => {
    expect(routeBeforeInput({ inputType: 'insertText', data: '4242', transferText: null, collapsed: true })).toEqual({ type: 'paste', text: '4242' })
  })
  it('insertReplacementText → the paste path', () => {
    expect(routeBeforeInput({ inputType: 'insertReplacementText', data: '123456', transferText: null, collapsed: true })).toEqual({ type: 'paste', text: '123456' })
  })
  it('insertFromDrop (dataTransfer-carried) → the paste path', () => {
    expect(routeBeforeInput({ inputType: 'insertFromDrop', data: null, transferText: '424242', collapsed: true })).toEqual({ type: 'paste', text: '424242' })
  })
  it('insertFromPaste (defense-in-depth arm) → the paste path', () => {
    expect(routeBeforeInput({ inputType: 'insertFromPaste', data: null, transferText: '111111', collapsed: true })).toEqual({ type: 'paste', text: '111111' })
  })
  it('deleteContentBackward with a COLLAPSED selection → the Backspace arm', () => {
    expect(routeBeforeInput({ inputType: 'deleteContentBackward', data: null, transferText: null, collapsed: true })).toEqual({ type: 'backspace' })
  })
  it('deleteContentBackward with a NON-collapsed range → the default (no-op) arm', () => {
    expect(routeBeforeInput({ inputType: 'deleteContentBackward', data: null, transferText: null, collapsed: false })).toEqual({ type: 'noop' })
  })
  it('deleteContentForward with a COLLAPSED selection → the Delete arm', () => {
    expect(routeBeforeInput({ inputType: 'deleteContentForward', data: null, transferText: null, collapsed: true })).toEqual({ type: 'delete' })
  })
  it('deleteContentForward with a NON-collapsed range → the default (no-op) arm', () => {
    expect(routeBeforeInput({ inputType: 'deleteContentForward', data: null, transferText: null, collapsed: false })).toEqual({ type: 'noop' })
  })
  it('deleteByCut → the default (no-op) arm', () => {
    expect(routeBeforeInput({ inputType: 'deleteByCut', data: null, transferText: null, collapsed: true })).toEqual({ type: 'noop' })
  })
  it('insertParagraph / insertLineBreak → the default (no-op) arm', () => {
    expect(routeBeforeInput({ inputType: 'insertParagraph', data: null, transferText: null, collapsed: true })).toEqual({ type: 'noop' })
    expect(routeBeforeInput({ inputType: 'insertLineBreak', data: null, transferText: null, collapsed: true })).toEqual({ type: 'noop' })
  })
  it('historyUndo / historyRedo → the default (no-op) arm', () => {
    expect(routeBeforeInput({ inputType: 'historyUndo', data: null, transferText: null, collapsed: true })).toEqual({ type: 'noop' })
    expect(routeBeforeInput({ inputType: 'historyRedo', data: null, transferText: null, collapsed: true })).toEqual({ type: 'noop' })
  })
  it('any inputType this table does not name → the default (no-op) arm', () => {
    expect(routeBeforeInput({ inputType: 'formatBold', data: null, transferText: null, collapsed: true })).toEqual({ type: 'noop' })
  })
})

// ── cleanLength (§2 Props row) ───────────────────────────────────────────────────────────────────────

describe('cleanLength — the [1,12] clamp, nonsense → default 6 (§2 Props row)', () => {
  it('clamps in-range values verbatim', () => {
    expect(cleanLength(6)).toBe(6)
    expect(cleanLength(1)).toBe(1)
    expect(cleanLength(12)).toBe(12)
  })
  it('clamps out-of-range values to the [1,12] bound', () => {
    expect(cleanLength(0)).toBe(1)
    expect(cleanLength(-5)).toBe(1)
    expect(cleanLength(13)).toBe(12)
    expect(cleanLength(999)).toBe(12)
  })
  it('null / NaN / a non-integer falls back to the default (6)', () => {
    expect(cleanLength(null)).toBe(6)
    expect(cleanLength(NaN)).toBe(6)
    expect(cleanLength(4.5)).toBe(6)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// [B] the control — UIOtpFieldElement (real events dispatched at a live element)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

// jsdom stub — form-association surface (setFormValue/setValidity) is absent in jsdom (checkbox precedent).
function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

class ProbeOtpField extends UIOtpFieldElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-otp-field-probe', ProbeOtpField)

function make(): ProbeOtpField {
  const el = new ProbeOtpField()
  stubFormAssoc(el.probeInternals)
  return el
}

function editorOf(el: HTMLElement): HTMLElement {
  return el.querySelector('[data-part="editor"]') as HTMLElement
}
function cellsOf(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('[data-part="cell"]'))
}
function echoOf(el: HTMLElement): HTMLElement {
  return el.querySelector('[data-part="echo"]') as HTMLElement
}
function messageOf(el: HTMLElement): HTMLElement {
  return el.querySelector('.ui-otp-field-message') as HTMLElement
}

/** A jsdom-safe `beforeinput` InputEvent — jsdom's native InputEvent support is inconsistent across the
 *  fields this control reads, so every field is defensively (re)stamped as an own property after
 *  construction, regardless of what the constructor itself accepted. */
function makeBeforeInput(
  inputType: string,
  data: string | null,
  opts: { collapsed?: boolean; transferText?: string } = {},
): InputEvent {
  let ev: InputEvent
  try {
    ev = new InputEvent('beforeinput', { inputType, data: data ?? undefined, bubbles: true, cancelable: true })
  } catch {
    ev = new Event('beforeinput', { bubbles: true, cancelable: true }) as InputEvent
  }
  Object.defineProperty(ev, 'inputType', { value: inputType, configurable: true })
  Object.defineProperty(ev, 'data', { value: data, configurable: true })
  if (opts.collapsed === false) {
    Object.defineProperty(ev, 'getTargetRanges', { value: () => [{ collapsed: false }], configurable: true })
  }
  if (opts.transferText !== undefined) {
    Object.defineProperty(ev, 'dataTransfer', { value: { getData: () => opts.transferText }, configurable: true })
  }
  return ev
}

const digit = (editor: HTMLElement, d: string): void => {
  editor.dispatchEvent(makeBeforeInput('insertText', d))
}
const key = (el: HTMLElement, k: string): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
}

// ── upgrade + typed prop surface ────────────────────────────────────────────────────────────────────

describe('UIOtpFieldElement — upgrade + typed props', () => {
  it('upgrades to the class; props default to value="", length=6, label="", size="md", disabled=false', () => {
    const el = document.createElement('ui-otp-field') as UIOtpFieldElement
    expect(el).toBeInstanceOf(UIOtpFieldElement)
    expect(el.value).toBe('')
    expect(el.length).toBe(6)
    expect(el.label).toBe('')
    expect(el.size).toBe('md')
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
  })

  it('size is a literal union — compile-time narrowing (negative control)', () => {
    const fn = (): void => {
      const el = new UIOtpFieldElement()
      el.size = 'sm'
      el.size = 'lg'
      // @ts-expect-error — 'xl' is not a size member
      el.size = 'xl'
    }
    expect(typeof fn).toBe('function')
  })

  it('self-defines as ui-otp-field, guarded against double-define', () => {
    expect(customElements.get('ui-otp-field')).toBe(UIOtpFieldElement)
    expect(() => {
      if (!customElements.get('ui-otp-field')) customElements.define('ui-otp-field', UIOtpFieldElement)
    }).not.toThrow()
  })
})

// ── anatomy + ARIA (LLD §2/§6) ──────────────────────────────────────────────────────────────────────

describe('UIOtpFieldElement — the one-textbox, N-cells anatomy (LLD §6)', () => {
  it('creates ONE editor part (role=textbox) and `length` (default 6) aria-hidden cells; no host role/aria-*', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    expect(editor).toBeTruthy()
    expect(editor.getAttribute('role')).toBe('textbox')
    expect(editor.getAttribute('contenteditable')).toBe('plaintext-only')
    expect(cellsOf(el)).toHaveLength(6)
    for (const cell of cellsOf(el)) expect(cell.getAttribute('aria-hidden')).toBe('true')
    expect(el.getAttribute('role')).toBeNull()
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('cell count tracks `length` — grows/shrinks by append/remove, never recreating the survivors', async () => {
    const el = make()
    document.body.append(el)
    const before = cellsOf(el)
    el.length = 4
    await el.updateComplete
    expect(cellsOf(el)).toHaveLength(4)
    // the surviving first four cells are the SAME nodes (never recreated)
    expect(cellsOf(el)[0]).toBe(before[0])
    expect(cellsOf(el)[3]).toBe(before[3])
    el.length = 8
    await el.updateComplete
    expect(cellsOf(el)).toHaveLength(8)
    expect(cellsOf(el)[0]).toBe(before[0])
    el.remove()
  })

  it('`length` clamps to [1,12] internally (nonsense → 6) without mutating the raw prop', async () => {
    const el = make()
    document.body.append(el)
    el.length = 999
    await el.updateComplete
    expect(el.length).toBe(999) // the RAW prop is untouched (native attribute-IDL parity)
    expect(cellsOf(el)).toHaveLength(12) // the internal #n() clamp
    el.length = 0
    await el.updateComplete
    expect(cellsOf(el)).toHaveLength(1)
    el.remove()
  })
})

// ── digit entry, auto-advance, backspace, arrows (real beforeinput/keydown) ─────────────────────────

describe('UIOtpFieldElement — digit entry + auto-advance (real beforeinput)', () => {
  it('typing digits fills cells left-to-right and auto-advances', async () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '4')
    digit(editor, '2')
    digit(editor, '4')
    expect(el.value).toBe('424')
    await el.updateComplete
    expect(cellsOf(el).map((c) => c.textContent)).toEqual(['4', '2', '4', '', '', ''])
    el.remove()
  })

  it('a non-digit beforeinput is filtered — no value change, no `input`', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    let inputCount = 0
    el.addEventListener('input', () => inputCount++)
    editor.dispatchEvent(makeBeforeInput('insertText', 'x'))
    expect(el.value).toBe('')
    expect(inputCount).toBe(0)
    el.remove()
  })

  it('every beforeinput is preventDefault-ed — the native caret never edits', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    const ev = makeBeforeInput('insertText', '5')
    editor.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    el.remove()
  })

  it('emits `input` once per digit; `change` fires exactly once on completion, not again on blur', () => {
    const el = make()
    el.length = 3
    document.body.append(el)
    const editor = editorOf(el)
    const seen: string[] = []
    el.addEventListener('input', () => seen.push('input'))
    el.addEventListener('change', () => seen.push('change'))
    digit(editor, '1')
    digit(editor, '2')
    digit(editor, '3') // completes the code
    expect(seen).toEqual(['input', 'input', 'input', 'change'])
    editor.dispatchEvent(new Event('blur')) // value unchanged since the completion commit → no double-fire
    expect(seen).toEqual(['input', 'input', 'input', 'change'])
    el.remove()
  })
})

describe('UIOtpFieldElement — backspace / delete (real beforeinput)', () => {
  it('backspace on a filled cell splices it out; walk-back when the active cell is empty', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '1')
    digit(editor, '2')
    editor.dispatchEvent(makeBeforeInput('deleteContentBackward', null))
    expect(el.value).toBe('1')
    el.remove()
  })

  it('a delete variant with a non-collapsed range is a no-op (§3 row 5)', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '1')
    editor.dispatchEvent(makeBeforeInput('deleteContentBackward', null, { collapsed: false }))
    expect(el.value).toBe('1') // unchanged — the selection-present case falls to the default arm
    el.remove()
  })
})

describe('UIOtpFieldElement — keyboard navigation (real keydown, not beforeinput)', () => {
  it('ArrowLeft/ArrowRight/Home/End move the active cell (proven via a subsequent digit overwrite)', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '1')
    digit(editor, '2')
    digit(editor, '3')
    key(editor, 'Home')
    digit(editor, '9') // overwrite cell 0
    expect(el.value).toBe('923')
    key(editor, 'End')
    digit(editor, '8') // append at firstEmpty (cell 3)
    expect(el.value).toBe('9238')
    el.remove()
  })

  it('Escape is a no-op (no clear-on-escape)', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '1')
    key(editor, 'Escape')
    expect(el.value).toBe('1')
    el.remove()
  })

  it('Enter commits (change) only when the value changed since focus', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    let changeCount = 0
    el.addEventListener('change', () => changeCount++)
    editor.dispatchEvent(new Event('focus'))
    key(editor, 'Enter') // unchanged since focus → no change
    expect(changeCount).toBe(0)
    digit(editor, '1')
    key(editor, 'Enter') // changed → commits
    expect(changeCount).toBe(1)
    el.remove()
  })
})

// ── paste-split, exercised via multi-character beforeinput (§3 row 2 → the same §5 path a real paste takes) ──

describe('UIOtpFieldElement — paste-split (via multi-character beforeinput, real ClipboardEvent is the browser leg)', () => {
  it('a full code pasted mid-edit REPLACES the whole value and fires the completion change', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '9')
    let changeCount = 0
    el.addEventListener('change', () => changeCount++)
    editor.dispatchEvent(makeBeforeInput('insertText', '424242'))
    expect(el.value).toBe('424242')
    expect(changeCount).toBe(1)
    el.remove()
  })

  it('a partial paste writes forward from the active cell', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '1')
    editor.dispatchEvent(makeBeforeInput('insertText', '99'))
    expect(el.value).toBe('199')
    el.remove()
  })

  it('insertFromDrop (dataTransfer-carried text) routes through the same paste path', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    editor.dispatchEvent(makeBeforeInput('insertFromDrop', null, { transferText: '424242' }))
    expect(el.value).toBe('424242')
    el.remove()
  })

  it('composition (IME) — suppressed mid-composition; compositionend routes the final text through the paste path', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    editor.dispatchEvent(new Event('compositionstart'))
    editor.dispatchEvent(makeBeforeInput('insertText', '4')) // suppressed — mid-composition
    expect(el.value).toBe('')
    const end = new Event('compositionend') as CompositionEvent
    Object.defineProperty(end, 'data', { value: '424242' })
    editor.dispatchEvent(end)
    expect(el.value).toBe('424242')
    el.remove()
  })
})

// ── pointer-down cell-index math (real jsdom layout is 0×0 — stub each cell's own getBoundingClientRect) ──
//
// MINOR-4 (component-checker, 2026-08-08 host round): the resolver reads REAL per-cell rects (nearest
// cell-CENTER), not `editor.getBoundingClientRect()` divided evenly by N — dividing evenly ignores
// `--ui-otp-field-gap` and skews the resolved index once the gaps accumulate. Stub each cell's own rect to
// exercise it in jsdom (real layout is 0×0 everywhere here).

/** Stub every cell's `getBoundingClientRect` to a fixed-width, fixed-gap row starting at x=0. */
function layOutCells(el: HTMLElement, cellWidth: number, gap: number): void {
  cellsOf(el).forEach((cell, i) => {
    const left = i * (cellWidth + gap)
    cell.getBoundingClientRect = () =>
      ({ left, width: cellWidth, top: 0, height: cellWidth, right: left + cellWidth, bottom: cellWidth, x: left, y: 0, toJSON() {} }) as DOMRect
  })
}

describe('UIOtpFieldElement — pointer-down cell-index resolution (§3 table)', () => {
  it('resolves the click position to the nearest cell CENTER, clamped to firstEmpty', () => {
    const el = make()
    el.length = 4
    document.body.append(el)
    const editor = editorOf(el)
    layOutCells(el, 30, 10) // cells at x=[0,40,80,120], width 30 → centers [15,55,95,135]
    digit(editor, '1')
    digit(editor, '2') // value='12', firstEmpty=2
    editor.dispatchEvent(new PointerEvent('pointerdown', { clientX: 130, bubbles: true })) // nearest center 135 (cell 3), clamps to firstEmpty=2
    digit(editor, '9')
    expect(el.value).toBe('129')
    el.remove()
  })

  it('a gap-adjacent click resolves to the CLOSER cell, not a uniform-division guess', () => {
    const el = make()
    el.length = 3
    document.body.append(el)
    const editor = editorOf(el)
    layOutCells(el, 20, 20) // cells at x=[0,40,80], width 20 → centers [10,50,90]; the gap is [20,40)
    digit(editor, '1')
    digit(editor, '2') // value='12', firstEmpty=2
    // clientX=25 sits INSIDE the gap between cell 0 and cell 1; a uniform-division-by-width guess over the
    // whole row (0..100 / 3 ≈ 33px lanes) would land this in lane 0 too, so this alone wouldn't discriminate
    // the two algorithms — the discriminating case is nearest-CENTER (10 vs 50): 25 is 15px from cell 0's
    // center and 25px from cell 1's, so cell 0 (clamped to firstEmpty=... here 0 < 2, no clamp) wins.
    editor.dispatchEvent(new PointerEvent('pointerdown', { clientX: 25, bubbles: true }))
    digit(editor, '9') // overwrites cell 0 in place
    expect(el.value, 'pointer-down did not resolve to the nearest cell CENTER (cell 0)').toBe('92')
    el.remove()
  })

  it('a zero-width rect (no layout yet) is a no-op — never throws', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    expect(() => editor.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, bubbles: true }))).not.toThrow()
    el.remove()
  })
})

// ── the LLD-C8 echo — frozen strings per user-driven transition class ────────────────────────────────

describe('UIOtpFieldElement — the echo (LLD-C8, frozen strings)', () => {
  it('digit → "{d}, {len} of {N}"', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '5')
    expect(echoOf(el).textContent).toBe('5, 1 of 6')
    el.remove()
  })

  it('backspace/delete → "cleared, {len} of {N}"', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '5')
    digit(editor, '6')
    editor.dispatchEvent(makeBeforeInput('deleteContentBackward', null))
    expect(echoOf(el).textContent).toBe('cleared, 1 of 6')
    el.remove()
  })

  it('a partial paste → "{k} digits entered, {len} of {N}"', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    editor.dispatchEvent(makeBeforeInput('insertText', '99'))
    expect(echoOf(el).textContent).toBe('2 digits entered, 2 of 6')
    el.remove()
  })

  it('a transition that completes the code → "code complete" (replacing its own class\'s echo)', () => {
    const el = make()
    el.length = 3
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '1')
    digit(editor, '2')
    digit(editor, '3') // this digit ALSO completes — echo must be "code complete", not "3, 3 of 3"
    expect(echoOf(el).textContent).toBe('code complete')
    el.remove()
  })

  it('an external value write NEVER touches the echo (§8, native parity)', () => {
    const el = make()
    document.body.append(el)
    digit(editorOf(el), '5')
    expect(echoOf(el).textContent).toBe('5, 1 of 6')
    el.value = '99'
    expect(echoOf(el).textContent).toBe('5, 1 of 6') // untouched by the external write
    el.remove()
  })
})

// ── external value write — normalize/truncate, a = firstEmpty, NO input/echo (§8) ───────────────────

describe('UIOtpFieldElement — external value write (§8, native parity)', () => {
  it('a clean external write normalizes to itself and parks active at firstEmpty', async () => {
    const el = make()
    document.body.append(el)
    let inputCount = 0
    el.addEventListener('input', () => inputCount++)
    el.value = '123'
    await el.updateComplete
    expect(el.value).toBe('123')
    expect(inputCount).toBe(0)
    // proven via a subsequent digit landing at firstEmpty (cell index 3, not appended past it)
    digit(editorOf(el), '9')
    expect(el.value).toBe('1239')
    el.remove()
  })

  it('a dirty external write (non-digits) normalizes + truncates to the current length', async () => {
    const el = make()
    el.length = 4
    document.body.append(el)
    el.value = '1a2b3c4d5e'
    await el.updateComplete
    expect(el.value).toBe('1234') // normalized ('12345') then truncated to N=4
    el.remove()
  })

  it('an initial `value` attribute seeds normalized, with active parked at firstEmpty', async () => {
    const el = document.createElement('ui-otp-field-probe') as ProbeOtpField
    stubFormAssoc(el.probeInternals) // stub BEFORE connect — form effects run synchronously on connectedCallback
    el.setAttribute('value', '42a4')
    el.setAttribute('length', '6')
    document.body.append(el)
    await el.updateComplete
    expect(el.value).toBe('424')
    digit(editorOf(el), '2') // lands at firstEmpty = 3 (not appended past it)
    expect(el.value).toBe('4242')
    el.remove()
  })
})

// ── length change mid-entry (§8) ─────────────────────────────────────────────────────────────────────

describe('UIOtpFieldElement — length change mid-entry (§8)', () => {
  it('a shrink truncates value and clamps active into the new bound', async () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '1')
    digit(editor, '2')
    digit(editor, '3')
    digit(editor, '4')
    digit(editor, '5') // value='12345', active=5, length=6
    el.length = 3
    await el.updateComplete
    expect(el.value).toBe('123')
    // active is now clamped into [0, firstEmpty(3,3)=2] — proven via the next digit overwriting cell 2, not appending
    digit(editor, '9')
    expect(el.value).toBe('129')
    el.remove()
  })

  it('a length shrink that lands on a complete code never fires change — completion commits are USER-TRANSITION-ONLY (§8, REPAIRED)', async () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '1')
    digit(editor, '2')
    digit(editor, '3')
    digit(editor, '4') // value='1234', length=6 (not complete)
    let changeCount = 0
    el.addEventListener('change', () => changeCount++)
    el.length = 4 // a programmatic length shrink lands value.length === N — NOT a #dispatch transition
    await el.updateComplete
    expect(el.value).toBe('1234')
    expect(changeCount).toBe(0)
    el.remove()
  })
})

// ── the visible inline-validation message (ADR-0029 A1, ADOPTED — Kim ruling 2026-08-08, host round) ──
//
// jsdom cannot compute real layout/CSS visibility, so this probes the JS-owned half exactly like
// text-field.test.ts's own A1 probe (`message.hidden`/`.textContent` — the properties the CSS rule
// (`:state(user-invalid) > .ui-otp-field-message { display: block; … }`, otp-field.css) keys off): no
// flash before interaction, VISIBLE (hidden=false, real text) once armed, CLIPPED (hidden=true, empty)
// once resolved or under a `ui-field` association. The real CSS paint is the browser leg's job.

describe('UIOtpFieldElement — the visible inline-validation message (ADR-0029 A1, ADOPTED)', () => {
  it('no flash before interaction: hidden, empty', () => {
    const el = make()
    el.required = true
    document.body.append(el)
    const message = messageOf(el)
    expect(message.hidden).toBe(true)
    expect(message.textContent).toBe('')
    el.remove()
  })

  it('VISIBLE (hidden=false) with the real validity message once armed by the first interaction', async () => {
    const el = make()
    el.required = true
    document.body.append(el)
    const editor = editorOf(el)
    editor.dispatchEvent(new Event('blur')) // first interaction, capture-phase trackUserInvalid
    await el.updateComplete // the user-invalid effect is microtask-batched
    const message = messageOf(el)
    expect(message.hidden, 'the message must become visible once user-invalid arms').toBe(false)
    expect(message.textContent).toBe('Please fill out this field.')
    expect(editor.getAttribute('aria-invalid')).toBe('true')
    expect(editor.getAttribute('aria-describedby')).toBe(message.id)
    el.remove()
  })

  it('CLIPPED (hidden=true, empty) again once the value resolves the validity', async () => {
    const el = make()
    el.required = true
    document.body.append(el)
    const editor = editorOf(el)
    editor.dispatchEvent(new Event('blur'))
    await el.updateComplete
    digit(editor, '1') // len>0, still tooShort at default length=6
    await el.updateComplete
    const message = messageOf(el)
    // len=1 < 6 → tooShort, still invalid — message stays visible with the tooShort text
    expect(message.hidden).toBe(false)
    expect(message.textContent).toBe('Please enter all 6 digits.')
    el.value = '123456' // externally complete the code → valid
    await el.updateComplete
    expect(message.hidden, 'the message must clip again once valid').toBe(true)
    expect(message.textContent).toBe('')
    el.remove()
  })

  it('yields under a ui-field association — stays hidden/empty even while user-invalid (the field owns the ONE announced error)', async () => {
    const el = make()
    el.required = true
    document.body.append(el)
    const editor = editorOf(el)
    el.setFieldLabelling({ label: null, description: null, error: null })
    editor.dispatchEvent(new Event('blur'))
    await el.updateComplete
    const message = messageOf(el)
    expect(message.hidden, 'fielded: the internal message must never surface (the field is the one AT-announced error)').toBe(true)
    expect(message.textContent).toBe('')
    el.remove()
  })
})

// ── form participation ──────────────────────────────────────────────────────────────────────────────

describe('UIOtpFieldElement — form participation', () => {
  it('formValue() is the raw (possibly partial) string', () => {
    const el = make()
    document.body.append(el)
    const formValueProbe = (): unknown => (el as unknown as { formValue(): unknown }).formValue.call(el)
    expect(formValueProbe()).toBe('')
    el.value = '123'
    expect(formValueProbe()).toBe('123')
    el.remove()
  })

  it('required + empty → valueMissing; partial → tooShort; complete → valid', () => {
    const el = make()
    el.required = true
    document.body.append(el)
    const formValidityProbe = (): { valid: boolean; flags?: Record<string, boolean> } =>
      (el as unknown as { formValidity(): { valid: boolean; flags?: Record<string, boolean> } }).formValidity.call(el)
    expect(formValidityProbe()).toEqual(expect.objectContaining({ valid: false, flags: { valueMissing: true } }))
    el.value = '123'
    expect(formValidityProbe()).toEqual(expect.objectContaining({ valid: false, flags: { tooShort: true } }))
    el.value = '123456'
    expect(formValidityProbe()).toEqual({ valid: true })
    el.remove()
  })

  it('formReset() restores the initial value attribute baseline', () => {
    const el = document.createElement('ui-otp-field-probe') as ProbeOtpField
    stubFormAssoc(el.probeInternals) // stub BEFORE connect — form effects run synchronously on connectedCallback
    el.setAttribute('value', '12')
    document.body.append(el)
    el.value = '999999'
    ;(el as unknown as { formReset(): void }).formReset.call(el)
    expect(el.value).toBe('12')
    el.remove()
  })
})

// ── disabled ─────────────────────────────────────────────────────────────────────────────────────────

describe('UIOtpFieldElement — disabled', () => {
  it('disabled makes the editor non-editable and non-focusable', async () => {
    const el = make()
    document.body.append(el)
    el.disabled = true
    await el.updateComplete
    const editor = editorOf(el)
    expect(editor.getAttribute('contenteditable')).toBe('false')
    expect(editor.hasAttribute('tabindex')).toBe(false)
    expect(editor.getAttribute('aria-disabled')).toBe('true')
    el.remove()
  })

  it('a disabled control never becomes invalid (formValidity short-circuits)', () => {
    const el = make()
    el.required = true
    el.disabled = true
    document.body.append(el)
    const formValidityProbe = (): { valid: boolean } => (el as unknown as { formValidity(): { valid: boolean } }).formValidity.call(el)
    expect(formValidityProbe()).toEqual({ valid: true })
    el.remove()
  })
})

// ── zero residue across connect/disconnect ──────────────────────────────────────────────────────────

describe('UIOtpFieldElement — zero residue across connect/disconnect', () => {
  it('disconnect removes listeners; reconnect re-arms exactly once (not stacked)', () => {
    const el = make()
    document.body.append(el)
    const editor = editorOf(el)
    digit(editor, '1')
    expect(el.value).toBe('1')

    el.remove() // disconnect
    digit(editor, '2') // listeners gone — no-op
    expect(el.value).toBe('1')

    document.body.append(el) // reconnect — fresh AbortController
    const editor2 = editorOf(el)
    digit(editor2, '2')
    expect(el.value).toBe('12') // exactly one digit landed — not a stacked double
    el.remove()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// descriptor trip-wire (contract↔props) — the checkbox.test.ts template
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

const OTP_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/otp-field`
const md = readFileSync(`${OTP_DIR}/otp-field.md`, 'utf8') as string
const { fence } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['value', 'length', 'label', 'size', 'name', 'disabled', 'required']

describe('otp-field.md descriptor — structural validity (s10 part a)', () => {
  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-otp-field, extends=UIFormElement, tier=control, face.formAssociated=true', () => {
    expect(/^tag:\s*ui-otp-field\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*control\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('otp-field.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with UIOtpFieldElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIOtpFieldElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect = parsed.attributes.map((a) => (a.name === 'size' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIOtpFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.size.reflect' }),
    )
    const flipDefault = parsed.attributes.map((a) => (a.name === 'length' ? { ...a, default: '9' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIOtpFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.length.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropValue = parsed.attributes.filter((a) => a.name !== 'value')
    expect(compareDescriptorToProps(dropValue, UIOtpFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.value' }),
    )
    const addBogus = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIOtpFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// geometry trip-wire — own *-DIM source probe (LLD §7/§12.4, the multi-select ms-geometry-tokens template)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

const otpFieldCss = readFileSync(`${OTP_DIR}/otp-field.css`, 'utf8') as string

describe('otp-field.css — geometry trip-wire (otp-geometry-tokens)', () => {
  it('the lever resolves off the §1-row ramp (ADR-0038), no ad hoc size value', () => {
    expect(otpFieldCss).toMatch(/--ui-otp-field-height:\s*var\(--md-sys-height-md\)/)
    expect(otpFieldCss).toMatch(/--ui-otp-field-font:\s*var\(--md-sys-font-md\)/)
    expect(otpFieldCss).toMatch(/--ui-otp-field-gap:\s*var\(--md-sys-gap-md\)/)
  })

  it('[size=sm]/[size=lg] repoint the SAME tokens (the ramp, not a multiplier)', () => {
    expect(otpFieldCss).toMatch(/ui-otp-field\[size='sm'\][\s\S]{0,200}--ui-otp-field-height:\s*var\(--md-sys-height-sm\)/)
    expect(otpFieldCss).toMatch(/ui-otp-field\[size='lg'\][\s\S]{0,200}--ui-otp-field-height:\s*var\(--md-sys-height-lg\)/)
  })

  it('cell inline-size is DERIVED (= height), never a literal or a new ramp (§7)', () => {
    expect(otpFieldCss).toMatch(/--ui-otp-field-cell-inline-size:\s*var\(--ui-otp-field-height\)/)
  })

  it('radius is the FIXED entry-class corner, never h/2 (§7)', () => {
    expect(otpFieldCss).toMatch(/--ui-otp-field-radius:\s*var\(--md-sys-shape-corner-base\)/)
    expect(otpFieldCss).not.toMatch(/--ui-otp-field-radius:\s*calc\(/) // never a computed h/2 pill
  })

  it('ships NO min-inline-size token (the deliberate no-floor deviation, §7 — the N-cell grid IS the floor)', () => {
    expect(otpFieldCss).not.toMatch(/--ui-otp-field-min-inline-size/)
  })

  it('tokens declared in the :where() token block, consumed only in @scope', () => {
    const tokenBlock = otpFieldCss.slice(0, otpFieldCss.indexOf('@scope (ui-otp-field) {'))
    const scopeBlock = otpFieldCss.slice(otpFieldCss.indexOf('@scope (ui-otp-field) {'))
    expect(tokenBlock).toMatch(/:where\(ui-otp-field\)\s*\{/)
    expect(scopeBlock).toMatch(/@scope \(ui-otp-field\)\s*\{/)
    // the styles block reads ONLY --ui-otp-field-* + the sanctioned fleet constants (focus-ring/motion/line-height)
    expect(scopeBlock).not.toMatch(/var\(--md-sys-font-/)
    expect(scopeBlock).not.toMatch(/var\(--md-sys-space-/)
    expect(scopeBlock).not.toMatch(/var\(--md-sys-shape-corner-base/)
  })

  it('block-size is off the ramp; padding-block is 0 (the geometry.md Control-class law)', () => {
    const scopeBlock = otpFieldCss.slice(otpFieldCss.indexOf('@scope (ui-otp-field) {'))
    expect(scopeBlock).toMatch(/block-size:\s*var\(--ui-otp-field-height\)/)
    expect(scopeBlock).toMatch(/padding-block:\s*0/)
  })
})
