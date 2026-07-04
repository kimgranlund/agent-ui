// provider-switcher.ts — LLD-C12 / SPEC-R12: the DEV-ONLY in-chat provider→model switcher. Renders its
// dropdowns FROM providers.json (the single source of truth — no hand-listed second menu), DISABLES
// `implemented: false` providers ("coming soon" — a visible roadmap, never selectable), persists the
// selection to localStorage, and exposes the current {provider,model} to the live transport. Imported
// ONLY under `import.meta.env.DEV`, so it — and the bundled providers.json — leave the production build
// with the rest of the overlay (SPEC-R12/N2). The committed providers.json holds env-var NAMES only (no
// secret), so bundling it in dev is safe. Vite bundles JSON natively (LLD §2 data-access decision).

import providers from '../../packages/agent-ui/a2ui/tools/agent/providers.json'

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

export interface SelectionRef {
  get(): { provider: string; model: string }
}

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

  // Restore a persisted selection, but only if it is still a valid, IMPLEMENTED pair.
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') as { provider?: string; model?: string } | null
    const entry = saved?.provider ? CONFIG.providers[saved.provider] : undefined
    if (entry && entry.implemented) {
      provider = saved!.provider!
      model = saved?.model && entry.models.some((m) => m.id === saved.model) ? saved.model : entry.defaultModel
    }
  } catch {
    /* corrupt storage — fall back to the defaults */
  }

  const provSel = document.createElement('select')
  provSel.className = 'switcher-select'
  for (const id of Object.keys(CONFIG.providers)) {
    const e = CONFIG.providers[id]!
    const opt = document.createElement('option')
    opt.value = id
    opt.textContent = e.implemented ? e.label : `${e.label} — coming soon`
    opt.disabled = !e.implemented // SPEC-R12: unimplemented providers render disabled, never selectable
    provSel.append(opt)
  }
  provSel.value = provider

  const modelSel = document.createElement('select')
  modelSel.className = 'switcher-select'
  function fillModels(): void {
    modelSel.replaceChildren()
    for (const m of CONFIG.providers[provider]!.models) {
      const opt = document.createElement('option')
      opt.value = m.id
      opt.textContent = m.label
      modelSel.append(opt)
    }
    modelSel.value = model
  }
  fillModels()

  function persist(): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ provider, model }))
    } catch {
      /* storage unavailable — the in-memory selection still works this session */
    }
  }

  provSel.addEventListener('change', () => {
    provider = provSel.value
    model = CONFIG.providers[provider]!.defaultModel
    fillModels()
    persist()
  })
  modelSel.addEventListener('change', () => {
    model = modelSel.value
    persist()
  })

  const wrap = document.createElement('div')
  wrap.className = 'switcher'
  wrap.append(labelled('Provider', provSel), labelled('Model', modelSel))
  slot.replaceChildren(wrap)

  return { get: () => ({ provider, model }) }
}
