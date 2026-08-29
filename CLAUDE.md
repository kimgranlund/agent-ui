# CLAUDE.md

`agent-ui` is a zero-dependency, signals-based web-component library in strict, modern TypeScript:
signals reactivity · FACE custom elements · tagged-template rendering · traits. Two ruled dependency
exceptions, both opt-in and lazy-loaded, never on a default barrel: CodeMirror 6 on
`@agent-ui/code/editor` (ADR-0139) and pdfjs-dist on the `@agent-ui/app` ingestion seam (ADR-0202).

Plan `.claude/docs/plan.md` · Goals/DoD `.claude/docs/goals.md` · Roadmap `.claude/docs/roadmap.md` ·
Process `.claude/docs/process.md` · Standards `.claude/docs/references/` · `size:big` work runs the
`due-process` four-phase loop before it closes (GH #969).

## Commands

- `npm run check` — the standing gate: `tsc && check:site && check:tools && check:scripts` (all noEmit/test steps)
- `npm test` — Vitest (jsdom), once · `npm run test:watch` — watch
- `npm run test:browser` — the real-engine gate: six sequential vitest shards
  (packages:{components,app,rest} · site · focus-timing · visual) then `test:eval-catalog`
  (boots its own vite + Chromium, gate-verdicts only). Never re-monolith the shards or add a heap
  bump — history + the focus-timing extension rule: `component-testing`.
- `npm run dev` / `npm run build` — the docs site (`site/`) is the app entry · `npm run deploy:docs` — ui.nonoun.io
- `npm run ops:reap-worktrees` / `ops:reap-branches` / `ops:reap-scratch-clones` — gated,
  dry-run-by-default reap scripts (append `-- --execute` to apply) for `.claude/worktrees/`
  entries, local branches, and orphaned `dispatch_envelope.py` scratch-clone dirs, respectively.
- `npm run ops:bootstrap-scratch-clone -- <clone-dir> [--root <path>]` — deterministic per-entry
  `node_modules` symlink bootstrap for a `dispatch_envelope.py` scratch clone (GH #1695); a build
  seat in a scratch clone runs this instead of improvising the `seat-map` recipe by hand.

`check` + `test` must be green before a change is done — judge by EXIT CODES, never by grepping
output (a piped grep-count masked a red check and an OOM'd browser run, 2026-07-19).

## Layout

npm-workspaces monorepo; ten packages under `packages/agent-ui/*`.

- `components/` — the framework. `src/` layers, imports downward only:
  `reactive/` (signals kernel, imports nothing) ← `dom/` (UIElement/UIFormElement, props, template,
  directives) ← `traits/` (`(host, opts) => cleanup`, invoked from `connected()`) ← `controls/`
  (`ui-*` FACE controls, one folder per component, self-define on import).
- `shared/` — tokens (`src/tokens/{tokens,dimensions}.css` → `@agent-ui/shared/tokens.css`), utility
  types, and the `StorageAdapter` persistence seam (ADR-0193) — the DAG-bottom home lower layers
  persist through.
- `a2ui/` — the A2UI protocol layer (renderer/validator/catalog · `./examples` · `./corpus` ·
  `./agent`, the node-first producer toolkit, ADR-0137; the key/dev-proxy shell stays site-internal).
- `a2a/` — Agent2Agent wire types + validation pinned to spec v0.3.0, the tic-tac-toe arena, own
  corpus shards; zero deps.
- `icons/` — swappable icon-pack adapter (pure core + `./phosphor`; ADR-0065/0066); zero deps.
- `app/` — app-surface compositions (`ui-super-shell` + presets).
- `router/` — memory-first SPA router, opt-in URL reflection (ADR-0115).
- `code/` — code+prose family (ADR-0119): zero-dep core + `./highlight` · `./markdown` · `./editor`
  (the CodeMirror exception, ADR-0139).
- `data/` — headless SaaS data layer (ADR-0192): `DataSource<T>` seam, signal-backed
  `resource()/mutation()/paginated()`, + `./gateway` and `./stream` opt-in subpaths; real consumers:
  agent-admin's persona roster, skill-pack shelf, and AgentTeam records via `app`'s source modules
  (ADR-0227 waves 1–2).
- `devtools/` — chat & A2UI dev/debug harness (ADR-0200): the three-backend transport shelf behind
  the ADR-0137 `AgentTransport` seam, `DevtoolsEvent`/`recordTurn`, + `./server` and `./playwright`
  subpaths; no key/provider/`produce()` ever enters it (the ADR-0073 trust boundary stays at
  `/__a2ui/agent`); the harness PAGE stays site-internal.
- `.claude/docs/` — adr, prd, spec, lld, rubrics, references, archive; `*.test.ts` co-located with
  source. Doc grammar + status law: `.claude/skills/doc-standards/`. `tickets/` is FROZEN (ADR-0145)
  — work items are GitHub Issues; ADR/PRD/SPEC/LLD and PLAN/ROADMAP stay files, always.
  backend: B  # doc-writing-rules backend-resolver.md routing-table row, TICKET tier -> gh issue, ADR-0145

## Conventions (non-obvious only)

- tsconfig is strict in load-bearing ways: `erasableSyntaxOnly` bans `enum`/`namespace`/decorators
  (use `as const` objects + literal unions); `verbatimModuleSyntax` ⇒ `import type` for type-only
  imports; `allowImportingTsExtensions` ⇒ keep the explicit `.ts` on local imports.
- Vite 8 is Rolldown-based — bundler/plugin behaviour follows Rolldown-Vite, not esbuild/Rollup.
- Imports point inward only. Cross-package DAG: `shared` ← `components` ← `a2ui` ← {`app`,
  `devtools`}, with `router`/`code`/`data` as sibling branches off `components`, all three
  catalog-invisible (never imported by `a2ui`); `a2a` ← `devtools`; `app` and `devtools` are peers;
  nothing imports `devtools`; `app` may import `code` and `data` (the ADR-0192 cl.1 reserved edge,
  activated by ADR-0227's roster adoption) but never `router`; `icons`/`a2a` import nothing.
  Enforced by the per-package `layering.test.ts` trip-wires — consult those on any edge
  question (ADR-0115/0139/0192/0200/0227).
- Naming: tags `ui-{name}`, classes `UI{Name}Element`, tokens `--ui-{name}-*` / color roles
  `--md-sys-color-{family}-{role}` / type scale `--md-sys-typescale-{role}-{size}-*` (ADR-0078).
  Event names ∈ `change · input · select · open · close · toggle · action` (ADR-0153).
- Components are light-DOM by default; ARIA via `ElementInternals`, never host attributes; no native
  form elements (the last carve-out, ui-table's, retired by the ratified ADR-0163 amendment —
  descriptor-documented internal non-value activation `<button data-part>`s are the one sanctioned
  class).
- Sizing is fill-by-default (ADR-0223, ratified + built): controls are block-level and fill their
  container; the one opt-out is the reflected `inline` boolean (hug). `sizing-gates.test.ts` is
  ENFORCING with an empty DEBT table — a new control ships conformant or reds the gate.
- Props are typed signals via `static props` + `ReactiveProps<typeof props>`.
- Shared/app state follows the ADR-0227 grammar — one signal-backed owner, explicit injection,
  `StorageAdapter` persistence, CSS cascade for presentational axes; the routable how-to (incl. the
  `resource()`/`mutation()` worked example) is `.claude/docs/references/state-and-persistence.md`.
- Agent vocabulary (layers, "harness" disambiguation, glossary, seams) is
  `.claude/docs/references/agent-model.md`; new prose uses its terms (agent config · a2ui producer ·
  devtools capture · skill vocabulary; skill pack vs library pack; Co-pilot, not Author).

## Always

- Gates green by exit code before done (see Commands).
- Worktree traps: symlink-not-install recipe + concurrency ceiling + reap-on-return live in
  `seat-map` §Dispatch laws; the test-side traps in `component-testing` §Traps.
