---
id: W-routing-architecture-review
title: "Context routing architecture and model behavior design: review after live rounds 1 to 7, with an adversarial debate"
status: done
size: L4
created: 2026-10-16
---

## Goal
Kim 2026-10-16: improve the repo's context routing architecture and model behavior design, not only fix failures one ticket at a time, and adversarially review and debate every proposed change. Output: a short set of architecture proposals, each argued for and against, with Kim's decisions and then tickets.

## Evidence to read (do not restate it; cite it)
- Round reports with their why-and-fix tables: `.sdlc/evals/rounds/2026-10-15-r3-routing/report.md`, `2026-10-15-r4-fixes`, `2026-10-15-r5-fixes`, `2026-10-15-r6-matrix`, `2026-10-16-r7-fails` (`report.md` each); fog records in `.sdlc/evals/fog/`.
- Standing docs: `.claude/docs/spec/agent-closed-loop.spec.md`, `response-type-selection.spec.md`, `a2ui-catalog-architecture.spec.md`, `.claude/docs/references/agent-model.md`, the prompt stack `packages/agent-ui/a2ui/src/agent/prompts/` (grammar.md is byte-pinned), `packages/agent-ui/a2ui/src/agent/produce.ts`, the catalog checks under `packages/agent-ui/a2ui/src/catalog/`, `site/pages/agent-admin-presets.ts` and `agent-admin-libraries.ts`.
- The context-fog-of-war contract audit field run: `/private/tmp/claude-501/scratch/fog-contract-audit/field-report.md` (40 and 14 index-only rules; conflict candidates; the eight field cases).
- Kim's rulings in `.sdlc/notes/notes.md`.

## Questions the review answers
1. Where does guidance live today (shared grammar, persona text, library skills and their index lines, mini-skills, exemplars, catalog selection sidecars, semantic checks and repair text, tool definitions), and which of those layers actually reaches the model on a turn? Where is one rule taught in several places, and where is a rule only in a layer the model never sees?
2. The repeating pattern across rounds: fixes moved from teaching to checks plus repair rounds. Is that the right long-term design (checks as the contract, teaching as hints), and what does it cost per turn and per model?
3. Model behavior design: small models read shared lines literally; repairs work when framed as a check result; forced tool choice needs thinking off; output truncation at max_tokens. What principles should the producer adopt per model tier (effort, thinking, max_tokens, forced tools, repair budget)?
4. Routing: exemplar and mini-skill retrieval, index-only skills, domain exclusion. What should change structurally (for example promote rules out of index-only bodies, one source per rule with generated projections, a routing contract checked by the audit)?
5. What should the contract audit gate in CI, if anything, and at what precision?

## Process (adversarial)
1. Architect (proposer) writes `proposals.md` in the artifacts dir: at most 7 proposals, each with the problem (cited evidence), the change, what it replaces, cost, risk, how to verify it live, and its strongest counter-argument.
2. Adversary (a different model family) reviews `proposals.md` and writes `challenge.md`: for each proposal, the strongest case against, missed evidence, a cheaper alternative, and a verdict (adopt, adopt changed, reject).
3. Proposer answers in `rebuttal.md`, conceding or defending each point.
4. The conductor writes the debate summary for Kim; Kim decides; decisions become tickets.

## Constraints
Read-only on the repo. No em dashes. ADRs are frozen; grammar.md changes only with Kim's explicit ruling.

## Outcome
2026-10-16: debate complete (proposals by Opus architect L1, challenge by Fable, rebuttal by the architect). Kim's rulings in `.sdlc/notes/notes.md` (2026-10-16 routing architecture review). Tickets T-0308 to T-0314.
