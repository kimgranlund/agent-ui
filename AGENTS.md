# agent-ui

Zero-dependency, signals-based web-component library in strict, modern TypeScript (signals reactivity, FACE custom elements, tagged-template rendering, traits).
Two ruled dependency exceptions, both opt-in and lazy-loaded, never on a default barrel: CodeMirror 6 on `@agent-ui/code/editor` (ADR-0139), pdfjs-dist on the `@agent-ui/app` ingestion seam (ADR-0202).

This file is the one source every harness reads; the root `CLAUDE.md` only imports it.

## Commands

- `npm run check`: the standing gate (`tsc && check:site && check:tools && check:scripts`, all noEmit or test steps).
- `npm test`: Vitest (jsdom), once; `npm run test:watch` watches.
- `npm run test:browser`: the real-engine gate, six sequential vitest shards then `test:eval-catalog`. Never re-monolith the shards or add a heap bump (skill `component-testing`).
- `npm run dev` / `npm run build`: the docs site (`site/`); `npm run deploy:docs`: ui.nonoun.io.
- Every other runner (agent evals and the workspace key, `e2e:admin`, `chat:probe`, `traces`, the fog adapter, `e2e:devtools`, `test:a2ui-kit`, the `ops:*` reap and scratch-clone scripts) with its keys, homes and CI status: [.claude/docs/references/commands.md](.claude/docs/references/commands.md).

## Packages

npm-workspaces monorepo; ten packages under `packages/agent-ui/*`.

| Package | Role |
| --- | --- |
| `components` | the framework. `src/` layers import downward only: `reactive/` (signals kernel, imports nothing) <- `dom/` (UIElement/UIFormElement, props, template, directives) <- `traits/` (`(host, opts) => cleanup`, invoked from `connected()`) <- `controls/` (`ui-*` FACE controls, one folder per component, self-define on import) |
| `shared` | tokens (`src/tokens/{tokens,dimensions}.css` -> `@agent-ui/shared/tokens.css`, plus the generated `foundations.css` and `foundations-bridge.css` exports), utility types, and the `StorageAdapter` persistence seam (ADR-0193), the DAG-bottom home lower layers persist through |
| `a2ui` | A2UI protocol: renderer, validator, catalog, `./examples`, `./corpus`, `./agent` (the producer toolkit with its assets embedded at build time, ADR-0137 and ADR-0236; the key and dev-proxy shell stay site-internal) |
| `a2a` | Agent2Agent wire types and validation pinned to spec v0.3.0, the tic-tac-toe arena, own corpus shards; zero deps |
| `icons` | swappable icon-pack adapter (pure core plus `./phosphor`; ADR-0065/0066); zero deps |
| `app` | app-surface compositions (`ui-super-shell` plus presets) |
| `router` | memory-first SPA router, opt-in URL reflection (ADR-0115) |
| `code` | code and prose family (ADR-0119): zero-dep core plus `./highlight`, `./markdown`, `./editor` (the CodeMirror exception, ADR-0139) |
| `data` | headless SaaS data layer (ADR-0192): `DataSource<T>` seam, signal-backed `resource()`/`mutation()`/`paginated()`, plus `./gateway` and `./stream` opt-in subpaths; real consumers are agent-admin's persona roster, skill-pack shelf and AgentTeam records via `app`'s source modules (ADR-0227 waves 1 and 2) |
| `devtools` | chat and A2UI dev/debug harness (ADR-0200): the three-backend transport shelf behind the ADR-0137 `AgentTransport` seam, `DevtoolsEvent`/`recordTurn`, plus `./server` and `./playwright` subpaths; the harness page stays site-internal |

- Imports point inward only. DAG: `shared <- components <- a2ui <- {app, devtools}`; `router`/`code`/`data` are sibling branches off `components`, all three catalog-invisible (never imported by `a2ui`); `a2a <- devtools`; `app` and `devtools` are peers; nothing imports `devtools`; `app` may import `code` and `data` (the ADR-0192 cl.1 reserved edge, activated by ADR-0227's roster adoption) but never `router`; `components` also imports `icons`; `icons` and `a2a` import nothing themselves.
- Enforced by each package's `src/layering.test.ts` trip-wires. Consult those on any edge question (ADR-0115/0139/0192/0200/0227).
- `*.test.ts` files sit beside their source.

## Where truth lives

| Question | Home |
| --- | --- |
| Plan, goals and DoD, roadmap, process | `.claude/docs/plan.md`, `goals.md`, `roadmap.md`, `process.md` |
| Standards | `.claude/docs/references/` |
| Decisions | the ticket that makes them; standing rules in the owning reference doc or skill. `.claude/docs/adr/` is frozen history (Kim 2026-10-14, T-0164): existing ADRs stay citable, nothing is added or changed |
| Designs | PRD/SPEC/LLD under `.claude/docs/` (also adr, rubrics, references, archive); these and PLAN/ROADMAP stay files, always |
| Doc grammar and status law | `.claude/skills/doc-standards/` |
| A control's contract | descriptor `{name}.md` beside each control |
| A2UI catalogs | `catalog.json` under `packages/agent-ui/a2ui/src/catalog/` |
| Producer prompt stack | `packages/agent-ui/a2ui/src/agent/prompts/` |
| Work items | `.sdlc/tickets/` (sdlc-lite topics layout, T-0242); `.claude/docs/tickets/` is frozen history (ADR-0145) |
| Adding or moving a document | [docs/AGENTS.md](docs/AGENTS.md) |

## Never hand-edit

- `*.props.gen.ts`: generated from descriptors by `scripts/generate-props.mjs`, drift-gated.
- `packages/agent-ui/components/src/controls/registry.gen.ts`, `src/all.gen.ts` and `src/all.gen.css`, plus the components `./controls/*`, `./registry`, `./all` and `./all.css` exports keys: generated by `scripts/generate-controls.mjs`, drift-gated (ADR-0233).
- `packages/agent-ui/a2ui/src/agent/assets.gen.ts` and `packages/agent-ui/a2ui/src/agent/dogfood-fleet.gen.ts`: generated from the a2ui prompts, the catalog `selection.json` sidecars and the components descriptors by `node scripts/generate-agent-assets.mjs`, drift-gated (`agent-assets-freshness.test.ts`, and `--check` in `check:scripts`).
- `site/agent-content/registry.gen.ts`, `registry.runtime.gen.ts` and the `seedVersion` in `site/lib/agent-manifest/*.manifest.json`: generated from the agent content files (`site/agent-content/`, its `AGENTS.md`) by `node scripts/generate-agent-content.mjs`, drift-gated (`registry-freshness.test.ts`, and `--check` in `check:scripts`).
- `packages/agent-ui/a2ui/src/registry/selection-projection.gen.ts`: the browser-safe copy of the `selection.json` sidecars, generated by `npm run generate:registry`, drift-gated (`tools/registry/generate.test.ts`).
- `packages/agent-ui/shared/src/tokens/foundations.gen.css` and `foundations-bridge.gen.css`: generated from the repo's `scale.mjs` beside them, `scripts/lib/foundations-rules.mjs` and `scripts/lib/foundations-model.mjs`, and the skill's current resolver vendored under `tokens/vendor/mathematical-design-system/` (T-0372) by `node scripts/generate-foundations.mjs` (ADR-0245), drift-gated (`foundations.test.ts`, and `--check` in `check:scripts`).
- `packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`: recapture only via the deliberate flow in skill `a2ui-prompt-authoring`.

## Gates

- Local gate: `npm run check` plus the tests of the touched folders only; CI's `npm test` is the full-suite gate and a PR merges on CI green (Kim 2026-10-12). Never the full `npm test` per edit. A ticket's "Done when", a plan's criteria and a verifier's run all use this set, never "npm test exit 0".
- Judge by exit code, never by grepping output (a piped grep-count masked a red check and an OOM'd browser run, 2026-07-19).
- Docs-only diffs (`.claude/docs/**`, `*.md` outside a descriptor's `attributes[]` fence, code comments) gate on `doc_lint` plus `check`; CI runs `test` (`.claude/docs/process.md` section 1, Kim 2026-08-29). One that touches an ADR title, an L1 descriptor, the ADR log or the changelog also regenerates the sitemap indexes and runs `site/lib/sitemap.test.ts` (the 2026-08-30 carve-out, same section).
- The keyless `npm run eval:agent-behavior -- selftest` rides `check:scripts`; its `live` leg needs a key, is a manual measurement, and is never a gate.
- `npm run e2e:admin` (keyless agent-admin flows) and `npm run e2e:devtools` are local-only runners outside the shards, not CI gates.
- `npm run chat:probe` (T-0174) drives the real agent-admin Test Chat headless, live or replayed, with named checks (no halt, no A2UI JSON as prose, no surface loss); `-- --from-trace last` turns a live trace into a keyless replay test. Local only; its keyless `selftest` rides `check:scripts`.
- The foundations census gate (ADR-0245) rides `check:scripts`: `node scripts/foundations-census.mjs --gate` fails on a hand-tabled ramp read, a px geometry literal, ui-icon's old `glyph` prop or a `[scale]` / `[density]` use that `scripts/foundations-allowlist.json` does not list, and on a stale entry. A lane runs `node scripts/foundations-codemod.mjs <dir>` on its folders, fixes the rest by hand and deletes its own allowlist lines; `node scripts/foundations-probe.mjs` measures each sized control against the derived geometry.
- The dogfood lint (T-0136, `.claude/docs/references/dogfood-lint.md`): `node scripts/dogfood-compose.mjs --gate` rides `check:scripts` (a calendar for a date field, a grid of buttons for a board, inline literal geometry) and `site/pages/dogfood-render.browser.test.ts` rides the `site` shard (computed radius, height, text edge, type floor, the 400px column, nested cards on every demo and catalog widget); rules in `scripts/dogfood-rules.json`, reasons in the two `dogfood-*-allowlist.json` files.
- The size gate (Kim 2026-10-28, T-0529): `node scripts/measure-size.mjs` (`npm run size`) rides `check:scripts`, so a barrel, subpath or per-control marginal over its budget reds the local check and CI. This supersedes the manual-only stance of ADR-0040 section 3 (ADRs are frozen, so the ruling lives here). A budget change carries a dated reason comment naming its mover in `scripts/measure-size.mjs`.
- The keyless A2UI test kit (`packages/agent-ui/a2ui/tools/testkit/README.md`): `npm run test:a2ui-kit` and `npm run test:a2ui-kit:browser`; its legs also run in `npm test` and `test:browser`, and `kit.ts selftest` rides `check:scripts`.

## Hard conventions

- tsconfig is strict in load-bearing ways: `erasableSyntaxOnly` bans `enum`/`namespace`/decorators (use `as const` objects plus literal unions); `verbatimModuleSyntax` means `import type` for type-only imports; `allowImportingTsExtensions` means keep the explicit `.ts` on local imports.
- Vite 8 is Rolldown-based: bundler and plugin behaviour follows Rolldown-Vite, not esbuild or Rollup.
- Naming: tags `ui-{name}`, classes `UI{Name}Element`, tokens `--ui-{name}-*`, color roles `--md-sys-color-{family}-{role}`, type scale `--md-sys-typescale-{role}-{size}-*` (ADR-0078).
- Event names: `change input select open close toggle action` (ADR-0153).
- Components are light-DOM by default; ARIA via `ElementInternals`, never host attributes; no native form elements (the last carve-out, ui-table's, retired by the ADR-0163 amendment; descriptor-documented internal non-value activation `<button data-part>`s are the one sanctioned class).
- Sizing is fill-by-default (ADR-0223): controls are block-level and fill their container; the one opt-out is the reflected `inline` boolean (hug). `sizing-gates.test.ts` is enforcing with an empty DEBT table: a new control ships conformant or reds the gate.
- Props are typed signals via `static props` plus `ReactiveProps<typeof props>`.
- Shared and app state follow the ADR-0227 grammar: one signal-backed owner, explicit injection, `StorageAdapter` persistence, CSS cascade for presentational axes; the how-to (with the `resource()`/`mutation()` worked example) is `.claude/docs/references/state-and-persistence.md`.
- Trust boundary: keys, providers and `produce()` never enter `devtools`; the boundary sits at `/__a2ui/agent` (ADR-0073).
- Agent vocabulary (layers, glossary, seams) is `.claude/docs/references/agent-model.md`; new prose uses its terms (agent config, a2ui producer, devtools capture, skill vocabulary; skill pack vs library pack; Co-pilot, not Author). Bare "the harness" is retired (section 2 there).

## Inner loop

How an agent works on an edit, a fix or a style pass (Kim 2026-10-12: the full suite is the CI gate, not a per-edit step).

- Run the local gate above, never the full suite per edit.
- Style and UI work: a screenshot of the real widget next to its approved mockup is the evidence. Behaviour tests alone do not prove a look. Controls take the library ramp (`sm` 24 / `md` 32 / `lg` 40 px, the page root product / md at regular density, ADR-0245 Amendment 8; `data-density` moves it, T-0374); no one-off heights at regular density. An A2UI surface sits at `data-tier="widget" data-scale="md"` (the canvas register, one step below the page at 20 / 24 / 28, ADR-0245 Amendments 2 and 8), so a composite's `lg` action is 28px.
- One independent verifier per ticket, and a pass is final. Em dashes, stale count comments and wording go under NOTES and never cause a rebuild; the conductor fixes a one-line nit itself.
- Merge through one serial path that rebases on fresh `origin/main`, regenerates every generated file with its script, runs the affected tests, waits for CI to settle and then merges. Never squash a branch onto a stale base.
- A solo agent gets one brief paragraph, not a checklist. A planner writes one terse step for a ticket with a merged precedent, and a stalled agent (no output for 20 minutes) is stopped and relaunched lighter, not waited on.

## Process

- Seat ownership (controls, a2ui code, payloads, docs, review): skill `seat-map`.
- Momentum rules (one review pass, Lows never block, trivial diffs skip the checker): `.claude/docs/process.md`. `size:big` work runs the `due-process` four-phase loop before it closes (GH #969).
- Worktree traps: the symlink-not-install recipe, the concurrency ceiling and reap-on-return live in `seat-map` Dispatch laws; the test-side traps in `component-testing` Traps.

## Landmines

- Stale context is a defect: a change that invalidates a record repairs it in the same change.
- No em dashes anywhere, including commits and issue comments.

<!-- sdlc-lite:managed:start v1 sha256:c90494f241a8 -->
## Documents

Read [the docs entry](docs/AGENTS.md) before adding or moving a document.

Managed by SDLC Lite onboard, template 1.

## Work records

`.sdlc/tickets/` holds SDLC Lite tickets and their task plans (plan docs under review go to `docs/planning/`); run records live in the git-ignored `.sdlc/runtime/tasks/<folder>/`, and a closed ticket keeps only its `handoff.md` with its `## Outcome`.

- Pick the lane first with `steps.py lane <task dir>` (in the plugin's `scripts/` folder): `solo` is the default for ticket levels L1 and L2, `/sdlc-lite:fix` runs only when asked or when the lane script prints `fix`, and the full chain (`/sdlc-lite:chain`) needs a stated reason (an L4 or L5 step, a merge step, or cross-cutting scope). Roles launch with `run.sh`. Do not spawn another plugin's builder, planner, or reviewer agent in their place.
- Worktrees: lanes live in `../<repo>.worktrees/` (`wtroot.py root`, in the plugin's `scripts/` folder). Lane open, the solo and verifier runs in a lane, land and close write `.git` or the lane tree outside the checkout, so under Codex run them with full access, not the `workspace-write` sandbox.
- Several hosts in one repo (Claude Code, Codex, Pi): one conductor writes main; a worker writes only its locked lane, commits nothing, and runs `lanes.py ready` when done (the Lanes section of the plugin's `AGENTS.md`).
- Handoff files follow the `sdlc-lite:handoff-format` skill.
- Tickets are created, closed, and archived through the `sdlc-lite:ticket` skill.
- `.sdlc/tickets/roadmap.md` is generated. Do not edit it by hand.
- `.sdlc/messages/` is a local mailbox. Never commit it; a `.gitignore` line for it is advised.
- Do not move or rewrite a finished run record. Write no loose file at the top of `.sdlc/` or the project root: notes go to `.sdlc/notes/notes.md`, an answer to another agent goes by `messages.py send`. The `.sdlc/AGENTS.md` Folder layout lists what may sit at the top; `tickets.py check` warns on anything else and `tickets.py tidy` moves it into `.sdlc/work/archive/`.
<!-- sdlc-lite:managed:end -->
