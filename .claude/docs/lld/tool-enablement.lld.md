# LLD — the tool/integration ENABLEMENT arc (manifest registry · validated dispatch · server keys · both-arm wiring)

> Refines: [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) v0.8 + the v0.9
> amendment sheet [`../decompositions/tool-enablement.spec-amendment.md`](../decompositions/tool-enablement.spec-amendment.md)
> (SPEC-R16…R19) under [ADR-0168](../adr/0168-integration-manifest-registry-validated-dispatch-server-keys.md)
> (proposed — build starts only from the ratified text). Build plan:
> [`../decompositions/tool-enablement.decomp.md`](../decompositions/tool-enablement.decomp.md).
> · proposed · 2026-08-04 · planner (design seat) · Layer: LLD (implementation plan)
>
> **Composes on:** the SHIPPED GH #49 loop — `AgentProvider.stream`'s optional `tools`/`executeTool`
> pair (`src/agent/agent-transport.ts:144-152`, optional-additive, kept that way), the Anthropic
> adapter's internal bounded tool loop (`src/agent/providers/anthropic.ts:361-434`, caps at
> `:271/:276` — byte-untouched), `resolveIntegrations`' fail-closed posture (`tools/agent/
> integrations.ts:158-162`), the GH #108 shared-validation precedent (`chat-validation.ts`), the
> GH #115 env-projection lesson (`worker/index.ts:76-83`), and ADR-0135's schema projection
> (`agent-config-schema.ts`). The ADR-0137 shell law fences every new file into `tools/agent/`.
>
> **Freeze discipline.** §2 is the fan-out contract; one writer per file per slice. A builder who
> finds a seam unworkable STOPS and escalates — a coordinated LLD/ADR repair, never a local
> workaround.

## 1 · Intent

Replace the hardcoded `INTEGRATIONS` array with a manifest registry whose `id`/`tool.name`/`label`
are three separate facts; gate every tool dispatch on the declared `input_schema`; give manifests a
server-resolved `auth` model that works in both hosts; and wire enablement onto the prose-chat arm
so the admin toggle is never a silent no-op (GH #402, ADR-0168 cl.5 branch (a)). No package source
outside `tools/agent/` + the named admin/site/app seam files changes; the portable core and the
adapter change zero bytes.

## 2 · Components (build slices)

| ID | Component | File(s) | Traces |
|---|---|---|---|
| LLD-C1 | `IntegrationManifest` + `ExecuteContext` types, the registry core — `registerIntegration()` (boot-fail-fast on duplicate `id`/wire-name, and on a schema beyond C2's subset), `listIntegrations()`, `resolveIntegrations(ids, env)` (intersect on ids · non-array ⇒ `[]` · cap 16 · exclude unprovisioned `serverKey` manifests) | NEW `packages/agent-ui/a2ui/tools/agent/integrations/registry.ts` + `registry.test.ts` | SPEC-R16, R18 |
| LLD-C2 | `validateToolInput(schema, input)` — the minimal JSON-Schema-subset checker (`type:'object'`, `required`, property `type ∈ string·number·integer·boolean`); structured `{ok:false, errors}` naming each failing field; `assertSupportedSchema(schema)` for C1's registration fail-fast | NEW `packages/agent-ui/a2ui/tools/agent/integrations/validate-input.ts` + `validate-input.test.ts` | SPEC-R17 |
| LLD-C3 | the three v1 manifests, migrated in place — `execute(input, ctx)` signature (ctx replaces the bare `signal` param; compiler sweeps the change), `auth:'none'`, `version:'1.0.0'`, human `label`s; self-register on import; `getJson`/caps move to a shared `fetch-json.ts` helper; `integrations/index.ts` is the barrel both hosts import (old `integrations.ts` deleted — its header's TRUST NOTE moves to `registry.ts` verbatim) | NEW `integrations/{weather,wikipedia-search,currency,fetch-json,index}.ts` under `packages/agent-ui/a2ui/tools/agent/`; DELETE `integrations.ts`; import-site updates in `dev-proxy-plugin.ts` + `worker/index.ts` | SPEC-R16 |
| LLD-C4 | `buildToolDispatch(active, env, signal?)` — ONE builder for both hosts + both routes: maps manifests → `tools`, wraps `executeTool` as validate (C2) → resolve `apiKey` (iff `serverKey`) → `execute(input, ctx)`; a validation failure throws the structured message (the adapter's existing rejection→`is_error` path carries it); replaces the duplicated `toolOpts` blocks (`dev-proxy-plugin.ts:214-225`, `worker/index.ts:202-213`) | NEW `packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts` + `tool-dispatch.test.ts`; both host files adopt it | SPEC-R17, R18, R19 |
| LLD-C5 | worker env projection widening — `envVars(env)` derives from `providers.json` entries PLUS registered manifests' `envKey`s (the GH #115 one-source rule; a keyed integration needs no hand edit here) | `packages/agent-ui/a2ui/tools/agent/worker/index.ts` (`envVars`) | SPEC-R18 |
| LLD-C6 | chat-arm enablement (GH #402 (a)) — `AdminTurnRequest` gains `integrations?: string[]`; `#handleSubmit` projects the SAME fresh enablement read the surface arm has (`agent-admin.ts:1038-1042`'s idiom); `createAdminAgentTurn` forwards it in the `/chat` POST body; both hosts' `/chat` route resolves + `buildToolDispatch` + passes `tools`/`executeTool` into `provider.stream`; absent ⇒ byte-identical body (the `effort` spread precedent); `isChatBody` unchanged (the field is optional and fail-closed downstream) | `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts` + `agent-admin.ts` (`#handleSubmit`) · `site/lib/admin-live-runner.ts` · `dev-proxy-plugin.ts` `/chat` branch · `worker/index.ts` `handleChat` | SPEC-R19 |
| LLD-C7 | admin label decoupling — `INTEGRATION_TOOLS` entries display the manifest's human `label`; a page-local `{id, label, description}` trio table backs a label→id projection at the wire site; the parity test (`agent-admin-app.test.ts`) widens from bare labels to trios against the real registry (node-importable, as today) | `site/pages/agent-admin-libraries.ts` · the projection site in `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` · `site/pages/agent-admin-app.test.ts` | SPEC-R16 AC2 |
| LLD-C8 | config first-classing — `liveAgentConfigSchema(providers, integrations?)` gains an `integrations` section of PROJECTED `boolean` fields (`integration:<id>`, label/description from each manifest; default `false`) + `resolveIntegrationIds(read, schema): string[]` (fail-closed via the shared guards, ADR-0135 Piece A) | `packages/agent-ui/a2ui/tools/agent/agent-config-schema.ts` + its test | ADR-0168 cl.6 |
| LLD-C9 | keyed groundwork proof — a test-only fake `serverKey` manifest exercising C1's exclusion, C4's ctx key hand-off, and C5's projection end-to-end; NO real hotel/PMS integration (ADR-0168 non-goal) | `integrations/registry.test.ts` + `tool-dispatch.test.ts` (fixtures) | SPEC-R18 |

## 3 · Data & contracts

The full typed contracts live in the amendment sheet §D (one home, cited not duplicated). Facts
worth pinning here:

- **Wire vocabulary = manifest `id`s.** Today's browser forwards entry labels that HAPPEN to equal
  ids; after C7 the wire carries ids by construction. During the build (C3 lands before C7) the v1
  manifests keep `label` values distinct from ids ONLY at C7's slice — until then labels stay
  id-equal so the shipped intersection never breaks mid-sequence.
- **`ExecuteContext` replaces the bare `signal` param.** `(input, ctx: {signal?, apiKey?})` — all
  three v1 executors migrate in C3; `tsc` is the sweep (no dynamic call sites exist: the only
  caller is the host `toolOpts` block C4 replaces).
- **Validation subset is closed + registration-gated.** `assertSupportedSchema` rejects any
  manifest whose `input_schema` uses constructs beyond the subset (nested objects, `oneOf`,
  formats…) at boot — no silent half-validation (SPEC-R17).
- **Key life:** resolved per dispatch inside the host process, passed by ctx, never stored on the
  manifest, never serialized. The SPEC-N2 grep gate is the standing check.

## 4 · Risks & non-decisions

- **`/chat` cost surface grows** — the chat route can now drive outbound third-party fetches.
  Bounded by the SAME adapter caps (4 rounds × 4 calls) + per-fetch timeout/size caps + ADR-0152's
  same-origin + rate-limit gates, which already cover `/chat` (both POST routes gate together,
  `worker/index.ts:291-294`). No new mitigation needed; the registry TRUST NOTE is updated to say
  both routes.
- **Worker bundle imports** — `integrations/index.ts` is imported by the Worker; every new file
  must stay dependency-free and `process-shim`-compatible (the existing `integrations.ts` already
  ships there; the split changes module count, not posture).
- **Non-decision (recorded, no ADR needed):** `tool.name` values for v1 stay identical to `id`s —
  decoupling is a capability this arc buys, not a rename it performs. Nothing observable changes
  on the wire for the three shipped tools.
- **Non-decision:** per-integration admin disclosure of "keyed but unprovisioned" (a greyed entry,
  the SPEC-R12 `implemented:false` idiom) is deferred until the first real keyed integration —
  today's degrade (not offered) is honest and invisible-by-design.

## 5 · Build sequence (one-context steps; gates FOREGROUND, judged by exit codes)

1. **S-DOCS** (post-ratification, serial): apply the amendment sheet §A–§E verbatim; ADR README
   row already present; docs gates green. No Status cell touched by any agent seat.
2. **S1** = LLD-C1 + C2 (new files + tests only; no consumer changes) → `check && test` green.
3. **S2** = LLD-C3 (manifest migration + barrel + host import-path updates; behavior-identical —
   the existing chat-route/produce tests are the regression net) → green.
4. **S3** = LLD-C4 (shared dispatch; both hosts' produce route adopts it; delete the duplicated
   blocks) → green.
5. **S4** = LLD-C6 (+ the `/chat` arms of C4) — closes GH #402 with a dated Findings comment
   naming branch (a) + the ADR. Parallel-safe with S6 ONLY — not S5: LLD-C6 and LLD-C7 both
   write the app-side `agent-admin.ts` (the one-writer freeze).
6. **S5** = LLD-C7 (labels/trios/parity) — SERIAL after S4, same-file writer. **S6** = LLD-C8
   (config schema; disjoint files, parallel-safe beside S4/S5).
7. **S7** = LLD-C5 + C9 (env projection widening + keyed groundwork fixtures) → full
   `npm run check && npm test` green; `test:browser` where admin page tests are touched (S4/S5).

Every slice: one writer per file, foreground gates, exit codes only. Reviewer of this doc set:
the doc-checker seat; ratifier of the ADR: Kim alone.
