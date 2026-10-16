---
id: T-0295
title: "Write the round 3 to 5 context-fog-of-war lessons into the standing specs, references and skills"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
branch: docs/fog-lessons-into-docs
worktree: ../agent-ui.worktrees/wave-fl
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The durable lessons from live rounds 3 to 5 and their context-fog-of-war decision analyses live in the standing docs future agents read, not only in round reports and tickets (Kim 2026-10-16: "have we upserted all relevant docs, specs, and skills based on gained knowledge from using context-fog-of-war?").

## Context
Audit 2026-10-16 (sources: `.sdlc/evals/rounds/2026-10-15-r{3-routing,4-fixes,5-fixes}/report.md`, `.sdlc/evals/fog/`, `.sdlc/notes/notes.md`, closed tickets T-0259 to T-0293). Already recorded, no change: round how-to (spec CL-R11, `scripts/e2e-admin/README.md`, `commands.md`), fog manifest v2 fields.

## Scope (one edit per row; cite the ticket or report that proved each)
1. `.claude/docs/references/agent-model.md` (Capabilities): an index-only skill or reference reaches the model as its one-line description only, so a rule the model must follow lives in that description or in always-loaded persona text (T-0285, T-0231; r4 fog). Retire the "known gap T-0231" wording there and in `.claude/docs/spec/agent-content.spec.md:241-247`.
2. `.claude/skills/a2ui-prompt-authoring/SKILL.md` Triage: Haiku follows shared-grammar lines literally ("let the USER take the final action", "flow-ending turns emit no UI"; r5 clusters A, C); Kim's ruling: fix in persona and repair text, never the byte-pinned grammar (T-0289, T-0291); persona text may not name catalog types (the modality lint in `site/pages/agent-admin-presets.test.ts`); the index-only description rule (pointer to item 1).
3. `.claude/docs/spec/response-type-selection.spec.md` repair-round section: a repair opens as a check result from the app, never as a system notice (Haiku called the old wording "a fabricated system notice"; T-0289, `produce.ts` repairOpening).
4. `.claude/docs/spec/a2ui-catalog-architecture.spec.md` §4 Concierge row: Kim's rulings with dates: a complete booking ask is a pre-filled BookingForm (T-0266); one ProductCard per priced, bookable service or add-on, never a Table, ServiceCard stays for a service or agent to open (T-0279, T-0292); facility hours are one compact info Card holding a DescriptionList (T-0285).
5. `.claude/docs/spec/agent-closed-loop.spec.md`: CL-R12 triage order (rule out lost context first: retrieved == framed and tool results submitted, then classify each cluster (a) exposure, (b) conflicting guidance, (c) model ignored clear guidance, (d) check, oracle or scenario defect); CL-R11 phase 2 item names the fog decision analysis and the `## Why it failed and how to fix it` table; CL-R3: a replay whose repaired round is AUTHORED proves the loop mechanics, not live compliance; §5 model notes for rounds 3 to 5 (Sonnet 9 of 10 in round 5; Opus only on the T-0189 type floor; Haiku's literal grammar reading).
6. `scripts/e2e-admin/README.md`: step 6 phase 2 adds the decision analysis and cause classes; step 1 notes that an oracle listing a generic type (Card) passes on any Card, so name the composite or its distinctive part (DescriptionList).

## Constraints
Docs only, plus the skill. `grammar.md` and ADRs are untouched. No em dashes. Cite, never restate whole reports.

## Done when
- Each of the six scope items is present at its named home (a grep per item, listed in the handoff's acceptance criteria).
- `doc_lint` exits 0 on every touched doc; `npm run check` exits 0; `site/lib/docs-grammar.test.ts` exits 0.
