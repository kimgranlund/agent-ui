// schema.ts — the `SettingsSchema` types + the field-type → control registry (app-surfaces-m4.lld.md
// LLD-C13, SPEC-R10; the ADR-0065 swappable-pack precedent applied to a per-field-type factory instead
// of an icon pack). `generate.ts` (LLD-C13's other half) consumes `FIELD_CONTROL_REGISTRY` to turn a
// schema into a live DOM tree; `validate.ts` (LLD-C14) wires `Field.validation` onto whatever a factory
// here produced. This file owns ONLY the types + the six v1 factories — no generation/validation logic.
//
// Each factory creates ONE fleet FACE control + returns a `RegisteredControl`: the raw `element` (typed
// `UIFormElement` — every v1 mapping target is one) plus a `getValue`/`setValue` PAIR that bridges the
// settings-level `unknown` value to whatever that control's own value model is. The get side rides the
// ADR-0050 `ui-form-connect` seam (`FormConnectDetail.value`) rather than reading the control's public
// `value`/`checked` prop directly: `ui-text-field`'s `number`/`date` types split DISPLAY (the public
// `value` prop, locale/format-dependent) from CANONICAL (`formValue()`, only reachable through the
// connect-event closure) — riding the seam every other consumer (`ui-field`, `ui-form-provider`) already
// uses is the "one timing source" law (ADR-0051), not a bespoke read path invented here.

import { FORM_CONNECT_EVENT, type FormConnectDetail, type FormValue, type UIFormElement } from '@agent-ui/components'
// Side-effect only: register the four v1 mapped tags before any factory below ever calls
// `document.createElement` on one.
import '@agent-ui/components/controls/text-field'
import '@agent-ui/components/controls/switch'
import '@agent-ui/components/controls/select'
import '@agent-ui/components/controls/slider'

// ── the schema types (SPEC §4) ────────────────────────────────────────────────────────────────────────

/** The v1 field-type set (SPEC-R10) — an unknown/future type degrades (generate.ts), never throws. */
export type SettingsFieldType = 'text' | 'number' | 'boolean' | 'select' | 'slider' | 'date'

export interface SettingsFieldValidation {
  required?: boolean
  min?: number
  max?: number
  step?: number
  /** Only meaningful for `type: 'text'` — ignored (+ warned) on every other type (validate.ts). */
  pattern?: string
}

export interface SettingsFieldOption {
  value: string
  label: string
}

export interface SettingsField {
  key: string
  type: SettingsFieldType
  label: string
  description?: string
  default: unknown
  validation?: SettingsFieldValidation
  /** Required (and consumed) only by `type: 'select'`. */
  options?: SettingsFieldOption[]
}

export interface SettingsSection {
  id: string
  label: string
  description?: string
  fields: SettingsField[]
}

/** `version` is a plain literal union of ONE member today — a future v2 schema adds a member here; an
 *  unrecognised runtime value (SPEC-R10 AC3) is handled at the generate.ts/settings.ts boundary, not by
 *  narrowing this type. */
export interface SettingsSchema {
  version: 1
  sections: SettingsSection[]
}

// ── the field → control registry (SPEC-R10 "the field-type → control registry") ──────────────────────

/** What a registry factory hands back: the live control + a get/set pair bridging `unknown` ⇄ the
 *  control's own value model. `element` is typed `UIFormElement` (every v1 mapping target is a FACE form
 *  control) — the concrete subtype stays internal to the factory that built it. */
export interface RegisteredControl {
  element: UIFormElement
  getValue: () => unknown
  setValue: (value: unknown) => void
}

export type ControlFactory = (field: SettingsField) => RegisteredControl

/**
 * Bridge a control's CANONICAL form value via the ADR-0050 connect-event closure (`FormConnectDetail.
 * value`) — the same seam `ui-field`/`ui-form-provider` read, so a `number`/`date`-typed `ui-text-field`
 * never has to be second-guessed through its own display-string `value` prop. Returns `null` if the
 * control has never connected (never observed in this build — `getValue` is only ever called after the
 * generated tree is live, on a user-driven `change`).
 */
function bridgeFormValue(el: UIFormElement): () => FormValue {
  let read: (() => FormValue) | null = null
  el.addEventListener(FORM_CONNECT_EVENT, (event) => {
    const detail = (event as CustomEvent<FormConnectDetail>).detail
    if (detail && detail.control === el) read = detail.value
  })
  return () => (read ? read() : null)
}

/** `FormValue` (`File | string | FormData | null`) → the settings-level `unknown` the schema/store deal
 *  in, per field TYPE (native-checkbox-value parity drives the `boolean` branch — SPEC §4). */
function decodeFormValue(type: SettingsFieldType, raw: FormValue): unknown {
  if (type === 'boolean') return raw !== null // unchecked submits nothing (FormData parity) ⇒ absent = false
  if (type === 'number' || type === 'slider') return raw === null || raw === '' ? undefined : Number(raw)
  return typeof raw === 'string' ? raw : '' // text / select / date — the canonical string, as-is
}

/** The settings-level `unknown` value → whatever property write drives that control's own value model. */
function applyControlValue(el: UIFormElement, type: SettingsFieldType, value: unknown): void {
  if (type === 'boolean') {
    ;(el as unknown as { checked: boolean }).checked = Boolean(value)
    return
  }
  if (type === 'slider') {
    ;(el as unknown as { value: number }).value = typeof value === 'number' ? value : Number(value ?? 0)
    return
  }
  // text / number / date / select all take a STRING `value` prop; the text-field type-effect derives its
  // own canonical from whatever this ends up being (the codec parses `value`, it does not require it).
  ;(el as unknown as { value: string }).value = value == null ? '' : String(value)
}

function textFieldFactory(kind: 'text' | 'number' | 'date'): ControlFactory {
  return (field) => {
    const el = document.createElement('ui-text-field') as UIFormElement & {
      type: string
      min: string
      max: string
      step: number
    }
    el.type = kind
    if (field.validation?.min !== undefined) el.min = String(field.validation.min)
    if (field.validation?.max !== undefined) el.max = String(field.validation.max)
    if (field.validation?.step !== undefined) el.step = field.validation.step
    const read = bridgeFormValue(el)
    return {
      element: el,
      getValue: () => decodeFormValue(kind, read()),
      setValue: (v) => applyControlValue(el, kind, v),
    }
  }
}

function switchFactory(): ControlFactory {
  return () => {
    const el = document.createElement('ui-switch') as UIFormElement
    const read = bridgeFormValue(el)
    return {
      element: el,
      getValue: () => decodeFormValue('boolean', read()),
      setValue: (v) => applyControlValue(el, 'boolean', v),
    }
  }
}

function selectFactory(): ControlFactory {
  return (field) => {
    const el = document.createElement('ui-select') as UIFormElement
    const options = field.options ?? []
    if (options.length === 0) {
      console.warn(`ui-settings: select field "${field.key}" has no options — the listbox will be empty`)
    }
    for (const option of options) {
      const optionEl = document.createElement('div')
      optionEl.setAttribute('role', 'option')
      optionEl.setAttribute('value', option.value)
      optionEl.textContent = option.label
      el.append(optionEl)
    }
    const read = bridgeFormValue(el)
    return {
      element: el,
      getValue: () => decodeFormValue('text', read()),
      setValue: (v) => applyControlValue(el, 'text', v),
    }
  }
}

function sliderFactory(): ControlFactory {
  return (field) => {
    const el = document.createElement('ui-slider') as UIFormElement & { min: number; max: number; step: number }
    if (field.validation?.min !== undefined) el.min = field.validation.min
    if (field.validation?.max !== undefined) el.max = field.validation.max
    if (field.validation?.step !== undefined) el.step = field.validation.step
    const read = bridgeFormValue(el)
    return {
      element: el,
      getValue: () => decodeFormValue('slider', read()),
      setValue: (v) => applyControlValue(el, 'slider', v),
    }
  }
}

/** The v1 field-type → control mapping (SPEC-R10): text/number/date → `ui-text-field`(+its own `type`),
 *  boolean → `ui-switch`, select → `ui-select`, slider → `ui-slider`. A lookup miss (a future/unknown
 *  type) is generate.ts's job to degrade — this registry never has a fallback entry of its own. */
export const FIELD_CONTROL_REGISTRY: Partial<Record<SettingsFieldType, ControlFactory>> = {
  text: textFieldFactory('text'),
  number: textFieldFactory('number'),
  date: textFieldFactory('date'),
  boolean: switchFactory(),
  select: selectFactory(),
  slider: sliderFactory(),
}
