// value-codec.ts — the valueCodec controller: format-on-blur + parse-on-commit for display-codec fields
// (Wave 3 ui-text-field type=number/currency — ADR-0044).
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
 * @param host  The control — must have a `value` reactive prop and a `[data-part="editor"]` child.
 * @param opts  The codec: parse / format / errorMessage.
 * @returns     Controller: canonical + hasError + errorMessage + setCanonical + release.
 */
export function valueCodec(host: CodecHost, opts: ValueCodecOptions): ValueCodecController {
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
    // Focus: capture on host (fires before the direct editor target phase listeners).
    host.listen(host, 'focus', onFocus, { capture: true })
    // Blur: direct on editor (fires after the control's own same-element blur listener).
    host.listen(editor, 'blur', onBlur)
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

// ── Built-in codec factories (Intl.NumberFormat-based, zero-dep / native) ────

/**
 * Codec options for type=number. Parses by stripping grouping separators (accepts "1,234.56" → 1234.56);
 * formats with Intl.NumberFormat (locale-aware grouping). Accepts both raw and formatted display strings.
 *
 * @param locale  BCP 47 locale (default: runtime locale). Pin to 'en-US' in tests for determinism.
 */
export function numberCodecOptions(locale?: string): ValueCodecOptions {
  const fmt = new Intl.NumberFormat(locale)
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
    errorMessage: 'Please enter a valid number.',
  }
}

/**
 * Codec options for type=currency. Parses like numberCodecOptions; formats with two decimal places
 * (monetary precision). The currency symbol is displayed as the control's leading adornment (not
 * embedded in the formatted number string).
 *
 * @param locale  BCP 47 locale (default: runtime locale).
 */
export function currencyCodecOptions(locale?: string): ValueCodecOptions {
  // Two-fraction-digit format for monetary precision; the symbol is handled by the leading adornment.
  const fmt = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return {
    parse(display: string): string | null {
      const cleaned = display.replace(/[^\d.\-]/g, '')
      const n = parseFloat(cleaned)
      return Number.isFinite(n) ? String(n) : null
    },
    format(value: string): string {
      const n = parseFloat(value)
      return Number.isFinite(n) ? fmt.format(n) : value
    },
    errorMessage: 'Please enter a valid amount.',
  }
}
