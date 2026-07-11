// generate.ts — the schema-in → form-out generator (app-surfaces-m4.lld.md LLD-C13, SPEC-R11). Turns ONE
// `SettingsSection` into a live `ui-form-provider` wrapping one `ui-field` per field (label/description
// from the schema), each wrapping the `schema.ts` registry's control — 0 app-authored form CSS/glue: the
// generated tree is fleet controls only, coordinated by the SAME `ui-form-provider`/`ui-field` seam a
// hand-authored form would use (ADR-0050/0051). `settings.ts` composes ONE generated provider per
// section; this file never touches `ui-master-detail`/the rail — that is settings.ts's own composition.

import type { UIFieldElement } from '@agent-ui/components/controls/field'
import type { UIFormProviderElement } from '@agent-ui/components/controls/form-provider'
// Side-effect only: register the two coordination tags before this module ever creates one.
import '@agent-ui/components/controls/field'
import '@agent-ui/components/controls/form-provider'
import { FIELD_CONTROL_REGISTRY, type SettingsField, type SettingsSection } from './schema.ts'
import type { SettingsStore } from './store.ts'
import { applyValidation } from './validate.ts'
import type { UIFormElement } from '@agent-ui/components'

/** A section's generated tree + the cleanup for whatever reactive validation effects it installed
 *  (validate.ts) — the caller (settings.ts) disposes this on teardown. */
export interface GeneratedSection {
  element: UIFormProviderElement
  dispose: () => void
  /**
   * Re-run `validate.ts`'s wiring on the ALREADY-GENERATED controls — no DOM change, no re-generation.
   * `settings.ts`'s `disconnected()` disposes every reactive validation effect UNCONDITIONALLY (the same
   * `this.listen`-scoped-to-the-AbortSignal shape its rail-button listeners already document) — a
   * same-schema/store RECONNECT that skips a full rebuild (live field values must survive it) would
   * otherwise leave validation permanently inert post-reconnect (the component-reviewer MAJOR finding this
   * fixes). The caller collects the fresh disposer the SAME way as `dispose` above.
   */
  reapplyValidation: () => () => void
}

/** Build the disabled placeholder for an unrecognised `field.type` (SPEC-R10 AC2) — never a fleet form
 *  control (there is no mapping to render one AS), a plain inert marker instead. */
function unsupportedFieldPlaceholder(field: SettingsField): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-part', 'unsupported-field')
  el.setAttribute('aria-disabled', 'true')
  el.textContent = `Unsupported field type "${field.type}".`
  return el
}

/**
 * Generate ONE section's form: a `ui-form-provider` containing one `ui-field`-wrapped control per
 * schema field. Reads the field's current value from `store.get(key) ?? field.default` (SPEC-R12 AC1/
 * AC2 — a missing store degrades to the field's own default, never throws) and commits per-field on the
 * control's own `change` (SPEC-R12 "per-field-on-change", the LLD-C15 recommended timing).
 */
export function generateSection(section: SettingsSection, store: SettingsStore | undefined): GeneratedSection {
  const provider = document.createElement('ui-form-provider') as UIFormProviderElement
  const disposers: Array<() => void> = []
  // Every VALIDATED (registry-mapped) control + its field — the `reapplyValidation` re-arm reads this,
  // never the unsupported-type placeholders (they carry no control to validate).
  const validated: Array<{ control: UIFormElement; field: SettingsField }> = []

  for (const field of section.fields) {
    const wrapper = document.createElement('ui-field') as UIFieldElement
    wrapper.label = field.label
    if (field.description) wrapper.description = field.description

    const factory = FIELD_CONTROL_REGISTRY[field.type]
    if (!factory) {
      console.warn(`ui-settings: unknown field type "${field.type}" for field "${field.key}" — rendering a disabled placeholder`)
      wrapper.append(unsupportedFieldPlaceholder(field))
      provider.append(wrapper)
      continue
    }

    const registered = factory(field)
    registered.element.name = field.key
    const initial = store ? (store.get(field.key) ?? field.default) : field.default
    registered.setValue(initial)
    disposers.push(applyValidation(registered.element, field))
    validated.push({ control: registered.element, field })

    // `queueMicrotask`, not a synchronous read: `ui-text-field`'s number/date types re-parse the display
    // into the CANONICAL value via a `blur` listener registered AFTER (and so, on the same target, firing
    // AFTER) the control's own commit-`change`-on-blur listener (value-codec.ts's own header comment) — a
    // synchronous `getValue()` here would read the STALE pre-parse canonical, one edit behind. Both
    // listeners fire within the SAME synchronous `blur` dispatch, so deferring one microtask is enough to
    // land after the codec's own update without waiting on anything longer (text/select/slider have no
    // such split — the defer is a no-op timing-wise for them, same value either way).
    registered.element.addEventListener('change', () => {
      queueMicrotask(() => store?.set(field.key, registered.getValue()))
    })

    wrapper.append(registered.element)
    provider.append(wrapper)
  }

  return {
    element: provider,
    dispose: () => {
      for (const dispose of disposers) dispose()
    },
    reapplyValidation: () => {
      const fresh = validated.map(({ control, field }) => applyValidation(control, field))
      return () => {
        for (const dispose of fresh) dispose()
      }
    },
  }
}
