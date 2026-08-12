# ADR-0185 — the enablement wire's grammar widens (GH #783): alongside exact registry ids, a `string[]` member may be a service reference `mcp:<server-id>:*` — anchored to `SERVER_ID_PATTERN`, expanded server-side inside `resolveIntegrations`, persisted in agent stores — an append-only amendment to the "wire stays registry ids" fence that ADR-0168 cl.2, ADR-0177 cl.2/cl.4, and a2ui-live-agent.spec.md SPEC-R23/R28 each pin

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-12
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-12 |
> | **Proposed by** | planner (design seat — GH [#783](https://github.com/kimgranlund/agent-ui/issues/783)'s SPEC leg; authored ALONGSIDE [`mcp-agent-config.spec.md`](../spec/mcp-agent-config.spec.md) v0.2, the `app-surfaces-m2.spec.md`/ADR-0129 precedent: a genuine fork recorded at authoring time, never after the fact) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-12, via the [`ratify ADR-0185` utterance](https://github.com/kimgranlund/agent-ui/pull/786#issuecomment-5269956992) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build (the SPEC's own SPEC-N2 rows, booked here so the amendment wave has one home): [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) takes a version-bump amendment — SPEC-R23's and SPEC-R28's *"the enablement wire stays `integrations: string[]` of registry `id`s"* sentences gain this ADR's delta, append-only in that doc's own discipline · `.claude/skills/agent-ui-integration-standards/SKILL.md`'s Admin-surfacing law (*"the enablement wire itself stays `integrations: string[]` of ids, unchanged"*, `SKILL.md:132-133`) repoints to the widened grammar · `site/pages/agent-schema.ts` + the `agent-admin-library-kinds` skill gain their MCP-services rows. ADR-0168/0177 themselves are NOT edited — their clauses stand as written for their arcs; this record is the amendment. |
> | **Supersedes / Superseded by** | **Amends (append-only)** [ADR-0168](./0168-integration-manifest-registry-validated-dispatch-server-keys.md) cl.2 (*"`id` is the stable registry key and THE enablement wire vocabulary"*, `0168:60-62`) · [ADR-0177](./0177-mcp-client-registry-source-http-transport-additive-manifest-mapping.md) cl.2 (*"The browser's enablement wire is unchanged: `integrations: string[]` of registry `id`s"*, `0177:149-151`) and cl.4 (*"stays `integrations: string[]` of registry `id`s exactly as today"*, `0177:251-253`) · **Relates** [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) SPEC-R23 (`:1267`) / SPEC-R28 (`:1401`) — the two SPEC-side pins, amended on ratification per Repairs · **Resolves** the grammar fork [`mcp-agent-config.spec.md`](../spec/mcp-agent-config.spec.md) §9 records (GH #783's one ADR-worthy decision; every other choice there is additive under existing law). |

## Context

GH #783 asks for per-agent MCP **services**: an agent declares "this server's tools," not N pinned
tool rows. [`mcp-agent-config.spec.md`](../spec/mcp-agent-config.spec.md) (proposed, same day)
derives why a service must be a first-class wire reference rather than a UI convenience: per-tool
ids pinned in an agent's localStorage rot when a server's `tools/list` churns across proxy boots,
and the wire cap (`MAX_ENABLED`, `integrations/registry.ts`) cannot even express a 30-tool server
per-tool. Both pressures point at one grammar member: `mcp:<server-id>:*`, resolved against the
registry as it stands each turn.

That member collides with a fence pinned — deliberately, and in ACCEPTED records — four places
beyond the SPEC it now serves:

1. **ADR-0168 cl.2** — `id` is "THE enablement wire vocabulary" (`0168:60-62`).
2. **ADR-0177 cl.2** — "The browser's enablement wire is unchanged: `integrations: string[]` of
   registry `id`s" (`0177:149-151`).
3. **ADR-0177 cl.4** — the allowlist-fence clause: the wire "stays `integrations: string[]` of
   registry `id`s exactly as today" (`0177:251-253`).
4. **a2ui-live-agent.spec.md SPEC-R23** (`:1267`) and **SPEC-R28** (`:1401`) — the same sentence,
   stated as that arc's frozen-fence and GET-boundary requirements.

Each pin was that arc's honest fence, not an accident — which is exactly why widening it is a real
fork with moderate reversal cost (service refs persist in per-agent stores; retracting the grammar
strands stored rows), not an additive detail an LLD may quietly absorb. The alternatives were
genuine and are rejected in the SPEC's §3 table: per-tool expansion in the admin UI (fails churn +
the cap), a client-side expander (two sources of truth), a new entry kind with a parallel wire (the
two-answers defect). The default for GH #783 was NO ADR; this fork fired the exception by the
SPEC's own analysis.

## Decision

1. **The wire's SHAPE is unchanged; its VOCABULARY widens by exactly one pattern.**
   `integrations: string[]`, browser→host, as every pinned clause states — but a member is now
   honored as a **service reference** iff it is `mcp:` + one `SERVER_ID_PATTERN`-conforming
   segment (`servers-config.ts:42`, colon-free by grammar) + `:*`, anchored whole-string. Any
   other member — including `mcp:calc:add:*`, whose middle fails the server-id charset — remains
   an exact registry id, so a discovered tool whose manifest id happens to end in `:*` stays
   individually enablable. (The one manifest id that CAN match the ref grammar is one minted by a
   tool literally named `*`; discovery skips that tool with a stated reason —
   `mcp-agent-config.spec.md` SPEC-R2's single discovery-side change — making the anchor + the
   skip jointly complete.)
2. **Expansion is server-side, inside `resolveIntegrations`, fail-closed.** A service reference
   expands to every registered manifest whose `id` starts with `mcp:<server-id>:`, unioned with
   exact matches, deduped, then the shipped pipeline applies unchanged: the ADR-0168 cl.4
   provisioned-filter, silent unknown-drops, the caps. A host with no MCP manifests registered
   (the production Worker, ADR-0177's deferred rollout) resolves every ref to nothing — inert by
   construction, no Worker edit.
3. **Every OTHER sentence of the amended clauses stands byte-unchanged.** The allowlist fence
   (a ref can select among config-registered servers, never name one the roster doesn't list —
   ADR-0177 cl.4's actual point), the secrets boundary (no URL/`envKey`/key value/JSON-RPC fact
   browserward, cl.2), the `auth` vocabulary, `ExecuteContext`, and the id ≠ `tool.name` ≠ `label`
   three-fact law are untouched. This record amends one noun's grammar, not any clause's fence.
4. **Service references persist in per-agent stores** as ordinary `tool`-kind entry `id`s (the
   SPEC's SPEC-R1 home ruling) — the fact that makes this a moderate-reversal-cost decision and
   therefore this record's reason to exist.

## Consequences

- The SPEC's SPEC-R2/R3 become buildable as written; requirement-level detail (grammar vectors,
  expansion ACs, the degrade ladder) lives there, not here.
- On ratification, the Repairs column's amendment wave runs: a2ui-live-agent.spec.md's
  SPEC-R23/R28 sentences and the integration-standards skill's `:132-133` line are the records
  this decision falsifies, and they are repaired in the build's own change, never a follow-up.
- Retraction after rollout is expensive by design-honesty, not machinery: stored `mcp:<sid>:*`
  rows would go permanently wire-inert (they already degrade to exactly that on every host
  without MCP manifests, so the failure mode is silent-but-visible, never a thrown turn).
- If Kim rejects the grammar, the SPEC's fallback is its §3 rejected-shapes table re-opened —
  per-tool rows with admin-side maintenance cost — and this record flips to rejected rather than
  lingering.
