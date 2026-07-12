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
import {
  FIELD_CONTROL_REGISTRY,
  type RegisteredControl,
  type SettingsField,
  type SettingsFieldType,
  type SettingsSection,
} from './schema.ts'
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
  /**
   * Re-arm every field's `store.subscribe` external-sync listener (TKT-0021, realizing the M4 LLD §8 Fork
   * F7 optional-`subscribe` arm store.ts already carries). The SAME "dies with the connection, must be
   * re-armed" shape `reapplyValidation` documents above: `settings.ts`'s `disconnected()` disposes every
   * reactive wiring UNCONDITIONALLY, so a same-schema/store reconnect that skips a full rebuild must
   * re-subscribe here or external sync goes silently inert post-reconnect — the same reconnect-law class
   * the reactive-validation MAJOR finding already fixed. A store without `subscribe` (or no store at all)
   * returns a no-op disposer — re-arming nothing is the byte-identical behaviour that case requires.
   */
  resubscribe: () => () => void
}

/**
 * Wire ONE field's external-sync reflection: an external `store.set(field.key, value)` — from OUTSIDE this
 * generated tree (another tab, a remote push, the M4 LLD-C15 `subscribe` contract) — reflects into the
 * control via `registered.setValue`. Returns the store's own unsubscribe (a no-op disposer when the store
 * carries no `subscribe` — the optional seam stays optional, SPEC-R12).
 *
 * The suppression mechanism is the kernel's own Object.is precedent (reactive/index.ts's dedup cutoff),
 * not a reflecting-write flag: skip whenever the incoming value already equals what `getValue()` reads
 * back. This one line covers BOTH cases that matter —
 *   (1) a genuinely redundant external set (nothing to do), and
 *   (2) the load-bearing one: `memory-store.ts`'s `set()` notifies EVERY listener, including the field's
 *       OWN subscription, for a commit the field itself just made (the per-type commit-event listener
 *       below, `COMMIT_EVENT`, deferred one microtask). By the time that notification arrives, `getValue()`
 *       already reads the just-committed value back — Object.is matches, the reflect is skipped. No flag,
 *       no re-entrancy tracking, and it degrades safely: a real external change to a DIFFERENT value
 *       always fails the comparison and reflects, exactly as required.
 * Precision (review note): the zero-store-write guarantee itself rests on the fleet property that a
 * programmatic property write never dispatches a commit event (verified per control at the review) —
 * this cutoff is the read-side redundant-write defense on top of that, not the sole echo barrier.
 *
 * The codec-wall types (`number`/`date` — schema.test.ts's documented `ui-text-field` limitation) still
 * reflect the RAW value via `setValue` (visible immediately, the model→surface effect); their internal
 * codec `canonical` only resyncs on a real blur, same as ANY post-connect `setValue` on those types
 * (schema.test.ts:127) — a `ui-text-field`-tier gap, not this bridge's to close (no public seam exists to
 * force a codec resync short of a real blur; a synthetic blur dispatch is the disallowed hack).
 */
function subscribeExternalSync(store: SettingsStore, registered: RegisteredControl, field: SettingsField): () => void {
  if (!store.subscribe) return () => {}
  return store.subscribe((key, value) => {
    if (key !== field.key) return
    if (Object.is(value, registered.getValue())) return // the store-echo Object.is cutoff
    registered.setValue(value)
  })
}

/**
 * The per-type COMMIT event — each registry control's own documented commit-event contract (its `.md`
 * descriptor's `events:` block), never a universal `'change'` assumption. `ui-select` is the one
 * divergent entry: `selectionCommit` (traits/selection-commit.ts) only ever emits `select` — its own
 * code comment says so verbatim ("select never emits a native change event... BLUR is the sole
 * interaction signal" for validity-timing purposes, select.ts:211-212) — `ui-select`'s `select.md`
 * documents `select` as the commit event, `change` is not in its `events:` block at all. Wiring `change`
 * universally (the pre-fix bug) meant a `select`-type field's user edit never committed to the store.
 * `Record<SettingsFieldType, string>` is exhaustive by construction — a future registry type MUST name
 * its commit event here or the type check fails, closing off a repeat of this exact gap.
 */
const COMMIT_EVENT = {
  text: 'change',   // ui-text-field: blur-with-change or Enter (text-field.md)
  number: 'change', // ui-text-field (type=number): same control, same event (text-field.md)
  date: 'change',   // ui-text-field (type=date): same control, same event (text-field.md)
  boolean: 'change', // ui-switch: click/Space toggle (switch.md)
  select: 'select', // ui-select: selectionCommit's ONLY commit event — never `change` (select.md)
  slider: 'change', // ui-slider: blur-when-moved (slider.md)
} as const satisfies Record<SettingsFieldType, string>

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
 * control's OWN documented commit event (`COMMIT_EVENT`, above — `select` for `ui-select`, `change` for
 * every other v1 type; SPEC-R12 "per-field-on-change", the LLD-C15 recommended timing).
 */
export function generateSection(section: SettingsSection, store: SettingsStore | undefined): GeneratedSection {
  const provider = document.createElement('ui-form-provider') as UIFormProviderElement
  const disposers: Array<() => void> = []
  // Every VALIDATED (registry-mapped) control + its field — the `reapplyValidation` re-arm reads this,
  // never the unsupported-type placeholders (they carry no control to validate).
  const validated: Array<{ control: UIFormElement; field: SettingsField }> = []
  // Every registry-mapped control's RegisteredControl (not just its element) + field — the `resubscribe`
  // re-arm reads this (needs getValue/setValue, not only the element), the `validated` precedent above.
  const synced: Array<{ registered: RegisteredControl; field: SettingsField }> = []

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
    synced.push({ registered, field })
    if (store) disposers.push(subscribeExternalSync(store, registered, field))

    // `queueMicrotask`, not a synchronous read: `ui-text-field`'s number/date types re-parse the display
    // into the CANONICAL value via a `blur` listener registered AFTER (and so, on the same target, firing
    // AFTER) the control's own commit-`change`-on-blur listener (value-codec.ts's own header comment) — a
    // synchronous `getValue()` here would read the STALE pre-parse canonical, one edit behind. Both
    // listeners fire within the SAME synchronous `blur` dispatch, so deferring one microtask is enough to
    // land after the codec's own update without waiting on anything longer (text/select/slider have no
    // such split — the defer is a no-op timing-wise for them, same value either way). The EVENT NAME
    // itself is per-type (`COMMIT_EVENT`, above) — `select` for `ui-select`, `change` for everything else.
    registered.element.addEventListener(COMMIT_EVENT[field.type], () => {
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
    resubscribe: () => {
      if (!store) return () => {}
      const fresh = synced.map(({ registered, field }) => subscribeExternalSync(store, registered, field))
      return () => {
        for (const dispose of fresh) dispose()
      }
    },
  }
}
