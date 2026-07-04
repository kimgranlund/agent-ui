# LLD — A2UI Live-Agent Example (skeleton)

> Status: accepted + REALIZED · v0.2 · 2026-07-04 (ratified) · realized 2026-07-05 · Layer: LLD (implementation plan)
> Implements: [`../specs/a2ui-live-agent.spec.md`](../specs/a2ui-live-agent.spec.md) (SPEC-R1..R12, SPEC-N1..N5), targeting A2UI **v1.0**.
> Realizes concretely: [`./a2ui-streaming-pipeline.lld.md`](./a2ui-streaming-pipeline.lld.md) **LLD-C2** (the `produce()` generation driver — the "blocked by the live-agent wave" note resolves here) — the loop CONTRACT stays [`./a2ui-harness-wiring.lld.md`](./a2ui-harness-wiring.lld.md) §6.
> Decisions: **ADR-0069** (demo shape + the `AgentTransport` seam + the `VITE_` build-key-safety invariant) · **ADR-0070** (runtime loop scope) · **ADR-0071** (derived prompt) · **ADR-0072** (session model) · **ADR-0073** (the model-provider seam). All accepted (ratified 2026-07-04).
> Reuses without redesign: the renderer host (`renderer/renderer.ts` — `createRenderer`), the shared `heal`+`validateA2ui`, `retrieve()`, the default catalog, the seed shelf. No fork (SPEC-N3 parity).
> Altitude: adds the **how** — the module map, the deterministic-backbone contract, the round-trip state machine; cites `SPEC-R*`. All C1–C12 bodies are now REALIZED (§1 State column; decomp `a2ui-live-agent.decomp.json`, nodes l7–l19). The tree is the ground truth — `git log -- packages/agent-ui/a2ui/tools/agent/ site/pages/a2ui-live.*` + the co-located `pkg/src/live-agent/*.test.ts`; when this doc disagrees, the tree wins.

---

## 0. Placement law (the one that keeps SPEC-N1 true)

Everything live/keyed/networked lives OUTSIDE `@agent-ui/a2ui`'s public surface — which stays exactly
`.` / `./examples` / `./corpus` (**no package export/runtime additions this wave**). The Node-scoped
harness lands NESTED under the a2ui package's `tools/` dir (the realized `tools/corpus/` + `tools/harness/`
precedent — the ONLY `tools/` in the repo is `packages/agent-ui/a2ui/tools/`, NOT a repo-root dir). The
split mirrors ADR-0062's pure-core/Node-shell discipline:

- **`site/`** — the page + the browser-side UI (the switcher) + the browser transports (they run in the
  browser; no key, no `fs`). Covered by `check:site` (site tsconfig `include: site/**`); NOT by vitest.
- **`packages/agent-ui/a2ui/tools/agent/`** — the Node-scoped harness: the loop driver, the prompt
  derivation, the recorded transcript, the session reducer, the per-provider adapters + the config
  registry, and the dev-proxy plugin. Node-type-stripped `.ts` (the `tools/corpus/` precedent), zero
  third-party deps, plain `fetch` for the live call (no LLM SDK). **NOT in any tsconfig `include`
  (root `include` = `packages/agent-ui/*/src`), so these are typechecked ONLY transitively (when an
  included src file imports them) and run via `node --experimental-strip-types` — the honest
  `tools/corpus` reality; see §2's discovery table.**
- **`packages/agent-ui/a2ui/src/live-agent/`** — the STANDING TESTS (round-trip · prompt-drift ·
  stub-provider loop · providers.json shape · build-key-safety source-grep). This IS the vitest+tsc
  include (`packages/agent-ui/*/src/**/*.test.ts`), so these run in `npm test` and typecheck in
  `npm run check`, and they reach out into `../../tools/agent` to drive the harness (the site-canon
  reach-out — a src TEST importing a tools module, which also transitively typechecks it).
- **`@agent-ui/a2ui`** (`src/` runtime + exports) — untouched. Consumed via its public surfaces only.

**Keys + the `VITE_` footgun (ADR-0069, SPEC-N2).** A gitignored repo-root `.env` (untracked) provides
per-provider server-side keys (`ANTHROPIC_API_KEY`, …). The proxy resolves each via Vite's
`loadEnv(mode, <repoRoot>, '')` merged over `process.env` (envKey per provider from `providers.json`) —
**not** bare `process.env`, because Vite does NOT load `.env` into `process.env` (non-`VITE_` vars are
kept out of both `process.env` and `import.meta.env`), so a `.env`-only key would otherwise read as
unset (the "no live API key found" degrade); a shell-exported key still wins via the merge. `loadEnv`
runs in Node under `apply: 'serve'` ONLY and the value never leaves the proxy. The `.env` also carries
`VITE_` variants for the deferred client-direct arm.
Vite inlines `VITE_*` at `build` time, so **every live-overlay module is reached only via a dev-only
dynamic `import()` guarded by `import.meta.env.DEV`** — `vite build` tree-shakes it (and any `VITE_`
reference) out. The proxy's non-prefixed keys are never inlined. The build-key-safety gate (LLD-C8c)
proves `dist/` is key-free. This generalizes to N providers UNCHANGED.

The `AgentTransport` interface (SPEC-R1) is the seam both sides meet at — it lives in the harness
(`tools/agent/agent-transport.ts`) and the site imports it (or a thin `site/lib` re-export shim if the
site tsconfig needs it in-tree); it is pure zero-dep TS either way.

## 1. Component map (traceability)

All harness paths are under `packages/agent-ui/a2ui/` (abbreviated `pkg/` below); site paths under `site/`.

| ID | Component | Implements | File (scope) | State |
|---|---|---|---|---|
| **LLD-C1** | `AgentTransport` interface + `Turn`/`Session`/`TurnInput` (incl. `{provider,model}`) types (the seam) | SPEC-R1 | `pkg/tools/agent/agent-transport.ts` (site imports it / a `site/lib` re-export shim) | ✅ built |
| **LLD-C2** | `RecordedTransport` + the committed transcript (the backbone) | SPEC-R2 | `pkg/tools/agent/recorded-transport.ts` + `transcript.ts` (reuses a shelf seed) | ✅ built |
| **LLD-C3** | `produce()` runtime loop driver (streaming LLD-C2 realized) | SPEC-R4, R5, R7, R12 | `pkg/tools/agent/produce.ts` | ✅ built (opts.model authoritative — SPEC-R12 trust boundary) |
| **LLD-C4** | `buildSystemPrompt()` — catalog-derived + few-shot | SPEC-R6 | `pkg/tools/agent/system-prompt.ts` | ✅ built |
| **LLD-C5** | `nextTurn()` session reducer + the turn-history model | SPEC-R8 | `pkg/tools/agent/session.ts` | ✅ built |
| **LLD-C6** | The dev-server Vite proxy plugin (key-holder + PAIR-allowlist validation + degrade-on-unimplemented; hosts C3+retrieval+C10) | SPEC-R9, R11, R12, N2, N5 | `pkg/tools/agent/dev-proxy-plugin.ts` (wired into the site dev config, dev-only) | ✅ built (passes the validated model + registry endpoint) |
| **LLD-C7** | `LiveProxyTransport` (browser → proxy; dev-only-guarded) | SPEC-R9 | `site/lib/live-proxy-transport.ts` | ✅ built |
| **LLD-C8** | The secret-free standing gates (round-trip · prompt-drift · build-key-safety · config-shape · SSE-parse fixture) | SPEC-R2, R6, R3, R11, N2 | `pkg/src/live-agent/*.test.ts` (the vitest+tsc include; §3/§6) | ✅ built (8 files / 23 tests) |
| **LLD-C9** | The site page + switcher mount + dual-TOC wiring (the visible proof; live overlay dev-only-guarded) | SPEC-R10, R12, N4 | `site/a2ui-live.html` + `site/pages/a2ui-live.ts` (+`.css`) + `site/main.ts` | ✅ built (WAI-ARIA tabs, in-flight indicator) |
| **LLD-C10** | The `AgentProvider` seam + one adapter PER provider (Anthropic now; openai/gemini next), each with a PURE SSE-parse (fixture-tested) | SPEC-R11, N5 | `pkg/tools/agent/providers/{anthropic,openai,gemini}.ts` + `providers/index.ts` (dispatch + degrade) | ✅ built (anthropic real; openai/gemini stubs, `implemented:false`) |
| **LLD-C11** | The provider config registry (`providers.json` incl. `implemented`) + pure validation/lookup helpers — SoT for the menu AND the PAIR-allowlist | SPEC-R11, R12 | `pkg/tools/agent/providers.json` + `providers-config.ts` | ✅ built |
| **LLD-C12** | The in-chat provider→model switcher (config-rendered, unbuilt disabled, `localStorage`, dev-only, sends `{provider,model}`) | SPEC-R12 | `site/lib/provider-switcher.ts` (mounted by the page) | ✅ built |
| — | **`BrowserDirectTransport`** (client-direct, provisioned) | SPEC-R9 (deferred) | `site/lib/browser-direct-transport.ts` | DEFERRED — CORS host-verified viable-but-dangerous; same seam; dev-only-guarded; uses C10 in-browser |

## 2. File / module map (which lands where)

```
site/
  a2ui-live.html                       # the MPA entry (Vite auto-discovers it; no vite.config edit)
  pages/a2ui-live.{ts,css}             # LLD-C9 — consumes AgentTransport ONLY; createRenderer + mount + the switcher
  lib/live-proxy-transport.ts          # LLD-C7 — browser → proxy; yields A2UI JSONL (dev-only-guarded import)
  lib/provider-switcher.ts             # LLD-C12 — dropdowns rendered from providers.json; localStorage
  lib/browser-direct-transport.ts      # DEFERRED — client-direct (VITE_ key + a C10 adapter in-browser); dev-only-guarded
  main.ts                              # +1 dual-TOC entry for a2ui-live
packages/agent-ui/a2ui/tools/agent/    # NEW dir — Node-scoped, zero-dep, type-stripped (the tools/corpus precedent)
  agent-transport.ts                   # LLD-C1 — the seam (pure, zero-dep); site imports it (or a site/lib shim)
  transcript.ts                        # LLD-C2 data — turns; turn-1 payload = a committed shelf seed
  recorded-transport.ts                # LLD-C2 — replays the transcript (implements AgentTransport)
  produce.ts                           # LLD-C3 — the bounded loop; injected AgentProvider; shared heal+validate
  system-prompt.ts                     # LLD-C4 — buildSystemPrompt(catalog, exemplars), catalog-derived
  session.ts                           # LLD-C5 — nextTurn() reducer + turn-history
  providers.json                       # LLD-C11 data — the registry (env-var NAMES + endpoints/model-ids, NO secrets)
  providers-config.ts                  # LLD-C11 — typed loader + validation helpers (menu + allowlist SoT)
  providers/index.ts                   # LLD-C10 — provider-id → AgentProvider dispatch
  providers/anthropic.ts               # LLD-C10 — the Anthropic adapter NOW (plain fetch; SPEC-N5 SSE parse)
  providers/openai.ts · gemini.ts      # LLD-C10 — the IMMEDIATE NEXT SLICES (host-verify each before building)
  dev-proxy-plugin.ts                  # LLD-C6 — Vite configureServer middleware (dev-only); allowlist + loadEnv('.env')[envKey] over process.env; C10→C3
packages/agent-ui/a2ui/src/live-agent/ # the STANDING TESTS (the vitest+tsc include) — reach out into ../../tools/agent
  round-trip.test.ts · prompt-drift.test.ts · produce-loop.test.ts · providers-config.test.ts · build-key-safety.test.ts
packages/agent-ui/a2ui/{src,exports}   # UNCHANGED — public surface stays .`/`./examples`/`./corpus` (SPEC-N1)
```

**Discovery table (B2 — the honest typecheck/test path per module; `check` = `tsc && check:site`):**

| Module(s) | `npm run check` (tsc) | `npm test` (vitest) | Notes |
|---|---|---|---|
| `pkg/src/live-agent/*.test.ts` (the gates) | ✅ direct (in root `include`) | ✅ direct (in vitest `include`) | the standing gates; import the tools modules → transitively typecheck them |
| `session.ts`·`produce.ts`·`system-prompt.ts`·`providers-config.ts`·`providers/index.ts`·`recorded-transport.ts`·`transcript.ts` | ✅ **transitive** (imported by a src test) | ✅ **transitive** (exercised by a src test) | NOT in `include`; covered because a `src/live-agent` test imports them (the pure logic) |
| `providers/anthropic.ts` — the PURE SSE-chunk→fragment parse | ✅ **transitive** (the fixture test imports it) | ✅ **transitive** (the SSE-parse fixture test) | the parse is split OUT as a pure fn (LLD-C10, §5) so it IS gate-covered |
| `providers/anthropic.ts` — the `fetch`/network arm | ⚠️ transitive typecheck via dispatch import | ✋ **no standing test** — MANUAL live acceptance | type-stripped execution; a real key + `vite dev` |
| `dev-proxy-plugin.ts` (server wiring) | ✋ type-stripped/executed by Vite (not in `include`, not imported by a src test) | ✋ **no standing test** — MANUAL live acceptance | its PURE allowlist/env-routing/degrade logic IS split into `providers-config.ts` and unit-tested (SPEC-R12 AC1 / R11 AC4) |
| `providers.json` | n/a (data) | ✅ via `providers-config.test.ts` (shape) | committed; no secrets |
| `site/pages/a2ui-live.ts`·`site/lib/*.ts` | ✅ `check:site` (site `include`) | ✋ vitest is packages-only — site tests don't run | proof rides the `src/live-agent` gates + MANUAL browser/live acceptance |

So §7's "green per slice" means: the pure logic is `check`+`test`-green via the `src/live-agent` gates
that import it; the live HTTP arms + the dev-proxy + the site page are `check:site`-typechecked where
applicable and otherwise MANUAL live/browser acceptance — NEVER a standing CI gate (they need a key).

**Placement note (LLD-C1):** the seam lives in the harness (`tools/agent/agent-transport.ts`); the page
imports it directly, or via a one-line `site/lib/agent-transport.ts` re-export if the site tsconfig
needs the type in-tree. Pure zero-dep TS either way; settle the shim at build.

**Dev-config wiring (LLD-C6):** the proxy plugin is added to the site's dev config (the root
`vite.config.ts`'s `plugins`, or a `site/`-scoped extension), NEVER to the package's exports. It only
attaches under `vite dev`; `vite build` emits a static site with no proxy (SPEC-R3/N2). Keep it a
dev-only conditional so `build` output is untouched.

**`providers.json` data-access — DECISION, TWO readers over ONE file (NM2/NM3):**
- **The switcher (LLD-C12, browser/Vite).** `providers.json` lives at
  `pkg/tools/agent/providers.json` — outside `site/` and outside package exports. The switcher reads it
  via a **direct build-time relative JSON import** (`import providers from
  '.../tools/agent/providers.json'`) — Vite bundles JSON natively (unlike Node's ESM loader), the file
  has NO secrets so it is safe to bundle, and the switcher is dev-only anyway (so it and the JSON leave
  the production bundle with the overlay). If the site tsconfig needs the type in-tree, add a one-line
  `site/lib/providers-config.ts` re-export shim (mirroring the `agent-transport` shim). This is settled,
  not "settle at build."
- **The proxy + the config-shape test (LLD-C11, Node).** `providers-config.ts` exposes PURE
  validation/lookup/degrade helpers over an ALREADY-PARSED `ProvidersConfig` object; the Node reader
  (proxy + the vitest shape test) obtains that object via **`readFileSync` + `JSON.parse`** — the SAME
  treatment `catalog.json` gets (Node's native ESM loader rejects an attribute-less JSON import,
  `ERR_IMPORT_ATTRIBUTE_MISSING`, under `--experimental-strip-types`; §5). Pure-core takes the object;
  the Node shell does the read (ADR-0062).

**The `VITE_` build-key-safety mechanism (LLD-C9/C10, SPEC-N2):** the page imports the live-overlay
transport (LLD-C7 or the deferred browser-direct) ONLY through `if (import.meta.env.DEV) { const { …} =
await import('…') }`. Vite statically evaluates `import.meta.env.DEV` to `false` under `vite build`, so
the dynamic branch is dead-code-eliminated and every `import.meta.env.VITE_*` reference inside those
modules leaves the production bundle. The proxy path never touches `VITE_` at all (its key is
`process.env`-side). LLD-C8c gates it.

## 3. Deterministic-backbone contract (LLD-C2 + LLD-C8 gate) — SPEC-R2

**The transcript shape** (data, no live logic):

```ts
interface RecordedTranscript {
  intent: string;                       // the "prompt" the recorded agent received
  turns: RecordedTurn[];                // in order
}
interface RecordedTurn {
  // turn N: the A2UI stream the agent emitted (JSONL lines), and the interaction that follows it.
  lines: string[];                      // A2UI JSONL — turn-1 reuses a committed shelf seed (validity ⇐ examples.test.ts)
  expectClientMessage?: A2uiClientMessage;  // the client message a scripted interaction produces (asserted)
}
```

**The round-trip gate (LLD-C8a)** — a standing packages-tree test (in the vitest include) drives the
transcript through the REAL host, deterministically, with no network/key:

1. `const host = createRenderer(); host.onClientMessage(collect); host.mount(el)`.
2. Feed turn-1 `lines` via `host.ingest` → assert the surface renders (`el.childElementCount > 0`),
   `host.finalize()` clean.
3. Simulate the scripted interaction → assert the collected client message deep-equals turn-1's
   `expectClientMessage`.
4. `nextTurn(session, clientMessage)` (LLD-C5) → assert the framed user turn matches the transcript's
   turn-2 input.
5. Feed turn-2 `lines` → assert the surface UPDATES (the "agent continues" — same `surfaceId` patch or
   a new surface).

This is the visible page's proof, exactly as `renderer.test.ts` + `examples.test.ts` are `a2ui-stream`'s
(the page invents no parallel check — SPEC-R10).

**The build-key-safety gate (LLD-C8c, SPEC-N2 — closing the `VITE_` footgun):**
- *source-level (standing):* a grep/test asserting every `import.meta.env.VITE_*` occurrence sits
  inside a module reached only via a dev-only (`import.meta.env.DEV`) dynamic import — never in the
  page's static import graph. Cheap, deterministic, secret-free.
- *build-level (manual, the `npm run size` precedent):* `vite build` then grep `dist/` for the key
  patterns → zero hits. Run when touching the overlay wiring; not in CI (no build in the standard
  gates).

**Gate-wiring — SETTLED (§0/§2):** the round-trip test (and every standing gate) lives at
`pkg/src/live-agent/round-trip.test.ts` (the vitest+tsc include) and reaches out into `../../tools/agent`
to drive `recorded-transport.ts` + `session.ts` through `createRenderer()` — the "site-canon reach-out"
precedent ([[site-tests-excluded-from-vitest]]; tests already import `../examples`). The ONE remaining
contingency is mechanical, not a design fork: **verify at build that the import-layering trip-wire
permits a src *TEST* → `tools/` import** (it targets `src/**` NON-test imports, so it should). IF — and
only if — it objects, the sanctioned fallback is to commit the transcript as a `src/`-side fixture and
keep the reducer in `tools/`, importing only the reducer. Do NOT weaken the tripwire. Either way the
payloads reuse shelf seeds, so validity is free.

## 4. Round-trip state machine (LLD-C5) — SPEC-R8

```
idle
  └─(submit intent)──────────▶ generating(turn N)        # produce(): retrieve → generate → heal+validate → self-correct (≤3)
       └─(validated payload)──▶ streaming(turn N)         # validate-then-stream: paced JSONL → host.ingest → progressive paint
            └─(finalize)──────▶ awaiting-interaction      # host.finalize() clean; the human can act
                 └─(onClientMessage: action|functionResponse|error)
                      └─ nextTurn(session, msg) ─────────▶ generating(turn N+1)   # the reducer frames the user turn
       ...                                                # bounded by a demo max-turns cap → halt
  └─(produce halts at maxRounds)─▶ error(report)          # no invalid surface emitted (SPEC-R5)
```

- **`nextTurn` framing (ADR-0072):** `action` → "user triggered `<name>`" + `context` + `dataModel`
  (when carried); `functionResponse` → the awaited `value` for the issued `callFunction`; `error` →
  the validation failure, fed back for CROSS-turn recovery (distinct from `produce()`'s intra-turn
  self-correct loop).
- **Statelessness (SPEC-R8):** the browser holds `Session`; each live turn POSTs the turn history to
  the proxy, which reconstructs the Messages-API call. No server session store.
- **Surface continuity:** turn N+1 emits to the same `surfaceId` (host patches in place) or a new one
  (host replaces) — no renderer change (`renderer.ts` already handles both).

## 5. The runtime loop (LLD-C3) — SPEC-R4/R5/R7, streaming LLD-C2 realized

```ts
// queryOf(input): the RetrieveQuery for a turn — { intent: input.text ?? framedClientMessage,
//   k, catalogId: 'agent-ui', protocolVersion: 'v1.0' } (turn-1 uses the intent; later turns the
//   framed client message as the search text). Pure; the retrieval scope is the judged shard.
async function* produce(input, deps, opts) {                 // deps.provider: AgentProvider (stub|real)
  const exemplars = deps.retrieve(queryOf(input));           // SPEC-R7 — top-k over the judged shard
  const system = buildSystemPrompt(deps.catalog, exemplars); // SPEC-R6 — catalog-derived
  let failures = undefined;
  for (let r = 0; r < opts.maxRounds; r++) {                 // maxRounds = 3
    let raw = '';
    for await (const frag of deps.provider.stream({ model: input.model, system,
                 messages: messagesFor(input, failures), signal: opts.signal })) raw += frag;  // accumulate fragments
    const messages = splitLines(raw).map(heal);              // shared healer (no fork)
    const verdict = validateA2ui(assemble(messages), deps.catalog);   // shared validator (SPEC-N3)
    if (verdict.failures.length === 0) { yield* validatedLines(messages); return; }  // R5 validate-then-stream
    failures = verdict.failures;                             // R4 self-correct: feed failures back
  }
  throw new ProduceHalt(failures);                           // bounded; emit nothing invalid; host reports
}
```

**Provider-agnostic (LLD-C10, ADR-0073):** `deps.provider` is the injection point — the proxy (LLD-C6)
supplies the adapter matched to the request's `provider` (via `providers/index.ts`), the `src/live-agent`
loop test supplies a stub `AgentProvider` (first-invalid-then-valid fragments) so the loop mechanics are
gate-covered with NO live model (SPEC-R4 AC1). Each adapter is ITS provider's single upstream boundary
(SPEC-N5). `providers/anthropic.ts` calls `POST /v1/messages` with plain `fetch` (`x-api-key` +
`anthropic-version: 2023-06-01`; body `stream:true`); its SSE handling is split in two:

```ts
// PURE (fixture-tested — LLD-C8/SPEC-R11 AC3): SSE chunk text → the accumulated model text fragments.
function* parseAnthropicSSE(chunk: string): Iterable<string> { /* yield delta.text on
  content_block_delta where delta.type==="text_delta"; ignore ping/thinking/tool; surface event:error */ }
// IMPURE (MANUAL live acceptance): the fetch + ReadableStream reader that feeds parseAnthropicSSE.
async function* stream(req) { /* fetch(endpoint, …); for await (chunk) yield* parseAnthropicSSE(chunk) */ }
```

The pure `parseAnthropicSSE` is fed a CAPTURED SSE-response fixture in a `src/live-agent` unit test
(deterministic, no network — the code most likely to break on an upstream change is gated); the `fetch`
arm is MANUAL live acceptance. Completion = `message_stop`; `event: error` is surfaced (the
host-verified 2026-07-04 contract). **Default model:** `claude-sonnet-5` (the registry's `defaultModel`)
— Execute tier; `claude-opus-4-8` opt-in, `claude-fable-5` for latency; the model id rides
`{provider,model}` from the switcher (SPEC-R12). Keys are passed IN (the `loadEnv`-resolved value
server-side / `import.meta.env.VITE_*` for the deferred client-direct arm), never module-scoped. **Defensive
dispatch (LLD-C6):** `providers/index.ts` maps a provider id → adapter; an allowlisted-but-`implemented:
false` provider (or a missing module) returns the distinguishable "provider not yet available" signal →
the proxy degrades to backbone-only (like the no-key path), NEVER an unhandled crash (SPEC-R11 AC4).
**OpenAI + Gemini adapters are the immediate NEXT slices** (config rows present, `implemented: false`;
host-verify each streaming contract before building — ADR-0073).

**Registry load (LLD-C11):** `providers-config.ts` exposes PURE validation/lookup/degrade helpers over
an already-parsed `ProvidersConfig`; the Node reader (proxy + the vitest shape test) supplies it via
`readFileSync` + `JSON.parse` — the SAME treatment `catalog.json` gets below; the browser switcher reads
the file via a Vite JSON import (§2 data-access decision).

**buildSystemPrompt (LLD-C4):** three parts — grammar (from the `a2ui-compose` references, DRY) +
catalog inventory DERIVED from `catalog.json` at run time + the few-shot exemplars. The drift gate
(LLD-C8b) asserts the derived catalog inventory == `Object.keys(catalog.components)` and each row's
props (a planted row absent fails) — the catalog half is mechanically gated; the grammar half is a
manual-review discipline (ADR-0071, not equal-strength). **Catalog load under Node** mirrors the real
`validate-payload.ts` / `import-seeds.ts` mechanism: `loadCatalog` reads `catalog.json` via
`readFileSync` + `JSON.parse` (Node's native ESM loader rejects an attribute-less JSON import —
`ERR_IMPORT_ATTRIBUTE_MISSING` — under `--experimental-strip-types`), NOT an ES-module `import … with
{ type: 'json' }`.

## 6. Error & edge-case handling (SPEC — the L5 section)

| Code / edge | Stage | Handling |
|---|---|---|
| generation never validates | LLD-C3 | `produce()` halts at `maxRounds = 3` and reports — emits NOTHING invalid (SPEC-R5); the page shows a "could not compose a valid surface" error, not a broken render |
| a malformed line mid-stream | LLD-C3/C7 | the renderer's parser fault-isolates it (`PARSE` → stream continues, runtime SPEC-N4); but validate-then-stream (SPEC-R5) means the browser only ever receives already-validated lines, so this is a defense-in-depth fallback, not the normal path |
| no key for the requested provider (the `loadEnv`-resolved `envKey` unset in `.env` AND the shell) | LLD-C6 | the proxy returns a graceful "backbone only" signal; the page falls back to the RecordedTransport — no crash, no CI dependency (SPEC-R9 AC1) |
| an out-of-allowlist `{provider,model}` PAIR from the client | LLD-C6/C11 | the proxy REJECTS it — it validates the PAIR against `providers.json` (the `provider` must be listed AND the `model` must be in that provider's `models`), never trusting an arbitrary client value; only a config-listed provider's `envKey` is ever read (SPEC-R12) |
| an allowlisted-but-unimplemented provider (`implemented: false`, or a missing adapter module) | LLD-C6/C10 | defensive dispatch: `providers/index.ts` returns "provider not yet available" → the proxy degrades to backbone-only (like the no-key path), NEVER an unhandled crash (SPEC-R11 AC4); the switcher also disables such providers so this is only a defense-in-depth guard |
| upstream API/SSE shape changes | LLD-C10 | isolated in the ONE per-provider adapter's PURE parse (`providers/<id>.ts`, SPEC-N5, fixture-tested) — one module to repair; the driver, the transports + the browser are unaffected (they see clean A2UI JSONL); OpenAI/Gemini contracts are host-verify-before-those-slices |
| a `VITE_` key baked into a build | LLD-C9/C10 | closed by construction: every live overlay is dev-only-dynamic-imported (`import.meta.env.DEV`), so `vite build` tree-shakes it + its `VITE_` refs out; the proxy default never uses `VITE_`; LLD-C8c (source-grep + manual build-grep) proves `dist/` is key-free (SPEC-N2) |
| a client error message | LLD-C5 | `nextTurn` frames it as the next user turn (cross-turn recovery) — the agent gets a chance to fix on the next turn, distinct from the intra-turn loop |
| runaway agent (keeps emitting) | LLD-C5 | the demo max-turns cap halts the session; each turn is itself bounded (`maxRounds`) |
| catalog grows, prompt stale | LLD-C4/C8b | the drift test FAILS in `npm test` (a catalog row not surfaced in the derived prompt) — the PRD-G6 coherence gate, mechanical |
| a live call attempted in CI | LLD-C8 | impossible by construction — CI runs only the deterministic backbone + the stub-generator + drift tests; the live path needs `vite dev` + a key (SPEC-R3) |
| the built static site | LLD-C6/C9 | ships the backbone only — no proxy attaches under `vite build`; a grep asserts no key + no live endpoint in `dist/` (SPEC-N2, R10 AC1) |

## 7. Build sequence (slices = the decomp `a2ui-live-agent.decomp.json` l-nodes; gates per slice)

Parallel-safe after the design root (this intake + ADR ratification). "Green per slice" is scoped per
the §2 discovery table — pure logic goes `check`+`test`-green via the `src/live-agent` gate that
imports it; live/site slices are `check:site`-typechecked where applicable and otherwise MANUAL
acceptance (never a standing CI gate):

1. **l1 SPEC / l2 LLD** *(this intake — done)* + **l3–l6 + l16 ADR-0069/0070/0071/0072/0073 proposed →
   ratified** *(host + Kim; `adr_check.py` 0; dependent slices dispatch only after acceptance)*.
2. **Seam first:** l7 `AgentTransport` *(the interface every transport + the page bind to; typechecked
   via its `src/live-agent` type-only test)*.
3. **Group A (parallel, file-disjoint) after l7 / the ADRs — pure harness logic, gate-covered via the
   `src/live-agent` tests that import it:** l10 `buildSystemPrompt` (needs l5) · l11 `session.ts`
   (needs l6) · l8 `RecordedTransport` + transcript (needs l7) · l18 `providers.json` (incl.
   `implemented`) + `providers-config.ts` pure helpers (needs l16) · l17 the `AgentProvider` seam +
   `providers/anthropic.ts` (with the PURE `parseAnthropicSSE`) + dispatch/degrade (needs l16, l18) · l9
   `produce()` (needs l4, l10, l17-seam) *(tools/harness seat)*.
4. **Group B (parallel) — live/site, MANUAL acceptance, never a CI gate:** l12 the dev-proxy plugin +
   PAIR-allowlist validation + degrade-on-unimplemented (needs l9, l17, l18) · l13 `LiveProxyTransport`
   (needs l7, l12) · l19 the dev-only provider-switcher (renders from l18, disables `implemented: false`,
   `localStorage`) (needs l18) *(tools/site seat; `check:site` where applicable)*.
5. **l14 the standing gates** (needs l8, l10, l11, l17, l18) — round-trip · prompt-drift ·
   providers-config shape (incl. `implemented`) · `parseAnthropicSSE` fixture · dispatch-degrade ·
   build-key-safety source-grep (LLD-C8c); `npm test` green, secret-free; the build-grep is manual.
6. **l15 the site page + switcher mount + TOC** (needs l7, l8, l11, l13, l14, l19) — the visible proof;
   live overlay dev-only-guarded; `check` + `check:site` green; rides l14.
7. **NEXT (named, not this slice):** l17's `providers/openai.ts` + `gemini.ts` adapters — config rows
   present now; build each after host-verifying its streaming contract.

**Discovered-reality notes:** if the src-TEST → `tools/agent` import (§3) trips the import-layering
guard, fall back to committing the transcript/config as `src/`-side fixtures (§3, second option) — do
NOT weaken the tripwire. **Host-verify: all three original flags DISCHARGED (2026-07-04)** — Anthropic
streaming (folded into `providers/anthropic.ts`, §5), client-direct CORS (viable-but-dangerous →
BrowserDirect stays deferred/dev-only), A2A continuity (ADR-0072 cites it). The only remaining
host-verifies are the per-slice OpenAI + Gemini streaming contracts (before step 7).
