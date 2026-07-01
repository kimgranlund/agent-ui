// value-codec.ts — the valueCodec controller: format-on-blur + parse-on-commit for display-codec fields
// (Wave 3 ui-text-field type=number/currency — ADR-0044). Rebuilt in Wave 5A (ADR-0047) on a shared
// numeric core for multi-currency fraction digits + unit/percent codecs.
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
// Lifetime: listeners ride host.listen() → the connection AbortSignal → zero residue on disconnect.
// release() is the idempotent early-teardown guard; the control calls it from the type-change effect
// cleanup or from disconnected().
//
// Layering: traits → reactive (L0) + dom (L1) — downward imports, import-layering trip-wire holds.

import { signal, untracked } from '../reactive/index.ts'
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

  // Focus (captured on host): fires in the capture phase BEFORE the control's direct-on-editor focus
  // listener. This ensures host.value is reverted to canonical BEFORE the control records #committed,
  // so a focus→no-change→blur cycle does not emit a spurious change event.
  const onFocus = (event: Event): void => {
    if (released) return
    // Guard: only the editor's own focus, not a descendant button (e.g. reveal toggle) getting focus.
    if (editor && event.target !== editor) return
    if (!hasError.value) host.value = canonical.value
  }

  // Blur (direct on editor): fires AFTER the control's own blur listener (same element, later
  // registration = later in dispatch order). The control's change-on-commit fires first, then the
  // codec reformats the display — no spurious second change from host.value being rewritten.
  const onBlur = (): void => {
    if (released) return
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
