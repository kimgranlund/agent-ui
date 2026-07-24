// provider-mode-selection.ts — GH #257: the shared Provider/Model/Mode OPTION DATA + localStorage
// persistence every live-overlay page needs to drive `ui-conversation-composer`'s own `providers`/
// `provider`/`modes`/`mode` props — replacing `provider-switcher.ts`'s hand-rolled `ui-select` trio (LLD-
// C12/SPEC-R12, retired the same change) now that the composer owns rendering the picker UI itself.
//
// Persistence ownership (design decision, GH #257): stays PAGE-SIDE, not moved into the composer. The
// composer follows the SAME "props down, callbacks up" law as its pre-existing `models`/`model`/`efforts`/
// `effort` pair — neither of those persists anything either; the consumer owns ALL state, the composer only
// renders it. Giving the composer its own localStorage side effect would be a special case for exactly two
// of its six option axes, tying a fleet-generic FACE control to a page-specific storage key. This module is
// the ONE shared place the three live-overlay pages (a2ui-chat/a2ui-live/a2a-artifact-feed) get identical
// option lists + restore/persist logic from, mirroring `provider-switcher.ts`'s own role as the single
// source of truth — just producing composer PROPS now instead of building `ui-select` DOM.
//
// Safe to import STATICALLY (unlike `provider-switcher.ts`'s DOM-mounting job, which stayed dynamic-import-
// gated behind a live-probe purely for UX — never revealing a picker before a live provider is confirmed
// reachable): this module touches no fetch, no key, nothing gated. The committed `providers.json` holds
// env-var NAMES only (never a secret VALUE, ADR-0152) — the same safety property `provider-switcher.ts`
// already established. A page still gates the actual PROP ASSIGNMENT (revealing the pickers) behind its own
// live-probe branch, preserving today's exact UX.
import providers from '../../packages/agent-ui/a2ui/tools/agent/providers.json'
import type { GenUiMode } from '../../packages/agent-ui/a2ui/src/agent/gen-ui-mode.ts'
import { DEFAULT_GEN_UI_MODE, GEN_UI_MODES } from '../../packages/agent-ui/a2ui/src/agent/gen-ui-mode.ts'
import type { ProviderOption, PickerOption } from '../../packages/agent-ui/app/src/controls/conversation/composer-options.ts'

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

/** `providers.json`, reshaped into the composer's own `ProviderOption[]` — `implemented: false` becomes
 *  `disabled: true` (the "coming soon" precedent, ui-menu's own disabled-item skip renders it visible but
 *  never committable, conversation-composer.ts). */
export const PROVIDER_OPTIONS: readonly ProviderOption[] = Object.entries(CONFIG.providers).map(([id, entry]) => ({
  id,
  label: entry.implemented ? entry.label : `${entry.label} — coming soon`,
  defaultModel: entry.defaultModel,
  models: entry.models,
  disabled: !entry.implemented,
}))

export const DEFAULT_PROVIDER: string = CONFIG.defaultProvider
export const DEFAULT_MODEL: string = CONFIG.providers[CONFIG.defaultProvider]!.defaultModel

// ADR-0090 §4/LLD-C12 — the mode selector's demo-facing labels (promoted from provider-switcher.ts
// verbatim); the VALUE list is derived from `GEN_UI_MODES`, the single source of truth.
const MODE_LABELS: Record<GenUiMode, string> = {
  default: 'Default — balanced',
  specific: 'Specific — directive',
  'blue-sky': 'Blue-sky — exploratory',
}
export const MODE_OPTIONS: readonly PickerOption[] = GEN_UI_MODES.map((value) => ({
  id: value,
  label: MODE_LABELS[value],
}))
export const DEFAULT_MODE: GenUiMode = DEFAULT_GEN_UI_MODE

const LS_KEY = 'a2ui-live-provider-selection'

export interface StoredSelection {
  provider: string
  model: string
  // `GenUiMode`, not a plain `string` — this module (unlike the composer itself, which stays generic and
  // never imports this type) already sits in the a2ui import graph, so the STORED/restored value can carry
  // its real, narrower type; a page's own `onModeChange(id: string)` callback re-asserts it at the one
  // commit site (the picker's own `modes` list is always built from `MODE_OPTIONS`/`GEN_UI_MODES`).
  mode: GenUiMode
}

/** Restore a persisted selection, validated exactly like `provider-switcher.ts` did: only an IMPLEMENTED
 *  provider, a model genuinely in ITS list, and a recognized mode are accepted — anything else (missing,
 *  corrupt, stale) falls back to the catalog defaults, never throws. */
export function loadPersistedSelection(): StoredSelection {
  let provider = DEFAULT_PROVIDER
  let model = DEFAULT_MODEL
  let mode = DEFAULT_MODE
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') as Partial<StoredSelection> | null
    const entry = saved?.provider ? CONFIG.providers[saved.provider] : undefined
    if (entry && entry.implemented) {
      provider = saved!.provider!
      model = saved?.model && entry.models.some((m) => m.id === saved.model) ? saved.model : entry.defaultModel
    }
    if (saved?.mode && MODE_OPTIONS.some((m) => m.id === saved.mode)) mode = saved.mode
  } catch {
    /* corrupt storage — fall back to the defaults */
  }
  return { provider, model, mode }
}

/** Persist the current selection — a no-op (never throws) when storage is unavailable, the same
 *  best-effort discipline `provider-switcher.ts` carried. */
export function persistSelection(sel: StoredSelection): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(sel))
  } catch {
    /* storage unavailable — the in-memory selection still works this session */
  }
}
