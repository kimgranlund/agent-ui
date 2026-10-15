---
id: T-0237
title: "Upsert docs and skills with the closed-loop and live round 1 and 2 learnings"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every standing rule the closed-loop work (T-0174 onward) and live rounds 1 and 2 taught us lives in its owning doc or skill, so the next agent finds it without reading these sessions. Docs and skills only; no code.

## Learnings to land (each in its owning home; repair any record they make stale)
1. Steering: prose alone does not steer composite or move choice; a deterministic check in the repair loop does (CardTable only after BET_TABLE_MISSING; T-0200 prose changed nothing; round 2: Concierge 1/24, Lexicographer 0/28 composite turns). Rule: every "use composite X" or "update the surface" rule needs a check; prose is the hint. Homes: `.claude/skills/a2ui-prompt-authoring`, `.claude/docs/spec/a2ui-catalog-architecture.spec.md` (CA-R9), `.claude/docs/references/agent-model.md` where it speaks of steering.
2. Hidden state: game or flow state the user must trust (secret word, fleet, bankroll, hole cards) lives in the data model where a check reads it, never in model memory or prose (T-0230, T-0215, T-0218). Homes: the a2ui payload or prompt skill and the agent-content spec.
3. Context loading: skills, playbooks and resources reach the prompt as index lines only (ADR-0190); a preset's own hours or booking flow never load unless named (T-0231). Record as a known gap in the agent-content spec and agent-model reference.
4. Prompt cache and budget: nothing turn-variable in tool descriptions or the cached system prefix; open surfaces ride on the user turn (T-0206); the budget test measures real presets (T-0207, worst 130,097 of 142,000). Homes: a2ui-prompt-authoring skill, response-type-selection spec if stale.
5. Live rounds: how to run one (`scripts/e2e-admin/probe/scenarios/*`, `round.ts`, `run-capped.ts --cap`), prices from the claude-api skill model table (Haiku 5.5 $0.10/$0.50, Sonnet 5.5 $2/$10, Opus 5.5 $4/$20 per MTok; never from memory), cost seen (round 2: 42 runs about $17.86; 8 Haiku runs $0.23; Opus about $1.20 a run), phase 2 = report plus one ticket per root cause plus replays, and that a pinned replay flips when its fix lands (re-pin with a comment, as in #1995 and #1997). Homes: `scripts/e2e-admin/README.md`, `.claude/docs/spec/agent-closed-loop.spec.md`, the CLAUDE.md Commands line for chat:probe (one line for the capped runner).
6. Model behavior seen live: Haiku 5.5 skips render_surface on about a quarter of turns and writes text-shape output (T-0229, T-0214); Sonnet and Opus play the Croupier cleanly; Sonnet may open dealt (T-0232). Home: agent-model reference or the closed-loop spec's model notes.
7. Merge queue traps: a browser test's `__screenshots__` folder breaks selection.test (T-0228); a stale-base lane can collide with replays pinned on main, so re-pin after rebase. Home: `component-testing` skill Traps or `seat-map` Dispatch laws, whichever owns lane traps.

## Done when
- Each learning is in its home (one line or a short paragraph; no duplication across homes, cross-link instead), with ticket ids as evidence.
- docs-only gate: `doc_lint` plus `npm run check` exit 0; if an ADR title, L1 descriptor or changelog is touched, the sitemap carve-out runs too (CLAUDE.md).
- No em dashes. ADRs stay frozen (cite, never edit).

## Acceptance criteria
- Learnings 1 to 7 each land once with ticket ids, others cross-link: 1 CA-R9 round-2 sentence, prompt-authoring Triage item 5, agent-model `semantic check` entry; 2 payload-authoring Common traps, agent-content §8 item 5; 3 agent-content §8 item 4, agent-model §1 Capabilities; 4 prompt-authoring budget and cache bullets; 5 `scripts/e2e-admin/README.md` Live rounds and re-pin paragraph, closed-loop CL-R3 and CL-R7 (stale price-table clause repaired), CLAUDE.md chat:probe line; 6 closed-loop §5 Model notes; 7 seat-map Merge-queue traps.
- `python3 /Users/kimgranlund/.claude/plugins/cache/nonoun-plugins/docs/1.22.5/scripts/doc_lint.py .claude/docs/references/agent-model.md .claude/docs/spec/a2ui-catalog-architecture.spec.md .claude/docs/spec/agent-closed-loop.spec.md .claude/docs/spec/agent-content.spec.md .claude/skills/a2ui-payload-authoring/SKILL.md .claude/skills/a2ui-prompt-authoring/SKILL.md .claude/skills/seat-map/SKILL.md CLAUDE.md scripts/e2e-admin/README.md` exits 0.
- `npm run check` exits 0.
- The diff from e20f10bf adds no em dash, and no file under `.claude/docs/adr/` changes.
