# agent-ui — product brief (the WHY/WHAT layer)

> Status: **accepted** — ratified by Kim 2026-08-17 at the fleet-bootstrap Phase-3 hard gate (incl. the identity sentence; roadmap synthesis deferred until the first lane ships). Authored 2026-08-17 (Phase 2, product seat); originally drafted noting nothing here is
> ratified until Kim says so. Vocabulary follows the repo dialect (`proposed · accepted ·
> superseded`; owner-only flips — the ADR-0149 discipline applies to this doc and to the `idr/`
> tier it introduces). Companions: [`plan.md`](./plan.md) (architecture, closed) ·
> [`roadmap.md`](./roadmap.md) (living Now/Next/Later) · [`goals.md`](./goals.md) (dated ledger) ·
> [`idr/`](./idr/) (intent decision records, this brief's decision spine — same no-index rule as
> the ADR log). Method note: lifecycle-position and doc-type judgments below are **manually
> narrated** (the `docs` plugin's mechanized census was not available to this seat this turn).

## 1 · What this product is now

`agent-ui` began as a zero-dependency, signals-based web-component library and delivered that
north star completely (foundation G0–G9 + Control Suite, closed 2026-07-05 — `plan.md`,
`goals.md`). What it has since become — through the A2UI/A2A layers, the live producer toolkit,
`ui-agent-admin`, GenUI, and the 2026-08 milestone arcs — is a second, larger identity that no
intent doc yet states in one place:

**agent-ui is an agent-product platform: users build agents in the browser, and those agents
converse primarily through generative UI rendered from the fleet's own components.**

The component library is the foundation tier of that product, not the product itself. This brief
exists to make that identity explicit and to tie the 2026-08-17 exploration campaign's four lanes
into it.

## 2 · Product principles (Kim's revealed intent, 2026-08-17 session — cited, not inferred)

1. **Generative UI is the primary conversation medium.** Chat leans toward A2UI surfaces for ANY
   input; prose asks are the exception (ruled + shipped as grammar law, GH #1182). → IDR-0003.
2. **Surface lifecycle honesty.** At most one surface reads live; continuing flows reuse their
   surface scene-to-scene; superseded cards visibly settle; flows end formally (confirm →
   courtesy close → flowEnd → done/start-over). (GH #1101/#1104/#1164 arc, driven from live
   pixels.) → IDR-0003.
3. **Domain realism over demos.** Playbooks model real arcs (realistic booking, humanized
   receipts — GH #1171, GH #1174/ADR-0201); a flow that feels like a demo is a filed bug.
   → IDR-0003 clause 4.
4. **Component semantics honesty.** Outcomes are toasts, not badges; a glyph never impersonates
   an affordance; segment labels never wrap; library rows carry enough context to choose from.
   (Kim rulings, 2026-08-17.)
5. **Declaration over runtime.** New capability enters as declared records on existing seams
   (teams, knowledge entries) before any runtime engine is built. → IDR-0001, IDR-0002.
6. **The zero-dep law holds; exceptions are ruled, one at a time.** CodeMirror (ADR-0139) is the
   precedent; pdf.js is the one candidate second exception, ADR-gated. → IDR-0002, IDR-0004.
7. **Verification culture.** Pixel-truth over repo-truth; live self-tests through the real
   producer; gates judged by exit codes. (Operating law, not new — restated because the intent
   layer inherits it: an intent decision is proven on Kim's live surface, not by a merged PR.)

## 3 · Loop position (the product seat's reading, 2026-08-17)

Three nested loops; the reading of which is turning:

- **North-star loop — just completed a turn, closing with this brief.** The 2026-08-17
  exploration campaign (four research lanes → four Kim-approved requirements docs under
  [`research/`](./research/)) WAS a north-star-loop turn: it re-asked "what is this product"
  and answered with the four strategic lanes. This brief + the four IDRs are that turn's harvest.
  The loop parks again once Kim ratifies or corrects them.
- **Foundation loop — stable, not turning.** The component/kernel foundation is closed
  (`plan.md`) and tonight's evidence held: 12 same-day bug fixes shipped without architectural
  strain. No foundation-tier decision is open.
- **Releases loop — TURNING; this is the active loop.** The campaign minted its mobilization
  backlog (GH #1189–#1215) same-day, against Kim-approved requirements. Loop authority: **Kim**
  rules WHY/WHAT (ratifications, forks); the fleet marshal owns dispatch; this product seat owns
  the loop-position/spec-lock reading and the intent records.

### Spec-lock reading per lane (reading, not enforcement — dispatch gating is the marshal's)

| Lane | Requirements | Intent lock state |
|---|---|---|
| Agent Teams ([req](./research/req-agent-teams.md)) | approved | **Partially locked.** R1–R3/R5/R6 buildable on existing seams; R4 (builder one-shot team grammar) names its own ADR; R3's mapper home is an OPEN placement decision (site-side recommended). |
| A2UI patterns ([req](./research/req-a2ui-patterns.md)) | approved, all three forks RULED 2026-08-17 (greet = mini-skill; greet embeds via exempt ask-id class; settle SHARES the closing turn) | **Locked pending ONE bundled ADR-0198 amendment** (mid-flow carve-out + closing-turn settle carve-out, amended once not twice — the req doc's own mandate). Grammar work should not land before that amendment is ratified. |
| Widget library ([req](./research/req-a2ui-library.md)) | approved | **Locked for the now-tier.** `ui-image` is the gate-opener; seeds/composition items buildable; the later-tier chart rows each carry their own future ADR. |
| Doc ingestion ([req](./research/req-doc-ingestion.md)) | approved | **Locked EXCEPT pdf.** The pdf.js dependency ADR must be Kim-ratified before any `pdfjs-dist` bytes land (req R3); everything else (txt/md/docx, composer UX, budgets) is buildable. |

Two ADR ratifications are separately pending as of tonight (ADR-0201, the ADR-0112 amendment) —
they are release-loop state, tracked on their PRs, not re-tracked here.

## 4 · The four strategic lanes, tied to the north star

Each lane is a WHAT that serves the §1 identity; each carries one intent decision record:

| Lane | North-star tie | IDR |
|---|---|---|
| **Agent Teams** | The builder one-shots N agents + a team record — a stated differentiator (no shipped product does this). The platform's unit of product grows from agent to **team**, declaration-first. | [IDR-0001](./idr/0001-agents-ship-with-declared-teams.md) |
| **Document ingestion** | Users make agents knowledgeable from their own documents, entirely in the browser — the trust boundary (ADR-0073) is product law, not an implementation detail. | [IDR-0002](./idr/0002-documents-become-agent-knowledge.md) |
| **Refined A2UI patterns** | Conversation conduct (bookends, backable flows, settled receipts) is codified, testable law — produced agents behave well by grammar, not per-persona prompt luck. | [IDR-0003](./idr/0003-generative-ui-is-the-primary-medium.md) |
| **Expanded widget library** | The catalog speaks the generative-UI ecosystem's table-stakes vocabulary, composition-first; Image is the one new media primitive that unblocks the rest. | [IDR-0004](./idr/0004-widget-vocabulary-parity-composition-first.md) |

## 5 · Doc-map note (how this layer relates to the existing grammar)

This repo's realized intent stack maps the classical PRD/plan bundle as: **requirements docs +
PLAN/ROADMAP + GitHub Issues** (ADR-0145). The additions this brief proposes: this file as the
standing WHY/WHAT record, and `idr/` as the intent-decision tier ABOVE ADRs — an IDR states a
product intent; ADRs/SPECs/LLDs realize it; when build reality falsifies an ADR repeatedly, the
owning IDR is what gets revised (escalation rides the citations upward). IDRs follow the ADR
dialect exactly: blockquote status table, `proposed · accepted · superseded`, owner-only
ratification, accepted bodies append-only, **no index file** (Kim's 2026-08-13 ADR-log rule,
applied to this tier too). The four research docs stay in `research/` as the PRD-grade layer for
this arc; they are not duplicated into `prd/`.

## 6 · Ratification questions for Kim (this brief's open forks)

1. **Ratify the identity sentence** (§1 bold)? It governs future scope dials: work that grows
   the agent-product loop outranks work that only grows the component catalog.
2. **Accept the `idr/` tier at all** — or fold IDR content into ADRs/this brief and delete the
   folder? (The tier only earns its place if intent decisions keep arriving; four exist today.)
3. **Ratify IDR-0001…0004 individually** (each is one flip; see each file's own question line).
4. **Roadmap synthesis**: should `roadmap.md` §2/§3 gain the four-lane arc as its next synthesis
   pass (this brief cited as the arc's WHY), or does the roadmap wait until the first lane ships?
   This seat drafted nothing into `roadmap.md` — it is a living doc and the arc is unratified.
