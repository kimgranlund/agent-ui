## Goal
Rewrite the repo-root `AGENTS.md` as a short harness-neutral router that orients any agent harness to this repo: what exists, where each kind of truth lives, what must not be broken. Docs-only.

## Context
Today `AGENTS.md` has three thin hand-written sections (What this repository is, Shared rules, Checks) above a managed block written by `scripts/onboard.py` of sdlc-lite (between `<!-- sdlc-lite:managed:start ... -->` and `<!-- sdlc-lite:managed:end -->`). `CLAUDE.md` (107 lines, project law, imports `@AGENTS.md` at its end) already holds the full layout, package DAG and conventions, so AGENTS.md must route to it and to `.claude/docs/` rather than duplicate them. The user approved this outline for AGENTS.md (read each home before citing it; cite paths that exist, verify with `ls`):
1. Identity in two lines: zero-dependency signals-based web-component library in strict TypeScript; the two ruled dependency exceptions (CodeMirror 6 on `@agent-ui/code/editor`, pdfjs-dist on the `@agent-ui/app` ingestion seam).
2. Package map with dependency direction: ten packages under `packages/agent-ui/*`, one line each, the DAG (`shared <- components <- a2ui <- {app, devtools}`; `router`, `code`, `data` siblings off `components`; `a2a`, `icons` import nothing), enforced by per-package `layering.test.ts` gates (consult those on any edge question).
3. Where truth lives: a question-to-home table. Plan, goals, roadmap, process under `.claude/docs/`; ADR/PRD/SPEC/LLD there too; descriptors `*.md` beside each control; catalogs `catalog.json` under `packages/agent-ui/a2ui/src/catalog/`; prompt stack under `packages/agent-ui/a2ui/src/agent/prompts/`; work items are GitHub issues and `.claude/docs/tickets/` is frozen (ADR-0145).
4. Generated or byte-pinned surfaces with the edit flow, never hand-edit: `.props.gen.ts` generated from descriptors (drift-gated); the prompt stack's golden baseline `prompt-equivalence.baseline.json` with the deliberate recapture flow (skill `a2ui-prompt-authoring`).
5. Gating commands: `npm run check`, `npm test`, `npm run test:browser`; judge by exit code; docs-only diffs gate on `doc_lint` plus `check`.
6. Hard conventions (few, non-obvious): `erasableSyntaxOnly`, `import type`, explicit `.ts`, light-DOM, ARIA through `ElementInternals`, `ui-{name}` naming, event names `change input select open close toggle action`.
7. Trust boundary: keys and `produce()` never enter `devtools`; the boundary sits at `/__a2ui/agent` (ADR-0073).
8. Vocabulary: bare "the harness" is retired; point at `.claude/docs/references/agent-model.md` section 2.
9. Seat map: point at the `seat-map` skill for which agent or skill owns UI controls, a2ui code, payloads, docs, review.
10. Process rules a harness hits: momentum rules (`.claude/docs/process.md`), the `size:big` due-process loop (GH #969), worktree traps (`seat-map` Dispatch laws).
11. Landmines: stale context is a defect (a change that invalidates a record repairs it in the same change); no em dashes anywhere; note that GH #1798 tracks skills naming plugin agents that are currently disabled.

Leave out: the ADR list, the component inventory, tokens, anything a gate already fails loudly on, dated status.

## Constraints
- Edit only `AGENTS.md` (repo root). Do not touch `CLAUDE.md`, the managed block, or any other file. Keep the managed block byte-identical: `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.20.5/scripts/onboard.py check` must still report `AGENTS.md` as `current`.
- Target about 60 lines in total for the hand-written part; terse tables and bullets, no prose paragraphs, no em dashes, no bold inline labels that restate the next words.
- Every path, command and ADR number cited must exist; verify each. Link, do not restate, what `CLAUDE.md` and the docs already say.
- Docs-only gates: `doc_lint` (newest `~/.claude/plugins/cache/nonoun-plugins/docs/*/scripts/doc_lint.py`) on the file if it applies to it, plus `npm run check` exit 0. No push, no PR; publishing needs user approval. Do not touch `.sdlc/`.
