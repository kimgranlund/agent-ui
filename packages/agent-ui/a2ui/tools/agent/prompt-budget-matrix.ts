// prompt-budget-matrix.ts: the worst-case fixture matrix the prompt budget legs compose (ADR-0234), shared by
// `prompt-budget.test.ts` (the persona at the proxies' 16 KB runaway cap) and the site leg
// `site/pages/agent-admin-prompt-budget.test.ts` (T-0207: each shipped preset's real composed persona). Test
// support only, so it lives under tools/ (src/ bars a non-test module from importing src/agent/ or the corpus);
// the exemplar shard comes in as raw text (a Vite `?raw` import), so the site type gate needs no node types.

import exemplarShard from '../../corpus/exemplar/v1_0/agent-ui.jsonl?raw'
import { buildSystemPrompt } from '../../src/agent/system-prompt.ts'
import { MINI_SKILLS, DEFAULT_MINI_SKILL_CAP } from '../../src/agent/mini-skills.ts'
import type { GenUiMode } from '../../src/agent/gen-ui-mode.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import { defaultCatalog } from '../../src/catalog/default/index.ts'
import { a2uiBasicCatalog } from '../../src/catalog/a2ui-basic/index.ts'
import { composeCatalog } from '../../src/catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOGS } from '../../src/catalog/personas/index.ts'

// Typed off the builder's own parameter, never `CorpusRecord` by name: `src/corpus/*` is import-barred
// outside itself (ADR-0062), the `produce-loop.test.ts` precedent.
type Exemplar = Parameters<typeof buildSystemPrompt>[1][number]
export type BudgetArgs = Parameters<typeof buildSystemPrompt>

export const MODES: readonly GenUiMode[] = ['default', 'specific', 'blue-sky']
/** The runaway-guard caps the two proxies apply (`tools/agent/chat-validation.ts`, `dev-proxy-plugin.ts`): a
 *  longer `personaSystem` is dropped, never truncated. */
export const SOURCE_BODY_CAP = 16_384
export const PERSONA_SYSTEM_CAP = 16_384

const allExemplars: Exemplar[] = exemplarShard
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l) as Exemplar)
/** The k=3 records with the largest single-record prompt (the worst-case retrieval). */
const worstExemplars: Exemplar[] = [...allExemplars]
  .map((ex) => ({ ex, len: buildSystemPrompt(defaultCatalog, [ex]).length }))
  .sort((a, b) => b.len - a.len)
  .slice(0, 3)
  .map((e) => e.ex)

/** The `DEFAULT_MINI_SKILL_CAP` largest mini-skill bodies scoped to `baseCatalogId`. */
const worstMiniSkills = (baseCatalogId: string) =>
  MINI_SKILLS.filter((m) => m.catalogId === baseCatalogId)
    .sort((a, b) => b.body.length - a.body.length)
    .slice(0, DEFAULT_MINI_SKILL_CAP)

/** The worst-case argument tuple for one catalog, mode and persona text. */
export function worstArgs(catalog: Catalog, baseCatalogId: string, mode: GenUiMode, personaSystem: string): BudgetArgs {
  return [
    catalog,
    worstExemplars,
    mode,
    worstMiniSkills(baseCatalogId),
    personaSystem,
    { enabled: true, dogfood: true, sourceBody: 's'.repeat(SOURCE_BODY_CAP) },
    true,
    true,
    true,
    'surface',
  ]
}

export const BASES: Readonly<Record<string, Catalog>> = { 'agent-ui': defaultCatalog, 'a2ui-basic': a2uiBasicCatalog }

/** Every shipped persona fragment composed onto each base it targets, with that base's id. */
export const DERIVED_CATALOGS: readonly { catalog: Catalog; baseId: string }[] = SHIPPED_PERSONA_CATALOGS.flatMap((p) =>
  (p.targetCatalogs !== undefined && p.targetCatalogs.length > 0 ? p.targetCatalogs : ['agent-ui']).map((baseId) => ({
    catalog: composeCatalog(BASES[baseId]!, p.fragment, p.personaId),
    baseId,
  })),
)

/** A base or shipped `<base>--<persona>` catalog by id, with its base id; undefined for any other id. */
export function catalogForId(id: string): { catalog: Catalog; baseId: string } | undefined {
  if (Object.hasOwn(BASES, id)) return { catalog: BASES[id]!, baseId: id }
  return DERIVED_CATALOGS.find((d) => d.catalog.catalogId === id)
}
