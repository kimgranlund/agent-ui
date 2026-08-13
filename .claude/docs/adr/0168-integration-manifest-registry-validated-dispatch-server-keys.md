# ADR-0168 — Integrations become a manifest registry: validated dispatch, server-resolved keys, and tools on BOTH live arms

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-04 |
> | **Proposed by** | planner (design seat — the tool/integration ENABLEMENT intake; GH [#402](https://github.com/kimgranlund/agent-ui/issues/402) is the fork this record must decide) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-04, via the [`ratify ADR-0168` utterance](https://github.com/kimgranlund/agent-ui/pull/407#issuecomment-5174686542) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | **On ratification+build:** [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) v0.8 → v0.9 (the amendment sheet [`../decompositions/tool-enablement.spec-amendment.md`](../decompositions/tool-enablement.spec-amendment.md) — SPEC-R16…R19 added, Definitions/§5/SPEC-N1 amended) · `packages/agent-ui/a2ui/tools/agent/integrations.ts` (the `Integration` interface's own header comment "the whole enablement chain keys on this one string" — the fact this record retires) · `site/pages/agent-admin-libraries.ts` `INTEGRATION_TOOLS` (labels become human labels; the id rides separately) · GH #402 (closed `completed` on branch (a), cl.5) · [`../lld/tool-enablement.lld.md`](../lld/tool-enablement.lld.md) + [`../decompositions/tool-enablement.decomp.md`](../decompositions/tool-enablement.decomp.md) (this arc's build plan) |
> | **Supersedes / Superseded by** | **Extends** [ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md) (the shell law this record keeps: registry/keys/proxy stay `tools/agent/`-side; the portable `src/agent/` core still carries types only) · [ADR-0152](./0152-live-agent-production-worker-proxy.md) (the registry ships in the production Worker — secret resolution here must work in BOTH hosts) · [ADR-0073](./0073-a2ui-live-model-provider-seam.md) cl.5 (the trust boundary: the browser never holds a key — extended verbatim to integration keys) · [ADR-0135](./0135-agent-harness-config-schema-and-prompt-files.md) (the config-schema surface `integrations` joins, via its own Fork-1 projection precedent) · **Relates** [ADR-0136](./0136-agent-admin-dev-only-live-model-overlay.md) (the prose-chat arm cl.5 wires) · [ADR-0091](./0091-a2ui-gen-ui-mini-skill-registry.md) (fence re-affirmed, §Non-goals: mini-skills are prompt fragments with NO tool dispatch — same word, unrelated mechanism) · **Resolves** GH #402 |

## Context

GH #49 shipped the provider-native tool-use loop end to end: `AgentProvider.stream` carries an
optional `tools`/`executeTool` pair, the Anthropic adapter runs a bounded internal tool loop
(`MAX_TOOL_ROUNDS`=4 × `MAX_CALLS_PER_ROUND`=4), and three keyless integrations execute in the
proxy's node process. That loop is done and untouched here — what feeds it is not. Four facts make
the feeding layer the defect surface now.

1. **One bare string triples as three different facts.** `Integration.id` is simultaneously the
   registry key, the wire `tool.name`, and the admin entry LABEL — its own doc comment says so
   ("the whole enablement chain keys on this one string", `integrations.ts:26-29`), and
   `agent-admin-libraries.ts:272` hand-matches the same strings a third time, pinned only by a
   parity test. A human-facing label change, a wire rename, and a registry re-key are three
   different operations that today are one edit with three blast radii.

2. **The declared `input_schema` is advisory.** The registry declares JSON Schema per tool, but
   nothing enforces it at dispatch: each `execute` hand-rolls its own checks (`weather` trims a
   string, `currency` regexes ISO codes), so every new integration re-invents validation and a gap
   means a malformed model-authored input reaches integration code raw.

3. **There is no auth model at all.** v1 is deliberately keyless; the named direction (hotel/PMS,
   `integrations.ts:8-9`, SPEC v0.6's own changelog) requires keys, and ADR-0152 means whatever
   resolves them must work in the dev proxy (`loadEnv`) AND the production Worker (env binding)
   under the ADR-0073 cl.5 trust boundary.

4. **The enablement wire is second-class and asymmetric.** `agent-config-schema.ts` describes
   mode/model/k/maxRounds/miniSkillCap but not `integrations`; and the prose-chat arm never
   forwards the list at all (`admin-live-runner.ts:55`, the `/chat` POST body, vs the surface
   arm's `integrations: req.integrations` at `:110`) — an
   enabled tool is silently inert unless an A2UI/GenUI surface is also on. That is GH #402, a
   user-facing toggle that does nothing, with no error and no disclosure.

## Decision

Six clauses. Everything lands in `tools/agent/` (the ADR-0137 shell law); the portable
`src/agent/` core, `AgentProvider.stream`'s optional-additive `tools?`/`executeTool?` seam, and
SPEC-R5's validate-then-stream + tool-round buffering are UNCHANGED.

1. **A manifest registry replaces the hardcoded array.** `IntegrationManifest`
   `{id, version, label, description, tool: ToolDef, auth, envKey?, execute}` +
   `registerIntegration(manifest)` / `listIntegrations()`; the three v1 integrations become
   self-registering manifest modules. Registration fail-fasts at boot (both hosts already
   fail-fast on malformed `providers.json` — same posture) on a duplicate `id` OR a duplicate
   wire `tool.name`. `version` is a per-manifest semver string — an admin-displayable,
   registry-owned fact for future change disclosure; it does not cross to the model.

2. **id ≠ tool.name ≠ label — three facts, three fields.** `id` is the stable registry key and
   THE enablement wire vocabulary (the browser forwards ids; `resolveIntegrations` intersects on
   ids exactly as today, malformed ⇒ empty, capped, fail-closed). `tool.name` is the wire name
   the model sees (may equal `id`; nothing requires it). `label` is human display text, free to
   change without touching either. The admin pack shows `label` and forwards `id`; the existing
   parity test widens to pin the `{id, label, description}` trios against the registry.

3. **Tool input is validated against the declared `input_schema` at dispatch.** A shared,
   hand-rolled minimal subset checker (`validateToolInput`: `type:'object'`, `required`,
   primitive property types — deliberately NOT a full JSON-Schema engine, and no dependency: the
   Worker bundle stays hand-rolled per SPEC-N1's spirit) runs BEFORE `execute`. A failure never
   reaches integration code; it throws a structured message naming the tool + failing fields,
   which the adapter's EXISTING contract already converts to an `is_error` tool_result the model
   can react to. Per-integration hand-rolled guards become defense-in-depth, not the only line.
   Unknown extra properties stay permitted (JSON Schema's own default; tightening is a later,
   observable decision).

4. **Auth is a manifest fact; keys resolve server-side in both hosts.**
   `auth: 'none' | 'serverKey'`; iff `'serverKey'`, `envKey` names the env var (a NAME, never a
   value — the `providers.json` discipline). The host resolves the value at dispatch (dev:
   the `loadEnv`-merged env; production: the Worker env binding, whose `envVars()` projection
   widens to include registry `envKey`s) and hands it to `execute` via a new second parameter,
   `ExecuteContext {signal?, apiKey?}`. A `serverKey` manifest whose env var is unset is
   EXCLUDED at resolve time — the model is never offered a tool that cannot run. No key value
   ever crosses to the browser, appears in a tool_result, or lands in a log line.

5. **GH #402 resolves to branch (a): tools reach BOTH live arms.** The `/chat` route's body gains
   optional `integrations: string[]`; both hosts build the SAME shared tool dispatch for `/chat`
   that the produce route uses; `AdminTurnRequest` + the admin projection + `admin-live-runner.ts`
   forward the same enablement read the surface arm already does. Rationale over branch (b)
   (surface-only + disclosure): the seam already exists — the chat arm calls `provider.stream`
   directly and the adapter's tool loop yields text only, exactly what `/chat` buffers into
   `{text}`, so (a) is additive wiring with zero new mechanism; tool results are text, so prose
   chat is the natural consumer, leaving (b) defending a modality asymmetry with no principled
   basis; (b) also costs MORE (disclosure/disable machinery in the admin UI) to deliver less; and
   cost stays bounded — the same adapter round caps and the Worker's same-origin + rate-limit
   gates (ADR-0152) cover the chat route already. An absent `integrations` field keeps the
   request byte-identical to today (the `effort` additive precedent).

6. **The enablement knob becomes first-class config.** `liveAgentConfigSchema` gains an
   `integrations` section whose fields are PROJECTED from the registry — one `boolean` field per
   manifest (`integration:<id>`, label/description from the manifest), the ADR-0135 Fork-1
   "never a hardcoded second list" law applied again — plus a fail-closed resolver returning the
   enabled `id[]`. No `SettingsFieldType` widening: the existing `boolean` vocabulary already
   expresses per-entry enablement, and the admin UI's real shape (master toggle + per-entry
   toggles) confirms it.

## Non-goals (recorded, not silent)

- **MCP client integration** — deferred to its own future ADR; it changes the shell's dependency
  posture and is not prejudged here.
- **Provider mapping layer** (`ToolDef` → OpenAI `parameters` etc.) — speculative until a second
  provider is implemented; `openai.ts`/`gemini.ts` are throw-stubs today.
- **Mini-skills unification** — ADR-0091 ruled mini-skills are prompt fragments with NO tool
  dispatch; same word, unrelated mechanism. Not re-litigated.
- **The real hotel/PMS integration** — clause 4 builds the keyed GROUNDWORK (mechanism + tests
  with a fake keyed manifest); the first real keyed integration is its own later work item under
  GH #49's named direction.

## Consequences

- The enablement chain stops keying three facts on one string; renames/re-labels become local.
- Every future integration inherits schema-validated dispatch for free instead of re-inventing
  input guards; a malformed model call degrades the answer (is_error), never the turn — the
  GH #49 contract, now enforced at one seam.
- Keyed integrations become possible in both hosts with zero trust-boundary change; an
  unprovisioned key degrades to "tool not offered", the no-key/backbone-only posture extended.
- The #402 toggle works everywhere or reports why not — the silent no-op path is gone; the chat
  route's outbound surface grows accordingly, bounded by the existing adapter caps + ADR-0152
  mitigations.
- Two host files stop carrying duplicated `toolOpts` blocks (the GH #108 anti-fork lesson applied
  before the fork drifts).
- Cost: the `execute` signature migration (`(input, signal?)` → `(input, ctx)`) touches all three
  v1 integrations at once — a one-slice, in-place migration with the compiler as the sweep.

## Alternatives considered

- **Surface-only ratification + admin disclosure (#402 branch (b))** — rejected in cl.5: more
  code, a modality asymmetry with no mechanical basis, and it ratifies a limitation the seam does
  not have.
- **Keep the label-keyed status quo + patch the chat arm only** — rejected: leaves facts 1-3 in
  place; the next integration (keyed, human-labeled) forces this design anyway with more callers
  to migrate.
- **A full JSON-Schema validator dependency** — rejected: the Worker/proxy path stays hand-rolled
  and dependency-free (SPEC-N1's posture); the declared schemas use only the object/required/
  primitive subset the minimal checker covers, and the checker fail-fasts at registration if a
  manifest declares beyond it.
- **A `multi-select` SettingsFieldType** — rejected: widens a shared vocabulary (types +
  generate/validate + app controls) for what projected `boolean` fields already express.
- **Secret resolution via a second registry file (an integrations.json)** — rejected: the
  manifest IS the registry row; a parallel config file re-creates the drift class GH #115 fixed.
