// mini-skills.ts — ADR-0091: the mini-skill registry + `selectMiniSkills`, the cheap intent-match that
// selects a capped set of catalog-composition idioms for `buildSystemPrompt` to compose (LLD-C4 twin of
// `fewShot`). A mini-skill is a named, prompt-injectable INSTRUCTION module (anatomy → catalog mapping →
// wall) — the schema-fit reason it lives here rather than as a corpus exemplar: `CorpusRecord` requires
// `a2uiOutput` for `facet:"exemplar"` (record.ts:30,119-121), and a mini-skill's `body` is prose, not a
// worked A2UI payload (ADR-0091 §1).
//
// Seed content (ADR-0091 Decision §1 / Build-sequencing step 2): ADR-0090's FIVE calibration examples,
// ALL FIVE as selectable modules here. The registry is a superset that composes on TOP of every mode
// (including `'specific'`, which today carries zero inline idioms).
//
// ADR-0091 §4 fix (independent-review defect, post-ship): the three (★) entries below
// (`card-game-sheet`/`settings-screen`/`dashboard-kpi-grid`) are THIS module's SINGLE SOURCE for that
// prose — `system-prompt.ts`'s `NEGOTIATE_BLUE_SKY` now COMPOSES its "Calibration examples" bullets from
// these entries' `body` (via `calibrationExampleBullet`) rather than hardcoding a second verbatim copy,
// and `buildSystemPrompt`'s `miniSkillsFor` filters these same three ids out of a `'blue-sky'`-mode
// selection (already present via `NEGOTIATE_BLUE_SKY`) to avoid double-injecting the identical paragraph.
// `'specific'`/`'default'` carry none of this prose inline, so the registry selection still injects these
// three normally there. `login-form`/`master-detail-split` were never duplicated and are unaffected.
//
// ADR-0103 §Decision cl.4 (Lane C, "one ADR-0091 mini-skill module recommended at build"): a SIXTH entry,
// `form-rhythm`, teaches the `FormProvider > Column gap > fields` idiom the fork settled on — FormProvider
// stays layout-free (the coordination-wrapper pole), so the wrap is taught here rather than defaulted in
// CSS, reinforcing the fix already landed in every shipped seed (generative-form `68d2a8d`,
// pattern-settings-form `patterns.ts:36-37`).
//
// Selection reuses `retrieve.ts`'s tokenizer/cosine primitives (ADR-0091 §2), extracted to
// `../../src/corpus/text-similarity.ts` (slice 1) — NOT the `CorpusRecord` schema or `admit.ts`'s
// pipeline (§1's scoping line: instruction prose doesn't fit the exemplar-required schema).
//
// ADR-0135 cl.11: the six-entry registry is no longer an inline object-literal array — each entry is a
// `prompts/mini-skills/<id>.md` frontmatter file (`---\nid:\ntriggers:\n---\n<body>`), loaded + parsed at
// module load. The bodies are prose, editable/diffable as prose; `selectMiniSkills` and the token-budget
// test are unchanged. Node-only tooling (never a browser bundle, SPEC-R3/N2), so the synchronous
// filesystem read at module load is safe — the same lifecycle position the prior static literal held.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { topKByCosine } from '../../src/corpus/text-similarity.ts'
import { parseFrontmatter } from './prompts/frontmatter.ts'

/** A named, self-contained, prompt-injectable idiom-instruction module (ADR-0091 Decision §1). */
export interface MiniSkill {
  /** Stable, kebab — e.g. `'settings-screen'`. */
  id: string
  /** The intent vocabulary this idiom answers, matched against the user's turn. */
  triggers: string
  /** The idiom instruction: anatomy → catalog mapping → wall, ≤ the per-module token budget (§3). */
  body: string
}

/** ADR-0091 §3: the indicative per-module token budget (~200 tokens), enforced by `mini-skills.test.ts`
 * against every registry entry. The same `chars / 4` estimate the ADR itself uses to size `GRAMMAR`
 * (~3857 chars ≈ ~964 tokens). */
export const PER_MODULE_TOKEN_BUDGET = 200

/** ADR-0091 §3: the indicative per-turn cap — at most this many modules ever compose into one prompt,
 * matching the shipped exemplar default (`k = opts.k ?? 3`, `produce.ts:150`). */
export const DEFAULT_MINI_SKILL_CAP = 3

/**
 * The seed registry — ADR-0090's five calibration examples, at their general (not mode-scaled) maturity,
 * plus the ADR-0103 `form-rhythm` module (the Lane C teaching lane for `ui-form-provider`'s spacing fork).
 * Loaded from `prompts/mini-skills/*.md` (ADR-0135 cl.11), one frontmatter file per module. Loaded in a
 * stable filename-sorted order; the order is NOT load-bearing — `selectMiniSkills` ranks by relevance with
 * an id tiebreak, and every id-keyed consumer (`calibrationExampleBullet`, the §4 filter) looks up by id.
 */
function loadMiniSkills(): MiniSkill[] {
  // Resolve relative to THIS module via `import.meta.dirname` (a plain path string, correct under the
  // Node proxy AND vitest), falling back to `import.meta.url` parsed by `node:url`/`node:path` — a STRING
  // parse, never the jsdom-global `URL` (jsdom mis-resolves `new URL(rel, fileUrl)` to `http://localhost`).
  const here = (import.meta as { dirname?: string }).dirname ?? dirname(fileURLToPath(import.meta.url))
  const dir = `${here}/prompts/mini-skills`
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
  return files.map((name) => {
    const { data, body } = parseFrontmatter(readFileSync(`${dir}/${name}`, 'utf8'))
    if (!data.id || !data.triggers) throw new Error(`mini-skills: ${name} is missing id/triggers frontmatter`)
    return { id: data.id, triggers: data.triggers, body }
  })
}

export const MINI_SKILLS: MiniSkill[] = loadMiniSkills()

/**
 * Select up to `cap` mini-skills from `registry` whose `triggers` best match `intent` (ADR-0091 §2), via
 * TF-IDF top-`cap` cosine ranking (`topKByCosine`, the SAME math `retrieve()` uses).
 *
 * Degrades to `[]` — mirroring `retrieve.ts`'s zero-vocabulary rule and `fewShot`'s empty return
 * (`system-prompt.ts:93`) — when `intent` shares no idiom vocabulary with any registry entry, OR `cap`
 * or `registry.length` is `<= 0`. Unlike `retrieve()`, a genuinely UNRELATED (zero-score) entry is never
 * used to pad the result out to `cap` — the `floor: 0` passed to `topKByCosine` (a per-turn prompt
 * injection should never carry a module that scored no relevance at all).
 */
export function selectMiniSkills(intent: string, registry: readonly MiniSkill[], cap: number): MiniSkill[] {
  return topKByCosine(registry, (m) => m.triggers, intent, cap, (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0), 0)
}
