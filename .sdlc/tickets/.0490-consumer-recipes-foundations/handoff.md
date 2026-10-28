---
id: T-0490
title: "Consumer CSS recipes and package READMEs load the foundations sheets, pin the current version and list every export"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Every consumer CSS recipe and package README loads all four foundation sheets, pins the current version, and lists the real exports.

## Context
Found by T-0487. `packages/agent-ui/components/src/foundation-styles.css` imports `tokens.css`, `dimensions.css`, `foundations.css` and `foundations-bridge.css`; control geometry (`--md-sys-height`, `--md-sys-icon-box`) lives only in the two generated sheets. Stale records:
- `packages/agent-ui/components/README.md:37-41`: CDN recipe links only tokens.css and dimensions.css (High).
- `packages/agent-ui/shared/README.md:18-20` and `:34-38`: a two-sheet foundation, "fully self-contained"; never names the `./foundations.css` and `./foundations-bridge.css` exports (High).
- `.claude/docs/references/component-packaging.md:106,110-111,144`: two-import foundation barrel; and `:94-108` exports table omits `./loader`, `./dogfood-frame`, `./traits/list-reorder`, `./traits/overlay`, `./traits/scroll-spy`.
- `AGENTS.md:23`: shared row omits the two foundations exports; `AGENTS.md:59`: generator inputs also include `scripts/lib/foundations-rules.mjs` and `scripts/lib/foundations-model.mjs`.
- CDN snippets pin `@0.0.5` while each README says the latest release is 0.2.0: `packages/agent-ui/{a2a,a2ui,code,components,icons,router,shared}/README.md`.

## Constraints
Docs only. Pin CDN snippets to `0.2.0`. No em dashes. Do not touch ADRs.

## Done when
- Each record above matches the code.

## Acceptance criteria
- `grep -rn '@0.0.5' packages/agent-ui/*/README.md` finds nothing.
- `grep -c 'foundations' packages/agent-ui/components/README.md packages/agent-ui/shared/README.md` is at least 2 in each.
- The component-packaging.md exports table lists every key in `packages/agent-ui/components/package.json` `exports` that is not generated.
- `npm run check` and `doc_lint` exit 0.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: eb742cd01a35
- Changed: Consumer CSS recipes and package READMEs load all four foundation sheets, pin 0.2.0 and list every export
- Commits: none
- Check: 1 `grep -rn '@0.0.5' packages/agent-ui/*/README.md` finds nothing: pass
- Check: 2 `grep -c 'foundations'` at least 2 in components and shared READMEs: pass
- Check: 3 component-packaging.md exports table lists every non-generated components export: pass
- Check: 4 `npm run check` and `doc_lint` exit 0: pass
- Check: 5 Lane: solo (process note, not a check): pass
- Follow-up: note: AGENTS.md:23 and AGENTS.md:59 updated per Context; no added line in... -> notes.md
