# LLD — A2UI message-lifecycle decision layer

> Refines: [`../spec/a2ui-message-lifecycle.spec.md`](../spec/a2ui-message-lifecycle.spec.md) (SPEC-R1…R5) under
> [ADR-0126](../adr/0126-a2ui-message-lifecycle-decision-layer.md) (proposed; F1/F3/F4 recorded, F2/F5 awaiting
> Kim's ruling). Build plan:
> [`../decompositions/a2ui-message-lifecycle.decomp.json`](../decompositions/a2ui-message-lifecycle.decomp.json)
> (coverage-clean, plan mode). · proposed · 2026-07-11 · designer (design intake, no component-design skill —
> teaching+demo shape)
>
> **Composes on:** the shipped renderer (`protocol.ts`/`renderer/dispatch.ts`/`renderer/renderer.ts`/
> `renderer/tree.ts` — zero edits), the shipped `system-prompt.ts` mode-axis machinery (ADR-0089/0090/0091 —
> one new insertion, no new plumbing), the shipped `a2ui-live` recorded-transcript demo (`transcript.ts`/
> `recorded-transport.ts` — new turns only, no new page/component). **No new package, no new wire type, no new
> site page.**
>
> **Freeze discipline.** §3's interface is the fan-out contract. A builder who cannot satisfy it STOPS and
> escalates — the fix is a coordinated LLD repair, never a local deviation.

## 1 · Intent

Close TKT-0016's gap between shipped mechanics and taught decision-making. This LLD pins: (a) the exact SPEC-
section anchor and the exact GRAMMAR insertion point the build edits, (b) the `a2ui-compose` skill's servicing
diff, (c) the corpus exemplar's worked shape, (d) the recorded-transcript script (turn-by-turn envelopes) the
demo plays, and (e) the test plan proving SPEC-R1…R5.

## 2 · Components

| ID | Component | File | Traces |
|---|---|---|---|
| LLD-C1 | GRAMMAR insertion — four-type choice bullets + `deleteSurface` wire shape, appended inside the existing "Output rules for the A2UI JSONL" section (the `OUTPUT_MARKER`-onward zone) | `packages/agent-ui/a2ui/tools/agent/system-prompt.ts` | SPEC-R1, R2 (ADR-0126 F2) |
| LLD-C2 | `prompt-drift`/`system-prompt-grammar` test additions asserting the new bullets + `deleteSurface` mention survive in every mode | `packages/agent-ui/a2ui/src/live-agent/system-prompt-grammar.test.ts` | SPEC-R1 |
| LLD-C3 | `a2ui-compose` mental-model widened from three kinds to four (`deleteSurface` added) + one new Common-trap entry (whole-record upsert) | `.claude/skills/a2ui-compose/SKILL.md` | SPEC-R2, R3 |
| LLD-C4 | Corpus exemplar record — the worked four-type, one-surface arc | `packages/agent-ui/a2ui/src/examples/` (new seed) + corpus import | SPEC-R4 |
| LLD-C5 | Recorded-transcript turns 3–5 — restructure / data-only / delete, continuing the shipped turn 1–2 script | `packages/agent-ui/a2ui/tools/agent/transcript.ts` | SPEC-R5 |
| LLD-C6 | `round-trip.test.ts` extension — the new turns' validity + the data-only turn's message-count assertion | `packages/agent-ui/a2ui/src/live-agent/round-trip.test.ts` | SPEC-R5 AC1, AC2 |
| LLD-C7 | `a2ui-live` demo — no code change required beyond the transcript; verify the existing `note`/JSON/HTML tabs already satisfy AC3/AC4 | `site/pages/a2ui-live.ts` (verification only) | SPEC-R5 AC3, AC4 |

## 3 · Interfaces (frozen)

### LLD-C1 — the GRAMMAR insertion (exact anchor)

`system-prompt.ts:110-130` is the `GRAMMAR` literal's existing "Output rules for the A2UI JSONL" section (the
`OUTPUT_MARKER = 'Output rules for the A2UI JSONL'` string, `system-prompt.ts:137`). Insert the new bullets
**after** the existing `updateDataModel` bullet (`system-prompt.ts:121-126`) and **before** the existing
"Make a control report back to you" bullet (`system-prompt.ts:127`), so the four-type choice rule sits alongside
the mechanics it governs, in reading order: open → restructure → react → report → close. Because the insertion
point is textually after `OUTPUT_MARKER`, it is automatically included in `OUTPUT_RULES`
(`GRAMMAR.slice(GRAMMAR.indexOf(OUTPUT_MARKER)).trim()`, `system-prompt.ts:140`) and therefore reaches
`'specific'`/`'blue-sky'` composition (`grammarFor`, `system-prompt.ts:258-270`) with zero changes to
`grammarFor` itself; `'default'`/absent mode reaches it because `grammarFor(undefined)` returns the `GRAMMAR`
literal verbatim. `assertMarkersHold()` (`system-prompt.ts:149-162`) is unaffected — neither marker string moves.

Content to add (verbatim intent, exact wording is the build seat's to finalize against SPEC-R1/R2's ACs):

```
- Choose the right message for the change: a value change on an EXISTING surface is updateDataModel alone
  (never re-emit updateComponents just because a bound value changed); a change to the SHAPE of the surface
  (a node added, removed, or whose props/children actually change) is updateComponents, same surfaceId; a
  genuinely new task in the conversation is createSurface with a FRESH surfaceId, leaving prior surfaces
  untouched; a surface whose task is done AND would confuse a later turn if left visible is deleteSurface —
  otherwise leave it in place, no message needed.
- Remove a surface the user no longer needs to see:
  {"version":"v1.0","deleteSurface":{"surfaceId":"main"}}
- Resending a component "id" in updateComponents REPLACES its ENTIRE record — include every prop that should
  still apply (not only the changed one) and the full children list; there is no partial-prop patch.
```

### LLD-C2 — test coverage for LLD-C1

Extend `system-prompt-grammar.test.ts` (the ADR-0089/0090 precedent file) with:
```ts
it('teaches the four-type message-lifecycle choice, including deleteSurface (ADR-0126 F2)', () => {
  const prompt = buildSystemPrompt(defaultCatalog, [])
  expect(prompt).toContain('deleteSurface')
  expect(prompt).toMatch(/updateDataModel alone/i)
  expect(prompt).toMatch(/FRESH surfaceId/)
  expect(prompt).toMatch(/REPLACES its ENTIRE record/)
})
it('the lifecycle teaching survives specific/blue-sky mode composition (OUTPUT_RULES zone, no new plumbing)', () => {
  for (const mode of ['specific', 'blue-sky'] as const) {
    const prompt = buildSystemPrompt(defaultCatalog, [], mode)
    expect(prompt).toContain('deleteSurface')
  }
})
```
These assert the insertion reaches every mode WITHOUT any `grammarFor` branch edit — a red result on the second
test with `grammarFor` unchanged would mean LLD-C1's anchor choice (append after `OUTPUT_MARKER`) was violated.

### LLD-C3 — `a2ui-compose` skill servicing diff

In `SKILL.md`'s "Mental model" section (currently: "An A2UI payload is an ordered stream of … messages … of
**three kinds** you compose: 1. `createSurface` … 2. `updateDataModel` … 3. `updateComponents` …"):
- Change "three kinds" → "four kinds".
- Add a 4th numbered item: **`deleteSurface`** — closes a surface (`{ surfaceId }`). Cite
  `a2ui-message-lifecycle.spec.md` SPEC-R1 rule 4 for when to reach for it vs leaving a surface in place.
- Add one line to the existing numbered "Compose" walkthrough (step 2, "Open the surface") cross-referencing
  the new SPEC for the createSurface-vs-updateDataModel-vs-updateComponents choice, rather than re-deriving it.
- Add one new bullet to "Common traps (non-obvious)": **"Resending an id replaces the WHOLE node."** —
  `updateComponents` upserts by id; omitting a previously-set prop on a resend drops it, it does not preserve
  it (SPEC-R2). Cite `renderer/tree.ts`'s `components.set(comp.id, comp)`.
- Add `a2ui-message-lifecycle.spec.md` to the References table: "the message-type decision rule (which of the
  four kinds, and when)".

### LLD-C4 — corpus exemplar worked shape

One new exemplar record (facet `'exemplar'`), `a2uiOutput` (single `surfaceId`, e.g. `"kpi-panel"`), narrating a
dashboard-KPI arc that touches all four types:

```jsonc
// 1. open — a new task boundary (SPEC-R1 rule 3)
{"version":"v1.0","createSurface":{"surfaceId":"kpi-panel","catalogId":"agent-ui"}}
{"version":"v1.0","updateComponents":{"surfaceId":"kpi-panel","components":[
  {"id":"root","component":"Grid","min":"12rem","children":["revenue"]},
  {"id":"revenue","component":"Stat","label":"Revenue","value":{"path":"/revenue"}}
]}}
{"version":"v1.0","updateDataModel":{"surfaceId":"kpi-panel","path":"/revenue","value":128000}}

// 2. restructure — a second KPI joins the grid (SPEC-R1 rule 2 / SPEC-R2: root resent WHOLE, incl. its
//    existing "min" prop, plus the new child id)
{"version":"v1.0","updateComponents":{"surfaceId":"kpi-panel","components":[
  {"id":"root","component":"Grid","min":"12rem","children":["revenue","churn"]},
  {"id":"churn","component":"Stat","label":"Churn","value":{"path":"/churn"}}
]}}
{"version":"v1.0","updateDataModel":{"surfaceId":"kpi-panel","path":"/churn","value":2.4}}

// 3. react — a data-only refresh, NO updateComponents (SPEC-R1 rule 1 / SPEC-R5 AC2)
{"version":"v1.0","updateDataModel":{"surfaceId":"kpi-panel","path":"/revenue","value":131500}}

// 4. close — the dashboard's task is superseded by the dialog moving on (SPEC-R1 rule 4)
{"version":"v1.0","deleteSurface":{"surfaceId":"kpi-panel"}}
```
`promptText` narrates the whole arc ("Show revenue and churn KPIs, update revenue live, then close the panel
once we're done reviewing it") rather than a single one-shot ask — the exact framing is the corpus-curation
follow-up's to finalize; this LLD fixes only that the `a2uiOutput` stream above is the required shape (validates
0 errors at every prefix, one `surfaceId` throughout, satisfies SPEC-R4 AC1/AC2).

### LLD-C5 — recorded-transcript turns 3–5

Continuing `transcript.ts`'s shipped `recordedTranscript.turns` (today: turn 1 = `canvas` button, turn 2 =
`confirmation` Text), append:

```ts
// Turn 3 — restructure the SAME "canvas" surface (SPEC-R1 rule 2). IMPORTANT: the seed's existing root is a
// Button (canvasButtonSeed.messages[1].updateComponents.components[0]), and the catalog gives Button NO
// children model (§5.2 — Button carries no child/children key) — a Button cannot directly host a Text child.
// So the restructure changes root's OWN type: "root" is resent as a Column wrapping the ORIGINAL Button
// (moved to a new id "btn", every one of its original props preserved verbatim — SPEC-R2 whole-record) plus
// the new "status" Text. This is a stronger illustration of SPEC-R2 than a same-type prop change: even a
// node's component TYPE can change on a resend, because the renderer's upsert-by-id has no notion of "the
// previous type" — it replaces the record wholesale (renderer/tree.ts:85).
const TURN3: A2uiServerMessage[] = [
  { version: 'v1.0', updateComponents: { surfaceId: canvasButtonSeed.surfaceId, components: [
    { id: 'root', component: 'Column', gap: 'sm', children: ['btn', 'status'] },
    { id: 'btn', component: 'Button', variant: 'solid', label: 'Click me', action: { action: 'submit' } }, // canvasButtonSeed's original root props, verbatim, now a child
    { id: 'status', component: 'Text', text: { path: '/status' } },
  ] } },
  { version: 'v1.0', updateDataModel: { surfaceId: canvasButtonSeed.surfaceId, path: '/status', value: 'Ready' } },
]
// note: 'I wrapped the button in a Column and added a status line on the SAME canvas surface — a structural
//        change (even the root's own type changed), so I used updateComponents, not a new surface.'
```
Turn 1's own `expectClientMessage` (the round-trip gate's scripted click, `sourceComponentId: 'root'`) is
unaffected by this LLD — it is asserted BEFORE turn 3 ever runs, against the ORIGINAL Button-rooted state.
Any FUTURE click assertion added against the post-turn-3 tree would need `sourceComponentId: 'btn'` (root is a
Column from turn 3 onward); this LLD's own turns 3–5 add no new `expectClientMessage`, so no such fixture exists
yet — the build seat must not accidentally clone turn 1's assertion past this point.

```ts
// Turn 4 — data-ONLY change (SPEC-R1 rule 1 / SPEC-R5 AC2): no updateComponents in this turn's lines.
const TURN4: A2uiServerMessage[] = [
  { version: 'v1.0', updateDataModel: { surfaceId: canvasButtonSeed.surfaceId, path: '/status', value: 'Clicked again' } },
]
// note: 'Just the status text changed — I updated the data model only, the button and layout are untouched.'

// Turn 5 — the "confirmation" surface's job (acknowledging turn 1's click) is superseded by turns 3-4's own
// status line now carrying that role; canvas itself stays (SPEC-R1 rule 4 / ADR-0126 F5).
const TURN5: A2uiServerMessage[] = [
  { version: 'v1.0', deleteSurface: { surfaceId: 'confirmation' } },
]
// note: 'The confirmation surface's job is done — the canvas now shows its own status line, so I closed
//        confirmation. I left canvas open; it is still the point of the conversation.'
```
Each turn's `note` is exactly the ADR-0126 F4 "annotation" mechanism SPEC-R5 AC3 needs — no new field, no new
UI. `expectClientMessage` is omitted on turns 3–5 (no scripted user interaction needed to demonstrate the arc;
turns 1–2 keep their existing round-trip assertions unchanged).

### LLD-C6 — `round-trip.test.ts` extension

Add assertions: (a) turns 3–5 validate 0 errors against the shared validator at each prefix of the stream
(the existing round-trip method, extended); (b) turn 4's `lines` contain exactly one message and it is
`updateDataModel` (SPEC-R5 AC2's literal check); (c) after turn 5, ingesting the full transcript through a fresh
`createRenderer()` leaves no DOM node for `confirmation` (a `host.mount`+ingest-all smoke, asserting
`surfaceEl.querySelector` finds no remnant of the confirmation Text) while a `canvas`-rooted node still exists
(SPEC-R5 AC4 + AC1's "left undeleted" half).

### LLD-C7 — `a2ui-live` verification (no code change expected)

Walk the shipped page against the new transcript: confirm `refreshJson`/`refreshHtml` already show the
per-turn diff (they do — both are recomputed from `allLines`/`surfaceEl.innerHTML` every turn, no page code
change needed) and that `addMessage('agent', note ?? summarize(...))` already surfaces each new turn's `note`
verbatim (it does — `a2ui-live.ts:367`). If either assumption breaks in practice, the fix is a page-scoped bug
in the *existing* mechanism, not new demo machinery — escalate rather than patch around it.

## 4 · Data shapes

No new typed contract — every shape below is an existing `protocol.ts`/`CorpusRecord` type, cited for the
build seat's convenience:
- The four server→client envelopes this LLD's turns/exemplar compose are exactly `A2uiCreateSurface` /
  `A2uiUpdateComponents` / `A2uiUpdateDataModel` / `A2uiDeleteSurface` (`protocol.ts:117-135`) — no field added.
- LLD-C4's exemplar is one `CorpusRecord` (`src/corpus/record.ts`), `meta.facet:'exemplar'`, `a2uiOutput` typed
  `A2uiOutput` (`protocol.ts:153`), single `surfaceId` throughout (SPEC-R4).
- LLD-C5's turns are `RecordedTurn` (`tools/agent/transcript.ts:28-33`: `{ lines, note?, ask?,
  expectClientMessage? }`) — turns 3–5 use only `lines`/`note`, per the existing shape.

## 5 · Risks

- **Prompt byte-growth is permanent, not scoped** (ADR-0126 F2) — LLD-C1's insertion lands in every mode's
  composed output for every future generative call; no test bounds the growth to a token budget. Mitigation:
  Kim's explicit sign-off (ADR-0126 Acceptance) before LLD-C1 ships, keeping the added bullets terse.
  Cross-checked against sibling `mini-skills.ts`'s own `PER_MODULE_TOKEN_BUDGET` precedent (~200 tokens) as an
  informal ceiling for the new bullets, though this addition is NOT a mini-skill (ADR-0126 rejects that shape).
- **Turn 3's root-type change (Button → Column) is a stronger claim than a same-type prop resend** — if a
  future reviewer or test assumes `updateComponents` can only ever resend a node AS its existing type, this
  turn falsifies that assumption on purpose (§3 LLD-C5 note). Mitigation: the note inline at LLD-C5 flags this
  explicitly so it is not mistaken for an error during build.
- **F2/F5 are still open Kim rulings** (ADR-0126) — LLD-C1's exact anchor and LLD-C5's exact delete-vs-keep
  turns assume ADR-0126's recorded recommendation. A Kim override on either fork after build has started is an
  LLD repair, not a silent rewrite (§7).
- **`system-prompt-grammar.test.ts`/`prompt-drift.test.ts` false-green risk** — because the insertion is
  additive prose, a sloppy edit could land OUTSIDE the `OUTPUT_MARKER`-onward zone (e.g. inside the
  `CLARIFY_MARKER`…`OUTPUT_MARKER` mode-scaled zone) and still pass a naive `toContain` check while silently
  failing the "no `grammarFor` edit needed" claim. LLD-C2's second test case exists specifically to catch this
  (mode-composition coverage, not just presence).

## 6 · Test plan

| Test | Proves |
|---|---|
| LLD-C2's two new `system-prompt-grammar.test.ts` cases | SPEC-R1/R2 teaching present in every mode, reached via the OUTPUT_RULES zone with no `grammarFor` edit |
| `prompt-drift.test.ts` (existing, re-run) | The insertion does not disturb the catalog-derived inventory's SET-EQUAL gate (additive prose only, no catalog-section edit) |
| A new `a2ui-compose` skill-lint / doc-reviewer pass | LLD-C3's mental-model + trap-list diff reads correctly and cites this SPEC |
| A new corpus fixture test (mirrors `examples.test.ts`) | LLD-C4's exemplar validates 0 errors at every prefix, one surfaceId throughout (SPEC-R4 AC1/AC2) |
| LLD-C6's `round-trip.test.ts` additions | SPEC-R5 AC1, AC2, AC4 |
| A manual `npm run dev` walk of `a2ui-live` with the new transcript | SPEC-R5 AC3 (visible annotation) end-to-end, human-observed |

## 7 · Open items carried to build

- Exact final GRAMMAR bullet prose (LLD-C1 gives intent + anchor, not a frozen final string — the build seat
  tunes wording against the two new test assertions).
- The exemplar's `promptText` framing (LLD-C4 flags it, corpus-curation owns the final call).
- Whether Kim's F2/F5 ruling (ADR-0126) changes the insertion point or the delete-vs-keep specifics above —
  this LLD assumes ADR-0126's recorded recommendation; a Kim override on either fork is an LLD repair, not a
  silent build-time deviation.
