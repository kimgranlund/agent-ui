# SPEC — A2UI Live-Agent Example (a real LLM emitting A2UI over the wire)

> Status: accepted · v0.1 · 2026-07-04 (ratified 2026-07-04) · Layer: SPEC (execution contract)
> Refines: [`../a2ui-expert-system.prd.md`](../a2ui-expert-system.prd.md) — primarily **PRD-G1** (default-catalog generation works end-to-end) and **PRD-G7** (transport interop); supports **PRD-G6** (coherence). Honors Constraints **C1** (conform to A2UI v1.0) and **C2** (zero runtime deps).
> Realizes by ID (not by duplication): [`./a2ui-streaming-pipeline.spec.md`](./a2ui-streaming-pipeline.spec.md) **SPEC-R2** (the generation pipeline — its first PROGRAMMATIC realization) + **SPEC-R8/N1** (progressive delivery) · [`./a2ui-expert-harness.spec.md`](./a2ui-expert-harness.spec.md) **SPEC-R6** (the bounded compose→validate→self-correct loop — the loop CONTRACT stays harness §6; this SPEC realizes it in running code minus the authoring-time critic round).
> Refined by: [`../llds/a2ui-live-agent.lld.md`](../llds/a2ui-live-agent.lld.md).
> Decisions: **ADR-0069** (demo shape + security posture — the `AgentTransport` seam, layered backbone+overlay, the `VITE_` build-key-safety invariant) · **ADR-0070** (runtime loop scope) · **ADR-0071** (derived, drift-gated system prompt) · **ADR-0072** (multi-turn session model) · **ADR-0073** (the model-provider seam). All accepted (ratified 2026-07-04).
> Altitude: owns *what the live-agent example is, how it stays provable + secret-free, and how it composes the realized renderer/corpus/loop surfaces*. The concrete files/wiring are the LLD's. Requirement IDs file-scoped (`SPEC-R1…`).

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
  turns. Default; the only thing CI exercises.
- **Live overlay** — the opt-in dev-server proxy transport: a real model call, key-held server-side.
- **Turn / Session** — a turn is one agent generation (`user` = intent or a framed client message;
  `assistant` = the emitted A2UI stream); a session is the ordered turn list (ADR-0072).
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
shelf seed so its validity is already covered by `examples.test.ts`. *(→ PRD-G1; the `a2ui-stream`
precedent)*
- **AC1** *Given* the committed transcript, *when* a standing packages-tree test drives it through a
  real `createRenderer()` host + the session reducer, *then* turn-1 renders, a simulated interaction
  emits the expected client message, and turn-2 ingests + updates the surface — deterministic;
  `npm test` green with no key/network.

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
browser transport MUST be identical for the recorded and live paths. *(→ PRD-G4; streaming SPEC-N1/R8)*
- **AC1** *Given* a live turn, *when* the surface first paints, *then* the whole turn's payload has
  already passed `validateA2ui` (no invalid partial surface is ever rendered); *given* both transports,
  *then* the browser ingests validated JSONL lines through one code path.

**SPEC-R6 — Catalog-derived, drift-gated system prompt.** The machine system prompt MUST be DERIVED
from `catalog.json` (the sole component authority) + the `a2ui-compose` grammar + the `retrieve()`
few-shot block — never hand-maintained. A standing test MUST assert the derived prompt's component/prop
inventory equals the catalog's, so a catalog row added without regeneration fails. *(→ PRD-G6; ADR-0071)*
- **AC1** *Given* `buildSystemPrompt(catalog, exemplars)`, *when* read, *then* the component inventory
  is derived from `catalog.json` at run time (no hand-listed set); *when* the drift test runs, *then*
  the derived inventory equals `Object.keys(catalog.components)` and each row's props, and a planted
  catalog row absent from the prompt makes it FAIL (negative control); `npm test` green.

**SPEC-R7 — Retrieval conditioning.** Generation MUST be conditioned by `retrieve()` top-k exemplars
over the JUDGED shard, co-located with the key-holder (proxy-side for the shipped default — the Node
`fs-store` loads the shard). *(→ PRD-G5 conditioning surface; ADR-0069 Fork C)*
- **AC1** *Given* the loop, *when* it generates, *then* `retrieve(store.all(...), {intent,k,catalogId,
  protocolVersion})` is invoked and its output lands in the derived prompt's few-shot block (asserted
  deterministically over the committed shard — no model).

### 3.3 The round-trip

**SPEC-R8 — Multi-turn client round-trip ("the agent continues").** A client message from
`onClientMessage` (`action` | `functionResponse` | `error`) MUST become the next turn's user input via
a pure reducer (framing each arm distinctly — ADR-0072), and turn N+1's payload MUST be able to
continue the SAME surface (`updateComponents`/`updateDataModel` patch) or open a new one — both via the
existing host. The proxy MUST be stateless (the browser holds the turn history); a demo-level max-turns
cap MUST guard runaway. *(→ PRD-G1; realizes the "agent continues" of NEXT item 3)*
- **AC1** *Given* a client `action`, `functionResponse`, and `error`, *when* each passes the reducer,
  *then* each yields a distinct next-turn user content (unit test); *given* the recorded transcript,
  *when* the round-trip gate drives it, *then* the reducer's framing of turn-1's client message matches
  the transcript and turn-2 updates the surface.

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
- **AC1** *Given* a config row added, *when* the page renders (live overlay available), *then* it
  appears in the menu (derived, not hand-listed), `implemented: false` ones disabled; *given* an
  out-of-allowlist `{provider,model}` pair POSTed to the proxy, *then* it is rejected; *given* the
  allowlist-validation logic, *when* unit-tested, *then* a known implemented pair routes to its `envKey`
  and an unknown-or-unimplemented pair rejects/degrades — deterministic, no key.

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
| **SPEC-N1** | Zero-dep package preserved | `@agent-ui/a2ui/package.json` deps unchanged; the package surface stays exactly `.`/`./examples`/`./corpus`; no LLM SDK anywhere (plain `fetch`); the live infra is site/tools-scoped only (Constraint C2 / ADR-0062/0069). |
| **SPEC-N2** | No secret committed / none baked into a build (the `VITE_` footgun) | A gitignored `.env` (untracked) provisions the keys; no key literal appears in committed source (grep gate). The proxy resolves the non-prefixed `ANTHROPIC_API_KEY` SERVER-side via Vite's `loadEnv(mode, <repoRoot>, '')` merged over `process.env` — Vite does NOT auto-load `.env` into `process.env`, so a bare `process.env` read would miss a `.env`-only key; `loadEnv` runs in Node under `apply: 'serve'` only and the value is never inlined nor sent to the browser (`/status` answers a boolean). Vite INLINES `VITE_*` at build time, so every `import.meta.env.VITE_*` reference MUST live only inside a dev-only-guarded, tree-shaken overlay module — a standing source-level gate asserts it, and a manual `vite build` + grep of `dist/` for the key patterns returns zero hits (ADR-0069). |
| **SPEC-N3** | Validator parity | The runtime loop's validation is the shared `heal`+`validateA2ui` — identical verdict to the renderer and corpus admission; no fork (streaming SPEC-N3). |
| **SPEC-N4** | Progressive paint | The validated payload streams line-by-line (root-early → first paint before finalize), preserving the `a2ui-stream` aesthetic (streaming SPEC-N1). |
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
function produce(input: TurnInput, deps: ProduceDeps, opts: { maxRounds: number }):
  AsyncIterable<string>;   // yields ONLY a validated payload's lines (heal+validateA2ui gate); halt-and-report at the bound

// The derived prompt (SPEC-R6 / ADR-0071) — inventory derived from catalog.json; drift-gated.
function buildSystemPrompt(catalog: Catalog, exemplars: CorpusRecord[]): string;

// The reducer (SPEC-R8 / ADR-0072) — pure; frames a client message as the next user turn.
function nextTurn(session: Session, message: A2uiClientMessage): TurnInput;
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

## 7. Traceability

| Requirement | PRD goal(s) / upstream |
|---|---|
| SPEC-R1, R9, R10, R11, R12 | PRD-G7 (transport interop; the config-driven multi-provider seam + switcher/allowlist); streaming SPEC-R3 |
| SPEC-R2, R4, R5, R7, R8 | PRD-G1 (end-to-end generation renders + is interactive); streaming SPEC-R2/R8/N1; harness SPEC-R6 |
| SPEC-R3, N1, N2 | Constraint C2 (zero-dep); the secret-free CI invariant |
| SPEC-R6 | PRD-G6 (no silent drift) |
| SPEC-N3 | streaming SPEC-N3 (validator parity) |
| SPEC-N4 | PRD-G1 (progressive first paint); streaming SPEC-N1/R8 |
| SPEC-N5 | PRD-G6 (per-provider upstream-format isolation, coherence under change) |

_Realizes streaming SPEC-R2 and harness SPEC-R6 in running code, co-serving PRD-G1 and PRD-G7. See [`../README.md`](../README.md)._
