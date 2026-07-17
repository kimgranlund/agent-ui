# SPEC — A2UI Live-Agent Example (a real LLM emitting A2UI over the wire)

> Status: accepted · v0.5 · 2026-07-16 (v0.4 2026-07-07; v0.3 2026-07-07; v0.2 2026-07-07; v0.1 2026-07-04; ratified 2026-07-04) · Layer: SPEC (execution contract)
> v0.5 changelog (docs-only, no requirement/ID/AC shape added or removed): **SPEC-N1** amended for the ADR-0137
> producer-toolkit export (TKT-0072, built + ratified 2026-07-16). The package surface list gains a FOURTH
> subpath — `.`/`./examples`/`./corpus`/`./agent` — and the blanket "the live infra is site/tools-scoped only"
> clause NARROWS to name specifically the key-holding/dev-proxy/provider-registry shell (`dev-proxy-plugin.ts` ·
> `providers.json`/`providers-config.ts`/`providers/{index,openai,gemini}.ts` · `agent-config-schema.ts`), which
> stays behind in `tools/agent/`; the genuinely portable producer core (`buildSystemPrompt`/`produce`/the
> `AgentTransport`+`Session` seam types/`GenUiMode`/the mini-skill registry/`feed-catalog`/`recorded-transport`/
> the Anthropic adapter) moved `tools/agent/` → `src/agent/` and is exported at `./agent` per the ADR-0119
> opt-in-pack law (hand-rolled, SDK-free, opt-in, identity-gated — the root `.` barrel carries zero producer
> bytes). The zero-dep invariant (no LLM SDK, plain `fetch`, `@agent-ui/components`+`@agent-ui/shared` the only
> deps) is UNCHANGED — only the SPEC constraint derived from ADR-0069 narrows; ADR-0069 itself (append-only
> accepted) is untouched. No requirement, AC, or ID changed. (The LLD §0 placement law + §2 file map are
> repaired in the same change to point at the new `src/agent/` home.)
> v0.4 changelog (docs-only, no requirement/ID/AC shape added or removed): repairs a wording contradiction an
> independent review of the built ADR-0097 ask feature caught — the freeze clauses (Definitions §2, SPEC-R14
> Lifecycle, SPEC-R8's freeze-semantics paragraph + AC5) said freeze fires "on ANY turn dispatch", which is
> mutually unsatisfiable with the very next sentence's halt-leaves-pending guarantee (a halted/errored turn
> dispatches but must NOT freeze). Reworded every occurrence to "when/once the dispatched turn COMPLETES" —
> the shipped `freezePriorPendingAsk` (`site/pages/a2ui-live.ts`, called only after `finalize()`, never in the
> `catch` path) and the LLD (§4) both already implemented completion-freeze; the halt-leaves-pending guarantee
> itself was already correct and stays explicit at each repaired clause. No requirement, AC, or ID changed —
> the underlying contract is unchanged, only its wording now agrees with itself.
> v0.3 changelog: adds feed-embedded interactive asks (ADR-0097) — NEW **SPEC-R14** (the wire+lifecycle+
> degrade contract) and NEW **SPEC-R15** (the feed sub-catalog partition gate); SPEC-R5 gains the `ask`
> meta-envelope field (same validated stream, SPEC-R5 itself untouched); SPEC-R6 gains the invariant ask
> mechanics + mode-scaled archetype vocabulary + the derived feed-allowed list, and AC3's historical
> "byte-identical to the pre-ADR-0090 grammar" wording is re-based to name the literal `GRAMMAR` constant
> (so growing that constant, as ADR-0097 does, does not make the AC lie); SPEC-R8 gains the structured-
> answer arm (the existing `action` + `sendDataModel`, zero protocol extension) + freeze semantics;
> Definitions §2 and the §5 typed contracts gain the `ask`/`AskDeclaration`/feed-catalog shapes.
> v0.2 changelog (docs-only, no requirement/ID/AC shape added or removed): corrects four claims that the
> mini-skill composition block is mode-INVARIANT (Definitions §2, SPEC-R6 prose, SPEC-R6 AC4, §5 typed
> contract) to match the shipped ADR-0091 §4 fix — `miniSkillsFor(mode, selected)` excludes the three
> ADR-0090 ★ calibration ids from the block ONLY in `'blue-sky'` mode (they are already inlined in
> `NEGOTIATE_BLUE_SKY` there); also tightens SPEC-R13 AC2 to the real no-embedded-JSONL rule
> (`mini-skills.test.ts:40`) and drops the load-bearing-free "THIRD segment" ordinal.
> Refines: [`../a2ui-expert-system.prd.md`](../prd/a2ui-expert-system.prd.md) — primarily **PRD-G1** (default-catalog generation works end-to-end) and **PRD-G7** (transport interop); supports **PRD-G6** (coherence). Honors Constraints **C1** (conform to A2UI v1.0) and **C2** (zero runtime deps).
> Realizes by ID (not by duplication): [`./a2ui-streaming-pipeline.spec.md`](./a2ui-streaming-pipeline.spec.md) **SPEC-R2** (the generation pipeline — its first PROGRAMMATIC realization) + **SPEC-R8/N1** (progressive delivery) · [`./a2ui-expert-harness.spec.md`](./a2ui-expert-harness.spec.md) **SPEC-R6** (the bounded compose→validate→self-correct loop — the loop CONTRACT stays harness §6; this SPEC realizes it in running code minus the authoring-time critic round).
> Refined by: [`../lld/a2ui-live-agent.lld.md`](../lld/a2ui-live-agent.lld.md).
> Decisions: **ADR-0069** (demo shape + security posture — the `AgentTransport` seam, layered backbone+overlay, the `VITE_` build-key-safety invariant) · **ADR-0070** (runtime loop scope) · **ADR-0071** (derived, drift-gated system prompt) · **ADR-0072** (multi-turn session model) · **ADR-0073** (the model-provider seam) · **ADR-0088** (the live conversational channel — a `note` meta-line riding beside the A2UI stream, the browser-held `TurnTrace`, and `wantResponse`-routed click→turn; extends ADR-0070/0072/0011, `AgentTransport.turn`'s signature UNCHANGED) · **ADR-0089** (teaches the agent to ASK — two hand-authored GRAMMAR-half behaviors riding ADR-0088's note-only turn: clarify-when-underdetermined + catalog-boundary negotiated approximation; extends ADR-0088/0071, NO new wire/transport/protocol surface) · **ADR-0090** (a per-turn `GenUiMode` — `default`/`specific`/`blue-sky` — that SCALES ADR-0089's clarify/negotiate grammar directive↔exploratory behind a mode-INVARIANT honesty floor, threaded via `ProduceOptions.mode` through the proxy + a dev-only switcher selector; and Structural named as the already-shipped recorded transport, a doc + a second worked example, NOT a `GenUiMode` member; extends ADR-0089/0088, NO new wire/transport/protocol surface) · **ADR-0091** (the mini-skill registry — a small, hand-curated `MiniSkill[]` registry of catalog-composition idioms selected once per turn, beside `retrieve()`, by a cheap TF-IDF/cosine intent-match (`selectMiniSkills`, reusing the SAME tokenizer/cosine primitives `retrieve()` uses, extracted to a shared `text-similarity.ts`) and composed into `buildSystemPrompt` as a `fewShot`-structural-twin segment that degrades to `''` on no match, capped at a per-turn module count under a per-module token budget so the prompt grows by at most `cap × budget` regardless of registry size; extends ADR-0090's deferred-corpus follow-up, NO new wire/transport/protocol surface; an independent post-ship review caught, and the build fixed, a real double-injection defect — the registry's three ADR-0090-seeded calibration ids are now single-sourced by the registry and filtered out of a `'blue-sky'`-mode selection, ADR-0091 §4) · **ADR-0097** (feed-embedded interactive asks — the ADR-0089 ASK gains a structured, feed-embedded surface form: an additive `ask` routing field on the ADR-0088 meta envelope whose payload rides the SAME validated stream; a page-level per-message `pending → frozen(answered|bypassed)` lifecycle over per-ask `createRenderer()` hosts; a gate-encoded feed sub-catalog partition — `FEED_SURFACE_TYPES`(23)/`FEED_EXCLUDED`(11) — reapplying the ADR-0087 lesson to a policy SUBSET view over the one catalog; ask mechanics + mode-scaled archetype vocabulary in the derived prompt; every failure path degrades to the ADR-0088 prose note, NEVER a protocol break; extends ADR-0088/0089/0090, NO renderer/package/transport-signature change). ADR-0069–0088 accepted (ADR-0088 ratified 2026-07-07); ADR-0089/ADR-0090/ADR-0091/ADR-0097 built + independently reviewed 2026-07-07 (ratification markers pending; ADR-0091's review additionally caught + the build fixed the §4 double-injection defect).
> Altitude: owns *what the live-agent example is, how it stays provable + secret-free, and how it composes the realized renderer/corpus/loop surfaces*. The concrete files/wiring are the LLD's. Requirement IDs file-scoped (`SPEC-R1…`).
>
> **Amendment (2026-07-17, docs-only — the body below is UNCHANGED, append-only):**
> [ADR-0146](../adr/0146-live-turn-lifecycle-progress-channel.md) (proposed — TKT-0083's live-turn
> lifecycle intake) extends the ADR-0088 meta-envelope with a fourth, RUNTIME-composed kind and
> generalizes when meta-lines may appear, each delta stated here: **(1)** `A2uiMetaEnvelope` (§5) gains
> `progress?: TurnProgress` — `{stage: 'sent'|'started'|'reasoning'|'content'|'validating'|'retry'|'done',
> round?, detail?}` — carried as `{"a2uiMeta":{"progress":…}}` lines that MAY INTERLEAVE DURING the turn
> (superseding the "one leading meta-line, emitted only on the round that succeeds" convention for this
> kind ONLY; `note`/`trace`/`ask` stay a single leading line). **SPEC-R5 is otherwise UNCHANGED**:
> progress is not content — it never passes `validateA2ui`, never enters the corpus/`allLines` path, and
> no A2UI content line ever streams before the whole payload validates; **SPEC-N4**'s filter-before-ingest
> rule covers the new kind identically (the versionless discriminator + `VERSION_UNSUPPORTED` fault
> isolation hold unchanged). **(2)** `AgentProvider.stream`'s request (§5, SPEC-R11) gains an OPTIONAL
> `onEvent?: (ev: ProviderEvent) => void` callback (the `effort?` additive precedent) — the Anthropic
> adapter maps its currently-discarded `message_start`/`content_block_start`/thinking-delta/`message_stop`
> SSE events onto it; adapters that ignore it are byte-behavior-unchanged, and unimplemented providers
> degrade to the stages `produce()` observes itself (SPEC-N5 isolation untouched). **(3)**
> `ProduceOptions` gains `progressDetail?: 'stages' | 'full'` (absent ⇒ `'stages'` — no raw reasoning
> text crosses the wire by default, ADR-0146 F3). **(4)** `RecordedTurn` gains `progress?: TurnProgress[]`
> replayed ahead of the turn's lines (SPEC-R2/N4 recorded↔live parity — the keyless demo demonstrates the
> feature). `AgentTransport.turn(): AsyncIterable<string>` stays BYTE-IDENTICAL (the ADR-0137-ratified
> `./agent` surface is why); ADR-0088's typed-frame upgrade trigger is weighed and re-deferred with a
> sharpened predicate (ADR-0146 F1). This is a design record only — no build has landed against this
> amendment yet.

---

## 1. Purpose

Realize the A2UI ladder's last rung (NEXT item 3): **a real LLM emitting A2UI over the wire** — prompt →
streamed payload → rendered surface → the human interacts → client messages return → the agent
continues. It is the first programmatic realization of the compose→validate loop the expert harness
(SPEC-R6) expresses only procedurally, and the concrete realization of the streaming pipeline's
generation driver (streaming SPEC-R2 / LLD-C2).

It composes surfaces that already exist and are not redesigned here: the renderer host
(`createRenderer()` — `ingest`/`mount`/`onClientMessage`/`finalize`/`dispose`), the shared
`heal`+`validateA2ui` validator, `retrieve()` over the judged corpus shard, and the default catalog as
the sole component authority. Its own scope is the **integration**: the transport seam, the runtime
loop, the derived prompt, the round-trip session, and — load-bearing — the **security posture and the
deterministic backbone** that keep a non-deterministic, key-requiring live call OUT of CI while still
proving the whole wiring.

Three facts constrain every requirement: the package stays **zero-dep** (the live infra lives in
`site/`/`tools/`, never the package); the site is a **static Vite MPA** and a **browser cannot hold a
secret**; and a **live model call cannot be a standing gate**. The design's answer is a layered demo
isolated behind one interface (ADR-0069).

## 2. Definitions

- **AgentTransport** — the isolation seam (ADR-0069): `turn(input) → AsyncIterable<string>` yielding
  A2UI JSONL lines. The page consumes only this; where the stream originates lives behind it.
- **Backbone** — the deterministic `RecordedTransport`: replays a committed transcript of real captured
  turns. Default; the only thing CI exercises. **Structural Gen UI (ADR-0090 §3) is this same backbone,
  named as a first-class pattern:** "load a pre-generated, pre-validated JSONL transcript, render it
  through the existing `AgentTransport`/`createRenderer` seam, with zero live model, zero API key, zero
  network call." It is NOT a `GenUiMode` value — a transport choice at a different layer (see the `mode`
  definition below), documented via a doc + a second committed worked example
  (`tools/agent/structural-transcript.ts`), never a new mechanism.
- **Live overlay** — the opt-in dev-server proxy transport: a real model call, key-held server-side.
- **Gen-UI `mode`** (ADR-0090 §1/§4) — a per-turn `GenUiMode` (`'default' | 'specific' | 'blue-sky'`,
  `tools/agent/gen-ui-mode.ts`) that SCALES the ADR-0089 clarify/negotiate GRAMMAR-half behaviors between a
  directive `'specific'` disposition and an exploratory `'blue-sky'` disposition, threaded from the proxy
  request body through `ProduceOptions.mode` into `buildSystemPrompt`. An absent `mode`, and `'default'`,
  reproduce the pre-ADR-0090 ADR-0089 grammar byte-for-byte (zero regression). The mode-invariant honesty
  floor (never invent a component/prop, never silently substitute one) holds identically in EVERY mode —
  a mode scales only whether the agent asks / proposes an approximation, never the SPEC-R9 allowlist.
  Orthogonal to Structural (above): `mode` conditions the LIVE path's prompt; Structural means "don't run
  the live path at all."
- **Mini-skill** (ADR-0091 §1/§2/§3) — a named, self-contained, prompt-injectable idiom-instruction
  module (`{id, triggers, body}`, `tools/agent/mini-skills.ts`) scoped to ONE UI composition idiom (a
  settings screen, a dashboard, a card-game sheet, …) — the catalog-specific "anatomy → mapping → wall"
  knowledge a general model cannot have about this catalog. A static, hand-curated `MINI_SKILLS` registry
  (5 entries — ADR-0090's five calibration examples at general maturity) is selected once per turn by
  `selectMiniSkills(intent, registry, cap)`, a TF-IDF/cosine top-`cap` ranking over each entry's
  `triggers` field (`src/corpus/text-similarity.ts`'s `topKByCosine` — the SAME math `retrieve()` uses,
  extracted so there is exactly ONE implementation). Selection degrades to `[]` on zero vocabulary overlap
  or a non-positive `cap`/registry, mirroring `retrieve()`'s and `fewShot`'s degrade-to-empty discipline —
  and, unlike `retrieve()`, NEVER pads the result with a genuinely unrelated (zero-score) module.
  `buildSystemPrompt` composes the selection — first passed through `miniSkillsFor(mode, selected)` — as a
  `fewShot`-structural-twin segment (`miniSkillsBlock`) that renders `''` on an empty selection. The block
  composes IDENTICALLY across modes for any selected entry NOT among the three ADR-0090 ★ calibration ids
  (`card-game-sheet`/`settings-screen`/`dashboard-kpi-grid`); in `'blue-sky'` mode ONLY, `miniSkillsFor`
  excludes those three from the selection BEFORE `miniSkillsBlock` composes it, because their `body` is
  already inlined verbatim inside blue-sky's own `NEGOTIATE_BLUE_SKY` grammar (via
  `calibrationExampleBullet`) — composing them again here would double-inject the identical paragraph
  (ADR-0091 §4 fix). `'specific'`/`'default'`/absent `mode` carry none of that inlined prose, so the
  registry selection injects all three normally there. Orthogonal to `retrieve()`'s worked-EXEMPLAR
  conditioning (SPEC-R7) — the two channels COEXIST: mini-skills are the INSTRUCTION-shaped complement,
  never a replacement.
- **Feed-embedded ask** (ADR-0097 §1/§2) — a small, single-purpose A2UI surface rendered inline in its own
  chat message, so an ADR-0089 clarify/negotiate ASK becomes clickable structured UI instead of a typed
  reply. Declared by an additive `ask: {surfaceId}` field on the SAME leading meta-line as `note`
  (`AskDeclaration`, `tools/agent/meta-line.ts`); the ask's UI is ORDINARY A2UI (`createSurface`/
  `updateComponents`/`updateDataModel`) targeting that fresh surface id on the SAME validated stream — no
  protocol extension. One page-level `createRenderer()` host renders it into that turn's own message
  bubble; its lifecycle is `pending → frozen(answered|bypassed)` (freeze when the dispatched turn COMPLETES
  — a halted/errored turn leaves the pending ask pending, SPEC-R8 — at most one ask is ever pending). The
  answer round-trips on ALREADY-SHIPPED machinery: the ask surface is created
  with `sendDataModel: true` and its one commit Button's action (SPEC-R8) carries the surface's data model
  back as the next turn. Every failure path (a broken `ask` declaration, an out-of-scope payload) degrades
  to the ADR-0088 prose note — never a protocol break.
- **Feed sub-catalog** (ADR-0097 §3 / SPEC-R15) — a gate-encoded TOTAL PARTITION of the default catalog's
  component types into `FEED_SURFACE_TYPES` (23 — what a feed ask MAY host: choice controls, value inputs,
  one commit affordance, light structure) and `FEED_EXCLUDED` (11, each carrying a recorded reason — what
  it may NEVER host: overlay/paginating/dashboard controls). A STRICTER POLICY VIEW over the one catalog,
  never a second catalog — the render-time SPEC-R9 allowlist is untouched and unwidened by any mode.
- **Turn / Session** — a turn is one agent generation (`user` = intent or a framed client message;
  `assistant` = the emitted A2UI stream); a session is the ordered turn list (ADR-0072).
- **Note / meta-line** (ADR-0088 §1) — a short natural-language rationale/reply the agent emits for a
  turn, carried as a reserved leading JSON line (`{"a2uiMeta":{"note":"…"}}`) on the SAME
  `AgentTransport.turn()` stream, ahead of any A2UI JSONL. It carries no `version` key, so it is provably
  NOT an `A2uiServerMessage`; it rides beside the validated payload, never inside it, and is peeled off
  before `heal`/`validateA2ui` and before the browser's render/corpus paths. A turn MAY emit a note with
  zero A2UI lines (a "why" answer with no UI change — or, per ADR-0089, a clarifying question when the turn
  is underdetermined, or a catalog-boundary ask before approximating) — a clean success, not a halt.
- **TurnTrace** (ADR-0088 §2) — a compact, browser-held, per-turn record (`turnIndex`, the `retrieve()`
  query, matched `exemplarIds`, self-correct `rounds`, healer `healed` count, `failureCodes`, `model`)
  carried on the same meta-line as the note. It lives parallel to `Session.turns` (never inside it, never
  on the validated A2UI wire) and grounds a later "why X vs Y" turn in the run's real retrieval/
  correction history instead of a retroactive confabulation.
- **Runtime loop** — the bounded generate → `heal`+`validate` → self-correct → validated-stream driver
  (ADR-0070), the SPEC-R6 contract minus the authoring-time critic round.
- **AgentProvider** — the injected `stream({model,system,messages,signal}) → AsyncIterable<string>`
  seam (ADR-0073); one isolated module per provider (Anthropic implemented this wave, OpenAI/Gemini the
  next slices); each module is its provider's single upstream-format (SSE → text) boundary.
- **Provider registry** — the committed `providers.json` (ADR-0073): the single source of truth for the
  in-chat switcher menu AND the proxy allowlist; env-var NAMES + public endpoints/model-ids, no secrets.

---

## 3. Requirements

Normative per RFC 2119; each carries an ID, an upstream trace, and acceptance criteria. Acceptance
criteria are checkable predicates — a command, a standing test, a grep, or a named manual run.

### 3.1 Shape, isolation, and CI safety

**SPEC-R1 — Transport-isolated client.** The page/client MUST consume the A2UI stream ONLY through the
`AgentTransport` interface (ADR-0069); no rendering, round-trip, loop, or prompt logic may depend on
*where* the stream originates. Swapping the backbone for the live overlay (or a future client-direct
transport) MUST require no page edit. *(→ PRD-G7; realizes streaming SPEC-R3 transport-agnosticism)*
- **AC1** *Given* the page module, *when* grepped, *then* it imports only `AgentTransport` (no direct
  `fetch`, proxy URL, or `RecordedTransport`/`LiveProxyTransport` internal) — the swap point is the
  construction site alone.
- **AC2** *Given* the page, *when* its transport is switched `RecordedTransport → LiveProxyTransport`,
  *then* no other page line changes (the seam proof).

**SPEC-R2 — Deterministic recorded backbone (always-on, gate-covered).** The demo MUST ship a
`RecordedTransport` that replays a committed transcript with no network and no key; it MUST be the
default the built static site runs and the shape CI exercises. Turn-1's payload MUST reuse a committed
shelf seed so its validity is already covered by `examples.test.ts`. **This backbone IS Structural Gen UI
(ADR-0090 §3), documented as a first-class, first-CLASS-supported pattern, not merely an internal demo
fixture:** a SECOND committed `RecordedTranscript` (`tools/agent/structural-transcript.ts`) MUST exist,
composed ONLY of real catalog component types, gated by the SAME `validateA2ui`/`examples.test.ts`/
`round-trip.test.ts` precedent (no parallel check), demonstrating that any deployment MAY mint its own
`RecordedTranscript` and hand it to `createRecordedTransport(transcript)` to render pre-generated,
pre-validated JSONL with zero live model, zero API key, zero network call. *(→ PRD-G1; the `a2ui-stream`
precedent)*
- **AC1** *Given* the committed transcript, *when* a standing packages-tree test drives it through a
  real `createRenderer()` host + the session reducer, *then* turn-1 renders, a simulated interaction
  emits the expected client message, and turn-2 ingests + updates the surface — deterministic;
  `npm test` green with no key/network.
- **AC2** *Given* the SECOND worked transcript (`structural-transcript.ts`), *when* `structural-transcript.test.ts`
  runs, *then* `validateA2ui` verdicts 0-failure on every turn, a real `createRenderer()` host renders both
  turns' surfaces with an empty error channel, and `createRecordedTransport(transcript)` replays each turn's
  `note` meta-line ahead of byte-identical `lines` — deterministic, `npm test` green, no live model, no key,
  no network.

**SPEC-R3 — Secret-free, deterministic CI.** No standing gate (`npm run check`, `npm test`,
`npm run test:browser`) MAY invoke a live model call or require a key. The live overlay MUST be a
strictly opt-in, dev-only path. No API key MAY appear in committed source or the built static output.
*(→ Constraint C2; the `size` manual-gate precedent, ADR-0040 §3)*
- **AC1** *Given* the repo, *when* grepped, *then* no committed key literal exists and no
  `@anthropic-ai/sdk` import exists anywhere (plain `fetch` only); the dev proxy reads the key from
  `process.env` alone.
- **AC2** *Given* `npm run check && npm test && npm run test:browser`, *when* run with no
  `ANTHROPIC_API_KEY`, *then* all pass (the live overlay never gates).

### 3.2 The runtime loop and its conditioning

**SPEC-R4 — Bounded runtime loop, deterministic gate only.** The system MUST produce each turn's
payload by: retrieve exemplars → generate → `heal` + `validateA2ui` (the SHARED surfaces, no fork) →
on failure feed the validator's structured failures back → bounded at `maxRounds = 3` → halt-and-report.
The deterministic gate is the whole runtime verifier; there MUST be NO runtime rubric-grading round
(the `a2ui-payload` rubric + `a2ui-reviewer` critic are authoring/eval-time — ADR-0070). *(→ PRD-G1,
PRD-G4; realizes streaming SPEC-R2, harness SPEC-R6)*
- **AC1** *Given* a stub `generate()` returning first-invalid-then-valid (no live model), *when* the
  driver runs, *then* it emits ONLY the validated stream within the bound, the invalid round's failures
  are fed back, and exhaustion halts-and-reports — a deterministic unit test, `npm test` green.
- **AC2** *Given* the driver's validation step, *when* compared to the renderer's and corpus
  admission's, *then* all use the same `validateA2ui`/`heal` (parity; no fork — streaming SPEC-N3).

**SPEC-R5 — Validate-then-stream.** A turn's payload MUST be FULLY validated before any of its lines
stream to the browser (provable validity precedes paint — PRD-G4). The validated payload MUST then be
streamable line-by-line so the surface still assembles progressively (root-early first paint), and the
browser transport MUST be identical for the recorded and live paths. A turn MAY additionally carry a
natural-language `note` (+ a `TurnTrace`) on a reserved leading meta-line of the SAME stream (ADR-0088
§1) — this framing convention rides BESIDE the validated A2UI payload, never inside it: it MUST NEVER be
passed to `validateA2ui`, MUST NEVER enter the corpus/`allLines` path, and MUST NOT gate or delay
progressive paint of the lines that follow it. **The SAME meta-line MAY additionally carry an `ask`
routing declaration (ADR-0097 §1, SPEC-R14) — its payload is ORDINARY A2UI targeting a fresh surface id on
this SAME validated stream; this requirement (validate-then-stream) is UNCHANGED by that addition — the
ask's lines are validated and streamed exactly like any other surface's.** *(→ PRD-G4; streaming
SPEC-N1/R8)*
- **AC1** *Given* a live turn, *when* the surface first paints, *then* the whole turn's payload has
  already passed `validateA2ui` (no invalid partial surface is ever rendered); *given* both transports,
  *then* the browser ingests validated JSONL lines through one code path.
- **AC2** *Given* a turn's raw model output carrying a leading meta-line, *when* `produce()` processes
  it, *then* the meta-line is peeled off BEFORE `heal`/`validateA2ui` (never fed to the validator, never
  wasting a self-correct round on prose) and is yielded FIRST, ahead of the validated A2UI lines; *given*
  a note-only round (a meta-line with zero remaining A2UI lines), *then* `produce()` returns cleanly (a
  success, not `ProduceHalt`) — a deterministic unit test, `npm test` green, no live model. *given* a
  meta-line reaching the renderer's `dispatch()` unfiltered (defense-in-depth), *then* its missing
  `version` key routes it to `VERSION_UNSUPPORTED`, returned not thrown — fault-isolated, never a crash.

**SPEC-R6 — Catalog-derived, drift-gated system prompt.** The machine system prompt MUST be DERIVED
from `catalog.json` (the sole component authority) + the `a2ui-compose` grammar + the `retrieve()`
few-shot block — never hand-maintained. A standing test MUST assert the derived prompt's component/prop
inventory equals the catalog's, so a catalog row added without regeneration fails. The hand-authored
GRAMMAR half (distinct from the catalog-derived inventory) MUST additionally instruct two ASK behaviors
(ADR-0089, extending ADR-0088's note-only turn): (a) **clarify-when-underdetermined** — when a request has
no actionable referent ("make it better", "add more stuff", "fix it") the agent MUST emit a note-only turn
asking ONE qualifying question and NO A2UI, while a request actionable with a sensible default ("build me a
form", "a login screen") MUST still be built, not deferred; (b) **catalog-boundary negotiated
approximation** — when a request needs a component the catalog lacks, the agent MUST NOT invent a type or
silently substitute one, but MUST instead emit a note-only turn naming the limit and proposing an
approximation built EXCLUSIVELY from EXISTING catalog components, and only after the user agrees build that
approximation (using ONLY catalog types) and disclose in the note that it is an approximation. These two
additions MUST live ONLY in the GRAMMAR half; the catalog-derived inventory and its drift gate stay
UNTOUCHED, and NEITHER behavior may EVER license emitting an uncatalogued component/prop (the render-time
security allowlist, SPEC-R9, is unchanged). *(→ PRD-G6; ADR-0071, ADR-0089)*

**The `mode` axis SCALES these two ASK behaviors (ADR-0090 §1/§2/§4).** `buildSystemPrompt` MUST accept an
OPTIONAL third parameter, a per-turn `GenUiMode` (`'default' | 'specific' | 'blue-sky'`), that composes the
GRAMMAR half's clarify/negotiate paragraphs into ONE of three dispositions: an ABSENT `mode`, or
`'default'`, MUST reproduce the pre-mode ADR-0089 grammar BYTE-FOR-BYTE (zero regression); `'specific'`
MUST dial clarify-when-underdetermined and catalog-boundary negotiation DOWN (prefer a direct catalog
mapping; at the wall, decline-and-redirect to the curated set rather than propose composing a novel
approximation); `'blue-sky'` MUST dial both UP (a lower clarify threshold, several welcome clarifying
rounds, more elaborate approximations narrated via the note channel). The never-invent-a-type honesty
floor MUST be lifted into an INVARIANT spine every mode carries identically — NO mode may EVER license
emitting an uncatalogued component/prop, widen the SPEC-R9 allowlist, or make the agent pass off a
wrong-but-valid surface as the real thing; only WHETHER the agent asks / proposes an approximation may
scale by mode. `mode` MUST condition ONLY the GRAMMAR half — the catalog-derived inventory and its drift
gate stay UNTOUCHED regardless of mode.
- **AC1** *Given* `buildSystemPrompt(catalog, exemplars)`, *when* read, *then* the component inventory
  is derived from `catalog.json` at run time (no hand-listed set); *when* the drift test runs, *then*
  the derived inventory equals `Object.keys(catalog.components)` and each row's props, and a planted
  catalog row absent from the prompt makes it FAIL (negative control); `npm test` green.
- **AC2** *Given* `buildSystemPrompt(catalog, [])`, *when* read, *then* its GRAMMAR half contains the
  clarify-when-underdetermined instruction (carrying Kim's act-vs-clarify calibrating examples — "make it
  better" clarifies, "build me a form" builds) and the catalog-boundary honesty + ask-before-approximate
  instruction; every "approximate" mention is paired with an "ONLY/EXCLUSIVELY … catalog" constraint, no
  wording grants leave to go "beyond the catalog", and the derived `## Available components` section carries
  NONE of the clarify/boundary prose. A standing `system-prompt-grammar.test.ts` asserts all of this and
  `prompt-drift.test.ts` stays green (the additions are in the grammar half, not the derived inventory);
  `npm test` green, no live model.
- **AC3** *Given* `buildSystemPrompt(catalog, [], /* absent */)` and `buildSystemPrompt(catalog, [],
  'default')`, *when* compared, *then* both are byte-identical to **the literal `GRAMMAR` constant**
  (`system-prompt.ts`) — the invariant is "default ≡ the constant", not a frozen historical snapshot, so
  the constant MAY grow (as ADR-0097's ask mechanics did) without this AC ever lying; *given*
  `buildSystemPrompt(catalog, [], 'specific')` and `('…', 'blue-sky')`, *when* read, *then* each carries its
  dialed disposition, and ALL THREE (plus the default) carry the mode-invariant honesty floor verbatim and
  a derived `## Available components` section free of ANY mode prose — `system-prompt-grammar.test.ts`'s
  mode-axis block, `npm test` green, no live model.

**The GRAMMAR half additionally carries feed-embedded ask mechanics + archetype vocabulary, mode-scaled
(ADR-0097 §4, SPEC-R14).** Beside the note-line instruction, the GRAMMAR half MUST teach: an INVARIANT
mechanics block — present, verbatim-identical, in EVERY mode — instructing how to emit a feed ask (the
meta `ask` field; a fresh `ask-<n>` surface id; `sendDataModel: true`; EXACTLY ONE commit Button with
`wantResponse` omitted; the payload is the ask surface ONLY, no canvas change in the same turn; AT MOST one
ask per turn; the note-standalone rule — the note MUST always carry the full question in prose, since it is
the ask's own ADR-0088 degrade path) plus a feed-allowed component-type list DERIVED from
`FEED_SURFACE_TYPES` (`feed-catalog.ts`, SPEC-R15) at composition time, so drift between the two is
impossible by construction; and a mode-SCALED archetype vocabulary teaching the five recipes (closed
single-choice, multi-select, typed-value, boundary-negotiation option cards, confirm/cancel) — `'default'`
carries ONLY a terse balanced one-liner (never the full per-mode teaching); `'specific'`/`'blue-sky'` each
carry their OWN disposition prose (asks stay rare / prefer structured asks) plus the compact five-archetype
recipes. NO mode may EVER widen the feed-allowed list beyond `FEED_SURFACE_TYPES`, and the mode-invariant
honesty floor (above) applies identically to a feed ask's payload.
- **AC5** *Given* `buildSystemPrompt(catalog, [])` (any mode), *when* read, *then* the mechanics block is
  present, byte-identical, in `undefined`/`'default'`/`'specific'`/`'blue-sky'`, its feed-allowed list
  SET-EQUALS `FEED_SURFACE_TYPES`, and none of it leaks into the derived `## Available components` section;
  *given* the `'default'` composition, *then* it carries ONLY the terse balanced archetype line, never the
  full per-mode teaching; *given* `'specific'`/`'blue-sky'`, *then* each carries its OWN dialed disposition
  plus all five archetype recipes — `system-prompt-grammar.test.ts`, `npm test` green, no live model.

**A mini-skill block composes as an orthogonal segment, mode-FILTERED at the composition site (ADR-0091
§2/§3, ADR-0091 §4 fix).** `buildSystemPrompt` MUST accept an OPTIONAL fourth parameter, a per-turn
selection of `MiniSkill` modules (`readonly MiniSkill[]`, SPEC-R13), and append it as ONE new composed
block AFTER the few-shot exemplars — a structural twin of the existing `fewShot` segment: it MUST render
`''` when the selection is empty or absent (reproducing the pre-ADR-0091 prompt BYTE-FOR-BYTE — the same
zero-regression discipline the `mode` parameter itself proves) and otherwise render the selected modules'
`body`s under one header. The block MUST compose from the MODE-FILTERED selection (`miniSkillsFor(mode,
selected)`): for any selected entry NOT among the three ADR-0090 ★ calibration ids
(`card-game-sheet`/`settings-screen`/`dashboard-kpi-grid`), composition MUST be IDENTICAL regardless of
`mode`; but when `mode === 'blue-sky'`, those three specific ids MUST be excluded from the block, because
their `body` text is already inlined verbatim inside blue-sky's own `NEGOTIATE_BLUE_SKY` grammar paragraph
— composing them again here would double-inject the identical paragraph in one prompt. In
`'specific'`/`'default'`/absent `mode`, none of that prose is inlined anywhere, so the selection MUST
compose all three normally there, same as any other id. This filtering MUST NOT alter the catalog-derived
inventory or its drift gate. Selection ITSELF (what gets chosen, and its anti-bloat bound) is governed by
SPEC-R13; this requirement covers only the COMPOSITION seam.
- **AC4** *Given* `buildSystemPrompt(catalog, [])` (the 4th parameter omitted) and
  `buildSystemPrompt(catalog, [], undefined, [])`, *when* compared, *then* both are byte-identical (zero
  regression), and this byte-identity holds across all four `mode` values (`undefined`, `'default'`,
  `'specific'`, `'blue-sky'`) even with the §4 filter in place; *given* a non-empty `miniSkills` selection
  and `mode !== 'blue-sky'` (including absent/`'default'`), *when* read, *then* the prompt appends ONE
  `## Composition idioms` block after the few-shot examples, containing exactly the selected `body`s;
  *given* the same selection with `mode === 'blue-sky'`, *when* read, *then* the block instead contains
  exactly the selected `body`s MINUS any of the three ADR-0090 ★ ids (`card-game-sheet`/`settings-screen`/
  `dashboard-kpi-grid`) — each of those three still appears in the prompt exactly ONCE, via the inlined
  `NEGOTIATE_BLUE_SKY` calibration bullet rather than the `## Composition idioms` block — a standing
  `system-prompt-grammar.test.ts` assertion (the ADR-0091 §4 fix regression block, lines 300-368),
  `npm test` green, no live model.

**SPEC-R7 — Retrieval conditioning.** Generation MUST be conditioned by `retrieve()` top-k exemplars
over the JUDGED shard, co-located with the key-holder (proxy-side for the shipped default — the Node
`fs-store` loads the shard). *(→ PRD-G5 conditioning surface; ADR-0069 Fork C)* `retrieve()` conditions
generation with worked EXEMPLARS ONLY, and continues to do so UNCHANGED — it MUST NOT be extended to also
carry instruction-shaped mini-skill modules. Mini-skill selection (the registry + `selectMiniSkills`
contract) is a SEPARATE, registry-backed conditioning step specified on its own below; the two channels
COEXIST in one composed prompt (ADR-0091 §1/§5) and MUST NOT be conflated — an exemplar record's schema
(`a2uiOutput` required) is not relaxed to also host instruction-only mini-skill prose.
- **AC1** *Given* the loop, *when* it generates, *then* `retrieve(store.all(...), {intent,k,catalogId,
  protocolVersion})` is invoked and its output lands in the derived prompt's few-shot block (asserted
  deterministically over the committed shard — no model).

**SPEC-R13 — Mini-skill registry & selection (the instruction-shaped conditioning complement).** *(→
PRD-G6; ADR-0091)* Beside `retrieve()`'s worked-exemplar conditioning (SPEC-R7), the system MUST maintain
a small, hand-curated,
committed registry of named idiom-instruction modules (`MiniSkill { id, triggers, body }`) and MUST
select, ONCE per turn (alongside `retrieve()`, at the SAME pre-loop position — `system` is built once,
outside the round loop, and never rebuilt per round), up to a fixed per-turn cap of the modules whose
`triggers` best match the turn's intent via a TF-IDF/cosine ranking — REUSING the SAME tokenizer/cosine
primitives `retrieve()` uses (one shared implementation, never a second one), and NEVER the
`CorpusRecord` schema or its admission pipeline. Selection MUST degrade to an empty result — and MUST
NEVER pad the result with a genuinely unrelated (zero-score) module to fill the cap — when the turn
shares no idiom vocabulary with any registry entry, or the cap or registry is non-positive/empty. Each
registry entry's `body` MUST stay at or under a per-module token budget, and no turn's selection MAY
exceed the per-turn cap, so the composed prompt (SPEC-R6 AC4) grows by at most `cap × budget` REGARDLESS
of registry size. Since a `body` is a pure-prose instruction module, never a worked example, NO registry
`body` MAY embed A2UI JSONL at all. Selection QUALITY
(whether the *best* idiom was matched to a turn) is NOT a runtime gate (live-prompt behavior, caught by
observation — mirroring ADR-0070's stance on per-mode disposition) — only the budget/cap and any embedded
example's validity are mechanically checked. *(→ PRD-G6; ADR-0091)*
- **AC1** *Given* `selectMiniSkills(intent, registry, cap)`, *when* `intent` shares no vocabulary with any
  `registry` entry, OR `cap <= 0`, OR `registry` is empty, *then* it returns `[]`; *given* a matching
  intent, *then* it returns the top-`cap` matches ranked by cosine score, deterministically tie-broken by
  `id` — a standing unit test, `npm test` green, no live model.
- **AC2** *Given* every entry in the committed registry, *when* measured (the `chars / 4` token estimate),
  *then* its `body` is at or under the per-module token budget; *and*, *when* every `body` is checked for
  an embedded A2UI message marker, *then* NONE embeds one (`"version":"v1.0"` never appears in a `body` —
  a registry entry is pure-prose instruction, never a worked example) — a standing test
  (`mini-skills.test.ts:40`), `npm test` green.
- **AC3** *Given* the runtime loop (SPEC-R4), *when* it composes a turn's prompt, *then*
  `selectMiniSkills` runs exactly ONCE per turn, alongside `retrieve()`, and its result feeds
  `buildSystemPrompt`'s mini-skill parameter (SPEC-R6 AC4) — never re-run per self-correct round.

### 3.2a Feed-embedded interactive asks (ADR-0097)

**SPEC-R14 — Feed-embedded ask surfaces: wire + lifecycle + degrade.** The system MUST let the ADR-0089
ASK take a structured, feed-embedded surface form, coupled across three layers, all degrading to the
ADR-0088 prose note on ANY failure — NEVER a protocol break. *(→ PRD-G1/G6; ADR-0088/0089/0090/0097)*
- **Wire.** The meta envelope (SPEC-R5) gains one additive `ask: {surfaceId: string}` field on the SAME
  leading meta-line as `note`; the ask's UI MUST be ORDINARY A2UI (`createSurface`/`updateComponents`/
  `updateDataModel`) targeting that surface id on the SAME validated stream — the shared `validateA2ui` is
  UNCHANGED (no ask-aware fork). `produce()` MUST verify ask INTEGRITY after the shared validator passes:
  an `ask` naming a surface NO payload line creates, or colliding with a surface already known to the
  session, MUST be DROPPED from the outgoing meta-line (the note stands) — NEVER a self-correct round,
  NEVER a halt. `RecordedTurn`/`createRecordedTransport` MUST be able to carry the identical `{note, ask}`
  meta-line shape for parity between the recorded and live paths (SPEC-R5/N4).
- **Lifecycle.** The page MUST mount one fresh `createRenderer()` host per ask, into that turn's OWN
  message bubble (never the shared canvas host/mount). Each ask's state MUST be `pending →
  frozen(answered|bypassed)`; freeze MUST fire once any subsequent dispatched turn COMPLETES (SPEC-R8 AC5)
  — a turn that halts or errors instead MUST leave the pending ask pending (SPEC-R8's guarantee, below); a
  frozen ask MUST remain VISIBLE (never disposed — history stays truthful) but non-interactive (`inert` + a
  `data-state` marker + a visible annotation); a line arriving for an ALREADY-FROZEN ask surfaceId MUST be
  dropped and counted, never ingested anywhere. Reset MUST dispose every ask host and clear the registry
  alongside the existing canvas dispose.
- **Degrade.** A consumer that does not recognize `ask` MUST drop the unknown field (the ADR-0088
  `readMetaLine` reconstruction) and render the ask's lines as an ORDINARY canvas surface — visible,
  interactive, answerable by typing; mildly misplaced, never broken. An ask-integrity failure (wire,
  above) or an out-of-scope payload (SPEC-R15) MUST drop the structured form; the note-standalone rule
  (SPEC-R6) guarantees the question survives as prose either way.
- **AC1** *Given* `readMetaLine`, *when* fed `{note, ask:{surfaceId}}`, *then* it round-trips both fields;
  *given* a malformed `ask` (non-object, or a missing/non-string `surfaceId`), *then* the envelope returns
  WITHOUT `ask` (note/trace still parse) — `meta-line.test.ts`, `npm test` green.
- **AC2** *Given* a stub `produce()` run emitting `meta{note,ask}` + a payload that creates that surface,
  *when* it completes, *then* the meta-line ships FIRST with `ask` intact, followed by the validated lines;
  *given* an `ask` naming a surface no payload line creates, OR colliding with a surface the session
  already knows about, *then* the outgoing meta-line ships WITHOUT `ask` (never a halt, never a retry) —
  `produce-loop.test.ts`, `npm test` green, no live model.
- **AC3** *Given* a site vitest/browser test driving a stubbed ask surface into a message bubble, *when*
  the surface renders, *then* it is a REAL, clickable `createRenderer()`-hosted control tree; *given* an
  out-of-scope component type on an ask-routed line reaches the page (defense-in-depth), *then* the WHOLE
  ask drops to the note — NO partial render — `check:site` + `npm test`/`test:browser` green, no key, no
  live model.

**SPEC-R15 — The feed sub-catalog partition gate.** The system MUST maintain a gate-encoded TOTAL
PARTITION of the default catalog's component types into `FEED_SURFACE_TYPES` (what a feed ask MAY host)
and `FEED_EXCLUDED` (what it may NEVER host, each entry carrying a recorded reason). *(→ PRD-G6; ADR-0087,
ADR-0097 §3)* This reapplies the ADR-0087 lesson (a hand-frozen allow/deny list drifts silently) to a
POLICY subset view over the ONE catalog; the render-security allowlist that gates every OTHER surface
type is UNTOUCHED and never widened by this partition or by any `GenUiMode`. A standing test MUST assert
`FEED_SURFACE_TYPES ∪ FEED_EXCLUDED` equals the catalog's full component set EXACTLY and DISJOINTLY, so a
future catalog addition landing in NEITHER set is CI-visible until dispositioned; composite families (e.g.
`RadioGroup`/`Radio`, `Card`/its sub-types, `Tabs`/`Tab`+`TabPanel`) MUST stay IN or OUT TOGETHER. THREE
independent points MUST derive from this ONE artifact, never a re-spelled copy: the derived prompt's
feed-allowed list, the producer's post-validation FEED_SCOPE self-correct gate (a produce-layer-only
failure code, carried on `TurnTrace.failureCodes: string[]` — NEVER joining the protocol's closed
`ErrorCode` union), and the page's own fail-closed defense-in-depth check.
- **AC1** *Given* the partition artifact, *when* compared against `Object.keys(catalog.components)`,
  *then* the union is EXACT and disjoint, every named composite family is IN/OUT together, and a planted
  undispositioned type FAILS the union check (negative control) — a standing test, `npm test` green.
- **AC2** *Given* an ask-routed surface hosting an out-of-scope type (e.g. `Modal`), *when* `produce()`
  validates it (AFTER the shared `validateA2ui` passes), *then* it feeds back a round naming `FEED_SCOPE` +
  the offending type and succeeds on a corrected retry — `produce-loop.test.ts`, `npm test` green, no live
  model; the shared `validateA2ui` call sites are UNCHANGED in the diff (SPEC-N3 parity).

### 3.3 The round-trip

**SPEC-R8 — Multi-turn client round-trip ("the agent continues").** A client message from
`onClientMessage` (`action` | `functionResponse` | `error`) MUST become the next turn's user input via
a pure reducer (framing each arm distinctly — ADR-0072), and turn N+1's payload MUST be able to
continue the SAME surface (`updateComponents`/`updateDataModel` patch) or open a new one — both via the
existing host. The proxy MUST be stateless (the browser holds the turn history); a demo-level max-turns
cap MUST guard runaway. Not every client message MUST become a full visible turn: the `action` arm's
`wantResponse` flag (already authored by the agent per-action, ADR-0011) MUST route this decision
(ADR-0088 §3) — `wantResponse === false` MUST silently apply the interaction (no chat entry, no
LLM round-trip); `wantResponse === true` OR absent MUST run the full turn — **absent is opt-out, not
opt-in** (back-compat: the shipped seed and every existing corpus action button set no `wantResponse`
and MUST keep turning). `functionResponse` and `error` arms MUST always run a turn (agent-directed by
construction). The turn's own emitted stream MAY carry a `note` (ADR-0088 §1) — the agent's own prose for
that turn, distinct from and never confused with `wantResponse`'s *inbound*-click routing. A turn's note
MAY additionally BE a note-only ASK (ADR-0089) — a clarifying question on an underdetermined turn, or a
catalog-boundary ask before approximating — emitted as a note with zero A2UI lines; the user's answer then
arrives as an ordinary `intent` turn (a SINGLE clarification round connected by session history, NOT a
dialog tree or agent-held plan state). *(→ PRD-G1; realizes the "agent continues" of NEXT item 3)*
- **AC1** *Given* a client `action`, `functionResponse`, and `error`, *when* each passes the reducer,
  *then* each yields a distinct next-turn user content (unit test); *given* the recorded transcript,
  *when* the round-trip gate drives it, *then* the reducer's framing of turn-1's client message matches
  the transcript and turn-2 updates the surface.
- **AC2** *Given* an `action` client message, *when* the routing predicate inspects `wantResponse`,
  *then* `false` suppresses the turn, and `true` or absent still turns (the back-compat default) — a
  deterministic unit test over the predicate, plus an end-to-end page-level test driving a REAL click on
  the shipped seed's button (`wantResponse` absent) through to a full visible turn.
- **AC3** *Given* a recorded or live turn whose emitted stream includes a leading `note` meta-line,
  *when* the page renders the turn, *then* the note is shown VERBATIM as the agent's response, in place
  of the mechanical kind-tally fallback (`summarize()`) — which remains the fallback ONLY for a turn
  carrying no note (e.g. a recorded turn authored before this note existed) — deterministic, asserted
  by driving the note through the REAL `AgentTransport` seam (not merely present in a source fixture).
- **AC4** *Given* a stub provider returning a note-only clarifying turn for an underdetermined intent
  ("make it better") and, separately, a note-only catalog-boundary ask ("build me a data table"), *when*
  `produce()` runs each, *then* each yields the meta-line and ZERO A2UI lines and returns cleanly (no
  `ProduceHalt`, empty A2UI ≠ invalid) — asserted by `system-prompt-grammar.test.ts`; the page then renders
  the note as a normal agent message through the SAME ADR-0088 note-render path (no new wire field, no page
  change). Deterministic unit, `npm test` green, no live model.

**A feed-embedded ask's structured answer is the EXISTING action arm — zero round-trip extension
(ADR-0097 §1/§2, SPEC-R14).** An ask surface's one commit Button's `action` (with `wantResponse` omitted,
so it still routes to a full turn per the back-compat default above) carries `surfaceId`+`context`+the
FULL surface data model (`sendDataModel: true`, already an existing `A2uiAction` field) into the SAME
reducer/`frameClientMessage`/`shouldRunTurn` path any other action already rides — NO new client-message
kind, NO new reducer arm. **Freeze semantics (page-level, LLD-C9):** COMPLETING any subsequent dispatched
turn (an ask's own commit, an unrelated canvas action, or a typed prose reply) MUST freeze whatever ask was
pending BEFORE that turn — `'answered'` if the dispatching action's `surfaceId` IS that ask, `'bypassed'`
otherwise; a `wantResponse: false` silent apply (which never reaches a full turn) MUST freeze nothing. At
most ONE ask is ever pending, by construction of AT-MOST-ONE-ask-per-turn (SPEC-R14) plus this
freeze-on-completion rule. A `ProduceHalt`/transport error on the turn that would have frozen a prior
pending ask MUST leave it pending — still answerable; the turn never completed, so it never reaches the
freeze above; a failed turn changes nothing.
- **AC5** *Given* a rendered ask surface's commit Button click, *when* it dispatches, *then* the emitted
  `action` carries the ask's `surfaceId`, `context`, and full `dataModel` (`sendDataModel`), and the SAME
  `nextTurn`/`shouldRunTurn` path frames + routes it — no new wire/reducer shape; *given* a pending ask and
  ANY subsequent dispatched turn that COMPLETES, *then* the pending ask freezes `'answered'` iff that
  dispatch's action surfaceId IS the ask, else `'bypassed'`; *given* a `wantResponse: false` click, *then* nothing freezes;
  *given* a `ProduceHalt`/transport error on the freezing turn, *then* the prior pending ask stays pending
  and interactive — a site vitest/browser test, `npm test`/`test:browser` green, no key, no live model.

**SPEC-R9 — Opt-in, dev-only live overlay (SDK-free, key never baked into a build).** The primary live
overlay MUST be a dev-server Vite middleware proxy that resolves the matched provider's key server-side
from the `.env` (via Vite's `loadEnv`, merged over `process.env` — see SPEC-N2; a bare `process.env`
read misses a `.env`-only key), runs the SPEC-R4 loop with an `AgentProvider` backed by plain `fetch` (no LLM
SDK, no new dependency — SPEC-R11), and streams the validated payload's JSONL back; with no key set it
MUST degrade gracefully to "backbone only". Every live overlay (the proxy client, and the
provisioned-but-CORS-gated client-direct `BrowserDirectTransport` that reads
`import.meta.env.VITE_ANTHROPIC_API_KEY`) MUST be reached ONLY through a dev-only dynamic `import()`
guarded by `import.meta.env.DEV`, so `vite build` tree-shakes it out. The live call is NEVER a CI gate.
*(→ PRD-G7; ADR-0069)*
- **AC1** *(manual)* *Given* `ANTHROPIC_API_KEY` set (from the gitignored `.env`) under `vite dev`,
  *when* a prompt is submitted, *then* a real validated payload streams and renders; *given* no key,
  *then* the endpoint returns a graceful "backbone only" signal and the page runs the recorded backbone.
- **AC2** *Given* the built `dist/` (see SPEC-N2), *when* grepped, *then* no live-overlay module, key,
  or `import.meta.env.VITE_*` key reference survives (the overlay is dev-only-guarded + tree-shaken).

### 3.4 The provider seam & switcher

**SPEC-R11 — Config-driven multi-provider seam.** The real model call MUST sit behind an injected
`AgentProvider` — `stream({ model, system, messages, signal }) → AsyncIterable<string>` (text fragments
accumulating into A2UI JSONL) — with ONE isolated module PER provider (each owning its endpoint, auth,
and SSE framing; SPEC-N5 isolation is per-module). A committed `providers.json` registry MUST enumerate
Anthropic, OpenAI, and Gemini + their models (env-var NAMES + public endpoints/model-ids only, NO
secrets), each carrying an **`implemented: boolean`** availability flag (`anthropic: true`;
`openai`/`gemini`: `false` now). **Anthropic MUST be implemented this wave** (plain `fetch`, no LLM SDK;
the host-verified SSE flow); OpenAI and Gemini config rows MUST be present now (`implemented: false`) and
their adapters are the immediate NEXT slices (each gated on its streaming-contract host-verify). The key
MUST be passed in, never read at module scope. **Defensive dispatch:** if an allowlisted provider has no
adapter (`implemented: false`, or a missing module), the proxy MUST degrade like the no-key path — a
distinguishable "provider not yet available" → backbone-only, NEVER an unhandled crash. *(→ PRD-G7;
ADR-0073)*
- **AC1** *Given* the driver, *when* read, *then* it depends only on the `AgentProvider.stream`
  signature (never a vendor module directly) and passes the stub-provider loop test with no live model;
  *given* the repo, *when* grepped, *then* the Anthropic adapter exists with no `@anthropic-ai/sdk`
  import, and `openai`/`gemini` are stated next slices (config rows present, `implemented: false`).
- **AC2** *Given* `providers.json`, *when* the shape test runs, *then* it parses, every provider has
  `envKey`/`endpoint`/`defaultModel`/`implemented`, `defaultModel ∈ models`, `defaultProvider ∈
  providers` and is `implemented`, and a grep proves no secret value in the file.
- **AC3** *Given* the Anthropic adapter's SSE-chunk→text-fragment parse extracted as a PURE function,
  *when* fed a captured SSE-response fixture, *then* it yields the expected text fragments — a
  deterministic unit test, no network (the code most likely to break on an upstream change is gated).
- **AC4** *Given* an allowlisted-but-unimplemented `{provider,model}` reaches the proxy, *when* it
  dispatches, *then* it returns the distinguishable "provider not yet available" signal (backbone-only),
  never an unhandled error — a deterministic unit test over the dispatch/degrade logic.

**SPEC-R12 — In-chat switcher + proxy allowlist (the registry's two consumers).** The demo MUST render
an in-chat provider→model switcher FROM `providers.json` (default from `defaultProvider`/`defaultModel`,
live-overridable, persisted to `localStorage`), sending `{ provider, model }` with each turn.
Unimplemented (`implemented: false`) providers MUST render as **disabled/greyed** ("coming soon" — a
visible roadmap, NOT selectable), so the switcher never offers what the proxy can't serve. The switcher
is part of the **dev-only live-overlay UI** (consistent with ADR-0069: the static built site ships the
backbone alone) — it is present only when the live overlay is available; the static backbone-only build
has no switcher. The proxy MUST VALIDATE the requested `{ provider, model }` PAIR against the registry
allowlist (the `model` MUST be in that provider's `models`; rejecting an unknown pair — never trusting
an arbitrary client value) and route to `process.env[<envKey>]` for the matched provider. The registry
is the SINGLE source of truth for BOTH menu and allowlist — no hand-listed second list. *(→ PRD-G7;
ADR-0073)*

**The switcher gains a `mode` selector (ADR-0090 §4).** BESIDE `{provider, model}`, the dev-only switcher
MUST render a third selector for the Gen-UI `mode` axis (`GenUiMode`), persisted to `localStorage` on the
SAME selection object, sent as `{ provider, model, mode }` with each live turn. `mode` MUST be validated at
the proxy by CLOSED enum membership (a 3-value set, distinct from the `{provider,model}` REGISTRY-lookup
allowlist above) — an unrecognized or absent value MUST be defaulted (never forwarded raw to
`buildSystemPrompt`, and NEVER cause the request itself to fail/400).
- **AC1** *Given* a config row added, *when* the page renders (live overlay available), *then* it
  appears in the menu (derived, not hand-listed), `implemented: false` ones disabled; *given* an
  out-of-allowlist `{provider,model}` pair POSTed to the proxy, *then* it is rejected; *given* the
  allowlist-validation logic, *when* unit-tested, *then* a known implemented pair routes to its `envKey`
  and an unknown-or-unimplemented pair rejects/degrades — deterministic, no key.
- **AC2** *Given* the switcher, *when* rendered, *then* it offers a `mode` selector alongside
  provider/model, persists the selection, and exposes it on the SAME selection ref the live transport
  reads per turn; *given* the proxy, *when* it receives a `mode` value, *then* a recognized member of the
  3-value set is passed through unchanged and any other value (absent, unrecognized, or malformed) is
  defaulted — a deterministic unit test over the membership guard (`validate-mode.test.ts`), `npm test`
  green, no key.

### 3.5 The visible proof

**SPEC-R10 — Site page rides the standing gates.** The demo MUST ship a site page
(`a2ui-live.html` + `pages/a2ui-live.ts`) wired into the dual TOC, defaulting to the backbone, offering
the dev-only live overlay (with the switcher) when it is available, deriving every displayed fact from
the transport output (shown ≡ produced), and inventing NO parallel check — it rides the SPEC-R2/R6
standing gates the way `a2ui-stream` rides `examples.test.ts`. *(→ PRD-G1)*
- **AC1** *Given* the page, *when* `npm run check && npm run check:site` run, *then* both pass; *when*
  the built static output is grepped, *then* it contains no key, no hardcoded live endpoint, and no
  switcher/overlay (dev-only-guarded, tree-shaken).

---

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Zero-dep package preserved | `@agent-ui/a2ui/package.json` deps unchanged (`@agent-ui/components` + `@agent-ui/shared` only); the package surface is `.`/`./examples`/`./corpus`/`./agent` (the `./agent` producer toolkit exported per **ADR-0137**, TKT-0072 — the portable core in `src/agent/`); no LLM SDK anywhere (plain `fetch`); the KEY-HOLDING, DEV-PROXY, and PROVIDER-REGISTRY infra (`tools/agent/dev-proxy-plugin.ts` · `providers.json`/`providers-config.ts`/`providers/{index,openai,gemini}.ts` · `agent-config-schema.ts`) stays site/tools-scoped only. Exporting `./agent` does NOT compromise the zero-dep core: the pack is hand-rolled, SDK-free, opt-in, and identity-gated (the ROOT `.` barrel carries zero producer bytes — the `./examples`/`./corpus` precedent), the ADR-0119 opt-in-pack law (Constraint C2 / ADR-0062/0069/0119/0137). |
| **SPEC-N2** | No secret committed / none baked into a build (the `VITE_` footgun) | A gitignored `.env` (untracked) provisions the keys; no key literal appears in committed source (grep gate). The proxy resolves the non-prefixed `ANTHROPIC_API_KEY` SERVER-side via Vite's `loadEnv(mode, <repoRoot>, '')` merged over `process.env` — Vite does NOT auto-load `.env` into `process.env`, so a bare `process.env` read would miss a `.env`-only key; `loadEnv` runs in Node under `apply: 'serve'` only and the value is never inlined nor sent to the browser (`/status` answers a boolean). Vite INLINES `VITE_*` at build time, so every `import.meta.env.VITE_*` reference MUST live only inside a dev-only-guarded, tree-shaken overlay module — a standing source-level gate asserts it, and a manual `vite build` + grep of `dist/` for the key patterns returns zero hits (ADR-0069). |
| **SPEC-N3** | Validator parity | The runtime loop's validation is the shared `heal`+`validateA2ui` — identical verdict to the renderer and corpus admission; no fork (streaming SPEC-N3). |
| **SPEC-N4** | Progressive paint | The validated payload streams line-by-line (root-early → first paint before finalize), preserving the `a2ui-stream` aesthetic (streaming SPEC-N1). A turn's optional leading `note` meta-line (ADR-0088 §1) is filtered out BEFORE `host.ingest`/the JSON tab — it never enters the render path and never delays or blocks the progressive paint of the validated lines that follow it. |
| **SPEC-N5** | Upstream-format isolation (per-provider) | Each provider's upstream (SSE) parsing lives in ONE place — that provider's adapter module (`providers/<id>.ts`); the driver, the transports, and the browser see only clean A2UI JSONL, so an upstream-contract change (Anthropic now, OpenAI/Gemini per-slice) touches exactly one module. |

## 5. Typed contracts

```ts
// The isolation seam (SPEC-R1 / ADR-0069). Zero-dep; the page consumes only this.
interface AgentTransport {
  // One agent turn: the framed input in, an ordered stream of A2UI JSONL lines out.
  turn(input: TurnInput): AsyncIterable<string>;
}

// The session (SPEC-R8 / ADR-0072) — the standard Messages-API turn array.
type Role = "user" | "assistant";
interface Turn { role: Role; content: string; }        // assistant.content = the emitted A2UI JSONL
interface Session { turns: Turn[]; }
type TurnInput =
  | { kind: "intent"; text: string; session: Session }               // turn 1
  | { kind: "client"; message: A2uiClientMessage; session: Session }; // later turns (the reducer frames it)

// The runtime loop (SPEC-R4 / ADR-0070) — provider-agnostic; the proxy injects an AgentProvider.
interface ProduceDeps {
  provider: AgentProvider;                                                 // the model seam (SPEC-R11); stub in tests
  retrieve(query: RetrieveQuery): CorpusRecord[];                          // over the judged shard
  catalog: Catalog;                                                        // the sole authority
}

// The provider seam (SPEC-R11 / ADR-0073) — one isolated module PER provider; key passed IN, not module-scoped.
interface AgentProvider {
  stream(req: { model: string; system: string; messages: Turn[]; signal?: AbortSignal }): AsyncIterable<string>;
}
function anthropicProvider(opts: { apiKey: string }): AgentProvider;       // Anthropic now; openai/gemini = next slices

// The registry (SPEC-R11/R12 / ADR-0073) — committed providers.json; env-var NAMES + public ids only, NO secrets.
interface ProvidersConfig {
  defaultProvider: string;                                                 // MUST be an implemented provider
  providers: Record<string, {
    label: string; envKey: string; endpoint: string;
    defaultModel: string; models: { id: string; label: string }[];
    implemented: boolean;                                                  // false ⇒ menu-disabled + proxy degrades (SPEC-R11/R12)
  }>;
}
function produce(input: TurnInput, deps: ProduceDeps, opts: { maxRounds: number; mode?: GenUiMode }):
  AsyncIterable<string>;   // yields ONLY a validated payload's lines (heal+validateA2ui gate); halt-and-report at the bound

// The Gen-UI mode axis (SPEC-R6 / ADR-0090 §1/§4) — a closed 3-member set; 'default'/absent ⇒ the
// pre-ADR-0090 ADR-0089 grammar byte-for-byte. NOT a transport choice (Structural is NOT a member — see
// the Definitions §2 "Structural"/"Gen-UI mode" entries and SPEC-R2).
type GenUiMode = "default" | "specific" | "blue-sky";

// The derived prompt (SPEC-R6 / ADR-0071, ADR-0090 §1, ADR-0091 §2/§3) — inventory derived from
// catalog.json; drift-gated. `mode` is OPTIONAL: absent (and 'default') reproduce the pre-ADR-0090
// grammar byte-for-byte; 'specific' dials the ADR-0089 clarify/negotiate behaviors DOWN, 'blue-sky' dials
// them UP; the honesty floor is identical in every mode. `miniSkills` is OPTIONAL and defaults to `[]`:
// absent/empty composes a prompt byte-identical to omitting it (SPEC-R6 AC4); a non-empty selection
// appends ONE `## Composition idioms` block after the few-shot examples — EXCEPT that in 'blue-sky' mode,
// any selected entry among the three ADR-0090 ★ calibration ids is excluded from that block (ADR-0091 §4
// fix), because it is already inlined verbatim in blue-sky's own NEGOTIATE_BLUE_SKY grammar paragraph;
// every other mode, and every other id, composes the block unfiltered.
function buildSystemPrompt(
  catalog: Catalog, exemplars: CorpusRecord[], mode?: GenUiMode, miniSkills?: readonly MiniSkill[],
): string;

// The mini-skill registry & selection (SPEC-R13 / ADR-0091 §1/§2) — a static, hand-curated registry;
// selection reuses retrieve()'s tokenizer/cosine primitives, never the CorpusRecord schema.
interface MiniSkill {
  id: string;            // stable, kebab — e.g. 'settings-screen'
  triggers: string;       // the intent vocabulary this idiom answers
  body: string;            // the idiom instruction: anatomy → catalog mapping → wall; ≤ the per-module budget
}
// Degrades to [] on zero vocabulary overlap, or cap/registry.length <= 0; NEVER pads with a zero-score
// module. Deterministic top-k cosine ranking, tie-broken by ascending id.
function selectMiniSkills(intent: string, registry: readonly MiniSkill[], cap: number): MiniSkill[];

// The reducer (SPEC-R8 / ADR-0072) — pure; frames a client message as the next user turn.
function nextTurn(session: Session, message: A2uiClientMessage): TurnInput;

// The meta-line convention (SPEC-R5/R8 / ADR-0088 §1/§2) — a DEMO-TRANSPORT framing convention, NOT
// part of the A2UI protocol. Rides as a single reserved JSON line on the SAME `AgentTransport.turn()`
// stream, emitted FIRST. `AgentTransport`'s own signature above is BYTE-IDENTICAL / UNCHANGED — this is
// additive framing INSIDE the string stream it already returns, not a new interface member.
interface TurnTrace {
  turnIndex: number;
  query: { intent: string; k: number };
  exemplarIds: string[];        // WHICH judged-shard records conditioned this turn
  rounds: number;                // self-correct rounds taken (1 = first-try valid)
  healed: number;                 // lines the shared healer corrected
  failureCodes: string[];         // validator failures fed back, if any
  model: string;
}
// AskDeclaration (SPEC-R14 / ADR-0097 §1) — a routing fact only; the surface it names is ordinary A2UI.
interface AskDeclaration {
  surfaceId: string;
}
interface A2uiMetaEnvelope {
  a2uiMeta: { note?: string; ask?: AskDeclaration; trace?: TurnTrace };   // note: model prose; ask: SPEC-R14 routing; trace: runtime-assembled, never model-authored
}
// Provably disjoint from A2uiServerMessage (which always carries `version`); never throws.
function readMetaLine(line: string): A2uiMetaEnvelope | undefined;
function isMetaLine(line: string): boolean;

// The feed sub-catalog (SPEC-R15 / ADR-0097 §3) — a gate-encoded TOTAL PARTITION of the catalog's
// component types; a STRICTER POLICY VIEW, never a second catalog. `feed-catalog.ts`, zero-dep, pure.
interface FeedExclusion { readonly type: string; readonly reason: string }
const FEED_SURFACE_TYPES: readonly string[];        // the 23 IN types
const FEED_EXCLUDED: readonly FeedExclusion[];       // the 11 OUT types, each with a recorded reason
function isFeedSurfaceType(type: string): boolean;
```

## 6. Open items (non-normative)

- **Host-verify — all three RESOLVED (2026-07-04).** (1) Anthropic Messages streaming: `POST
  /v1/messages`, headers `x-api-key` + `anthropic-version: 2023-06-01` + content-type, body
  `"stream":true`; SSE `message_start → content_block_delta`(`text_delta`, text at `delta.text`)`* →
  message_stop`; `event: error` mid-stream surfaced. (2) Browser-direct CORS: supported but Anthropic
  officially DANGEROUS (`anthropic-dangerous-direct-browser-access` "exposes your secret API
  credentials") → confirms proxy-default, `BrowserDirectTransport` stays deferred/dev-only. (3) A2A
  continuity: `contextId`/`taskId` + `TASK_STATE_INPUT_REQUIRED`, resume via a normal `SendMessage`
  echoing `taskId`+`contextId` — ADR-0072 cites it as the conformance target. NEW per-slice flags:
  OpenAI + Gemini streaming contracts are host-verify-BEFORE-those-adapter-slices (Anthropic-first =
  non-blocking now). Each provider's parsing stays SPEC-N5-isolated per-module.
- **Provisioned `.env` — both live paths real for local dev; config-driven multi-provider.** A
  gitignored repo-root `.env` carries server-side + `VITE_` variants for Anthropic/OpenAI/Gemini. The
  proxy path (`process.env`) is the safe default; the client-direct path (`VITE_`) is provisioned but
  dev-only + `VITE_`-footgun-bound (SPEC-N2). Per Kim's directive, `providers.json` enumerates all
  three now (SPEC-R11); Anthropic is implemented this wave, OpenAI/Gemini are the immediate next adapter
  slices.
- **The formal JSONL codec** (streaming LLD-C1) is deferred — the demo does line-framing in the
  transport; the codec lands with the streaming producer wave unless the reviewer pulls it forward.
- **The client-direct `BrowserDirectTransport`** — provisioned (the `.env`'s `VITE_` key) and designed
  behind the same seam; CORS is host-verified viable-but-dangerous, so it stays deferred/dev-only,
  built only if Kim wants a no-middleware demo, dev-only-guarded so it never bakes a key into a build.
- **Promoting the session reducer to a package `./agent` subpath** — only if the reviewer finds it a
  reusable runtime primitive; a follow-up ADR against ADR-0069, not required to prove the wave.
- **Corpus lift measurement** — this demo SHOWS retrieval conditioning; MEASURING lift (with vs
  without) is corpus LLD-C8/C12 territory, keeping its trigger.
- **The recorded-transcript scripted clarify/boundary example is UNBUILT (ADR-0089's one open fork —
  Kim's call).** Both ASK behaviors (SPEC-R6/R8) are live-model judgments the deterministic backbone
  cannot make ("is this vague?"/"does this exceed my catalog?"), so v1 ships **live-only** — the ADR's own
  default, and what is built. Seeding a scripted clarify + boundary-ask turn into the committed transcript
  (so the keyless static build showcases the capability) is a values-based fork — demo completeness vs.
  backbone honesty — Kim has NOT ruled on; if chosen later it would touch `transcript.ts` +
  `round-trip.test.ts`. NOT built here; no scripted clarify/boundary turn exists in the backbone today.
  *(This is a DIFFERENT, still-open fork than ADR-0090's — see below.)*
- **ADR-0090's ONE fork is RESOLVED (Kim, 2026-07-07) — folded, nothing open.** Whether Structural is a
  NAMED `GenUiMode` enum member or documented separately was decided: documented separately (Decision §3
  above; SPEC-R2's Structural clause) — Structural is a transport choice, never a value
  `buildSystemPrompt` special-cases. The exact per-mode wording, mode count, and demo-selector exposure
  were build-tuning (not forks) and are now settled by the shipped `system-prompt.ts`/`provider-switcher.ts`
  prose/wiring (LLD §1/§5).
- **ADR-0091 has NO genuine values-level fork (stated as settled, not manufactured) — but ONE demo-facing
  item is explicitly UNBUILT.** The registry+selection mechanism (SPEC-R6 AC4/SPEC-R13) is built; whether
  the dev switcher additionally exposes a "which idioms matched this turn" readout (mirroring ADR-0090's
  mode selector) is a re-verify-gated demo-legibility item the ADR names but does NOT decide — it is
  UNBUILT here (no `provider-switcher.ts` change), pending the same build-time re-verify class as
  ADR-0090's selector-exposure decision. Also build-tuning, not forks: the exact per-module token budget,
  per-turn cap, and selection score floor (the shipped values — ~200 tokens / cap 3 / floor 0 — are
  indicative starting points per the ADR, tunable against real turns without a spec change) and the
  initial registry's idiom sequencing beyond the seeded five.
- **ADR-0097's inherited-only fork + one named UNBUILT item (the OTHER, page-level-proof item is now CLOSED
  — post-ship review follow-up, 2026-07-07).** No NEW fork — the ONE adjacent open item is ADR-0089's OWN
  scripted-turn fork (now also covering scripted asks if ever taken; still Kim's call, untouched by this
  build). **date-range asks** remain explicitly UNBUILT, not a fork (blocked on ADR-0093's Calendar
  catalog-row `mode` follow-up landing — not agent-reachable today). **CLOSED:** the full page-level ask
  render/freeze/answer/fail-closed-drop proof — previously deferred because the shipped recorded transcript
  is deliberately unseeded with a scripted ask (the inherited fork above) — now exists, driven through the
  REAL page module (`site/pages/a2ui-live.ts`) via a test-only transport-injection seam
  (`__setTransportForTest`, invisible to production callers) and a scripted stub `AgentTransport`, NOT the
  shipped transcript: `site/pages/a2ui-live.ask-lifecycle.test.ts` (jsdom) covers a valid ask rendering
  pending-and-mounted, answering it (freeze `'answered'`, the commit action's `dataModel` round-tripping),
  a bystander turn bypassing it (freeze `'bypassed'`), a `ProduceHalt`/transport-error turn leaving a
  pending ask pending, an out-of-scope-type ask fail-closed-dropping to the note (still visible in the JSON
  tab), Reset disposing every ask host, and the Finding-3 stale-line drop predicate (a line targeting an
  ASK-REGISTRY-KNOWN surface that is not the current turn's own ask is dropped regardless of frozen state —
  closing the one-turn-late gap where a still-`pending` prior ask's `isFrozen` check used to pass a stale
  line through to the canvas). The `AskRegistry` unit/lifecycle proof (`ask-registry.test.ts`/
  `.browser.test.ts`) and the producer-layer peel/compose/integrity/FEED_SCOPE coverage (`produce-loop.test.ts`)
  stand as before, unaffected.

## 7. Traceability

| Requirement | PRD goal(s) / upstream |
|---|---|
| SPEC-R1, R9, R10, R11, R12 | PRD-G7 (transport interop; the config-driven multi-provider seam + switcher/allowlist); streaming SPEC-R3 |
| SPEC-R2, R4, R5, R7, R8 | PRD-G1 (end-to-end generation renders + is interactive); streaming SPEC-R2/R8/N1; harness SPEC-R6 |
| SPEC-R3, N1, N2 | Constraint C2 (zero-dep); the secret-free CI invariant |
| SPEC-R6 | PRD-G6 (no silent drift) |
| SPEC-N3 | streaming SPEC-N3 (validator parity) |
| SPEC-N4 | PRD-G1 (progressive first paint); streaming SPEC-N1/R8 |
| SPEC-R5 AC2, R8 AC2/AC3, N4 | PRD-G1/G6 (the live conversational channel — note meta-line, `TurnTrace`, `wantResponse`-routed click→turn; ADR-0088) |
| SPEC-R6 AC2, R8 AC4 | PRD-G6 (the agent's ASK behaviors — clarify-when-underdetermined + catalog-boundary negotiated approximation, riding ADR-0088's note-only turn; ADR-0089) |
| SPEC-N5 | PRD-G6 (per-provider upstream-format isolation, coherence under change) |
| SPEC-R6 AC3, R12 AC2, R2 AC2 | PRD-G6 (the Gen-UI `mode` axis — directive `specific` ↔ exploratory `blue-sky`, a mode-invariant honesty floor, threaded via `ProduceOptions.mode` through the proxy + the dev-only switcher selector; and Structural named as the already-shipped recorded transport via a doc + a second worked example; ADR-0090) |
| SPEC-R6 AC4, R13 | PRD-G6 (the mini-skill registry — a `fewShot`-twin composed segment, hand-curated + selected once per turn beside `retrieve()` by a shared TF-IDF/cosine ranking, capped so the prompt grows by at most `cap × budget` regardless of registry size; mode-filtered at the composition site per ADR-0091 §4; ADR-0091) |
| SPEC-R14, R15, R6 AC5, R8 AC5, R5 | PRD-G1/G6 (feed-embedded interactive asks — an additive `ask` meta-envelope field whose payload rides the SAME validated stream; a page-level per-message `pending → frozen(answered\|bypassed)` lifecycle; a gate-encoded feed sub-catalog partition (the ADR-0087 lesson, reapplied); ask mechanics + mode-scaled archetype vocabulary in the derived prompt; the structured answer is the existing action arm — zero round-trip extension; every failure path degrades to the ADR-0088 prose note; ADR-0097) |

_Realizes streaming SPEC-R2 and harness SPEC-R6 in running code, co-serving PRD-G1 and PRD-G7. Status: each doc's own header (the tree wins); the original charter table is archived (frozen 2026-07-08)._
