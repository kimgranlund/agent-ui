// agent-compile.ts: T-0163 (agent-content SPEC ACS-R11 to ACS-R13), the one agent compiler. Every place that
// runs an agent builds its bundle here: Test Chat (`agent-admin.ts`, both live arms and the Context view),
// and the CLI (`scripts/agent-content.mjs compile`, over the seed files). The dev proxy and the Worker never
// assemble a prompt (they receive the composed one); they recompute the bundle digest from the request body
// with the same `@agent-ui/a2ui/agent/agent-bundle` helpers, so all three agree on one digest.
//
// `compileStore` is the synchronous projection of a resolved store into a bundle: it wraps
// `composeLiveSystemPrompt` (agent-model SPEC-R20 to R22) unchanged, so `bundle.system` is byte-identical to
// what the live arms composed before this module existed. `compile(manifest, overlay)` is the spec's
// signature: seed plus overlay through `resolveOverlay`, then the same projection, then the resolution and
// the digest (the one async step, Web Crypto). Environment-neutral: no DOM, no key, never `produce()`.
import {
  bundleDigest,
  canonicalJson,
  sha256Hex,
  type AgentBundle,
  type ContentSource,
  type ResolutionEntry,
} from '@agent-ui/a2ui/agent/agent-bundle'
import type { ModelSettings } from '@agent-ui/a2ui/agent/model-capabilities'
import type { EffortLevel } from '../conversation/composer-options.ts'
import { entriesStoreKey, isAmbient, readEntries, type Entry } from '../entry-list/entry-data.ts'
import {
  BANKROLL_CAPABLE_KEY,
  BANKROLL_KEY,
  SURFACE_A2UI_KEY,
  isBankrollCapable,
  isEnabledFlag,
  kindEnabledKey,
  modelRoster,
  resolveAgentEffort,
  resolveModelSettings,
  sanitizeBankroll,
  sanitizeModel,
  type ComposerModelOverrides,
} from './agent-admin-schema.ts'
import { ENTRY_KINDS, composeLiveSystemPrompt, type LiveBankrollState, type LiveCapabilityGroup } from './entries.ts'
import { modifiedPaths, resolveOverlay, type AgentOverlay, type OverlayPath } from './agent-overlay.ts'
import type { TeamPromptContext } from './agent-team-prompt.ts'

export type { AgentBundle, ContentSource, ResolutionEntry }

type Reader = { get(key: string): unknown } | undefined

/** The four capability kinds that compose into the live prompt, each with its `##` group heading. The
 *  pattern-source and catalog kinds never do (they thread as their own wire fields). */
export const LIVE_CAPABILITY_HEADINGS: Readonly<Record<string, string>> = {
  [ENTRY_KINDS.skill]: 'Skills available to you',
  [ENTRY_KINDS.workflow]: 'Workflows available to you',
  [ENTRY_KINDS.resource]: 'Resources available to you',
  [ENTRY_KINDS.tool]: 'Tools available to you',
}

/** Each composed capability kind's store slice, heading and master switch (the ambient filter and the sort
 *  are `composeLiveSystemPrompt`'s). */
export function liveCapabilityGroups(store: Reader): LiveCapabilityGroup[] {
  return Object.entries(LIVE_CAPABILITY_HEADINGS).map(([kind, heading]) => ({
    kind,
    heading,
    entries: readEntries(store, kind),
    enabled: isEnabledFlag(store?.get(kindEnabledKey(kind))),
  }))
}

/** The bankroll teaching input: only for a capable persona with A2UI on (GH #525), else `undefined`. */
export function bankrollForPrompt(store: Reader): LiveBankrollState | undefined {
  if (!isBankrollCapable(store?.get(BANKROLL_CAPABLE_KEY))) return undefined
  if (!isEnabledFlag(store?.get(SURFACE_A2UI_KEY))) return undefined
  return { stored: sanitizeBankroll(store?.get(BANKROLL_KEY)) }
}

/** The ambient tool ids (enabled and in context), master-gated on the tool kind's switch, in order. */
export function ambientToolIds(store: Reader): string[] {
  if (!isEnabledFlag(store?.get(kindEnabledKey(ENTRY_KINDS.tool)))) return []
  return readEntries(store, ENTRY_KINDS.tool)
    .filter(isAmbient)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((e) => e.id)
}

/** What a turn adds that the agent's content does not hold. All optional: the CLI passes none. */
export interface CompileContext {
  /** The driving context's model. Absent, the store's `model` sanitized against the roster. */
  model?: string
  /** The composer's effort dial, which bounds the model settings. Absent, the agent's own default effort
   *  for its model (where the composer's dial starts). */
  effort?: EffortLevel
  /** The team section input, when the agent is its team's GM. */
  team?: TeamPromptContext
  /** Tool ids this turn invoked by name, unioned after the ambient ones. */
  invokedToolIds?: readonly string[]
  /** T-0203: the composer's model overrides (thinking off, show reasoning, the server tool toggles). */
  overrides?: ComposerModelOverrides
}

/** A compiled bundle, its model settings typed for the request shapes that carry them. */
export interface CompiledBundle extends AgentBundle {
  modelSettings: ModelSettings
  integrations: string[]
}

/** The bundle a resolved store compiles to. Synchronous; `store` may be absent (the fail-closed reads). */
export function compileStore(store: Reader, ctx: CompileContext = {}): CompiledBundle {
  const model = ctx.model ?? sanitizeModel(store?.get('model'), modelRoster())
  const system = composeLiveSystemPrompt(readEntries(store, ENTRY_KINDS.promptSection), liveCapabilityGroups(store), bankrollForPrompt(store), ctx.team)
  const ambient = ambientToolIds(store)
  const integrations = ctx.invokedToolIds === undefined || ctx.invokedToolIds.length === 0 ? ambient : [...new Set([...ambient, ...ctx.invokedToolIds])]
  return { system, model, modelSettings: resolveModelSettings(store, model, ctx.effort ?? resolveAgentEffort(store, model), ctx.overrides), integrations }
}

/** The agent a resolution names: its id, seed version, provenance and the seed version of each content
 *  item it refs (from the registry), keyed by kind. A full-record agent (imported, duplicated) has no
 *  `items`; everything in it reads that source. */
export interface ContentManifest {
  id: string
  version: number | null
  source: ContentSource
  items?: Readonly<Record<string, Readonly<Record<string, number>>>>
}

/** The input `compile` takes: a content manifest plus the seed store values it versions. */
export interface AgentManifest extends ContentManifest {
  seed: Readonly<Record<string, unknown>>
}

export interface CompileResult {
  bundle: AgentBundle
  digest: string
  resolution: ResolutionEntry[]
}

/** Every item that went into `bundle`: the agent itself, each composed prompt section and ambient
 *  capability entry, and each setting the overlay changed. Each digest is the sha256 of the item as
 *  composed; an item the overlay changed (`modified`) reads its op's source (`user`, `builder`, `pack`).
 *  Sorted by kind then id. */
export async function resolution(manifest: ContentManifest, store: Reader, bundle: AgentBundle, modified: readonly OverlayPath[] = []): Promise<ResolutionEntry[]> {
  const out: ResolutionEntry[] = [{ id: manifest.id, kind: 'persona', version: manifest.version, digest: await sha256Hex(bundle.system), source: manifest.source }]
  // An entry's provenance follows only its own content ops (added, removed, a patched field): a list
  // reorder (`change: 'order'` with no entry id, plus each moved entry's `order` field) moves entries
  // without changing what any of them is, so it touches none.
  // The source is the op's own (T-0162 records `builder` and `pack`; absent reads `user`).
  const touched = new Map(modified.filter((p) => p.entryId !== undefined && p.field !== 'order').map((p) => [`${p.key}\u0000${p.entryId}`, p.source ?? 'user'] as const))
  const sourceOf = (key: string, entryId: string): ContentSource => touched.get(`${key}\u0000${entryId}`) ?? manifest.source
  const entryRows = async (kind: string, entries: readonly Entry[]): Promise<void> => {
    const key = entriesStoreKey(kind)
    for (const e of entries) {
      const version = manifest.items?.[kind]?.[e.id] ?? (kind === ENTRY_KINDS.promptSection ? manifest.version : null)
      out.push({ id: e.id, kind, version, digest: await sha256Hex(canonicalJson(e)), source: sourceOf(key, e.id) })
    }
  }
  await entryRows(
    ENTRY_KINDS.promptSection,
    readEntries(store, ENTRY_KINDS.promptSection).filter((s) => s.enabled && s.content.trim() !== ''),
  )
  for (const group of liveCapabilityGroups(store)) {
    if (group.enabled) await entryRows(group.kind, group.entries.filter(isAmbient))
  }
  const settings = new Map(modified.filter((p) => p.entryId === undefined && !p.key.startsWith('entries:')).map((p) => [p.key, p.source ?? 'user'] as const))
  for (const [key, source] of settings) {
    out.push({ id: key, kind: 'setting', version: manifest.version, digest: await sha256Hex(canonicalJson(store?.get(key) ?? null)), source })
  }
  return out.sort((a, b) => (a.kind === 'persona' ? -1 : b.kind === 'persona' ? 1 : a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)))
}

/** The one compiler (ACS-R11): seed plus overlay, resolved, compiled, digested, with its resolution. */
export async function compile(manifest: AgentManifest, overlay?: AgentOverlay, ctx: CompileContext = {}): Promise<CompileResult> {
  const values = overlay === undefined ? { ...manifest.seed } : resolveOverlay(manifest.seed, overlay)
  const store = { get: (key: string): unknown => values[key] }
  const bundle = compileStore(store, ctx)
  const [digest, rows] = await Promise.all([bundleDigest(bundle), resolution(manifest, store, bundle, overlay === undefined ? [] : modifiedPaths(overlay))])
  return { bundle, digest, resolution: rows }
}
