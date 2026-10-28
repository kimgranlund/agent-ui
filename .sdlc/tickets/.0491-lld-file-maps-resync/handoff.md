---
id: T-0491
title: "Component and A2UI LLDs drop the retired component-styles barrel step and re-sync their file maps"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Component and A2UI LLDs stop telling a builder to edit retired files, and their file maps match the tree.

## Context
Found by T-0487. `packages/agent-ui/components/src/component-styles.css` was deleted in 4d90e8265 (ADR-0233); per-control exports are generated (`scripts/generate-controls.mjs`); the current procedure is `.claude/skills/component-build/SKILL.md` step 8. Stale records:
- `.claude/docs/lld/code-entry-control.lld.md:138`, `multi-select-field.lld.md:190`, `field-form-provider.lld.md:650`, `swiper-family.lld.md:63`: a `component-styles.css` @import step and hand-added exports.
- `.claude/docs/lld/a2ui-live-agent.lld.md:110`: provider switcher "built" at `site/lib/provider-switcher.ts`, retired in f47bbd47f.
- `.claude/docs/lld/a2ui-streaming-pipeline.lld.md:29`: "blocked by corpus store"; retrieve.ts and admit.ts exist; it is unbuilt by choice (`a2ui-harness-wiring.lld.md:52`).
- `.claude/docs/lld/a2ui-chat.lld.md:27`: `site/lib/surface-registry.ts (new)`, retired in ec78f71d5.
- `.claude/docs/lld/shell-archetypes-m5.lld.md:104`: present-tense `ui-app-shell` consumers, removed in 8492d66c1; add a superseded-in-part banner like `nav-rail-family.lld.md:4`.

## Constraints
Docs only. Keep history passages as history; fix the current-mode rows. No em dashes.

## Done when
- Each row above names the current procedure or carries a retired note.

## Acceptance criteria
- `grep -rn 'component-styles.css' .claude/docs/lld/` finds no line that tells a builder to add an import.
- `npm run check` and `doc_lint` exit 0.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: eb742cd01a35
- Changed: Component and A2UI LLDs drop the retired component-styles barrel step and mark retired files and stale blockers
- Commits: none
- Check: 1 `grep -rn 'component-styles.css' .claude/docs/lld/` finds no line that tells a builder to add an ...: pass
- Check: 2 `npm run check` and `doc_lint` exit 0: pass
- Check: 3 Lane: solo because size L1: pass
- Check: 4 Done when (each Context row names the current procedure or carries a retired note): pass
- Follow-up: note: .claude/docs/lld/a2ui-live-agent.lld.md:110 the retained history... -> notes.md
