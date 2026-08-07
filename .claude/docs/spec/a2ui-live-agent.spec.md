# SPEC — A2UI Live-Agent Example (a real LLM emitting A2UI over the wire)

> Status: accepted · v0.12 · 2026-08-07 (v0.11 2026-08-07; v0.10 2026-08-06; v0.9 2026-08-04; v0.8 2026-07-24; v0.7 2026-07-20; v0.6 2026-07-19; v0.5 2026-07-16; v0.4 2026-07-07; v0.3 2026-07-07; v0.2 2026-07-07; v0.1 2026-07-04; ratified 2026-07-04) · Layer: SPEC (execution contract)
> v0.12 changelog (ADR-0177, ACCEPTED by Kim 2026-08-07 — PR #571 comment — MCP servers as a manifest-registry
> SOURCE; GH #567 S-SPEC): NEW §3.7, **SPEC-R23–R28** — an MCP connector
> (`tools/agent/integrations/mcp/`) turns each allowlisted server's `tools/list` into N ordinary
> `IntegrationManifest`s via the EXISTING `registerIntegration()`; every consumer surface
> (`registry.ts`/`validate-input.ts`/`tool-dispatch.ts`, the `auth` vocabulary, `ExecuteContext`,
> the `integrations: string[]` enablement wire) stays byte-untouched (NEW **SPEC-R23**); the wire
> client is server-side-only, hand-rolled `fetch`, **Streamable HTTP ONLY, protocol pinned
> `2025-06-18`** — the F2 freeze, reasoned in §3.7 from the MCP spec's own deprecation of the
> dual-endpoint HTTP+SSE transport (and F3's hand-rolled-no-SDK posture, DERIVED from SPEC-N1 +
> Worker-fetchability, recorded there too) (NEW **SPEC-R24**); the three-fact additive mapping
> (`mcp:<server-id>:<tool-name>` id · verbatim wire name · independent label), schema passthrough
> into the SAME `assertSupportedSchema` gate, per-server `auth`/`envKey` inheritance under
> SPEC-R18's law unchanged, TEXT-only `tools/call` execute throwing into the existing `is_error`
> path (NEW **SPEC-R25**); per-tool fail-soft discovery with the disclosed second-server-loses
> consequence + an injectable registration sink (NEW **SPEC-R26**); the committed-roster allowlist
> fence, dev-proxy boot-await, once-per-process-lifetime discovery, empty-roster byte-identity
> (NEW **SPEC-R27**); and admin surfacing of the registered trios over a host GET with the ONE
> sanctioned reshape of the SPEC-R16 AC2 parity test (Kim's F1 ruling, GH #567 comment,
> 2026-08-07) (NEW **SPEC-R28**). SPEC-R16–R19's text is byte-untouched (additive beside them, the
> ADR-0177 posture); §5 gains NO contracts — exact connector interfaces are the connector LLD's
> (S-LLD, the #567 decomposition). v0.11 (SPEC-R21/R22) is untouched and orthogonal — its own
> PROPOSED marker awaits Kim independently; each flips on its own utterance.
> v0.11 changelog (ADR-0174 cl.1/cl.3/cl.4/cl.6, ACCEPTED by Kim 2026-08-07 — PR #570 comment "v0.11 accepted" — the planner-stage
> pilot's HOST-SIDE loop, the half SPEC-R20 scoped out): NEW **SPEC-R21** (§3.2c) — the opt-in sequential
> plan-runner: entirely HOST-side of the `AgentTransport` seam (each dispatched turn is an ordinary
> `TurnInput`; `produce()`/the proxies serve it indistinguishably from a chat turn — zero produce/proxy/
> transport change), gated per persona by a `SURFACE_A2UI_KEY`-precedent modality gate (OFF/absent ⇒
> byte-identical single-turn behavior), consuming a declared plan ONLY from the host's own plan-request
> turn (never from a runner-dispatched turn — no recursion, the plan frozen at consumption), driving one
> `{kind:'intent'}` dispatch per step in declared order over ONE growing `Session` via the UNCHANGED
> reducers, closing with exactly one synthesis dispatch (never host-side surface assembly — SPEC-R5's
> law), projecting step lifecycle onto the EXISTING status-stream grouping (ADR-0146 F5 `parent` +
> ADR-0159 receipts; K+1 groups — steps + synthesis; `TURN_PROGRESS_STAGES` NOT widened; zero new
> component), bounded by a plan-step cap
> (over-cap ⇒ NOT consumed, one visible warning) and one shared `AbortSignal` (runner dispatches are
> EXEMPT from SPEC-R8's demo max-turns cap — the step cap + no-recursion are their runaway guard), with
> user-initiated dispatches SUPPRESSED for a run's duration (at most one run in flight, K+1 accounting
> true by construction; disable-vs-queue is the LLD's presentation call), and with all three stages
> INTERNAL per ADR-0174 cl.6 (no stage UI, no persona-editable stage prose). NEW **SPEC-R22** — the
> failure/abandon grain + the advisory law: a step's failure continues the run (the acknowledgment folded
> into the NEXT dispatch's user content — the `frameClientMessage` `error`-arm shape, never a separate
> dispatch), a synthesis failure leaves every rendered step surface standing, the plan turn's own failure
> is the one true abort, an aborted run dispatches nothing further, and the runner NEVER verifies a
> step's output against its declaration (ADR-0174 OF1's no-integrity-check law — divergence is legal;
> groups close on the CALL's terminal state, never on content matching). An ask declared on a
> runner-dispatched turn degrades to its prose note (the ADR-0097 standing degrade) — the pilot loop is
> non-interactive by construction. SPEC-R6's plan-mechanics paragraph + AC6 widen IN PLACE (this SPEC's
> established pattern) to add the synthesis-turn teaching ADR-0174 cl.6 routes into `GRAMMAR`. SPEC-R20
> and every existing requirement are byte-untouched; `ProduceOptions`/`ProduceDeps` gain NOTHING (the
> loop lives above the seam).
> v0.10 changelog (ADR-0174 cl.2, ACCEPTED — the 2026-08-06 batch ratification, commit 54861c2; marker flip trailed — the planner-stage pilot's plan-turn
> wire representation): the ADR-0088 meta-line envelope gains a SIXTH, additive, MODEL-authored field,
> `plan: { steps: [{ id: string; description: string }] }`, following the `ask`-arm precedent EXACTLY
> (ADR-0097 §1) — shallow-validated the same way `readMetaLine`'s existing per-field-independent guard
> treats `note`/`ask`/`trace`/`progress`/`error` (a malformed `plan` drops only itself, never the whole
> envelope), the envelope stays versionless and provably disjoint from `A2uiServerMessage` (unchanged),
> `produce()`'s outgoing meta-line passes a declared `plan` through unchanged (mirroring `note`/`ask`'s
> existing passthrough), `AgentTransport.turn`'s signature stays byte-identical, and `RecordedTurn`/
> `createRecordedTransport` carry the identical `{note, plan}` shape for recorded/live parity (SPEC-R5/N4),
> mirroring SPEC-R14's `{note, ask}` parity requirement EXACTLY (NEW **AC4**, GH #538) (NEW **SPEC-R20**,
> §3.2b). SPEC-R6 gains the plan-arm's GRAMMAR-half mechanics teaching (NEW **AC6**), mode-invariant,
> folded in the SAME place the `ask`-mechanics block (AC5) already lives — ADR-0174 cl.6 rules this
> teaching host-owned/GRAMMAR-internal, never persona-editable. This requirement governs the WIRE
> REPRESENTATION (both directions) plus that GRAMMAR teaching — the host-side plan→execute→synthesize
> loop (ADR-0174 cl.1/cl.3/cl.4) and any `plan`-analogue of the `ask` field's surfaceId-integrity check
> (ADR-0174 Open fork OF1, genuinely undecided) are OUT OF SCOPE here and unbuilt. SPEC-R5/R14 and every
> existing meta-line field (`note`/`ask`/`trace`/`progress`/`error`) are byte-untouched.
> v0.9 changelog (ADR-0168 — the tool/integration ENABLEMENT arc): the hardcoded `INTEGRATIONS`
> array becomes a manifest REGISTRY (`IntegrationManifest {id, version, label, description, tool,
> auth, envKey?, execute}` + `registerIntegration`, boot-fail-fast on id/wire-name collision) — the
> registry `id`, the wire `tool.name`, and the admin `label` become three separate facts (NEW
> **SPEC-R16**); the declared `input_schema` stops being advisory — a shared minimal-subset
> validator gates every dispatch, malformed input ⇒ a structured `is_error` tool_result, never a
> reached executor and never a thrown turn (NEW **SPEC-R17**); manifests gain
> `auth: 'none'|'serverKey'` with the env-var NAME (`envKey`) resolved server-side in BOTH hosts
> (dev `loadEnv` / Worker env binding, ADR-0152), the key riding an `ExecuteContext` and an
> unprovisioned keyed integration never offered (NEW **SPEC-R18**); enablement reaches BOTH live
> arms — the `/chat` route accepts optional `integrations: string[]` and both hosts build the SAME
> shared tool dispatch for chat and produce routes (GH #402 branch (a), NEW **SPEC-R19**);
> `agent-config-schema.ts` first-classes the knob as registry-PROJECTED boolean fields + a
> fail-closed resolver (ADR-0135 Fork-1 law). SPEC-R5 and the v0.6 tool-round buffering are
> byte-untouched; `AgentProvider.stream`'s `tools?`/`executeTool?` seam is unchanged.
> v0.7 changelog (ADR-0152, proposed — a production Cloudflare Worker port of the live-agent proxy):
> SPEC-R9/R10's build-time "dev-only dynamic import + `vite build` tree-shake" enforcement mechanism is
> REPLACED, not merely extended, by a runtime `GET /status` probe + same-origin (CSRF) check — the docs
> site's deployed build now DOES ship a live-overlay module (`live-proxy-transport.ts`,
> `provider-switcher.ts`) and a key-holding proxy (`packages/agent-ui/a2ui/tools/agent/worker/index.ts`,
> a Cloudflare Worker) reachable by every visitor, not only a local `vite dev` session. The trust boundary
> ADR-0073 clause 5 protects — the browser never holds a key — is UNCHANGED; only the mechanism proving it
> holds moves from a compile-time grep of `dist/` to a documented, live-verified set of runtime mitigations
> (a zone-scoped rate limit, the CSRF gate, `workers_dev: false`) named in ADR-0152. SPEC-N1's "site/tools-
> scoped only" clause for the key-holding/dev-proxy/provider-registry infra narrows similarly: that infra
> now ALSO ships as the Worker's production runtime, under the same trust-boundary law, not a second one.
> AC text below is updated in place (this SPEC's own established pattern across v0.1–v0.6) rather than left
> to silently disagree with the shipped build.
> v0.6 changelog (GH #49 — the integrations/tool-use seam, built 2026-07-19): the `AgentProvider.stream`
> request gains the OPTIONAL `tools` (JSON-Schema `ToolDef[]`) + `executeTool` pair (the `effort?`/`onEvent?`
> additive precedent — both absent ⇒ the request shape is byte-identical); the Anthropic adapter owns the whole
> provider-native tool loop INTERNALLY (bounded MAX_TOOL_ROUNDS=4; scratch text from a tool round is buffered
> into the assistant context block and NEVER yielded — only the post-tools round reaches the accumulated wire
> the validate-then-stream law governs, so SPEC-R5 is untouched). `ProduceOptions` relays the pair verbatim.
> ADR-0146's closed progress vocabulary grows by exactly ONE stage, `tool` — a factual process claim carrying
> the registry tool NAME, never model-composed prose (the F2 honesty law's sanctioned growth; under the queue
> design tool stages drain just before the final round's text — a recorded latency limit). EXECUTION stays in
> the dev proxy's node process (`tools/agent/integrations.ts` — the v0.5 shell law: registry/key/proxy shapes
> never enter `src/agent/`); the browser forwards only ENABLED tool-entry LABELS (master-gated on
> `toolsEnabled`), the proxy intersects with its keyless registry (weather/wikipedia-search/currency, v1) and
> ignores the rest. Hotel booking/PMS integrations remain GH #49's named direction, out of this contract.
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
> sharpened predicate (ADR-0146 F1). BUILT (TKT-0083 Slice B, 2026-07-18): the `onEvent` seam, the
> Anthropic lifecycle mapping, `produce()`'s interleaved progress (opt-in; validate-then-stream preserved),
> `progressDetail`, and `RecordedTurn.progress` all shipped gate-green; `AgentTransport.turn()` stayed
> byte-identical, the typed-frame trigger re-deferred as recorded.
>
> **Amendment (2026-07-24, docs-only — the body below is UNCHANGED, append-only):** the turn stream
> gains a THIRD reserved line kind, `{"genui":{surfaceId, html}}` ([genui-surface
> SPEC](./genui-surface.spec.md) SPEC-R1/R2 — Kim's 2026-07-24 D6 ruling, PRD §4). SPEC-R5's
> validate-then-stream law is UNCHANGED for every A2UI content line, and SPEC-N4's
> filter-before-ingest rule covers the new kind identically (no `version` key ⇒
> `VERSION_UNSUPPORTED` fault isolation holds). SPEC-R5's SCOPE statement narrows honestly for the
> genui kind ONLY: its payload is opaque HTML — `validateA2ui` parity does not apply; wire-time
> validation is the structural envelope + byte cap, and the semantic fail-closed leg (containment
> before paint) lives at render time per genui-surface SPEC-R3/R4. The genui kind never enters
> `heal`/`validateA2ui`, the corpus, or the `allLines` path.

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
- **Plan run / plan-runner** (ADR-0174 cl.1/cl.3/cl.4, SPEC-R21/R22) — the HOST-side loop that, for a
  planner-enabled persona, reframes a user intent as a plan request, reads the completed turn's declared
  `plan` (SPEC-R20), then drives one ordinary `AgentTransport.turn()` dispatch per declared step plus one
  closing synthesis dispatch, all over ONE growing `Session`. Lives entirely ABOVE the transport seam:
  every dispatched turn is a plain `TurnInput`, so `produce()`/the proxies serve a plan run
  indistinguishably from N ordinary chat turns. A declared plan is ADVISORY (ADR-0174 OF1) — displayed
  and driven as declared, never verified against what the steps actually emit.
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
- **Integration manifest / registry** (ADR-0168 §1/§2) — one callable integration's complete
  server-side declaration: `{id, version, label, description, tool: ToolDef, auth, envKey?,
  execute}`, registered via `registerIntegration()` into the node-side registry
  (`tools/agent/integrations/` — the ADR-0137 shell law; the portable `src/agent/` core carries
  only `ToolDef`/`ExecuteTool`). `id` keys enablement on the wire; `tool.name` is what the model
  sees; `label` is human display text — three facts, never one string. Registration fail-fasts at
  boot on a duplicate `id` or wire name.
- **ExecuteContext** (ADR-0168 §4) — the executor's second parameter, `{signal?, apiKey?}`:
  the turn's abort signal plus, iff `auth === 'serverKey'`, the host-resolved key value. The key
  exists only inside the host process for the duration of the dispatch — never in a tool_result,
  a log line, or any browser-bound byte.
- **MCP connector / MCP-sourced manifest** (ADR-0177 cl.1) — the second manifest PRODUCER
  (`tools/agent/integrations/mcp/` — the same ADR-0137 shell law): at dev-proxy boot it turns each
  allowlisted MCP server's `tools/list` into N ordinary `IntegrationManifest`s via the existing
  `registerIntegration()`. A registry SOURCE, never a per-server registry entry and never a
  consumer-side mechanism — downstream of registration, NOTHING distinguishes an MCP-sourced
  manifest from a hand-authored one (SPEC-R23).
- **MCP server roster (the allowlist)** (ADR-0177 cl.4) — the committed, admin-curated list of the
  ONLY MCP servers the host may dial, a sibling file to `providers.json` (per entry: stable
  server-id · human label · endpoint URL · `auth: 'none' | 'serverKey'` · `envKey?` — an env-var
  NAME, never a value, the SPEC-R18 discipline). The fence: no browser- or model-supplied URL is
  ever dialed (the `resolvePair` posture). Ships EMPTY/example-only in v1 — which real server
  first enters it is Kim's later call (ADR-0177 Non-goals).

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

**The GRAMMAR half additionally carries plan-arm mechanics teaching, mode-INVARIANT (ADR-0174 cl.2/cl.6,
SPEC-R20; synthesis half added v0.11 per SPEC-R21).** Beside the note-line and feed-ask-mechanics
instructions, the GRAMMAR half MUST teach how to
declare a plan turn: the meta `plan` field's exact shape (`{steps: [{id, description}]}`), that `plan`
rides the SAME leading meta-line as `note`/`ask`, and that this is a HOST-OWNED mechanics fact the model
must reproduce exactly. The SAME block MUST additionally teach the SYNTHESIS turn's mechanics (ADR-0174
cl.4/cl.6): when a turn asks the model to compose/finalize the surface set from what the session already
shows, it composes ONLY from prior turns' context on the ordinary validated stream — procedural mechanics
about what synthesis MEANS, never persona voice. Like the `ask`-mechanics block above, this teaching MUST
be present, verbatim-identical, in EVERY mode — the ADR-0090 mode axis conditions WHETHER/HOW MUCH the
agent asks or approximates, never the wire mechanics it must reproduce exactly. Per ADR-0174 cl.6, this
teaching joins `GRAMMAR` (host-owned, byte-pinned, drift-gated), NEVER a persona-editable
`kind: "prompt-section"` entry — the SAME wire-integrity reasoning that keeps the `ask`-mechanics block
above GRAMMAR-owned, not persona-editable.
- **AC6** *Given* `buildSystemPrompt(catalog, [])` (any mode), *when* read, *then* the plan-arm mechanics
  teaching (the `plan` field's shape, its leading-meta-line placement, AND the synthesis-turn procedural
  teaching — the v0.11 widening) is present, byte-identical, in
  `undefined`/`'default'`/`'specific'`/`'blue-sky'`, and none of it leaks into the derived `## Available
  components` section — `system-prompt-grammar.test.ts`, `npm test` green, no live model.

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

### 3.2b The `plan` meta-line arm (ADR-0174 cl.2 — pilot wire contract)

**SPEC-R20 — Additive, model-authored, shallow-validated `plan` field on the meta-line envelope.** The
system MUST let a plan-turn's model output declare its step list as a NEW, additive field on the SAME
leading meta-line `note`/`ask`/`trace`/`progress`/`error` already ride (SPEC-R5's meta-line convention;
ADR-0088 §1) — `plan: { steps: [{ id: string; description: string }] }`. Following the `ask`-arm
precedent EXACTLY (SPEC-R14; ADR-0097 §1, ADR-0174 cl.2):
- `plan` MUST be MODEL-authored — the model declares it, like `note`/`ask`, NEVER runtime-composed like
  `progress`/`trace`/`error`.
- `plan` MUST be shallow-validated the SAME way `readMetaLine`'s existing per-field-independent guard
  treats `note`/`ask`/`trace`/`progress`/`error`: a malformed `plan` (non-object, a missing or non-array
  `steps`, or any step missing a string `id` or a string `description`) MUST drop ONLY the `plan` field —
  NEVER the whole envelope (`note`/`ask`/`trace`/`progress`/`error` on the SAME line still parse
  normally).
- The envelope MUST stay versionless and provably disjoint from `A2uiServerMessage` — the SPEC-R5
  disjointness proof (no `version` key) is UNCHANGED by this addition.
- `AgentTransport.turn(input): AsyncIterable<string>`'s signature MUST stay BYTE-IDENTICAL — `plan` is
  additive framing INSIDE the string stream the interface already returns, never a new interface member
  (the SAME precedent ADR-0097/ADR-0146/GH#144 each already extended this envelope by once).
- `produce()`'s OUTGOING meta-line MUST carry the model's declared `plan` value THROUGH when the model's
  own leading meta-line carried one — passed through UNCHANGED from the model's declaration (no runtime
  rewriting; no integrity check performed here, per Scope below) — the SAME passthrough treatment `note`
  already receives, and the SAME conditional-key-omission `ask` already receives (`JSON.stringify` omits
  `plan` entirely on a plan-less turn, so the wire shape stays byte-identical to before this field
  existed).
- `RecordedTurn`/`createRecordedTransport` MUST be able to carry the identical `{note, plan}` meta-line
  shape for parity between the recorded and live paths (SPEC-R5/N4) — mirroring SPEC-R14's `{note, ask}`
  parity requirement EXACTLY, the SAME seam `ask` already rides, no new mechanism (GH #538). *(→ PRD-G1/G6;
  ADR-0174 cl.2)*

**Scope.** This requirement governs the WIRE REPRESENTATION in BOTH directions — the model's declared
`plan` parsed IN by `readMetaLine` (above) and passed OUT through `produce()`'s outgoing meta-line
(above, AC3) — plus the GRAMMAR-half teaching the model needs to declare one correctly, which is folded
into **SPEC-R6** below the SAME way SPEC-R14 AC5 folds the `ask`-arm's mechanics teaching there: ADR-0174
cl.6 RULES this teaching INTERNAL and GRAMMAR-owned, not persona-editable, so it is not left absent or
silently missing — it belongs beside the ask-mechanics block it follows the precedent of. OUT OF SCOPE,
and unbuilt: the host-side plan→execute→synthesize loop that reads a declared `plan` and drives
sequential `produce()` calls (ADR-0174 cl.1/cl.3/cl.4 — a future SPEC/LLD's job, not this requirement's);
any status-stream live-rendering projection of a plan's steps (ADR-0174 cl.2's "separate mechanism"
ruling); and any `plan`-analogue of the `ask` field's surfaceId-correlation integrity check (ADR-0174
Open fork OF1 — genuinely undecided, NOT resolved by this field's addition — a `plan` MAY be
displayed/passed-through as declared, host-trusted, until a future requirement rules otherwise). A
`plan` field with no corresponding host-side executor loop still degrades harmlessly: an unrecognizing
consumer drops the unknown field (the ADR-0088 degrade discipline every meta-line field already relies
on) and the turn's `note`/A2UI lines render exactly as they do without it.
- **AC1** *Given* `readMetaLine`, *when* fed `{note, plan:{steps:[{id,description}]}}`, *then* it
  round-trips `plan` intact alongside `note`/`trace`/`ask`/`progress`/`error`; *given* a malformed `plan`
  (non-object, a missing/non-array `steps`, or a step missing a string `id` or `description`), *then* the
  envelope returns WITHOUT `plan` (every other field still parses) — `meta-line.test.ts`, `npm test`
  green.
- **AC2** *Given* the repo's `AgentTransport.turn` interface, *when* diffed before/after this field's
  addition, *then* its signature is BYTE-IDENTICAL — no new interface member, no request/response shape
  change (the ADR-0088/ADR-0097/ADR-0146/GH#144 additive-framing precedent, re-verified for `plan`).
- **AC3** *Given* a stub `produce()` run emitting a leading meta-line carrying `{note, plan:{steps:
  [{id,description}]}}` and a payload with zero A2UI lines, *when* it completes, *then* the OUTGOING
  meta-line ships with `plan` intact, passed through unchanged from the model's own declaration; *given*
  a stub run emitting no `plan`, *then* the outgoing meta-line omits the key entirely (byte-identical to
  the pre-this-field wire shape) — mirroring SPEC-R14 AC2's stub-`produce()`-run shape,
  `produce-loop.test.ts`, `npm test` green, no live model.
- **AC4** *Given* a `RecordedTurn` carrying `{note, plan:{steps:[{id,description}]}}`, *when*
  `createRecordedTransport` streams it, *then* the leading meta-line ships `{note, plan}` intact — the
  identical envelope shape `readMetaLine` round-trips on the live path (AC1), `lines` following
  byte-identical right after it; *given* a `RecordedTurn` carrying a malformed `plan` on the SAME meta-line
  as a well-formed `note`, *then* the streamed meta-line drops ONLY `plan` (the note still ships) — mirroring
  SPEC-R14's `RecordedTurn`/`createRecordedTransport` `{note, ask}` parity requirement EXACTLY, the SAME
  seam, no new mechanism — `round-trip.test.ts`, `npm test` green, no live model.

### 3.2c The host-side planner loop (ADR-0174 cl.1/cl.3/cl.4/cl.6 — the pilot's execution contract)

**SPEC-R21 — Opt-in sequential plan-runner: plan → K steps → synthesis, host-side of the
`AgentTransport` seam.** The system MUST provide a host-side plan-runner realizing ADR-0174's sequential
pilot loop, composed ENTIRELY from shipped mechanics. *(→ PRD-G1/G6; ADR-0174 cl.1/cl.3/cl.4/cl.6)*
- **Placement.** The runner MUST live host-side of the `AgentTransport` seam (SPEC-R1): every turn it
  dispatches MUST be an ordinary `TurnInput` (`{kind:'intent', text, session}` — the shape every shipped
  chat consumer already fires at every turn index), so `produce()`, `ProduceOptions`, `ProduceDeps`, the
  dev proxy, and the Worker are byte-UNTOUCHED — a plan run is, below the seam, indistinguishable from
  N ordinary chat turns (the ADR-0174 Context finding, now normative). The runner module itself MUST be
  pure of key/proxy/registry shapes (SPEC-N1's shell law governs its home either way; the exact module
  path is the LLD's).
- **The opt-in gate.** Planner mode MUST be OPT-IN per persona, via a modality-gate boolean following
  the `SURFACE_A2UI_KEY`/`SURFACE_GENUI_KEY` precedent (ADR-0174 cl.1; the exact store constant and
  admin presentation are the LLD's — ADR-0174 OF3). With the gate OFF or absent, the turn path MUST be
  byte-identical to today's single-dispatch shape — including when a model volunteers a `plan`
  declaration anyway: the host MUST NOT consume it (SPEC-R20's degrade law — the field drops from
  consumption; the turn's note/lines render exactly as today).
- **Consumption.** With the gate ON, the runner MUST dispatch the user's intent wrapped in a host-owned
  plan-request framing (a PURE function — the `frameClientMessage` one-place precedent; the GRAMMAR's
  request-triggered plan teaching, SPEC-R6 AC6, is what it triggers). The runner MUST consume a declared
  `plan` ONLY from that completed plan-request turn's leading meta-line, and ONLY when it is well-formed
  (SPEC-R20's shallow validation) AND within the step cap (below). A completed plan-request turn with NO
  consumable plan (the model built directly, declined, or over-declared) MUST stand as an ordinary turn —
  its validated output renders, the loop simply does not start; never an error. A `plan` declared on a
  RUNNER-dispatched turn (a step or the synthesis turn) MUST NEVER be consumed — no nested/recursive
  plan runs in this pilot — and the consumed plan is FROZEN at consumption: nothing declared mid-run
  restructures the running loop.
- **All three stages INTERNAL (ADR-0174 cl.6).** The runner MUST introduce NO user-facing stage UI — no
  stage selector, no per-stage settings group, no persona-editable stage prose (the plan/synthesis
  mechanics live in `GRAMMAR`, SPEC-R6 AC6). The status-stream projection below is the ONLY visible
  artifact of a run.
- **Sequencing.** The runner MUST dispatch exactly ONE turn per consumed step, in DECLARED order, each
  step's instruction composed by a pure host-owned framing function embedding the declared `id` +
  `description` verbatim (instruction text is DATA from the plan, never admin-authored teaching —
  ADR-0174 cl.6), all over ONE growing `Session` via the UNCHANGED `appendUserTurn`/
  `appendAssistantTurn` reducers — step N's dispatched session MUST contain every prior turn (the plan
  turn included). Each dispatched turn runs its own full SPEC-R4 microloop below the seam, untouched.
- **Synthesis.** After the last executed step the runner MUST dispatch exactly ONE closing synthesis
  turn (a pure host-owned framing; the model composes the final surface set from the session on the
  ordinary validated stream — SPEC-R5's validate-then-stream law is the ONLY path to a shipped surface;
  the host MUST NEVER assemble/stitch surfaces itself, ADR-0174 cl.4).
- **Projection.** On consumption the runner MUST seed K+1 `ui-status-stream` GROUPS — one per consumed
  step (a stable per-step `parent` key derived from the declared step `id` — ADR-0146 F5) PLUS one for
  the synthesis turn (a stable host-derived key; it is a dispatch with a lifecycle like any step's, and
  SPEC-R22's synthesis-failure tier needs a group to close) — project each dispatch's own `TurnProgress`
  events as children under its group (ADR-0159's receipt pattern), and close
  each group with a terminal state: done (clean completion) · failed/warning (halt or transport error) ·
  not-run (aborted before dispatch). `TURN_PROGRESS_STAGES` MUST NOT widen — a step is a GROUP, never a
  stage (ADR-0146 F2's closed table stands) — and NO new component may be introduced.
- **Bounds.** A plan-step cap MUST exist (the shipped default is build-tuning, indicative 8 — tunable
  without a spec change, the SPEC-R13 budget precedent); a plan declaring MORE steps than the cap MUST
  NOT be consumed (zero step dispatches — the host never truncates/rewrites a declaration it didn't
  author, the advisory law's flip side) and the refusal MUST be visible (one warning-state status entry
  naming the cap — the model's note announced a plan, so silent non-execution would lie by omission).
  A consumed K-step plan MUST cost exactly K+1 further dispatches (K steps + 1 synthesis; the plan turn
  makes K+2 total) — never more; the failure-acknowledgment (SPEC-R22) rides existing dispatches. ONE
  caller-supplied `AbortSignal` MUST thread through every dispatch of a run. Worst-case VALIDATOR
  (self-correct) rounds are therefore `(K+2) × maxRounds` by construction — SPEC-R4's per-call bound is
  untouched, and each dispatch's provider-internal tool rounds stay separately bounded by the adapter
  (GH #49's `MAX_TOOL_ROUNDS`), so every bound in the composition is finite. Runner-dispatched turns do
  NOT count against SPEC-R8's demo max-turns cap — that cap keeps governing user-initiated/client-message
  turns exactly as today, while the step cap + the no-recursion rule above are the equivalent runaway
  guard for runner dispatches (counting them would make a plan's capacity shrink with conversation
  length, a surprise with no offsetting safety: runner dispatches can never trigger further runs).
- **Mid-run user interaction.** While a run is in flight, the host MUST NOT dispatch any user-initiated
  turn — the composer's submit and every `shouldRunTurn`-eligible client message are SUPPRESSED for the
  run's duration (whether the affordance disables or queues-then-replays is the LLD's presentation
  call); a `wantResponse: false` silent apply stays legal as today (it never dispatches — SPEC-R8).
  WHY: suppression is the only ruling that keeps SPEC-R21's K+1 accounting, the one-growing-`Session`
  turn order, and at-most-ONE-run-in-flight true BY CONSTRUCTION rather than by page discipline — an
  interleaved user turn would corrupt the run's session sequencing, and (gate ON) a mid-run submit
  would start a SECOND concurrent run this sequential pilot explicitly does not design.
- **Asks during a run.** An `ask` declared on a runner-dispatched turn MUST degrade to its prose note
  (the ADR-0097 standing degrade path — never mounted as a pending ask): the pilot loop is
  NON-INTERACTIVE by construction, so no runner-dispatched turn — step or synthesis alike — may mount
  a control awaiting user input mid-run; the note-standalone rule (SPEC-R6) guarantees the question
  survives as prose either way. Pausing a run for an ask is a named future extension, not designed
  here.
- **AC1** *Given* the runner with planner mode OFF/absent and a scripted stub `AgentTransport` whose
  turn declares a `plan`, *when* the turn completes, *then* ZERO further dispatches occur and the
  rendered result is byte-identical to today's single-turn path — deterministic unit test, `npm test`
  green, no key, no live model.
- **AC2** *Given* planner mode ON and a scripted transport declaring a K-step plan on the plan-request
  turn, *when* the runner drives it, *then* exactly K step dispatches occur in declared order plus ONE
  synthesis dispatch, every dispatched input is a plain `{kind:'intent'}` `TurnInput` (nothing
  plan-shaped crosses the seam), and step N's session contains every prior turn — deterministic, no
  live model; *given* the SAME scripted turns with the model declining to plan (no `plan` field), *then*
  zero further dispatches occur and the turn stands as ordinary output.
- **AC3** *Given* the plan-request/step/synthesis framing functions, *when* called twice with the same
  declaration, *then* output is byte-identical (pure, deterministic), and a step's framing embeds its
  declared `id` + `description` verbatim — unit test, `npm test` green.
- **AC4** *Given* a plan declaring cap+1 steps, *then* NOTHING is consumed (zero step dispatches) and
  exactly one warning status entry names the refusal; *given* a consumed K-step plan, *then* total
  runner dispatches equal K+1 exactly; *given* a `plan` declared on a step turn mid-run, *then* it is
  never consumed and the running step list is unchanged — deterministic unit tests.
- **AC5** *Given* a consumed K-step plan driven with progress on, *then* K+1 groups seed (one per
  declared step, keys derived from the declared ids, plus the synthesis group), each dispatch's
  progress events land under its OWN group, terminal
  states land as specified, and the diff introduces no new component and no `TURN_PROGRESS_STAGES`
  member — unit + site test, `npm test`/`check:site` green.
- **AC6** *Given* a scripted transport declaring an `ask` on a step turn's leading meta-line (with a
  payload creating that surface), *when* the runner drives the run, *then* NO pending ask is mounted
  (no per-ask `createRenderer()` host, no `pending` lifecycle entry), the ask's question survives as
  the turn's prose note, and the run proceeds to the next dispatch uninterrupted — deterministic
  unit/site test, `npm test` green, no key, no live model.

**SPEC-R22 — Plan failure/abandon semantics + the advisory law.** A plan is ADVISORY (ADR-0174 OF1);
failure handling is tiered by where a failure can actually occur (ADR-0174 cl.4), and the runner never
polices declaration-vs-output. *(→ PRD-G1/G6; ADR-0174 cl.4, OF1)*
- **The plan turn's own failure is the one true abort.** A `ProduceHalt`/transport error on the
  plan-request turn means nothing ran and nothing was consumed — the existing single-call failure
  semantics (SPEC-R5's halt-and-report, the GH #144 error line) apply completely unchanged; no loop
  starts.
- **A step's failure does NOT abort the run.** On a step dispatch's `ProduceHalt`/transport error the
  runner MUST close that step's group failed, MUST continue to the next step (or synthesis, when the
  failed step was last), and MUST fold a failure acknowledgment into the NEXT dispatch's user content —
  the `frameClientMessage` `error`-arm framing shape ("step <id> failed … continue"), adapted, so the
  model can never hallucinate the missing work — NEVER as a separate dispatch (the SPEC-R21 budget stays
  exact, and no consecutive-same-role session shape is minted). This is safe by construction: a failed
  step contributed ZERO wire content (SPEC-R5 — `produce()` yields only fully validated lines), so
  there is nothing to roll back.
- **A synthesis failure leaves every rendered step surface standing.** Each step's surfaces already
  streamed as validated content; the runner MUST close the synthesis group failed/warning, MUST NOT
  hide, dispose, or roll back any step's rendered output, and the run ends cleanly.
- **Abandon.** Once the run's `AbortSignal` fires, the runner MUST dispatch nothing further (the
  in-flight call's own signal semantics apply unchanged) and MUST close every not-yet-dispatched step's
  group not-run — display honesty over silent disappearance.
- **The advisory law (divergence is legal).** The runner MUST NOT verify a step's emitted output
  against its declared `description` — no content-vs-declaration check, no plan-analogue of the `ask`
  integrity check (ADR-0174 OF1 stands, genuinely undecided, NOT resolved here). A step MAY emit
  surfaces unrelated to its declaration, or none at all; its group closes on the CALL's terminal state
  (done/failed), never on content matching, and whatever validated content it did emit renders as
  ordinary output.
- **AC1** *Given* a scripted transport failing step j of K (j < K), *when* the runner drives it, *then*
  steps j+1…K and synthesis still dispatch, the dispatch AFTER the failure carries the acknowledgment
  (naming step j) folded into its user content with NO extra dispatch added, and step j's group ends
  failed — deterministic unit test, `npm test` green, no live model.
- **AC2** *Given* a scripted transport failing the synthesis turn, *then* every prior step's ingested
  lines/rendered state remain (nothing disposed), the synthesis group ends failed/warning, and the run
  returns cleanly — deterministic.
- **AC3** *Given* the run's `AbortSignal` fired after step j completes, *then* no further dispatch
  occurs and steps j+1…K's groups end not-run — deterministic.
- **AC4** *Given* a step whose scripted output creates a surface unrelated to its declaration (and,
  separately, one emitting a note only), *then* the runner performs no declaration-vs-output check
  (no failure, no warning from content mismatch), each group closes on its call's terminal state, and
  the emitted content renders normally — deterministic unit test.

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

**SPEC-R9 — Opt-in live overlay (SDK-free, key never baked into a build, browser-reachable in every
environment as of ADR-0152).** The primary live overlay MUST be a key-holding server-side proxy — `vite
dev`'s Node middleware (`dev-proxy-plugin.ts`, resolving the matched provider's key from the `.env` via
Vite's `loadEnv`, merged over `process.env` — see SPEC-N2) in local dev, and a Cloudflare Worker port of
the SAME proxy (`packages/agent-ui/a2ui/tools/agent/worker/index.ts`, resolving the key from a Workers
Secret) in production — that runs the SPEC-R4 loop with an `AgentProvider` backed by plain `fetch` (no LLM
SDK, no new dependency — SPEC-R11), and streams the validated payload's JSONL back; with no key set it
MUST degrade gracefully to "backbone only". Every live overlay (the proxy client, and the
provisioned-but-CORS-gated client-direct `BrowserDirectTransport` that reads
`import.meta.env.VITE_ANTHROPIC_API_KEY`) MUST be reached through a dynamically-imported module, probed
at runtime via `GET /status` — dev and production alike (ADR-0152 supersedes the prior dev-only,
build-time-tree-shaken gate). The production Worker MUST additionally enforce a same-origin (CSRF) check
on every state-changing route and MUST sit behind a rate limit (ADR-0152's named mitigations) — neither
applies to the local dev proxy, which has no equivalent exposure. The live call is NEVER a CI gate.
*(→ PRD-G7; ADR-0069; ADR-0152)*
- **AC1** *(manual)* *Given* a configured provider key (the gitignored `.env` under `vite dev`, or a
  Workers Secret in production), *when* a prompt is submitted, *then* a real validated payload streams
  and renders; *given* no key, *then* the endpoint returns a graceful "backbone only" signal and the page
  runs the recorded backbone.
- **AC2** *Given* the built `dist/`, *when* grepped, *then* it contains the live-overlay module
  (`live-proxy-transport.ts`) and the provider switcher (`provider-switcher.ts`, including
  `providers.json`'s env-var NAMES + model labels — never a secret value) — ADR-0152 REPLACES the prior
  "these leave the build entirely" guarantee with "these ship, but no key value ever does, and the
  production endpoint they call enforces the same-origin + rate-limit mitigations named in ADR-0152."
  *(→ ADR-0152)*

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
the live overlay (with the switcher) when it is available — probed at runtime, in every environment as of
ADR-0152 — deriving every displayed fact from the transport output (shown ≡ produced), and inventing NO
parallel check — it rides the SPEC-R2/R6 standing gates the way `a2ui-stream` rides `examples.test.ts`.
*(→ PRD-G1; ADR-0152)*
- **AC1** *Given* the page, *when* `npm run check && npm run check:site` run, *then* both pass; *when*
  the built static output is grepped, *then* it contains no key literal or key value — the live-overlay
  module and switcher DO ship (ADR-0152), and a hardcoded live ENDPOINT (the relative `/__a2ui/agent`
  mount path — never a key or a third-party URL) is expected, not a defect.

### 3.6 Tool/integration enablement (ADR-0168)

**SPEC-R16 — Manifest registry + fail-closed enablement resolution.** Integrations MUST live in a
manifest registry (`registerIntegration`/`listIntegrations`), never a hardcoded array; `id`,
`tool.name`, and `label` MUST be independently changeable facts. The browser MUST forward
enablement as registry `id`s; `resolveIntegrations(ids, env)` MUST intersect with the registry
(unknown/malformed ⇒ dropped, list capped, anything non-array ⇒ empty — the shipped fail-closed
posture preserved) and MUST additionally exclude any `serverKey` manifest whose `envKey` is
unprovisioned. Registration MUST fail-fast at boot on a duplicate `id` OR duplicate wire
`tool.name`. *(→ PRD-G7; ADR-0137/0168)*
- **AC1** *Given* the registry unit tests, *when* a duplicate `id` or wire name registers, *then*
  it throws at registration (boot-fail-fast); *given* `resolveIntegrations` fed a non-array, an
  unknown id, an over-cap list, and a keyed-but-unprovisioned id, *then* each degrades exactly
  (empty / dropped / capped / excluded) — deterministic, `npm test` green, no key, no network.
- **AC2** *Given* the admin Integrations pack, *when* the parity test runs, *then* every pack
  entry's `{id, label, description}` trio matches the registry (a registry edit that forgets the
  pack goes red — the existing parity gate, widened from bare labels to trios).

**SPEC-R17 — Dispatch-time input validation (the schema stops being advisory).** Every tool
dispatch MUST validate the model-authored input against the manifest's declared `input_schema`
BEFORE the executor runs, via ONE shared minimal-subset checker (`type:'object'` + `required` +
primitive property types; hand-rolled, no dependency). On failure the executor MUST NOT be
invoked; the dispatch MUST surface a structured error naming the tool + failing fields through
the EXISTING rejection path (the adapter converts it to an `is_error` tool_result — GH #49's
degrade-the-answer-never-the-turn contract, unchanged). A manifest declaring schema constructs
beyond the subset MUST fail-fast at registration, never silently half-validate. *(→ PRD-G4/G6;
ADR-0168 §3)*
- **AC1** *Given* `validateToolInput`, *when* fed a missing required field, a wrong-typed field,
  and a conforming input, *then* it returns structured failures for the first two (naming each
  field) and ok for the third — deterministic unit test, `npm test` green.
- **AC2** *Given* the shared dispatch with a stub executor, *when* a malformed input arrives,
  *then* the executor is never called and the rejection message names the tool + fields; *given*
  the Anthropic adapter's existing rejection handling, *then* that rejection lands as an
  `is_error` tool_result (the shipped conversion, re-asserted) — no live model.

**SPEC-R18 — Server-side keyed integrations.** A manifest MUST declare
`auth: 'none' | 'serverKey'`; iff `'serverKey'` it MUST carry `envKey` (an env-var NAME, never a
value — the `providers.json` discipline). The HOST MUST resolve the value at dispatch time — the
dev proxy from its `loadEnv`-merged env, the production Worker from its env binding (whose
`envVars()` projection MUST include registry `envKey`s, the GH #115 single-source lesson) — and
pass it via `ExecuteContext.apiKey`. No key value MAY reach the browser, a tool_result, or
committed source (SPEC-N2's grep gate covers integration keys identically). *(→ Constraint C2;
ADR-0073 cl.5, ADR-0152, ADR-0168 §4)*
- **AC1** *Given* a fake `serverKey` manifest + a stubbed env, *when* its var is set, *then*
  dispatch hands `execute` the value via ctx and the tool is offered; *when* unset, *then* the
  manifest is excluded from `resolveIntegrations`' result (never declared to the model) —
  deterministic unit test, no real key.
- **AC2** *Given* the repo, *when* the SPEC-N2 grep gate runs, *then* no integration key literal
  exists in committed source; *given* the Worker's env projection, *when* unit-read, *then* it
  derives from `providers.json` entries PLUS registered manifests' `envKey`s — one source of
  truth, no hand-listed key names.

**SPEC-R19 — Enablement reaches BOTH live arms (GH #402, branch (a)).** The `/chat` route's body
MUST accept optional `integrations: string[]`, resolved and dispatched via the SAME shared tool
dispatch the produce route uses, in BOTH hosts; the admin prose-chat arm (`AdminTurnRequest` →
`admin-live-runner.ts`) MUST forward the same enablement read the surface arm does. An absent
field MUST keep the request byte-identical to the pre-amendment shape (the `effort` additive
precedent). The adapter's internal tool loop yields text only, so the chat route's buffered
`{text}` contract is unchanged. *(→ PRD-G7; ADR-0136/0152/0168 §5)*
- **AC1** *Given* the chat route with a stub provider, *when* the body carries enabled ids,
  *then* `provider.stream` receives the matching `tools` + `executeTool`; *when* the field is
  absent or malformed, *then* it receives neither (byte-identical request) — deterministic unit
  test over both hosts' shared dispatch path, no key.
- **AC2** *Given* agent-admin with tools enabled and NO structured surface on, *when* a prose
  turn dispatches, *then* the POST body carries the enabled ids (the GH #402 repro inverted) — a
  deterministic projection/runner test, no live model.

### 3.7 MCP-sourced manifests (ADR-0177)

Additive beside §3.6 — SPEC-R16–R19's text is byte-untouched, and every requirement below lands
INTO their laws rather than beside them: the connector is a second manifest PRODUCER, never a
second registry, validator, or dispatch. Build tracker: GH #567; slice→AC ownership lives in the
[#567 decomposition](../decompositions/mcp-manifest-registry.decomp.md) and the connector LLD.

**SPEC-R23 — MCP as a registry SOURCE, never a consumer-side mechanism (ADR-0177 cl.1).** The MCP
connector (`tools/agent/integrations/mcp/` — the ADR-0137 shell law; the portable `src/agent/`
core stays types-only, no key and no MCP byte enters it) MUST turn each allowlisted server's
`tools/list` result into N ordinary `IntegrationManifest`s registered through the EXISTING
`registerIntegration()`. An MCP-sourced manifest MUST be indistinguishable from a hand-authored
one to every consumer: `registerIntegration`/`listIntegrations`/`resolveIntegrations`,
`validateToolInput`/`assertSupportedSchema`, and `buildToolDispatch` stay byte-untouched by this
whole arc; the `auth` vocabulary stays `'none' | 'serverKey'` (no `'mcp'` member, no new
`ExecuteContext` field); the enablement wire stays `integrations: string[]` of registry `id`s.
*(→ PRD-G7; ADR-0137/0177 cl.1)*
- **AC1** *Given* the arc's diffs, *when* reviewed at each slice, *then* `registry.ts`,
  `validate-input.ts`, `tool-dispatch.ts`, `integrations/index.ts`, and `src/agent/` carry ZERO
  changes (the frozen-file fence — checkable as an empty `git diff` over those paths per PR;
  `integrations/index.ts` in the list is what makes SPEC-R27's never-top-level-`await` law
  mechanical rather than review-enforced) and the shipped SPEC-R16–R19 suites pass
  byte-unmodified — `npm test` green by exit code.
- **AC2** *Given* a fake discovered tool registered through the connector, *when* read back via
  `listIntegrations()`, *then* it is a complete ordinary manifest (`id`/`label`/`description`/
  `tool`/`auth`/`execute`) with no MCP-marked field on the consumer surface — deterministic unit
  test, no network.

**SPEC-R24 — Server-side-only Streamable-HTTP wire client, transport + protocol PINNED (ADR-0177
cl.2 — the F2 freeze; F3 recorded).** The wire client MUST speak **Streamable HTTP only** — the
single-endpoint transport of MCP revision 2025-03-26 and later. The deprecated dual-endpoint
HTTP+SSE transport (protocol `2024-11-05`) MUST NOT be implemented. WHY (the F2 reasoning, frozen
here): (a) the MCP spec itself REPLACED HTTP+SSE with Streamable HTTP at revision 2025-03-26 and
retains the old flavor only as a backwards-compatibility measure for legacy servers — and a v1
whose roster ships EMPTY (SPEC-R27) has no legacy estate to be compatible with, so a second
handshake/connection path would be untested dead weight; (b) the legacy transport's long-lived
GET stream is hostile to the deferred production-Worker rollout (ADR-0177 cl.4's
additive-rollout posture), while Streamable HTTP is plain-`fetch`-able in both hosts. Within
Streamable HTTP the client MUST send `Accept: application/json, text/event-stream` and handle
BOTH sanctioned framings of a POST response (a single JSON body OR an SSE-framed body) — that
duality is part of the pinned transport, not a fallback. The `initialize` handshake MUST send
`protocolVersion: "2025-06-18"` (the pin); the client MUST proceed with a server iff the
negotiated version ∈ {`"2025-06-18"`, `"2025-03-26"`} (the Streamable-HTTP-capable revisions) and
otherwise skip-and-log that SERVER (SPEC-R26's fail-soft grain, applied at server scope); every
post-initialize request MUST carry the `MCP-Protocol-Version` header (the 2025-06-18
requirement); and the client MUST honor a server-assigned `Mcp-Session-Id` — captured from the
`initialize` response headers, echoed on every subsequent request to that server (the
Streamable-HTTP session law; a server assigning none ⇒ the header is simply never sent). F3,
recorded: the client is HAND-ROLLED over plain `fetch` — DERIVED, not chosen
fresh: SPEC-N1 pins `@agent-ui/a2ui` deps unchanged + no-SDK/plain-`fetch`, and Worker
portability requires fetch-only I/O; adopting `@modelcontextprotocol/sdk` would be a
repo-identity dependency change (the ADR-0139 class) needing its own Kim-ruled record — a
blocked handback, never a quiet install. Raw JSON-RPC frames MUST NEVER leave the host process in
either direction (ADR-0177 cl.2); the auth header is injected from a host-resolved key passed IN
by the caller (the client never reads env); every response rides a size cap + abort/timeout (the
registry TRUST-NOTE parity). *(→ Constraint C2, PRD-G7; ADR-0177 cl.2, SPEC-N1)*
- **AC1** *Given* the client under an injected fake transport/server (no external network),
  *when* the handshake runs, *then* `initialize` carries `protocolVersion: "2025-06-18"` and
  post-initialize requests carry the `MCP-Protocol-Version` header; *when* a fake server
  negotiates `"2024-11-05"`, *then* that server is skipped-and-logged and `tools/list` is never
  dialed; *when* the same `tools/list` result arrives once JSON-framed and once SSE-framed,
  *then* both parse to the same typed result — deterministic, `npm test` green by exit code.
- **AC2** *Given* browser-shipped code, *when* the SPEC-N2-class source gates run, *then* no MCP
  endpoint URL, JSON-RPC frame construction, or client import exists outside
  `tools/agent/integrations/mcp/` + the dev-proxy/Worker shell — the client is node-side only.

**SPEC-R25 — The additive three-fact mapping, per-server auth inheritance, TEXT-only execute
(ADR-0177 cl.3; SPEC-R18's law unchanged).** Each discovered tool `{name, description,
inputSchema}` plus its server's roster entry MUST map onto exactly ONE manifest under the
three-fact law: `id` = the NAMESPACED `mcp:<server-id>:<tool-name>` · `tool.name` = the MCP tool
name VERBATIM (unnamespaced — the disclosed cross-server-collision trade SPEC-R26 governs) ·
`label` = independently composed (`"<server label>: <tool name/title>"`), never re-derived from
the other two facts. The discovered `inputSchema` MUST pass through UNTOUCHED into the same
`assertSupportedSchema` gate every hand-authored manifest faces — no MCP carve-out of the
validator. `auth`/`envKey` MUST be inherited ONCE per server from the roster entry, under
SPEC-R18's law byte-unchanged: `envKey` a NAME never a value, an unprovisioned `serverKey`
manifest excluded by the existing `resolveIntegrations`, the host-resolved key riding
`ExecuteContext.apiKey` into `execute`, which forwards it to the client's auth header. `execute`
MUST be the client's `tools/call` plus a TEXT-only result mapping (v1: text parts compacted for
the model; non-text parts dropped with a stated placeholder, never silently) and MUST THROW on
upstream failure (an `isError` result or a transport error) so the adapter's existing `is_error`
conversion applies — GH #49's degrade-the-answer-never-the-turn contract, unchanged.
*(→ PRD-G4/G6; ADR-0177 cl.3, ADR-0168 §3/§4)*
- **AC1** *Given* the mapping unit tests, *when* a server is relabeled, *then* neither `id` nor
  `tool.name` changes (three facts held independent); *when* the manifest's `input_schema` is
  compared to the discovered `inputSchema`, *then* they are deep-equal (passthrough, byte-true);
  *when* a `serverKey` server's tools map, *then* every manifest inherits that ONE
  `auth`/`envKey` pair and a dispatch's `ctx.apiKey` reaches the client's auth header —
  deterministic, no key value, no network.
- **AC2** *Given* a fake `tools/call` returning mixed text+non-text parts, *then* the executor
  yields TEXT only with the placeholder for the dropped parts; *given* a fake `isError: true`
  result, *then* `execute` throws and — through the shipped dispatch — lands as an `is_error`
  tool_result (the SPEC-R17 AC2 re-assertion pattern), never a thrown turn.

**SPEC-R26 — Per-tool fail-soft discovery, the disclosed second-server-loses consequence
(ADR-0177 cl.3/cl.4).** Discovery MUST wrap each individual `registerIntegration()` call in a
per-tool guard covering BOTH boot-fail-fast throw paths — an unsupported schema construct AND a
duplicate wire `tool.name` — skipping-and-logging the ONE tool while registering the server's
other N−1; `registerIntegration` itself stays untouched (it remains fail-fast for hand-authored
callers, SPEC-R16). Across two servers exposing the same tool name, the SECOND registration
loses: dropped, logged with its reason — disclosed, never a crash, never silent. Discovery MUST
return a structured report `{registered, skipped: [{server, tool, reason}]}` for boot logging
(SPEC-R27). The registration sink MUST be injectable (defaulting to `registerIntegration`) so no
test mutates the module-level `REGISTRY` — which keeps the SPEC-R16 AC2 trio-parity gate green by
construction: discovery runs only at dev-proxy boot (SPEC-R27), never at `integrations/index.ts`
import, so test-time `listIntegrations()` stays hand-authored-only until SPEC-R28's ONE sanctioned
reshape. *(→ PRD-G6; ADR-0177 cl.3/cl.4)*
- **AC1** *Given* the discovery unit tests with an injected sink, *when* one tool of N is
  unsupported or wire-name-colliding, *then* exactly N−1 register and the report names the
  skipped tool + reason; *when* two fake servers expose the same tool name, *then* the second is
  dropped with a logged reason and the first stays registered; *when* the roster is empty, *then*
  the report is empty — deterministic, module `REGISTRY` untouched, the SPEC-R16 AC2 parity gate
  green at head, `npm test` green by exit code.

**SPEC-R27 — Allowlist fence, boot-await, once-per-lifetime discovery (ADR-0177 cl.4).** MCP
servers MUST come only from the committed roster (§2 — a NEW file sibling to `providers.json`;
exact name/schema are the connector LLD's), loaded by a fail-fast loader with the
`providers-config.ts` posture: a malformed entry or `serverKey`-without-`envKey` THROWS at load.
No browser- or model-supplied URL is EVER dialed. The v1 roster ships EMPTY/example-only. The dev
proxy MUST AWAIT the whole discovery pass — every allowlisted server — as a distinct startup step
BEFORE serving `/chat`/produce requests: never a top-level `await` spliced into
`integrations/index.ts` (it would stall hand-authored registration), never fire-and-forget a
request could race. Discovery-time key resolution uses the same `loadEnv`-merged env the proxy
already holds (SPEC-N2); discovery runs ONCE per process lifetime — a stale tool list is the
accepted `providers.json`-class v1 gap, no refresh mechanism. An EMPTY roster MUST keep
hand-authored registration and both routes byte-identical to today (a zero-cost no-op).
Production-Worker discovery stays OUT of this contract (`worker/` frozen — the deferred, additive
rollout; a stated temporary asymmetry, not a silent gap). *(→ Constraint C2, PRD-G7; ADR-0177
cl.4)*
- **AC1** *Given* the loader unit tests, *when* fed a valid, a malformed, a
  `serverKey`-without-`envKey`, and an empty roster, *then* the middle two throw at load and the
  others parse — deterministic, no I/O.
- **AC2** *Given* the dev-proxy ready-gate tests, *when* a request races boot, *then* it is not
  served ahead of completed discovery; *when* the roster is empty, *then* proxy behavior is
  byte-identical to pre-arc (hand-authored manifests register exactly as before) and the
  SPEC-R26 discovery report logs empty — `npm run check && npm test` green by exit code;
  `npm run test:browser` unaffected.

**SPEC-R28 — Admin surfacing over a host GET (the F1 ruling — Kim, 2026-08-07, [GH #567
comment](https://github.com/kimgranlund/agent-ui/issues/567#issuecomment-5221201991)).** The dev
proxy MUST serve the registered trios — `{id, label, description}`, the SPEC-R16 AC2 vocabulary —
over a host GET route, post-discovery, so `mcp:*` entries appear; the admin integrations pack
MUST read that route LIVE instead of hand-mirroring the registry; and the both-directions
trio-parity test (`agent-admin-app.test.ts:435`) MUST reshape exactly ONCE to grade the
pack-projection against the SERVED trios — still both-directions-honest (either side forgetting
an entry goes red). The GET body MUST carry trios ONLY: no endpoint URL, no `envKey` name, no key
value, no raw MCP frame (the cl.2 boundary — trios are admin-display facts, not secrets). The
enablement wire itself stays `integrations: string[]` of registry `id`s, browser→host,
unchanged. The GET reflects the boot-time registry (SPEC-R27's accepted staleness — no refresh
endpoint); Worker parity for the route rides the deferred rollout (`worker/` frozen).
*(→ PRD-G7; Kim's F1 ruling GH #567; ADR-0177 cl.2/cl.4, ADR-0168 §2)*
- **AC1** *Given* the GET route test, *when* discovery has registered `mcp:*` manifests, *then*
  the served trios equal the `listIntegrations()` `{id, label, description}` projection including
  the `mcp:*` entries, and the response body contains no URL, `envKey`, key value, or JSON-RPC
  fact — deterministic route test, no external network.
- **AC2** *Given* the reshaped parity test, *when* it runs at head, *then* it is green; *when*
  either the pack or the served set drops an entry (mutation probe), *then* it goes red —
  both-directions honesty re-proven, `npm test` green by exit code.

---

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Zero-dep package preserved | `@agent-ui/a2ui/package.json` deps unchanged (`@agent-ui/components` + `@agent-ui/shared` only); the package surface is `.`/`./examples`/`./corpus`/`./agent` (the `./agent` producer toolkit exported per **ADR-0137**, TKT-0072 — the portable core in `src/agent/`); no LLM SDK anywhere (plain `fetch`); the KEY-HOLDING, DEV-PROXY, and PROVIDER-REGISTRY infra (`tools/agent/dev-proxy-plugin.ts` · `tools/agent/worker/` · `tools/agent/chat-validation.ts` · `tools/agent/integrations/` (registry + manifests + `validate-input.ts` + `tool-dispatch.ts` + the `mcp/` connector, ADR-0177/SPEC-R23–R27) · `providers.json`/`providers-config.ts`/`providers/{index,openai,gemini}.ts` · the committed MCP server roster beside `providers.json` (SPEC-R27) · `agent-config-schema.ts`) stays tools-scoped WITHIN the a2ui package — as of ADR-0152, `tools/agent/worker/` is ALSO the production Cloudflare Worker's own runtime entry (`wrangler.jsonc`'s `main`), so "tools-scoped" no longer implies "never reaches production," only "never enters the portable `src/` producer core" (which remains true — `system-prompt.ts`/`mini-skills.ts` ship into the Worker bundle unmodified, per ADR-0152). Exporting `./agent` does NOT compromise the zero-dep core: the pack is hand-rolled, SDK-free, opt-in, and identity-gated (the ROOT `.` barrel carries zero producer bytes — the `./examples`/`./corpus` precedent), the ADR-0119 opt-in-pack law (Constraint C2 / ADR-0062/0069/0119/0137). |
| **SPEC-N2** | No secret committed / none baked into a build (the `VITE_` footgun) | A gitignored `.env` (untracked, dev) / a Workers Secret (production, ADR-0152) provisions the keys; no key literal appears in committed source (grep gate) and no key VALUE ever reaches the browser in either environment. The dev proxy resolves the non-prefixed `ANTHROPIC_API_KEY` SERVER-side via Vite's `loadEnv(mode, <repoRoot>, '')` merged over `process.env` — Vite does NOT auto-load `.env` into `process.env`, so a bare `process.env` read would miss a `.env`-only key; `loadEnv` runs in Node under `apply: 'serve'` only. The production Worker resolves the same key from `env.ANTHROPIC_API_KEY` (a Workers Secret, injected by the runtime, never in source). Both environments answer `/status` with a boolean only. Vite INLINES `VITE_*` at build time, so every `import.meta.env.VITE_*` reference MUST still live only inside a dynamically-imported overlay module — a standing source-level gate asserts it — but as of ADR-0152 that module DOES ship in `dist/` (it is reachable in production now); the manual `vite build` + grep of `dist/` (ADR-0069) checks for a KEY VALUE, not for the module's absence. |
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
// PlanStep / PlanDeclaration (SPEC-R20 / ADR-0174 cl.2) — a model-authored step list; the wire
// representation. The host-side loop that reads it is SPEC-R21/R22 (v0.11); any `plan`-analogue of
// AskDeclaration's surfaceId-correlation check stays undecided (ADR-0174 Open fork OF1 — SPEC-R22's
// advisory law rules the runner performs NO such check).
interface PlanStep {
  id: string;
  description: string;
}
interface PlanDeclaration {
  steps: PlanStep[];
}

// The host-side plan-runner (SPEC-R21/R22 / ADR-0174 cl.1/cl.3/cl.4) — INDICATIVE shape; the exact
// module home + API surface are the LLD's. Lives ABOVE the AgentTransport seam: dispatches ordinary
// TurnInputs only; produce()/ProduceOptions/ProduceDeps/proxies untouched. The framing trio is pure +
// one-place (the frameClientMessage precedent); onStepState is the status-stream projection seam
// (ADR-0146 F5 groups — the runner never touches the component itself).
type PlanStepState = 'pending' | 'running' | 'done' | 'failed' | 'not-run';
function framePlanRequest(intent: string): string;
function frameStepInstruction(step: PlanStep, priorFailure?: PlanStep): string;  // priorFailure ⇒ folds the SPEC-R22 acknowledgment in
function frameSynthesis(plan: PlanDeclaration, priorFailure?: PlanStep): string; // same fold — a failed LAST step's acknowledgment rides the synthesis dispatch (SPEC-R22)
function runPlan(opts: {
  transport: AgentTransport;
  session: Session;                                  // grown via the UNCHANGED reducers; returned grown
  plan: PlanDeclaration;                             // the consumed, frozen declaration (≤ the step cap)
  signal?: AbortSignal;                              // ONE signal threads every dispatch (SPEC-R21 Bounds)
  onStepState?: (stepId: string, state: PlanStepState) => void;
}): Promise<Session>;
interface A2uiMetaEnvelope {
  a2uiMeta: { note?: string; ask?: AskDeclaration; plan?: PlanDeclaration; trace?: TurnTrace };   // note: model prose; ask: SPEC-R14 routing; plan: SPEC-R20 step list; trace: runtime-assembled, never model-authored
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

// The integration manifest registry (SPEC-R16/R17/R18 / ADR-0168) — node-side, tools/agent/
// (the ADR-0137 shell law); the portable core keeps only ToolDef/ExecuteTool.
interface ExecuteContext { signal?: AbortSignal; apiKey?: string }
interface IntegrationManifest {
  id: string;             // registry key + the wire enablement vocabulary
  version: string;         // manifest semver — admin-displayable, never sent to the model
  label: string;            // human display text (admin UI)
  description: string;
  tool: ToolDef;              // tool.name is the model-visible wire name (MAY equal id)
  auth: 'none' | 'serverKey';
  envKey?: string;            // REQUIRED iff auth === 'serverKey'; a NAME, never a value
  execute(input: Record<string, unknown>, ctx: ExecuteContext): Promise<string>;
}
function registerIntegration(m: IntegrationManifest): void;   // boot-fail-fast on collisions
function listIntegrations(): readonly IntegrationManifest[];
function resolveIntegrations(ids: unknown, env: Record<string, string | undefined>): IntegrationManifest[];
function validateToolInput(schema: Record<string, unknown>, input: Record<string, unknown>):
  { ok: true } | { ok: false; errors: string[] };
// ONE dispatch builder, both hosts, both routes (the chat-validation.ts anti-fork precedent).
function buildToolDispatch(active: readonly IntegrationManifest[], env: Record<string, string | undefined>, signal?: AbortSignal):
  { tools: readonly ToolDef[]; executeTool: ExecuteTool } | Record<string, never>;
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
| SPEC-R16 | PRD-G7 (transport interop — the manifest registry + id-keyed, fail-closed enablement resolution; ADR-0137/0168) |
| SPEC-R17 | PRD-G4/G6 (provable validity before dispatch + no silent drift — the declared `input_schema` enforced at ONE seam; ADR-0168 §3) |
| SPEC-R18 | Constraint C2 (the secret-free invariant — integration keys resolve server-side in both hosts, never in a build/browser/tool_result; ADR-0073 cl.5, ADR-0152, ADR-0168 §4) |
| SPEC-R19 | PRD-G7 (transport interop — enablement reaches every live arm via one shared dispatch; GH #402 branch (a); ADR-0136/0152/0168 §5) |
| SPEC-R20, R6 AC6 | PRD-G1/G6 (the `plan` meta-line arm — a model-authored, additive, shallow-validated field on the ADR-0088 envelope, following the `ask`-arm precedent exactly; parsed by `readMetaLine` and passed through `produce()`'s outgoing meta-line unchanged; its GRAMMAR-half mechanics teaching folded into SPEC-R6 per ADR-0174 cl.6; the host-side plan→execute→synthesize loop and any `plan`-analogue of the `ask` integrity check are OUT OF SCOPE — ADR-0174 cl.2) |
| SPEC-R21, R22 | PRD-G1/G6 (the host-side sequential plan-runner — persona-gated opt-in, one ordinary `{kind:'intent'}` dispatch per declared step over one growing `Session`, closing-turn synthesis under SPEC-R5's validate-then-stream law, step lifecycle projected onto the existing status-stream grouping with `TURN_PROGRESS_STAGES` unwidened, a step cap + one `AbortSignal` bounding the run at `(K+2) × maxRounds`, tiered failure grain with fold-in acknowledgment, and the OF1 advisory law — no declaration-vs-output check; ADR-0174 cl.1/cl.3/cl.4/cl.6) |
| SPEC-R23 | PRD-G7 (MCP as a second manifest PRODUCER — a registry source through the existing `registerIntegration()`, every consumer surface byte-untouched; ADR-0137/0177 cl.1) |
| SPEC-R24 | Constraint C2 + PRD-G7 (the server-side-only wire client — Streamable HTTP ONLY, protocol pinned `2025-06-18`, hand-rolled plain `fetch` per SPEC-N1's no-SDK law; raw frames never leave the host; the F2/F3 freeze; ADR-0177 cl.2) |
| SPEC-R25 | PRD-G4/G6 (the three-fact additive mapping + schema passthrough into the SAME `assertSupportedSchema` gate + TEXT-only execute through the existing `is_error` path; per-server key inheritance under SPEC-R18's law unchanged; ADR-0177 cl.3, ADR-0168 §3/§4) |
| SPEC-R26 | PRD-G6 (per-tool fail-soft discovery — one bad tool costs one tool, the disclosed second-server-loses consequence, an injectable sink guarding the SPEC-R16 AC2 parity gate; ADR-0177 cl.3/cl.4) |
| SPEC-R27 | Constraint C2 + PRD-G7 (the committed-roster allowlist fence + dev-proxy boot-await + once-per-lifetime discovery + empty-roster byte-identity; ADR-0177 cl.4) |
| SPEC-R28 | PRD-G7 (admin surfacing — the host GET trio route, the live-read integrations pack, the ONE sanctioned parity-test reshape; Kim's F1 ruling, GH #567 2026-08-07; ADR-0177 cl.2/cl.4) |

_Realizes streaming SPEC-R2 and harness SPEC-R6 in running code, co-serving PRD-G1 and PRD-G7. Status: each doc's own header (the tree wins); the original charter table is archived (frozen 2026-07-08)._
