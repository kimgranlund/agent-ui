// genui-packs.ts — genui-surface.spec.md SPEC-R9/R11: pattern-source packs, the producer-layer prompt
// asset SPEC-R9 names. Loaded via the EXISTING ADR-0135 mechanics (frontmatter files under
// `prompts/genui-packs/*.md`, parsed by the shared `frontmatter.ts`), following `mini-skills.ts`'s
// established registry shape: one committed `.md` per pack, parsed at MODULE LOAD. ADR-0236: the `.md`
// text is embedded at build time in `assets.gen.ts` (`node scripts/generate-agent-assets.mjs`) and read
// through `asset-source.ts`, never from the filesystem, so the same module runs unchanged under Node (the
// dev proxy), in the Cloudflare Worker, and from any working directory; it imports no `node:*` builtin.
// No browser bundle imports it (SPEC-N1/N2).
//
// Root-barrel purity (ADR-0137): reachable ONLY via the `./agent` subpath, never `.` — the same discipline
// mini-skills.ts/system-prompt.ts already hold, verified by `gates.test.ts`'s IDENTITY leg (this module lives
// under `src/agent/`, so it is automatically covered by that walk).

import { parseFrontmatter } from './frontmatter.ts'
import { listAssets, readAsset } from '../asset-source.ts'

/** A named, curated exemplar pack of HTML/CSS(/JS) idioms conditioning what the model authors for the
 *  GenUI surface (SPEC-R9, PRD-G2). Distinct from `MiniSkill` (A2UI catalog-composition idioms) — a genui
 *  pack teaches free-form HTML/CSS authorship, never A2UI JSONL. */
export interface GenuiPatternPack {
  /** Stable kebab id — e.g. `'data-viz-layouts'`. */
  id: string
  /** Display name for the admin picker's "From library" menu row. */
  label: string
  /** One-line pack description (menu row tooltip). */
  description: string
  /** The idiom instruction body — exemplar-heavy prose (+ short illustrative HTML/CSS snippets), ≤ the
   *  per-pack budget (SPEC-R9: ≤ 8 000 chars, ~2 000 tokens). */
  body: string
}

/** SPEC-R9 — the per-pack budget: ≤ 8 000 chars (~2 000 tokens, `chars/4`). Packs are exemplar-heavy
 *  (bigger than a mini-skill's ~200-token budget), but exactly ONE pack conditions a turn (D3 source-level
 *  pick), so the prompt grows by at most one budget regardless of registry size. */
export const GENUI_PACK_CHAR_BUDGET = 8_000

/** Loaded in a stable filename-sorted order (the `loadMiniSkills` precedent) — order is not load-bearing;
 *  every id-keyed consumer (`genuiPackLibrary`, a future picker) looks up by id, never by array position. */
function loadGenuiPacks(): GenuiPatternPack[] {
  const files = listAssets('agent/prompts/genui-packs')
    .filter((name) => name.endsWith('.md'))
    .sort()
  return files.map((name) => {
    const { data, body } = parseFrontmatter(readAsset('agent/prompts/genui-packs/' + name))
    if (!data.id || !data.label || !data.description) {
      throw new Error(`genui-packs: ${name} is missing id/label/description frontmatter`)
    }
    return { id: data.id, label: data.label, description: data.description, body }
  })
}

export const GENUI_PACKS: readonly GenuiPatternPack[] = loadGenuiPacks()

// ── the D4 projection (SPEC-R11) ────────────────────────────────────────────────────────────────────────
// `EntryLibraryPack` (and the `NewEntryInput` shape its `entries` array carries) is `@agent-ui/app`'s own
// type (`packages/agent-ui/app/src/controls/agent-admin/entries.ts`) — this package (`a2ui`) MUST NOT
// import upward from `app` (CLAUDE.md's layering law: `shared ← components ← a2ui ← app`, nothing imports
// upward). Exactly the same constraint `agent-admin-schema.ts`'s own `AdminTurn`/`AdminSurfaceTurnRequest`
// already navigate (that file declares its OWN minimal shapes structurally matching a2ui's `Turn`/
// `TurnInput` "without importing it" — its own header comment names this SPEC-N1 precedent). This function
// therefore returns a LOCALLY-DEFINED structural type — `GenuiEntryLibraryPack` below — shaped field-for-
// field identically to `EntryLibraryPack`/`NewEntryInput` (id/label/description + entries:{label,
// description,content}[]), so any caller that imports BOTH types (the app package, which may import a2ui
// downward) can assign this function's return value directly to an `EntryLibraryPack[]`-typed prop with
// zero cast — TypeScript's structural typing makes the two interfaces mutually assignable by shape alone.
// D4's ruling ("no distinct registry type") is honored: this is a PROJECTION, not a second registry — the
// pack module (`GENUI_PACKS`) stays the one source of truth; this function only reshapes it.
export interface GenuiEntryLibraryPack {
  id: string
  label: string
  description: string
  entries: readonly { label: string; description: string; content: string }[]
}

/** Project the committed pack registry into the `EntryLibraryPack`-shaped form the admin's "From library"
 *  affordance already knows how to render (SPEC-R11, D4): one library pack PER `GenuiPatternPack`, each
 *  carrying exactly ONE ready-to-add entry whose `content` is the pack's own `body` VERBATIM — so "adding"
 *  it from the library commits an ordinary custom entry (via the app package's `validateNewEntry`, unchanged)
 *  whose content already IS the exemplar body; no further server round-trip is needed to resolve a picked
 *  source's text at turn time (agent-admin.ts reads the picked entry's `.content` directly, SPEC-R11 AC2). */
export function genuiPackLibrary(packs: readonly GenuiPatternPack[]): GenuiEntryLibraryPack[] {
  return packs.map((pack) => ({
    id: pack.id,
    label: pack.label,
    description: pack.description,
    entries: [{ label: pack.label, description: pack.description, content: pack.body }],
  }))
}
