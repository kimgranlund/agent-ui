# ADR-0097 — feed-embedded interactive A2UI asks: the ADR-0089 ASK becomes a small inline surface in the chat message — an `ask` routing field on the ADR-0088 meta envelope, a per-message frozen-history lifecycle, and a gate-encoded feed sub-catalog

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-07 *(authored; ratified date set on accept)* |
> | **Proposed by** | planner (design seat — Kim's feed-embedded-asks intake following ADR-0088/0089/0090) |
> | **Ratified by** | — *(pending Kim; a hook enforces proposed→accepted is Kim's, never the author's)* |
> | **Repairs** | on ratification+build: `a2ui-live-agent.spec.md` — NEW **SPEC-R14** (feed-embedded ask surfaces: wire + lifecycle + degrade) · NEW **SPEC-R15** (the feed sub-catalog partition gate) · **SPEC-R5** (the meta envelope gains `ask`; the ask payload rides the SAME validated stream) · **SPEC-R6** (the GRAMMAR half gains the ask-mechanics spine + mode-scaled archetype vocabulary + a derived feed-allowed inventory; AC3's historical "pre-ADR-0090 byte-for-byte" wording re-based to "the literal `GRAMMAR` constant") · **SPEC-R8** (the structured answer is the existing `action` arm + `sendDataModel`; freeze semantics) · §2 Definitions + §5 typed contracts · `a2ui-live-agent.lld.md` — **LLD-C2** (`RecordedTurn.ask`) · **LLD-C3** (`produce()` ask peel/compose + the feed-scope gate) · **LLD-C4** (mechanics/archetype composition) · **LLD-C9** (page ask registry/routing/freeze/reset) · NEW **LLD-C14** (the feed-catalog artifact + partition gate) · §4 (state-machine ask arc) · §6 (four new edge rows) |
> | **Supersedes / Superseded by** | Extends **ADR-0088** — the meta envelope gains an additive, versionless `ask` field; the note/trace/`wantResponse` decision stands unchanged. · Extends **ADR-0089** — the clarify/negotiate ASK gains a structured surface form; the note-only prose ask remains the shape's own degrade path, so 0089's decision stands. This lifts nothing out of 0089's Out of scope (no dialog tree, no allowlist widening). · Extends **ADR-0090** — the ask vocabulary joins the mode-scaled block; the honesty floor and default-mode byte-identity discipline are untouched. · Relates ADR-0087 (the gate-encoded-partition pattern, reapplied to a SUBSET view — the default catalog's whole-fleet scope is NOT reversed) · ADR-0011/0054 (the action shape + submit gate, consumed unchanged) · ADR-0093 (Calendar `mode="range"` is component-shipped but NOT in the catalog row — its row edit is 0093's own named follow-up; date-range asks wait on it) · *reciprocal `Extended by ADR-0097` back-links land on 0088/0089/0090 at ACCEPT time, per the 0088/0089/0090 precedent.* |

## Context

ADR-0089 taught the live agent to ASK — but its asks are **prose the user must answer by typing**. A
clarify turn ("Better in what way — layout, more fields, or something else?") and a boundary negotiation
("I can approximate a data table with a Grid of Rows and Text — want me to?") are note-only turns
(`system-prompt.ts:69-85`); the user answers by composing a sentence. For questions whose answers are a
**closed set or a typed value** — pick one of three, choose a date, confirm/cancel — prose is the wrong
input surface: the model already knows the options, and the platform already ships the controls. Kim's
directive: make those asks clickable structured UI inline in the chat feed.

Four verified facts bound the design:

- **The wire has a conversational side-channel, but it is text-only.** The ADR-0088 meta envelope is
  `{ a2uiMeta: { note?, trace? } }` (`meta-line.ts:42-47`); `readMetaLine` reconstructs exactly those two
  fields and **drops unknown keys** (`meta-line.ts:56-74`) — so the envelope is additively extensible by
  construction: an old reader given a new field sees only the note. The A2UI payload itself flows on the
  same `AsyncIterable<string>` stream, fully validated before any line streams (`produce.ts:223-229`),
  and the protocol already supports **many surfaces per stream** — `createSurface` per `surfaceId`, one
  `SurfaceTree` each (`renderer.ts:127-131`). What does NOT exist is any way to say *where* a surface
  renders: the renderer's `mount()` is host-global — every surface root appends under the ONE mount
  element (`renderer.ts:180-183`, `:402-408`), and the page mounts exactly one host on the canvas
  (`a2ui-live.ts:171`). A feed ask needs a per-message target the protocol deliberately does not model.
- **The answer round-trip already generalizes per-surface — no extension needed.** An emitted action
  carries its `surfaceId`, `context`, and — when the surface was created with `sendDataModel: true` —
  the **whole surface data model** (`action.ts:107`); `frameClientMessage` already folds all three into
  the next user turn (`session.ts:26-42`), and `shouldRunTurn` routes it (`session.ts:68-71`). A small
  ask surface whose controls two-way-bind into its own data model, committed by one Button, ships its
  typed answers back through machinery that is entirely shipped.
- **Nothing bounds what a surface may host.** The only render gate is the SPEC-R9 catalog allowlist —
  all **34 types** of `catalog.json`, including `Modal`, `Tabs`, `Menu`, `Popover`, `Grid`. A feed
  message hosting a Modal or a dashboard is valid A2UI today. ADR-0087's lesson applies directly: a
  hand-frozen "don't do that" list drifts silently; the four uncatalogued controls it found got in
  because **the gate could not see the partition**. Any feed restriction must be a gate-encoded,
  CI-visible artifact whose check derives from `catalog.json`, so every FUTURE catalog type is forced to
  a disposition. (Verified while grounding this: the catalog's `Calendar` row carries **no `mode` prop**
  — ADR-0093's range mode is component-shipped but not agent-reachable; its catalog row edit is 0093's
  own named follow-up, so date-RANGE asks are out of reach until it lands.)
- **History must not lie.** The chat log is an append-only record (`a2ui-live.ts:73-83`); a live control
  embedded in an old message breaks that — an ask answered three turns ago must not still be clickable,
  and an ask the user answered by typing must not sit there looking unanswered. Today's page has no
  per-message interactivity to manage; feed asks make message lifecycle a first-class concern.

## Decision

**Give the ADR-0089 ASK a structured, feed-embedded surface form — five coupled clauses.** They are ONE
decision because each bounds the others: the wire routing (§1) is what the lifecycle (§2) manages and
the sub-catalog (§3) restricts; the prompt (§4) teaches emitting §1-shaped payloads inside §3's
allowlist; the degrade rule (§5) is what lets §1 ride the existing channel without a protocol break.
Bundled as ADR-0088/0090 bundled their coupled clauses; ratify all five knowingly.

### 1. The wire — an `ask` routing field on the meta envelope; the ask payload rides the SAME validated stream.

The meta envelope gains one additive field: `{ "a2uiMeta": { "note": "…", "ask": { "surfaceId":
"ask-1" } } }`. The ask's UI is **ordinary A2UI** — `createSurface`/`updateComponents`/
`updateDataModel` targeting that fresh `surfaceId`, emitted on the same stream, validated by the same
shared `validateA2ui` before anything streams (SPEC-R5 untouched). The meta-line stays versionless and
provably disjoint from `A2uiServerMessage`; `AgentTransport.turn`'s signature stays byte-identical —
the ADR-0088 discipline, extended not re-decided.

- **The model authors `ask`** on its leading meta-line (as it authors `note` today); `produce()` peels
  it, and re-composes the outgoing meta-line as `{note, ask, trace}` (`formatMetaLine` gains the field).
- **Ask integrity is a produce-layer check, not a protocol change.** The `ask.surfaceId` ↔ payload
  correlation is invisible to the shared validator (deliberately — no protocol fork). `produce()`
  verifies it: an `ask` declaring a surface **no payload line creates**, or colliding with a
  session-known surface id, is **dropped from the outgoing meta-line** — the note stands, the turn
  degrades to ADR-0089's prose ask. Never a halt, never a broken stream.
- **The answer travels back on shipped machinery.** The ask surface is created with
  `sendDataModel: true`; its one commit Button's action (with `wantResponse` omitted — absent runs a
  turn, the ADR-0088 §3 default) carries `surfaceId` + `context` + the data model (`action.ts:107`)
  into `frameClientMessage` → the next turn. **Zero session/reducer/transport change.**
- **Recorded-transport parity (SPEC-R5/N4).** `RecordedTurn` gains `ask?: { surfaceId }`
  (`transcript.ts:23-27`); `createRecordedTransport` composes the same meta-line shape `produce()`
  emits (`recorded-transport.ts:16-17`). The shipped transcript is NOT seeded with a scripted ask —
  ADR-0089's open backbone-seed fork stands, unchanged, now covering asks too if Kim ever takes it.

### 2. Per-message lifecycle — one renderer host per ask; pending → frozen; the browser owns it.

The page (LLD-C9), on reading `meta.ask`, mounts a **fresh `createRenderer()` host into that turn's
message bubble** and routes each A2UI line by its parsed `surfaceId`: the ask's id → the ask host;
everything else → the canvas host, exactly as today. No renderer/package change — per-ask hosts are a
page pattern over the existing seam (`mount()` stays host-global; each ask gets its own).

- **States: `pending` → `frozen(answered | bypassed)`.** Answered: the ask's commit action arrives →
  freeze, annotate, then run the turn. Bypassed: the user types a prose reply, or any other turn
  dispatches → every still-pending ask freezes as "answered in prose / moved past". **Freeze fires on
  turn DISPATCH** — a `wantResponse: false` silent apply runs no turn and freezes nothing. Corollary:
  with one ask per turn (§4) and freeze-on-dispatch, **at most ONE ask is ever pending** — the
  lifecycle stays a scalar, not a queue.
- **Freeze mechanism: bubble-level `inert` + `data-state` + an annotation line.** `inert` kills
  interaction and tab order platform-wide; the DOM stays visible as history. The frozen ask is NOT
  disposed (`dispose()` (`renderer.ts:216`) removes the rendered root via `#teardownSurfaceDom` (`renderer.ts:411-417`) — and history must stay
  visible). Lines a later turn aims at a frozen ask's `surfaceId` are **dropped and counted**, never
  ingested — an old ask is closed, by construction.
- **Reset** (`a2ui-live.ts:312-328`) disposes every ask host and clears the registry alongside the
  existing canvas dispose. A `ProduceHalt`/transport error leaves a pending ask pending — still
  answerable; the failed turn changed nothing.
- **Truthful record, honest cost:** `inert` removes frozen controls from the accessibility tree. The
  accessible record is the note (a normal chat message) plus the user's answer entry
  (`describeClientMessage` — `a2ui-live.ts:191-195`); the frozen widget is visual history. Stated as a
  cost, not hidden (see Consequences).

### 3. The feed sub-catalog — a gate-encoded TOTAL PARTITION of the catalog (the ADR-0087 lesson, reapplied).

A feed ask may host **choice controls, value inputs, one commit affordance, and light structure —
nothing that overlays, paginates, or dashboards.** The artifact: `tools/agent/feed-catalog.ts` exports
`FEED_SURFACE_TYPES` (23) and `FEED_EXCLUDED` (11, each entry carrying a recorded reason) — pure,
zero-dep, the single source every enforcement point derives from.

- **IN (23):** `Text · Icon · Row · Column · Card · CardHeader · CardContent · CardFooter · Field ·
  FormProvider · Button · Checkbox · RadioGroup · Radio · SegmentedControl · Segment · Select · Option ·
  ComboBox · TextField · Calendar · Slider · SliderMulti`. (`FormProvider` is deliberate: it is the
  `submitGate` factory — `factories.ts:200-205` — so a required-value ask gets ADR-0054 validation
  gating on its commit Button for free.)
- **OUT (11), reasons recorded in the artifact:** `Modal` (a focus-stealing overlay inside a bubble —
  the ask IS the interruption) · `Tabs`/`Tab`/`TabPanel` (multi-view structure contradicts
  single-purpose; hides half the ask) · `Menu`/`MenuItem`, `Popover`, `Tooltip` (disclosure/hover
  overlays; an ask must be fully visible and operable inline; overlay panels escape the bubble's box) ·
  `List` (homogeneous-collection semantics signal canvas-scale content; `Column` hosts stacked options)
  · `Grid` (the auto-fit dashboard track model — the "elaborate dashboard" this clause exists to ban) ·
  `Switch` (an immediate-effect idiom; asks are commit-gated, so `Checkbox` is the honest boolean — a
  Switch would imply an effect that has not happened).
- **The gate (NEW LLD-C14):** a standing test asserts `FEED_SURFACE_TYPES ∪ FEED_EXCLUDED =
  Object.keys(catalog.components)` **exactly and disjointly**, asserts composite closure (parent in ⇔
  child in: RadioGroup/Radio, SegmentedControl/Segment, Select+ComboBox/Option, Card/its three
  sub-types, Tabs/Tab+TabPanel, Menu/MenuItem), and carries a negative control proving an
  undispositioned type FAILS. A future catalog type turns CI red until someone writes its disposition —
  the exact drift ADR-0087's hand-frozen list could not see. **SPEC-R9 is untouched:** the full catalog
  remains the render-security allowlist; the feed set is a stricter POLICY view over it, never a second
  catalog.
- **Three enforcement points, one source:** (a) **prompt-build** — the mechanics block's feed-allowed
  list is composed FROM the set at composition time (drift impossible by construction, the
  `catalogInventory` discipline); (b) **producer** — `produce()`, AFTER the shared validator passes,
  checks the ask-routed surface's component types against the set; a violation feeds back a correction
  round (the `TurnTrace.failureCodes: string[]` seam carries a produce-layer `'FEED_SCOPE'` literal —
  no `ErrorCode` union change, no package edit) — self-correct, never a stream; (c) **page** —
  fail-closed defense in depth: an out-of-scope type on an ask-routed line drops the WHOLE ask to the
  note, never a partial render.

### 4. Prompt teaching — mechanics in the invariant spine; archetype vocabulary in the mode-scaled block; NOT mini-skills.

- **The invariant mechanics block** (beside the note-line instruction, present identically in every
  mode): how to emit a feed ask — the meta `ask` field · a fresh `ask-<n>` surfaceId ·
  `sendDataModel: true` · exactly ONE commit Button (`wantResponse` omitted) · the payload is the ask
  surface ONLY (no canvas change in the same turn — mirrors 0089's "emit ONLY the note line"
  discipline) · at most one ask per turn · the **note-standalone rule**: the note must carry the full
  question in prose, because the note is the ask's own degrade path (§5) · the derived feed-allowed
  type list (composed from `FEED_SURFACE_TYPES`).
- **Five archetypes**, taught compactly in the **mode-scaled block** (they are the ASK behaviors'
  vocabulary, and ADR-0090 §1 owns scaling those): **closed single-choice** (RadioGroup — or
  SegmentedControl for ≤4 short labels — recommended option FIRST and preselected via the data model,
  one commit Button) · **multi-select** (Checkboxes bound to distinct paths + commit) ·
  **typed-value** (Field+TextField with the typed codecs `number`/`currency`/`date`/`time`, Calendar
  for a single date, Slider/SliderMulti for bounded numerics; values ride `sendDataModel`) ·
  **boundary-negotiation option cards** (a `Row(wrap)` of `Card`s, each CardContent Text + CardFooter
  Button whose `context` names the option — the structured form of NEGOTIATE's "want me to?") ·
  **confirm/cancel** (two Buttons, confirm `solid` first, cancel `ghost`).
- **Why not mini-skills (ADR-0091):** `selectMiniSkills` matches the USER's intent vocabulary
  (`mini-skills.ts` TF-IDF over `triggers`); an ask triggers on the AGENT's own situation — an
  underdetermined turn, a catalog wall — which shares no vocabulary with the user's words, so registry
  selection would fire on noise or not at all. Inline grammar is the reliable channel; the archetypes
  are ~5 compact lines, inside the token budget a mini-skill module would have cost anyway.
- **Byte-identity discipline preserved, wording re-based:** the literal `GRAMMAR` constant grows (the
  mechanics + the balanced default archetype line), and default/absent mode returns that literal
  unchanged (`grammarFor` — `system-prompt.ts:203-211`) — the invariant "default ≡ the literal
  `GRAMMAR`" holds by construction. SPEC-R6 AC3's historical "byte-identical to the pre-ADR-0090
  grammar" phrasing is repaired to name the literal constant (a named SPEC repair, not a silent drift).

### 5. Mode interplay + graceful degrade — the structured ask scales like the prose ask it extends; every failure lands on the note.

- **`specific`** — asks stay rare (0090's dialed-DOWN threshold is untouched); when NEGOTIATE_SPECIFIC
  would decline-and-redirect ("I can show you a List or a Grid instead — want one of those?"), it emits
  that redirect as a **closed single-choice ask** instead of prose. **default** — a structured ask when
  the answer is a small closed set or one typed value; a prose note when the question is open-ended.
  **`blue-sky`** — prefer structured asks whenever options are enumerable; option cards for
  negotiation; several structured rounds welcome (each answer is an ordinary turn — session history
  connects them, ADR-0088 §2). The honesty floor stays mode-invariant; **no mode widens either
  allowlist** (SPEC-R9 or the feed set).
- **Degrade, at every layer, to ADR-0088's text note — no protocol break:** a consumer that does not
  know `ask` drops the unknown field (`readMetaLine`'s reconstruction — verified behavior) and ingests
  the ask's lines as an ordinary canvas surface: visible, interactive, answerable by typing — mildly
  misplaced, never broken. A broken ask declaration (integrity fail, §1) or an out-of-scope payload
  (page fail-closed, §3) drops the structured form; the note-standalone rule (§4) guarantees the
  question survives as prose. The recorded transport carries asks with the identical stream shape;
  non-DOM consumers (the round-trip gate, validators) see only ordinary validated A2UI plus a meta-line
  they already skip.

## Open forks — none new; one inherited

Every decision above carries a firm recommendation; per this log's discipline no fork is manufactured.
Kim reviews the whole record at ratification — the **feed partition membership (§3)** is the one table
he may want to redline, and the artifact makes any strike a one-line, gate-visible edit, not a design
change. The one adjacent OPEN fork is **inherited, not new**: ADR-0089's backbone-seed fork (scripted
clarify/boundary turns in the recorded transcript — demo completeness vs backbone honesty) now also
covers scripted ASKS if ever taken; the default remains live-only, unchanged, still Kim's call.

**Build-time re-verify (NOT forks):** the mechanics/archetype wording (tuned against real turns — the
0089/0090 precedent) · ask-bubble styling + the frozen annotation copy · whether ask lines display in
the JSON tab (recommend yes — shown ≡ produced, SPEC-R10) · the `inert` accessibility trade-off
(re-verify against a screen-reader pass; the note + chat entry are the accessible record).

## Consequences

- **The ASK stops being homework.** Closed choices, typed values, and negotiations become one click;
  blue-sky's multi-round clarify (ADR-0090's biggest beneficiary) converges in taps instead of typed
  paragraphs; `specific`'s redirect becomes a menu of what the deployment actually offers.
- **Zero package/renderer/transport change.** The wire delta is one additive envelope field; the answer
  path is shipped machinery (`sendDataModel` → `action.dataModel` → `frameClientMessage`);
  `AgentTransport.turn`, the reducer, `shouldRunTurn`, and the SPEC-R9 allowlist are byte-identical.
  The whole build lands in `tools/agent/` + `site/` + tests — the ADR-0088/0090 placement law holds.
- **Honest costs, enumerated for the LLD:**
  - **The ask↔payload correlation is model-authored and protocol-invisible.** Integrity is a
    produce-layer check; a confused model degrades to prose (never breaks), but a *plausible-yet-wrong*
    ask (e.g. options that don't match the question) is live-model quality — ungated at runtime
    (ADR-0070's stance), caught by observation.
  - **Frozen asks leave the accessibility tree** (`inert`). The prose note + the user's answer entry
    carry the accessible record; a screen-reader user loses the frozen widget's visual state. Real
    trade-off; the re-verify above names the check.
  - **Per-ask hosts accumulate listeners/DOM** until reset — bounded by the demo max-turns cap; reset
    disposes all. A long-lived production feed would need eviction; out of scope here.
  - **Prompt cost grows** ~150–250 tokens (mechanics + derived list) + a per-mode archetype delta —
    the same order as one ADR-0091 mini-skill module; bounded and stated.
  - **The model now reasons over TWO type lists** (the full inventory and the feed subset) — a real
    confusion risk, mitigated by the derived list living inside the mechanics block and the
    `FEED_SCOPE` self-correct round catching a miss.
  - **A `wantResponse: false` ask commit would freeze without answering** — the grammar forbids
    authoring it; the page freezes on dispatch regardless, so the failure mode is a frozen-unanswered
    ask, not a stuck one.
- **Stale → re-verify on the build gate:** the partition (every catalog addition forces a disposition —
  that is the gate working, not drift) · the archetype list if the catalog gains a table/chart type ·
  date-range asks unlock when ADR-0093's Calendar catalog-row edit lands (its own follow-up) · the §4
  wording against real turns · the JSON-tab display choice.

## Acceptance

*(Predicates for the eventual build, if ratified — not run here; this is a design record. The
coverage-clean PLAN decomposition [`feed-embedded-asks.decomp.json`](../decompositions/feed-embedded-asks.decomp.json)
carries the per-slice accept predicates; headline gates:)*

- `readMetaLine` round-trips `{note, ask:{surfaceId}}`; a malformed `ask` yields the envelope without
  it; the `version` discriminator is untouched — `meta-line.test.ts`, `npm test` green.
- A stub-provider `produce()` run: meta+ask+payload yields the meta-line FIRST (ask intact) then
  validated lines; ask-with-no-matching-payload yields the meta-line with ask REMOVED; an ask surface
  using `Modal` triggers a `FEED_SCOPE` feedback round and succeeds on the corrected retry — the shared
  `validateA2ui` call sites unchanged in the diff (SPEC-N3 parity).
- The partition gate: IN ∪ OUT = the catalog's 34 types exactly, disjoint, closure holds, and a planted
  undispositioned type FAILS (negative control).
- `system-prompt-grammar.test.ts`: the mechanics block present verbatim in all modes; the feed-allowed
  list SET-EQUALS `FEED_SURFACE_TYPES`; no feed prose in the derived `## Available components` section;
  `grammarFor(undefined) === GRAMMAR` still holds; `prompt-drift.test.ts` green.
- Page tests: an ask renders inside its bubble while canvas lines still reach the canvas; answering
  freezes it `answered` and dispatches a turn carrying the ask's data model; a typed prose send freezes
  a pending ask `bypassed`; a `wantResponse:false` canvas action freezes nothing; Reset disposes every
  ask host; an out-of-scope ask payload renders no controls and the note stands — `check:site` +
  `npm test` green, no key, no live model.
- `round-trip.test.ts` extended: a transcript turn carrying `ask` streams the identical meta-line shape
  ahead of byte-identical `lines`; the shipped transcript itself is unchanged.

## Alternatives considered

- **Embed the ask's A2UI inside the meta envelope** (`a2uiMeta.ask.lines: string[]`). Hard separation,
  but: double-encoded JSONL, a second validation path beside validate-then-stream, kills the
  meta-line's small-framing property (it becomes the payload), and the JSON tab/progressive paint lose
  the lines. Rejected: the main stream already validates, streams, and displays; routing metadata is
  all that is missing — so add only that.
- **Signal the feed target inside the A2UI payload** (`surfaceProperties.container: "feed"`, or an
  `ask-` surfaceId naming convention the client sniffs). Zero framing change, but it smuggles demo
  semantics INSIDE the protocol payload — precisely what ADR-0088 held the line against
  ("beside, never inside"); `surfaceProperties` is the v1.0 theming field; an id convention is
  unverifiable and would leak into exemplars/the corpus. Rejected.
- **A typed transport frame or a new `TurnInput` kind for asks/answers.** Re-rejected on ADR-0088's own
  grounds (the typed frame is the recorded someday-upgrade, not v1) — and the answer needs NOTHING: it
  is an ordinary `action` with `sendDataModel`.
- **One shared feed host for all asks** (instead of per-ask hosts). Fewer hosts, but `mount()` is
  host-global (`renderer.ts:180-183`) — one host cannot target many bubbles; and freeze/dispose
  isolation per message is exactly what per-ask hosts give for free. Rejected.
- **A renderer package change: per-surface mount targets** (`mount(el, surfaceId?)` or a target map).
  The "real" fix — and a public-surface widening of the zero-dep package for a demo-layer need
  (SPEC-N1). Rejected for v1; **recorded as the natural upgrade** if feed-embedded surfaces outgrow the
  demo (the ADR-0088 typed-frame precedent: named, deferred, trigger stated).
- **A second catalog id** (`catalogId: "agent-ui-feed"` registered with only the subset). Structurally
  clean, but the catalog is the sole component authority (SPEC-R6) and a second id fragments the
  corpus, the exemplars, and the derived prompt; `createRenderer()` pre-registers the full default
  catalog anyway. The feed set is a POLICY view over one catalog, not a second catalog. Rejected.
- **Teach the archetypes as ADR-0091 mini-skills.** Rejected on selection mechanics: `triggers` match
  the USER's intent vocabulary; ask situations are the AGENT's own state and share no vocabulary with
  it (§4). The registry stays what it is — user-idiom knowledge.
- **Freeze by `host.dispose()`.** Rejected: dispose detaches the rendered root
  (`dispose()` → `#teardownSurfaceDom`, `renderer.ts:216`/`:411-417`); history must stay visible. `inert` + `data-state` keeps the DOM as record.

## Out of scope (this ADR)

- **Any widening of the SPEC-R9 render allowlist, in any mode** — the feed set is strictly narrower;
  the honesty floor stays mode-invariant (ADR-0089/0090's firm NO, restated).
- **Renderer/package API changes** — per-surface mount targets are the recorded deferred upgrade.
- **Multiple concurrent asks per turn, and canvas+ask combined turns** — one ask, ask-only payload;
  both named as deferred refinements, not built.
- **Date-range asks** — blocked on ADR-0093's Calendar catalog-row follow-up (`mode` is not in the
  catalog today; verified).
- **Ask eviction for long-lived feeds** — the demo max-turns cap bounds v1.
- **`noteKind` chat styling** — still parked where ADR-0089 left it.
- **Dialog trees / agent-held plan state / a quality rubric / new LLM capability** — the standing
  0088/0089/0090 exclusions, unchanged.
- **Seeding the recorded transcript with a scripted ask** — ADR-0089's open fork, untouched.

## Build-sequencing note (indicative, if ratified — the decomposition is the plan)

**Depends on ADR-0088/0089/0090 being built (they are — shipped + gated).** The coverage-clean PLAN
manifest [`feed-embedded-asks.decomp.json`](../decompositions/feed-embedded-asks.decomp.json) (22
nodes · 18 actions · 19 justified edges, `coverage_check.py` exit 0) is the build plan; roughly,
smallest→largest:

1. **Meta envelope `ask`** (`meta-line.ts` + test) — nW1, tiny, everything types against it.
2. **Feed-catalog artifact + partition gate** (`feed-catalog.ts` + `feed-catalog.test.ts`) — nC1/nC2;
   land the gate WITH the artifact (the ADR-0087 seed-and-drain lesson — never a red-gate window).
3. **`produce()` ask peel/compose + integrity + `FEED_SCOPE`** (`produce.ts`, extends
   `produce-loop.test.ts`) — nW2/nW3.
4. **Grammar: mechanics spine + derived feed list + mode-scaled archetypes + gates**
   (`system-prompt.ts`, `system-prompt-grammar.test.ts`) — nC3/nP1/nP2/nP3.
5. **Recorded-transport parity** (`transcript.ts` types + `recorded-transport.ts`, extends
   `round-trip.test.ts`) — nW4.
6. **The page** (`a2ui-live.ts` + `agent-runtime.ts` shim + site tests) — nF1–nF4. **The heaviest
   slice**, as it was for ADR-0088.
7. **SPEC/LLD repairs** (SPEC-R14/R15 + R5/R6/R8/§2/§5; LLD-C14 + C2/C3/C4/C9/§4/§6) — nD1/nD2, landed
   with the build per this ADR's `Repairs:`; `trace_check.py` green.

## Erratum (2026-07-07 — post-ship independent review; append-only, per the ADR log's own rule)

Clause 2's "**freeze fires on turn DISPATCH**" (Decision §2, above) and the SAME clause's "*a
`ProduceHalt`/transport error leaves a pending ask pending, still answerable*" (also §2, above) are, read
literally, mutually unsatisfiable: a halted/errored turn still *dispatches*, so "freeze on dispatch" would
freeze it too, contradicting the very next sentence. This was a **wording** defect in this record, not a
build defect — the reviewer confirmed the shipped code and the LLD never actually implemented "freeze on
dispatch": `freezePriorPendingAsk` (`site/pages/a2ui-live.ts`) is called ONLY after a turn's `host.finalize()`
genuinely completes, never from the `catch` block a `ProduceHalt`/transport error lands in, and the LLD
(`a2ui-live.lld.md` §4, ~lines 316-321) already documents it that way ("fires ONCE per turn that genuinely
COMPLETES … NEVER inside the `catch` block"). The independent review of the built feature ratified
**completion-freeze** — freeze when the dispatched turn *completes*, not merely dispatches — as the one
consistent reading, and this is the reading the SPEC now states (`a2ui-live-agent.spec.md` v0.4: Definitions
§2, SPEC-R14 Lifecycle, SPEC-R8's freeze-semantics paragraph, and AC5 all reworded from "on ANY turn
dispatch"/"freeze-on-dispatch" to "when/once the dispatched turn COMPLETES", the halt-leaves-pending
guarantee kept explicit at each). This section amends the READING of Decision §2 above; the original clause
text is left untouched (append-only) and no `Repairs:`/Status cell above is edited — the build, the LLD, and
now the SPEC all agree: **completion-freeze**, never dispatch-freeze.

## Amendment — the chart-family dispositions (2026-07-08, foreseen by the partition mechanism)

The §3 partition was designed TOTAL precisely so future catalog types would owe a disposition ("the gate
turns CI red until someone writes its disposition — IN, or OUT + a reason," the artifact's own header).
The first such types arrived with ADR-0107 (chart family): **`Sparkline` + `BarChart` join
`FEED_EXCLUDED`** — report content with no ask affordance (display-only rows, no `value:{prop,event}`
mark; the List/Grid dashboard-content reasoning applied to the chart family; see ADR-0107 Amendment 2
for the cl.8 wording tension this resolved). The partition is now **23 IN / 13 OUT**; the §3 membership
list above stays the ratified 2026-07-07 snapshot, with this amendment as the delta record. Ask-policy
semantics unchanged.
