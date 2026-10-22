---
id: T-0406
title: "Stale-context sweep: foundations census vendor skip, geometry and density docs, dogfood budget figures and a2ui spec lines named in notes"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Records that went stale after the foundations, dogfood and catalog work say what the code does now (stale context is a defect, AGENTS.md).

## Intent
- Do: for each item, verify it is still true on main, then fix it or skip it with a one-line reason in the report:
  1. scripts/foundations-census.mjs:34 `SKIP_FILE` `(?:^|\/)vendor\/` matches any vendor/ segment on the absolute path; narrow it to the two vendored byte copies and add a test that a repo-authored file under a vendor-named folder is still scanned (notes.md :519).
  2. .claude/docs/references/geometry-sizing-spec.md:13 still says the skill's scale.mjs is vendored to @agent-ui/shared/src/tokens/scale.mjs; since T-0372 two resolvers feed the sheets (notes :520); same for geometry.md:9 and tokens.md:6 (notes :521; root AGENTS.md "Never hand-edit" has the current wording).
  3. site/pages/sizing.ts:25 and :185 describe data-density as moving container spacing only; T-0374 made it move the control ramp (notes :559; root AGENTS.md Inner loop).
  4. scripts/lib/foundations-model.d.mts:1 header lists (T-0372, T-0373) after later additions (notes :561).
  5. .claude/docs/spec/genui-surface.spec.md:5 and :794 and .claude/docs/lld/genui-dogfood.lld.md:185 say 30 100 while packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts:98 is 30 500 (notes :581).
  6. site/lib/component-preview.ts:377 comment claims ConfirmReceipt fields ride SAMPLE_TREES; check and fix the comment (notes :585).
  7. .claude/docs/spec/a2ui-catalog.spec.md:263 "the games domain's appended one" names a test fixture, not a shipped sidecar (notes :589).
  8. packages/agent-ui/shared/src/tokens/foundations.test.ts:57-70 nudge table omits titleBump.sm and titleBump.lg (notes :524): add them.
- Non-goals: ADRs (frozen); grammar.md and anything under packages/agent-ui/a2ui/src/agent/prompts/ (byte-pinned, model-read); any generated file by hand.
- Done when: each item fixed or skipped with a reason; `npm run check` and the touched folders' tests exit 0 (docs-only parts gate on doc_lint plus check, AGENTS.md Gates).

## Acceptance criteria
- `node scripts/foundations-census.mjs selftest` exits 0, and its vendor cases go red with the old `(?:^|\/)vendor\/` SKIP_FILE (a planted finding under a vendor-named folder and beside the two vendored copies is found; the two copies stay unscanned).
- `npx vitest run packages/agent-ui/shared/src/tokens/foundations.test.ts` exits 0 with `titleBump.sm` and `titleBump.lg` in the nudge table.
- geometry-sizing-spec.md, geometry.md and tokens.md name both resolvers (the repo's scale.mjs and the vendored skill resolver); genui-dogfood.lld.md quotes the code's current budgets (11 200 and 33 000); a2ui-catalog.spec.md names the seeded test fixture, not a games domain; foundations-model.d.mts header names T-0374.
- doc_lint exits 0 on each touched doc; `npm run check` exits 0.

## Context
Items come from verifier notes in .sdlc/notes/notes.md (line numbers above). Root AGENTS.md holds the current foundations wording.

## Constraints
No em dashes. ADRs frozen. Never hand-edit *.gen.* files.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-22 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 1cfb3396050a
- Changed: Foundations census vendor skip narrowed to the two vendored copies (with selftest), geometry docs name both resolvers, dogfood LLD budgets, a2ui catalog spec fixture line, titleBump nudge rows
- Commits: none
- Check: 1 `node scripts/foundations-census.mjs selftest` exits 0 and its vendor cases go red with the old S...: pass
- Check: 2 `npx vitest run packages/agent-ui/shared/src/tokens/foundations.test.ts` exits 0 with titleBump.s...: pass
- Check: 3 docs name both resolvers, genui-dogfood.lld.md quotes 11 200 / 33 000, a2ui-catalog.spec.md names...: pass
- Check: 4 doc_lint exits 0 on each touched doc; `npm run check` exits 0: pass
