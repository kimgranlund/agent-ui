---
id: T-0251
title: "README, CONTRIBUTING, CHANGELOG pointer, package READMEs, plan, goals, roadmap, process refreshed"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0249]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The human-facing entry docs and the first-read plan docs match the repo as it is.

## Context
Source: the 2026-10-15 repo scrub audits (https://claude.ai/artifact/WKiuHupQFWhonnQbKA2GQT). Kim's rulings 2026-10-15: work items live in `.sdlc/tickets/` (topics layout, T-0242); CHANGELOG.md becomes a pointer to merged PRs and releases (old text archived); the npm publish scope is `@agent-ui-kit/*` (renamed at publish time; READMEs note the alias). No em dashes. ADRs stay frozen and cited.
- README.md: lists 8 of 10 packages (missing data, devtools); one dependency exception (add pdfjs-dist, ADR-0202); `check` described as 3 steps; "check and test must stay green" contradicts the inner-loop ruling; state the unreleased status.
- CONTRIBUTING.md: names `agent-ui-doc-standards` and `agent-ui-component-design` (real: `doc-standards`, `component-design`); ADRs described as active; rewrite short around sdlc-lite lanes, `.sdlc/tickets/`, the merge queue; link AGENTS.md.
- CHANGELOG.md: replace with a pointer to merged PRs and releases; move the old text to `.claude/docs/archive/`.
- Package READMEs: create `data` and `devtools`; note the `@agent-ui-kit/*` publish alias and unreleased status in each.
- `docs/AGENTS.md`: one line that `.claude/docs/` keeps its own scheme.
- plan.md (seven packages, old sm/md/lg sizing, no ADR-0245, no devtools), goals.md (state as of 2026-07-09, `[size]/[scale]/[density]` DoD), roadmap.md (Now as of 2026-08-23, no closed loop), process.md (plugin-era seats, no live-round rule).

## Done when
- Each named problem is fixed; every command a doc names exists in package.json.
- `doc_lint` on the touched docs and `npm run check` exit 0.
