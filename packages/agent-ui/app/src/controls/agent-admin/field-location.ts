// field-location.ts — the field→location map (GH #695 / ADR-0181 cl.4, follow-the-change SPEC-R2,
// LLD-C1): `locationFor(storeKey)` answers WHERE in the Settings place a patchable persona key renders —
// the owning section (`data-role`), the owning `settings-item` fold (`data-item`), and the human labels
// for both — so the `#followChange` reaction (agent-admin.ts) and the SPEC-R7 receipt line can navigate/
// narrate a consumed patch without either one growing its own per-key knowledge.
//
// DERIVED, never hand-listed per key (the `persona-patch.ts` hoisting rationale, applied again): the map
// is built by spreading key GROUPS from the SAME canonical constants the apply gate itself consumes
// (`ENTRY_KINDS` mapped through `entriesStoreKey`/`kindEnabledKey`, the named `SURFACE_*`/`BANKROLL_*`/
// `A2UI_*` keys), so a key added to the canonical set without a location REDDENS the totality parity gate
// (field-location.test.ts, SPEC-R2 AC1) by construction rather than silently missing.
//
// A `Map`, not an object literal, for the same wire-facing prototype-chain reason `ADMISSION` states
// (persona-patch.ts): `PatchReport.applied` echoes wire-origin key strings — a plain-object lookup walks
// the prototype chain ("constructor", "toString") where a Map lookup cannot.
//
// `KIND_LABELS`/section labels are small local records — acceptable ONLY because the anchor-parity gate
// (SPEC-R2 AC2) pins every emitted `(section, item)` + label against the composed element's real DOM
// (`data-role`/`data-item`/`summary`/`data-segment`); the GATE, not the listing, is what prevents drift
// (LLD §3's own ruling).
//
// `catalogsEnabled` (`kindEnabledKey('catalog')`) is mapped HONESTLY rather than excluded: it rides
// `PERSONA_STATE_KEYS` and the admission table via the `ENTRY_KINDS` spread (a patch CAN write it), while
// no UI reads it (ADR-0170 cl.5 minted no catalog master switch). Excluding it would break AC1's totality
// gate; its location is the catalog roster's home — the Surface Options A2UI detail zone — which is where
// a user sent there would look (LLD §3, doc-checker minor 3).

import {
  AGENT_ENABLED_KEY,
  MODELS_INCLUDED_KEY,
  MODEL_SETTING_KEYS,
  SURFACE_MARKDOWN_KEY,
  SURFACE_A2UI_KEY,
  SURFACE_GENUI_KEY,
  SURFACE_GENUI_DOGFOOD_KEY,
  SURFACE_PLANNER_KEY,
  SURFACE_AUTHORING_KEY,
  A2UI_CATALOG_KEY,
  A2UI_DOMAINS_KEY,
  A2UI_LOCAL_PATTERNS_KEY,
  BANKROLL_CAPABLE_KEY,
  BANKROLL_KEY,
  SERVER_TOOL_SETTING_KEYS,
  kindEnabledKey,
} from './agent-admin-schema.ts'
import { PERSONA_FIELD_BY_KEY } from './content-fields.ts'
import { ENTRY_KINDS } from './entries.ts'
import { entriesStoreKey } from '../entry-list/entry-data.ts'

/** WHERE one patchable persona key renders (SPEC-R2): the pane (always `'settings'` today — every
 *  patchable key lives in the Settings place), the settings section's `data-role`, the owning
 *  `settings-item` fold's `data-item` key, and the human copy for both (the section's `data-segment`
 *  label, the fold's `summary`). T-0391: a key whose control sits inside a `ui-drawer` in that fold also
 *  names the drawer (`data-drawer`) and its heading (`drawerLabel`); its trigger is the fold's
 *  `[data-part="drawer-trigger"][data-opens=<drawer>]`. */
export interface FieldLocation {
  pane: 'settings'
  section: 'agent-content' | 'capabilities-content' | 'surface-content'
  sectionLabel: string
  item: string
  itemLabel: string
  drawer?: string
  drawerLabel?: string
}

/** The four generic capability kinds that render as their OWN top-level Capabilities folds — skill/
 *  workflow/resource/tool (`CAPABILITY_KINDS`' display copy, pinned by the anchor-parity gate). The
 *  `pattern-source` kind rides the Surface tab and `catalog` nests inside the Surface Options A2UI
 *  detail zone (GH #488) — both mapped separately below. */
const CAPABILITY_KIND_LABELS: ReadonlyMap<string, string> = new Map([
  [ENTRY_KINDS.skill, 'Skills'],
  [ENTRY_KINDS.workflow, 'Workflows'],
  [ENTRY_KINDS.resource, 'Resources'],
  [ENTRY_KINDS.tool, 'Tools'],
])

const SECTION_LABELS: Record<FieldLocation['section'], string> = {
  'agent-content': 'Agent',
  'capabilities-content': 'Capabilities',
  'surface-content': 'Surface',
}

function loc(section: FieldLocation['section'], item: string, itemLabel: string, drawer?: { drawer: string; drawerLabel: string }): FieldLocation {
  return { pane: 'settings', section, sectionLabel: SECTION_LABELS[section], item, itemLabel, ...drawer }
}

/** One location per key GROUP, spread from the canonical constants (never a hand-listed per-key table).
 *  Ground truth for every `(section, item)` pair: the compose in `agent-admin.ts` (`data-role` sections ·
 *  `settingsItem(key, summary, …)` folds), pinned by field-location.test.ts's anchor-parity gate. */
const LOCATIONS: ReadonlyMap<string, FieldLocation> = new Map<string, FieldLocation>([
  // the Agent tab — the agent card, the model fold, the Advanced fold, the Danger zone
  // T-0391: tagline and category are roster record fields the Agent fold edits under Name.
  ...(['name', AGENT_ENABLED_KEY, 'tagline', 'category'] as const).map((k) => [k, loc('agent-content', 'agent', 'Agent')] as const),
  // T-0306: the Model section's settings render in the Model fold; T-0391 moves the set-once three into the
  // closed Advanced fold.
  ...(['model', MODEL_SETTING_KEYS.effort, MODEL_SETTING_KEYS.thinking] as const).map((k) => [k, loc('agent-content', 'model', 'Model')] as const),
  // T-0391: the model roster sits in the Model fold's Manage models drawer; each server tool's switch stays
  // on its open row and the tool's other keys sit in that tool's drawer, headed by the switch's own label.
  [MODELS_INCLUDED_KEY, loc('agent-content', 'model', 'Model', { drawer: 'models', drawerLabel: 'Manage models' })],
  ...Object.entries(SERVER_TOOL_SETTING_KEYS).flatMap(([tool, { enabled, ...detail }]) => [
    [enabled, loc('agent-content', 'model', 'Model')] as const,
    ...Object.values(detail).map(
      (k) => [k, loc('agent-content', 'model', 'Model', { drawer: `tool-${tool}`, drawerLabel: PERSONA_FIELD_BY_KEY.get(enabled)?.label ?? enabled })] as const,
    ),
  ]),
  ...([MODEL_SETTING_KEYS.showReasoning, MODEL_SETTING_KEYS.maxTokens, MODEL_SETTING_KEYS.cacheTtl] as const).map((k) => [k, loc('agent-content', 'advanced', 'Advanced')] as const),
  // T-0391: the bankroll row sits in the closed Danger zone fold with Reset and Delete.
  ...([BANKROLL_CAPABLE_KEY, BANKROLL_KEY] as const).map((k) => [k, loc('agent-content', 'danger', 'Danger zone')] as const),

  // the Capabilities tab — Instructions (the prompt-section kind), then the four generic kinds
  ...[entriesStoreKey(ENTRY_KINDS.promptSection), kindEnabledKey(ENTRY_KINDS.promptSection)].map(
    (k) => [k, loc('capabilities-content', ENTRY_KINDS.promptSection, 'Instructions')] as const,
  ),
  ...[...CAPABILITY_KIND_LABELS].flatMap(([kind, label]) =>
    [entriesStoreKey(kind), kindEnabledKey(kind)].map((k) => [k, loc('capabilities-content', kind, label)] as const),
  ),

  // the Surface tab — Surface Options (the modality switches + the nested catalog roster) and the
  // pattern-source picker. The catalog kind's keys anchor at the `surface` fold (GH #488 — its roster
  // nests inside the A2UI detail zone, LLD §3).
  ...[
    SURFACE_MARKDOWN_KEY,
    SURFACE_A2UI_KEY,
    SURFACE_GENUI_KEY,
    SURFACE_GENUI_DOGFOOD_KEY,
    SURFACE_PLANNER_KEY,
    SURFACE_AUTHORING_KEY,
    A2UI_CATALOG_KEY,
    A2UI_LOCAL_PATTERNS_KEY,
    A2UI_DOMAINS_KEY,
    entriesStoreKey(ENTRY_KINDS.catalog),
    kindEnabledKey(ENTRY_KINDS.catalog),
  ].map((k) => [k, loc('surface-content', 'surface', 'Surface Options')] as const),
  ...[entriesStoreKey(ENTRY_KINDS.patternSource), kindEnabledKey(ENTRY_KINDS.patternSource)].map(
    (k) => [k, loc('surface-content', ENTRY_KINDS.patternSource, 'Pattern sources')] as const,
  ),
])

/** The location a patchable store key renders at, or `undefined` for a key this map does not know —
 *  fail-closed (SPEC-R2 AC3): the reaction skips an unmapped key silently, never throws (a throw would
 *  fail the turn — the §3-filter drop discipline). */
export function locationFor(storeKey: string): FieldLocation | undefined {
  return LOCATIONS.get(storeKey)
}
