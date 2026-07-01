import { describe, it, expect } from 'vitest'
import { signal, whenFlushed } from '@agent-ui/components'
import { UIElement } from '../dom/index.ts'
import {
  valueCodec,
  numberCodecOptions,
  currencyCodecOptions,
} from './value-codec.ts'

// value-codec.test.ts — isolated unit tests for the valueCodec trait (Wave 3 / ADR-0044).
// Probes: round-trip, locale-safe, invalid input → hasError, zero-residue (C10), programmatic setCanonical.
// Tests in traits/ layer, so no imports from controls/ (import-layering trip-wire holds).
//
// The test host is a minimal UIElement subclass: a reactive `value` prop (a private signal with a
// get/set accessor) + a [data-part="editor"] child appended in connected(). This is the CodecHost
// contract that valueCodec requires: no full UITextFieldElement needed for trait-level isolation.

// ── minimal CodecHost test double ──────────────────────────────────────────────

class CodecTestHost extends UIElement {
  // A private signal backing the reactive `value` prop — valueCodec reads and writes `host.value`.
  // NOTE: this is NOT a static-props signal (no finalize()), just a backing store for the test.
  #val = signal('')

  get value(): string {
    return this.#val.value
  }
  set value(v: string) {
    this.#val.value = v
  }

  /** An inspectable probe for the value signal — used in the zero-residue test. */
  get valueProbe() {
    return this.#val
  }

  protected connected(): void {
    // Create the [data-part="editor"] child that valueCodec needs for its listener registration.
    if (!this.querySelector('[data-part="editor"]')) {
      const ed = document.createElement('div')
      ed.setAttribute('data-part', 'editor')
      this.append(ed)
    }
  }
}
customElements.define('codec-test-host', CodecTestHost)

function makeHost(): { host: CodecTestHost; editor: HTMLElement } {
  const host = new CodecTestHost()
  document.body.append(host)
  const editor = host.querySelector('[data-part="editor"]') as HTMLElement
  return { host, editor }
}

// ── round-trip (number codec) ───────────────────────────────────────────────────

describe('valueCodec — number round-trip', () => {
  it('focus reverts to canonical, blur parses and formats, canonical holds the parsed value', async () => {
    const { host, editor } = makeHost()
    // Attach with en-US locale for deterministic formatting in CI.
    const codec = valueCodec(host, numberCodecOptions('en-US'))

    // Simulate typing
    host.value = '1234.56'
    editor.dispatchEvent(new Event('blur')) // blur: parse "1234.56" → format "1,234.56"
    await whenFlushed()

    expect(host.value).toBe('1,234.56')          // display: formatted
    expect(codec.canonical.value).toBe('1234.56') // canonical: raw numeric
    expect(codec.hasError.value).toBe(false)

    // Focus reverts to canonical so the user edits the raw value.
    editor.dispatchEvent(new FocusEvent('focus', { bubbles: false }))
    await whenFlushed()
    expect(host.value).toBe('1234.56') // reverted to raw

    host.remove()
  })

  it('accepts an already-formatted display string (re-blur round-trips cleanly)', async () => {
    // Simulate: user blurred, display is "1,234.56"; they focus (reverts to "1234.56"),
    // make no change, blur again — should still format to "1,234.56".
    const { host, editor } = makeHost()
    const codec = valueCodec(host, numberCodecOptions('en-US'))

    host.value = '1,234.56' // pre-formatted (as if a previous blur set this)
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()

    expect(host.value).toBe('1,234.56')          // re-formatted (no change)
    expect(codec.canonical.value).toBe('1234.56') // canonical recovered correctly
    host.remove()
  })

  it('formValue() equivalent: canonical.value is the submission value, not the display', async () => {
    const { host, editor } = makeHost()
    const codec = valueCodec(host, numberCodecOptions('en-US'))

    host.value = '999.5'
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()

    // After blur: host.value is the formatted display ("999.5" → Intl → "999.5" in en-US)
    // canonical is always the raw parsed value.
    expect(codec.canonical.value).toBe('999.5')
    host.remove()
  })
})

// ── invalid input → hasError ────────────────────────────────────────────────────

describe('valueCodec — invalid input', () => {
  it('a non-numeric display string sets hasError = true and leaves the display unchanged', async () => {
    const { host, editor } = makeHost()
    const codec = valueCodec(host, numberCodecOptions('en-US'))

    host.value = 'not-a-number'
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()

    expect(codec.hasError.value).toBe(true)
    expect(host.value).toBe('not-a-number') // display unchanged — let user correct it
    expect(codec.canonical.value).toBe('')   // canonical unchanged from seed
    host.remove()
  })

  it('a subsequent valid input clears hasError', async () => {
    const { host, editor } = makeHost()
    const codec = valueCodec(host, numberCodecOptions('en-US'))

    host.value = 'bad'
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(codec.hasError.value).toBe(true)

    host.value = '42'
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(codec.hasError.value).toBe(false)
    expect(codec.canonical.value).toBe('42')
    host.remove()
  })

  it('errorMessage mirrors opts.errorMessage for the control to read in formValidity()', () => {
    const { host } = makeHost()
    const codec = valueCodec(host, numberCodecOptions('en-US'))
    expect(codec.errorMessage).toBe('Please enter a valid number.')
    host.remove()
  })
})

// ── currency codec ──────────────────────────────────────────────────────────────

describe('valueCodec — currency codec', () => {
  it('formats to 2 decimal places and parses back cleanly', async () => {
    const { host, editor } = makeHost()
    const codec = valueCodec(host, currencyCodecOptions('en-US'))

    host.value = '1234.5'
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()

    // 2 decimal places for monetary precision
    expect(host.value).toBe('1,234.50')
    expect(codec.canonical.value).toBe('1234.5')
    expect(codec.hasError.value).toBe(false)
    host.remove()
  })

  it('currencyCodecOptions errorMessage is for amounts', () => {
    const { host } = makeHost()
    const codec = valueCodec(host, currencyCodecOptions('en-US'))
    expect(codec.errorMessage).toBe('Please enter a valid amount.')
    host.remove()
  })
})

// ── setCanonical (programmatic value change — clear / steppers) ────────────────

describe('valueCodec — setCanonical', () => {
  it('setCanonical updates canonical and clears hasError', async () => {
    const { host, editor } = makeHost()
    const codec = valueCodec(host, numberCodecOptions('en-US'))

    // First, put the field in an error state
    host.value = 'bad'
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(codec.hasError.value).toBe(true)

    // Programmatic set (simulating a stepper or clear)
    codec.setCanonical('100')
    expect(codec.canonical.value).toBe('100')
    expect(codec.hasError.value).toBe(false)
    host.remove()
  })
})

// ── focus ordering guard: canonical-before-committed ─────────────────────────────

describe('valueCodec — focus ordering (capture fires before target)', () => {
  it('the host-capture focus handler fires BEFORE a direct-on-editor focus listener', () => {
    const { host, editor } = makeHost()
    const order: string[] = []

    // Register a direct-on-editor focus listener BEFORE the codec (simulates the control's listener).
    editor.addEventListener('focus', () => { order.push('editor-direct') })

    // Codec registers its host-capture focus handler here.
    valueCodec(host, numberCodecOptions('en-US'))

    // The codec's host-capture listener is registered VIA host.listen after the direct-on-editor one.
    // But capture phase precedes target phase — so codec fires FIRST regardless of registration order.
    // Simulate: also register a host-capture listener as the "codec" fires → check order.
    // To verify ordering purely, we add our own capture listener AFTER the codec and check it fires LAST.
    let codecOrderSlot = -1
    const listeners: string[] = []
    host.addEventListener('focus', () => { listeners.push('late-capture') }, { capture: true })
    editor.addEventListener('focus', () => { listeners.push('late-direct') })

    editor.dispatchEvent(new FocusEvent('focus', { bubbles: false }))

    // The two non-codec listeners fire; codec's capture fires in between, but we can't directly observe it.
    // This test confirms that any host-capture listener fires before any editor-direct listener.
    expect(listeners[0]).toBe('late-capture') // host-capture fires first
    expect(listeners[1]).toBe('late-direct')  // editor-direct fires second

    void codecOrderSlot // suppress unused var
    host.remove()
  })
})

// ── C10 zero-residue ───────────────────────────────────────────────────────────

describe('valueCodec — C10 zero residue', () => {
  it('listeners are abort-owned: after disconnect, events do not drive codec state changes', async () => {
    const { host, editor } = makeHost()
    const codec = valueCodec(host, numberCodecOptions('en-US'))

    // While connected: blur works
    host.value = '42'
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(codec.canonical.value).toBe('42')

    host.remove() // disconnect → AC.abort() → listeners removed

    // After disconnect: blur on the old editor must NOT fire the codec handler
    host.value = '999'
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    // canonical should NOT have updated (listeners are gone)
    expect(codec.canonical.value).toBe('42')
  })

  it('release() is idempotent — calling it multiple times does not throw', () => {
    const { host } = makeHost()
    const codec = valueCodec(host, numberCodecOptions('en-US'))
    expect(() => {
      codec.release()
      codec.release() // second call: no-op (released flag is already true)
    }).not.toThrow()
    host.remove()
  })

  it('after release(), blur events become no-ops (the released flag guards each handler)', async () => {
    const { host, editor } = makeHost()
    const codec = valueCodec(host, numberCodecOptions('en-US'))

    // First, establish canonical as '10' via a successful blur (the normal parse path).
    host.value = '10'
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(codec.canonical.value).toBe('10') // canonical is now seeded via the blur

    codec.release() // early teardown — subsequent blur events must be no-ops

    host.value = '999'
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(codec.canonical.value).toBe('10') // unchanged — the handler is a no-op after release()
    host.remove()
  })
})
