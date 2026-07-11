// validate.ts — wire `Field.validation` onto the generated control's OWN validity (app-surfaces-m4.lld.md
// LLD-C14, SPEC-R11). ONE timing source (the ADR-0051 reactive-error law): this file never invents a
// second error-observation path — it either sets a NATIVE constraint prop the control already checks
// itself (`required`/`min`/`max`/`step` on `ui-text-field`'s text/number/date types, `required` on
// `ui-select`, both of which have their OWN `formValidity()` override), or, where no native constraint
// exists for that field type, calls the control's OWN public `setCustomValidity` from a reactive effect
// (the same seam `ui-color-picker`/A2UI's own `checks` renderer use, ADR-0029 §5) — never a bespoke
// validation engine, and the resulting error still renders through the control's existing `user-invalid`
// timing + the `ui-field` error part + the `ui-form-provider` aggregate, unchanged.
//
// Native coverage today (verified against the shipped controls, not assumed): `ui-text-field` (text/
// number/date) and `ui-select` both override `formValidity()` to enforce `required` (+ text-field's own
// `min`/`max`/`step` range checks) — setting the prop is sufficient, no bridging needed. `ui-switch` and
// `ui-slider` do NOT override `formValidity()` (their shared bases, `UIIndicatorElement`/`UIRangeElement`,
// leave the base's always-valid default) — `required` on a `boolean` field is bridged via
// `setCustomValidity` here; `min`/`max`/`step` on a `slider` field are the widget's own OPERATING range
// (already applied by schema.ts's registry factory, not a separate validity concern — a slider value can
// never be out of range, so there is nothing left for this file to enforce there).

import { effect, type UIFormElement } from '@agent-ui/components'
import type { SettingsField } from './schema.ts'

/** Apply `field.validation` onto `el` (already built + configured by the schema.ts registry). Returns a
 *  disposer for whatever reactive effect this installed (a no-op function when nothing reactive was
 *  needed) — the caller (generate.ts) collects these and disposes them on teardown. */
export function applyValidation(el: UIFormElement, field: SettingsField): () => void {
  const rules = field.validation
  if (!rules) return () => {}

  const hasNativeRequired = field.type === 'text' || field.type === 'number' || field.type === 'date' || field.type === 'select'
  const hasNativeRange = field.type === 'text' || field.type === 'number' || field.type === 'date'

  if (rules.required !== undefined && hasNativeRequired) {
    ;(el as unknown as { required: boolean }).required = rules.required
  } else if (rules.required && field.type !== 'boolean') {
    // Neither a native required check (hasNativeRequired) NOR the `boolean` setCustomValidity bridge below
    // covers this field's type (today, only `slider`) — matches the pattern-on-non-text warn just below:
    // an unenforceable rule is IGNORED, never silently dropped without a trace.
    console.warn(`ui-settings: validation.required cannot be enforced on field "${field.key}" (type="${field.type}" has no native check or bridge) — ignored`)
  }
  if (hasNativeRange) {
    if (rules.min !== undefined) (el as unknown as { min: string }).min = String(rules.min)
    if (rules.max !== undefined) (el as unknown as { max: string }).max = String(rules.max)
    if (rules.step !== undefined) (el as unknown as { step: number }).step = rules.step
  }
  if (rules.min !== undefined && rules.max !== undefined && rules.min > rules.max) {
    console.warn(
      `ui-settings: field "${field.key}" has validation.min (${rules.min}) > validation.max (${rules.max}) — the schema author's error`,
    )
  }

  const disposers: Array<() => void> = []

  if (rules.pattern) {
    if (field.type !== 'text') {
      console.warn(`ui-settings: validation.pattern is ignored on field "${field.key}" (type="${field.type}" is not text)`)
    } else {
      const re = new RegExp(rules.pattern)
      const message = 'Value does not match the required format.'
      disposers.push(
        effect(() => {
          const value = (el as unknown as { value: string }).value
          el.setCustomValidity(re.test(value) ? '' : message)
        }),
      )
    }
  }

  // `required` with NO native enforcement on this field's mapped control (boolean → ui-switch) — the
  // LLD-C14 fallback path, a reactive setCustomValidity bridge, exactly as the header documents.
  if (rules.required && field.type === 'boolean') {
    const message = 'This setting is required.'
    disposers.push(
      effect(() => {
        const checked = (el as unknown as { checked: boolean }).checked
        el.setCustomValidity(checked ? '' : message)
      }),
    )
  }

  if (disposers.length === 0) return () => {}
  return () => {
    for (const dispose of disposers) dispose()
  }
}
