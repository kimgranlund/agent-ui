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
// Selection reuses `retrieve.ts`'s tokenizer/cosine primitives (ADR-0091 §2), extracted to
// `../../src/corpus/text-similarity.ts` (slice 1) — NOT the `CorpusRecord` schema or `admit.ts`'s
// pipeline (§1's scoping line: instruction prose doesn't fit the exemplar-required schema).
//
// Zero-dep, platform-neutral (SPEC-N5): the only import is the shared math util.

import { topKByCosine } from '../../src/corpus/text-similarity.ts'

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
 * The seed registry — ADR-0090's five calibration examples, at their general (not mode-scaled) maturity.
 * Order is registry-declaration order; selection ranks by relevance, not this order.
 */
export const MINI_SKILLS: MiniSkill[] = [
  {
    id: 'card-game-sheet',
    triggers:
      'card game hand deck discard pile score board tabletop collection sheet cards player turn',
    body:
      'A card-game component sheet. Parts: hand, discard/deck pile, score readout, action bar. Map: hand = ' +
      'Row(gap) of Cards · pile = a Card with a Text count · score = a Grid of Text (name→value) · action ' +
      'bar = a Row of Buttons. Wall: drag-to-reorder, card-flip animation, and playing-card face art are not ' +
      'hosted — name them in the note, render static Cards as the approximation.',
  },
  {
    id: 'settings-screen',
    triggers: 'settings preferences options toggle switch configuration screen save profile account',
    body:
      'A settings screen. Parts: grouped preference rows + save. Map: Card › CardContent › List of Field ' +
      '(label+description) each wrapping a Switch/Select/TextField; CardFooter › Button. Wall: none — ' +
      'fully hosted.',
  },
  {
    id: 'dashboard-kpi-grid',
    triggers: 'dashboard summary kpi stats metrics analytics overview report numbers grid',
    body:
      'A dashboard / summary. Parts: 3-7 KPI stats. Map: Grid(min) of Cards, each a Column of ' +
      'Text variant="caption" (label) + Text variant="h2" (value). Wall: real charts/sparklines are not ' +
      'hosted — offer the numeric grid, name the missing chart.',
  },
  {
    id: 'login-form',
    triggers: 'login sign up signup form register account password email submit authentication',
    body:
      "A sign-up / login form. Parts: titled section, labelled validated inputs, submit. Map: FormProvider " +
      "› Card › CardHeader(Text h3) + CardContent(Column of Field › TextField with required, " +
      "type=email/password, wired to the catalog's required/email functions) + CardFooter(Button " +
      'action=submit). Wall: none.',
  },
  {
    id: 'master-detail-split',
    triggers: 'master detail list inspector split selection browse table view records rows',
    body:
      'A master-detail / list-and-inspector split. Parts: scannable list + selection-bound detail. Map: ' +
      'Row split — left List of selectable rows; right Card detail bound via an updateDataModel path. ' +
      'Wall: true two-way selection sync is a live action→updateComponents round-trip — worth naming.',
  },
]

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
