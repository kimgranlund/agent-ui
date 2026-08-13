# ADR-0189 — Tool/MCP description standard: MCP's own `tools/list` JSON Schema plus the existing `IntegrationManifest` triple are the standard (no OpenAPI/Swagger); the admin wire's description-carrying is widened, not replaced (GH #847)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-13
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-13 |
> | **Proposed by** | dispatched build seat, GH [#847](https://github.com/kimgranlund/agent-ui/issues/847)'s intake round (owner-ruled deliverable: research → a proposed ADR — this changes the integration/enablement contract, never self-ratified) |
> | **Ratified by** | _pending — awaiting the owner's `ratify ADR-0189` utterance_ |
> | **Repairs** | on ratification+build: [`mcp-agent-config.spec.md`](../spec/mcp-agent-config.spec.md) SPEC-R4 (widen the `services` row shape — real per-tool description array, not the aggregate count alone) + SPEC-R5 (retire the "empty content" clause's rationale once per-tool description exists) · [`mcp-connector.lld.md`](../lld/mcp-connector.lld.md) (the wire-widening's exact shape) · `agent-ui-integration-standards` skill (an OpenAPI-rejection note + the widened trio shape) |
> | **Supersedes / Superseded by** | **Amends** (append-only, on ratification) [ADR-0177](./0177-mcp-client-registry-source-http-transport-additive-manifest-mapping.md) cl.2's admin-surfacing boundary, [ADR-0185](./0185-enablement-wire-service-reference-grammar.md)'s wire-grammar scope (adds a description-carrying widening beside the ref grammar; the ref grammar itself is untouched) · **Relates** [ADR-0168](./0168-integration-manifest-registry-validated-dispatch-server-keys.md) (the `IntegrationManifest` triple this ADR rules is the standing standard) · **Resolves** the research half of GH [#847](https://github.com/kimgranlund/agent-ui/issues/847); ships the narrow, already-available-data slice of its visibility half now (the Integrations-pack content fix), defers the wire-widening half to ratification+build |

## Context

GH #847 opened from an operator observation: the agent-admin Tools panel's per-entry content box
rendered **empty** for the Weather (Open-Meteo) integration, and asked two joined questions — (1)
is that empty box a rendering bug or a missing-description consequence, and (2) what schema
*should* describe an MCP server/tool vs. a plain HTTP endpoint wrapped as an integration — should
this repo adopt OpenAPI/Swagger, and how does that description reach the registry / enablement /
prompt-building path.

**The bug-vs-consequence split, verified against source (2026-08-13):**

1. **Weather's empty box (the reported symptom) is a plain rendering bug, now fixed in this same
   change (§Decision cl.4).** `site/pages/agent-admin-libraries.ts`'s hand-authored
   `INTEGRATION_TOOLS` trio already carries real, non-empty `content` for Weather/Wikipedia/
   Currency (e.g. Weather's: *"Use for any weather/forecast ask. Surface results as a compact
   facts Card or Stat row…"*). The DEV-only live overlay (`setLiveIntegrations`, wired from the dev
   proxy's `GET /integrations` the moment `vite dev`'s discovery boots) unconditionally replaced
   **the whole pack**, including Weather's own row, with `content: ''` — discarding the served
   wire's own `description` field (which for Weather is `'Current conditions + short forecast for
   a named place. Keyless.'`, non-empty) into the tooltip-only slot and leaving the editable box
   blank. This reproduces on any `vite dev` session (the live overlay activates whenever the proxy
   answers `GET /integrations`, which is unconditional under `apply: 'serve'`) — not a corner case.
2. **The deeper "what's the description standard" question is a genuine missing-plumbing
   consequence, not a missing-capture problem.** MCP tools already self-describe via a real JSON
   Schema (`tools/list`'s `description?`/`inputSchema`) and this repo already captures that shape
   completely — `mapMcpTool` (`tools/agent/integrations/mcp/map-tool.ts:64-97`) carries
   `tool.description = tool.description ?? label` and `tool.input_schema = tool.inputSchema`
   (passthrough, same reference) into an ordinary `IntegrationManifest`, gated through the SAME
   `assertSupportedSchema` validator every hand-authored manifest faces
   (`integrations/registry.ts:82-86`). Nothing is lost at *capture* time. What IS lost is at the
   **admin-display wire**: `projectIntegrationTrios`/`projectServiceRows`
   (`tools/agent/dev-proxy-plugin.ts:132-160`) — the `GET /integrations` projection SPEC-R28/
   SPEC-R4 froze to `{id, label, description}` — never carry `tool.description` or
   `input_schema` at all, and `projectServiceRows`'s `description` for an MCP **service** row is a
   SYNTHETIC aggregate (`` `${count} tools discovered at boot` ``, `dev-proxy-plugin.ts:156`), not
   any tool's real description. That synthetic string is itself a *deliberate*, SPEC-ruled choice
   (`mcp-agent-config.spec.md` SPEC-R4: *"description: <derived from the registry — at minimum the
   tool count>"*; SPEC-R5: pack entries carry *"empty content — the external-registry posture"*) —
   not an oversight, and not something this change silently reverses (§Decision cl.5).

This ADR's job, per the owner's own intake ruling, is to state which schema documents (a) an MCP
tool and (b) a non-MCP HTTP endpoint, and to rule whether that description-carrying should widen
— not to implement the widening itself (that lands on ratification, this repo's standing
convention for every prior ADR in this family: ADR-0177/ADR-0185 both booked their SPEC deltas
"on ratification+build," never mid-proposal).

## Decision

1. **What documents an MCP server/tool: MCP's own `tools/list` JSON Schema — already the
   standard, nothing new to invent.** Every MCP server self-describes each tool via
   `{name, description?, inputSchema}` at `tools/list` time (the wire fact `mcp/discover.ts` +
   `mcp/map-tool.ts` already consume in full). Layered on top, [ADR-0185](./0185-enablement-wire-service-reference-grammar.md)'s
   `mcp:<server-id>:<tool-name>` / `mcp:<server-id>:*` service-reference grammar is the
   per-agent-config addressing scheme over that discovery — a routing concern, not a description
   format. **No new schema is adopted or invented for MCP.** The gap this ADR rules on is
   entirely PLUMBING (cl.3 below), never capture.
2. **What documents a non-MCP HTTP endpoint/service wrapped as an integration: the existing
   `IntegrationManifest` triple (`description`, `tool.description`, `tool.input_schema`) — already
   the standard, and it stays.** `registry.ts`'s `IntegrationManifest` interface
   (`description: string`, `tool: ToolDef` carrying `tool.description` + `tool.input_schema`,
   validated at registration by `assertSupportedSchema`) is a hand-rolled subset of the SAME
   `{name, description, input_schema}` shape MCP tools carry — the two paths converge on one wire
   format by construction (`mapMcpTool` maps INTO an `IntegrationManifest`, never a parallel type).
   **OpenAPI/Swagger is explicitly REJECTED** as an ingest format or an internal standard for this
   repo's integration layer, for a stated reason, not a punt:
   - The three keyless hand-authored integrations that exist today (`weather.ts`, and its
     Wikipedia/Currency siblings) each wrap ONE endpoint with a handful of parameters — hand-authoring
     the existing triple is strictly cheaper than authoring, hosting, and keeping in sync a full
     OpenAPI document for each, then writing a lossy converter down to the validator's
     deliberately narrow `assertSupportedSchema` subset (which is NOT full JSON Schema, let alone
     an OpenAPI Operation object with parameters/requestBody/security schemes).
     OpenAPI's value proposition — bulk-importing or generating clients against a LARGE, externally
     maintained multi-endpoint API surface — has no target in this repo's integration layer today:
     every integration is small, first-party-authored, and already schema-complete at the point of
     authoring.
   - Adopting it now would mean carrying TWO schema dialects (the shipped minimal
     `ToolDef.input_schema` subset AND a full OpenAPI document) with a conversion step that can
     silently drop or mis-map fields the validator was never built to check — a second, wider
     attack/drift surface for a capability nothing currently needs.
   - **Not a permanent rejection.** If the integration surface later grows to importing
     third-party, OpenAPI-documented APIs *at scale* (many endpoints per service, externally
     authored specs to bulk-ingest), an OpenAPI-to-`IntegrationManifest` **converter** — emitting
     ordinary manifests through the existing `registerIntegration`/`assertSupportedSchema` gate,
     exactly the way `mapMcpTool` does for MCP — is the natural follow-up ADR. That is a new
     *ingest path* onto the same standard, never a replacement of it.
3. **The admin-display wire needs to widen — this is the ruled gap.** `projectIntegrationTrios`/
   `projectServiceRows` today discard `tool.description` and `input_schema` entirely, and
   `projectServiceRows`'s per-service `description` is a synthetic boot-count aggregate, never a
   real per-tool description. On ratification, `mcp-connector.lld.md`/`mcp-agent-config.spec.md`
   gain a widened `services` row shape carrying a **real per-tool description array** (e.g.
   `services[].tools: Array<{ id, label, description }>`, sourced from the SAME registered
   `IntegrationManifest.description` `mapMcpTool` already computes — zero new capture, a wire
   change only), so an MCP service's Tools-panel entry can show its member tools' real text
   instead of only "N tools discovered at boot." Carrying `input_schema` itself across the wire
   (for a JSON-schema render mode in the box) is left an explicitly open follow-up — useful, not
   required to close the description gap, and a strictly separable slice.
4. **Ship now, no contract negotiation needed: fix the Integrations-pack content-stomp bug.**
   `setLiveIntegrations` (`agent-admin-libraries.ts`) changes from unconditionally writing
   `content: ''` to writing `content: t.description` — the SAME `description` field the wire
   already serves and the pack already reads for its tooltip, now also seeding the editable box.
   This uses data ALREADY on the wire today (SPEC-R28's `{id, label, description}` trio, untouched)
   and touches no ruled SPEC clause: SPEC-R28 governs the trio's `id`/`label`/`description`
   parity, never the page's own `content` field, so nothing here amends an accepted or proposed
   requirement. This alone fixes the reported symptom (Weather's live-mode empty box) with zero
   wire change.
5. **The MCP-services pack's "empty content" (SPEC-R5) is INTENTIONALLY left as-is in this
   change, not silently reversed.** `setLiveServices`'s `content: ''` is not the cl.4 bug's
   sibling — it is a deliberately reasoned, textually-ruled SPEC-R5 clause ("the external-registry
   posture the catalog and live-integration packs already take") tied to a wire that, per cl.3
   above, does not yet carry a real per-tool description for a service row (only the synthetic
   aggregate). Populating that box with the aggregate string now would satisfy the letter of "not
   empty" but not the substance the owner's acceptance bar names ("empty-when-a-description-
   exists is the defect" — no *real* description exists yet at that grain); it would also mean this
   PR quietly overriding a proposed SPEC's explicit ruled text without ratification, which this
   repo's own convention (ADR-0177/ADR-0185 both booked their code "on ratification+build") treats
   as the ADR's job, not a drive-by patch's. On ratification, the MCP-services pack's `content`
   becomes the joined real per-tool descriptions from cl.3's widened wire (rendered as prose,
   §Alternatives) instead of staying empty.

## Consequences

- Zero secret/trust-boundary change: no endpoint URL, `envKey` name, key value, or JSON-RPC frame
  crosses the wire in either direction — cl.3's widening is admin-DISPLAY facts only (`description`
  strings), the same SPEC-R4 cl.2 boundary that already governs the trio today.
- `grep -ri mcp packages/agent-ui/app/src` stays empty — every change in this ADR's ruled slice
  (cl.4) and its booked follow-up (cl.3) lives in `site/` and `tools/agent/`; `@agent-ui/app`
  changes nothing.
- The Integrations pack (Weather/Wikipedia/Currency, plus any future keyless/keyed hand-authored
  or MCP-per-tool live entry) shows real, non-empty box content immediately — in both the static
  fallback (unchanged, already true) and the live-overlay path (cl.4, this PR).
- The MCP-services pack (server-grain rows) stays at today's synthetic aggregate content until
  ratification — a stated, bounded gap, not a silent one: this ADR names exactly what's missing
  and where it lands.
- `mcp-agent-config.spec.md` gains a booked v0.3 amendment (SPEC-R4/R5) on ratification — the
  SPEC's own header already documents this pattern (the ADR-0185 fork was "recorded, not
  self-ratified," in that SPEC's own v0.2 note); this ADR is the sibling fork for the
  description-carrying question SPEC-R4/R5 left open.

## Alternatives considered

- **Adopt OpenAPI/Swagger as the integration description format now** — rejected (cl.2): no
  target at the repo's current integration scale; would fork the schema dialect the validator
  already enforces; the value case (bulk-importing large third-party APIs) doesn't exist yet.
  Revisit as an ADDITIVE ingest converter if/when it does.
- **Populate the MCP-services box with the synthetic boot-count string now, alongside the
  Integrations fix** — rejected for this PR (cl.5): technically satisfies "not empty" but not the
  owner's "a description exists" bar, and reverses a proposed SPEC's explicit ruled clause without
  ratification. The wire-widening (cl.3) that would make the content genuinely worth showing is
  booked on ratification instead of shipped as a half-measure now.
- **Widen the wire to carry raw `input_schema` (JSON) in this same PR** — rejected: no admin
  consumer renders it yet (the box's `<ui-code-editor language="markdown">` is markdown-only,
  ADR-0139), so shipping the wire bytes without a render mode would be plumbing nobody reads;
  booked as an explicitly open follow-up (cl.3) rather than blocking this PR on a UI decision
  outside its scope.
- **A brand-new manifest schema (neither MCP's shape nor OpenAPI)** — rejected: `IntegrationManifest`
  already converges MCP-discovered and hand-authored tools onto one shape (cl.1/cl.2); inventing a
  third format would fork what is currently one.
