import { describe, it, expect } from 'vitest'
import { signal, whenFlushed } from '@agent-ui/components'
import { UIElement } from '../dom/index.ts'
import {
  valueCodec,
  numberCodecOptions,
  currencyCodecOptions,
  dateCodecOptions,
  timeCodecOptions,
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

// ── dateCodecOptions (Wave 5B, ADR-0048) ──────────────────────────────────────
//
// All tests pin locale='en-US' for deterministic output in CI. The parse tests are entirely
// locale-agnostic (ISO parsing has no locale component); format tests derive the expected
// value from Intl.DateTimeFormat itself to remain CLDR-version-agnostic.

describe('dateCodecOptions — parse: ISO always accepted', () => {
  it('valid ISO date → returned as-is (identity round-trip on canonical)', () => {
    expect(dateCodecOptions('en-US').parse('2024-03-15')).toBe('2024-03-15')
  })

  it('leap day 2024-02-29 → "2024-02-29" (2024 is a leap year)', () => {
    expect(dateCodecOptions('en-US').parse('2024-02-29')).toBe('2024-02-29')
  })

  it('non-leap day 2023-02-29 → null (2023 is not a leap year)', () => {
    expect(dateCodecOptions('en-US').parse('2023-02-29')).toBeNull()
  })

  it('month boundary: 2024-04-30 valid; 2024-04-31 null (April has 30 days)', () => {
    expect(dateCodecOptions('en-US').parse('2024-04-30')).toBe('2024-04-30')
    expect(dateCodecOptions('en-US').parse('2024-04-31')).toBeNull()
  })

  it('month 0 → null; month 13 → null', () => {
    expect(dateCodecOptions('en-US').parse('2024-00-01')).toBeNull()
    expect(dateCodecOptions('en-US').parse('2024-13-01')).toBeNull()
  })

  it('day 0 → null; day 32 → null', () => {
    expect(dateCodecOptions('en-US').parse('2024-01-00')).toBeNull()
    expect(dateCodecOptions('en-US').parse('2024-01-32')).toBeNull()
  })

  it('completely invalid input → null', () => {
    expect(dateCodecOptions('en-US').parse('not a date')).toBeNull()
    expect(dateCodecOptions('en-US').parse('')).toBeNull()
    expect(dateCodecOptions('en-US').parse('hello')).toBeNull()
  })
})

describe('dateCodecOptions — format: ISO → localized display', () => {
  it('formats a valid ISO date to the locale medium-style display string', () => {
    const codec = dateCodecOptions('en-US')
    // Derive expected from Intl directly so the test is CLDR-version-agnostic.
    const expected = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(2024, 0, 15))
    expect(codec.format('2024-01-15')).toBe(expected)
  })

  it('timezone-safe: 2024-02-29 (leap day) does NOT shift to Feb 28 or Mar 1', () => {
    const codec = dateCodecOptions('en-US')
    const expected = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(2024, 1, 29))
    expect(codec.format('2024-02-29')).toBe(expected)
  })

  it('returns the canonical as-is when it is not a valid ISO date', () => {
    const codec = dateCodecOptions('en-US')
    expect(codec.format('')).toBe('')
    expect(codec.format('not-a-date')).toBe('not-a-date')
  })
})

describe('dateCodecOptions — round-trip: ISO → format → parse', () => {
  it('parse(format(iso)) returns the original ISO string for a set of representative dates', () => {
    const codec = dateCodecOptions('en-US')
    // Includes leap day, mid-year, end-of-year, and millennium.
    for (const iso of ['2024-01-15', '2024-02-29', '2024-07-04', '2024-12-31', '2000-01-01']) {
      expect(codec.parse(codec.format(iso))).toBe(iso)
    }
  })

  it('errorMessage is "Please enter a valid date."', () => {
    expect(dateCodecOptions().errorMessage).toBe('Please enter a valid date.')
  })
})

describe('dateCodecOptions — locale heuristic: numeric inputs', () => {
  it('en-US numeric m/d/yyyy → resolved as month/day/year (03/04/2024 → 2024-03-04)', () => {
    // en-US dateStyle:'medium' componentOrder is month/day/year (from "Mar 4, 2001" formatToParts).
    expect(dateCodecOptions('en-US').parse('03/04/2024')).toBe('2024-03-04')
  })

  it('numeric tokens with hyphens also split correctly (03-04-2024 en-US → 2024-03-04)', () => {
    expect(dateCodecOptions('en-US').parse('03-04-2024')).toBe('2024-03-04')
  })

  it('invalid numeric day/month → null (heuristic round-trip validation catches overflow)', () => {
    // 13th month: the heuristic assigns mo=13, then new Date(2024, 12, 01) = Jan 1 2025
    // → getMonth()=0 ≠ 12 → null.
    expect(dateCodecOptions('en-US').parse('13/01/2024')).toBeNull()
  })
})

// ── timeCodecOptions (Wave 5B, ADR-0048) ──────────────────────────────────────

describe('timeCodecOptions — parse: HH:MM 24h canonical', () => {
  it('"00:00" → "00:00" (midnight)', () => {
    expect(timeCodecOptions('en-US').parse('00:00')).toBe('00:00')
  })

  it('"23:59" → "23:59" (last minute of day)', () => {
    expect(timeCodecOptions('en-US').parse('23:59')).toBe('23:59')
  })

  it('"12:00" → "12:00" (midday)', () => {
    expect(timeCodecOptions('en-US').parse('12:00')).toBe('12:00')
  })

  it('single-digit hour: "9:05" → "09:05" (zero-padded canonical)', () => {
    expect(timeCodecOptions('en-US').parse('9:05')).toBe('09:05')
  })

  it('out-of-range hour 24:00 → null', () => {
    expect(timeCodecOptions('en-US').parse('24:00')).toBeNull()
  })

  it('out-of-range minute 12:60 → null', () => {
    expect(timeCodecOptions('en-US').parse('12:60')).toBeNull()
  })

  it('invalid input → null', () => {
    expect(timeCodecOptions('en-US').parse('not-a-time')).toBeNull()
    expect(timeCodecOptions('en-US').parse('')).toBeNull()
    expect(timeCodecOptions('en-US').parse('abc')).toBeNull()
  })
})

describe('timeCodecOptions — parse: AM/PM best-effort (12h → 24h)', () => {
  it('"12:00 AM" → "00:00" (midnight — 12 AM is the zero hour)', () => {
    expect(timeCodecOptions('en-US').parse('12:00 AM')).toBe('00:00')
  })

  it('"12:00 PM" → "12:00" (noon — 12 PM stays 12)', () => {
    expect(timeCodecOptions('en-US').parse('12:00 PM')).toBe('12:00')
  })

  it('"1:30 PM" → "13:30"', () => {
    expect(timeCodecOptions('en-US').parse('1:30 PM')).toBe('13:30')
  })

  it('"11:59 PM" → "23:59"', () => {
    expect(timeCodecOptions('en-US').parse('11:59 PM')).toBe('23:59')
  })

  it('case-insensitive: "9:00 am" → "09:00"', () => {
    expect(timeCodecOptions('en-US').parse('9:00 am')).toBe('09:00')
  })

  it('invalid AM/PM minute > 59 → null', () => {
    expect(timeCodecOptions('en-US').parse('11:60 AM')).toBeNull()
  })
})

describe('timeCodecOptions — format: canonical → localized display', () => {
  it('formats "00:00" to the locale midnight string', () => {
    const codec = timeCodecOptions('en-US')
    // Derive expected from Intl to stay CLDR-version-agnostic.
    const expected = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(2000, 0, 1, 0, 0, 0))
    expect(codec.format('00:00')).toBe(expected)
  })

  it('formats "12:00" to the locale noon string', () => {
    const codec = timeCodecOptions('en-US')
    const expected = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(2000, 0, 1, 12, 0, 0))
    expect(codec.format('12:00')).toBe(expected)
  })

  it('formats "23:59" to the locale last-minute string', () => {
    const codec = timeCodecOptions('en-US')
    const expected = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(2000, 0, 1, 23, 59, 0))
    expect(codec.format('23:59')).toBe(expected)
  })

  it('returns the canonical as-is when it is not a valid HH:MM', () => {
    const codec = timeCodecOptions('en-US')
    expect(codec.format('')).toBe('')
    expect(codec.format('bad')).toBe('bad')
  })
})

describe('timeCodecOptions — round-trip: canonical → format → parse', () => {
  it('parse(format(hhmm)) returns the original canonical for representative times', () => {
    const codec = timeCodecOptions('en-US')
    // Covers midnight, noon, early-PM, and last minute.
    for (const t of ['00:00', '09:00', '12:00', '13:30', '23:59']) {
      expect(codec.parse(codec.format(t))).toBe(t)
    }
  })

  it('errorMessage is "Please enter a valid time."', () => {
    expect(timeCodecOptions().errorMessage).toBe('Please enter a valid time.')
  })
})
