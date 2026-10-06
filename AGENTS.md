# agent-ui

Zero-dependency, signals-based web-component library in strict TypeScript (signals, FACE custom elements, tagged templates, traits).
Two ruled dependency exceptions, opt-in and lazy: CodeMirror 6 on `@agent-ui/code/editor` (ADR-0139), pdfjs-dist on the `@agent-ui/app` ingestion seam (ADR-0202).

## Packages

Ten packages under `packages/agent-ui/*`; full layout in [CLAUDE.md](CLAUDE.md).

| Package | Role |
| --- | --- |
| `components` | the framework: `reactive/` <- `dom/` <- `traits/` <- `controls/` (`ui-*`) |
| `shared` | tokens, utility types, `StorageAdapter` seam |
| `a2ui` | A2UI protocol: renderer, validator, catalog, agent toolkit |
| `a2a` | Agent2Agent wire types and validation |
| `icons` | swappable icon-pack adapter |
| `app` | app-surface compositions (`ui-super-shell`) |
| `router` | memory-first SPA router |
| `code` | code and prose family |
| `data` | headless data layer (`DataSource<T>`) |
| `devtools` | chat and A2UI dev/debug harness |

- DAG: `shared <- components <- a2ui <- {app, devtools}`; `router`/`code`/`data` are siblings off `components`; `a2a` and `icons` import nothing.
- Enforced by each package's `src/layering.test.ts`. Consult those on any edge question.

## Where truth lives

| Question | Home |
| --- | --- |
| Plan, goals, roadmap, process | `.claude/docs/plan.md`, `goals.md`, `roadmap.md`, `process.md` |
| Decisions and designs | ADR/PRD/SPEC/LLD under `.claude/docs/` |
| A control's contract | descriptor `{name}.md` beside each control |
| A2UI catalogs | `catalog.json` under `packages/agent-ui/a2ui/src/catalog/` |
| Producer prompt stack | `packages/agent-ui/a2ui/src/agent/prompts/` |
| Work items | GitHub issues; `.claude/docs/tickets/` is frozen (ADR-0145) |
| Adding or moving a document | [docs/AGENTS.md](docs/AGENTS.md) |

## Never hand-edit

- `*.props.gen.ts`: generated from descriptors by `scripts/generate-props.mjs`, drift-gated.
- `packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`: recapture only via the deliberate flow in skill `a2ui-prompt-authoring`.

## Gates

- `npm run check`, `npm test`, `npm run test:browser`. Judge by exit code, never by grepping output.
- Docs-only diffs gate on `doc_lint` plus `check` (`.claude/docs/process.md` section 1).
- The keyless `npm run eval:agent-behavior -- selftest` rides `check:scripts`; its `live` leg needs a key, is a manual measurement, and is never a gate.
- `npm run e2e:admin` (keyless agent-admin flows) and `npm run e2e:devtools` are local-only runners outside the shards, not CI gates.

## Hard conventions

- `erasableSyntaxOnly` (no `enum`/`namespace`/decorators); `import type` for type-only imports; explicit `.ts` on local imports.
- Light-DOM components, ARIA via `ElementInternals`, tags `ui-{name}`.
- Event names: `change input select open close toggle action`.
- Trust boundary: keys and `produce()` never enter `devtools`; it sits at `/__a2ui/agent` (ADR-0073).
- Bare "the harness" is retired; use `.claude/docs/references/agent-model.md` section 2.

## Process

- Seat ownership (controls, a2ui code, payloads, docs, review): skill `seat-map`.
- Momentum rules: `.claude/docs/process.md`. `size:big` work runs the `due-process` loop (GH #969).
- Worktree traps: `seat-map` Dispatch laws.

## Landmines

- Stale context is a defect: a change that invalidates a record repairs it in the same change.
- No em dashes anywhere, including commits and issue comments.
- GH #1798 tracks skills that name plugin agents that are currently disabled.

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
