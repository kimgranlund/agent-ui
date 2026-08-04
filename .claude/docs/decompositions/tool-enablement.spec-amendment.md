# Amendment sheet — `a2ui-live-agent.spec.md` v0.8 → v0.9 (the tool/integration ENABLEMENT arc)

> Status: proposed (a DRAFT sheet — applied to the SPEC only AFTER
> [ADR-0168](../adr/0168-integration-manifest-registry-validated-dispatch-server-keys.md) ratifies;
> the ADR-0163/table-widening precedent) · v0.1 · 2026-08-04 ·
> Target: [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) (accepted, v0.8).
> Apply verbatim in slice S-DOCS ([decomp](./tool-enablement.decomp.md)); the SPEC's own
> update-in-place changelog pattern (v0.1–v0.8) governs. SPEC-R5's validate-then-stream law and the
> v0.6 tool-round buffering behavior are UNTOUCHED by every clause below.

## §A — header changelog line (prepend to the version list)

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

## §B — Definitions §2 (two new entries, after "Provider registry")

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

## §C — new requirements (append as §3.6, after §3.5 — SPEC-R15 itself sits inside §3.2a, so "after R15" would be positionally ambiguous)

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

## §D — §5 typed contracts (append)

```ts
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

## §E — SPEC-N1 (one clause amended in place)

The named tools-scoped shell list gains the registry's new home: `tools/agent/integrations/`
(registry + manifests + `validate-input.ts` + `tool-dispatch.ts`) joins `dev-proxy-plugin.ts` ·
`tools/agent/worker/` · `chat-validation.ts` · `providers.json`/`providers-config.ts`/
`providers/*` · `agent-config-schema.ts` in the enumeration. The clause's law is unchanged —
"never enters the portable `src/` producer core" still holds; only the enumeration grows.

## §F — §7 Traceability (append four rows to the table)

| Requirement | PRD goal(s) / upstream |
|---|---|
| SPEC-R16 | PRD-G7 (transport interop — the manifest registry + id-keyed, fail-closed enablement resolution; ADR-0137/0168) |
| SPEC-R17 | PRD-G4/G6 (provable validity before dispatch + no silent drift — the declared `input_schema` enforced at ONE seam; ADR-0168 §3) |
| SPEC-R18 | Constraint C2 (the secret-free invariant — integration keys resolve server-side in both hosts, never in a build/browser/tool_result; ADR-0073 cl.5, ADR-0152, ADR-0168 §4) |
| SPEC-R19 | PRD-G7 (transport interop — enablement reaches every live arm via one shared dispatch; GH #402 branch (a); ADR-0136/0152/0168 §5) |
