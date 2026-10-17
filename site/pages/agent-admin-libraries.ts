// site/pages/agent-admin-libraries.ts: the entry-library packs the agent-admin app offers per capability
// kind (GH #47 skills, GH #48 workflows). PAGE-LOCAL data, deliberately not a package export (the
// agent-admin-presets.ts scope law: the page owns which packs exist, plus whatever the imported shelf
// holds (ADR-0208: `skill-packs:*` snapshots the app page projects in beside these, agent-admin-app.ts's
// `librariesWithShelf`); the packages own only the generic library seam this file feeds,
// `EntryLibraryPack` plus entry-list's add-from-library menu).
//
// T-0160: a thin reader. Every authored pack is a `site/agent-content/packs/<id>/pack.json` of refs to
// entry files, read through the generated registry (`node scripts/generate-agent-content.mjs`), so this
// file copies no text. Two packs derive LIVE from the shipped a2ui `.md` registries instead (raw-globbed
// below, never a second generated copy): the `a2ui-idioms` pack (`derived: mini-skill`) and the GenUI
// packs. What else stays here is what is not content: the live overlays (the Integrations and
// MCP-services getters) and the "Registered catalogs" pack mapped from the `A2UI_CATALOG_OPTIONS` import
// (ADR-0170 cl.7, the bottom of ADMIN_LIBRARIES).
import { ENTRY_KINDS } from '@agent-ui/app/agent-admin-entries'
import { A2UI_CATALOG_OPTIONS } from '@agent-ui/app/agent-admin-schema'
import type { EntryLibraryPack, NewEntryInput } from '@agent-ui/app/entry-data'
// GH #783 S4 (LLD-C6) — the live SERVICE-row shape the sibling `fetchLiveServices` degrade-law serves;
// type-only (erased under verbatimModuleSyntax), so `setLiveServices` below takes the SAME row shape the
// site overlay hands it, no restated inline literal. No runtime cycle: admin-live-runner.ts imports nothing
// from this page.
import type { LiveServiceRow } from '../lib/admin-live-runner.ts'
import { packEntries, packRecord, packRecords, type RuntimePack } from '../agent-content/registry.ts'
import { ENTRY_KINDS as CONTENT_ENTRY_KINDS, splitKeyValueFrontmatter, type PresetCategoryName } from '../agent-content/schema.ts'

// ── the `a2ui-idioms` pack (`derived: mini-skill`): the shipped A2UI composition idioms, derived LIVE from
// the SAME `prompts/mini-skills/*.md` files `@agent-ui/a2ui`'s `MINI_SKILLS` loads node-side, raw-globbed
// here by Vite (the registry's own loader is `node:fs`-based, ADR-0135 cl.11), so a registry edit flows
// into the pack with zero hand-copying. The glob is one level deep, never recursive. The frontmatter split
// is schema.ts's `splitKeyValueFrontmatter` (the a2ui single-line `key: value` format).
const MINI_SKILL_SOURCES = import.meta.glob('../../packages/agent-ui/a2ui/src/agent/prompts/mini-skills/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const MINI_SKILL_ENTRIES: NewEntryInput[] = Object.keys(MINI_SKILL_SOURCES)
  .sort()
  .flatMap((path) => {
    const parsed = splitKeyValueFrontmatter(MINI_SKILL_SOURCES[path]!)
    if (!parsed?.data['id']) return []
    return [{ label: parsed.data['id'], description: parsed.data['triggers'] ?? '', content: parsed.body }]
  })

// ── pack #4 (genui-surface.spec.md SPEC-R9/R11, D4): the shipped GenUI pattern-source packs, derived LIVE
// from `@agent-ui/a2ui`'s `prompts/genui-packs/*.md` by the same raw-glob technique (`GENUI_PACKS`' own
// loader is `node:fs`-based, Node-only by SPEC-R9). Each pack projects to ONE `EntryLibraryPack` carrying
// ONE ready-to-add entry whose `content` is the pack body verbatim, mirroring `@agent-ui/a2ui/agent`'s own
// `genuiPackLibrary` projection (SPEC-R11), reimplemented here because that function's input type
// (`GenuiPatternPack`) is Node-loaded data, not something this page holds.
const GENUI_PACK_SOURCES = import.meta.glob('../../packages/agent-ui/a2ui/src/agent/prompts/genui-packs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const GENUI_PACK_LIBRARY: EntryLibraryPack[] = Object.keys(GENUI_PACK_SOURCES)
  .sort()
  .flatMap((path) => {
    const parsed = splitKeyValueFrontmatter(GENUI_PACK_SOURCES[path]!)
    if (!parsed?.data['id'] || !parsed.data['label']) return []
    const label = parsed.data['label']
    const description = parsed.data['description'] ?? ''
    return [{ id: parsed.data['id'], label, description, entries: [{ label, description, content: parsed.body }] }]
  })

// ── the authored packs, read from site/agent-content/packs/ (hospitality landed with GH #46's trio, games
// with the roster wave, commerce with T-0075). The named exports stay the module's surface for tests and
// readers that want one pack's entries.
export const HOSPITALITY_SKILLS: readonly NewEntryInput[] = packEntries('hospitality')
export const COMMERCE_SKILLS: readonly NewEntryInput[] = packEntries('commerce')
export const CORE_PLAYBOOKS: readonly NewEntryInput[] = packEntries('playbooks-core')
export const HOSPITALITY_PLAYBOOKS: readonly NewEntryInput[] = packEntries('playbooks-hospitality')
export const GAMES_SKILLS: readonly NewEntryInput[] = packEntries('games')
export const GAMES_PLAYBOOKS: readonly NewEntryInput[] = packEntries('playbooks-games')
// The Game-rules pack: HOW each table game is played, as Resources the dealer cites and plays by.
export const GAMES_RULES: readonly NewEntryInput[] = packEntries('game-rules')
// The Integrations pack (GH #49/#402): the `{id, label, description}` trio (ADR-0168 cl.2). `id` is the
// registry key AND the enablement wire vocabulary (what `agent-admin.ts` forwards and `resolveIntegrations`
// intersects on); `label` is display text; `description` the menu-row tooltip. The registry itself
// (tools/agent/integrations/registry.ts) is the node-side shell (ADR-0137), so a data-integrity test pins
// this trio against it.
export const INTEGRATION_TOOLS: readonly NewEntryInput[] = packEntries('integrations')

/** One authored pack as the menu takes it. */
function libraryPack(record: RuntimePack): EntryLibraryPack {
  const { id, label, description, rejectOnCollision, derived } = record.frontmatter
  const entries = derived === 'mini-skill' ? MINI_SKILL_ENTRIES : packEntries(id)
  return { id, label, description, ...(rejectOnCollision === true ? { rejectOnCollision } : {}), entries }
}

// GH #567 S6 (Kim's F1 ruling) — the DEV-only live-read override. `undefined` (the default, and the
// ONLY state a production build ever reaches — the dev proxy's `GET /integrations` route exists only
// under `vite dev`, `worker/index.ts` stays frozen with no twin, ADR-0177 §0/Non-goals) keeps the
// Integrations pack on the hand-authored INTEGRATION_TOOLS trio above, byte-identical to before this
// slice. Once set, a registered `mcp:*` manifest joins the pack without a hand-mirrored static copy —
// the exact drift this pack's OWN header comment above used to accept as its cost.
let liveIntegrationEntries: NewEntryInput[] | undefined

/** Called by the site's live overlay (`site/lib/admin-live-runner.ts`'s `fetchLiveIntegrations`) with
 *  the dev proxy's served trios — already `{id, label, description}`, SPEC-R28's vocabulary. `content`
 *  is seeded from the SAME `description` field (GH #847/ADR-0189 cl.4) — the manifest's own
 *  `description` (real prose for every hand-authored integration, e.g. Weather's "Current conditions +
 *  short forecast…"; `label` as a fallback for an MCP tool whose server left `tool.description` unset,
 *  `mapMcpTool`'s own fallback) rather than a hardcoded `''`. Before this fix, turning the live overlay
 *  on discarded even Weather/Wikipedia/Currency's own non-empty hand-authored `content` — the empty-box
 *  bug GH #847 reported — because this setter REPLACES the whole pack, static entries included, with
 *  rows carrying no `content` field of their own. Passing `undefined` reverts to the hand-authored
 *  fallback (used by this page's own tests to reset state between cases). */
export function setLiveIntegrations(trios: readonly { id: string; label: string; description: string }[] | undefined): void {
  liveIntegrationEntries = trios?.map((t) => ({ id: t.id, label: t.label, description: t.description, content: t.description }))
}

// GH #783 S4 (LLD-C6/SPEC-R5, ADR-0185) — the MCP-services live plumbing, the sibling of the Integrations
// live-read above. `undefined` (the default, and the ONLY state a production build ever reaches — the GET's
// `services` array exists only under `vite dev`; production degrades `fetchLiveServices` to `undefined`)
// makes the MCP-services pack ABSENT entirely (the getter below), because — unlike INTEGRATION_TOOLS — no
// static service roster exists to fall back to (SPEC-R5): stored service refs in an agent's store stay
// visible and simply resolve to nothing downstream, but the OFFER pack never appears empty or errored.
let liveServiceEntries: NewEntryInput[] | undefined

/** Called by the site's live overlay (`site/lib/admin-live-runner.ts`'s `fetchLiveServices`) with the dev
 *  proxy's served `services` rows (`id` a `mcp:<server-id>:*` service ref, `description` the boot-count
 *  aggregate, `tools` the ADR-0189 cl.3 real per-tool trio array). The ref rides `NewEntryInput.id`
 *  EXPLICIT — never slugged (LLD-C6/GH #402: the wire key survives a label edit) — the label is the
 *  roster's human text, freely editable after add.
 *
 *  `content` (ADR-0189 cl.5, ratified 2026-08-14, GH #877) is the joined REAL per-tool descriptions from
 *  `r.tools`, rendered as prose (the box is `<ui-code-editor language="markdown">`, markdown-only —
 *  ADR-0139 — never a JSON dump of `tools`). This RETIRES SPEC-R5's original "empty content — the
 *  external-registry posture" ruling (`mcp-agent-config.spec.md`): that posture held only while the wire
 *  carried no real per-tool description, a stated, bounded gap this ADR closes — not the GH #847
 *  content-stomp bug `setLiveIntegrations` above already fixed (a different defect, a different row
 *  grain: that one is per-TOOL, this one SERVER-grain, one row per service). A service row is guaranteed
 *  ≥1 member tool by construction (`projectServiceRows` only emits a row once count > 0), so `content` is
 *  non-empty for every row this function ever receives. Passing `undefined` reverts to pack ABSENCE
 *  (production, degrade, and this page's own test reset between cases). */
export function setLiveServices(rows: readonly LiveServiceRow[] | undefined): void {
  liveServiceEntries = rows?.map((r) => ({
    id: r.id,
    label: r.label,
    description: r.description,
    content: r.tools.map((t) => `**${t.label}** — ${t.description}`).join('\n\n'),
  }))
}

/** GH #143: per-preset library scoping. Every OTHER preset (The Quant, The Curator, The Stylist, The Shopkeeper:
 *  dashboards/collections/tokens; none of them a hotel or a game) sees `undefined`: generic packs only,
 *  never a stray Hospitality or Games pack. The flavors are schema.ts's `PRESET_CATEGORIES` (T-0160),
 *  the one list a pack.json `category` and a persona's `category` validate against. */
export type PresetCategory = PresetCategoryName

/** GH #143 — which packs are PERSONA-FLAVORED (relevant to one preset category only) vs GENERIC
 *  (relevant to every preset regardless of category). The split is each pack.json's own `category`
 *  (T-0160), read off each pack's OWN description text, not invented: `a2ui-idioms` IS "the exact idioms
 *  the producer matches at turn time" for ANY persona, `playbooks-core` self-labels "General
 *  task-navigation playbooks", and `integrations` are keyless utilities (weather/wikipedia/currency) with
 *  no persona affinity at all; none of the three names a persona type the way "Hospitality" and "Games"
 *  do. Kim's open design question (GH #143) is resolved here: yes, generic packs stay visible to every
 *  preset; only the flavored packs are gated. A pack without a `category` (and every pack not authored as
 *  a file: GenUI, MCP services, Registered catalogs) is generic by construction, the safe default for any
 *  future pack that doesn't explicitly opt into a flavor. */
const FLAVORED_PACK_CATEGORY: Record<string, PresetCategory> = Object.fromEntries(
  CONTENT_ENTRY_KINDS.flatMap((kind) => packRecords(kind))
    .flatMap((r) => (r.frontmatter.category === undefined ? [] : [[r.id, r.frontmatter.category]])),
)

/** GH #143 — `ADMIN_LIBRARIES` filtered to the packs relevant to `category`: every GENERIC pack (not in
 *  `FLAVORED_PACK_CATEGORY`) passes through for every preset; a FLAVORED pack passes through only for its
 *  OWN category. `category` undefined (a preset with no persona-flavored home) drops every flavored pack,
 *  keeping generic packs only. Returns a FRESH object every call (never `ADMIN_LIBRARIES` itself) — the
 *  `ui-agent-admin.libraries` prop's identity-change law (agent-admin.ts) is what makes a reassignment on
 *  preset switch actually rebuild the add-from-library menu; handing back the same reference would be a
 *  silent no-op. */
export function librariesForCategory(category: PresetCategory | undefined): Record<string, EntryLibraryPack[]> {
  const filtered: Record<string, EntryLibraryPack[]> = {}
  for (const [kind, packs] of Object.entries(ADMIN_LIBRARIES)) {
    filtered[kind] = packs.filter((pack) => {
      const flavor = FLAVORED_PACK_CATEGORY[pack.id]
      return flavor === undefined || flavor === category
    })
  }
  return filtered
}

// GH #783 S4 (LLD-C6/SPEC-R5) — the two `tool`-kind packs, hoisted to named consts so the tool key below
// can be a GETTER that returns one or both. INTEGRATIONS_PACK takes its label, description and
// rejectOnCollision from packs/integrations/pack.json (T-0160) around its own GH #567 S6 getter;
// MCP_SERVICES_PACK is the live-derived services pack.
const INTEGRATIONS_PACK: EntryLibraryPack = {
  id: 'integrations',
  label: packRecord('integrations').frontmatter.label,
  description: packRecord('integrations').frontmatter.description,
  // GH #793/#783/#791 — `rejectOnCollision: true` (LLD-C5's per-pack widening, GH #564's foreign-key
  // law at pack grain): an integration id keys the dev proxy's EXTERNAL registry, so re-adding one
  // already in the list is a DUPLICATE `validateNewEntry` rejects with `Already in the list.` — never
  // a suffixed `weather-2` phantom row that looks armed and is wire-inert. Generalizes the same flip
  // MCP_SERVICES_PACK carries below to every foreign-key-keyed tool pack, not a one-off exception.
  rejectOnCollision: packRecord('integrations').frontmatter.rejectOnCollision === true,
  // GH #567 S6 — a getter, not a fixed array: reads whatever `setLiveIntegrations` last set, falling
  // back to the authored INTEGRATION_TOOLS trio. `librariesForCategory` filters this SAME pack
  // object (never clones it), so a live-read that lands AFTER the first `admin.libraries` assignment
  // still reaches the menu once the page reassigns `admin.libraries` (the identity-change law below).
  get entries(): readonly NewEntryInput[] {
    return liveIntegrationEntries ?? INTEGRATION_TOOLS
  },
}

// GH #783 S4 (LLD-C6/SPEC-R5, ADR-0185) — the live-derived MCP-services pack. `rejectOnCollision: true`
// (LLD-C5's per-pack widening, GH #564's foreign-key law at pack grain): a service ref keys the registry's
// namespace, so re-adding one already in the list is a DUPLICATE `validateNewEntry` rejects with
// `Already in the list.` — never a suffixed `mcp:calc:*-2` phantom that looks armed and is wire-inert — and
// the picker-disable affordance rides the same flag (entry-list.ts). id EXPLICIT (the service ref), label
// the roster's human text, `content` the joined real per-tool descriptions `setLiveServices` mints
// (ADR-0189 cl.3/cl.5, GH #877 — no longer forced empty; see that function's own header comment).
// GENERIC by construction: 'mcp-services' stays absent from FLAVORED_PACK_CATEGORY, so every persona sees it.
const MCP_SERVICES_PACK: EntryLibraryPack = {
  id: 'mcp-services',
  label: 'MCP services',
  description: 'Live-discovered MCP servers — one entry enables a whole server’s current tools.',
  rejectOnCollision: true,
  get entries(): readonly NewEntryInput[] {
    return liveServiceEntries ?? []
  },
}

/** The packs the page hands `ui-agent-admin` (`admin.libraries`), keyed by entry kind. */
export const ADMIN_LIBRARIES: Record<string, EntryLibraryPack[]> = {
  // T-0160: the authored packs of each kind, in each pack.json's `order`. `a2ui-idioms` is the
  // `derived: mini-skill` pack: the shipped mini-skill registry, the exact idioms the producer matches.
  [ENTRY_KINDS.skill]: packRecords('skill').map(libraryPack),
  [ENTRY_KINDS.workflow]: packRecords('workflow').map(libraryPack),
  [ENTRY_KINDS.resource]: packRecords('resource').map(libraryPack),
  // GH #783 S4 (LLD-C6/SPEC-R5) — a GETTER, not a fixed array: the MCP-services pack is ABSENT when the
  // live services GET degrades (`liveServiceEntries === undefined`: production, network fault, malformed
  // body — the ONLY state a production build reaches) and PRESENT once `setLiveServices` lands rows. Because
  // it is a getter, BOTH `librariesForCategory` (which iterates `Object.entries`) and any direct
  // `ADMIN_LIBRARIES[ENTRY_KINDS.tool]` reader see the pack appear/disappear honestly; `librariesForCategory`
  // itself is untouched. INTEGRATIONS_PACK is unconditional (its own getter still degrades to the
  // hand-authored trio). Both packs live-derive, both degrade to ABSENT — no static service fallback exists.
  get [ENTRY_KINDS.tool](): EntryLibraryPack[] {
    return liveServiceEntries === undefined ? [INTEGRATIONS_PACK] : [INTEGRATIONS_PACK, MCP_SERVICES_PACK]
  },
  // genui-surface.spec.md SPEC-R9/R11 (B2) — the shipped GenUI pattern-source packs (data-viz layouts,
  // interactive widgets, animated explainers), one per GenUI `.md` record in the agent-content registry.
  [ENTRY_KINDS.patternSource]: GENUI_PACK_LIBRARY,
  // ADR-0170 cl.7 — the "Registered catalogs" pack: mapped LIVE from the `A2UI_CATALOG_OPTIONS` IMPORT,
  // not a hand-copied trio table. The registry is browser-importable (unlike the node-fenced integrations
  // registry, whose pack above therefore needs a parity TEST), so this pack simply IS the registry —
  // a third registered catalog is ONE row in `agent-admin-schema.ts` and zero edits here.
  //
  // The trio law (ADR-0168 cl.2) rides `NewEntryInput.id`: `id` is the registry/wire key an added entry
  // stays keyed to (and the only thing `sanitizeCatalog` will ever match), `label` is free display text,
  // `description` is the menu-row copy. `content` is deliberately empty — a catalog entry keys an
  // external registry, it has no body (the section renders no content editor, ADR-0170 cl.8).
  //
  // GENERIC by construction: absent from FLAVORED_PACK_CATEGORY above, so every persona sees it —
  // catalogs have no persona affinity the way Hospitality/Games idioms do.
  [ENTRY_KINDS.catalog]: [
    {
      id: 'registered-catalogs',
      label: 'Registered catalogs',
      description: 'The catalogs this build registers — add one to a persona, then pick it in Catalogs.',
      entries: A2UI_CATALOG_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description ?? '',
        content: '',
      })),
    },
  ],
}
