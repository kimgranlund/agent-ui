// settings.ts — UISettingsElement, the app-tier settings surface (app-surfaces-m4.lld.md LLD-C12,
// SPEC-R9; ADR-0120 cl.4 — phased shell → framework, both landing together in this build). A sections
// rail + a per-section panel, composing the shipped `ui-master-detail` (LLD F8 — the rail|panel
// drill-in mechanism is built ONCE, there; this element adds no split/drill-in code of its own) with the
// schema-driven panels generated on top (LLD-C13/C14, `generate.ts`).
//
// Composition mirrors `ui-master-detail`'s own shape (master-detail.ts): a ONE-TIME `#compose()` (field-
// guarded — idempotent across a relocation-induced reconnect, e.g. an ancestor `ui-app-shell` opting
// into `isolated`) builds ONLY the rail|panel SHELL (one composed `ui-master-detail` + the empty `<nav>`/
// panel mount points). The schema-driven CONTENT is reactive: a `connected()` effect tracks `schema`/
// `store` and (re)builds the rail buttons + every section's generated form whenever either changes BY
// REFERENCE — a real reassignment (e.g. an async-loaded schema landing after mount) rebuilds; a bare
// RECONNECT with the SAME schema/store objects (`#builtSchema`/`#builtStore` still match) skips the
// rebuild entirely (an isolated-shell relocation never regenerates/loses live field VALUES it doesn't
// need to) but STILL re-arms every per-connection reactive seam a disconnect tore down — the rail's click
// listeners AND every generated field's validation effect (both die with the connection, both must be
// re-armed on reconnect, never left one-time — the component-reviewer MAJOR finding on the latter).
//
// `schema`/`store` are non-reflected PROPERTIES (the `ui-split` `sizes` precedent: `prop.json<T>()` with
// `attribute: false` is a pure type-carrier, never actually round-tripped through JSON — `store` in
// particular holds functions, which `JSON.stringify` cannot serialise; this is safe ONLY because the
// attribute path is never exercised). `section` is the ONE reflected, author-settable prop (SPEC-R9) — the
// active section id, synced onto the composed `ui-master-detail`'s OWN `selected`.
//
// `controls → @agent-ui/components` (+ this package's own `../master-detail/` sibling) only — NEVER
// `@agent-ui/router` (SPEC-R13, ADR-0115); the app `layering.test.ts` trip-wire guards it.

import { UIElement, prop, untracked, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import { UIMasterDetailElement } from '../master-detail/master-detail.ts'
import { UIMasterDetailPaneElement } from '../master-detail/master-detail-pane.ts'
import { generateSection, type GeneratedSection } from './generate.ts'
import type { SettingsSchema } from './schema.ts'
import type { SettingsStore } from './store.ts'

const settingsProps = {
  // Non-reflected properties — too structured for an attribute (the `ui-split` `sizes` precedent).
  // `undefined` default ⇒ no schema yet: the surface renders an empty rail/panel, never throws.
  schema: { ...prop.json<SettingsSchema | undefined>(undefined), attribute: false as const },
  store: { ...prop.json<SettingsStore | undefined>(undefined), attribute: false as const },
  // The active section id — reflected so a JS-set value applies identically to an author-set attribute
  // (the `ui-master-detail` `selected` precedent). '' ⇒ no section resolved yet (before the first build,
  // or an empty schema).
  section: { ...prop.string(''), reflect: true },
} satisfies PropsSchema

export interface UISettingsElement extends ReactiveProps<typeof settingsProps> {}
export class UISettingsElement extends UIElement {
  static props = settingsProps

  // The composed SHELL (LLD-C12) — created ONCE (idempotent, `#masterDetail` doubles as the guard) and
  // PERSISTS across a reconnect, the master-detail.ts `#split`/`#backBtn` precedent.
  #masterDetail: UIMasterDetailElement | null = null
  #rail: HTMLElement | null = null // the list pane's nav — holds one button per section
  #panelHost: HTMLElement | null = null // the detail pane's content mount point

  // The schema/store OBJECTS the rail/sections currently reflect — a `#build()` re-run compares against
  // these BY REFERENCE to tell "a real reassignment" from "a reconnect with nothing actually changed".
  #builtSchema: SettingsSchema | undefined = undefined
  #builtStore: SettingsStore | undefined = undefined

  // sectionId → its GeneratedSection (schema.ts/generate.ts) — rebuilt whenever `#build()` rebuilds (a
  // real schema/store reassignment); its `.element` is detached/reattached into `#panelHost` (never
  // rebuilt for that) as the active section changes: detaching preserves each control's own state, and
  // the shipped `ui-field`/`ui-form-provider` catch-up scan re-associates it cleanly on the next reattach.
  #sections = new Map<string, GeneratedSection>()
  #disposeGenerated: Array<() => void> = []

  protected connected(): void {
    this.#compose() // idempotent — builds ONLY the rail/panel shell, once ever

    // schema/store → the rail buttons + every section's generated form (SPEC-R10/R11/R12). Reactive: a
    // real reassignment (different object references) rebuilds from scratch; a reconnect with the SAME
    // objects (`#builtSchema`/`#builtStore` unchanged) skips the rebuild (preserving live field VALUES)
    // but still re-arms listeners + validation + re-shows the current section (see the branch below).
    this.effect(() => {
      const schema = this.schema
      const store = this.store
      // `untracked`: (re)building cascades into MANY nested `connectedCallback`s (ui-form-provider/
      // ui-field/the control) that read + write their OWN signals as they wire up — none of that belongs
      // to THIS effect's dependency set (it must react to `schema`/`store` ONLY). Without this guard a
      // nested read gets misattributed to this effect (the kernel's `activeConsumer` is a single global
      // during the whole synchronous cascade), which re-triggers this effect, which tears down and
      // rebuilds the SAME tree again — a measured infinite reconnect loop (the write-loop budget,
      // scheduler.ts) fixed at build.
      untracked(() => {
        if (schema === this.#builtSchema && store === this.#builtStore) {
          // A reconnect with NOTHING actually reassigned (an isolated-shell relocation) — re-arm, never
          // rebuild (live field values must survive it). `disconnected()` unconditionally disposed every
          // reactive VALIDATION effect (the same "dies with the connection, must be re-armed" shape the
          // rail buttons' `this.listen` already documents) — re-running it here is NOT optional: without
          // it, validation silently stops reacting forever post-reconnect (the component-reviewer MAJOR
          // finding this fixes). The DOM/value state itself was never touched — only the reactive wiring.
          this.#armRailListeners()
          this.#showPanel(this.section)
          for (const generated of this.#sections.values()) {
            this.#disposeGenerated.push(generated.reapplyValidation())
          }
          return
        }
        this.#builtSchema = schema
        this.#builtStore = store
        this.#build(schema, store)
      })
    })

    // active section → the composed master-detail's `selected` + which generated panel shows + the
    // rail's active marker. First run is registration (the resolved default / a deep-linked `section`),
    // never "a section chosen" — no event (the master-detail.ts toggle-warn/isolated-connect precedent).
    let firstRun = true
    this.effect(() => {
      const id = this.section
      untracked(() => {
        if (this.#masterDetail) this.#masterDetail.selected = id
        this.#showPanel(id)
        this.#markActiveRailItem(id)
        if (firstRun) {
          firstRun = false
          return
        }
        this.emit<string>('select', id)
        this.emit<string>('change', id)
      })
    })
  }

  protected disconnected(): void {
    for (const dispose of this.#disposeGenerated) dispose()
    this.#disposeGenerated = []
  }

  // ── composition (idempotent — mirrors master-detail.ts's own `#compose` doc comment) ─────────────────

  /**
   * Build ONLY the rail|panel SHELL over ONE composed `ui-master-detail` — an empty `<nav>` + an empty
   * panel mount point. `#masterDetail` already being set means this ran before — a no-op (the SAME
   * reconnect guard `ui-master-detail` itself uses for its own composed `ui-split`). The schema-driven
   * CONTENT is `#build()`'s job, run reactively from `connected()`, not here.
   */
  #compose(): void {
    if (this.#masterDetail) return

    const md = new UIMasterDetailElement()
    // Event-boundary guard (the text-field.ts color-picker-popup precedent, ADR-0048 §3 B1): `md` is an
    // internal composition detail, never exposed as this element's own public surface — syncing
    // `md.selected` (below, the section-effect) fires ITS OWN `select`/`change` (bubbling, since every
    // `emit()` is `bubbles:true composed:true`), which would otherwise ALSO reach a listener on THIS
    // element (same event names) — a doubled emission for one user action. Stop both at the boundary;
    // this element remains the sole emitter of its own `select`/`change`.
    md.addEventListener('select', (event) => event.stopPropagation())
    md.addEventListener('change', (event) => event.stopPropagation())
    const listPane = new UIMasterDetailPaneElement()
    listPane.pane = 'list'
    const detailPane = new UIMasterDetailPaneElement()
    detailPane.pane = 'detail'

    const rail = document.createElement('nav')
    rail.setAttribute('data-part', 'rail')
    rail.setAttribute('aria-label', 'Settings sections')
    listPane.append(rail)

    const panelHost = document.createElement('div')
    panelHost.setAttribute('data-part', 'panel')
    detailPane.append(panelHost)

    md.append(listPane, detailPane)
    this.append(md)

    this.#masterDetail = md
    this.#rail = rail
    this.#panelHost = panelHost
  }

  /** (Re)populate the rail + regenerate every section's form from `schema`/`store` (SPEC-R10/R11/R12).
   *  Never throws: no schema ⇒ an empty rail/panel; an unsupported `version` ⇒ a notice, not a crash. Tears
   *  down whatever a PRIOR build produced first — a real schema/store reassignment rebuilds from scratch. */
  #build(schema: SettingsSchema | undefined, store: SettingsStore | undefined): void {
    const rail = this.#rail as HTMLElement

    for (const dispose of this.#disposeGenerated) dispose()
    this.#disposeGenerated = []
    this.#sections.clear()
    rail.replaceChildren()
    this.#panelHost?.replaceChildren()

    if (!schema) return // SPEC-R12 AC2 precedent generalised to "no schema yet" — never throw

    if (schema.version !== 1) {
      console.warn(`ui-settings: unsupported schema version ${schema.version} — rendering a notice instead of the form`)
      const notice = document.createElement('p')
      notice.setAttribute('data-part', 'notice')
      notice.textContent = `This settings schema (version ${schema.version}) is not supported.`
      rail.append(notice)
      return
    }

    for (const section of schema.sections) {
      const item = document.createElement('button')
      item.type = 'button'
      item.setAttribute('data-part', 'rail-item')
      item.setAttribute('data-section-id', section.id)
      item.textContent = section.label
      rail.append(item)

      const generated = generateSection(section, store)
      this.#sections.set(section.id, generated)
      this.#disposeGenerated.push(generated.dispose)
    }

    this.#armRailListeners()

    // Resolve the active section: keep an already-set `section` if it still names a real section in the
    // NEW schema (a deep link / author-set attribute, or a section that survived the reassignment), else
    // the first section. A rebuild ALWAYS re-shows the resolved section directly (not left to the
    // separate section-effect, which only reacts to `section` actually CHANGING — a reassignment that
    // resolves to the SAME id would otherwise leave the panel showing the just-cleared, now-stale DOM).
    if (!schema.sections.some((candidate) => candidate.id === this.section)) {
      this.section = schema.sections[0]?.id ?? ''
    }
    this.#showPanel(this.section)
    this.#markActiveRailItem(this.section)
  }

  /** (Re-)wire every current rail button's click listener. `this.listen` scopes to THIS connection's
   *  AbortSignal, so it must be called again whenever either the CONNECTION is fresh (reconnect) or the
   *  BUTTONS themselves are fresh (a rebuild) — never left to a one-time install. */
  #armRailListeners(): void {
    const rail = this.#rail
    if (!rail) return
    for (const item of rail.querySelectorAll<HTMLButtonElement>('[data-part="rail-item"]')) {
      const id = item.dataset.sectionId ?? ''
      this.listen(item, 'click', () => {
        this.section = id
      })
    }
  }

  /** Show the active section's generated form inside `#panelHost` — detaches whichever provider was
   *  shown before (never destroyed, just removed from the live tree; the shipped `ui-field`/
   *  `ui-form-provider` catch-up scan re-associates it cleanly the next time it is reattached). */
  #showPanel(id: string): void {
    const host = this.#panelHost
    if (!host) return
    host.replaceChildren()
    const generated = this.#sections.get(id)
    if (generated) host.append(generated.element)
  }

  /** Mark the active rail item — `aria-current="page"` (native-parity current-page-in-nav semantics) +
   *  a `[data-active]` marker settings.css keys its non-color-alone signifier off (rubric C8). */
  #markActiveRailItem(id: string): void {
    const rail = this.#rail
    if (!rail) return
    for (const item of rail.querySelectorAll<HTMLButtonElement>('[data-part="rail-item"]')) {
      const active = item.dataset.sectionId === id
      item.toggleAttribute('data-active', active)
      if (active) item.setAttribute('aria-current', 'page')
      else item.removeAttribute('aria-current')
    }
  }
}

if (!customElements.get('ui-settings')) customElements.define('ui-settings', UISettingsElement)
