# Contributing

Read [AGENTS.md](AGENTS.md) first: it is the single source for conventions, gates, generated files and
where each kind of truth lives. This file covers only how a change moves from idea to `main`.

## 1. A ticket first

Work items are SDLC Lite tickets in [`.sdlc/tickets/`](.sdlc/tickets/), one folder per ticket with a
`handoff.md` (goal, context, done-when). The generated [`.sdlc/tickets/roadmap.md`](.sdlc/tickets/roadmap.md)
lists them in dependency order; how to claim and close one is in [`.sdlc/AGENTS.md`](.sdlc/AGENTS.md).
`.claude/docs/tickets/` is a frozen archive.

## 2. Pick the lane

`steps.py lane <ticket dir>` (in the sdlc-lite plugin's `scripts/` folder) picks how a ticket runs:

- `solo`: the default for small and medium tickets; one agent reads, changes, runs the checks and reports.
- `fix`: the fast lane for a one-line or one-file change, only when asked or when the lane script prints it.
- `chain`: plan, build and verify in steps, for a large, merge or cross-cutting ticket.

When the lane calls for a verifier, one independent verifier runs per ticket, on a different model
family than the builder, and a pass is final.

## 3. Gate by exit code

Locally: `npm run check` plus the tests of the folders you touched. CI runs the full `npm test` on the
pull request. A docs-only diff gates on `doc_lint` plus `npm run check`. Style or UI work also needs a
screenshot of the real widget beside its approved mockup. Details: [AGENTS.md](AGENTS.md), Gates.

## 4. Land through the merge queue

Changes merge through one serial path: rebase on fresh `origin/main`, regenerate every generated file
with its script, run the affected tests, wait for CI to settle, then merge the pull request titled
`T-NNNN: <title>`. Never squash a branch onto a stale base.

## Where decisions and designs go

- A decision lives in the ticket that makes it and, as a standing rule, in the owning reference doc
  (`.claude/docs/references/`) or skill. `.claude/docs/adr/` is frozen history: cite it, never add to it.
- PRD, SPEC and LLD files under `.claude/docs/{prd,spec,lld}/` hold designs that span components or need
  a contract before a build. Their grammar and status rules are in the `doc-standards` skill.
- A new or changed `ui-*` control starts with the `component-design` skill before any code.
- Before adding or moving a document, read [docs/AGENTS.md](docs/AGENTS.md).
