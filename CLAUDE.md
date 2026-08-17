# CLAUDE.md

`agent-ui` is a zero-dependency, signals-based web-component library (one ruled exception: the opt-in
`@agent-ui/code/editor` surface adopts CodeMirror 6, lazy-loaded — ADR-0139; every default barrel stays
dependency-free) authored in strict, modern
TypeScript — carrying over the `rce` architecture: signals reactivity · FACE custom elements ·
tagged-template rendering · traits. First component family = FACE form controls.

Plan `.claude/docs/plan.md` · Goals + per-milestone DoD `.claude/docs/goals.md` · Roadmap (forward-looking, Now/Next/Later) `.claude/docs/roadmap.md` · Coherence process `.claude/docs/process.md` · Standards `.claude/docs/references/` · `size:big` work runs the `due-process` skill's four-phase loop before it closes (GH #969); `size:small` unaffected

## Commands

- `npm run check` — the standing gate: `tsc` (packages) `&& check:site && check:tools && check:scripts`
  (four `noEmit`/test steps; see `package.json`)
- `npm test` — Vitest (jsdom), once · `npm run test:watch` — watch mode
- `npm run test:browser` — the real-engine gate, six sequential shards (never re-monolith it or add
  a heap bump — shard-splitting history + the `focus-timing` extension rule: `component-testing`)
- `npm run dev` / `npm run build` — the docs site (`site/`) is the app entry; build live since the
  ADR-0077 wave, incl. the G8 `<component-gallery>` (`gallery.html`)

`tsc` only type-checks (no emit); `check` + `test` are the gates that must stay green.

## Layout

npm-workspaces monorepo; source lives under `packages/agent-ui/*`.

- `packages/agent-ui/components/` — `@agent-ui/components`, the whole framework. `src/` layers (downward-only):
  - `reactive/` — signals kernel; imports nothing (bottom layer)
  - `dom/` — `UIElement`/`UIFormElement`, props, template, directives; imports only `../reactive`
  - `traits/` — `(host, opts) => cleanup` traits + controllers, invoked directly from `connected()` (no `host.use()`)
  - `controls/` — `ui-*` FACE controls; one folder per component; self-define on import
- `packages/agent-ui/shared/` — `@agent-ui/shared`, cross-cutting tokens/styles/utility types,
  plus the persistence-adapter seam (ADR-0193): a typed async `StorageAdapter` in `src/storage/`
  with localStorage + hand-rolled IndexedDB tiers and an opt-in cross-tab notification seam —
  the DAG-bottom home lower layers persist through. Color `tokens.css` + dimensional/runtime
  `dimensions.css` both live in `src/tokens/`, exported as `@agent-ui/shared/tokens.css` (G5, done)
- `packages/agent-ui/a2ui/` — `@agent-ui/a2ui`, the A2UI layer (team-led; docs on the unified map — `.claude/docs/{spec,lld,prd}/`); depends on `@agent-ui/components`. Export surfaces: `.` (renderer/validator/catalog) · `./examples` (seed shelf) · `./corpus` (pure store) · `./agent` (the NODE-FIRST producer toolkit — `buildSystemPrompt`/`produce`/the `AgentTransport`+`Session` seam/mini-skills; ADR-0137/TKT-0072, portable core in `src/agent/`, the key/dev-proxy/registry shell stays site-internal in `tools/agent/`; the root `.` barrel carries zero producer bytes)
- `packages/agent-ui/a2a/` — `@agent-ui/a2a`, the A2A (Agent2Agent) protocol layer: wire types + validation pinned to spec v0.3.0, the tic-tac-toe arena (isolation-proven agent-vs-agent matches), and its own concept/demo corpus shards; zero deps
- `packages/agent-ui/icons/` — `@agent-ui/icons`, swappable icon-pack adapter (pure core + `./phosphor` subpath; ADR-0065/0066); zero deps
- `packages/agent-ui/app/` — `@agent-ui/app`, app-surface compositions (`ui-super-shell` + presets); depends on components + a2ui + shared
- `packages/agent-ui/router/` — `@agent-ui/router`, a memory-first SPA router with opt-in URL reflection
  (ADR-0115): `createRouter`/`connectUrl` core (zero DOM dependency) + `ui-router-outlet`/`ui-router-link`;
  depends only on `@agent-ui/components` + `@agent-ui/shared`; catalog-invisible by construction (never
  imported by `a2ui`)
- `packages/agent-ui/code/` — `@agent-ui/code`, the code+prose family (ADR-0119): a zero-dep core (token
  types + a swappable highlighter registry + a light-DOM projection seam, `.`) plus three opt-in subpath
  packs — `./highlight` (seven hand-rolled tokenizers, self-registering), `./markdown` (`ui-markdown`,
  rendering the agent-common markdown subset into real fleet DOM, sanitized by construction), and `./editor`
  (`ui-code-editor`, the editable-first FACE source editor — the ONE ruled zero-dep exception: it adopts
  CodeMirror 6, declared in `code/package.json` and LAZY-loaded per mount, ADR-0139; the default barrels stay
  CodeMirror-free); depends only on `@agent-ui/components` + `@agent-ui/shared` (+ the CodeMirror runtime deps,
  confined to `./editor`); a sibling branch off `components` alongside `router`, catalog-invisible by
  construction (never imported by `a2ui`)
- `packages/agent-ui/data/` — `@agent-ui/data`, the headless SaaS data layer (ADR-0192): a `DataSource<T>`
  strategy seam whose CRUD verbs are optional capabilities, signal-backed `resource()`/`mutation()`/
  `paginated()`, a structurally-sharing instance-scoped store, and `DataError`/`normalizeError`, all on
  the `.` barrel; `./gateway` (middleware onion, token refresh, retry/backoff, the streaming pass-through
  law) and `./stream` (ONE `Streamed<T> = AsyncIterable<T>` contract + `fromFetchStream`/`fromEventSource`/
  `fromWebSocket`, incl. the hoisted `readNdjsonLines` — `site/lib/ndjson-lines.ts` is now a re-export)
  are opt-in subpaths the `.` barrel never imports; depends only on `@agent-ui/components` +
  `@agent-ui/shared`; a FOURTH sibling branch off `components` alongside `router`/`code`, catalog-invisible
  by construction (never imported by `a2ui`); persistence is deliberately NOT this package's (`@agent-ui/shared`'s
  `StorageAdapter` seam, GH #959)
- `packages/agent-ui/devtools/` — `@agent-ui/devtools`, the chat & A2UI dev/debug harness (ADR-0200): a
  three-backend transport shelf behind the unchanged ADR-0137 `AgentTransport` seam (`replayTransport`/
  `scriptTransport` — deterministic canned timelines, the CI backbone; `proxyTransport` — the existing
  `/__a2ui/agent` dev-proxy mount over HTTP ONLY; `peerTransport` — an A2A peer over `A2aChannel`), backend
  descriptor rows (`listBackends`), the `DevtoolsEvent` NDJSON timeline vocabulary + `recordTurn`, and the
  `DevtoolsCapture` format on the `.` barrel; `./server` (the dev-only `/__devtools` Vite orchestration
  seam, `apply:'serve'`) and `./playwright` (types-only helper — Playwright never a runtime dep) are opt-in
  subpaths the `.` barrel never imports; dependencies exactly `{@agent-ui/a2ui, @agent-ui/a2a}`, zero
  third-party runtime deps — a TOP-TIER consumer above the catalog (`shared ← components ← a2ui ← {app,
  devtools}`, plus `a2a ← devtools`), never imported by anything below it; no key, provider adapter, or
  `produce()` ever enters this package (the ADR-0073 trust boundary stays at `/__a2ui/agent`); the harness
  PAGE itself stays site-internal (`site/pages/devtools-harness.*`, the ADR-0137 placement law)
- `.claude/docs/` — plan, goals, process, references, adr, prd, spec, lld, decompositions, tickets, rubrics, archive (agent-scoped project docs; the doc grammar + status law: `.claude/skills/doc-standards/`) · `*.test.ts` co-located with source. `tickets/` is a FROZEN historical archive (98 files through TKT-0096) — new work items route to GitHub Issues instead (ADR-0145; the full label/status/Findings mapping lives in `.claude/skills/doc-standards/`, the canonical home — GH #761 trimmed the copy that used to sit here). The decision/contract tiers (ADR/PRD/SPEC/LLD) and living-state docs (PLAN/ROADMAP) stay files on this map, always; only the TICKET tier moved.

## Conventions (non-obvious only)

- tsconfig is strict in load-bearing ways: `erasableSyntaxOnly` bans `enum`/`namespace`/decorators
  (use `as const` objects + literal unions, and `declare`-merged accessors instead of decorators);
  `verbatimModuleSyntax` ⇒ `import type` for type-only imports; `allowImportingTsExtensions` ⇒ keep
  the explicit `.ts` on local imports.
- Vite 8 is Rolldown-based (not esbuild/Rollup) — bundler/plugin behaviour follows Rolldown-Vite.
- Imports point inward only: layers `reactive` ← `dom` ← `traits`/`controls`; cross-package the DAG is
  `shared` ← `components` ← `a2ui` ← {`app`, `devtools`} — `devtools` is the SECOND top-tier consumer
  (ADR-0200), depending exactly on `a2ui` + `a2a` (`a2a` ← `devtools`); `app` and `devtools` are PEERS
  (neither imports the other), and nothing — incl. `a2ui`, `a2a`, `components` — ever imports `devtools` —
  with `router`, `code` AND `data` as sibling branches off
  `components` (`shared` ← `components` ← {`router`, `code`, `data`}) — none of `router`/`code`/`data`
  imports `a2ui`; `a2ui` never imports any of them, and `app` may import `code` (the editor surface,
  ADR-0139) but never `router` (catalog-invisible by construction, ADR-0115) — `data` is unconsumed by
  `app` at v1 but, unlike `router`, not permanently fenced off from it (ADR-0192 clause 1 leaves the
  door open) (`icons`/`a2a` import nothing). Nothing imports upward. (Enforced by the per-package
  `layering.test.ts` trip-wires.)
- Naming: tags `ui-{name}`, classes `UI{Name}Element`, tokens `--ui-{name}-*` / color roles
  `--md-sys-color-{family}-{role}` / type scale `--md-sys-typescale-{role}-{size}-*` (ADR-0078);
  event names ∈ `change · input · select · open · close · toggle · action` (the seventh member,
  GH #147/ADR-0153 — `ui-status-stream`'s inline retry affordance).
- Components are light-DOM by default; ARIA via `ElementInternals`, never host attributes; no native form elements.
- Props are typed signals via `static props` + `ReactiveProps<typeof props>` (plan §5).

## Always

- Run `npm run check && npm test` green before treating a change as done — judge gates by EXIT CODES,
  never by grepping output (a piped grep-count masked a red `check` and an OOM'd browser run, 2026-07-19).
- Worktree gate trap: `component-testing`'s Traps section.
