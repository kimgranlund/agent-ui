# ADR-0091 — the Gen-UI mini-skill registry: a modular, on-demand-selected idiom-instruction layer composed into the prompt as one bounded block riding the shipped `fewShot` seam — degrading to empty on no match, promotable to the corpus

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-07 *(authored; ratified date set on accept)* |
> | **Proposed by** | planner (design seat — the "how do we manage mini-skills without context bloat" intake; ADR-0090's deferred-corpus follow-up arriving) |
> | **Ratified by** | — *(pending Kim; the proposed→accepted flip is Kim's, never the author's, and a plausible "Kim said so" is not a literal ratification)* |
> | **Repairs** | on ratification+build: `a2ui-live-agent.spec.md` SPEC-R6 (the derived prompt's hand-authored GRAMMAR half gains a THIRD composed segment — a per-turn-selected idiom-instruction block that degrades to empty on no match; the catalog-DERIVED inventory + `prompt-drift.test.ts` stay untouched, exactly as ADR-0088/0089/0090 grew the grammar half) · SPEC-R7 (clarified: `retrieve()` continues to condition generation with worked EXEMPLARS unchanged; mini-skills are the INSTRUCTION-shaped complement selected by a SEPARATE, registry-backed step — the two conditioning channels coexist) · `a2ui-live-agent.lld.md` LLD-C4 (`buildSystemPrompt` gains a `miniSkills` block composed like `fewShot`), LLD-C3 (`produce()` selects mini-skills once per turn beside `retrieve()`, `produce.ts:152`, feeding `buildSystemPrompt` at `:153`), LLD-C8 (a NEW standing test: the per-module token budget + per-turn cap, and `validateA2ui` over any embedded worked example) · NEW `SPEC-R#` (the mini-skill registry + selection contract) + NEW `LLD-C#` (the registry module + the `selectMiniSkills` selector) minted with the build |
> | **Supersedes / Superseded by** | Extends **ADR-0090** — 0090's *"Calibration examples & the deferred corpus question"* subsection anticipated the NEED for a curated, catalog-scoped pattern-knowledge corpus (a `/ui-patterns` analog) and explicitly DEFERRED it ("*not decided here… decide the corpus on its own merits after observing*"). This ADR picks up that deferred follow-up and decides the *mechanism*: a mini-skill registry. 0090's Decision (the mode axis) stands unchanged; a blue-sky turn still scales clarify/negotiate exactly as 0090 specifies, and now also composes selected mini-skills. · Builds on the SHIPPED `retrieve()`/`fewShot` seam (ADR-0071 grammar half, corpus LLD-C9) — reuses its degrade-to-empty discipline without touching it. · *the reciprocal `Extended by ADR-0091` back-link lands on ADR-0090 at ACCEPT time, mirroring ADR-0088/0089/0090's own deferral of reciprocal links (ADR-0090 header) — this ADR does not edit 0090.* |

## Context

Kim asked, verbatim: *"How should we manage 'mini-skills' that we make available to the gen-ui pipeline?
How does that even work in practice? Can we make a modular composable system so we don't context bloat
the more complex the system becomes?"* Three shipped facts fix what "mini-skill" *can* mean here, and one
prior ADR already anticipated this exact question.

**1 — A live model mid-generation has NO Skill-tool path. Proven, not assumed.** `produce()`'s only model
call is `deps.provider.stream({ model, system, messages, signal })` (`produce.ts:177-182`); there is no
tool-use loop that could fetch external content mid-generation the way Claude Code's own Skill mechanism
does. The model sees exactly two things: the `system` string (`produce.ts:153`) and whatever the retrieved
exemplars folded into it (`produce.ts:152`). So "mini-skill" **cannot** mean a literal Skill invocation by
the live model. It must mean a **prompt-injectable content unit** — instruction text and/or a small
calibration example — that is SELECTED and ASSEMBLED into the system prompt per turn, instead of living
permanently in one ever-growing static prompt. (This is the identical finding ADR-0090 §1 recorded when it
ruled the two-direction reasoning discipline must ride the prompt or the exemplars, "*never a Skill
invocation*.")

**2 — The prompt is already a crude module-composition system, and it already has the anti-bloat idiom.**
`buildSystemPrompt(catalog, exemplars)` (`system-prompt.ts:106-115`) composes FOUR segments today: the
hand-authored `GRAMMAR` const (`:26-73`), the catalog-derived component inventory (`:75-84`), the functions
inventory (`:86-90`), and `fewShot(exemplars)` (`:92-99`). Critically, `fewShot` **returns `''` when there
are no exemplars** (`:93`) — the prompt shrinks to zero for that segment on no match. Its feeder,
`retrieve()`, returns `[]` on an empty scope (`retrieve.ts:69`), `k<=0`, or **zero vocabulary overlap** with
the corpus (`retrieve.ts:99`). This *degrade-to-empty-on-no-match* is precisely the discipline Kim's
anti-bloat question needs — and it already exists, proven, in two places. A mini-skill layer should be one
more composed segment that obeys the same rule, not a new paradigm.

**3 — ADR-0090 already deferred exactly this as a real follow-up, and named its own vehicle sub-question.**
0090's *"Calibration examples & the deferred corpus question"* subsection shipped ~2-3 inline worked
examples in the blue-sky grammar and seeded the rest as retrievable corpus exemplars, then flagged, and
deliberately did NOT bundle, *"a curated, catalog-scoped pattern-knowledge corpus (a `/ui-patterns` analog
trimmed to A2UI's ~32 primitives, roughly 10-15 entries in the anatomy → when-it-fits → failure shape)"* —
recommending it be *"decided on its own merits after observing blue-sky against real turns."* It even named
the open vehicle question: *"mint entries as retrievable corpus exemplars (reuses the shipped `retrieve()`
path…) vs. an authoring-time knowledge pack."* **Kim's mini-skills question is that deferred follow-up
arriving.** This ADR does not restart from zero; it decides the vehicle 0090 left open.

**The bloat mechanism this must break.** ADR-0090's shipped answer is *static composition by mode*: the
~2-3 calibration examples live inline in the blue-sky grammar variant, present on every blue-sky turn. That
is fine for a handful, but it is the exact ceiling Kim names — every new idiom added inline grows the prompt
for *every* turn in that mode, unboundedly, whether or not the turn needs it. The `GRAMMAR` const is already
~964 tokens (measured: 3857 chars; the clarify+negotiate mode-scaled block alone is ~399 tokens, the
invariant spine ~566). Ten more inline idioms at ~200 tokens each would nearly double the fixed prompt on
every turn. Static-by-mode does not scale; on-demand selection does.

**The gap Kim names:** there is no modular unit for "how to compose THIS kind of surface from the catalog"
(a form, a dashboard, a settings screen), no place to add one without editing the invariant grammar, and no
selection step that keeps only the *relevant* ones in a given turn's prompt. Today it is all-or-nothing in
the `const` string.

## Decision

**Introduce a mini-skill registry: a small, hand-curated set of named, self-contained idiom-instruction
modules, SELECTED per turn by a cheap intent-match that reuses `retrieve()`'s tokenizer/cosine primitives
(NOT the `CorpusRecord` schema or its admission pipeline), and COMPOSED into the system prompt as ONE new
bounded block that mirrors `fewShot` — appended by `buildSystemPrompt`, degrading to `''` on no match,
capped at N modules per turn under a per-module token budget. Worked EXEMPLARS keep riding the shipped
`retrieve()`/corpus path unchanged; mini-skills are the instruction-shaped complement. When the registry
outgrows hand-curation, it is promoted into corpus records behind the same selection interface — a stated
upgrade trigger, not a rewrite.** Five clauses; they are ONE decision because each bounds the others — the
unit (§1) fixes what is selected, selection (§2) fixes how, the composition seam + budget (§3) fixes the
anti-bloat guarantee, curation (§4) fixes who authors, and the upgrade trigger (§5) fixes when the cheap v1
graduates to the corpus. Ratify all five knowingly.

### 1. What a mini-skill IS — a named, prompt-injectable idiom-instruction module.

A **mini-skill** is a named, self-contained content unit scoped to ONE composition need — a UI idiom family
(a form, a dashboard/KPI grid, a settings screen, a master-detail split, a card-game sheet, a
list-and-filter, a modal-confirm, an app shell). Concretely, one registry entry:

```ts
interface MiniSkill {
  id: string            // stable, kebab — e.g. 'settings-screen', 'dashboard-kpi-grid'
  triggers: string      // the intent vocabulary this idiom answers (matched against the user's turn)
  body: string          // the idiom instruction: anatomy → catalog mapping → wall (ADR-0090's shape),
                         //   optionally with ONE tight inline worked line; ≤ the per-module budget (§3)
}
```

The `body` carries the *catalog-specific* knowledge a general model cannot have about this 32-component
catalog: *which real primitives realize each part of this idiom, and where the walls are* — the same
`need → parts → catalog mapping → what falls to the wall` shape ADR-0090's five calibration examples already
use (e.g. "*a settings screen = `Card` › `CardContent` › `List` of `Field` each wrapping a
`Switch`/`Select`/`TextField`; `CardFooter` › `Button`; wall: none*"). ADR-0090's five calibration examples
ARE the first five mini-skills, viewed at their general maturity; this ADR gives them a modular home and a
selection step instead of an inline-in-one-mode home.

**One deliberate scoping line.** A mini-skill of the INSTRUCTION shape (idiom prose, no worked A2UI output)
does not fit the corpus `CorpusRecord`, because an exemplar record *requires* `a2uiOutput`
(`record.ts:30,119-121`) and retrieval is hard-scoped to `facet === 'exemplar'` (`retrieve.ts:62-68`). That
is exactly why instruction modules need their own tiny home (§2) and are not simply more corpus rows at v1 —
worked examples already have a corpus home (ADR-0090); instruction idioms do not. This split is the whole
reason the registry exists rather than "add more exemplars."

### 2. How selection works — a static registry + a cheap intent-match, degrading to empty.

Mini-skills live in a plain committed TypeScript registry module (a `MiniSkill[]` near `system-prompt.ts`),
NOT the corpus. A `selectMiniSkills(intent, registry, cap)` function tokenizes each module's `triggers`
field and the user's turn text and ranks by TF-IDF cosine — **reusing `retrieve.ts`'s `tokenize`/term-count/
cosine primitives** (extract them to a shared local util; the math is proven), but over the registry, not
`CorpusRecord`s. It returns the top-`cap` modules whose score clears a floor, and — mirroring
`retrieve.ts:99`'s zero-vocabulary rule and `fewShot`'s empty return (`system-prompt.ts:93`) — **returns
`[]` when the turn shares no idiom vocabulary with any module.** Graceful degradation to zero-included is
the default, not an error path.

The selection runs ONCE per turn, in `produce()`, right beside `retrieve()` (`produce.ts:152`) and feeds
`buildSystemPrompt` at `:153` — the same pre-loop position. This is deliberate and mechanically grounded:
`produce()` builds `system` ONCE, OUTSIDE the round loop; the loop (`produce.ts:174-216`) varies only
`messages` (via `messagesFor`, `:73-84`), never rebuilds `system`. So mini-skill selection belongs at the
one point the prompt is composed, alongside exemplar retrieval — not per round (see *Alternatives*, option c).

### 3. Composition + the anti-bloat budget — one bounded block, capped and per-module-budgeted.

`buildSystemPrompt(catalog, exemplars, /* +mode per 0090 */, miniSkills)` gains ONE new composed segment —
a `miniSkills(selected)` helper built as a structural twin of `fewShot` (`system-prompt.ts:92-99`): it
returns `''` for an empty selection and otherwise renders the selected `body`s under a header (e.g.
`## Composition idioms (matched to your request)`). It touches ONLY the hand-authored grammar half — the
catalog-derived inventory sections and `prompt-drift.test.ts`'s SET-EQUAL assertions are untouched (ADR-0071
permits grammar-half growth; ADR-0088/0089/0090 all grew it the same way).

**The concrete anti-bloat discipline (Kim's core ask), grounded in the measured baseline:**

- **Per-module budget: ≤ ~200 tokens** (a tight anatomy → mapping → wall, at most one inline worked line).
  Grounded: ADR-0090's calibration example #2 is ~4 lines ≈ ~120 tokens; the whole `GRAMMAR` const is
  ~964 tokens. A module over budget is a curation defect, gated (§4).
- **Per-turn cap: N = 3 active modules**, matching the shipped exemplar default (`k = opts.k ?? 3`,
  `produce.ts:150`) and ADR-0090's "~2-3 inline". Worst case the block adds ~600 tokens — on par with the
  entire mode-scaled block (~399 tokens) — and only when three idioms genuinely match.
- **The guarantee:** the prompt grows by **at most `cap × per-module-budget` regardless of registry size**.
  A 50-module registry and a 5-module registry produce the same worst-case per-turn cost, because selection
  is top-`cap` bounded and degrades to zero on no match. *This is the answer to "so we don't context bloat
  the more complex the system becomes":* complexity accretes in the registry (unbudgeted, off the hot path),
  never in the per-turn prompt (hard-capped).

### 4. Authoring & curation — hand-curation + the doc-reviewer seat; no admission pipeline at v1 scale.

At the realistic v1 scale, hand-curation is correct and an admission-gate-like pipeline is over-engineering.
**How many idioms does a ~32-component catalog actually support before diminishing returns?** Reasoning
concretely from the catalog (ADR-0090's list), the genuinely distinct surface archetypes are roughly: form
/ sign-up · settings screen · dashboard/KPI grid · master-detail split · card-game/collection sheet ·
list-and-filter · modal-confirm · profile/detail card · app-shell (nav+content) · wizard/multi-step (Tabs) ·
empty-state · the data-table-via-Grid wall case. That is **~10-15 distinct idioms**; further "idioms" become
minor variants. This independently converges with ADR-0090's own estimate ("*roughly 10-15 entries*") — a
good sign the number is real. At that scale:

- Each mini-skill is hand-authored and reviewed by the `doc-reviewer` seat (generator ≠ critic) — the SAME
  discipline the corpus quality rubric already uses (it is a DOCUMENT scored by the `a2ui-reviewer` critic,
  `judge.ts:1-8`), not a code gate.
- The admission pipeline (`admit.ts`: heal → schema → facet gate → pin → tier-1 validate → pointer → leak →
  hash → dedup → tier-2, `admit.ts:1-9`) exists to safely ingest **mined/distilled records at volume**
  (`record.ts:20`, `ProvenanceSource` includes `'mined'`). Hand-authored idiom prose at ~15-entry scale
  needs no dedup, no MinHash leak-gate, no canonical hash. Adding a record type to that pipeline now is cost
  without benefit.
- **The one gate a mini-skill DOES owe even at v1:** if its `body` embeds worked A2UI JSONL, that JSONL MUST
  pass `validateA2ui` under a standing test — the same standing-validity discipline ADR-0090 puts on the
  Structural transcript and on corpus exemplars (`examples.test.ts`/`round-trip.test.ts` precedent). A
  pure-prose module gets doc-review only.

### 5. The upgrade trigger — promote the registry into corpus records, behind the same selection interface.

The cheap v1 is deliberately chosen NOT to foreclose the richer form. The `selectMiniSkills(intent) →
MiniSkill[]` interface is the stable seam; only its backing store changes on upgrade. **Promote the registry
into corpus records (a new `facet` on `CorpusRecord`, retrieved via `retrieve()`, admitted via `admit.ts`)
when EITHER concrete threshold trips:**

- **the hand-curated registry exceeds ~15-20 modules** (past the catalog's natural idiom count — curation
  stops being tractable and volume/dedup start to matter), **OR**
- **a mini-skill needs per-turn quality gating** — i.e., authored modules begin shipping idioms a reviewer
  would have caught, so the tier-2 judge seam (`admit.ts:46-61`, `judge.ts`) earns its schema-extension cost.

Only at that point is the corpus schema extension worth it: a third `Facet` value (`record.ts:18`), relaxing
the `a2uiOutput`-required-for-exemplar rule (`record.ts:119-121`) for instruction-facet records, a tier-1
skip for facets with no `a2uiOutput` (`admit.ts`), and teaching `retrieve()` to scope a second facet
(`retrieve.ts:62-68`). Naming the trigger concretely (not "if it gets complex") is the point: v1 stays
cheap, and the graduation is a store swap behind an unchanged interface, not a redesign.

## Open fork (Kim's call) — and the re-verify points it is *not*

**There is no genuine values-level fork here.** The reasoning yields one clearly-best v1 (a static registry
+ cheap intent-match), and this session has already corrected two over-forked ADRs, so I state it as a
settled recommendation rather than manufacturing a choice. The candidate forks all collapse under scrutiny:

- *"Registry (v1) vs. extend `retrieve()`/the corpus now"* is **not a fork** — it is the v1-vs-upgrade axis
  §5 already resolves with a concrete trigger. Instruction modules don't fit the exemplar schema (§1), so
  "just add exemplars" cannot host them without the extension the trigger defers.
- *"Bundle the worked example into the registry vs. keep examples in the corpus"* is **not a fork** — the
  selection interface is identical either way, so it is a build detail settled by §5's store-swap, not a
  values trade-off. v1 keeps worked examples in the corpus (reuse the shipped `retrieve()`) and idiom
  instructions in the registry.

**Build-time re-verify (NOT Kim's call), matching ADR-0090's shape:**

- **Whether the dev switcher exposes mini-skill selection** for demo legibility (a debug readout of "which
  idioms matched this turn"), mirroring 0090's mode selector. The seam supports it; whether the demo shows
  it is settled by building it, like 0090's selector-exposure re-verify.
- **The exact per-module budget, the cap N, and the selection score floor** — tuned against real turns, the
  same class of build-tuning as 0090's per-mode wording. ~200 tokens / cap 3 / a small floor are the
  indicative starting values.
- **The initial registry contents** — ADR-0090's five calibration examples are the seed set; which of the
  ~10-15 idioms to author first is curation sequencing, not a decision.

## Consequences

- **The system can grow idioms without growing the per-turn prompt.** Complexity moves off the hot path into
  a registry that selection bounds; the per-turn prompt is hard-capped at `cap × budget` no matter how large
  the registry gets. This is the direct answer to Kim's anti-bloat question, and it reuses the
  degrade-to-empty discipline already proven in `fewShot`/`retrieve` (`system-prompt.ts:93`,
  `retrieve.ts:99`).
- **Zero new wire/transport/protocol surface; the drift gate is untouched.** The registry is a committed TS
  module; selection is a pure function; composition is one more grammar-half segment. `AgentTransport`, the
  meta-line shape, `produce()`'s peel/validate/stream, the reducer, and `prompt-drift.test.ts`'s
  catalog-derived assertions are all exactly as ADR-0088/0089/0090 leave them.
- **Cheap because the seam was already paid for.** Like ADR-0090, this rides infrastructure already built:
  the four-segment composer (`buildSystemPrompt`), `retrieve()`'s tokenizer/cosine, and the empty-return
  idiom. The new code is a registry, a `selectMiniSkills`, and a `miniSkills` composer twin of `fewShot`.
- **Honest costs / new behavior to enumerate in the LLD:**
  - **A second selection path, even if it shares the tokenizer.** `selectMiniSkills` is not free — it is a
    second ranking call per turn. Mitigation: extract `retrieve.ts`'s tokenize/cosine to a shared util so
    there is ONE implementation of the math; the registry is tiny (~15 entries) so the cost is negligible.
  - **Selection quality is ungated at runtime (ADR-0070).** Whether the *right* idiom is matched to a turn
    is live-prompt behavior, caught by observation, not a test — the same ungated-quality reality ADR-0090
    accepts for per-mode disposition. The budget/cap and the embedded-example `validateA2ui` gate ARE
    testable; "did the best idiom win" is not.
  - **A wrongly-matched mini-skill injects mildly off-target guidance.** A settings-screen idiom surfacing
    on a dashboard turn wastes ~200 tokens and nudges slightly wrong. Bounded by the cap and the score
    floor; the honesty floor (ADR-0090 §2) still holds — a mini-skill can NEVER license an uncatalogued
    type, it only suggests composition of existing ones. Worst case is mild misdirection, never a security
    or validity breach (the shared validator still gates every emitted line, `produce.ts:206`).
  - **Two knowledge homes to keep coherent.** Worked examples live in the corpus; idiom instructions live in
    the registry. A future editor must know which is which. §5's upgrade unifies them; until then the split
    is the cost of not paying the schema extension early.
- **Stale → re-verify on the build gate:** the per-module budget + cap gate (a new standing test) · the
  embedded-example `validateA2ui` gate · the selection score floor (tune against real turns) · whether the
  registry has crossed the §5 promotion trigger (revisit on each idiom added past ~15) · whether the demo
  switcher should expose matched idioms (try without first).

## Alternatives considered

- **Extend `retrieve()` + the corpus to also carry instruction modules NOW (option a).** Rejected for v1,
  deferred to §5's trigger. It forces a real schema extension immediately: a third `Facet` (`record.ts:18`),
  relaxing the `a2uiOutput`-required rule (`record.ts:119-121`), a tier-1 skip in `admit.ts` for facets with
  no A2UI output, and a second retrieval scope (`retrieve.ts:62-68`). ADR-0090 itself flagged this vehicle as
  "*honestly-sized curation work… not a small v1 item.*" Correct eventually (§5), wrong as the first step —
  it pays a volume-ingestion pipeline's cost for ~15 hand-authored prose entries.
- **A cheap separate classification/routing step tagging intent → static registry lookup (option b).**
  ADOPTED — this IS the Decision. Chosen over (a) because instruction modules don't fit the exemplar schema
  and the registry hosts both prose and prose-with-example uniformly; chosen over (d) because it scales past
  a handful. It reuses `retrieve()`'s math without its schema, and its interface is the upgrade seam to (a).
- **Round-based lazy escalation — inject a mini-skill only into a later self-correct round on a gap (option
  c).** Rejected on TWO grounds, both mechanical. (i) `produce()` builds `system` ONCE at `produce.ts:153`,
  OUTSIDE the loop; the loop varies only `messages` (`produce.ts:174-216` via `messagesFor`), so escalating
  a mini-skill INTO the system prompt per round is not possible today without moving `buildSystemPrompt`
  inside the loop. (ii) Even via the `messages` channel, the only per-round signal is the validator's
  structured SCHEMA/CATALOG failures (`produce.ts:215`) — which detect an *invalid* payload, never a "you
  built the wrong idiom" quality gap (composition quality is ungated at runtime, ADR-0070). So (c) both
  fights the seam and lacks the trigger signal it would need. The natural seam is once-per-turn selection
  (option b), beside `retrieve()`.
- **Static composition entirely by `GenUiMode` — more inline idioms in the mode-scaled block (option d).**
  Rejected: this is precisely the CURRENT state (ADR-0090's ~2-3 inline calibration examples) and the ceiling
  Kim's question names. Every idiom added inline grows the prompt on every turn in that mode, unboundedly. It
  does not scale, and "so we don't context bloat as the system grows" is exactly what it fails at.
- **Amend ADR-0090 in place** (append a `## Amendment`) rather than a new ADR. Rejected by the log's own
  amendment-vs-supersession test (`README.md` §"Amendment vs supersession"): an amendment lands "an extension
  the decision **already anticipated**" while leaving its Decision untouched. 0090's mode-axis Decision does
  not anticipate a *registry+selection mechanism* — it anticipated the NEED (the deferred corpus) but
  explicitly did NOT decide a vehicle and named the vehicle "*a sub-question.*" Deciding the vehicle is a
  SEPARATE, new decision built on 0090, with 0090's Decision left standing (a blue-sky turn still scales
  clarify/negotiate AND now composes selected mini-skills) → the log's **Extension** case (new ADR, two-way
  `Extends`/`Extended by` link), exactly as 0090 extends 0089 extends 0088.
- **Supersede ADR-0090.** Rejected: nothing in 0090 is reversed. The mode axis stands; mini-skills compose
  alongside it. A decision preserved intact is extended, not superseded.
- **A full PRD→SPEC→LLD family / a mined-corpus build now.** Rejected as premature: this is a design-record
  decision matching the ADR-0088/0089/0090 shape (a `proposed` record + a build-sequencing note), and the
  richer corpus vehicle is §5's observation-gated upgrade, not this decision.

## Out of scope (this ADR)

- **Any widening of the render-time security allowlist (SPEC-R9), in any form.** A mini-skill suggests
  composing EXISTING catalog components; it can NEVER license an uncatalogued type. The ADR-0090 §2 honesty
  floor is invariant and the shared validator still gates every emitted line (`produce.ts:206`).
- **The corpus schema extension itself.** §5 names the trigger and sketches the extension; building it is a
  future ADR/decomposition when the trigger trips, not this decision.
- **Per-turn selection quality as a runtime gate.** Runtime quality stays ungated (ADR-0070); only the
  budget/cap and embedded-example validity are tested.
- **A new LLM capability** — no tool use, no second model call, no Skill invocation (proven impossible,
  Context §1). Mini-skills are prompt-composition only.
- **Multi-turn plan state / a dialog tree.** As in ADR-0088/0089/0090: selection is per-turn and stateless;
  there is no agent-held plan object.

## Acceptance

*(Predicates for the eventual build, if ratified — not run here; this is a design record. All assume
ADR-0088/0089 built, and compose with ADR-0090 if that is built.)*

- `selectMiniSkills(intent, registry, cap)` returns `[]` for a turn sharing no idiom vocabulary with any
  module (mirroring `retrieve.ts:99`) and the top-`cap` matches otherwise — a deterministic unit test,
  `npm test` green, no live model.
- `buildSystemPrompt(catalog, [], /* mode */, [])` is byte-identical to the no-mini-skill prompt (the block
  is `''` on empty, like `fewShot`), and with a non-empty selection appends the `## Composition idioms`
  header + the selected bodies — a standing `system-prompt-grammar.test.ts` assertion; `prompt-drift.test.ts`
  stays green.
- A standing test asserts every registry `body` is ≤ the per-module token budget and no turn composes more
  than `cap` modules; any `body` embedding A2UI JSONL passes `validateA2ui`.
- A read confirms selection runs once per turn at `produce.ts:152` (beside `retrieve()`), the loop still
  builds `system` once, and no path renders/admits an uncatalogued type as a result of any mini-skill.

## Build-sequencing note (indicative size, if ratified — a full decomposition is a follow-up)

**Depends on ADR-0088/0089 built; composes with ADR-0090 (the `mode` parameter) if that lands first — the
`miniSkills` block is additive and orthogonal to the mode-scaled block.** Given that, ADR-0091 is small —
roughly, smallest→largest (a finalized two-plane decomposition manifest, coverage-clean at PLAN mode, backs
this if commissioned):

1. **Extract the shared tokenizer/cosine util** (tiny): lift `tokenize`/term-count/cosine out of
   `retrieve.ts` into a shared local module so there is ONE implementation; `retrieve()` re-imports it,
   behavior unchanged (assert `retrieve.test.ts` still green). Types-only + refactor; `npm run check`.
2. **The `MiniSkill` type + registry module** (new, small): the interface (§1) + the seed registry (ADR-0090's
   five calibration examples as the first entries). Committed data; a standing budget/cap + embedded-example
   `validateA2ui` test (LLD-C8 sibling).
3. **`selectMiniSkills`** (`tools/agent/`, new — a NEW `LLD-C#`): TF-IDF top-`cap` over the registry via the
   §1 util, degrade-to-`[]` on no match. Unit-tested.
4. **`buildSystemPrompt` gains the `miniSkills` block** (`system-prompt.ts`, LLD-C4): a `fewShot` twin —
   `''` on empty, header + bodies otherwise. Assert empty byte-identity + non-empty shape in
   `system-prompt-grammar.test.ts`; `prompt-drift.test.ts` unaffected (asserted). **The bulk of the change.**
5. **`produce()` selects mini-skills once per turn** (`produce.ts`, LLD-C3): call `selectMiniSkills` beside
   `retrieve()` at `:152`, pass the result to `buildSystemPrompt` at `:153`; absent/empty ⇒ no block.
   Extends `produce-loop.test.ts`.
6. **(re-verify, not a build step) demo switcher matched-idiom readout** (`provider-switcher.ts`, LLD-C12,
   `check:site`): only if the demo re-verify (Open fork) decides to show it.
7. **SPEC/LLD repairs** (SPEC-R6/R7, LLD-C3/C4/C8, + the new `SPEC-R#`/`LLD-C#`) landed with the build, per
   this ADR's `Repairs:`; `trace_check.py` green.

The heaviest slice is (4) the composition block; (1)/(3) are small and reuse proven math; (5) mirrors the
`retrieve()` wiring already at `produce.ts:152`. Deliberately a cheap layer — the composer, the tokenizer,
and the degrade-to-empty idiom were all already paid for by ADR-0071/0088/0089/0090 and the corpus wave.
