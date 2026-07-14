// system-prompt.ts — LLD-C4 / SPEC-R6, ADR-0071: the catalog-DERIVED, drift-gated machine system prompt.
//
// Three parts (LLD §5): a fixed GRAMMAR (how to emit A2UI JSONL) + the catalog INVENTORY derived at RUN
// TIME from the passed `Catalog` (the sole component authority — never a hand-listed set) + a few-shot
// block from the retrieved exemplars. A standing drift test (`prompt-drift.test.ts`) asserts the derived
// inventory equals the catalog's, so a catalog row added without regeneration FAILS (PRD-G6 coherence).
// Pure of catalog I/O; the caller loads the catalog. ADR-0135 cl.8/13: the hand-authored GRAMMAR half +
// the mode-scaled consts now LOAD from `./prompts/*.md` at module load (`readFileSync` +
// `import.meta.url`) rather than living as inline template literals — editable/diffable as prose, with
// the byte-identity gate below holding the `'default'`-mode contract ADR-0090 established.
//
// The prose each ADR added, and where its text now lives (ADR-0135 cl.14 — the condensed index):
// · ADR-0071 — the catalog-derived inventory + drift gate (this file, `catalogInventory`/`buildSystemPrompt`).
// · ADR-0088 §1 — the always-first note/meta-line convention (`prompts/grammar.md`, intro section).
// · ADR-0089 — clarify-before-acting + catalog-boundary honesty, prose-only, never a license to invent
//   (`prompts/grammar.md`).
// · ADR-0090 §1 — the per-turn `GenUiMode` axis: GRAMMAR IS the `'default'`/absent composition (byte-identity
//   by construction). `INTRO_AND_NOTE`/`OUTPUT_RULES` are SLICED from the loaded grammar; `HONESTY_FLOOR`
//   (§2, never scaled), `CLARIFY_SPECIFIC`/`NEGOTIATE_SPECIFIC` (dialed DOWN) and `CLARIFY_BLUE_SKY`/
//   `NEGOTIATE_BLUE_SKY` (dialed UP) are the mode-SCALED block `grammarFor` composes (`prompts/*.md`).
// · ADR-0091 §3 — the fifth composed segment `miniSkillsBlock`, a twin of `fewShot`, additive + orthogonal
//   to `mode`, degrades to `''` when empty (registry text lives in `prompts/mini-skills/*.md`).
// · ADR-0091 §4 fix — the three (★) calibration examples are single-sourced from `MINI_SKILLS[id].body`
//   (`calibrationExampleBullet`) and `NEGOTIATE_BLUE_SKY`'s bullets are appended from the registry in code;
//   `miniSkillsFor` filters those ids out of a `'blue-sky'` selection to avoid double-injection.
// · ADR-0097 §4 — feed-embedded ask mechanics (mode-invariant, in `prompts/grammar.md`) + the mode-scaled
//   archetype vocabulary (`prompts/ask-archetypes-*.md`); the feed-allowed list is composed FROM
//   `feed-catalog.ts` via the `{{FEED_SURFACE_TYPES}}` placeholder the loader fills (drift-impossible).
// · ADR-0103 §Decision cl.4 — the `form-rhythm` mini-skill (`prompts/mini-skills/form-rhythm.md`).
// · ADR-0126 (LLD-C1, TKT-0016) — the message-lifecycle decision-layer teaching (the four-type choice rule +
//   deleteSurface wire shape + whole-record-upsert warning + root-immutability), appended inside the
//   OUTPUT_RULES zone of `prompts/grammar.md`, so it rides `OUTPUT_RULES` into every mode.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import type { Catalog } from '../../src/catalog/catalog.ts'
import type { CorpusRecord } from '../../src/corpus/record.ts'
import type { GenUiMode } from './gen-ui-mode.ts'
import { MINI_SKILLS } from './mini-skills.ts'
import type { MiniSkill } from './mini-skills.ts'
import { FEED_SURFACE_TYPES } from './feed-catalog.ts'

// The prompts directory, resolved relative to THIS module — cwd-independent (deliberately unlike
// `dev-proxy-plugin.ts`'s `process.cwd()` paths; these modules are not Vite-bundled into a temp file).
// `import.meta.dirname` is a plain path string, correct under the Node proxy AND vitest; the fallback
// derives the same from `import.meta.url` via `node:url`/`node:path` (a STRING parse, never the jsdom-
// global `URL` — jsdom mis-resolves `new URL(rel, fileUrl)` to `http://localhost` and `fs` then rejects it).
const PROMPTS_DIR = `${(import.meta as { dirname?: string }).dirname ?? dirname(fileURLToPath(import.meta.url))}/prompts`

/** Load one prompt file from `PROMPTS_DIR`. Node-only tooling, never a browser bundle (SPEC-R3/N2).
 *  Trimmed so an authored trailing newline never perturbs byte-identity — every prompt const is
 *  whitespace-edge-free by construction (ADR-0090 §1: by construction, never re-transcription). */
function loadPrompt(file: string): string {
  return readFileSync(`${PROMPTS_DIR}/${file}`, 'utf8').trim()
}

// GRAMMAR — the whole hand-authored grammar, loaded from ONE file (ADR-0135 cl.8), never pre-sliced into
// fragments. The `{{FEED_SURFACE_TYPES}}` placeholder is filled from `feed-catalog.ts` at load, so the
// composed feed-allowed list is derived FROM the single source (drift-impossible, ADR-0097 §3), exactly
// as the prior `${FEED_SURFACE_TYPES.join(', ')}` interpolation did — byte-identical result.
const GRAMMAR = loadPrompt('grammar.md').replace('{{FEED_SURFACE_TYPES}}', FEED_SURFACE_TYPES.join(', '))

// ---- ADR-0090 §1: the mode-INVARIANT spine, sliced (never retyped) out of the literal GRAMMAR above,
// so the truly mode-invariant prose (the note-line instruction, the JSONL output rules) has exactly ONE
// source of truth shared by every mode — including `'default'`, which uses GRAMMAR whole. ----

const CLARIFY_MARKER = 'Ask instead of guess when the turn is underdetermined'
const OUTPUT_MARKER = 'Output rules for the A2UI JSONL'

const INTRO_AND_NOTE = GRAMMAR.slice(0, GRAMMAR.indexOf(CLARIFY_MARKER)).trim()
const OUTPUT_RULES = GRAMMAR.slice(GRAMMAR.indexOf(OUTPUT_MARKER)).trim()

// Marker-sanity guard (independent-review hardening, post-ADR-0090): `String.prototype.indexOf` returns
// -1 on a marker that stops matching GRAMMAR (e.g. a future edit rewords/removes the sliced-out phrase),
// and `GRAMMAR.slice(0, -1)` degrades SILENTLY to almost the entire GRAMMAR string rather than throwing —
// bloating `INTRO_AND_NOTE` with duplicated clarify/catalog-wall prose, with no test currently red. Assert
// both markers are actually present in GRAMMAR, and that the two derived slices are disjoint (neither
// contains the other's marker), at MODULE LOAD — so a broken marker fails immediately and loudly instead
// of shipping a bloated/wrong prompt.
function assertMarkersHold(): void {
  if (GRAMMAR.indexOf(CLARIFY_MARKER) === -1) {
    throw new Error(`system-prompt: CLARIFY_MARKER not found in GRAMMAR — "${CLARIFY_MARKER}"`)
  }
  if (GRAMMAR.indexOf(OUTPUT_MARKER) === -1) {
    throw new Error(`system-prompt: OUTPUT_MARKER not found in GRAMMAR — "${OUTPUT_MARKER}"`)
  }
  if (INTRO_AND_NOTE.includes(OUTPUT_MARKER)) {
    throw new Error('system-prompt: INTRO_AND_NOTE unexpectedly contains OUTPUT_MARKER — the slice is not disjoint')
  }
  if (OUTPUT_RULES.includes(CLARIFY_MARKER)) {
    throw new Error('system-prompt: OUTPUT_RULES unexpectedly contains CLARIFY_MARKER — the slice is not disjoint')
  }
}

assertMarkersHold()

// ---- ADR-0090 §2: the honesty floor — mode-INVARIANT, never scaled. Carries the SAME two facts as the
// ADR-0089 catalog-wall paragraph (never invent, never silently substitute) as a standalone paragraph so
// every mode gets it identically, without each mode-scaled variant having to restate it. ----

const HONESTY_FLOOR = loadPrompt('honesty-floor.md')

// ---- ADR-0090 §1: the mode-SCALED block — `specific` (directive, dialed DOWN) and `blue-sky`
// (exploratory, dialed UP, carrying the dual-direction composition discipline + calibration examples).
// All loaded from `./prompts/*.md` (ADR-0135 cl.9). ----

const CLARIFY_SPECIFIC = loadPrompt('clarify-specific.md')

const NEGOTIATE_SPECIFIC = loadPrompt('negotiate-specific.md')

const CLARIFY_BLUE_SKY = loadPrompt('clarify-blue-sky.md')

// ADR-0091 §4 fix (independent-review defect): the three (★) calibration examples below are now SOURCED
// from `MINI_SKILLS` (mini-skills.ts) rather than hardcoded here a second time — the registry entry's
// `body` IS the bullet text. This closes the drift risk of two hand-maintained copies silently diverging,
// and the composition-site filter in `buildSystemPrompt` below skips re-injecting these same three ids
// via `miniSkillsBlock` in `'blue-sky'` mode (they're already present here) — see `BLUE_SKY_CALIBRATION_IDS`.
const BLUE_SKY_CALIBRATION_IDS = ['card-game-sheet', 'settings-screen', 'dashboard-kpi-grid'] as const

function calibrationExampleBullet(id: string): string {
  const skill = MINI_SKILLS.find((m) => m.id === id)
  if (!skill) throw new Error(`system-prompt: missing MINI_SKILLS entry for calibration id "${id}"`)
  return `- ${skill.body}`
}

// ADR-0135 cl.10: the STATIC prose (through the `Calibration examples (…):` header) loads from
// `prompts/negotiate-blue-sky.md`; the dynamic calibration bullets — computed from `MINI_SKILLS` via
// `calibrationExampleBullet` — are appended in code after load (a trailing append, chosen over a mid-file
// placeholder because the dynamic block is strictly TRAILING today, keeping the `MINI_SKILLS` dependency
// visible in code). Byte-identical to the prior interpolated literal.
const NEGOTIATE_BLUE_SKY = `${loadPrompt('negotiate-blue-sky.md')}
${BLUE_SKY_CALIBRATION_IDS.map(calibrationExampleBullet).join('\n')}`

// ---- ADR-0097 §4/§5: the feed-ask archetype vocabulary, mode-SCALED alongside the clarify/negotiate
// paragraphs above. The mechanics (HOW to emit an ask) are mode-INVARIANT — inlined into the literal
// GRAMMAR string above, so INTRO_AND_NOTE (sliced from it) carries them into every mode automatically.
// WHEN/how eagerly to reach for an ask, plus the compact archetype recipes, differ per mode — `'default'`
// gets ONLY the terse "balanced" one-liner inlined into GRAMMAR (above, after the catalog-wall paragraph);
// `'specific'`/`'blue-sky'` get their OWN disposition + the same five archetype recipes, dialed like their
// CLARIFY_*/NEGOTIATE_* neighbors. ----

const ASK_ARCHETYPES_SPECIFIC = loadPrompt('ask-archetypes-specific.md')

const ASK_ARCHETYPES_BLUE_SKY = loadPrompt('ask-archetypes-blue-sky.md')

/**
 * Compose the hand-authored GRAMMAR half for `mode` (ADR-0090 §1). `'specific'`/`'blue-sky'` compose the
 * invariant spine + their scaled variant; an ABSENT `mode` or `'default'` returns the literal `GRAMMAR`
 * constant UNCHANGED — the byte-identity Decision §1/Acceptance AC1 requires, held by construction (this
 * branch never touches the sliced/rewritten pieces at all).
 */
function grammarFor(mode: GenUiMode | undefined): string {
  if (mode === 'specific') {
    return [INTRO_AND_NOTE, CLARIFY_SPECIFIC, NEGOTIATE_SPECIFIC, ASK_ARCHETYPES_SPECIFIC, HONESTY_FLOOR, OUTPUT_RULES].join(
      '\n\n',
    )
  }
  if (mode === 'blue-sky') {
    return [INTRO_AND_NOTE, CLARIFY_BLUE_SKY, NEGOTIATE_BLUE_SKY, ASK_ARCHETYPES_BLUE_SKY, HONESTY_FLOOR, OUTPUT_RULES].join(
      '\n\n',
    )
  }
  return GRAMMAR // undefined or 'default' — byte-identical to the pre-mode ADR-0089 grammar
}

function catalogInventory(catalog: Catalog): string {
  const lines: string[] = []
  for (const id of Object.keys(catalog.components)) {
    const def = catalog.components[id]!
    const props = Object.keys(def.properties)
    const child = def.children ? ` · children model: ${def.children}` : ''
    lines.push(`- ${id} (props: ${props.length > 0 ? props.join(', ') : 'none'}${child})`)
  }
  return lines.join('\n')
}

function functionsInventory(catalog: Catalog): string {
  const ids = Object.keys(catalog.functions)
  if (ids.length === 0) return '(none)'
  return ids.map((fn) => `- ${fn} (${catalog.functions[fn]!.callableFrom})`).join('\n')
}

function fewShot(exemplars: readonly CorpusRecord[]): string {
  if (exemplars.length === 0) return ''
  const blocks = exemplars.map((ex) => {
    const jsonl = (ex.a2uiOutput ?? []).map((m) => JSON.stringify(m)).join('\n')
    return `PROMPT: ${ex.promptText}\nA2UI:\n${jsonl}`
  })
  return `\n\n## Examples (retrieved — imitate their shape, not their content)\n\n${blocks.join('\n\n---\n\n')}`
}

// ---- ADR-0091 §3: the `miniSkills` composed segment — a structural twin of `fewShot` above. Returns
// `''` for an empty selection (the SAME degrade-to-empty idiom `fewShot` uses), or the selected modules'
// `body`s under one header otherwise. Additive and orthogonal to the `mode`-scaled block (Build-sequencing
// note): it never touches `grammarFor`, and composes identically in every mode, including `'default'`. ----

function miniSkillsBlock(selected: readonly MiniSkill[]): string {
  if (selected.length === 0) return ''
  const blocks = selected.map((skill) => skill.body)
  return `\n\n## Composition idioms (matched to your request)\n\n${blocks.join('\n\n')}`
}

// ADR-0091 §4 fix (independent-review defect): in `'blue-sky'` mode, `NEGOTIATE_BLUE_SKY` above already
// carries the three ★ calibration examples' `body` text verbatim (via `calibrationExampleBullet`). If
// `selectMiniSkills` ALSO picked one of those same three ids, injecting it again through
// `miniSkillsBlock` would duplicate the identical paragraph in ONE composed prompt — the exact defect an
// independent reviewer's live probe caught ("dashboard paragraph occurrences in ONE blue-sky prompt: 2").
// Filter those three ids out of the selection ONLY when `mode === 'blue-sky'` — in `'specific'`/`'default'`
// /absent mode, none of this prose is inlined anywhere, so the registry selection must keep injecting them
// normally there. `login-form`/`master-detail-split` are never inlined in any mode and are never filtered.
const BLUE_SKY_CALIBRATION_ID_SET: ReadonlySet<string> = new Set(BLUE_SKY_CALIBRATION_IDS)

function miniSkillsFor(mode: GenUiMode | undefined, selected: readonly MiniSkill[]): readonly MiniSkill[] {
  if (mode !== 'blue-sky') return selected
  return selected.filter((skill) => !BLUE_SKY_CALIBRATION_ID_SET.has(skill.id))
}

/**
 * Compose the machine system prompt (SPEC-R6): the `mode`-composed GRAMMAR half (ADR-0090 §1) + the
 * catalog-derived component/function inventory + the few-shot block + the selected mini-skills block
 * (ADR-0091 §3). The inventory is derived from `catalog` at call time — `buildSystemPrompt` can never
 * advertise a component the catalog lacks (drift-gated by `prompt-drift.test.ts`, untouched by `mode` or
 * `miniSkills` — both only ever condition the hand-authored grammar half).
 *
 * `mode` is optional: an absent `mode` (and `'default'`) reproduce the pre-ADR-0090 grammar byte-for-byte
 * (zero regression, Decision §1). `'specific'` dials the ADR-0089 clarify/negotiate behaviors DOWN;
 * `'blue-sky'` dials them UP. The honesty floor (§2) is identical in every mode.
 *
 * `miniSkills` is optional and defaults to `[]`: an absent/empty selection composes a prompt
 * byte-identical to calling `buildSystemPrompt` without the parameter at all (ADR-0091 Acceptance) — the
 * block is `''` on empty, exactly like `fewShot`. A non-empty selection appends ONE `## Composition
 * idioms` block after the few-shot examples, capped at whatever size the caller (`produce()`,
 * `selectMiniSkills`) already bounded it to. In `'blue-sky'` mode ONLY, `miniSkillsFor` first drops any
 * selected entry whose id is already inlined verbatim in `NEGOTIATE_BLUE_SKY` (§4 fix) — everywhere else
 * the selection composes unfiltered.
 */
export function buildSystemPrompt(
  catalog: Catalog,
  exemplars: readonly CorpusRecord[],
  mode?: GenUiMode,
  miniSkills?: readonly MiniSkill[],
): string {
  return (
    grammarFor(mode) +
    `\n\n## Available components (catalog "${catalog.catalogId}", protocol ${catalog.protocolVersion})\n\n` +
    catalogInventory(catalog) +
    `\n\n## Available functions\n\n` +
    functionsInventory(catalog) +
    fewShot(exemplars) +
    miniSkillsBlock(miniSkillsFor(mode, miniSkills ?? []))
  )
}
