---
name: integration-standards
description: >-
  THIS repo's tool/integration enablement laws (ADR-0168 / SPEC-R16–R19): adding an integration,
  a new tool for the agent, integration keys/auth (serverKey/envKey, why a keyed tool isn't
  offered), tool input validation (input_schema, malformed model input, is_error tool_result),
  the id ≠ tool.name ≠ label split, the shared buildToolDispatch on both live arms, and where
  registry code lives (tools/agent/, never src/agent/). Use for "add an integration", "new tool
  for the agent", "how do integration keys work", "validate tool input", "why isn't my tool
  offered". NOT for catalog entries (component-catalog); NOT for A2UI payloads (a2ui-payload-authoring).
  MCP servers ARE in scope (ADR-0177): adding one, its allowlist roster, serverKey/envKey, the
  namespaced mcp:server-id:tool id law; NOT Claude Code's own MCP config (update-config).
disable-model-invocation: false
user-invocable: false
---

# agent-ui integration enablement laws (ADR-0168 / ADR-0177)

Six ratified laws governing every tool/integration the live agent can call. Sources of record:
ADR `.claude/docs/adr/0168-integration-manifest-registry-validated-dispatch-server-keys.md`
(accepted 2026-08-04, laws 1–5) + ADR
`.claude/docs/adr/0177-mcp-client-registry-source-http-transport-additive-manifest-mapping.md`
(ratified 2026-08-06, law 6) and SPEC `.claude/docs/spec/a2ui-live-agent.spec.md` v0.13 §3.6
(laws 1–5, SPEC-R16–R19) / §3.7 (law 6, SPEC-R23–R28). This skill states the laws; the cited
lines are the authority — re-derive there, never from a peer's quote. The full law text (with its
ADR/SPEC line citations) lives in `references/` — one owner per law-group below, cited by
ADR/SPEC id and Grep-repaired on line drift, never restated here from memory.

## The six laws, at a glance

1. **One integration, one manifest, three separate facts** — registry `id`, wire `tool.name`, and
   admin `label` never do double duty.
2. **Validate before execute** — the declared `input_schema` gates every dispatch through the one
   shared checker, before the executor ever runs.
3. **Server keys never cross to the browser** — `serverKey`/`envKey` resolve host-side only; an
   unprovisioned keyed manifest is excluded, never offered to the model.
4. **ONE shared dispatch on both live arms** — `buildToolDispatch`, never a per-route/per-host
   fork.
5. **Where things live** — registry/manifests/validator/dispatch are site-internal
   (`tools/agent/`); the portable `src/agent/` core stays types-only/zero-dep.
6. **MCP servers are a manifest PRODUCER, not a new mechanism** — a sixth SOURCE for laws 1–5,
   never a parallel registry, validator, or dispatch path.

## Consult table

| File | Read when |
|---|---|
| `references/manifest-validate-keys.md` | Adding or changing an integration manifest; the id≠tool.name≠label split; input-schema validation rules; serverKey/envKey mechanics (laws 1–3, ADR-0168 cl.1–4 · SPEC-R16–R18) |
| `references/dispatch-placement.md` | Wiring a new call arm into `buildToolDispatch`; where registry/validator/dispatch code is allowed to live, `tools/agent/` vs `src/agent/` (laws 4–5, ADR-0168 cl.5 · SPEC-R19) |
| `references/mcp-roster-law.md` | Adding or allowlisting an MCP server; the `mcp:server-id:tool` namespace; discovery fail-soft rules; the tool-description standard; admin-surfacing trios (law 6, ADR-0177 cl.1–4 · SPEC-R23–R28) |

## Routing out

- New/changed catalog components the renderer paints → `component-catalog`.
- Authoring the A2UI message stream an agent emits → `a2ui-payload-authoring`.
- The session/turn model or validate-then-stream pipeline → `agent-protocols:a2ui-chat-agent-facts`.
- Adding an MCP server so the live agent gains its tools → BUILT: law 6, `references/mcp-roster-law.md`
  (ADR-0177 / SPEC-R23–R28 §3.7 / `.claude/docs/lld/mcp-connector.lld.md`). Distinguished, still routed OUT:
  agent-ui AS an MCP *server* — the opposite direction, unbuilt
  (`a2ui-streaming-pipeline.spec.md` SPEC-R6); MCP *Apps* delivery, a separate settled non-goal
  (`a2ui-ecosystem-alignment.spec.md` SPEC-R8); stdio transport and production-Worker MCP
  discovery, both ADR-0177 Non-goals (dev-proxy-only v1); Claude Code's OWN MCP server
  configuration, a different product surface (update-config — settings.json edits with no plugin
  object are its literal charter).
