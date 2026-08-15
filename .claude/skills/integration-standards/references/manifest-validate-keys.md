# Manifest, validation, and key law (laws 1–3)

Source of record: ADR `.claude/docs/adr/0168-integration-manifest-registry-validated-dispatch-server-keys.md`
(accepted 2026-08-04) and SPEC `.claude/docs/spec/a2ui-live-agent.spec.md` v0.13 §3.6
(SPEC-R16–R18). This file states the laws; the cited lines are the authority — re-derive there,
never from a peer's quote. ADR line numbers are frozen records (ratified, unrevised); SPEC line
numbers drift as the spec grows across versions and need the SAME symbol-first discipline as code
cites (laws verified 2026-08-08 against v0.13) — on drift, Grep the requirement id or symbol name,
then repair the line number here in the same change.

## 1 · The manifest law — one integration, one manifest, three separate facts

Every integration is an `IntegrationManifest` (`registry.ts:34`) registered via
`registerIntegration()` (`registry.ts:65`), never an entry in a hardcoded array. The registry
`id` (enablement wire vocabulary), the wire `tool.name` (what the model sees), and the admin
`label` (human display text) are THREE independent facts — no string does double duty.
Registration boot-fail-fasts on a duplicate `id` OR duplicate wire `tool.name`.
*(ADR-0168 cl.1 :52-58, cl.2 :60-65 · SPEC-R16 §3.6 :1024-1038)*

**Bad (the retired pre-0168 failure):** one `Integration.id` string triples as registry key,
wire name, and admin label — a label change is a wire rename is a registry re-key, three blast
radii in one edit (ADR-0168 Context §1 :22-27).
**Good (illustrative, not the shipped manifest):**
`{id: 'flight-prices', tool: {name: 'search_flights', …}, label: 'Flight prices'}` — each fact
changes without touching the others. `tool.name` MAY equal `id` (the shipped v1 manifests do);
nothing requires it, and nothing else may assume it.

## 2 · Validate before execute — the schema is not advisory

The manifest's declared `input_schema` gates every dispatch: the ONE shared minimal-subset
checker `validateToolInput` (`validate-input.ts:61`; `type:'object'` + `required` + primitive
property types, hand-rolled, no dependency) runs BEFORE the executor. Malformed model input
never reaches the executor and never throws the turn — it surfaces as a structured `is_error`
tool_result naming the tool + failing fields (the GH #49 degrade-the-answer contract). A
manifest declaring schema constructs beyond the subset fail-fasts at registration
(`assertSupportedSchema`, `validate-input.ts:97`). Per-executor guards are defense-in-depth
only, never the first line. *(ADR-0168 cl.3 :67-75 · SPEC-R17 §3.6 :1040-1055)*

## 3 · Server keys never cross to the browser

A manifest declares `auth: 'none' | 'serverKey'`; iff `'serverKey'` it carries `envKey` — an
env-var NAME, never a value (the `providers.json` discipline). The HOST resolves the value at
dispatch time in BOTH hosts — dev proxy via its `loadEnv`-merged env, production Worker via its
env binding — and hands it to `execute` through `ExecuteContext.apiKey` (`registry.ts:27`). An
unprovisioned keyed manifest is EXCLUDED by `resolveIntegrations` (`registry.ts:103`): the model
is never offered a tool that cannot run. No key value ever reaches the browser, a tool_result,
or a log line — ADR-0073 cl.5's trust boundary extended verbatim to integration keys, grep-gated
by SPEC-N2. *(ADR-0168 cl.4 :77-84 · SPEC-R18 §3.6 :1057-1072)*
