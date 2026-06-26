# Best Practices — CLAUDE.md Entry Files

How to use CLAUDE.md as the standing-context entry point. Assumes `00-foundations.md`. Scored by `rubric-usage-patterns.md` (§B).

## What CLAUDE.md is — and is not

CLAUDE.md is loaded in full into context at session start and sits there as standing context the model attends to every turn. It is *context, not enforced configuration* — delivered as input after the system prompt, with no guarantee of compliance, weaker as it grows or as instructions get vague. It is not re-parsed per loop turn; it is loaded once, persists, and is re-injected after compaction (project root) or reloaded on demand (nested files).

Its control mode is *instruction* (see foundations). Use it for always-true facts and non-obvious conventions. Use hooks, not CLAUDE.md, for anything that must hold every time.

## The discipline: thin index of the always-true and non-obvious

Every line must pass the calibration test. Keep it under 200 lines — length trades directly against adherence. Include only:

- **Facts the model cannot infer**: build/test/lint commands, repo layout, where things live.
- **Non-obvious conventions**: the choices a competent model would not guess (e.g., "use `light-dark()`, not `@media (prefers-color-scheme)`").
- **A pointer to deeper docs**: `@docs/architecture.md` rather than inlining architecture.

Push path- or topic-specific material into `.claude/rules/` (scoped via `paths:`). Push multi-step procedures into skills. Push invariants into hooks. CLAUDE.md is the index, not the manual.

## Scopes and load order

Files stack, broad to specific, all concatenated: managed policy → user (`~/.claude/CLAUDE.md`) → project (`./CLAUDE.md` or `./.claude/CLAUDE.md`) → local (`CLAUDE.local.md`, gitignored). Subdirectory CLAUDE.md files load on demand when the agent reads files there. `@path` imports pull in other docs (depth limit applies). Block-level HTML comments are stripped before injection — free maintainer notes.

## Keep it coherent with Project Knowledge

In a Claude Project, CLAUDE.md is the Claude Code equivalent of Project Instructions. The two layers must not contradict each other. When a convention changes, update both.

## Do

- Keep it under 200 lines and every line verifiable ("2-space indent," not "format properly").
- State commands, layout, and non-obvious conventions only.
- Delegate enforcement to hooks; note in a comment where it lives.
- Scope detail to `.claude/rules/`; scope procedures to skills.
- Resolve contradictions immediately — conflicting rules get resolved arbitrarily.

## Don't

- Treat it as an everything-file or a running plan/checklist.
- Restate general engineering practice the model already holds.
- Use unverifiable adjectives ("good," "clean," "proper").
- Rely on "IMPORTANT: never X" as a control — that is a hook's job.
- Let it drift out of sync with Project Knowledge.

## Best-in-class example

```markdown
# <Project> — clinical intelligence platform
Architecture: @docs/architecture.md

## Commands
install `pnpm i` · build `pnpm build` · test `pnpm test` · lint `pnpm lint`

## Layout
- `src/components/`   one directory per web component
- `src/api/handlers/` request handlers
- `packages/web-components/`  published `@adia-ai/web-components`

## Conventions (non-obvious only)
- Web components: BEM names; public tokens `--component-*`, private `--_*`; `oklch()`.
- Use `light-dark()`, not `@media (prefers-color-scheme)`.
- API handlers return typed results; never throw across the handler boundary.

## Always
- Run `pnpm test` before proposing a commit.

<!-- Enforcement (no prod writes, pre-commit lint) lives in hooks, not here. -->
<!-- Path-specific rules live in .claude/rules/. -->
```

Short, verifiable, non-obvious-only. Little to drift because there is little there.
