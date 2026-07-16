import { describe, it, expect, vi, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIToastElement } from './toast.ts'

// toast.test.ts — UIToastElement jsdom behaviour probes (feed-family.lld.md LLD-C7 · SPEC-R14/R15/R16).
// jsdom has real setTimeout/clearTimeout and real internals.role, so the timer + role-flip logic is
// pinned directly here (vi.useFakeTimers, which also fakes `performance.now()`). The REAL top-layer /
// focus-neutrality / cross-engine painted-geometry truth is toast.browser.test.ts (jsdom cannot see the
// platform focus model with full fidelity — the tabs precedent).

afterEach(() => {
  vi.useRealTimers()
})

// ── probe subclass — re-exposes the protected internals (the checkbox.test.ts precedent) ──────────────

class ProbeToast extends UIToastElement {
  /** Re-expose the protected `internals` so probes can read `role` directly. */
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-toast-probe', ProbeToast)

function makeToast(attrs: Record<string, string> = {}, text = 'Hello'): UIToastElement {
  const el = document.createElement('ui-toast') as UIToastElement
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.textContent = text
  return el
}

function makeProbeToast(attrs: Record<string, string> = {}, text = 'Hello'): ProbeToast {
  const el = document.createElement('ui-toast-probe') as ProbeToast
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.textContent = text
  return el
}

const messageOf = (el: Element): HTMLElement => el.querySelector('[data-part="message"]') as HTMLElement
const actionBtnOf = (el: Element): HTMLElement | null => el.querySelector('[data-part="action"]')
const closeBtnOf = (el: Element): HTMLElement => el.querySelector('[data-part="close"]') as HTMLElement

// ── construction + role (SPEC-R15 AC2) ──────────────────────────────────────────────────────────────

describe('ui-toast — role=status set at CONSTRUCTION, before insertion (toast-role-construct)', () => {
  it('internals.role is already "status" the instant the element is constructed (before any append)', () => {
    const el = new ProbeToast()
    // Constructed but NEVER inserted — SPEC-R15 AC2's whole point is that role exists at this point,
    // strictly before any append() call could occur.
    expect(el.probeInternals.role).toBe('status')
  })
})

describe('ui-toast — urgent flips internals.role status↔alert (toast-urgent-role)', () => {
  it('urgent=false (default) keeps role=status after connect', async () => {
    const el = makeProbeToast()
    document.body.appendChild(el)
    await whenFlushed()
    expect(el.probeInternals.role).toBe('status')
    el.remove()
  })

  it('urgent=true flips role to alert, reactively, in both directions', async () => {
    const el = makeProbeToast()
    document.body.appendChild(el)
    await whenFlushed()
    el.urgent = true
    await whenFlushed()
    expect(el.probeInternals.role).toBe('alert')
    el.urgent = false
    await whenFlushed()
    expect(el.probeInternals.role).toBe('status')
    el.remove()
  })
})

// ── anatomy (message adoption + affordance cluster) ─────────────────────────────────────────────────

describe('ui-toast — anatomy: message adoption + the affordance cluster (toast-anatomy)', () => {
  it('adopts light-DOM children present at connect into [data-part="message"], moved not cloned', () => {
    const el = makeToast({}, 'File uploaded.')
    document.body.appendChild(el)
    const message = messageOf(el)
    expect(message).not.toBeNull()
    expect(message.textContent).toBe('File uploaded.')
    // moved, not cloned — the host has exactly ONE text-bearing descendant of the message
    expect(el.textContent).toBe('File uploaded.')
    el.remove()
  })

  it('renders NO action part when action is empty (default)', () => {
    const el = makeToast()
    document.body.appendChild(el)
    expect(actionBtnOf(el)).toBeNull()
    el.remove()
  })

  it('renders a data-part="action" ui-button labelled with `action` when non-empty at connect', () => {
    const el = makeToast({ action: 'Undo' })
    document.body.appendChild(el)
    const actionBtn = actionBtnOf(el)
    expect(actionBtn).not.toBeNull()
    expect(actionBtn?.tagName.toLowerCase()).toBe('ui-button')
    expect(actionBtn?.textContent).toBe('Undo')
    el.remove()
  })

  it('ALWAYS renders an icon-only data-part="close" ui-button with aria-label="Dismiss" and a ui-icon[glyph="x"]', () => {
    const el = makeToast()
    document.body.appendChild(el)
    const closeBtn = closeBtnOf(el)
    expect(closeBtn.tagName.toLowerCase()).toBe('ui-button')
    expect(closeBtn.getAttribute('aria-label')).toBe('Dismiss')
    expect(closeBtn.hasAttribute('icon-only')).toBe(true) // opts into button.css's square fifth structure
    const icon = closeBtn.querySelector('ui-icon')
    expect(icon?.getAttribute('glyph')).toBe('x')
    el.remove()
  })

  it('the anatomy build is idempotent across reconnect (no duplicate parts)', () => {
    const el = makeToast({ action: 'Undo' })
    document.body.appendChild(el)
    el.remove()
    document.body.appendChild(el)
    expect(el.querySelectorAll('[data-part="message"]').length).toBe(1)
    expect(el.querySelectorAll('[data-part="action"]').length).toBe(1)
    expect(el.querySelectorAll('[data-part="close"]').length).toBe(1)
    el.remove()
  })
})

// ── close() — idempotent, exactly one `close` event, removes the element (ledger #11) ──────────────────

describe('ui-toast — close() is idempotent: exactly ONE close event, then removes the element (toast-close-idempotent)', () => {
  it('the close affordance click closes: emits exactly one close, removes the host', () => {
    const el = makeToast({ duration: '0' }) // never auto-dismiss — isolate the close-button path
    document.body.appendChild(el)
    let closeCount = 0
    el.addEventListener('close', () => closeCount++)
    closeBtnOf(el).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(closeCount).toBe(1)
    expect(el.isConnected).toBe(false)
  })

  it('calling close() a second time (post-removal) is a no-op — no second event', () => {
    const el = makeToast({ duration: '0' })
    document.body.appendChild(el)
    let closeCount = 0
    el.addEventListener('close', () => closeCount++)
    el.close()
    el.close()
    el.close()
    expect(closeCount).toBe(1)
  })

  it('the action button click emits select THEN close (exactly one of each)', () => {
    const el = makeToast({ action: 'Undo', duration: '0' })
    document.body.appendChild(el)
    const order: string[] = []
    el.addEventListener('select', () => order.push('select'))
    el.addEventListener('close', () => order.push('close'))
    actionBtnOf(el)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(order).toEqual(['select', 'close'])
    expect(el.isConnected).toBe(false)
  })
})

// ── the timer (SPEC-R16) ─────────────────────────────────────────────────────────────────────────────

describe('ui-toast — the auto-dismiss timer (toast-timer-expiry)', () => {
  it('auto-dismisses after `duration` ms when not actionable', () => {
    vi.useFakeTimers()
    const el = makeToast({ duration: '1000' })
    document.body.appendChild(el)
    let closed = false
    el.addEventListener('close', () => { closed = true })
    vi.advanceTimersByTime(999)
    expect(closed).toBe(false)
    vi.advanceTimersByTime(1)
    expect(closed).toBe(true)
    expect(el.isConnected).toBe(false)
  })

  it('duration=0 never auto-dismisses (SPEC-R14)', () => {
    vi.useFakeTimers()
    const el = makeToast({ duration: '0' })
    document.body.appendChild(el)
    let closed = false
    el.addEventListener('close', () => { closed = true })
    vi.advanceTimersByTime(60000)
    expect(closed).toBe(false)
    el.remove()
  })

  it('a non-finite/negative duration never auto-dismisses', () => {
    vi.useFakeTimers()
    const negative = makeToast({ duration: '-500' })
    document.body.appendChild(negative)
    let closed = false
    negative.addEventListener('close', () => { closed = true })
    vi.advanceTimersByTime(60000)
    expect(closed).toBe(false)
    negative.remove()
  })

  it('an actionable toast (non-empty action) NEVER auto-dismisses, regardless of duration (WCAG 2.2.1)', () => {
    vi.useFakeTimers()
    const el = makeToast({ action: 'Undo', duration: '100' })
    document.body.appendChild(el)
    let closed = false
    el.addEventListener('close', () => { closed = true })
    vi.advanceTimersByTime(60000)
    expect(closed).toBe(false)
    el.remove()
  })

  it('a duration/action prop change re-evaluates the timer (becoming actionable cancels a pending expiry)', async () => {
    vi.useFakeTimers()
    const el = makeToast({ duration: '1000' })
    document.body.appendChild(el)
    let closed = false
    el.addEventListener('close', () => { closed = true })
    vi.advanceTimersByTime(500)
    el.action = 'Undo' // now actionable — the eligibility effect re-runs (microtask-batched) and clears the timer
    await whenFlushed()
    vi.advanceTimersByTime(60000)
    expect(closed).toBe(false)
    el.remove()
  })
})

describe('ui-toast — pause on hover AND focus-within (toast-timer-pause-resume)', () => {
  it('pointerenter pauses the countdown; pointerleave resumes with the REMAINING time (not a fresh countdown)', () => {
    vi.useFakeTimers()
    const el = makeToast({ duration: '1000' })
    document.body.appendChild(el)
    let closed = false
    el.addEventListener('close', () => { closed = true })

    vi.advanceTimersByTime(400) // 600ms remaining
    el.dispatchEvent(new Event('pointerenter'))
    vi.advanceTimersByTime(10000) // paused — no expiry no matter how long we wait
    expect(closed).toBe(false)

    el.dispatchEvent(new Event('pointerleave'))
    vi.advanceTimersByTime(599) // just short of the remaining 600ms
    expect(closed).toBe(false)
    vi.advanceTimersByTime(1)
    expect(closed).toBe(true)
  })

  it('focusin pauses; focusout (with relatedTarget OUTSIDE the toast) resumes', () => {
    vi.useFakeTimers()
    const el = makeToast({ duration: '1000' })
    document.body.appendChild(el)
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    let closed = false
    el.addEventListener('close', () => { closed = true })

    vi.advanceTimersByTime(300) // 700ms remaining
    el.dispatchEvent(new Event('focusin', { bubbles: true }))
    vi.advanceTimersByTime(10000)
    expect(closed).toBe(false)

    const fe = new Event('focusout', { bubbles: true }) as FocusEvent & { relatedTarget: Node | null }
    Object.defineProperty(fe, 'relatedTarget', { value: outside })
    el.dispatchEvent(fe)
    vi.advanceTimersByTime(699)
    expect(closed).toBe(false)
    vi.advanceTimersByTime(1)
    expect(closed).toBe(true)
    outside.remove()
  })

  it('focusout with relatedTarget INSIDE the toast stays paused (moving focus between the action/close buttons)', () => {
    vi.useFakeTimers()
    const el = makeToast({ duration: '1000' })
    document.body.appendChild(el)
    const closeBtn = closeBtnOf(el)
    let closed = false
    el.addEventListener('close', () => { closed = true })

    el.dispatchEvent(new Event('focusin', { bubbles: true }))
    const fe = new Event('focusout', { bubbles: true }) as FocusEvent & { relatedTarget: Node | null }
    Object.defineProperty(fe, 'relatedTarget', { value: closeBtn }) // moving focus WITHIN the toast
    el.dispatchEvent(fe)
    vi.advanceTimersByTime(60000)
    expect(closed).toBe(false) // still paused — focus never actually left
    el.remove()
  })

  it('focusout with relatedTarget=null (window blur) is treated as focus-left ⇒ resumes (ledger #5)', () => {
    vi.useFakeTimers()
    const el = makeToast({ duration: '1000' })
    document.body.appendChild(el)
    let closed = false
    el.addEventListener('close', () => { closed = true })

    vi.advanceTimersByTime(200) // 800ms remaining
    el.dispatchEvent(new Event('focusin', { bubbles: true }))
    el.dispatchEvent(new Event('focusout', { bubbles: true })) // relatedTarget defaults to null
    vi.advanceTimersByTime(800)
    expect(closed).toBe(true)
  })
})

describe('ui-toast — disconnect clears the timer (no stray close after removal)', () => {
  it('removing the toast externally (bypassing close()) cancels the pending timer — no close event fires later', () => {
    vi.useFakeTimers()
    const el = makeToast({ duration: '1000' })
    document.body.appendChild(el)
    let closed = false
    el.addEventListener('close', () => { closed = true })
    el.remove() // NOT via close() — a direct external removal
    vi.advanceTimersByTime(60000)
    expect(closed).toBe(false)
  })
})
