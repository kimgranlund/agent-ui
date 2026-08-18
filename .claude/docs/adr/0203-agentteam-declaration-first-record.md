# ADR-0203 — `AgentTeam` is a declared record (GM + roster of `{agentId, role, routingDescription}` members) on the existing agent-admin store, no runtime orchestrator in v1; the R3 A2A-card-mapper home fork is decided here as site-side, never inside `@agent-ui/app`

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each
> ADR's own header). · 2026-08-17
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-17 |
> | **Proposed by** | planner seat, from [`req-agent-teams.md`](../research/req-agent-teams.md) R1–R3
>   (Lane 1 of the 2026-08-17 exploration campaign) and [IDR-0001](../idr/0001-agents-ship-with-declared-teams.md)
>   (the ratified WHY this ADR realizes) |
> | **Ratified by** | — awaiting Kim's `ratify ADR-0203` utterance on the realizing GitHub issue,
>   executed by `scripts/adr_ratify.py` (ADR-0149 discipline) — agents never self-flip Status |
> | **Repairs** | on ratification+build (not authored here): a new `AgentTeam` typed export +
>   validator (home: alongside `AgentConfigSnapshot`/`agentConfigSchema()` in
>   `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts`, or a sibling module in
>   the same folder — build-time choice, not this ADR's) · `composeTeamPromptSection(team, agents)`
>   pure function + snapshot tests · `teamMemberToAgentCard` mapping, homed **site-side**
>   (clause 3 — NOT inside `@agent-ui/app`) · a Team pane in `ui-agent-admin` · the Builder
>   interview's team-shaped output path · `req-agent-teams.md`'s R1–R5 acceptance criteria (dated
>   Finding on ratification) |
> | **Supersedes / Superseded by** | Realizes [IDR-0001](../idr/0001-agents-ship-with-declared-teams.md)
>   (the ratified product intent: declaration-first teams, runtime deferred) · Relates
>   [ADR-0185](./0185-enablement-wire-service-reference-grammar.md) (the "reuse existing keys,
>   append-only grammar widenings, no parallel wires" precedent this ADR follows for the team
>   record) · Relates [ADR-0193](./0193-shared-storage-adapter-seam.md) (the persistence seam the
>   team record rides — no new storage tier) · Relates `@agent-ui/a2a`'s `A2aAgentCard`/
>   `A2aAgentSkill` types (`packages/agent-ui/a2a/src/protocol/types.ts`, protocolVersion pinned
>   "0.3.0") — the mapping target clause 3 fixes the home of, not the shape of · Relates
>   [`req-agent-teams.md`](../research/req-agent-teams.md) (the owning requirements doc; R1–R6) |

## Context

`req-agent-teams.md` (Lane 1, 2026-08-17) found no shipped product that lets a builder one-shot an
entire team — a GM (orchestrator) agent plus a roster of sub-agents — from a single interview
(F5); IDR-0001 already ratified this as product intent: **"the platform's unit of product grows
from one agent to a team, declaration-first."** The research lane surveyed five external precedents
(A2A AgentCard discovery, OpenAI Agents SDK handoffs, Claude Code subagents, CrewAI/AutoGen, Copilot
Studio's builder UX) and this repo's own store shape, converging on one grounded conclusion: **the
minimal viable team record is small, and every external precedent's routing mechanism is either a
runtime this repo explicitly does not want in v1 (AutoGen's GroupChat) or reduces, at declaration
time, to "roster + a routing rule per member"** (Claude Code's description-based dispatch; CrewAI's
role/goal/backstory; OpenAI's `handoffs` edge list).

**What the repo already has, grounded.** `AgentConfigSnapshot` (`agent-admin-schema.ts:719-729`) is
the per-agent turn-time shape: `name, model, temperature, toolsEnabled, systemPrompt, skills,
workflows, resources, tools` (the last four as label arrays). `composeSystemPrompt(sections)`
(`entries.ts:251`) composes an agent's enabled `Entry[]` (kind-tagged: `promptSection`, plus the
four capability kinds) into `## {label}` markdown blocks by `order`/`id` sort law. `AgentRosterEntry
{id, label}` (`agent-admin.md:317`) is the header's existing multi-agent-select shape — proof the
admin surface already carries a NOTION of "more than one agent," just with no team-level grouping
above it. `@agent-ui/a2a`'s `A2aAgentCard` (`packages/agent-ui/a2a/src/protocol/types.ts:105`) pins
`protocolVersion: '0.3.0'` with `name/description/url/version/capabilities/skills[]`
(`A2aAgentSkill {id, name, description, tags}`) — the wire shape a team's members would map to if
ever exposed via A2A discovery.

**The DAG constraint this decision must rule (R3's open placement fork, restated).** The current DAG
(`CLAUDE.md`'s Conventions) is `shared ← components ← a2ui ← {app, devtools}`, with `router`/`code`/
`data` as siblings off `components`; `@agent-ui/app` depends on `components` + `a2ui` + `shared`
(+ `code`, ADR-0139) — **`app` does NOT depend on `a2a`**, and nothing in the accepted layering rules
opens that edge for this arc. A `teamMemberToAgentCard` mapping function needs `A2aAgentCard`'s type
from `@agent-ui/a2a` on one side and `AgentConfigSnapshot`'s shape from `@agent-ui/app`'s
agent-admin module on the other — the research lane named this the one OPEN decision blocking R3's
build (`req-agent-teams.md` R3 acceptance: *"home is an OPEN DECISION the mobilization item must
resolve before build"*), with three named candidates: (a) a site-side mapper (simplest, the lane's
own recommendation), (b) structural typing inside `app` (duck-typed, no import), or (c) a ruled DAG
widening (new ADR territory, opening `app ← a2a`).

## Decision

**We will declare `AgentTeam` as a typed, validated, store-persisted record — GM + a roster of
`{agentId, role, routingDescription}` members — composed into the GM's system prompt via a pure
function on the existing `composeSystemPrompt` pipeline, with NO runtime dispatch engine in v1; the
Builder interview one-shots N member agents + one team record from a single conversation; and the
A2A-card-mapping fork (R3) is decided HERE, in this ADR, as a site-side mapper — never an `app ← a2a`
DAG edge.** Realized in five clauses, `req-agent-teams.md` R1–R5 supplying each clause's acceptance
criteria verbatim.

1. **The `AgentTeam` shape (R1).**
   ```ts
   interface AgentTeamMember {
     agentId: string
     role: string               // short job title (CrewAI grammar, F4)
     routingDescription: string // the when-to-use sentence (Anthropic subagents grammar, F3)
   }
   interface AgentTeam {
     id: string
     label: string
     tagline?: string
     gmAgentId: string
     members: readonly AgentTeamMember[]
   }
   ```
   Persisted on the SAME agent-admin store the persona/agent records already use (the
   ADR-0193 `StorageAdapter` seam) — no new storage tier, no new adapter. A validator rejects a
   team whose `gmAgentId` or any member `agentId` does not resolve against the live agent roster
   (validation-closed, per this ADR's title and `req-agent-teams.md` R1's acceptance); an
   already-persisted team whose member agent is later deleted degrades to a flagged dangling
   reference (R5), never a silent drop.
2. **Routing is declared, composed, and NEVER executed (R2, the IDR-0001 fence).** v1 encodes
   GM-dispatch semantics — the GM selects a member by `routingDescription` (the OpenAI-handoffs-as-
   explicit-edge idea, F2, minus the runtime) — as a pure `composeTeamPromptSection(team, agents):
   string` function riding the EXISTING `composeSystemPrompt` pipeline: given a team, it renders a
   roster block naming each member, its role, and its routing rule, deterministic and byte-stable
   for pinned input (snapshot-testable, exactly like `composeSystemPrompt` itself). No code in this
   ADR's scope reads a `routingDescription` at turn time to actually pick a member, dispatch a
   sub-call, or manage a shared/branched conversation thread — that is the fenced-off runtime
   orchestrator (IDR-0001 clause 1, `req-agent-teams.md`'s Non-goals, unchanged here).
3. **A2A-card mapping: a SITE-SIDE mapper, never inside `@agent-ui/app` (R3, the fork this ADR
   settles).** `teamMemberToAgentCard(snapshot): A2aAgentCard` — deriving `name`/`description` from
   the agent record and `skills[]`/`A2aAgentSkill.tags` from the enabled skill/workflow entry
   labels, pinning `protocolVersion: '0.3.0'` as shipped — lives in `site/lib/`, alongside this
   repo's other cross-package composition modules (the same locus class as
   `site/lib/ndjson-lines.ts`'s re-export role, or `flow-chrome.ts`'s two-page-consumer pattern),
   importing BOTH `@agent-ui/app`'s `AgentConfigSnapshot` type and `@agent-ui/a2a`'s `A2aAgentCard`
   type as an ordinary consumer above both packages. **Decision, not merely recommendation**: this
   settles the fork the research lane left open. Candidate (b) — structural/duck typing inside
   `app` with no import — is rejected: it would require re-declaring `A2aAgentCard`'s shape by hand
   inside `app`, drifting silently the moment the a2a package's type changes, with none of
   TypeScript's structural checking catching the drift at the point of divergence. Candidate (c) —
   widening the DAG so `app` may import `a2a` — is rejected: it is a real, permanent architectural
   cost (a new edge in `layering.test.ts`'s allowlist, forever) paid for a capability (A2A card
   export) that has no v1 consumer inside `app` itself — the mapping is consumed by the SITE
   (`ui-agent-admin`'s team pane rendering "this team, as A2A cards" for inspection/export), never
   by any runtime path `app` owns. The site-side mapper (candidate a) gets real type-checking
   against both packages' actual exports at zero DAG cost, because `site/` already sits above every
   package in the tree by construction (the same position `site/lib/flow-chrome.ts` and
   `site/pages/*` already occupy) — this is the smaller, honest change, exactly the lane's own
   recommendation, now ratified as the Decision rather than left as a fork.
4. **Builder one-shot: team-shaped interview output (R4).** The Builder interview (`site/pages/
   agent-admin-presets.ts:989+`, ADR-0097's clickable-options + live-draft-fill discipline) gains a
   team-shaped generation path: a team-flavored ask ("I want a support team") yields, in one
   generate, N member-agent seeds (persona-style, the existing seed shape) PLUS one `AgentTeam`
   record naming the GM, added to the store together. A single-agent ask is unaffected — this is an
   additive path, not a rewrite of the existing one-agent flow (regression test, R4's acceptance).
   The team-seed prompt grammar itself is real product-writing work (interview quality is the
   product, per the LLD §15 precedent this ADR cites rather than re-derives) and names its OWN ADR
   at build time — this ADR fixes the DATA MODEL and the DAG/mapper decision it must precede, not
   the interview's prompt craft.
5. **A read/write Team pane, record-level only (R5).** `ui-agent-admin` gains a surface: list teams,
   show each member with its role, designate/change the GM, remove a member. No execution controls
   — no "run this team" button, no live dispatch preview — exists in v1 (the same fence as clause
   2). A dangling member reference (an `agentId` whose agent record was deleted) renders flagged,
   never silently omitted.

## Non-goals

- **No runtime orchestrator** — no engine that executes GM dispatch, member selection, or handoffs
  at turn time; this is IDR-0001's own fence, restated as this ADR's scope boundary, not
  re-litigated here. A future "runtime GM dispatch spike" is explicitly a LATER, separately-gated
  arc (`req-agent-teams.md` mobilization item 7 — "Conditional, post-v1 gate," size:big, not v1).
- **No AutoGen-style group conversation** — needs exactly the runtime being fenced off.
- **No network A2A serving or discovery** — no well-known-endpoint hosting, no registry service;
  cards are derived locally for inspection/export only (clause 3), never served.
- **No protocol-version bump** — the mapper pins `protocolVersion: '0.3.0'` as the package already
  ships; the upstream A2A v1.0/`agent-card.json` drift is tracked as its own bookkeeping issue
  (`req-agent-teams.md` R6), explicitly NOT bundled into this arc.
- **No new enablement-wire or store grammar beyond the one `AgentTeam` record** — the ADR-0185
  precedent (reuse existing keys, one append-only widening, never a parallel wire) governs; this
  ADR introduces exactly one new record type and zero new storage mechanisms.
- **No cross-team nesting** — a team member is always an agent, never another team, in v1.
- **No `@agent-ui/app ← @agent-ui/a2a` DAG edge** — clause 3's whole point; this is a permanent
  fence, not a deferred one, unless a future arc names a real `app`-internal consumer that needs it.

## Consequences

- **The store gains exactly one new record kind**, validated closed against the live agent roster —
  the same validation posture `req-agent-teams.md` R1 demands and the same "no parallel wire" law
  ADR-0185 already established for this repo's enablement grammar.
- **`site/lib/` gains one more cross-package composition module** (the `teamMemberToAgentCard`
  mapper), following the precedent `flow-chrome.ts` and `ndjson-lines.ts` already set: site-side
  glue that legitimately needs types from two packages neither of which imports the other.
- **The Builder's team-shaped output is additive, not a fork of the existing single-agent flow** —
  the regression test named in clause 4 is the acceptance gate that keeps it that way.
- **A future runtime-orchestrator arc, if IDR-0001's falsifiers fire, revises the IDR before this
  ADR** — per the doc-map's escalation-rides-the-citations law (a repeatedly-failing realization
  routes back up to the owning intake decision, not sideways into a quiet scope-creep of this ADR).
- **Stale → re-verify at the build wave:** `req-agent-teams.md` R1–R5 Findings · the `layering.test.ts`
  matrix (confirm no new edge appeared) · `agent-admin.md`'s descriptor (a Team pane's own contract
  section, if it lands as a fleet DoD surface).

## Acceptance

- **Intake (this change):** this record passes the ADR gates (`site/lib/adr.test.ts` grammar,
  `docs-grammar.test.ts` link sweep) and is indexed in the README. **No code changes, no
  `package.json` edit, no new file under `packages/` or `site/`.**
- **Build wave (separately dispatched, gated on Kim's ratification):** the `AgentTeam` type +
  validator + store round-trip (clause 1) · `composeTeamPromptSection` + snapshot tests (clause 2)
  · the site-side `teamMemberToAgentCard` mapper + a2a-validator conformance test (clause 3) · the
  Builder's team-shaped interview fixture + regression test (clause 4) · the Team pane browser test
  incl. the dangling-reference flag (clause 5) all land with `npm run check && npm test` green, and
  the `layering.test.ts` suite confirms zero new DAG edges.

## Alternatives considered

- **A runtime GM-dispatch engine in v1** (execute routing/handoffs at turn time). Rejected: this is
  exactly IDR-0001's fenced-off scope; the research lane's own survey (F2–F4) found every runtime
  model (supervisor vs. GroupChat) a heavier, contested design choice with no consensus external
  shape to converge on — declaration-first defers that choice without blocking the differentiator
  (one-shot team creation) IDR-0001 actually wants proven first.
- **Structural/duck-typed A2A card mapping inside `@agent-ui/app`** (R3 candidate b). Rejected
  (clause 3): silently re-declares a type owned elsewhere, drifting the moment `@agent-ui/a2a`'s
  `A2aAgentCard` shape changes, with no compiler check catching it at the point of divergence.
- **Widen the DAG so `app` may import `a2a`** (R3 candidate c). Rejected (clause 3): a permanent
  trip-wire-allowlist cost for a capability with no `app`-internal consumer; the site-side mapper
  gets the same type safety at zero architectural cost.
- **A separate `AgentTeam` storage tier** (its own adapter, its own persistence path). Rejected: no
  finding in `req-agent-teams.md` motivates a new tier; the existing agent-admin store + ADR-0193
  seam already holds records of exactly this shape and size, and ADR-0185's "no parallel wires"
  precedent argues directly against inventing one.
- **CrewAI-style `process: sequential | hierarchical` field on the team record now.** Rejected as
  premature: with no runtime executing the routing (this ADR's own clause 2), a process-mode field
  would be dead data with nothing to interpret it — a future runtime-arc concern, not a v1 one.
- **Fold the member roster into `AgentConfigSnapshot` itself** (a `teamMembership` field on the
  agent record) instead of a standalone `AgentTeam` record. Rejected: a team is a first-class thing
  with its OWN identity (label, tagline, GM designation) independent of any one member — modeling it
  as a property scattered across N agent records loses the team's own identity and makes "list all
  teams" an expensive scan instead of a direct read; `req-agent-teams.md` R1 already specs
  `AgentTeam` as its own record for exactly this reason.
