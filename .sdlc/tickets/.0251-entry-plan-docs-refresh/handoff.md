---
id: T-0251
title: "README, CONTRIBUTING, CHANGELOG pointer, package READMEs, plan, goals, roadmap, process refreshed"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

## Acceptance criteria
- README.md names all ten packages, both dependency exceptions (CodeMirror ADR-0139, pdfjs-dist ADR-0202), `check` as tsc plus check:site, check:tools and check:scripts, the inner-loop gate (check plus touched tests, CI runs the suite) and the release status (v0.1.0 of eight packages, `data` and `devtools` unpublished, `main` unreleased).
- CONTRIBUTING.md names `doc-standards` and `component-design`, calls ADRs frozen, covers sdlc-lite lanes, `.sdlc/tickets/` and the merge queue, and links AGENTS.md.
- CHANGELOG.md is a pointer (merged PRs, release tags); the old text is at `.claude/docs/archive/changelog-to-2026-10-15.md`; `node scripts/generate-sitemap.mjs` and `node scripts/generate-llms-full.mjs` leave no diff, and `npx vitest run site/lib/sitemap.test.ts site/lib/llms.test.ts site/lib/docs-grammar.test.ts site/lib/command-palette.test.ts` exits 0.
- `packages/agent-ui/data/README.md` and `packages/agent-ui/devtools/README.md` exist; every package README notes the `@agent-ui-kit/*` publish name and its release status.
- `docs/AGENTS.md` has one line outside the managed block saying `.claude/docs/` keeps its own scheme.
- plan.md says ten packages (tree includes code, data, devtools), the ADR-0245 sizing law and a non-planning status; goals.md carries a 2026-10-15 state line and a DoD without the `[size]/[scale]/[density]` axes; roadmap.md §2 is dated 2026-10-15 and names the closed loop; process.md names the sdlc-lite lanes and a live-round rule.
- Every npm run command named in the touched docs exists in package.json; doc_lint on each touched doc and `npm run check` exit 0; no added line carries an em dash.

## Outcome

2026-10-15 · lane: full L2 · verdict: closed by reason (Merged: entry and plan docs refreshed; verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
