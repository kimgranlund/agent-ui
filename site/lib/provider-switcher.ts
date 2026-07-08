// provider-switcher.ts — LLD-C12 / SPEC-R12: the DEV-ONLY in-chat provider→model switcher. Renders its
// dropdowns FROM providers.json (the single source of truth — no hand-listed second menu), DISABLES
// `implemented: false` providers ("coming soon" — a visible roadmap, never selectable), persists the
// selection to localStorage, and exposes the current {provider,model} to the live transport. Imported
// ONLY under `import.meta.env.DEV`, so it — and the bundled providers.json — leave the production build
// with the rest of the overlay (SPEC-R12/N2). The committed providers.json holds env-var NAMES only (no
// secret), so bundling it in dev is safe. Vite bundles JSON natively (LLD §2 data-access decision).
//
// ADR-0090 §4/LLD-C12: a third `ui-select` — the same dogfooded pattern — offers the Gen-UI `mode` axis
// (`GenUiMode`: `default`/`specific`/`blue-sky`), persisted + exposed on the SAME `SelectionRef` alongside
// `{provider,model}`, so the live demo can showcase all three dispositions off one catalog.
//
// Dogfoods the fleet's own `ui-select` in place of native `<select>` (Kim's directive: no native `<select>`
// where a ui-* control exists) — same proven pattern as component-gallery.ts's themeSelect(): options are
// `[role=option]` light-DOM children appended BEFORE connect (ui-select's `slots` contract — select.md),
// selection is read/written via the `value` property, and commit fires the `select` event (NOT `change`).
// The `label` attribute is the trigger's accessible-name seam (ADR-0085) — it names the control without a
// wrapping ui-field, matching the old `<label>`+native-select association.
import '@agent-ui/components/components' // self-defining ui-* controls (registers ui-select; the aliased barrel — component-preview.ts's convention, and the only control specifier wired into the vitest resolve alias)
import type { UISelectElement } from '@agent-ui/components/components'
import providers from '../../packages/agent-ui/a2ui/tools/agent/providers.json'
import type { GenUiMode } from '../../packages/agent-ui/a2ui/tools/agent/gen-ui-mode.ts'
import { DEFAULT_GEN_UI_MODE, GEN_UI_MODES } from '../../packages/agent-ui/a2ui/tools/agent/gen-ui-mode.ts'

interface ProviderModel {
  id: string
  label: string
}
interface ProviderEntry {
  label: string
  envKey: string
  endpoint: string
  defaultModel: string
  models: ProviderModel[]
  implemented: boolean
}
interface ProvidersConfig {
  defaultProvider: string
  providers: Record<string, ProviderEntry>
}

const CONFIG = providers as ProvidersConfig
const LS_KEY = 'a2ui-live-provider-selection'

// ADR-0090 §4/LLD-C12 — the mode selector's demo-facing labels. The VALUE list itself is derived from
// `GEN_UI_MODES` (`gen-ui-mode.ts`, the single source of truth) below — only the label text (not just the
// bare mode name) lives here, since this is the one place that needs a friendlier demo-facing spelling.
const MODE_LABELS: Record<GenUiMode, string> = {
  default: 'Default — balanced',
  specific: 'Specific — directive',
  'blue-sky': 'Blue-sky — exploratory',
}
const MODE_OPTIONS: readonly { value: GenUiMode; label: string }[] = GEN_UI_MODES.map((value) => ({
  value,
  label: MODE_LABELS[value],
}))

export interface SelectionRef {
  get(): { provider: string; model: string; mode: GenUiMode }
}

/** A `[role=option]` light-DOM child — ui-select's option element (select.md `slots`). `disabled` marks a
 *  non-committable option (roving-focus + selection-commit both skip the `disabled` attribute). */
function option(value: string, text: string, disabled = false): HTMLElement {
  const opt = document.createElement('div')
  opt.setAttribute('role', 'option')
  opt.setAttribute('value', value)
  opt.textContent = text
  if (disabled) opt.setAttribute('disabled', '') // SPEC-R12: unimplemented providers render disabled, never selectable
  return opt
}

/** Wrap a control under a visible uppercase caption (layout only — the accessible name comes from the
 *  ui-select `label` attribute, ADR-0085, not this <label> association). */
function labelled(text: string, control: HTMLElement): HTMLElement {
  const wrap = document.createElement('label')
  wrap.className = 'switcher-field'
  const span = document.createElement('span')
  span.className = 'switcher-label'
  span.textContent = text
  wrap.append(span, control)
  return wrap
}

/** Render the switcher into `slot` and return a ref to the live selection. */
export function mountSwitcher(slot: HTMLElement): SelectionRef {
  let provider = CONFIG.defaultProvider
  let model = CONFIG.providers[provider]?.defaultModel ?? ''
  let mode: GenUiMode = DEFAULT_GEN_UI_MODE

  // Restore a persisted selection, but only if it is still a valid, IMPLEMENTED pair (+ a recognized mode).
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') as
      | { provider?: string; model?: string; mode?: string }
      | null
    const entry = saved?.provider ? CONFIG.providers[saved.provider] : undefined
    if (entry && entry.implemented) {
      provider = saved!.provider!
      model = saved?.model && entry.models.some((m) => m.id === saved.model) ? saved.model : entry.defaultModel
    }
    if (saved?.mode && MODE_OPTIONS.some((m) => m.value === saved.mode)) mode = saved.mode as GenUiMode
  } catch {
    /* corrupt storage — fall back to the defaults */
  }

  function persist(): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ provider, model, mode }))
    } catch {
      /* storage unavailable — the in-memory selection still works this session */
    }
  }

  // ── The provider select — static options, unimplemented providers disabled ──
  const provSel = document.createElement('ui-select') as UISelectElement
  provSel.setAttribute('label', 'Provider')
  for (const id of Object.keys(CONFIG.providers)) {
    const e = CONFIG.providers[id]!
    provSel.append(option(id, e.implemented ? e.label : `${e.label} — coming soon`, !e.implemented))
  }
  provSel.value = provider

  // ── The model select — options depend on the chosen provider ──
  // ui-select moves its [role=option] children into the internal listbox ONCE at first connect (select.md
  // `slots`; select.ts #ensureParts) and does NOT observe post-connect child mutations — so a provider
  // change cannot be served by replaceChildren() on the live host (that would clobber the control's own
  // parts). Instead we BUILD A FRESH ui-select each time and swap it into place: its options are appended
  // before it connects, honouring the documented pre-connect contract. (Model dropdown = never disabled.)
  const modelField = document.createElement('label')
  modelField.className = 'switcher-field'
  const modelCaption = document.createElement('span')
  modelCaption.className = 'switcher-label'
  modelCaption.textContent = 'Model'

  function buildModelSelect(): UISelectElement {
    const sel = document.createElement('ui-select') as UISelectElement
    sel.setAttribute('label', 'Model')
    for (const m of CONFIG.providers[provider]!.models) sel.append(option(m.id, m.label))
    sel.value = model
    sel.addEventListener('select', () => {
      model = sel.value
      persist()
    })
    return sel
  }

  let modelSel = buildModelSelect()
  modelField.append(modelCaption, modelSel)

  provSel.addEventListener('select', () => {
    provider = provSel.value
    model = CONFIG.providers[provider]!.defaultModel
    const fresh = buildModelSelect() // rebuild: fresh options move in at connect (see buildModelSelect note)
    modelSel.replaceWith(fresh)
    modelSel = fresh
    persist()
  })

  // ── The mode select — static options, the same directive/exploratory axis for every provider ──
  const modeSel = document.createElement('ui-select') as UISelectElement
  modeSel.setAttribute('label', 'Mode')
  for (const m of MODE_OPTIONS) modeSel.append(option(m.value, m.label))
  modeSel.value = mode
  modeSel.addEventListener('select', () => {
    mode = modeSel.value as GenUiMode
    persist()
  })

  const wrap = document.createElement('div')
  wrap.className = 'switcher'
  wrap.append(labelled('Provider', provSel), modelField, labelled('Mode', modeSel))
  slot.replaceChildren(wrap)

  return { get: () => ({ provider, model, mode }) }
}
