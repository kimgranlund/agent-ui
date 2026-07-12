// value-codec.ts — the valueCodec controller: format-on-blur + parse-on-commit for display-codec fields
// (Wave 3 ui-text-field type=number/currency — ADR-0044). Rebuilt in Wave 5A (ADR-0047) on a shared
// numeric core for multi-currency fraction digits + unit/percent codecs. Extended in Wave 5B (ADR-0048)
// with date and time codecs (dateCodecOptions / timeCodecOptions).
//
// Codec-agnostic: parse and format are caller-supplied. The trait manages the display↔canonical split:
//   • Focus (capture on host, fires BEFORE the control's direct editor focus listener): host.value ←
//     canonical.value (raw, editable form value — e.g. "1234.56"). Using capture ensures the control's
//     own focus handler (#committed ← this.value) records the canonical, not the formatted display, so
//     a focus→no-change→blur cycle does not emit a spurious `change` event.
//   • Blur (direct on editor, fires AFTER the control's own blur listener): parse(display) → if ok:
//     canonical ← parsed; host.value ← format(parsed) (e.g. "1,234.56"); if err: hasError ← true.
//   • The control's formValue() override returns canonical.value — host.value after blur is the
//     formatted display string, NOT the canonical submission value.
//   • hasError drives the control's formValidity() customError verdict.
//   • setCanonical(v): used by affordances (clear, steppers) that change the value programmatically
//     outside the normal blur path, so the canonical stays in sync.
//
// TKT-0023 — the unfocused-write resync (root-cause fix, not a consumer-facing method): a THIRD reactive
// path, alongside focus/blur, watches host.value directly so a programmatic `host.value = …` write reaches
// canonical without waiting for a real blur. It is its OWN effect() (not nested in the control's type-effect
// — see the untracked() seed note below for why that separation matters), so it tracks host.value on its
// own graph node:
//   • First run (at attach/type-switch) is a no-op — the seed line above already copied host.value into
//     canonical for this same run; re-deriving it here would risk flipping hasError on a bad *seeded*
//     value that the pre-fix code never flagged before an interaction. Out of scope for this fix.
//   • While FOCUSED (the codec's own `focused` flag, set by the same onFocus/onBlur pair — NOT
//     document.activeElement, so the seam matches how focus/blur are actually driven: synthetic dispatch
//     in tests, real focus in the browser): SKIPPED. The documented semantic (TKT-0023 acceptance,
//     mid-edit case) is display-is-source-of-truth while the user is mid-edit — canonical still resyncs
//     on the NEXT blur, same as any typed edit. A programmatic write while focused updates the surface
//     (the existing model→surface effect) but does not fight the in-flight edit.
//   • While UNFOCUSED: resync canonical exactly as a blur would — '' short-circuits to canonical=''/
//     hasError=false (the same "known-good empty" precedent setCanonical's callers already rely on, e.g.
//     the clear button); non-empty parses through opts.parse, mirroring onBlur's success/failure branches
//     (parse failure sets hasError, canonical stays untouched — never a silent wrong-canonical).
//   • Never rewrites host.value/display — the model→surface caret-guard effect already reflects the raw
//     written value; reformatting-on-write is not part of this fix's contract (only blur reformats).
//
// Lifetime: listeners ride host.listen() → the connection AbortSignal → zero residue on disconnect.
// release() is the idempotent early-teardown guard; the control calls it from the type-change effect
// cleanup or from disconnected(). The unfocused-write effect above is disposed by the SAME release() call.
//
// Layering: traits → reactive (L0) + dom (L1) — downward imports, import-layering trip-wire holds.

import { signal, untracked, effect } from '../reactive/index.ts'
import type { ReadonlySignal } from '../reactive/index.ts'
import type { UIElement } from '../dom/index.ts'

// ── public surface ────────────────────────────────────────────────────────────

export interface ValueCodecOptions {
  /** Parse display string → canonical form value (e.g. "1,234.56" → "1234.56"). null = parse error. */
  parse(display: string): string | null
  /** Format canonical form value → display string (e.g. "1234.56" → "1,234.56"). */
  format(value: string): string
  /** Validation message to expose when parse returns null; the control uses it in formValidity(). */
  errorMessage: string
}

export interface ValueCodecController {
  /**
   * The last successfully parsed canonical form value. The control MUST return `canonical.value` from
   * its formValue() override when the codec is active — host.value holds the formatted display after
   * blur, not the canonical submission value. Seeded from host.value at attach time.
   */
  readonly canonical: ReadonlySignal<string>
  /**
   * True when the most recent blur attempt failed to parse. The control drives its formValidity()
   * `customError` flag from this signal.
   */
  readonly hasError: ReadonlySignal<boolean>
  /** The error message string (mirrors opts.errorMessage). */
  readonly errorMessage: string
  /**
   * Force-update the canonical when the control changes the value programmatically outside the blur
   * path (e.g. clear button, steppers). Also clears hasError, since the programmatic value is known-valid.
   */
  setCanonical(value: string): void
  /**
   * Idempotent early teardown — stops the behaviour on the next event. Listeners auto-die with the
   * connection scope regardless; call release() from the type-change effect cleanup or disconnected().
   */
  release(): void
}

// The host interface: UIElement with the string `value` reactive prop (UITextFieldElement shape).
interface CodecHost extends UIElement {
  value: string
}

// ── valueCodec ────────────────────────────────────────────────────────────────

/**
 * Attach the display-codec behaviour to a form control. Invoke from connected(), AFTER the control
 * has created its [data-part="editor"] child (so the editor is present for listener registration).
 *
 * @param host    The control — must have a `value` reactive prop and a `[data-part="editor"]` child.
 * @param opts    The codec: parse / format / errorMessage.
 * @param typeSignal  Optional per-type-run `AbortSignal` (from the type-effect's `AbortController`). When
 *                    provided, both the focus (capture on host) and blur (on editor) listeners are tied
 *                    to THIS signal, so the type-effect's `typeAc.abort()` removes them immediately on
 *                    type change. Without the signal, they fall back to `host.listen()` (connection scope)
 *                    and live until disconnect — which leaks N−1 inert listener pairs after N type-switches.
 *                    Wave 5B date/time codecs MUST pass `typeAc.signal` on the same seam.
 * @returns           Controller: canonical + hasError + errorMessage + setCanonical + release.
 */
export function valueCodec(host: CodecHost, opts: ValueCodecOptions, typeSignal?: AbortSignal): ValueCodecController {
  let released = false
  // Seed canonical from the host's current value so a pre-filled field round-trips on first blur.
  // untracked: this read must not create a dependency in any calling effect — the type-effect should
  // only re-run on type change, not on every value write.
  const canonical = signal(untracked(() => host.value))
  const hasError = signal(false)

  const editor = host.querySelector('[data-part="editor"]') as HTMLElement | null

  // The codec's own focus-tracking flag — driven by the SAME onFocus/onBlur pair below, not
  // document.activeElement (this control is exercised by synthetic focus/blur dispatch throughout the
  // test suite, which never moves real DOM focus). The unfocused-write resync effect (below) reads this.
  let focused = false

  // Focus (captured on host): fires in the capture phase BEFORE the control's direct-on-editor focus
  // listener. This ensures host.value is reverted to canonical BEFORE the control records #committed,
  // so a focus→no-change→blur cycle does not emit a spurious change event.
  const onFocus = (event: Event): void => {
    if (released) return
    // Guard: only the editor's own focus, not a descendant button (e.g. reveal toggle) getting focus.
    if (editor && event.target !== editor) return
    focused = true
    if (!hasError.value) host.value = canonical.value
  }

  // Blur (direct on editor): fires AFTER the control's own blur listener (same element, later
  // registration = later in dispatch order). The control's change-on-commit fires first, then the
  // codec reformats the display — no spurious second change from host.value being rewritten.
  const onBlur = (): void => {
    if (released) return
    focused = false
    const parsed = opts.parse(host.value)
    if (parsed === null) {
      hasError.value = true
      return
    }
    hasError.value = false
    canonical.value = parsed
    // Writing host.value triggers the control's model→surface caret-guard effect, which syncs the
    // editor's textContent. Safe on blur — no active caret to protect at this point.
    host.value = opts.format(parsed)
  }

  // TKT-0023 — the unfocused-write resync: an OWN effect() (not nested inside the control's type-effect),
  // so its tracked read of host.value never becomes a dependency of the caller's outer effect (the same
  // untracked-read discipline the seed line above protects — see the header note). Skips its own first
  // run (the seed already covers it), skips entirely while focused (the documented mid-edit semantic —
  // canonical catches up on the next blur), and otherwise mirrors blur's parse/hasError contract without
  // ever touching host.value (no reformat-on-write — only blur reformats the display).
  let firstRun = true
  const disposeResync = effect((): void => {
    const v = host.value // tracked — the whole point: wake on ANY host.value write, typed or programmatic
    if (released) return
    // firstRun is consumed BEFORE the isConnected early-return (review L1): if the seed run ever executed
    // while disconnected, a still-armed firstRun would otherwise silently swallow the first REAL
    // post-connect write. Unreachable from the shipped control today (valueCodec runs inside connected()'s
    // type-effect), but the ordering costs nothing and removes the latent trap.
    if (firstRun) {
      firstRun = false
      return
    }
    // Defense-in-depth for the no-typeSignal fallback path (this function's only caller without a real
    // control wrapping it is the trait-level unit test): host.listen()'s fallback listeners ride the
    // connection AbortSignal, which this free-standing effect() has no access to (host.connectionSignal
    // is `protected`— a trait cannot reach it, same reasoning as the file header's `internals` note). An
    // isConnected guard gives the same observable outcome — zero state changes once the host is gone —
    // without widening UIElement's protected surface for a defensive-only need.
    if (!host.isConnected) return
    if (focused) return // mid-edit: display is source of truth; canonical resyncs on the existing blur path
    if (v === '') {
      // The same "known-good empty" precedent setCanonical's internal callers rely on (clear button et al.).
      canonical.value = ''
      hasError.value = false
      return
    }
    const parsed = opts.parse(v)
    if (parsed === null) {
      hasError.value = true // mirrors onBlur: canonical stays untouched, let the caller correct it
      return
    }
    hasError.value = false
    canonical.value = parsed
  })

  if (editor) {
    if (typeSignal) {
      // Per-type-run signal: listeners die when typeAc.abort() fires (type change or disconnect),
      // so each type-switch leaves exactly zero stale codec listeners rather than accumulating
      // N−1 inert pairs for N numeric type-switches (the C10 root-cause fix — M1).
      host.addEventListener('focus', onFocus, { capture: true, signal: typeSignal })
      editor.addEventListener('blur', onBlur, { signal: typeSignal })
    } else {
      // Fallback (no per-type signal): listeners ride the connection AbortSignal via host.listen(),
      // dying on disconnect. Callers that can provide a finer-grained signal SHOULD (Wave 5B seam).
      host.listen(host, 'focus', onFocus, { capture: true })
      host.listen(editor, 'blur', onBlur)
    }
  }

  return {
    canonical,
    hasError,
    errorMessage: opts.errorMessage,
    setCanonical: (value: string): void => {
      canonical.value = value
      hasError.value = false
    },
    release: (): void => {
      released = true
      disposeResync() // idempotent (EffectNode.dispose) — tears down the unfocused-write resync effect too
    },
  }
}

// ── Shared numeric core (Wave 5A, ADR-0047) ───────────────────────────────────
//
// All numeric codecs (number / currency / unit) share one parse+format core: strip to [digits · decimal ·
// minus], parseFloat, Intl.NumberFormat. The only axis that varies per codec is the fraction-digit
// constraint (free for number/unit, per-currency for currency) and the error message. A single factory
// assembles the codec from those scalars, keeping the boundary logic (the string↔number crossing) in
// one place and verifiable in one test.
//
// Locale caveat (recorded, ADR-0044/ADR-0047): the strip-to-digits parse is robust for grouping
// separators but loose for locales where the decimal separator is "," ("1.234,56" strips to "1.234.56" →
// parseFloat("1.234") = 1.234 — a rounded parse). Pin locale='en-US' in tests for determinism.

function numericCodecCore(opts: {
  locale?: string
  minFraction?: number
  maxFraction?: number
  errorMessage?: string
}): ValueCodecOptions {
  const fmtOpts: Intl.NumberFormatOptions = {}
  if (opts.minFraction !== undefined) fmtOpts.minimumFractionDigits = opts.minFraction
  if (opts.maxFraction !== undefined) fmtOpts.maximumFractionDigits = opts.maxFraction
  const fmt = new Intl.NumberFormat(opts.locale, fmtOpts)
  return {
    parse(display: string): string | null {
      // Strip everything that is not a digit, decimal point, or minus sign — handles locale grouping
      // separators (e.g. "1,234.56" → "1234.56", "1.234,56" → "1234.56" for simple decimal stripping).
      const cleaned = display.replace(/[^\d.\-]/g, '')
      const n = parseFloat(cleaned)
      return Number.isFinite(n) ? String(n) : null
    },
    format(value: string): string {
      const n = parseFloat(value)
      return Number.isFinite(n) ? fmt.format(n) : value
    },
    errorMessage: opts.errorMessage ?? 'Please enter a valid number.',
  }
}

// ── Built-in codec factories (Intl.NumberFormat-based, zero-dep / native) ────

/**
 * Codec options for type=number. Parses by stripping grouping separators (accepts "1,234.56" → 1234.56);
 * formats with Intl.NumberFormat (locale-aware grouping). Accepts both raw and formatted display strings.
 *
 * @param locale  BCP 47 locale (default: runtime locale). Pin to 'en-US' in tests for determinism.
 */
export function numberCodecOptions(locale?: string): ValueCodecOptions {
  return numericCodecCore({ locale })
}

/**
 * Codec options for type=currency. Parses like numberCodecOptions; formats with the per-currency
 * fraction-digit count resolved from Intl (USD 2 · JPY 0 · BHD 3). The currency symbol is displayed
 * as the control's leading adornment (not embedded in the formatted number string) — use
 * `currencySymbol()` to resolve the glyph separately.
 *
 * @param currency  ISO 4217 currency code (e.g. 'USD', 'JPY', 'BHD'). Falls back to 2 fraction digits
 *                  on an invalid code (Intl throws a RangeError — caught defensively).
 * @param locale    BCP 47 locale (default: runtime locale).
 */
export function currencyCodecOptions(currency: string, locale?: string): ValueCodecOptions {
  // Resolve the per-currency fraction-digit count: USD → 2, JPY → 0, BHD → 3 (ISO 4217 minor units).
  // Intl resolves these natively — no hardcoded table needed.
  let minFrac = 2
  let maxFrac = 2
  try {
    const resolved = new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
    minFrac = resolved.minimumFractionDigits ?? 2
    maxFrac = resolved.maximumFractionDigits ?? 2
  } catch {
    // Invalid currency code → fall back to 2 fraction digits (the monetary precision convention).
  }
  return numericCodecCore({ locale, minFraction: minFrac, maxFraction: maxFrac, errorMessage: 'Please enter a valid amount.' })
}

/**
 * Codec options for type=unit. Delegates to the numeric core today; the `unit` param is RESERVED for
 * future per-unit precision (e.g. integer-only for °C vs. many decimals for currency ratios). The
 * unit-specificity that matters today is the trailing adornment label, not the parse/format — so there
 * is zero distinct numeric behaviour, and this is an honest reserved seam (ADR-0047 alt.2).
 *
 * @param unit    CLDR unit identifier (reserved — no numeric effect today).
 * @param locale  BCP 47 locale (default: runtime locale).
 */
export function unitCodecOptions(unit: string, locale?: string): ValueCodecOptions {
  void unit // reserved — the unit specificity that matters today is the adornment label
  return numericCodecCore({ locale })
}

// ── Label helpers (co-located with the Intl logic — Wave 5A, ADR-0047) ────────

/**
 * Extract the narrow currency symbol for the given ISO 4217 currency code (e.g. 'USD' → '$',
 * 'JPY' → '¥', 'EUR' → '€'). Uses `currencyDisplay: 'narrowSymbol'` for the compact glyph.
 * Falls back to the currency string itself on Intl error (invalid code or unsupported locale feature).
 *
 * @param currency  ISO 4217 currency code.
 * @param locale    BCP 47 locale (default: runtime locale). Affects symbol variants in some locales.
 */
export function currencySymbol(currency: string, locale?: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

/**
 * Resolve the short localized unit label for a CLDR unit identifier (e.g. 'kilogram' → 'kg',
 * 'mile-per-hour' → 'mph'). Falls back to the raw `unit` string if Intl rejects it (an invalid CLDR
 * id raises a RangeError — caught defensively). The trimmed `unit` part of `formatToParts(1)` is used
 * to extract just the label without the numeric value.
 *
 * @param unit    CLDR unit identifier (e.g. 'kilogram', 'mile-per-hour').
 * @param locale  BCP 47 locale (default: runtime locale).
 */
export function unitLabel(unit: string, locale?: string): string {
  if (!unit) return ''
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
    }).formatToParts(1)
    return parts.find((p) => p.type === 'unit')?.value?.trim() ?? unit
  } catch {
    // Intl throws a RangeError for invalid CLDR unit ids → use the raw string as the suffix.
    return unit
  }
}

// ── Date/time codecs (Wave 5B, ADR-0048) ─────────────────────────────────────
//
// Both codecs share the same parse→format contract as the numeric codecs: `format` takes the
// canonical form value and returns a localized display string; `parse` takes the display string
// and returns the canonical form (or null on invalid input). They plug into the same
// valueCodec(host, opts, typeSignal) seam with no new listener wiring — 5B-3 passes
// typeAc.signal identically to the numeric codecs.
//
// TIMEZONE NOTE (date codec): Never use new Date('YYYY-MM-DD') — it parses as UTC midnight,
// which at negative UTC offsets (e.g. US Pacific = UTC-8) renders the PREVIOUS calendar day.
// Throughout this codec, dates are constructed with new Date(year, month-1, day) (local time)
// and read back with getFullYear() / getMonth() / getDate() (local time).
//
// Locale caveat (date parse): Intl has NO parser. The codec accepts ISO reliably (step 1).
// The locale heuristic (step 2: formatToParts learns y/m/d order from a reference date, then
// splits the typed input on delimiters) handles numeric date entry. Named-month input falls
// through to new Date(display) as a last resort (step 3). null on unrecognised input. The
// calendar is the authoritative entry path; typing is intentionally lenient (ADR-0048 §4).

/**
 * Codec options for type=date. Canonical form: ISO `YYYY-MM-DD`. Format: localized medium
 * date string via Intl.DateTimeFormat `{dateStyle:'medium'}`. Parse: ISO always accepted
 * (timezone-safe local-time constructor); locale heuristic for numeric inputs (e.g. "03/04/2024"
 * in en-US → 2024-03-04); last-resort new Date() for named-month forms; null on invalid.
 * Error message: 'Please enter a valid date.'
 *
 * @param locale  BCP 47 locale (default: runtime locale). Pin to 'en-US' in tests for determinism.
 */
export function dateCodecOptions(locale?: string): ValueCodecOptions {
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  // Learn the component ORDER (year/month/day) from a reference date whose digits are all
  // distinct: 2001-03-04 (year=2001, month=3, day=4). Named month in the formatToParts output
  // is irrelevant — we only need the positional ordering, which is locale-specific (en-US is
  // month/day/year; de-DE is day/month/year).
  const componentOrder = fmt
    .formatToParts(new Date(2001, 2, 4)) // local-time constructor for 2001-03-04
    .filter((p) => p.type === 'year' || p.type === 'month' || p.type === 'day')
    .map((p) => p.type as 'year' | 'month' | 'day')

  /** Parse an ISO YYYY-MM-DD string to a local-time Date (timezone-safe). Returns null on invalid. */
  function parseIso(str: string): Date | null {
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return null
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    // Construct in LOCAL time to avoid the UTC-midnight / timezone off-by-one trap.
    const date = new Date(y, mo - 1, d)
    // Round-trip validation: JS Date overflow wraps invalid days (e.g. Feb 29 in a non-leap
    // year becomes Mar 1). A mismatch between what we asked for and what we got means the
    // input day/month exceeded the calendar — reject it.
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
    return date
  }

  /** Serialize a local-time Date to an ISO YYYY-MM-DD string. */
  function dateToIso(date: Date): string {
    const y = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${mo}-${d}`
  }

  /**
   * Locale heuristic for numeric inputs (e.g. "03/04/2024" in en-US → 2024-03-04).
   * Splits on any delimiter and maps three numeric tokens to y/m/d using the component order
   * learned from formatToParts. Named-month tokens fail parseInt → returns null, letting the
   * caller fall through to the new Date() last-resort path.
   */
  function parseWithHeuristic(display: string): Date | null {
    const tokens = display.split(/[\s/\-.,:]+/).filter(Boolean)
    if (tokens.length !== 3 || componentOrder.length !== 3) return null
    let y = 0, mo = 0, d = 0
    for (let i = 0; i < 3; i++) {
      const n = parseInt(tokens[i], 10)
      if (!Number.isFinite(n)) return null
      if (componentOrder[i] === 'year') y = n
      else if (componentOrder[i] === 'month') mo = n
      else d = n
    }
    if (!y || !mo || !d) return null
    const date = new Date(y, mo - 1, d)
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
    return date
  }

  return {
    parse(display: string): string | null {
      const trimmed = display.trim()
      if (!trimmed) return null
      // 1. ISO — always accepted; timezone-safe construction.
      const fromIso = parseIso(trimmed)
      if (fromIso) return dateToIso(fromIso)
      // 2. Locale heuristic — numeric month/day/year in locale component order.
      const fromHeuristic = parseWithHeuristic(trimmed)
      if (fromHeuristic) return dateToIso(fromHeuristic)
      // 3. Last-resort fallback — new Date() handles named-month forms ("Jul 4, 2024").
      //    Non-ISO strings parse in LOCAL time in V8 (not UTC), so getDate() is timezone-safe.
      //    Guard: skip if the input looks like ISO (step 1 already rejected it). Without this
      //    guard, V8 normalizes invalid ISO dates ("2023-02-29" → Feb 28) instead of returning
      //    Invalid Date, silently producing a wrong canonical.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const fromNative = new Date(trimmed)
        if (!Number.isNaN(fromNative.getTime())) return dateToIso(fromNative)
      }
      return null
    },
    format(iso: string): string {
      const date = parseIso(iso)
      return date ? fmt.format(date) : iso
    },
    errorMessage: 'Please enter a valid date.',
  }
}

/**
 * Codec options for type=time. Canonical form: `HH:MM` (24h, zero-padded). Format: localized
 * short time string via Intl.DateTimeFormat `{timeStyle:'short'}`. Parse: accepts HH:MM (24h)
 * and H:MM AM/PM (best-effort 12h → 24h conversion, handles en-US Intl output including
 * narrow no-break space variants); null on invalid. Error message: 'Please enter a valid time.'
 *
 * @param locale  BCP 47 locale (default: runtime locale). Pin to 'en-US' in tests for determinism.
 */
export function timeCodecOptions(locale?: string): ValueCodecOptions {
  const fmt = new Intl.DateTimeFormat(locale, { timeStyle: 'short' })

  /** Zero-pad hours and minutes to HH:MM canonical form. */
  function toHHMM(h: number, m: number): string {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  return {
    parse(display: string): string | null {
      const trimmed = display.trim()
      if (!trimmed) return null

      // 1. HH:MM (24h) — canonical form; always accepted as typed.
      const m24 = trimmed.match(/^(\d{1,2}):(\d{2})$/)
      if (m24) {
        const h = Number(m24[1]), m = Number(m24[2])
        if (h <= 23 && m <= 59) return toHHMM(h, m)
        return null
      }

      // 2. H:MM AM/PM — best-effort 12h → 24h conversion.
      //    \s* matches both regular space and narrow no-break space (U+202F), which some
      //    ICU versions emit between the time and the AM/PM period (Unicode CLDR change).
      const m12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
      if (m12) {
        let h = Number(m12[1])
        const m = Number(m12[2])
        const period = m12[3].toLowerCase()
        if (m > 59) return null
        if (period === 'am') {
          if (h === 12) h = 0       // 12:xx AM → 00:xx (midnight)
          else if (h > 12) return null
        } else {
          if (h === 12) { /* 12:xx PM → stays 12 (noon) */ }
          else if (h < 12) h += 12  // 1..11 PM → 13..23
          else return null           // h > 12 PM is invalid
        }
        if (h > 23) return null
        return toHHMM(h, m)
      }

      return null
    },
    format(canonical: string): string {
      const match = canonical.match(/^(\d{2}):(\d{2})$/)
      if (!match) return canonical
      const h = Number(match[1]), m = Number(match[2])
      if (h > 23 || m > 59) return canonical
      // Construct in local time on a fixed reference date so DST transitions don't shift
      // the displayed hour (the specific calendar date Jan 1 2000 is arbitrary — it is
      // never shown, only the time component is formatted).
      const date = new Date(2000, 0, 1, h, m, 0, 0)
      return fmt.format(date)
    },
    errorMessage: 'Please enter a valid time.',
  }
}
