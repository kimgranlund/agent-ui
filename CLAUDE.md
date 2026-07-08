# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`agent-ui` is a zero-dependency, signals-based web-component library authored in strict, modern
TypeScript — carrying over the `rce` architecture: signals reactivity · FACE custom elements ·
tagged-template rendering · traits. First component family = FACE form controls.

Plan `.claude/docs/plan.md` · Goals + per-milestone DoD `.claude/docs/goals.md` · Coherence process `.claude/docs/process.md` · Standards `.claude/docs/references/`

## Commands

- `npm run check` — `tsc` type-check of the packages AND the site (`&& check:site`; the standing type gate; `noEmit`)
- `npm test` — Vitest (jsdom), once · `npm run test:watch` — watch mode
- `npm run dev` / `npm run build` — the docs site (`site/`) is the app entry; build live since the
  ADR-0077 wave, incl. the G8 `<component-gallery>` (`gallery.html`)

`tsc` only type-checks (no emit); `check` + `test` are the gates that must stay green.

## Layout

npm-workspaces monorepo; source lives under `packages/agent-ui/*`.

- `packages/agent-ui/components/` — `@agent-ui/components`, the whole framework. `src/` layers (downward-only):
  - `reactive/` — signals kernel; imports nothing (bottom layer)
  - `dom/` — `UIElement`/`UIFormElement`, props, template, directives; imports only `../reactive`
  - `traits/` — `(host, opts) => cleanup` traits + controllers, registered via `host.use()`
  - `controls/` — `ui-*` FACE controls; one folder per component; self-define on import
- `packages/agent-ui/shared/` — `@agent-ui/shared`, cross-cutting tokens/styles/utility types. Color
  `tokens.css` adopted (`src/tokens/`, exported as `@agent-ui/shared/tokens.css`); dimensional/runtime tokens land G5
- `packages/agent-ui/a2ui/` — `@agent-ui/a2ui`, the A2UI layer (team-led, `.claude/docs/specs/`); depends on `@agent-ui/components`
- `packages/agent-ui/a2a/` — `@agent-ui/a2a`, the A2A (Agent2Agent) protocol layer: wire types + validation pinned to spec v0.3.0, the tic-tac-toe arena (isolation-proven agent-vs-agent matches), and its own concept/demo corpus shards; zero deps
- `packages/agent-ui/icons/` — `@agent-ui/icons`, swappable icon-pack adapter (pure core + `./phosphor` subpath; ADR-0065/0066); zero deps
- `packages/agent-ui/app/` — `@agent-ui/app`, app-surface compositions (`agent-app-shell`, ADR-0082..0084); depends on components + a2ui + shared
- `.claude/docs/` — plan, goals, process, references, adr, specs, llds, decompositions, rubrics (agent-scoped project docs) · `*.test.ts` co-located with source

## Conventions (non-obvious only)

- tsconfig is strict in load-bearing ways: `erasableSyntaxOnly` bans `enum`/`namespace`/decorators
  (use `as const` objects + literal unions, and `declare`-merged accessors instead of decorators);
  `verbatimModuleSyntax` ⇒ `import type` for type-only imports; `allowImportingTsExtensions` ⇒ keep
  the explicit `.ts` on local imports.
- Vite 8 is Rolldown-based (not esbuild/Rollup) — bundler/plugin behaviour follows Rolldown-Vite.
- Imports point inward only: layers `reactive` ← `dom` ← `traits`/`controls`; cross-package the DAG is
  `shared` ← `components` ← `a2ui` ← `app` (`icons`/`a2a` import nothing). Nothing imports upward.
  (Enforced by the per-package `layering.test.ts` trip-wires.)
- Naming: tags `ui-{name}`, classes `UI{Name}Element`, tokens `--ui-{name}-*` / color roles
  `--md-sys-color-{family}-{role}` / type scale `--md-sys-typescale-{role}-{size}-*` (ADR-0078);
  event names ∈ `change · input · select · open · close · toggle`.
- Components are light-DOM by default; ARIA via `ElementInternals`, never host attributes; no native form elements.
- Props are typed signals via `static props` + `ReactiveProps<typeof props>` (plan §5).

## Always

- Run `npm run check && npm test` green before treating a change as done.

<!-- Coherence gates (naming/layering/contract-drift/size/zero-native) are scripts + a planned Stop/pre-commit hook, NOT prose rules — see .claude/docs/process.md §1. Enforcement lives there, not in this file. -->
<!-- Architecture detail lives in .claude/docs/plan.md; the buildout sequence + DoD in .claude/docs/goals.md — referenced as paths, not @-inlined, to keep standing context thin. -->
