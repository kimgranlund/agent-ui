# Decomposition — the tool/integration ENABLEMENT arc (registry manifest · validated dispatch · server keys · both-arm wiring)

> Status: proposed · v0.1 · 2026-08-04 · Contract: [ADR-0168](../adr/0168-integration-manifest-registry-validated-dispatch-server-keys.md)
> (proposed) + the SPEC amendment sheet [`./tool-enablement.spec-amendment.md`](./tool-enablement.spec-amendment.md)
> (applied to [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) v0.8 → v0.9 only AFTER
> ratification — the table-widening precedent). Build plan: [`../lld/tool-enablement.lld.md`](../lld/tool-enablement.lld.md).
> Build starts only from the RATIFIED ADR text. One writer per file per slice; every slice ends
> `npm run check && npm test` green (exit codes, never grep).

## Plane 1 — outside-in (the whole, broken into parts)

The domain: the ENABLEMENT layer that feeds the already-shipped provider-native tool-use loop
(GH #49, SPEC v0.6 — `AgentProvider.stream`'s optional `tools`/`executeTool` pair and the Anthropic
adapter's internal bounded loop are DONE and untouched here).

1. **Registry + manifest** (`packages/agent-ui/a2ui/tools/agent/integrations/`) — the
   `IntegrationManifest` shape (`{id, version, label, description, tool, auth, envKey?, execute}`),
   a `registerIntegration()` seam replacing the hardcoded `INTEGRATIONS` array, boot-fail-fast on
   id/wire-name collisions. Stays node-side under the ADR-0137 shell law; the portable core keeps
   only `ToolDef`/`ExecuteTool`.
2. **Dispatch validation** — a hand-rolled minimal JSON-Schema-subset checker
   (`validateToolInput`) run BEFORE any `execute`; failure becomes a structured thrown error the
   adapter already converts to an `is_error` tool_result. The declared `input_schema` stops being
   advisory.
3. **Secret resolution** — `auth: 'none' | 'serverKey'` + `envKey` (a NAME, the providers.json
   discipline); the host (dev proxy via `loadEnv`, Worker via its env binding) resolves the value
   at dispatch and hands it to `execute` in an `ExecuteContext`; an unkeyed serverKey integration
   is never offered to the model. Browser never sees a key (ADR-0073 cl.5 / ADR-0152).
4. **Shared tool dispatch** (`tool-dispatch.ts`) — ONE builder both hosts import for BOTH routes
   (the chat-validation.ts / GH #108 anti-fork precedent), replacing the duplicated `toolOpts`
   blocks in `dev-proxy-plugin.ts` and `worker/index.ts`.
5. **Both-arm wiring (GH #402)** — the prose-chat arm (`/chat` route, `AdminTurnRequest`,
   `admin-live-runner.ts`) gains the same `integrations` forwarding the surface arm has; the
   silent-no-op toggle dies.
6. **Config first-classing** (`agent-config-schema.ts`) — the enablement list becomes described,
   validatable `SettingsSchema` fields: one projected `boolean` field per registry entry (the
   ADR-0135 Fork-1 projection precedent; no new field type), plus a fail-closed resolver.
7. **Admin label decoupling** (`site/pages/agent-admin-libraries.ts` + the app-side projection) —
   the entry shows the manifest's human `label`; the wire carries the registry `id`; the parity
   test pins the `{id, label, description}` trios.

## Plane 2 — inside-out (the actions each part must support)

| Action | Part |
|---|---|
| register an integration at module load; collide loudly at boot | 1 |
| enumerate `{id, label, description, auth}` for admin display/parity | 1, 7 |
| resolve a browser-sent enablement list (ids) → active manifests, fail-closed | 1, 3 |
| declare the active tools to the adapter (`ToolDef[]`) | 4 |
| validate a model-authored tool input against its declared schema before execute | 2, 4 |
| surface a malformed input as a structured `is_error` tool_result, never a thrown turn | 2, 4 |
| execute with the turn's abort signal + (iff keyed) the server-resolved key | 3, 4 |
| resolve `env[envKey]` in BOTH hosts (dev proxy + production Worker) | 3, 4 |
| exclude a keyed-but-unprovisioned integration from the offered tools | 1, 3 |
| forward enablement on the surface arm (already live) AND the prose-chat arm | 5 |
| describe/validate the enablement knob as schema fields + resolver | 6 |
| show a human label in admin while keying enablement on the stable id | 7 |

**Coverage check (both directions):** every Plane-2 action names at least one Plane-1 part; every
Plane-1 part carries at least one action (1: register/enumerate/resolve/exclude · 2: validate/
surface · 3: resolve-secret/exclude/execute-ctx · 4: declare/validate/execute/both-routes · 5:
forward-chat · 6: describe/validate-config · 7: label-vs-id). No orphan part, no unhomed action.
Out-of-scope actions (MCP client, provider ToolDef mapping, mini-skill dispatch, the real
hotel/PMS integration) are named non-goals in ADR-0168, not silent gaps.

## Slices (each executable from its enumerated inputs alone; ordering + accept criteria in the LLD §5)

- **S-DOCS** — apply the amendment sheet post-ratification (serial, first).
- **S1** — registry core + input validator (new files only; no consumer change).
- **S2** — migrate the three built-ins to manifests; hosts re-import; parity test moves to trios.
- **S3** — shared `tool-dispatch.ts`; both hosts' produce route adopts it (behavior-identical).
- **S4** — chat-arm enablement end-to-end (schema → admin projection → runner → both hosts' `/chat`);
  closes GH #402 on branch (a).
- **S5** — admin label decoupling (human label displayed, id on the wire).
- **S6** — config schema projection + resolver (`agent-config-schema.ts`).
- **S7** — keyed-auth groundwork (`ExecuteContext.apiKey`, worker `envVars` widening, fake keyed
  manifest in tests; NO real hotel/PMS integration ships here).

Dependencies: S1 → S2 → S3 → {S4, S5, S6 parallel-safe — disjoint files} → S7 (needs S3's dispatch
seam). Every edge above is a real file/type dependency, not a convention.
