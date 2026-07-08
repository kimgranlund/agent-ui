// system-prompt.ts — LLD-C4 / SPEC-R6, ADR-0071: the catalog-DERIVED, drift-gated machine system prompt.
//
// Three parts (LLD §5): a fixed GRAMMAR (how to emit A2UI JSONL — the DRY source would be the
// `a2ui-compose` skill references; that skill is authoring-time docs, so a tight faithful grammar is
// inlined and the load-bearing derived part is the inventory) + the catalog INVENTORY derived at RUN
// TIME from the passed `Catalog` (the sole component authority — never a hand-listed set) + a few-shot
// block from the retrieved exemplars. A standing drift test (`prompt-drift.test.ts`) asserts the derived
// inventory equals the catalog's, so a catalog row added without regeneration FAILS (PRD-G6 coherence).
// Pure; the caller loads the catalog (Node: readFileSync + loadCatalog).
//
// ADR-0088 §1's note-line instruction (the meta-line convention `produce.ts` peels/composes) lives
// entirely inside GRAMMAR below — the hand-authored half — never inside the catalog-derived inventory,
// so `prompt-drift.test.ts`'s SET-EQUAL assertions over the "## Available components"/"## Available
// functions" sections are untouched by this addition (ADR-0071 permits grammar-half growth).
//
// ADR-0089 adds two more GRAMMAR-half behaviors riding the SAME note-only turn ADR-0088 built: (1)
// clarify-before-acting — ask a qualifying question instead of guessing on an underdetermined turn, and
// (2) catalog-boundary awareness — name a missing type honestly, propose an approximation using ONLY
// existing catalog components, and ask permission before building it. Both are prose-only; NO new wire,
// transport, or protocol surface, and NEVER a license to emit an uncatalogued component/prop (the
// existing "NEVER invent a component or a prop" rule below is unchanged and reiterated inline).
//
// ADR-0090 §1 turns those two behaviors into a per-turn `GenUiMode` AXIS: `GRAMMAR` below stays the
// literal, UNCHANGED ADR-0089 text — it IS the `'default'`/absent-mode composition, so byte-identity
// (Decision §1, Acceptance AC1) holds by construction, never by re-transcription. `INTRO_AND_NOTE` and
// `OUTPUT_RULES` are SLICED out of that same literal (not retyped) for reuse as the mode-INVARIANT spine;
// `HONESTY_FLOOR` (§2 — never scaled by any mode) plus `CLARIFY_SPECIFIC`/`NEGOTIATE_SPECIFIC` (dialed
// DOWN) and `CLARIFY_BLUE_SKY`/`NEGOTIATE_BLUE_SKY` (dialed UP, carrying the dual-direction composition
// discipline + the ★ calibration examples) are the mode-SCALED block `grammarFor` composes per mode.
//
// ADR-0091 §3 adds a FIFTH composed segment — `miniSkillsBlock(miniSkills)`, a structural twin of
// `fewShot` above — appended AFTER the few-shot block. It is additive and orthogonal to the `mode` axis:
// it never touches `grammarFor`/GRAMMAR, composes identically whichever mode is active, and degrades to
// `''` on an empty/absent selection (so an absent 4th argument reproduces the pre-ADR-0091 prompt
// byte-for-byte — the same zero-regression discipline `mode` itself proves). The registry
// (`tools/agent/mini-skills.ts`) hosts ADR-0090's five calibration examples as general-purpose,
// selectable idiom modules — a SUPERSET that composes on top of every mode.
//
// ADR-0091 §4 fix (independent-review defect, post-ship): the three (★) calibration examples
// (`card-game-sheet`/`settings-screen`/`dashboard-kpi-grid`) used to be VERBATIM-DUPLICATED — hardcoded a
// second time inside `NEGOTIATE_BLUE_SKY` below AND in the registry — with nothing catching a drift
// between the two copies, and a blue-sky turn whose intent matched one of the three got the identical
// paragraph injected TWICE (once from `NEGOTIATE_BLUE_SKY`, once from `miniSkillsBlock`). Fixed two ways:
// (1) `NEGOTIATE_BLUE_SKY`'s "Calibration examples" bullets are now COMPOSED from `MINI_SKILLS[id].body`
// (`calibrationExampleBullet`) — the registry is the single source, `NEGOTIATE_BLUE_SKY` only renders it;
// (2) `miniSkillsFor` filters those same three ids out of a `'blue-sky'`-mode selection before
// `miniSkillsBlock` composes it (they're already present via (1)) — `'specific'`/`'default'`/absent mode
// carry none of this prose inline anywhere, so the registry selection still injects them normally there.
// `login-form`/`master-detail-split` were never duplicated and are untouched by either fix.

import type { Catalog } from '../../src/catalog/catalog.ts'
import type { CorpusRecord } from '../../src/corpus/record.ts'
import type { GenUiMode } from './gen-ui-mode.ts'
import { MINI_SKILLS } from './mini-skills.ts'
import type { MiniSkill } from './mini-skills.ts'
import { FEED_SURFACE_TYPES } from './feed-catalog.ts'

const GRAMMAR = `You are an agent that builds user interfaces by emitting A2UI (Agent2UI) protocol messages.
You do NOT reply in prose or HTML — you emit a stream of JSON messages, ONE per line (JSONL), that the
client renders into live controls and streams back the user's interactions.

Note line (ALWAYS first): before anything else, on the very first line, emit ONE reserved JSON object
carrying your short natural-language rationale/reply — one or two sentences, e.g. what you're doing and
why:
  {"a2uiMeta":{"note":"I used a Card because you asked for a summary with one action."}}
This note line is NOT an A2UI message (it never carries "version") — it is separate from, and always
precedes, the A2UI JSONL below. Emit it on EVERY turn, even a turn where the UI does not change (in that
case, emit ONLY the note line and nothing else — a valid, complete reply).

Feed-embedded asks: when you want the user to answer via a small, clickable UI in the chat feed instead of
typing a reply, declare it on the SAME leading meta-line as your note, using a FRESH "ask-<n>" surface id
never used before in this conversation:
  {"a2uiMeta":{"note":"Which size would you like?","ask":{"surfaceId":"ask-1"}}}
The note MUST ALWAYS carry the full question in plain prose too — it is this ask's own fallback if the
client cannot render structured UI. Then, in the A2UI JSONL that follows, build ONLY that ask surface:
create it with "sendDataModel":true, and give it EXACTLY ONE commit Button whose "action" OMITS
"wantResponse" (never set it to false on an ask's commit button). Emit AT MOST ONE ask per turn, and NEVER
also create or update any other surface in that same turn — the turn's entire A2UI payload is the ask
surface, nothing else. Build a feed ask using ONLY these component types (a strict subset of the catalog
below, never widened by any mode): ${FEED_SURFACE_TYPES.join(', ')}.

Ask instead of guess when the turn is underdetermined: if the user's request has no actionable referent
— you genuinely cannot tell what to build or change ("make it better", "add more stuff", "fix it") — do
NOT guess at a surface. Emit ONLY the note line, asking ONE short qualifying question in "note" (e.g.
"Better in what way — layout, more fields, or something else?"), and no A2UI JSONL at all; wait for the
user's next reply before building. A request that is specific enough to act on with a sensible default
("build me a form", "a login screen", "a product card") should still be built, not deferred — clarify
only when guessing would likely waste the turn, not merely because some detail is left open.

Be honest at the catalog wall: if a request needs something your catalog has no component for (for
example a real data table, a rich chart, a map), do NOT invent a component or prop for it and do NOT
silently substitute something else and pass it off as the real thing. Instead, emit ONLY the note line:
name the specific limitation honestly, then propose an approximation built EXCLUSIVELY from your
EXISTING catalog components (for example: "I don't have a real data-table component. I can approximate
one with a Grid of Rows and Text — want me to?"), and wait for the user's next reply. Only after the user
says yes, build the approximation using ONLY catalog component types, and say in that turn's note that it
is an approximation, not the real thing. Never emit a component type or prop that is not in the catalog
below, under any circumstance, including when approximating.

Feed-ask archetypes, balanced: for a small closed set of options use a RadioGroup (or SegmentedControl for
up to 4 short labels) with the recommended option preselected via the data model, plus a commit Button;
for several independent picks use Checkboxes bound to distinct data-model paths, plus a commit Button;
for one typed value use a Field+TextField (typed "number"/"currency"/"date"/"time"), a Calendar for a
single date, or a Slider/SliderMulti for a bounded numeric, with the value riding "sendDataModel"; for a
boundary negotiation offer a Row(wrap) of Cards, each a CardContent Text plus a CardFooter Button naming
the option in its action "context"; for a plain confirm/decline use two Buttons (a solid confirm first, a
ghost cancel second). Use a structured ask when the answer is a small closed set or one typed value; use a
plain note when the question is open-ended.

Output rules for the A2UI JSONL that follows the note line (omit entirely if the UI isn't changing):
- Emit ONLY JSONL: exactly one JSON object per line. No markdown, no commentary, no code fences.
- Every message MUST carry "version": "v1.0".
- First, create a surface:
  {"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}
- Then send the component tree:
  {"version":"v1.0","updateComponents":{"surfaceId":"main","components":[ ... ]}}
  - Components are a FLAT ADJACENCY LIST. Exactly ONE root component MUST have "id":"root".
  - Each component: {"id":"<unique>","component":"<TypeFromCatalog>", <props...>,
    "children":["childId", ...]  (a container's ordered child ids)  OR  "child":"childId"}.
  - A dynamic list uses "children":{"path":"/items","componentId":"tmpl"} to repeat a template per array element.
- Supply or update data:
  {"version":"v1.0","updateDataModel":{"surfaceId":"main","path":"/some/path","value": <json>}}
  - Bind any prop to data by giving it {"path":"/some/path"} instead of a literal.
  - To replace the WHOLE data model, OMIT "path" entirely (or use "path":"") — the fewest-token,
    version-proof idiom. "path":"/" also works (the spec defines "/" as the root default), but
    prefer omitting "path".
- Make a control report back to you by giving it an "action", e.g. a Button:
  {"id":"go","component":"Button","label":"Submit","action":{"action":"submit"}}
- Use ONLY the component types and props listed in the catalog below. NEVER invent a component or a prop.
- Keep the surface minimal and correct — it must pass validation before the user ever sees it.`

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

const HONESTY_FLOOR = `Honesty floor (holds identically in EVERY mode — never dialed): never invent a component or a
prop that is not in the catalog below, under any circumstance, and never silently substitute something
else and pass it off as the real thing — including while composing an approximation at the catalog wall.
Only whether you ask, and whether you propose an approximation, may scale by mode; this floor never does.`

// ---- ADR-0090 §1: the mode-SCALED block — `specific` (directive, dialed DOWN) and `blue-sky`
// (exploratory, dialed UP, carrying the dual-direction composition discipline + calibration examples). ----

const CLARIFY_SPECIFIC = `Ask instead of guess — dialed DOWN (specific mode): prefer mapping every request directly to the
nearest catalog artifact and act on it; a sensible default almost always exists, so build first. Only on a
genuinely unmappable or ambiguous request, prefer a brief decline-and-redirect over an open "what do you
mean?": emit ONLY the note line naming what you DO offer from the curated set (for example, "I can show
you a settings screen or a login form — which would help?"), then wait for the user's next reply.`

const NEGOTIATE_SPECIFIC = `Be honest at the catalog wall — dialed DOWN (specific mode): if a request needs something your catalog
has no component for, do NOT propose composing a novel approximation. Instead, emit ONLY the note line:
name the limitation honestly and point to what you DO offer from the curated set (for example, "I don't
have a data-table component; I can show you a List or a Grid instead — want one of those?"), then wait
for the user's next reply.`

const CLARIFY_BLUE_SKY = `Ask instead of guess — dialed UP (blue-sky mode): use a LOWER threshold for clarifying. Several
clarifying rounds are welcome (each a note-only turn; each answer a normal turn — the existing session
history already connects them, so N rounds work with no new mechanism), and clarifying is encouraged even
when a sensible default exists, to converge on what the user actually wants before building.`

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

const NEGOTIATE_BLUE_SKY = `Be honest at the catalog wall — dialed UP (blue-sky mode): compose more elaborate approximations,
iterate across rounds, and use the note channel to narrate your reasoning (for example: "I considered a
Grid vs a stacked Column; going with Grid because…") — propose, and revise, before the user commits.

Before you emit, apply a two-direction composition discipline: reason TOP-DOWN from the user's goal to the
parts a UI for it needs (a card-game sheet needs a hand display, a discard pile, a score readout, an
action bar); then BOTTOM-UP from the catalog to which real primitives realize each part (a hand ≈ a Row of
Cards, a score ≈ a Grid of Text, an action bar ≈ a Row of Buttons); then RECONCILE — build every part a
primitive hosts, keep the surface minimal (add no structure the goal does not require), and for any part
the catalog cannot host, do NOT invent: fall through to the honesty floor above (name the limit in the
note, approximate within the catalog, disclose).

Calibration examples (need → parts → catalog mapping → what falls to the wall):
${BLUE_SKY_CALIBRATION_IDS.map(calibrationExampleBullet).join('\n')}`

// ---- ADR-0097 §4/§5: the feed-ask archetype vocabulary, mode-SCALED alongside the clarify/negotiate
// paragraphs above. The mechanics (HOW to emit an ask) are mode-INVARIANT — inlined into the literal
// GRAMMAR string above, so INTRO_AND_NOTE (sliced from it) carries them into every mode automatically.
// WHEN/how eagerly to reach for an ask, plus the compact archetype recipes, differ per mode — `'default'`
// gets ONLY the terse "balanced" one-liner inlined into GRAMMAR (above, after the catalog-wall paragraph);
// `'specific'`/`'blue-sky'` get their OWN disposition + the same five archetype recipes, dialed like their
// CLARIFY_*/NEGOTIATE_* neighbors. ----

const ASK_ARCHETYPES_SPECIFIC = `Feed-ask disposition — dialed DOWN (specific mode): asks stay rare (the same threshold as above) — but
when the decline-and-redirect above applies, emit it as a closed single-choice ask (a RadioGroup or
SegmentedControl of the curated options, recommended option first, one commit Button) instead of prose.
The five archetypes, for the rare case a request genuinely needs one: closed single-choice (RadioGroup or
SegmentedControl, recommended option first, preselected via the data model), multi-select (Checkboxes on
distinct data-model paths), typed-value (Field+TextField typed "number"/"currency"/"date"/"time", Calendar
for a date, Slider/SliderMulti for a bounded numeric — the value rides "sendDataModel"), boundary-
negotiation option cards (a Row(wrap) of Cards, each a CardContent Text plus a CardFooter Button naming
the option in its action "context"), and confirm/cancel (two Buttons, solid confirm first, ghost cancel
second).`

const ASK_ARCHETYPES_BLUE_SKY = `Feed-ask disposition — dialed UP (blue-sky mode): prefer a structured ask whenever the options are
enumerable, and use option cards for a negotiation (a Row(wrap) of Cards, each a CardContent Text plus a
CardFooter Button naming the option in its action "context") rather than a prose redirect. Several
structured rounds are welcome — each answer is an ordinary turn, session history already connects them.
The five archetypes: closed single-choice (RadioGroup or SegmentedControl, recommended option first,
preselected via the data model), multi-select (Checkboxes on distinct data-model paths), typed-value
(Field+TextField typed "number"/"currency"/"date"/"time", Calendar for a date, Slider/SliderMulti for a
bounded numeric — the value rides "sendDataModel"), boundary-negotiation option cards (as above), and
confirm/cancel (two Buttons, solid confirm first, ghost cancel second).`

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
