// settings-schema.ts — the pure, DOM-free `SettingsSchema` vocabulary (ADR-0135 Piece A). Hoisted to
// `@agent-ui/shared` (the DAG bottom) from `@agent-ui/app`'s settings/schema.ts so any below-`app`
// consumer can describe a config as a schema: `@agent-ui/app` (the `ui-settings` control registry) and
// `@agent-ui/a2ui` (the live-agent config builder) both import the ONE definition rather than drifting
// two copies. The DOM/`@agent-ui/components`-coupled control registry stays in app; only the types +
// the pure guards live here.
//
// The guards (`findField`/`initialValuesFor`/`sanitizeNumber`/`sanitizeSelect`) hoist alongside the
// types (ADR-0135 Fork 2 = hoist): the fail-closed idiom has exactly ONE implementation, shared by
// app's `agent-admin-schema.ts` and a2ui's `agent-config-schema.ts` — `a2ui` cannot import `@agent-ui/
// app` (app is downstream in the DAG), so hoisting is the only way both honor "don't invent a second
// validation idiom". Zero-dep, zero-DOM — belongs at the DAG bottom exactly like the types.

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

// ── the pure fail-closed guards + seed helper (ADR-0135 Fork 2, hoisted from agent-admin-schema.ts) ────

/** Every key + its schema `default` this schema's fields declare — the `initial` a
 *  `createMemoryStore({ persistKey })` needs to actually read its OWN localStorage-backed values back
 *  after a reload. `memory-store.ts`'s seed loop only checks `localStorage` for keys already present in
 *  `initial` at construction time (it iterates `values.keys()`, never a blind localStorage scan) — an
 *  empty `initial` means every `get()` returns `undefined` forever, even after a real prior `set()`,
 *  silently defeating ADR-0131 cl.3's ruled real-persistence scope. */
export function initialValuesFor(schema: SettingsSchema): Record<string, unknown> {
  const initial: Record<string, unknown> = {}
  for (const section of schema.sections) {
    for (const field of section.fields) initial[field.key] = field.default
  }
  return initial
}

/** Find one field's definition across every section of a schema, or `undefined` if the schema doesn't
 *  declare it (a bring-your-own schema/store combination the turn loop must still degrade safely against). */
export function findField(schema: SettingsSchema, key: string): SettingsField | undefined {
  for (const section of schema.sections) {
    const field = section.fields.find((f) => f.key === key)
    if (field) return field
  }
  return undefined
}

/** Fail-closed against the SCHEMA's own declared bounds (SPEC-R11 is `ui-settings`' own commit-time
 *  guarantee for values IT writes; this is a bring-your-own store's own guard for a store that bypassed
 *  `ui-settings` entirely — an out-of-range or unrecognized stored value must never reach a consumer
 *  verbatim). `raw` wins only if it validates; otherwise the field's own schema `default` does. */
export function sanitizeNumber(schema: SettingsSchema, key: string, raw: unknown, fallback: number): number {
  const field = findField(schema, key)
  const min = field?.validation?.min ?? -Infinity
  const max = field?.validation?.max ?? Infinity
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= min && raw <= max) return raw
  const def = field?.default
  return typeof def === 'number' ? def : fallback
}

export function sanitizeSelect(schema: SettingsSchema, key: string, raw: unknown, fallback: string): string {
  const field = findField(schema, key)
  const allowed = field?.options?.map((o) => o.value)
  if (typeof raw === 'string' && (allowed === undefined || allowed.includes(raw))) return raw
  const def = field?.default
  return typeof def === 'string' ? def : fallback
}
