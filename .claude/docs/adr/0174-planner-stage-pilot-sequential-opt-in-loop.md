# ADR-0174 — Planner-stage pilot: an opt-in, sequential plan→execute→synthesize loop composed entirely from shipped `Session`/`produce()`/meta-line/status-stream mechanics — AG-UI and SPEC-R4 prefixing gate a LATER concurrent upgrade, not this pilot

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-06
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-06 |
> | **Proposed by** | planner (design seat — GH [#485](https://github.com/kimgranlund/agent-ui/issues/485), a design-intake candidate filed 2026-08-06 on the same host P>E>S assessment that named it) |
> | **Ratified by** | — |
> | **Repairs** | **On ratification:** `roadmap.md` gains a Now/Next/Later entry naming this pilot's actual sequencing (§5 below), not GH #485's own "depends on AG-UI + SPEC-R4" framing — that framing is corrected by cl.5. **On ratification+build (a future SPEC/LLD this ADR does not author — GH #485 itself is a design-intake candidate, not yet scheduled):** `packages/agent-ui/a2ui/src/agent/meta-line.ts` (`A2uiMetaEnvelope` gains an additive `plan` field, the `ask`-arm precedent) · `packages/agent-ui/a2ui/src/agent/produce.ts` (`formatMetaLine`/`readMetaLine` widen to carry/parse `plan`; `ProduceOptions` is UNCHANGED otherwise — the executor loop lives host-side) · a new host-side plan-runner module (site/app layer — sequential `produce()` calls over one growing `Session`) · `agent-admin-schema.ts` (a new `SURFACE_PLANNER_KEY`-shaped modality-gate constant, the `SURFACE_A2UI_KEY`/`SURFACE_GENUI_KEY` precedent) · `status-stream.ts` consumer wiring (per-step `StatusEntry.parent` grouping, zero component change) · [a2ui-live-agent.spec.md](../spec/a2ui-live-agent.spec.md) (new SPEC-R requirements for the plan arm + host loop, not written here). |
> | **Supersedes / Superseded by** | **Extends** [ADR-0088](./0088-a2ui-live-conversational-channel.md) (the `a2uiMeta` envelope gains a fifth field, `plan` — note/trace/ask/progress/error stand unchanged) · **Extends** [ADR-0097](./0097-a2ui-feed-embedded-asks.md) (the `plan` field follows the EXACT additive, model-authored, shallow-validated `ask`-arm precedent cl.2 below argues from directly) · **Extends** [ADR-0146](./0146-live-turn-lifecycle-progress-channel.md) and [ADR-0159](./0159-status-stream-receipt-pattern.md) (a plan's steps render live by REUSING F5's grouping + the receipt pattern — zero new component) · **Relates** [ADR-0168](./0168-integration-manifest-registry-validated-dispatch-server-keys.md) (tool dispatch is per-`produce()`-call already; unchanged, cl.3) · **Relates** [ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md) (the `./agent` toolkit shell this design's host loop is built against) · **Relates** [`a2ui-ecosystem-alignment.spec.md`](../spec/a2ui-ecosystem-alignment.spec.md) SPEC-R1/SPEC-R4 and [`a2ui-streaming-pipeline.spec.md`](../spec/a2ui-streaming-pipeline.spec.md) (both cited, neither treated as a blocking prerequisite for THIS pilot's sequential shape — cl.5's correction) · **Relates** [`persona-catalog-composition.spec.md`](../spec/persona-catalog-composition.spec.md) (a genuinely orthogonal axis, not a dependency — cl.3's finding) · **Resolves** the design-intake half of GH [#485](https://github.com/kimgranlund/agent-ui/issues/485) (the issue itself stays open, tracking the pilot's own future build). |

## Context

**The design problem** (GH #485, summarized). The runtime today is single-stage: one `produce()`
call per turn, inside a bounded execute→validate→retry microloop, with "planning" compiled into
personas (surfaceStyle idioms + mini-skills) and the deterministic validator playing the critic.
Right for forms/games/dashboards; won't scale to open-ended multi-step asks (research-style
intents, multi-surface workbench compositions authored in one request). GH #485 proposes an
OPT-IN explicit planner stage: a plan turn decomposes intent into steps, executor turns run each
step, a synthesis step composes the final surface set, and the plan renders live. The issue names
five seams as "already plumbed": the `Session` reducers, `ui-status-stream`'s lifecycle channel,
SPEC-R4 orchestrator surface-ID prefixing, the AG-UI transport leg, and the deterministic
validator as critic. **This ADR verifies each claim against real source rather than restating it**
— two of the five (surface-ID prefixing, AG-UI) turn out to gate a LATER extension this pilot does
not need, not the pilot itself (cl.5).

**Verified facts, standing on the actual mechanisms:**

- **The `Session` reducers are pure, turn-index-agnostic, and already used at every turn — not
  just turn 1.** `session.ts` exports `nextTurn`/`appendUserTurn`/`appendAssistantTurn` (lines
  75/105/100) as pure `Session → Session` functions with no turn-count special-casing.
  `agent-transport.ts:51-54`'s own doc comment reads "*Turn 1 is a raw user `intent`; every later
  turn is a `client` message*" — but that is a documented CONVENTION for human-typed chat, not a
  runtime rule: every shipped chat consumer (`a2ui-chat.ts:250`, `a2ui-live.ts:590`,
  `gen-ui-live.ts:458/463`) fires `{kind:'intent', text, session}` on EVERY submit, at every turn
  index, not only the first. Mechanically, nothing prevents a HOST-composed `intent` turn (the
  executor's own step instruction, not a human's) from riding this exact same reducer path at turn
  N — zero new `TurnInput` variant, zero new `Session` shape.
- **`frameClientMessage`'s `error` arm is an existing, shipped, CROSS-turn recovery framing —
  built for exactly the "tell the model a prior thing failed, then continue" shape a failed
  plan step needs.** `session.ts:64-68`: `frameClientMessage` on the `error` arm returns
  `"The previous surface was rejected (<code> on <locus>): <message>. Emit a corrected, valid A2UI
  surface."` — a real, shipped precedent for feeding a failure back into a LATER turn rather than
  halting.
- **`ProduceOptions` is, by its own file's convention, EVERY field additive-opt-in with an
  absent-default of byte-identical behavior.** `produce.ts:91-159` — `mode`, `personaSystem`,
  `progress`, `progressDetail`, `genuiSurface`, `a2uiEnabled`, `tools`/`executeTool` each carry a
  doc comment of the shape "Absent ⇒ byte-identical composition" or "byte-identical to before this
  field existed." This is a load-bearing, established law of the file, not a one-off.
- **`ProduceDeps.catalog` is ALREADY supplied per `produce()` call, not fixed for a session.**
  `produce.ts:85-89` — `ProduceDeps { provider, retrieve, catalog: Catalog }` is the per-call
  dependency bag; nothing pins one `Catalog` for a session's lifetime. A caller switching catalog
  (or `genuiSurface`, or `mode`) between two `produce()` calls already works today with zero new
  mechanism.
- **The dev proxy runs exactly ONE `produce()` call per HTTP request.**
  `dev-proxy-plugin.ts:283` — one `for await (const line of produce(input, deps, {...}))` per
  request handler invocation. A host issuing N sequential `produce()` calls (one per plan step) is,
  from the proxy's perspective, indistinguishable from N ordinary chat turns — no proxy/transport
  change of any kind is implied by a multi-step executor loop.
- **The meta-line envelope's precedent for a MODEL-authored, additive, shallow-validated field is
  `ask` (ADR-0097 §1), not `progress`/`trace`/`error` (all runtime-composed).** `meta-line.ts:13-20`
  documents the `ask` field precisely: the model declares it on its own leading meta-line, alongside
  `note`; `produce()` peels it and re-composes it on the outgoing line only when it verifies clean
  (`meta-line.ts:87-88`); a malformed `ask` drops only itself, never the whole envelope
  (`readMetaLine`'s ask-specific shallow-validation body, `meta-line.ts:145-152`). `progress`
  (ADR-0146 F1) and `trace`/`error` are the OPPOSITE shape — runtime-assembled, never model-authored
  (`meta-line.ts:85-101`).
- **`TURN_PROGRESS_STAGES` is a CLOSED, produce-layer-owned vocabulary describing ONE round's
  internal lifecycle, not task-level structure.** `meta-line.ts:63` —
  `['sent','started','reasoning','content','validating','retry','tool','done']`. ADR-0146 F2's
  honesty law guards this table: an out-of-vocabulary stage never renders. A "plan step" is not a
  member of this closed table and was never meant to be — conflating the two would mean either
  widening a closed, round-scoped vocabulary to carry task-scoped facts, or overloading `'tool'`'s
  factual-name slot (scoped to a registered integration call, GH #49) to mean something else.
- **`ui-status-stream` already supports GROUPING via a `parent` key, riding `ui-timeline-item`'s
  nested-accordion anatomy — no new component required to show hierarchical, live-updating
  step structure.** ADR-0146 F5 (`StatusEntry` gains `parent`) composes on ADR-0143's nesting;
  ADR-0159 layers the receipt pattern (a live morphing one-liner, collapsing to a one-line receipt
  at a terminal state) on top, on the SAME closed stage table.
- **Tool dispatch is already per-`produce()`-call, unaffected by call COUNT.** ADR-0168's manifest
  registry resolves `tools`/`executeTool` per request (`dev-proxy-plugin.ts`'s `toolOpts`, threaded
  into `ProduceOptions`); nothing about running `produce()` N times instead of once changes how a
  single call's tool loop works (GH #49's internal Anthropic-adapter loop, `AgentProvider.stream`'s
  `tools`/`executeTool` fields, `agent-transport.ts:124-155`).
- **`AgentTransport` is ALREADY the shipped transport-isolation seam every page consumes through —
  its own SPEC-R1, not the ecosystem SPEC's.** `a2ui-live-agent.spec.md:248-256` SPEC-R1
  ("Transport-isolated client") requires the page import ONLY `AgentTransport`
  (`agent-transport.ts:69-71`); AC2 requires swapping `RecordedTransport → LiveProxyTransport` cost
  zero page edits. This is a DIFFERENT, already-built SPEC-R1 from the ecosystem SPEC's SPEC-R1
  (AG-UI transport binding) — three different documents each use file-scoped `SPEC-R1`/`SPEC-R4`
  IDs (`a2ui-live-agent.spec.md` §Purpose: "Requirement IDs file-scoped"); this ADR is careful to
  always name which document's `SPEC-R#` it means.
- **AG-UI does not exist in this repo today, and its owning SPEC is itself still `proposed`.**
  `grep -rli "ag-ui"` across `packages/` returns zero hits. `a2ui-streaming-pipeline.spec.md:3` —
  `Status: proposed · v0.2 · 2026-07-02`; its own SPEC-R4 ("AG-UI adapter",
  `a2ui-streaming-pipeline.spec.md:50-52`) is unbuilt. `a2ui-ecosystem-alignment.spec.md:117-129`'s
  SPEC-R1 raises this adapter's PRIORITY (should be built first, after stdio) but does not build it
  — its own action row (`a2ui-ecosystem-alignment.spec.md:243`) reads "streaming SPEC revision
  (its own doc, no issue needed until build)": not yet filed, not yet scheduled.
- **Ecosystem SPEC-R4 (surface-ID prefixing) is real, open, and unbuilt — GH #475.**
  `a2ui-ecosystem-alignment.spec.md:154-162`: "the producer toolkit's `Session` seam MUST offer
  [prefixing] first-class: a per-producer surface-ID prefix... so two subagent PRODUCERS under one
  orchestrator cannot collide." AC1 names the test shape: "*Given* two SESSIONS with distinct
  prefixes... a cross-prefix update is rejected." `gh issue view 475` confirms: OPEN, filed at
  ratification, routes to the `Session` seam (`agent-transport.ts`/`session.ts`) — not yet built.
  The requirement is scoped to TWO DISTINCT SESSIONS/producer identities colliding — a structurally
  different shape from one session's own sequential turn growth (cl.3/cl.5).
- **Persona-catalog-composition (M-D, accepted 2026-08-06) composes a persona's EFFECTIVE catalog
  ONCE, at the persona-selection level — not per-turn, not per-step.**
  `persona-catalog-composition.spec.md` SPEC-N2 explicitly scopes itself to the persona-local
  overlay mechanism, naming the "shared system patterns" tier (ADR-0172 cl.3) as separately
  unbuilt future work. GH #485's own "a planner step could select the pattern set per step"
  framing describes an axis M-D's SPEC does not build — but, per the `ProduceDeps.catalog`
  per-call finding above, no NEW mechanism is needed to let two `produce()` calls in one plan use
  two different catalogs; this is orthogonal to, not blocked by, M-D.

## Decision

### 1 · The opt-in seam — a persona-scoped modality-gate boolean, threaded to a `ProduceOptions`-level flag; NEVER the default turn shape

**Ruling.** Planner mode is a per-persona capability, gated the SAME way the fleet's other
modalities already are: a `SURFACE_PLANNER_KEY`-shaped store constant (`'surfacePlanner'`),
following the `SURFACE_A2UI_KEY`/`SURFACE_GENUI_KEY`/`SURFACE_GENUI_DOGFOOD_KEY` precedent
(`agent-admin-schema.ts:174/181/197` — OFF by default, admin-authored per persona, dimmed while
its own gate is off). At the runner/proxy layer, the flag threads to a NEW, purely additive
`ProduceOptions`-adjacent knob the host loop reads BEFORE deciding whether to run the single-stage
microloop (today's shape, unchanged) or the multi-call plan→execute→synthesize loop (cl.3) — never
inside `produce()` itself, which stays a plain per-call primitive either way. Absent/false ⇒ the
single-`produce()`-call microloop runs exactly as it does today, byte-identical — the SAME
"Absent ⇒ byte-identical" law every other `ProduceOptions` field already states (Context).

**The tradeoff, ruled explicitly.** A K-step plan costs a MINIMUM of `1 + K` `produce()` round-trips
(the plan turn, plus K executor turns) versus today's exactly-`1`, each with its OWN
`maxRounds`-bounded self-correct loop and its own provider round-trip latency. For forms/games/
dashboards — single, low-ambiguity, single-surface tasks — this is a pure latency/cost regression
with zero benefit, which is exactly why GH #485 frames this as opt-in for "complex personas," not a
fleet-wide default. This ADR rules the SAME way: opt-in is not a caution pending more data, it is
the correct default given the mechanics — decomposition cost scales linearly with step count, and
the task classes the single-stage shape already serves well gain nothing from paying it.

**Considered alternatives.**
- **A global/session-level default (planner mode always on) — rejected.** Every task class this
  runtime serves today (forms, games, dashboards) needs exactly one `produce()` call; forcing
  `1+K` round-trips on all of them is a strict latency/cost regression with no offsetting benefit
  — the opposite of what an opt-in pilot should do.
- **A `ProduceOptions`-only flag, with no persona-schema surface (decide per-REQUEST, not
  per-PERSONA) — rejected as the SOLE mechanism.** Mechanically possible (it is just another
  per-call option, like `mode`/`genuiSurface`), but every other modality the admin configures
  (A2UI/GenUI/dogfood) is persona-scoped, admin-authored capability — a request-only flag would
  give the admin UI no way to author "this persona uses planner mode," breaking the established
  modality-gate pattern (`agent-admin-schema.ts`'s `SURFACE_*_KEY` family) this pilot should join,
  not fork. The right shape is BOTH layers — a persona-scoped store key that threads to the
  per-call flag when the runner builds the request, exactly the `SURFACE_A2UI_KEY`→produce-call
  precedent already proves out end-to-end.

### 2 · The plan's representation — a NEW additive `plan` arm on the ADR-0088 meta-line envelope (the `ask`-arm precedent), rendered live by PROJECTING onto the existing status-stream grouping mechanism — two different mechanisms for two different jobs, not one mechanism doing both

**Ruling.** The plan turn's model output declares its step list as a new, additive,
shallow-validated field on the SAME leading meta-line `note`/`ask`/`trace`/`progress`/`error`
already ride (`meta-line.ts:102-115`) — `plan: { steps: [{ id: string; description: string }] }`
(exact shape an LLD's job, not this ADR's). This follows the `ask`-arm precedent EXACTLY
(ADR-0097 §1, Context): MODEL-authored (the model declares it, like `note`/`ask`, never
runtime-composed like `progress`/`trace`/`error`); shallow-validated the same way (a malformed
`plan` drops only itself, never the whole envelope, `readMetaLine`'s existing per-field-independent
guard, `meta-line.ts:139-173`); the envelope stays versionless and provably disjoint from
`A2uiServerMessage` (unchanged). `AgentTransport.turn`'s signature stays byte-identical — the
ADR-0088 discipline, extended not re-decided, exactly as ADR-0097/ADR-0146/GH#144 each already
extended it once.

**The live-rendering vehicle is a SEPARATE, already-shipped mechanism: status-stream grouping.**
Once the host reads the model's `plan` arm, it seeds ONE `ui-status-stream` GROUP per named step
(the step's `id` as the group's `parent` key, ADR-0146 F5) — then each step's OWN `produce()` call
interleaves its ordinary `TurnProgress` events (`sent`/`started`/.../`done`, unchanged) as CHILD
entries under that group, riding ADR-0159's receipt pattern (one morphing line while a step runs,
collapsing to a receipt when it finishes) with ZERO new UI component. This reuses 100% of shipped
grouping/nesting/disclosure machinery (ADR-0143/ADR-0146/ADR-0159) — the plan's steps become the
group headers a live turn already knows how to render.

**Considered alternatives.**
- **Projection-ONLY onto the status-stream channel (no wire `plan` object) — rejected.**
  `TURN_PROGRESS_STAGES` is a CLOSED, produce-layer-owned table describing ONE round's internal
  lifecycle (Context); a "plan" names MULTIPLE STEPS at the TASK level — a different kind of fact
  entirely. Carrying it through `TurnProgress` would mean either widening the closed, honesty-law-
  guarded vocabulary (ADR-0146 F2) to hold task-decomposition semantics it was never designed for,
  or overloading `'tool'`'s factual-name slot (scoped to a registered integration call, GH #49) —
  both misuse a mechanism that already has a well-defined, narrower job. The `ask` precedent shows
  where a model's STRUCTURAL declaration actually belongs: the meta-line's model-authored arms.
- **A typed-frame protocol break (a new wire message kind, not a meta-line field) — rejected on the
  SAME grounds ADR-0146 F1 already rejected it for `progress`:** the meta-line's reserved,
  versionless, `A2uiServerMessage`-disjoint envelope already solves "carry an out-of-band fact on
  the SAME stream without touching the validated A2UI wire" — inventing a second channel would
  duplicate a solved problem and cost every consumer a second parse path.

### 3 · The executor loop — ONE `produce()` call per step, sequential, over ONE shared growing `Session`; the deterministic validator stays the per-step critic (a strength, not a gap); SPEC-R4 prefixing is NOT a structural prerequisite for this shape

**Ruling.** Each plan step maps to exactly one `produce()` call. The host composes the step's
instruction as an ordinary `{kind:'intent', text: <step instruction>, session}` `TurnInput` —
riding `session.ts`'s existing `nextTurn`/`appendUserTurn`/`appendAssistantTurn` reducers COMPLETELY
UNCHANGED (Context: `intent` is already used at every turn index by every shipped chat consumer,
not reserved for turn 1). The plan turn's own assistant output and each step's assistant output
accumulate onto the SAME growing `Session` via `appendAssistantTurn`, exactly like an ordinary
multi-turn conversation — so step N naturally sees every prior step's (and the plan's) context, with
ZERO new session/reducer/`TurnInput` mechanism. "Surface per step" is an OUTPUT-SHAPE convention
(each step's `produce()` call creates/updates its own A2UI surface(s)), not a new wire concept.

**The deterministic validator stays the per-step critic — a strength, ruled explicitly, not an open
gap.** Each step's `produce()` call runs its OWN full execute→validate→retry microloop, bounded by
its own `maxRounds`, completely unchanged. GH #485 itself frames this as a deliberate divergence
from model-judged synthesis; this ADR agrees and rules it: a strict, catalog-schema-checked critic
running independently per unit of work is a natural fit for a plan/execute shape, and nothing about
decomposing one turn into N turns touches the validator's contract in any way.

**SPEC-R4 (surface-ID prefixing, GH #475) is NOT a structural prerequisite for THIS shape.**
Ecosystem SPEC-R4's own text (Context) scopes the requirement to TWO DISTINCT SESSIONS/producer
identities writing into shared space and colliding; AC1's own test is "two SESSIONS with distinct
prefixes." A sequential plan, as ruled here, is ONE producer identity (ONE `Session`) throughout
its entire life — there is no second session, no second identity, and therefore no cross-prefix
collision surface for #475 to guard. #475 becomes load-bearing ONLY if this design is LATER
extended to CONCURRENT/parallel step execution (multiple simultaneous `produce()` calls as DISTINCT
producer identities writing into one session at once) — a deliberate non-goal of this pilot
(Non-goals below), not something this ADR designs.

**Tool dispatch stays per ADR-0168, unchanged.** Each step's `produce()` call threads its own
`tools`/`executeTool` exactly as any ordinary turn does today (Context) — nothing in this design
touches the manifest registry, the trust boundary, or the provider-native tool loop.

**Considered alternatives.**
- **Fuse all steps into ONE `produce()` call (a single mega-turn whose output happens to be
  multi-surface) — rejected.** `heal()`/`validateA2ui` operate on one round's WHOLE output as a
  single unit (`produce.ts`'s round loop); a fused call's `maxRounds` budget covers the ENTIRE
  multi-step batch, so one step's failure forces the WHOLE batch to retry from scratch — no
  per-step failure isolation, strictly worse than N independent calls each with their own budget.
  It also defeats GH #485's own "plan rendered live" requirement: a fused call streams nothing
  until the WHOLE thing validates, so a K-step batch shows blank output until the last step
  succeeds — the opposite of watching a plan execute.
- **A SEPARATE `Session` per step, rather than one shared growing session — rejected.** GH #485's
  own motivating examples ("multi-surface workbench compositions authored in one intent") need a
  later step to see earlier steps' context (so step 3 doesn't duplicate or contradict step 1's
  surface). `Session` already IS "the ordered turn history the browser holds" (`session.ts`'s own
  header comment) — reusing ONE session across all steps gives every step full context for free; N
  separate sessions would require inventing a NEW cross-session context-sharing mechanism to solve
  a problem `Session` already solves.
- **A new `TurnInput` kind (e.g. `'step'`) instead of reusing `'intent'` — considered, not ruled
  necessary.** Mechanically, `'intent'` already works at any turn index (Context); a dedicated kind
  would only be justified if a future consumer needs to visually distinguish "a host-synthesized
  step instruction" from "literal human chat text" in a rendered transcript — a real, but
  LLD-level, presentation question this ADR does not need to settle to freeze the architecture.

### 4 · Synthesis and the fail-closed grain — a closing `produce()` turn composes the final surface set (never un-validated host-side assembly); step failures degrade gracefully by default, the plan turn's own failure is the one true abort

**Ruling — synthesis is a closing `produce()` turn, not host-side assembly.** After the last step,
the host appends one more ordinary `{kind:'intent', ...}` turn to the SAME session, instructing the
model to compose/finalize the surface set from what the session already shows. This is the
consistent choice because `produce()`'s validate-then-stream contract (SPEC-R5, cited by ecosystem
SPEC-R8 as "provably valid before ship, PRD-G4") is the system's ONE standing law for what may ship
as a final surface — a host stitching surfaces together outside that loop would be a new,
ungoverned, unvalidated composition path the fleet has never had before.

**The fail-closed grain, ruled in three tiers, each grounded in where a failure can actually
occur:**
- **A STEP's own `produce()` failure (`ProduceHalt` or a transport error) does NOT abort the whole
  plan by default.** The host appends a failure-acknowledgment turn reusing the EXACT shape
  `frameClientMessage`'s `error` arm already establishes (Context: "The previous surface was
  rejected... Emit a corrected..." — the same cross-turn recovery framing, adapted to "step N
  failed, continue") and proceeds to the next step. This is safe by construction, not a new
  invention: `produce()` only ever yields FULLY VALIDATED lines (SPEC-R5) — a failed step
  contributes nothing to the wire, so there is no half-valid state to clean up.
- **The SYNTHESIS turn's own failure leaves every already-rendered step surface standing.** Each
  step's surfaces already streamed as validated content before synthesis ever runs; a synthesis
  failure has nothing to roll back. The host surfaces a failed/`warning` terminal state on the
  synthesis group (the SAME status-stream vocabulary cl.2 already uses) rather than hiding the
  completed step work — an application of the same "the surface survives, the failure is visible"
  posture SPEC-R2's render-depth guard rules for a different failure mode, not a claim SPEC-R2
  itself covers this case.
- **The PLAN turn's own failure (the very first call, before any step runs) is the one TRUE
  abort-the-whole-thing case** — no steps have run, no partial session exists; `ProduceHalt`'s
  existing single-call semantics apply completely unchanged.

**Considered alternatives.**
- **Hard-abort the whole plan on any single step's failure — rejected as the default.** Given the
  design is sequential and every step shares one session (cl.3), a later step already sees whether
  an earlier one succeeded — the MODEL can adapt (e.g. skip referencing a missing surface) exactly
  the way it already adapts to an `error`-arm cross-turn correction today. Hard-abort is strictly
  more conservative than the mechanics require and throws away already-valid, already-rendered
  work for no benefit when steps are independent. (A step that structurally DEPENDS on a prior
  step's output — not named or built here — would reasonably hard-abort at the missing input; this
  ADR does not design step dependencies, Non-goals.)
- **Silent step-failure absorption (skip a failed step with no acknowledgment turn) — rejected.**
  Without an explicit failure-acknowledgment turn, the model has no way to know a step it expected
  to have run did not — it could hallucinate that the missing surface exists. Reusing the `error`
  arm's existing cross-turn framing costs nothing new and closes this gap for free.

### 5 · Sequencing — the sequential pilot (cl.1-4) needs neither AG-UI nor SPEC-R4; both gate a LATER concurrent-execution upgrade this ADR names but does not design

**Ruling.** GH #485 frames AG-UI (ecosystem SPEC-R1) and surface-ID prefixing (ecosystem SPEC-R4,
GH #475) as prerequisites for the whole pilot. Argued from the mechanics verified in Context, this
is only half right:

- **AG-UI is NOT a structural gate on the planner design at all.** `AgentTransport` is ALREADY the
  shipped transport-isolation seam every page consumes through (its OWN, already-built SPEC-R1 in
  `a2ui-live-agent.spec.md`, distinct from the ecosystem SPEC's SPEC-R1 — Context). AG-UI landing
  is a NEW `AgentTransport` IMPLEMENTATION — a transport swap behind an interface that already
  exists to make swaps free (SPEC-R1 AC2: "no other page line changes"). The plan/execute/synthesize
  loop this ADR rules (cl.1-4) is built entirely in terms of `Session`/`produce()`/the meta-line —
  none of which know or care which `AgentTransport` implementation is live underneath. Nothing here
  waits on AG-UI.
- **SPEC-R4 (GH #475) is NOT a prerequisite for the SEQUENTIAL shape this ADR rules (cl.3's
  finding).** It becomes load-bearing only for a future CONCURRENT/parallel-step extension, which
  this ADR explicitly declines to design (Non-goals).
- **What CAN be designed and piloted now, with zero new dependency:** the whole sequential
  plan→execute→synthesize loop (cl.1-4) — a persona-scoped opt-in flag, the `plan` meta-line arm,
  N sequential `produce()` calls over one shared session, status-stream-grouped live rendering, and
  closing-turn synthesis. Every piece composes from mechanisms that are ALREADY BUILT AND SHIPPED
  (Context's verified-facts list).
- **What MUST wait, and on what, specifically:** a CONCURRENT/parallel-step upgrade (multiple
  simultaneous `produce()` calls as distinct producer identities writing into one session) needs
  GH #475 to land first, to avoid exactly the surface-ID collision its own AC1 names. Nothing in
  this pilot's own scope needs AG-UI at any point — a future transport choice, decoupled by
  construction, never a blocker.

This reorders GH #485's own framing: the issue's stated dependency list (AG-UI, then #475, then
build) is corrected here to "the pilot's sequential shape can be built now; #475 gates a specific,
later, explicitly out-of-scope extension; AG-UI never gates the planner mechanics, only a future
transport swap."

**Considered alternatives.**
- **Treat GH #485's own dependency framing as authoritative and defer the whole design until both
  AG-UI and #475 land — rejected.** The dispatching brief for this ADR itself required verifying
  claims against source rather than restating them; doing so here finds the framing overstates the
  dependency for the pilot's own (sequential) shape. Deferring a fully-designable pilot behind two
  unrelated prerequisites — one (#475) scoped to a shape this pilot doesn't build, one (AG-UI)
  already decoupled by `AgentTransport` — would be manufacturing a wait the mechanics don't require.
- **Design the concurrent/parallel-step upgrade now too, since #485 gestures at it** — rejected;
  see Non-goals. A design intake's job is to freeze what the mechanics actually support now, not
  pre-build a second, larger design (concurrent producer-identity coordination, a genuinely
  different, harder problem) riding on a prerequisite (#475) that hasn't landed.

## Non-goals

- **Concurrent/parallel step execution.** This ADR rules a SEQUENTIAL executor loop only (cl.3).
  Running multiple steps' `produce()` calls simultaneously as distinct producer identities — the
  shape that actually needs SPEC-R4 prefixing (GH #475) — is a deliberate, named future extension,
  not designed here.
- **Step dependency declarations (a plan DAG).** The `plan` arm (cl.2) is an ordered list of steps;
  this ADR does not design a dependency graph, blocking semantics between steps, or a "step 3 needs
  step 2's output" declaration. The sequential, shared-session shape (cl.3) gives every step access
  to all prior context for free, which covers the common case without needing explicit dependency
  edges — a real DAG is a future extension if the common case proves insufficient.
- **The AG-UI adapter itself.** Its build lives entirely on `a2ui-streaming-pipeline.spec.md`'s own
  SPEC-R4 / `a2ui-ecosystem-alignment.spec.md`'s SPEC-R1 — untouched, unbuilt, and not gated by
  this ADR in either direction (cl.5).
- **The persona-catalog-composition (M-D) per-step pattern-set selection GH #485 gestures at.**
  `ProduceDeps.catalog` is already per-call (Context), so nothing here is BLOCKED by M-D — but this
  ADR also does not design a per-step catalog-selection UI/policy; a step's `produce()` call may use
  a different catalog than another step's, mechanically, but WHICH catalog and HOW it is chosen is
  left to the future SPEC/LLD.
- **The exact `plan` arm JSON shape, `SURFACE_PLANNER_KEY`'s exact name, and the plan-integrity
  check `produce()` would need (the `ask`-arm's own surfaceId-correlation check, ADR-0097 §1, has
  no obvious `plan` analogue yet)** — LLD-level decisions, named as follow-up, not settled here.

## Consequences

- GH #485 gains a ratified architecture to build against: opt-in persona-scoped gate (cl.1), a
  model-authored additive meta-line arm for the plan (cl.2), a sequential host-driven executor loop
  reusing `Session`/`produce()` completely unchanged (cl.3), closing-turn synthesis with a
  three-tier fail-closed grain (cl.4), and a corrected sequencing story that unblocks the pilot's
  first build immediately (cl.5).
- The whole design composes from shipped mechanics; the ONLY genuinely new wire surface is one
  additive meta-line field (`plan`) and ONE new persona-scoped store constant — everything else
  (session growth, `ProduceOptions` per-call knobs, status-stream grouping, tool dispatch, the
  `error`-arm failure framing) is reuse, not invention.
- `produce()` itself is untouched except for `formatMetaLine`/`readMetaLine` widening to
  carry/parse `plan` — the SAME shape `ask` (ADR-0097) and `progress` (ADR-0146) each already added
  without touching the round loop's own internals.
- The corrected sequencing (cl.5) means the FIRST slice of this pilot can be scheduled without
  waiting on GH #475 or the AG-UI adapter — a materially different (and sooner) build order than
  GH #485's own framing implied.
- A concurrent/parallel-step upgrade remains explicitly future work, gated on GH #475 landing
  first — named here so it is not later mistaken for something this pilot already covers.
- The plan-integrity check (Non-goals: no obvious `ask`-style correlation analogue yet) is a real
  open design question for the future SPEC/LLD, not resolved by reusing the `ask` precedent
  wholesale — flagged, not silently assumed solved.

## Open forks

- **OF1 — The exact `plan` arm shape and its integrity check.** `ask`'s correlation check
  (`produce()` verifies the declared `surfaceId` is actually created by a payload line) has a
  natural payload-side anchor; a `plan` step has no equivalent payload to check against at
  declaration time (the steps haven't run yet). Whether `plan` needs an integrity check at all, or
  is simply displayed as declared (host-trusted until steps run), is a real open question — Kim's
  or the future SPEC's, not derivable from the `ask` precedent alone.
- **OF2 — Whether step dependencies (a plan DAG) are ever needed, or whether the sequential
  shared-session shape (cl.3) proves sufficient in practice.** Genuinely empirical — depends on
  what the pilot's first real multi-step asks actually need. Named as a Non-goal here; revisit
  after the pilot ships.
- **OF3 — The exact persona-schema store-key name and admin-UI presentation for planner mode**
  (cl.1 names the SHAPE — a `SURFACE_PLANNER_KEY`-style modality gate — not the LLD's exact
  constant name or admin section).

## Alternatives considered

(Full per-clause reasoning lives inline above; recapped here.)

- **Defer the whole pilot until AG-UI + SPEC-R4 both land** — rejected; cl.5 finds neither is a
  structural prerequisite for the sequential shape this ADR designs.
- **A fused single `produce()` call for the whole plan** — rejected; cl.3, loses per-step failure
  isolation and defeats live rendering.
- **Separate `Session` per step** — rejected; cl.3, throws away the free cross-step context sharing
  one growing session already provides.
- **Host-side (unvalidated) synthesis assembly** — rejected; cl.4, breaks the standing
  validate-then-stream law (SPEC-R5) every other final surface in this system honors.
- **Hard-abort the whole plan on any step failure** — rejected as the default; cl.4, more
  conservative than the mechanics require for independent steps.
- **Planner mode as a global/session default** — rejected; cl.1, pure latency/cost regression for
  the task classes the single-stage shape already serves.
- **Projecting the plan itself onto the closed `TURN_PROGRESS_STAGES` vocabulary instead of a new
  meta-line arm** — rejected; cl.2, conflates a round-scoped closed table with task-scoped
  structure.
