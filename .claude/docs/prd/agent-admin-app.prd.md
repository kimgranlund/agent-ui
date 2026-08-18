# PRD — Agent-Admin App (the agent-building product)

> Status: **proposed · v0.1 · 2026-08-18 · Owner: agent-ui** — authored at Kim's 2026-08-18 doc-tier
> ruling (*"IDR should not be made for features… PRD docs should be created for apps (like
> agent-admin-app) and that PRD would document the teams feature (along all the other agent
> features)"*). This PRD is the relocation target for the feature-scoped intent of
> [IDR-0001](../idr/0001-agents-ship-with-declared-teams.md) (teams),
> [IDR-0002](../idr/0002-documents-become-agent-knowledge.md) (knowledge), and
> [IDR-0003](../idr/0003-generative-ui-is-the-primary-medium.md) (conversation conduct) — each of
> which is proposed for supersession by the platform IDR set (Kim flips). Most of what this doc
> records is ALREADY SHIPPED and ratified piecewise across the cited ADRs — the PRD's job is the
> missing app-level WHY/WHAT roof over them, not a new build authorization; the teams + knowledge
> arcs carry the genuinely open targets.
> Altitude: this document owns **why + what-should-exist** for the agent-admin app as a PRODUCT.
> Behavior contracts and implementation stay in the cited ADR/SPEC/LLD records — nothing below
> restates a mechanism. Intent above it: [product-brief](../product-brief.md) (the central Intent
> record) + platform IDRs [0005](../idr/0005-agent-product-platform-identity.md)–[0008](../idr/0008-team-is-the-unit-of-product.md).
> **Sibling-vs-extension ruling:** a **new sibling PRD**, not an extension of
> [agent-app-surfaces](./agent-app-surfaces.prd.md) — that PRD owns reusable app **chrome**
> (shell/panes/archetypes in `@agent-ui/app`, developer-facing primitives); this one owns the
> agent-building **product** a user experiences (personas, builder, teams, knowledge, chat) — a
> different altitude and a different consumer, exactly the content-family sibling precedent. The
> admin app *composes* the surfaces PRD's chrome; it does not extend its charter.
> **Granularity note (Kim, 2026-08-18: "PRDs can exist at various levels of granularity"):** this
> is an APP-level PRD; each feature below lives as a section here and is promotable to its own
> child PRD (citing this one upward) when it outgrows the section — the ruled growth path, not
> pre-split. The GenUI modality already has that shape: [genui-surface](./genui-surface.prd.md) is
> effectively this app's first feature-level child PRD, cited not duplicated.

## 1. Problem

The platform's identity is the agent-product loop (IDR-0005): a user builds agents in the browser
and those agents converse through generative UI. `ui-agent-admin` IS that loop's product surface —
but its WHY/WHAT has never had one home. Its features are ratified piecewise across ~20 ADRs, four
research docs, and (briefly) four feature-scoped IDRs, so nobody — Kim, a seat, a new contributor —
can read what the agent-admin app is *supposed to be* in one place, and feature-level intent kept
escalating to the wrong tier (the 2026-08-18 tier ruling's trigger). This PRD is that home.

**Who has the problem.** (1) The doc corpus itself — feature intent parked at IDR altitude against
the tier rule. (2) Every intake/planning seat, which needs an app-level WHY/WHAT to judge new
agent-admin asks against. (3) The user of the product — indirectly — because scope decisions made
without an app-level record drift toward whatever the last ADR happened to say.

## 2. Goals

Stable IDs; features already shipped carry their realizing records as the acceptance trail;
open goals state checkable acceptance. **A goal states WHAT/WHY — the cited records own HOW.**

| ID | Priority | Outcome | State |
|---|---|---|---|
| **PRD-G1** | must | A user picks, inspects, and manages agents from a persona roster and authors new ones | shipped |
| **PRD-G2** | must | A user one-shots a working agent from a single builder conversation | shipped |
| **PRD-G3** | must | A user grants an agent capabilities (instructions, skills, workflows, resources, tools/integrations) declaratively | shipped |
| **PRD-G4** | must | A user declares a **team** — GM + roster — and one-shots it from the builder | building (the open arc) |
| **PRD-G5** | must | A user makes an agent knowledgeable from their own documents, browser-only | building (the open arc) |
| **PRD-G6** | must | Conversations with built agents are generative-UI experiences governed by conduct law | shipped, law still accreting |
| **PRD-G7** | should | A user controls the agent's output modality (Markdown · A2UI · GenUI) and app settings from first-class places | shipped |

## 3. Features (the WHAT, with the owning records)

### 3.1 Personas & roster (PRD-G1)

A curated persona catalog (~37 presets) plus user-authored and imported agents, in a three-pane
IA — [Chat | Author | Settings] as first-class places with place-based context routing
([ADR-0179](../adr/0179-agent-admin-three-pane-ia.md)). A persona's local A2UI patterns are
catalog-schema content composed at derive-time ([ADR-0172](../adr/0172-persona-catalog-composition-intake.md)).
Agent state persists through the shared storage-adapter seam
([ADR-0193](../adr/0193-shared-storage-adapter-seam.md)).

### 3.2 Builder interview (PRD-G2)

The Builder persona authors agents conversationally: live-draft fill via the model-authored
`personaPatch` meta-line arm ([ADR-0178](../adr/0178-agent-authoring-conversational-persona-hydration.md)),
clickable options ([ADR-0097](../adr/0097-a2ui-feed-embedded-asks.md)), mission nudge + plan
visibility ([ADR-0182](../adr/0182-builder-mission-nudge-and-plan-visibility.md)). The interview
is the product's authoring front door; its quality bar is a product requirement, not a demo nicety.

### 3.3 Capabilities (PRD-G3)

Capabilities are declared entries — instructions, skills, workflows, resources, tools — composed
into the live system prompt ([ADR-0132](../adr/0132-agent-admin-instructions-capabilities-architecture.md)),
with a single enablement wire and grammar
([ADR-0185](../adr/0185-enablement-wire-service-reference-grammar.md)), tool-description standards
+ panel visibility ([ADR-0189](../adr/0189-tool-description-standard-and-tools-panel-visibility.md)),
and global toggle semantics over the three-tier reach model
([ADR-0190](../adr/0190-capabilities-menu-toggle-semantics.md)). Product law: capability grammar
widens append-only on existing wires — never a parallel store or second wire.

### 3.4 Teams (PRD-G4 — relocated from IDR-0001; platform intent: [IDR-0008](../idr/0008-team-is-the-unit-of-product.md))

A **team is a declared record, not a runtime**: `AgentTeam` — GM + members with role,
routingDescription, and optional per-member instructions — persisted on the existing agent-admin
store ([ADR-0203](../adr/0203-agentteam-declaration-first-record.md) + its ratified 2026-08-18
amendment, GH #1277). What the feature must deliver, at product level:

- **Declaration-first** (IDR-0001 clause 1, relocated): v1 = record + GM prompt composition +
  builder output + Team pane; explicitly NO runtime orchestrator, group conversation, or network
  A2A serving ([req-agent-teams](../research/req-agent-teams.md) non-goals).
- **GM prompt composition**: the roster composes into the GM's system prompt through the existing
  pipeline (req R2) — routing quality without an engine.
- **One-shot builder**: a team-shaped ask yields N member seeds + the team record in one generate,
  via the `team` meta-line arm ([ADR-0204](../adr/0204-team-meta-line-arm.md)).
- **Team pane**: list/create/edit teams, designate the GM, pick members — including from the
  persona catalog, instantiate-on-pick with optional per-member instructions (GH #1277, shipped
  PR #1281); dangling member references flag, never silently drop (req R5).
- **Reuse, never parallel grammar** (IDR-0001 clause 2, relocated): team declaration rides the
  existing store/entry/prompt seams — the ADR-0185 precedent.
- **A2A-aligned by construction** (IDR-0001 clause 3, relocated): a declared team is A2A's
  "direct configuration" discovery mode; members derive to AgentCards pure-functionally at the
  ruled site-side home (ADR-0203), pinning v0.3.0 as shipped.

*Feature falsifiers (carried from IDR-0001):* if GM-prompt composition alone can't make declared
teams behave acceptably in live runs, or the one-shot interview proves un-craftable at quality,
the escalation target is the platform posture in IDR-0008 — not a quiet runtime build.

### 3.5 Knowledge (PRD-G5 — relocated from IDR-0002; platform intent: [IDR-0007](../idr/0007-user-knowledge-browser-trust-boundary.md))

A user attaches documents through the composer; text is extracted **entirely client-side** and
lands as a durable `resource` entry composing into the system prompt. Product requirements
(relocated from IDR-0002, detail in [req-doc-ingestion](../research/req-doc-ingestion.md) R1–R7):

- **The trust boundary is product law**: no file byte leaves the browser; extracted text egresses
  only as prompt text on the ruled dev-proxy seam ([ADR-0073](../adr/0073-a2ui-live-model-provider-seam.md)).
  No upload endpoint, ever, in the browser tier.
- **Knowledge = the existing entry system**: `resource` entries (ADR-0132), the ADR-0193
  persistence seam (IndexedDB tier for large texts; bytes never stored) — no parallel knowledge
  subsystem.
- **Context stuffing, not retrieval, at v1**: whole-text under honest hard budgets with visible
  truncation; retrieval/embeddings are a future intent turn, escalated when corpora outgrow the
  budget — not a quiet build choice.
- **Dependencies bend only by ruling**: docx hand-rolled; pdf.js is the ruled second
  runtime-dependency exception, lazy-loaded, confined to its seam
  ([ADR-0202](../adr/0202-pdfjs-second-runtime-dependency-exception.md)).

*Feature falsifiers (carried from IDR-0002):* stuffing degrading quality inside budgets escalates
retrieval to an intent decision; client-side extraction failing the file types users actually
bring re-examines the browser-only fence at IDR-0007 — never a workaround.

### 3.6 Conversation experience (PRD-G6 — relocated from IDR-0003; platform intent: [IDR-0006](../idr/0006-conversation-medium-generative-ui.md))

Chat with any built agent — including the admin's own test chat — is a generative-UI experience
under codified conduct law (relocated from IDR-0003):

- **Gen-UI-first asks** (GH #1182, shipped grammar law): surfaces for any input; prose asks the
  ruled exception.
- **Surface lifecycle honesty**: at most one surface live; flows reuse their surface
  scene-to-scene; superseded cards settle
  ([ADR-0196](../adr/0196-answered-state-law-questionnaire-settle-edit-amend.md)); flows end
  formally — confirm → courtesy close → flowEnd → done/start-over
  ([ADR-0198](../adr/0198-ask-flow-completion-flowend-meta-signal.md)); the model names its
  target surface truthfully ([ADR-0206](../adr/0206-target-meta-line-arm.md)). Violations are
  product bugs filed from live pixels.
- **Bookended conversations**: greet card (persona-conditional mini-skill) and courtesy close;
  the settled receipt stays as the durable record
  ([ADR-0201](../adr/0201-ui-description-list-key-value-receipt-primitive.md); Kim's 2026-08-17
  fork rulings).
- **Domain realism over demos**: playbooks model real arcs with humanized values; "feels like a
  demo" is a defect class.

The producer-side grammar, corpus, and catalog machinery realizing this law is
[a2ui-expert-system](./a2ui-expert-system.prd.md)'s charter — cited, never duplicated here.

### 3.7 Settings & Surface (PRD-G7)

Settings is a first-class place (ADR-0179). The Surface tab controls output modality —
Markdown (rendered rich-text, plain-text fallback) · A2UI (catalog picker) · GenUI (pattern-source
picker) — where GenUI's own WHY/WHAT is the feature-level child PRD
[genui-surface](./genui-surface.prd.md) (proposed, all forks ruled). App-level composition rides
`@agent-ui/app` chrome per [agent-app-surfaces](./agent-app-surfaces.prd.md); the admin surface
itself loads via the ruled lazy split ([ADR-0197](../adr/0197-app-barrel-agent-admin-lazy-split.md)).

## 4. Scope

**In:** the agent-admin app's product feature set (§3) and its app-level acceptance; the
relocation home for feature-scoped intent formerly at IDR altitude.
**Out:** app chrome primitives ([agent-app-surfaces](./agent-app-surfaces.prd.md)); producer
grammar/catalog/corpus machinery ([a2ui-expert-system](./a2ui-expert-system.prd.md)); the A2A
protocol layer ([a2a-section](./a2a-section.prd.md)); a runtime team orchestrator, network A2A
serving, retrieval/RAG, and any server-side ingestion (each an explicit intent-tier escalation,
per §3.4/§3.5); component-tier contracts (the component ADR/SPEC family).

## 5. Acceptance (the open arcs; shipped features hold their cited records' gates)

- **Teams (PRD-G4):** a user creates a team from catalog + roster agents (instantiate-on-pick,
  optional per-member instructions), designates the GM, reloads, and the roster renders; the GM's
  composed prompt names each member, role, and routing rule deterministically; a team-shaped
  builder ask produces ≥2 members + 1 GM + 1 team record in one generate; single-agent flows
  regress nowhere. (Realizing records: ADR-0203 + amendment, ADR-0204, req-agent-teams R1–R6.)
- **Knowledge (PRD-G5):** a user attaches md/txt/docx/pdf through the composer; extraction is
  provably client-side (no network egress of file bytes); the text lands as a `resource` entry,
  survives reload via the IndexedDB tier, composes into the live prompt under visible budgets
  with visible truncation. (Realizing records: ADR-0202, ADR-0193, ADR-0132, req-doc-ingestion
  R1–R7.)

## 6. Open items

1. Kim's supersession flips on IDR-0001…0004 and ratification of IDR-0005…0008 + this PRD.
2. Child-PRD promotions as features outgrow sections (§ growth path) — none proposed now.
