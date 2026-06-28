import { describe, it, expect, afterEach } from 'vitest'
import { html, render, type TemplateResult } from './template.ts'
import { repeat } from './repeat.ts'

// ADR-0022 — the CROSS-ENGINE focus-survival proof for the `repeat` reorder seam (`ChildPart.moveBefore`).
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). The jsdom repeat.test.ts can only assert NODE
// IDENTITY across a reorder (jsdom has no native `Node.prototype.moveBefore`, so it always takes the seam's
// `before()` FALLBACK leg, which blurs `activeElement` on the detach+reinsert). FOCUS survival is a property
// of the platform's ATOMIC move — provable only in a real engine that ships `moveBefore`. This file pins the
// two-tier guarantee against real engines and feature-branches on support (the same feature-gated-leg pattern
// as the ui-card scroll-driven WebKit gap):
//   • SUPPORTED (Chromium 133+) → focus SURVIVES the reorder + node identity preserved (the native path);
//   • UNSUPPORTED (WebKit/Firefox until they ship) → identity preserved, focus drop documented as the fallback.
// It also drives the FOUR reorder scenarios (head insert · middle insert · tail append · swap) to prove the
// native path raises NO HierarchyRequestError — every node `moveBefore` relocates is already connected in the
// directive's container (the `#mount` case mounts + commits the new part BEFORE moving it).
//
// `render` owns no effect, so these probes drive the bare engine — no host element is needed.

let container: HTMLElement | null = null
function mount(): HTMLElement {
  const c = document.createElement('div')
  document.body.append(c)
  container = c
  return c
}
afterEach(() => {
  container?.remove()
  container = null
})

/** Whether THIS engine exposes the platform's atomic `Node.prototype.moveBefore` (the seam's own feature-detect). */
const nativeMoveBefore = 'moveBefore' in document.body

/** A keyed `<ul>` of `<li><input data-k></li>` items — each item is a SINGLE template (the `repeat` norm). */
const inputList = (keys: string[]): TemplateResult =>
  html`<ul>${repeat(keys, (k) => k, (k) => html`<li><input data-k=${k} /></li>`)}</ul>`

/** The `data-k` order of the rendered inputs — the committed DOM order. */
const inputOrder = (c: HTMLElement): (string | null)[] =>
  Array.from(c.querySelectorAll('input')).map((i) => i.getAttribute('data-k'))

const inputFor = (c: HTMLElement, k: string): HTMLInputElement => c.querySelector(`[data-k="${k}"]`) as HTMLInputElement

/** A keyed `<ul>` of plain `<li data-k>` text items. */
const textList = (keys: string[]): TemplateResult => html`<ul>${repeat(keys, (k) => k, (k) => html`<li data-k=${k}>${k}</li>`)}</ul>`
const textOrder = (c: HTMLElement): (string | null)[] => Array.from(c.querySelectorAll('li')).map((l) => l.getAttribute('data-k'))

describe('repeat reorder — focus survival across the moveBefore seam (ADR-0022, both engines)', () => {
  it('a reorder that MOVES the focused input keeps node identity (always) — and keeps FOCUS where native moveBefore is supported', () => {
    const c = mount()
    render(inputList(['a', 'b', 'keepFocusC']), c)
    const inA = inputFor(c, 'a')
    const inB = inputFor(c, 'b')
    const inC = inputFor(c, 'keepFocusC')

    inC.focus()
    // PRECONDITION (anti-vacuous): focus actually landed on the input before the reorder — otherwise the
    // focus-survival assertion below could pass trivially against an already-unfocused element.
    expect(document.activeElement, 'precondition: focus did not land on the input before the reorder').toBe(inC)

    // Reorder so `keepFocusC` becomes the head — the reconcile relocates its (already-connected) sub-part by
    // identity via the seam's `moveBefore`. On the native leg this is the platform's atomic move.
    render(inputList(['keepFocusC', 'a', 'b']), c)

    // IDENTITY — preserved on EVERY engine (the same node objects move, never re-created).
    expect(inputOrder(c)).toEqual(['keepFocusC', 'a', 'b'])
    expect(inputFor(c, 'keepFocusC'), 'moved input is not the same node (identity lost)').toBe(inC)
    expect(inputFor(c, 'a')).toBe(inA)
    expect(inputFor(c, 'b')).toBe(inB)

    if (nativeMoveBefore) {
      // SUPPORTED (Chromium 133+): the atomic move relocates the <li> WITHOUT detaching it from the document,
      // so focus on the descendant input survives. NON-VACUOUS: if the native path were bypassed (the before()
      // fallback), the reinsert would blur `activeElement` and this would FAIL.
      expect(document.activeElement, 'focus did NOT survive the native moveBefore reorder').toBe(inC)
    } else {
      // UNSUPPORTED (WebKit/Firefox until they ship moveBefore): the seam falls back to detach+reinsert —
      // identity-only. Focus is EXPECTED to drop here (the documented graceful-degradation gap); we assert the
      // identity guarantee only, and record the focus drop as the known fallback behaviour. The gap closes
      // itself with no code change as the engine ships moveBefore (the feature-detect starts taking native).
      expect(inputFor(c, 'keepFocusC'), 'fallback leg: identity must still hold').toBe(inC)
    }
  })
})

describe('repeat reorder — the four scenarios raise NO HierarchyRequestError on the native path (ADR-0022)', () => {
  // Each scenario hits a `moveBefore` call site; the brief's invariant is that every relocated node is already
  // CONNECTED in the container at move time, so native moveBefore takes its happy path (no throw). On Chromium
  // these run through the native leg — a real throw would surface here and fail the gate.

  it('HEAD INSERT — prepend a new key (the freshly-mounted #mount move) reorders without throwing', () => {
    const c = mount()
    render(textList(['a', 'b', 'c']), c)
    // The new head `z` is mounted at the tail then moved before `a` — the #mount case where a JUST-created,
    // already-inserted part is relocated (native moveBefore would throw if it were disconnected; it is not).
    expect(() => render(textList(['z', 'a', 'b', 'c']), c)).not.toThrow()
    expect(textOrder(c)).toEqual(['z', 'a', 'b', 'c'])
  })

  it('MIDDLE INSERT — a new key in the middle (the #mount move) reorders without throwing', () => {
    const c = mount()
    render(textList(['a', 'b', 'c']), c)
    expect(() => render(textList(['a', 'm', 'b', 'c']), c)).not.toThrow()
    expect(textOrder(c)).toEqual(['a', 'm', 'b', 'c'])
  })

  it('TAIL APPEND — append a key (zero moves of survivors) reorders without throwing', () => {
    const c = mount()
    render(textList(['a', 'b', 'c']), c)
    expect(() => render(textList(['a', 'b', 'c', 't']), c)).not.toThrow()
    expect(textOrder(c)).toEqual(['a', 'b', 'c', 't'])
  })

  it('SWAP — exchange head and tail keys (the cross-check moves of existing parts) reorders without throwing', () => {
    const c = mount()
    render(textList(['a', 'b', 'c', 'd']), c)
    const liB = c.querySelector('[data-k="b"]')
    const liC = c.querySelector('[data-k="c"]')
    expect(() => render(textList(['d', 'b', 'c', 'a']), c)).not.toThrow()
    expect(textOrder(c)).toEqual(['d', 'b', 'c', 'a'])
    // the untouched middle survivors keep identity through the swap
    expect(c.querySelector('[data-k="b"]')).toBe(liB)
    expect(c.querySelector('[data-k="c"]')).toBe(liC)
  })
})
