---
id: T-0164
title: "Retire the ADR system: decisions live in tickets and reference docs; repair every record that routes to ADRs"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-14: "we should stop using ADR system". New decisions are recorded in the ticket that makes them and, when they are standing rules, in the reference doc or skill that owns the area. No new ADRs, amendments or ratification steps.

## Intent
- Do:
  - Freeze `.claude/docs/adr/` as read-only history (like `tickets/`, ADR-0145): a README line saying frozen, existing ADRs stay citable, no new files or amendments.
  - Repair every live record that tells an agent to write, amend or ratify an ADR: CLAUDE.md, AGENTS.md, docs/AGENTS.md, `.claude/docs/process.md`, `goals.md`, the `doc-standards` skill (and its adr-log mechanics reference), `due-process`, `seat-map`, `component-design`, `a2ui-prompt-authoring`, any agent definitions, and doc_lint rules or generators that require ADR updates (ADR index, sitemap ADR rows, changelog hooks). Replace with: decision in the ticket; standing rule in the owning reference doc (e.g. `.claude/docs/references/geometry.md`, `dogfood-lint.md`) or skill.
  - Keep generated ADR indexes building from the frozen set, or drop them if nothing reads them; gates stay green.
  - List the open "Proposed" or unratified ADRs and stale-ADR repair notes in `.sdlc/notes.md` (0046, 0059, 0105, 0219, 0228) and resolve each: close as superseded, or move the live rule into its reference doc.
- Non-goals: rewriting existing ADR prose, moving ADR files.
- Done when: `npm run check` exit 0; doc_lint exit 0; `rg -n "write an ADR|new ADR|amend(ment)? .*ADR|ratif" CLAUDE.md AGENTS.md docs .claude/docs/process.md .claude/skills .claude/agents` returns only frozen-history mentions; sitemap test exit 0 if indexes changed.

## Context
- Doc grammar and status law live in `.claude/skills/doc-standards/`. Docs-only carve-out: gates on doc_lint plus check (process.md section 1).

## Constraints
- Never rewrite accepted ADR prose. No em dashes.

## Resolution
- Freeze marker: no `.claude/docs/adr/README.md`, because `site/lib/adr.test.ts` (no-README assertion) and Kim's 2026-08-13 no-index rule forbid one. The freeze is stated in `docs/layout.md` Frozen paths, `CLAUDE.md` Layout, `AGENTS.md` Where truth lives, `.claude/docs/process.md` header, and `doc-standards` (SKILL.md banner, `adr-log-mechanics.md` §1a).
- Dispositions of the unflipped amendments (0040, 0067, 0072, 0170) and the stale clauses from `.sdlc/notes.md` (0046 Am7, 0059, 0105 Am2, 0219, 0228 cl.6) are tabled in `.claude/skills/doc-standards/references/adr-log-mechanics.md` §1a; the live rules moved to `.claude/docs/references/geometry.md` (Rules that replace frozen ADR clauses) and `tokens.md` (switch track, chart series inks).
- `.sdlc/notes.md` is untracked in the main checkout, so this lane does not edit it; the conductor marks those lines resolved at landing.
- `scripts/adr_ratify.py` and its selftest stay (nothing calls the script; the test rides `check:scripts`); removing them is a separate cleanup. The ADR index generator keeps building from the frozen set unchanged.

## Acceptance criteria
1. `npm run check` exits 0.
2. `npx vitest run site/lib/adr.test.ts site/lib/docs-grammar.test.ts site/lib/sitemap.test.ts` exits 0.
3. `git diff --quiet 305540bd -- .claude/docs/adr` exits 0 (no ADR file added or edited).
4. Every remaining hit of `rg -n "write an ADR|new ADR|amend(ment)? .*ADR|ratif" CLAUDE.md AGENTS.md docs .claude/docs/process.md .claude/skills .claude/agents` is a citation of a past decision, an eval prompt, the fleet-review deviations-ledger name, or a frozen-history note; none tells an agent to write, amend or flip an ADR.
5. `docs/layout.md`, `CLAUDE.md`, `AGENTS.md`, `.claude/docs/process.md` and `doc-standards` route a new decision to its ticket and the owning reference doc or skill.
6. Each of ADR-0040, 0067, 0072, 0170 (unflipped amendments) and 0046 Am7, 0059, 0105 Am2, 0219, 0228 cl.6 (stale clauses) has a disposition in `adr-log-mechanics.md` §1a, and each stale clause's current value matches the shipped CSS it names (`board-grid.css`, `product-card.css`, `switch.css`, `calendar.css`, `_chart/chart-axis.css`).
