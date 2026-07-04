# ADR-0073 — the config-driven multi-provider seam: an `AgentProvider` stream seam + a committed `providers.json` registry (Anthropic/OpenAI/Gemini), the SoT for the in-chat switcher and the proxy allowlist; Anthropic now, OpenAI/Gemini the next adapter slices

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-04 |
> | **Proposed by** | planner (design seat — the live-agent intake, NEXT item 3) |
> | **Ratified by** | orchestration-coordinator + Kim ("proceed", 2026-07-04) — green gates: coverage --strict · adr_check 5/5 · harness spec/lld 3/3; all 3 independent doc-reviews GO. Scope Kim-directed (a `/intent-extract` on the provider question) |
> | **Repairs** | `a2ui-live-agent.spec.md` SPEC-R11 (reworked) + new SPEC-R12 (switcher + allowlist) · `a2ui-live-agent.lld.md` LLD-C10 (per-provider) + new LLD-C11 (config registry) + LLD-C12 (switcher) + §5 · `a2ui-live-agent.decomp.json` (l16/l17 reworked, l18/l19 added) |
> | **Supersedes / Superseded by** | Relates ADR-0069 (the transport shape the live overlay rides; the `VITE_` build-key-safety the per-provider keys inherit) · ADR-0070 (the runtime loop whose injected generator IS this seam) |

## Context

The live overlay calls a real model. The gitignored repo-root `.env` provisions keys for THREE
providers — Anthropic, OpenAI, Gemini — each with a server-side and a `VITE_` variant.

An earlier draft of this ADR scoped Claude-only with multi-provider as a deliberate YAGNI: sound
reasoning *in the absence of a consumer*. That premise no longer holds. **Kim ran a `/intent-extract`
on exactly the provider question and supplied both the consumer and the directive:** an in-chat
provider→model switcher, and a config/registry enumerating all three providers + their models NOW
(serving as both the UI menu and the proxy allowlist), with Anthropic implemented now and OpenAI +
Gemini as the immediate next slices — not indefinitely deferred. A ratified consumer + directive is a
real need; YAGNI is decided by the presence of a consumer, and there now is one.

The runtime loop (ADR-0070) already takes an injected generator so the driver is model-agnostic and
stub-testable. That injection point is the provider seam; the open decisions are its shape, the
registry, the switcher, and how the proxy stays the trust boundary when the client names a provider.

## Decision

**Ship a config-driven, multi-provider adapter behind a uniform streaming seam; enumerate all three
providers now; implement Anthropic now; OpenAI and Gemini are the immediate next adapter slices.**

1. **The `AgentProvider` seam.** Each provider is a module exposing
   `stream({ model, system, messages, signal }) → AsyncIterable<string>` — text fragments that
   accumulate into the model's raw output (the A2UI JSONL the transport then ingests line-by-line). The
   driver (ADR-0070) depends only on this signature; it never names a vendor.

2. **One isolated module per provider** under the tools harness
   (`packages/agent-ui/a2ui/tools/agent/providers/`): `anthropic.ts` implemented NOW (over plain
   `fetch`, no LLM SDK; the host-verified Anthropic SSE flow — `message_start` →
   `content_block_delta`(`text_delta`)* → `message_stop`, `event: error` surfaced); `openai.ts` and
   `gemini.ts` are the IMMEDIATE NEXT SLICES. Each module is the SINGLE place its provider's endpoint,
   auth, and stream framing live (SPEC-N5 isolation holds PER MODULE — there is no single "the one SSE
   parser"; there are N, one per provider).

3. **A committed `providers.json` registry** (`tools/agent/providers.json`) — the SINGLE source of
   truth for BOTH the UI menu AND the proxy allowlist:
   `{ defaultProvider, providers: { <id>: { label, envKey, endpoint, defaultModel, models:[{id,label}], implemented } } }`.
   Anthropic is seeded with `claude-opus-4-8` / `claude-sonnet-5` / `claude-fable-5` (default
   `claude-sonnet-5`; `defaultProvider: "anthropic"`; `implemented: true`); OpenAI and Gemini entries
   are present now, stubbed with their public model-ids + endpoints + env-var NAMES, `implemented:
   false`. **The committed file holds env-var NAMES + public endpoints/model-ids ONLY — never a
   secret.** The **`implemented: boolean` flag is the mechanism that reconciles "the registry lists all
   three now" with "Anthropic-first":** the switcher disables `implemented: false` providers (a visible
   roadmap, not selectable — clause 4) and the proxy DEGRADES an allowlisted-but-unimplemented provider
   to backbone-only rather than crashing (clause 5), so the menu can advertise the roadmap while the
   demo never offers what it cannot serve, and going live is a one-field edit + landing the adapter.

4. **An in-chat provider→model switcher** (`site/`, dev-only) renders its dropdowns FROM the registry,
   defaults from `defaultProvider`/`defaultModel`, DISABLES `implemented: false` providers ("coming
   soon"), is live-overridable, persists the selection to `localStorage`, and sends `{ provider, model }`
   with each turn. A config row added surfaces automatically — no hand-listed second menu.

5. **The proxy is the trust boundary** (ADR-0069). It VALIDATES the requested `{ provider, model }`
   PAIR against the registry allowlist — an unknown-or-unimplemented pair is rejected/degraded, never
   trusted — and routes to `process.env[<config.envKey>]` for the matched provider. A defensive
   dispatch degrades an allowlisted-but-unimplemented provider to backbone-only, never an unhandled
   crash. The key is passed INTO the adapter, never read at module scope, so the same adapter serves
   the proxy (server key) and a future
   client-direct overlay (`VITE_` key, dev-only-guarded — ADR-0069's footgun handling generalizes to
   N providers unchanged).

## Consequences

- **A real consumer drives real scope.** The registry + switcher exist because Kim asked for them; the
  adapter set grows to three by construction (Anthropic wired, OpenAI/Gemini next), not "someday."
- **A new provider is a new module + a config row** — no driver change; the seam is real and exercised
  by more than one arm.
- **The trust boundary is explicit.** The client names a provider/model; the proxy validates it against
  the committed allowlist and holds the key — a client value never selects an arbitrary endpoint or key.
- **Security generalizes unchanged.** The `VITE_` build-key-safety mechanism (ADR-0069) is per-provider
  by env-var name; the committed registry carries names, not secrets.
- **Per-slice host-verify is named:** OpenAI + Gemini streaming contracts are host-verify-BEFORE-those
  adapter slices (Anthropic-first makes them non-blocking now).
- **Stale → re-verify on the build gate:** the `providers.json` model lists (as vendors add/rename
  models) · each adapter's stream framing (per its host-verified contract) · the switcher's rendered
  menu (derives from the registry, so it can't drift silently — a shape test guards it).

## Acceptance

- `providers.json` is committed with all three providers (Anthropic seeded
  `opus-4-8`/`sonnet-5`/`fable-5`, default `sonnet-5`, `implemented: true`; OpenAI/Gemini stubbed with
  their models, `implemented: false`); a grep proves NO secret value in it; a standing test asserts it
  parses, every provider has `envKey`/`endpoint`/`defaultModel`/`implemented`, `defaultModel ∈ models`,
  `defaultProvider ∈ providers` and is `implemented`.
- `providers/anthropic.ts` implements `stream(...)` over plain `fetch` (host-verified contract) with its
  SSE parse split as a PURE function fixture-tested deterministically (no network); a grep proves no
  `@anthropic-ai/sdk` import; the driver imports only the `AgentProvider` signature; the stub-provider
  loop test passes with no live model.
- `openai.ts` and `gemini.ts` are the named next slices — their config rows are present now
  (`implemented: false`); their adapters are scheduled, not built this slice (a stated, non-silent
  deferral, each gated on its streaming-contract host-verify).
- The switcher renders from the registry (disabling `implemented: false` providers), persists to
  `localStorage`, and threads `{provider,model}` into each turn; the proxy rejects an out-of-allowlist
  PAIR, DEGRADES an allowlisted-but-unimplemented provider to backbone-only (never crashes), and routes
  a valid implemented pair to the matched env key.

## Alternatives considered

- **Build the config-driven, three-provider abstraction now [CHOSEN].** Forcing context: Kim's
  `/intent-extract` directive AND the in-chat switcher consumer. With a real consumer, enumerating the
  providers and building the seam + registry now is the right scope, not speculation.
- **Claude-only, no config, multi-provider as a named YAGNI [REJECTED — the prior draft].** Sound only
  without a consumer; Kim supplied one (the switcher) and the directive, so the YAGNI premise is
  falsified. Kept here as the record of what changed and why.
- **Hardcode Anthropic inside the driver (no seam).** Rejected: couples the loop to one vendor and
  defeats the injection the loop's own tests require; a provider swap becomes a driver rewrite.
- **Trust the client's `{provider,model}` (no allowlist).** Rejected: a client-named endpoint/key is a
  security hole; the committed registry is the allowlist the proxy validates against.
- **A heavyweight plugin/registry framework for providers.** Rejected as over-engineering: a JSON file
  + one `stream()` signature per module is the whole mechanism; no runtime plugin system is warranted.
