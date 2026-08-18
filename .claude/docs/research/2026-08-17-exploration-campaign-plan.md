# Research campaign plan — 2026-08-17 (Kim's four exploration areas)

Goal: one requirements document per area (PRD-grade, `.claude/docs/research/req-*.md`), each
mobilizable straight into GitHub Issues. Every lane: web research + repo grounding + a findings
schema + a rubric its requirements doc is judged against.

## Lane 1 — Agent Teams (GM + declared sub-agent roster)

- **Questions**: How do shipped multi-agent products model a "team" (A2A ecosystem, OpenAI
  swarm/handoffs, Anthropic subagents, CrewAI/AutoGen roles)? What's the minimal declaration an
  agent needs (roster, routing rule, handoff protocol)? How does A2A's own AgentCard/discovery
  map onto a declared team? What does the builder interview need to one-shot N agents (a
  team-shaped output schema)?
- **Web search**: A2A multi-agent orchestration patterns · agent handoff protocols · agent card
  discovery · builder UX for multi-agent creation.
- **Repo grounding**: `@agent-ui/a2a` (AgentCard, channel), agent-admin agent-settings shape
  (the 61-agent store), ADR-0185 (MCP agent config), the builder-interview flow.
- **Findings schema**: `{pattern, source(url/date), teamDeclarationShape, routingMechanism,
  handoffWire, builderImplication, fitsA2A: yes/no/partial}`.
- **Rubric for the req doc**: declares the team data model · routing/handoff contract testable ·
  builder one-shot flow specified · A2A-alignment stated · non-goals fenced (no runtime
  orchestrator build in v1?) · every requirement traces to a finding.

## Lane 2 — Refined A2UI patterns (card anatomy · backable multi-step · bookending)

- **Questions**: (a) canonical card header/body/footer usage vs our CardHeader/Content/Footer;
  (b) multi-step wizard with BACK before commit — how do chat-embedded wizards handle
  local-state-until-submit (single data model, staged commit)? (c) greeting + conclusion cards —
  what do the best agent products open and close with?
- **Web search**: conversational UI wizard patterns · chat onboarding first-message UX ·
  generative UI card anatomy conventions · staged form submission patterns.
- **Repo grounding**: grammar.md's existing laws (ask archetypes, completion protocol, receipt,
  surface reuse), #1101/#1164 arcs, the playbook library, corpus exemplars.
- **Findings schema**: `{pattern, source, wireShape(A2UI sketch), grammarClauseDraft,
  conflictsWithExistingLaw: none|named}`.
- **Rubric**: each pattern has a worked A2UI payload sketch · composes with (never contradicts)
  the shipped grammar laws · back-step semantics defined against the ONE-data-model reality ·
  bookend patterns cover greet AND conclude · per-pattern acceptance criteria.

## Lane 3 — Expanded A2UI library (widget packs + analytics + full-bleed craft)

- **Questions**: For each candidate (slideshow, multi-step selection, confirmation views,
  card-with-list/columns/grid, itinerary, 5-day weather, restaurant/drinks menu, trend lists
  with up/down metrics, basic SVG charts): composition-of-existing-catalog vs new component?
  What does "done well" look like (full-bleed imagery, density, motion)? What's the SVG chart
  floor without a dependency (zero-dep law)?
- **Web search**: generative UI widget galleries (Vercel AI SDK generative UI, C1/Thesys,
  a2ui ecosystem) · dashboard tile design · sparkline/trend list conventions · menu/itinerary UI
  patterns · full-bleed card imagery practice.
- **Repo grounding**: full default catalog inventory (55 types), Image/Card/Row/Column/Grid
  capabilities, `ui-stat`/`ui-table`, corpus seeds, the tier map, size budgets.
- **Findings schema**: `{widget, priority(now/next/later), buildKind: composition|catalog-row|
  new-component, dependsOn, fullBleedNotes, chartTech: svg-inline|css|component, source}`.
- **Rubric**: every widget dispositioned with buildKind + evidence · zero-dep law respected ·
  full-bleed treatment specified where imagery leads · analytics set scoped to an honest v1 ·
  priorities justified by persona/playbook demand.

## Lane 4 — Document ingestion for the builder (upload → agent knowledge)

- **Questions**: What file types matter first (md/txt/pdf/docx)? Client-side extraction options
  under the zero-dep law (pdf = the hard case — lazy-loaded opt-in like CodeMirror/ADR-0139?);
  where does extracted text land (agent settings capabilities vs a knowledge shard in the
  StorageAdapter seam); chat-input upload UX conventions; size/token budgeting + truncation UX;
  the ADR-0073 trust boundary (nothing leaves the browser except via the dev proxy).
- **Web search**: browser-side document text extraction libraries · pdf.js weight/licensing ·
  chat attachment UX patterns · RAG-lite context stuffing for small agents.
- **Repo grounding**: composer (TKT-0056), agent-admin capabilities pane, StorageAdapter
  (ADR-0193), debug-bundle export (the file-shape precedent), ADR-0139 (the lazy dep exception).
- **Findings schema**: `{capability, fileTypes, extractionTech(dep? size? license?),
  storageHome, uxPattern, trustBoundaryNotes, source}`.
- **Rubric**: v1 file-type set justified · extraction tech chosen against the zero-dep law with
  an ADR-shaped exception plan if needed · storage home named on the existing seam · upload UX
  specified to the composer's anatomy · privacy/trust boundary explicit.

## Process

1. Four parallel research lanes (web + repo), each returning findings in its schema.
2. One synthesis pass per lane → `req-agent-teams.md` · `req-a2ui-patterns.md` ·
   `req-a2ui-library.md` · `req-doc-ingestion.md` (PRD-shaped: goal, findings digest,
   requirements w/ acceptance criteria, non-goals, mobilization list — the issues to mint).
3. docs:doc-checker review per requirements doc; correctives applied.
4. Hand Kim the four docs + the proposed issue list; minting happens on Kim's approval.
