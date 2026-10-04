# agent-ui

## What this repository is

A zero-dependency, signals-based web-component library in strict TypeScript: signals reactivity,
FACE custom elements, tagged-template rendering, traits. An npm-workspaces monorepo with ten
packages under `packages/agent-ui/*` and a docs site in `site/`. `CLAUDE.md` holds the full layout,
package DAG, and conventions; project docs (ADR, PRD, SPEC, LLD, plan, roadmap, process) live in
`.claude/docs/`, not `docs/`.

## Shared rules

- Imports point inward only. `reactive/` <- `dom/` <- `traits/` <- `controls/`; cross-package edges
  are enforced by the per-package `layering.test.ts` gates.
- `erasableSyntaxOnly` bans `enum`/`namespace`/decorators; use `import type` for type-only imports
  and keep the explicit `.ts` on local imports.
- Components are light-DOM by default, ARIA via `ElementInternals`, tags `ui-{name}`.
- Work items are GitHub Issues; `.claude/docs/tickets/` is frozen (ADR-0145).
- No em dashes anywhere, including commits and issue comments.

## Checks

- `npm run check` is the standing gate (`tsc` plus site, tools, and scripts checks). Judge by exit code.
- `npm test` runs Vitest (jsdom); `npm run test:browser` is the real-engine gate.
- Locally run `check` plus the touched package's tests; CI runs the full suite. Docs-only diffs gate
  on `doc_lint` plus `check` (`.claude/docs/process.md` section 1).

<!-- sdlc-lite:managed:start v1 sha256:559a254eb95c -->
## Documents

Read [the docs entry](docs/AGENTS.md) before adding or moving a document.

Managed by SDLC Lite onboard, template 1.

## Work records

`.sdlc/` holds SDLC Lite tickets, plans, and run records.

- Plan, build, and verify work runs through SDLC Lite: `/sdlc-lite:chain`, `/sdlc-lite:fix`, or `/sdlc-lite:build`, which launch roles with `run.sh`. Do not spawn another plugin's builder, planner, or reviewer agent in their place.
- Handoff files follow the `sdlc-lite:handoff-format` skill.
- Tickets are created, closed, and archived through the `sdlc-lite:ticket` skill.
- `.sdlc/roadmap.md` is generated. Do not edit it by hand.
- `.sdlc/messages/` is a local mailbox. Keep it in `.gitignore` and never commit it.
- Do not move or rewrite a finished run record.
<!-- sdlc-lite:managed:end -->
