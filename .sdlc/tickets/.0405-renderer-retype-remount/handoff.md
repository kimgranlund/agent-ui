---
id: T-0405
title: "The renderer re-mounts a non-root component whose type changes in an updateComponents resend, instead of rewiring the old element with the new record"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
An updateComponents resend that gives an already-mounted non-root id a different component type renders the new type: the old widget subtree is disposed and a fresh widget of the new type mounts in the same slot, so a model that settles a booking by retyping the form id into ConfirmReceipt (a plausible reading of grammar G2b) sees the receipt, not a rewired BookingForm.

## Intent
- Do: in packages/agent-ui/a2ui/src/renderer/tree.ts, detect a resent non-root id whose `component` differs from its previous record and re-mount it (dispose via `#disposeSubtree`, create via the RSR-C2 create path, replace the element in its parent slot, reconcile its children) instead of `#reconcileProps`; keep the root rule (a different-type root stays an id-graph error, SPEC-R3 AC2) unchanged; add tests beside tree.ts covering a retyped leaf, a retyped container with children, a retyped node inside a dynamic list template if reachable, and that a same-type resend still reconciles onto the SAME element; record the rule in .claude/docs/lld/renderer-structural-resend.lld.md.
- Non-goals: grammar.md (byte-pinned, Kim's ruling); the validator; any prompt or catalog text.
- Done when: the new tests fail on main and pass after; `npm run check`, `npx vitest run packages/agent-ui/a2ui`, the a2ui browser shard for the renderer folder, and the whole jsdom suite exit 0.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Context
Found by the T-0404 architect, plan-reviewer and corpus judge: renderer/tree.ts:170 guards only root against a type change; `samePropsDeep` (:758) ignores `component`; `#reconcileProps` (:608-620) rewires the old element with the new record, so a retyped non-root id silently mis-renders with no finding. A2UI v1.0 updateComponents adds or updates by id, so replacement is the honest semantic. LLD: .claude/docs/lld/renderer-structural-resend.lld.md (RSR-C1 to C4). Skill a2ui-build.

## Acceptance criteria
- `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/src/renderer/tree.test.ts -t "T-0405"` exits 0; its four retype tests failed on the unchanged tree.ts (tagName stayed SPAN/DIV), its two controls (same-type resend keeps the SAME element; a retyped root is IDGRAPH and keeps its element) passed before and after.
- tree.ts `#reconcileNode` routes a changed `component` to `#remountNode`; the `apply` root guard and the same-type `#reconcileChildren`/`#reconcileProps` path are unchanged.
- .claude/docs/lld/renderer-structural-resend.lld.md §4, §8 and §11 record the retype rule.
- `npm run check`, `npx vitest run packages/agent-ui/a2ui`, `npx vitest run --config vitest.browser.config.ts packages/agent-ui/a2ui/src/renderer` and the whole jsdom suite exit 0 (each with `env -u NODE_OPTIONS`).

## Constraints
ADRs are frozen. No em dashes. Never re-monolith the browser shards.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-22 · lane: solo L1 · verdict: pass · verifier: verifier-L3 (fable) · base: 41f89f569b65
- Changed: A resent non-root id with a different component type re-mounts in its slot (surviving children move, dropped ones dispose); root rule and same-type reconcile unchanged; LLD v0.3 records the rule
- Commits: none
- Check: 1 `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/src/renderer/tree.test.ts -t "T-0405"`...: pass
- Check: 2 tree.ts `#reconcileNode` routes a changed `component` to `#remountNode`; the `apply` root guard a...: pass
- Check: 3 .claude/docs/lld/renderer-structural-resend.lld.md §4, §8 and §11 record the retype rule: pass
- Check: 4 `npm run check`, `npx vitest run packages/agent-ui/a2ui`, `npx vitest run --config vitest.browser...: pass
