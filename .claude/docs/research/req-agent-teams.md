---
doc-type: research
status: awaiting-approval
id: req-agent-teams
owner: Kim
date: 2026-08-17
---

# req-agent-teams.md — Agent Teams (GM + declared sub-agent roster) — requirements

> Lane 1 of the 2026-08-17 exploration campaign (`2026-08-17-exploration-campaign-plan.md`).
> Status: research synthesis — PRD-shaped, awaiting Kim's review before minting issues.
> Author: research lane 1 · Date: 2026-08-17.

## Goal

Let one admin declare a **team**: a GM (general-manager/orchestrator) agent plus a roster of
declared sub-agents, and let the Builder interview **one-shot** an entire team (N agents + the
team record) from a single conversation — declaration-first, on the existing agent-admin store,
aligned with the shapes `@agent-ui/a2a` already carries, without building a runtime orchestrator
in v1.

## Findings digest (lane schema: pattern · source(url/date) · teamDeclarationShape · routingMechanism · handoffWire · builderImplication · fitsA2A)

**F1 — A2A AgentCard discovery (primary source).**
- source: https://a2a-protocol.org/latest/topics/agent-discovery/ (fetched 2026-08-17; upstream is v1.0, Linux Foundation-governed 2026; repo pins v0.3.0).
- teamDeclarationShape: no "team" object in the spec — a team is *emergent*: a curated set of AgentCards (well-known URI `/.well-known/agent-card.json`, a curated registry queryable by skills/tags, or direct configuration). The spec explicitly covers *finding* agents, not *selecting among* them — selection is the client orchestrator's job.
- routingMechanism: out of spec (client-side). handoffWire: A2A tasks/messages between peers.
- builderImplication: a declared team maps cleanly onto "direct configuration" — a local, curated list of cards. fitsA2A: **yes** (a team = a curated card registry + one designated client/orchestrator).

**F2 — OpenAI Agents SDK handoffs (Swarm successor).**
- source: https://github.com/openai/swarm (archived → Agents SDK, released 2025-03); https://www.cipherprojects.com/blog/posts/openai-agents-sdk-vs-langgraph-2026/ (2026). Searched 2026-08-17.
- teamDeclarationShape: each Agent object declares `handoffs: [otherAgents]` — the team IS the handoff graph; four primitives: agents, tools, handoffs, guardrails.
- routingMechanism: handoff surfaced to the model **as a tool call**; the runner switches active agent — supervisor pattern, not a peer swarm. handoffWire: conversation context carried through the transition.
- builderImplication: the minimal per-member declaration is tiny — name + description + who it can hand to. fitsA2A: **partial** (in-process, but the handoff-as-explicit-edge idea ports).

**F3 — Anthropic Claude Code subagents.**
- source: https://code.claude.com/docs/en/sub-agents (checked 2026-08-17).
- teamDeclarationShape: one markdown file per agent in `.claude/agents/`; frontmatter `name` + `description` required (optional `tools`, `model`); body = system prompt. The roster is just the directory.
- routingMechanism: the orchestrator routes **by description** — the description doubles as the routing rule. handoffWire: dispatch prompt out, typed report back (no shared conversation).
- builderImplication: proves the minimal viable member record ≈ what `AgentConfigSnapshot` already holds (name, systemPrompt, model, tool/skill lists) **plus a routing description**. fitsA2A: **partial**.

**F4 — CrewAI crews vs AutoGen GroupChat.**
- source: https://www.zenml.io/blog/crewai-vs-autogen ; https://app.ailog.fr/en/blog/guides/agent-frameworks-comparison-2026 (searched 2026-08-17).
- teamDeclarationShape: CrewAI = YAML-declared agents (role/goal/backstory) + tasks + a crew with `process: sequential | hierarchical` — top-down, declaration-first; AutoGen = GroupChat where agents converse and a manager picks speakers — emergent, conversation-first.
- routingMechanism: CrewAI process field; AutoGen speaker selection. handoffWire: CrewAI task outputs; AutoGen shared thread.
- builderImplication: CrewAI's role/goal/backstory grammar is the proven *interview-friendly* member shape (maps to how people describe teams); AutoGen's model needs a runtime we don't want in v1. fitsA2A: **no** (framework-internal), but the declaration grammar ports.

**F5 — Builder UX for one-shotting agents (Copilot Studio / M365 Agent Builder).**
- source: https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agent-builder-build-agents ; https://learn.microsoft.com/en-us/microsoft-copilot-studio/template-fundamentals (searched 2026-08-17).
- pattern: natural-language builder — as the user talks, name/description/instructions update **live in the draft pane**; templates pre-configure whole agents; Copilot Studio's multi-agent orchestration routes to specialist agents. No shipped product found that one-shots N agents from one interview — that flow is open ground.
- builderImplication: our Builder persona (site/pages/agent-admin-presets.ts:989+, ADR-0097 clickable options, live-draft fill) already matches the state of the art for ONE agent; the team extension is a differentiator, not a catch-up. fitsA2A: n/a.

**F6 — Repo grounding.**
- `A2aAgentCard` (packages/agent-ui/a2a/src/protocol/types.ts:105) — protocolVersion pin "0.3.0", `name/description/url/version/capabilities/skills[]` with `A2aAgentSkill {id,name,description,tags}`; well-known handling exists (channel/wellknown.test.ts). Upstream moved to v1.0 + `agent-card.json` path — a drift fact, out of this arc's scope.
- Agent store: `agentConfigSchema()` / `modelRoster()` / `AgentConfigSnapshot` (app agent-admin-schema.ts, documented live in site/pages/agent-schema.ts) — name, model, temperature, toolsEnabled, systemPrompt (composed), skills/workflows/resources/tools entry labels. Persona roster: id/label/tagline/category/seed (site/pages/agent-admin-presets.ts — ~37 `id:` preset entries by count of AGENT_PRESETS; the Builder is deliberately EXCLUDED from personaRoster(); imported agents live only in the runtime store, so store counts differ). `AgentRosterEntry {id,label}` is the header's agent-select shape.
- ADR-0185: the enablement wire stays `integrations: string[]` with exactly one widened pattern (`mcp:<server-id>:*`) — precedent that team declaration must NOT invent parallel wires or new store grammars; reuse existing keys and append-only grammar widenings.

## Requirements

**R1 — Team data model (declaration-first).** A `AgentTeam` record: `{ id, label, tagline?, gmAgentId, members: [{ agentId, role, routingDescription }] }`, persisted alongside personas/agents in the existing agent-admin store (StorageAdapter seam; no new storage tier). `role` is a short job title (CrewAI grammar, F4); `routingDescription` is the when-to-use sentence (Anthropic pattern, F3).
- *Acceptance:* the shape is a typed export with a validator; a round-trip (create → persist → reload) test passes; member `agentId`s referencing missing agents fail validation closed; zero new store grammars beyond this record (ADR-0185 precedent).

**R2 — Routing/handoff contract (declared, testable, not executed).** The team record fixes routing semantics: GM-dispatch (supervisor, F2/F3) — the GM selects a member by `routingDescription`; handoff is an explicit, tool-shaped act (F2). v1 encodes this as a **composed GM system-prompt section** (via the existing `composeSystemPrompt` pipeline) listing the roster with roles + routing descriptions.
- *Acceptance:* a pure function `composeTeamPromptSection(team, agents)` with snapshot tests; given a 3-member team the output names each member, its role, and its routing rule; deterministic (byte-stable for pinned input).

**R3 — A2A alignment: card derivation.** A pure mapping `teamMemberToAgentCard(snapshot): A2aAgentCard` — name/description from the agent record, `skills[]` from enabled skill/workflow entry labels (`A2aAgentSkill.tags` from kind), pin `protocolVersion: '0.3.0'` as shipped. The declared team is then literally A2A's "direct configuration" discovery mode (F1).
- *Acceptance:* mapped cards pass the existing `@agent-ui/a2a` validators; unit test maps the sample `AGENT_CONFIG_SNAPSHOT_SAMPLE` and validates; no a2a package edits required (consumer-side mapping — layering test stays green; home is an OPEN DECISION the mobilization item must resolve before build: `app` may NOT import a2a under the current DAG (app = components+a2ui+shared only — CLAUDE.md), so the choices are (a) site-side mapper (simplest, recommended), (b) structural typing in app (no import), or (c) a ruled DAG widening (ADR territory)).

**R4 — Builder one-shot: team-shaped interview output.** Extend the Builder interview so a team ask ("I want a support team") yields, in one generate: N persona-style seeds + one `AgentTeam` record with the GM designated. Interview keeps the live-draft-fill discipline (F5) and ADR-0097 clickable options for roster confirmation.
- *Acceptance:* a scripted interview transcript fixture produces ≥2 member agents + 1 GM + 1 team record in the store; each member's `routingDescription` is non-empty; single-agent asks are unaffected (regression test on the existing Builder flow).

**R5 — Team pane in agent-admin.** A read/write surface: list teams, show members with roles, designate/change the GM, remove members (record-level only — no execution controls in v1).
- *Acceptance:* browser test: create a team from existing roster agents, reload, roster renders; deleting a member agent flags (not silently drops) the dangling reference.

**R6 — Protocol-drift note (bookkeeping only).** Record that upstream A2A is v1.0 / `agent-card.json` while the repo pins 0.3.0 / (existing wellknown path) — as its own issue, explicitly NOT bundled into the team arc.
- *Acceptance:* one issue minted with the two primary-source citations; no code change in this arc.

## Non-goals (v1 fence)

- **No runtime orchestrator.** No engine that executes GM dispatch, speaker selection, or handoffs at turn time — the evidence (F2–F4) shows the declaration layer is separable and every runtime model (supervisor vs GroupChat) is a heavier, contested choice. v1 = declaration + prompt composition + builder.
- **No AutoGen-style group conversation** (needs the runtime we're fencing off).
- **No network A2A serving/discovery** — no well-known endpoint hosting, no registry service; cards are derived locally (F1 "direct configuration" is the fit).
- **No protocol pin bump** to A2A v1.0 (R6 tracks it separately).
- **No new enablement-wire or store grammar** beyond the one `AgentTeam` record (ADR-0185 discipline).
- **No cross-team nesting** (a team member is an agent, never another team) in v1.

## Mobilization list (issues to mint, on Kim's approval)

1. `AgentTeam` record + validator + store persistence (R1) — **small**.
2. `composeTeamPromptSection` GM prompt composition + snapshot tests (R2) — **small**.
3. `teamMemberToAgentCard` mapping + a2a-validator conformance tests (R3) — **small**.
4. Builder interview team-shaped output: prompt craft + seed emission + fixtures (R4) — **big** (interview quality is the product, LLD §15 precedent; likely an ADR for the team-seed grammar).
5. Team pane in ui-agent-admin (R5) — **medium**.
6. A2A v0.3.0→v1.0 drift bookkeeping issue (R6) — **small**.
7. (Conditional, post-v1 gate) runtime GM dispatch spike — **big**, explicitly NOT v1; mint only as a `later` roadmap note.

## Rubric self-check (plan Lane-1 rubric)

- Declares the team data model — **pass** (R1, typed shape + storage home).
- Routing/handoff contract testable — **pass** (R2 pure function + snapshot tests; semantics fixed to GM-dispatch with cited precedent).
- Builder one-shot flow specified — **pass** (R4 with fixture-based acceptance; F5 grounds the UX).
- A2A-alignment stated — **pass** (R3 mapping + F1 "direct configuration" framing; pin drift fenced in R6).
- Non-goals fenced (no runtime orchestrator in v1) — **pass** (explicit, evidence-cited fence).
- Every requirement traces to a finding — **pass** (R1←F3/F4/F6; R2←F2/F3; R3←F1/F6; R4←F5; R5←F6; R6←F1) — with one honest caveat: R5's specific pane layout is repo-convention-driven (agent-admin precedent) rather than an external finding.
