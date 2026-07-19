# ADR-0139 — CodeMirror 6 becomes agent-ui's first genuine third-party runtime dependency: a lazy-loaded `./editor` subpath on `@agent-ui/code` (`ui-code-editor`, FACE, editable-first fallback); `ui-agent-admin`'s entry editors gain markdown-highlighted source editing; every default barrel stays CodeMirror-free

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-17
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-17 |
> | **Proposed by** | design seat ([TKT-0090](../tickets/tkt-0090-codemirror-editable-markdown-prompts.md) intake — Kim's explicitly ratified DIRECTION, 2026-07-17: adopt CodeMirror 6 deliberately as the first exception to the zero-dependency pillar; this record turns that direction into a decision + forks, never a build) |
> | **Ratified by** | Kim, 2026-07-17 (the Status cell flipped to `accepted` by Kim's own edit — F1–F5 adopted as the firm recommendations state, per this repo's Status-flip-is-ratification precedent, [ADR-0138](./0138-a2ui-producer-persona-seam.md)) |
> | **Repairs** | on ratification+build: [TKT-0090](../tickets/tkt-0090-codemirror-editable-markdown-prompts.md) (the owning ticket) · [`code-prose-family.prd.md`](../prd/code-prose-family.prd.md) §3 (the *"Editing … input-class explosion; this family is display-class throughout"* fence gains a versioned amendment naming the `./editor` opt-in surface — the PRD's accepted body is append-only-amended, never rewritten) · `CLAUDE.md` line 5 pillar wording + the Layout `code/` bullet + the Conventions DAG row (clause 7's exact text) · `packages/agent-ui/code/package.json` (gains the CodeMirror deps + the `"./editor"` export — gated on ratification, the [ADR-0062](./0062-corpus-packaging-pure-core-subpath-data-home.md)/[ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md) wording precedent) · `scripts/measure-size.mjs` (the clause-8 line-items) · the per-package `layering.test.ts` trip-wires (the `app ← code` edge, clause 3) · `app/src/controls/agent-admin/entry-list.ts` (both `ui-textarea` content call sites, clause 6) |
> | **Supersedes / Superseded by** | (none) — **Extends [ADR-0119](./0119-code-prose-family-v1-scope.md)** (the pack geometry, identity/tree-shake gates, and package home all followed; its hand-rolled-only law is deliberately breached for the *editable* surface only, via this append-only extension record — the display packs stay hand-rolled) · Relates [ADR-0107](./0107-chart-family-v1-scope.md) (the "runtime dependency in costume" law — answered head-on, not dodged: this is declared adoption, never vendoring) · [ADR-0066](./0066-phosphor-default-pack-buildtime-vendoring.md) (inert-data vendoring — inapplicable here, stated in Context) · [ADR-0069](./0069-a2ui-live-agent-demo-shape.md) / [ADR-0073](./0073-a2ui-live-model-provider-seam.md) (the SDK-free plain-fetch posture — inapplicable here, stated in Context) · [ADR-0113](./0113-content-family-v1-scope.md) (`ui-code` display stays verbatim + zero-dep, untouched) · [ADR-0134](./0134-multiline-textarea-face-editor.md) (`ui-textarea` — the FACE + multi-line-geometry precedent the wrapper follows; it remains the fleet's plain long-form primitive) · [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md) / [ADR-0135](./0135-agent-harness-config-schema-and-prompt-files.md) (the entry-kind architecture + markdown-composed prompt model this serves) · **Amended by [ADR-0147](./0147-code-editor-richtext-live-preview-mode.md)** (lifts this record's "explicit non-goal: live-preview/WYSIWYG markdown" clause, narrowly, for `ui-code-editor` only — every other clause here stands and binds) |

## Context

Kim's seed (TKT-0090) and his explicit clarifying-round ratification: adopt CodeMirror 6
deliberately, so `ui-agent-admin`'s prompt editing becomes real editable, markdown-syntax-highlighted
source editing instead of today's plain `ui-textarea`. This is the first genuine exception to the
zero-dependency pillar (`CLAUDE.md:5`) in the repo's history, and the ticket's own acceptance demands
this record name the precedents it breaks rather than landing the dependency inside a build.

**Today's gap, grounded.** Every per-entry content editor in `ui-agent-admin` is a plain
`<ui-textarea>` — `entry-list.ts:104` (the add-form's draft field) and `entry-list.ts:215` (the
per-entry saved-content field), one shared module reused verbatim by all five entry-kind
instantiations (ADR-0132 cl.1: *"no kind gets its own bespoke list/toggle/author code"*). Yet the
content those editors hold **is markdown by construction**: `composeSystemPrompt` renders each
enabled section as `## {label}\n{content}` and the live prompt renders capability entries as
`### {label}` blocks (`entries.ts:112-119,129-142`) — the user is hand-authoring markdown into an
editor that shows none of its structure.

**A scope-wording correction, grounded against the code.** Kim's literal wording named "Instructions
and Agent settings." On the page those are the two *panes*: the Instructions pane hosts the ONE
`kind: "prompt-section"` entry list (`agent-admin.ts:237` — heading "Instructions"; seeded
Foundation/Personality/Critical Items), and the Agent-settings pane hosts `ui-settings` plus the FOUR
capability-kind entry lists (skills/workflows/resources/tools — the `CAPABILITY_KINDS` loop).
TKT-0090's finding-4 shorthand ("Instructions, Agent settings … `kind: 'prompt-section'`") is
therefore imprecise: only Instructions is prompt-section; the pane-literal reading of Kim's words
covers **all five kinds**, and all five share one editor module. Fork F3 rules this explicitly.

**The precedent wall this decision must answer.** Every prior "we want capability X" intake resolved
against a third-party runtime dependency, each for a stated reason:

- **[ADR-0107](./0107-chart-family-v1-scope.md)** (charts): *"a chart library is runtime code —
  vendoring it is a runtime dependency in costume"*; every mark hand-rolled.
- **[ADR-0119](./0119-code-prose-family-v1-scope.md)** (highlight/markdown/diff): *"the icons
  precedent does NOT license vendoring a highlighter … the packs must be hand-rolled and deliberately
  small"* — explicitly rejecting "Vendor highlight.js / marked / diff." Its own PRD fences further:
  *"Editing (a code editor, editable markdown) — input-class explosion; this family is display-class
  throughout"* (`code-prose-family.prd.md` §3).
- **[ADR-0066](./0066-phosphor-default-pack-buildtime-vendoring.md)** (icons): vendoring passed
  ONLY because icon packs are **inert data** compiled to committed TS — explicitly *not* a
  runtime-dependency precedent.
- **[ADR-0069](./0069-a2ui-live-agent-demo-shape.md) / [ADR-0073](./0073-a2ui-live-model-provider-seam.md)**
  (live model calls): *"plain `fetch` … no LLM SDK, no new dependency anywhere"* — the capability was
  a wire protocol, so an SDK was avoidable by speaking the wire directly.

**Why those four answers run out here.** Each prior decline had a cheaper honest substitute: inert
data (0066), a small hand-rolled renderer (0107, 0119 — display-class: input → DOM, no interaction
state), or speaking the wire protocol directly (0069/0073). A source **editor** has none of these. It
is an interactive text-editing *runtime* — a document model with transactions, undo history,
selection/IME handling, viewport virtualization, and incremental re-parsing for
highlight-while-typing. The repo has walked to the edge of this cliff once already: `ui-textarea`
(ADR-0134) is the hand-rolled plain editor, and extending it with syntax highlighting means live
tokenization *inside* a contenteditable under composition/caret constraints — the exact category
where hand-rolled cost explodes without bound. ADR-0119's PRD fence named "editing" as
"input-class explosion" precisely because the hand-rolled-small law stops paying there; this intake
is the fence's foreseen crossing, taken deliberately, not an erosion of the display-class law (which
stands: `./highlight`'s seven tokenizers and `ui-markdown` remain hand-rolled and untouched).

**The proven integration shape (gen-ui-kit, read-verified).** `@adia-ai/web-components` integrates
CodeMirror 6 as raw `@codemirror/*` primitives — no `codemirror` meta-package, no React binding.
Hard deps: `@codemirror/{state,view,commands,language,lint}` + `@lezer/highlight`;
six language packs (css/html/javascript/json/markdown/yaml) as `optionalDependencies` — 11
`@codemirror/*` + 1 `@lezer/*` packages (`package.json` dependencies/optionalDependencies,
verified). The wrapper is ONE vanilla FACE custom element (`code.class.js`'s `UICode`,
`static formAssociated = true`) whose module graph carries **zero static CodeMirror imports** — the
entire CM runtime lives behind `import('./code-editor.js')` per mount, with per-language dynamic
imports code-split into lazy chunks and a 10 s load-timeout ceiling; a static `<pre><code>` fallback
survives load failure. `[editable]` vs read-only is one `Compartment`-driven reconfiguration.
Markdown there is **syntax-highlighted plain-text editing only** — rendered/live markdown is a
separate hand-rolled component (`<richtext-ui>`, `core/markdown.js`), which is the precedent for this
ADR's own live-preview non-goal.

**The DAG constraint this decision must rule.** `@agent-ui/code` is a sibling branch off
`components`, and ADR-0119 cl.1 declares *"`a2ui`/`app` never import it."* But the consumer of the
new editor is `ui-agent-admin` — which lives in `@agent-ui/app`. Either the editor lives in `app`
(and `app` becomes the dependency carrier), or the `app ← code` edge opens. Clause 3 rules this.

## Decision

**We will adopt CodeMirror 6 — raw `@codemirror/*` primitives, declared openly as the repo's first
third-party runtime dependency — confined to a new opt-in `./editor` subpath on `@agent-ui/code`
exporting one general-purpose FACE control, `ui-code-editor`, lazy-loading the CM runtime per mount
on the gen-ui-kit-proven shape; `ui-agent-admin`'s five entry-list content editors migrate to it with
`language="markdown"`; every default barrel stays CodeMirror-free and byte-identical for
non-adopters, and the zero-dependency pillar wording in CLAUDE.md is amended honestly.** Realized in
eight clauses; SPEC/LLD own mechanisms at the build wave.

1. **The dependency, declared and bounded.** CodeMirror 6 as raw primitives (never the `codemirror`
   meta-package, never a framework binding). Declared ONLY in `packages/agent-ui/code/package.json`:
   hard deps `@codemirror/state` · `@codemirror/view` · `@codemirror/commands` ·
   `@codemirror/language` + `@lezer/highlight`; language packs as `optionalDependencies`, **v1 =
   `@codemirror/lang-markdown` only** (the ratified need; the per-language lazy-load map makes each
   later language a map row + an optionalDependency, the gen-ui-kit shape). `@codemirror/lint` is NOT
   adopted in v1 (gen-ui-kit uses it for JSON linting — no v1 consumer here; a foreseen extension).
   No other package in the repo may declare any `@codemirror/*`/`@lezer/*` dependency.

2. **Why THIS capability earns the exception the five precedents declined.** (a) *Category*: every
   prior decline concerned display of static content, where hand-rolled-small is real (0107's marks,
   0119's tokenizers, 0113's verbatim `ui-code`) or the mass is inert data (0066); an editor is an
   interactive editing runtime whose hand-rolled equal is a multi-year project and whose hand-rolled
   unequal already exists (`ui-textarea`). (b) *The prior alternatives are exhausted*: inert-data
   vendoring inapplicable (CM is code); vendoring-as-code is "a dependency in costume" (0107) — open
   adoption is the MORE honest form of the same bytes; plain-fetch/SDK-free inapplicable (there is no
   wire protocol — the capability IS the runtime); seam-only makes the capability theoretical when
   this repo's own app is the consumer (the 0119 peer-adapter rejection, same logic). (c) *The
   pillar's operational content survives*: no consumer pays for what it doesn't import, the default
   graph stays sovereign, the exception is opt-in, lazy, identity-gated (clause 8) — only the
   absolute claim "zero dependencies anywhere" is amended, in the open (clause 7). (d) *Process*: a
   pillar exception is Kim's call alone; this one arrives as a proposed ADR naming its precedents,
   exactly as TKT-0090's acceptance demands.

3. **Home + DAG: `./editor` on `@agent-ui/code`; the `app ← code` edge opens; catalog invisibility
   is untouched.** The subpath joins `.` / `./highlight` / `./markdown` on the ADR-0065/0119
   pure-core + opt-in-subpath geometry. The DAG amendment: `@agent-ui/app` MAY now import
   `@agent-ui/code` (it already sits below `app` in the tree; imports still point inward only).
   What does NOT change: `a2ui` never imports `code` (the default catalog stays zero-dep — the
   load-bearing half of ADR-0115/0119's "catalog-invisible by construction"), and `code` never
   imports `a2ui`/`app`. The per-package `layering.test.ts` trip-wires encode the new edge and keep
   the two standing prohibitions.

4. **The element: `ui-code-editor` — one general-purpose exported FACE control.**
   `class UICodeEditorElement extends UIFormElement`, its own `code/src/editor/` home, self-defines
   on import (fleet idiom). Contract at the ADR altitude (SPEC owns exact types): props `value` ·
   `language` (v1: `markdown`; unknown/absent ⇒ plain, no highlight) · `placeholder` · `rows`
   (min-height, ADR-0134's multi-line law — `rows × line-box + padding` as a growable minimum, NOT
   the single-line `(scale × size) → §1-row` lookup) · `required`/`disabled`/`readonly` + the
   ADR-0051 field-labelling seam. Events: the closed six — `input` on document change, **`change` on
   blur-with-change** (gen-ui-kit's focus-snapshot diff and `ui-textarea`'s commit timing agree here;
   `entry-list.ts`'s commit-on-`change` wiring is a drop-in). FACE via `ElementInternals`
   (`formValue`/validity/`formReset`/`formStateRestore` — the ADR-0134 lineage; CM's own
   contenteditable is an internal part, ARIA via internals, never host attributes). Theming:
   CM's `EditorView.theme()` stays structural-only; every color rides class-based highlight tokens →
   `--ui-code-editor-*` roles fed by the existing `--ui-code-token-*`/`--md-sys-color-*` ladders in
   the component's own CSS (the gen-ui-kit `code.css` split + fleet token law). A `{name}.md`
   descriptor ships (fleet DoD); **no catalog row** — the element lives outside
   `@agent-ui/components`, so the SPEC-N2 fleet gate owes nothing (the ADR-0119 cl.7 scoping,
   re-verified at build).

5. **Editable-first fallback — never read-only.** The element renders a plain, working editable
   surface (the ADR-0134 contenteditable pattern) immediately; the CM runtime **progressively
   enhances** it on successful lazy load (10 s ceiling, the gen-ui-kit precedent). Load failure —
   or any environment where CM cannot mount — leaves a fully functional plain editor, only the
   highlighting is lost. This inverts gen-ui-kit's static `<pre><code>` fallback deliberately: their
   element is display-first with editing bolted on; ours is an *editor* whose consumers (prompt
   fields) must never lose input capability. It also keeps CI deterministic: jsdom legs exercise the
   plain surface + FACE contract with no CM; the CM mount, highlight, and enhancement handoff are
   browser legs (both engines, per the control-wave law).

6. **The `ui-agent-admin` migration: all five kinds, one shared module.** Both `entry-list.ts`
   content call sites — the per-entry editor (`:215`) and the add-form draft field (`:104`) — swap
   `ui-textarea` → `ui-code-editor` with `language="markdown"`, preserving the `data-part` hooks,
   `.value` get/set, `rows`, and the commit-on-`change` timing byte-for-byte (clause 4 makes this a
   type-and-tag swap; the `selectToEnd()` mid-edit preservation seam carries over as a contract
   obligation on the new element). Because the module is shared verbatim (ADR-0132 cl.1), this
   reaches all five entry kinds — which fork F3 recommends as the correct scope on the merits, not
   just as a side effect: all five kinds' content composes into the SAME markdown system prompt
   (`entries.ts` — `##`/`###` blocks). The add-form's single-line `ui-text-field` label/description
   fields are untouched. `ui-textarea` itself stays shipped and unchanged — the fleet's plain
   long-form primitive for non-code prose.

7. **The pillar wording amendment (exact text).** `CLAUDE.md` line 5's *"a zero-dependency,
   signals-based web-component library"* becomes: **"a zero-dependency, signals-based web-component
   library (one ruled exception: the opt-in `@agent-ui/code/editor` surface adopts CodeMirror 6,
   lazy-loaded — ADR-0139; every default barrel stays dependency-free)"**. The Layout `code/` bullet
   gains the `./editor` subpath + the dependency note; the Conventions DAG row becomes: sibling
   branches `shared ← components ← {router, code}`, `a2ui` never imports either, **`app` may import
   `code` (the editor surface, ADR-0139)** but never `router`. All three edits land at
   ratification+build (Repairs).

8. **The gates that keep the exception honest.** (a) *Identity*: the default root barrels —
   `@agent-ui/components`, `@agent-ui/app`, `@agent-ui/code` (`.`, `./highlight`, `./markdown`) —
   remain CodeMirror-free and byte-identical for any consumer not importing `./editor` (extending
   the existing `identity.test.ts` discipline). (b) *Confinement trip-wire*: a standing grep gate —
   no static `@codemirror/*`/`@lezer/*` import exists outside `code/src/editor/`, and inside it only
   the designated lazy integration module reaches CM (the gen-ui-kit single-module shape: the
   element's own module graph stays CM-free; the runtime arrives via dynamic `import()` only).
   (c) *Size*: `measure-size.mjs` gains line-items — the `./editor` wrapper's own solo figure
   (CM-free by (b), with its own budget) and the lazy CM chunk set as a measured, informational
   line-item baselined at the build wave against gen-ui-kit's own measured footprint; CM bytes never
   enter any main-graph budget. (d) *Dependency hygiene*: the lockfile pins land with the build wave;
   CM version bumps are ordinary dependency PRs gated by `check`/`test`/`test:browser` — the repo's
   first upstream release train, named as a consequence, not hidden.

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection)

- **F1 — package/subpath shape.** *Recommend: a new `./editor` subpath on `@agent-ui/code`*
  (clause 3). The named alternative — a wholly separate sibling package (`@agent-ui/editor`) — loses:
  it widens the layering trip-wire allowlist by a whole node (the deliberate ADR-0065-cited cost
  ADR-0107 cl.7 declined for less), duplicates the code family's token/highlight plumbing home, and
  buys no isolation the subpath doesn't already give (subpath opt-in + identity gates are the same
  mechanism that keeps `./highlight` honest). `@agent-ui/code` is already the code+prose home and
  already carries the family's `measure-size` line-item section.

- **F2 — the element's public contract.** *Recommend: a general-purpose exported FACE control,
  `ui-code-editor`, in `./editor`* (clause 4). The alternative — scope it to `agent-admin`'s internal
  composition inside `@agent-ui/app` — loses: it makes the *composition* package the repo's first
  third-party dependency carrier (inverting the primitives-vs-composition layering), keeps the DAG
  row cosmetically intact while hiding the real new edge, and forecloses every other consumer of a
  capability that is generic by nature (any editable highlighted source). *Naming sliver:*
  `ui-code-editor` (recommended — it IS the editor counterpart to shipped `ui-code`); Kim may prefer
  `ui-editor` or `ui-source-editor` at ratification; geometry unchanged either way.

- **F3 — which entry kinds get the editor.** *Recommend: all five (prompt-sections + skills/
  workflows/resources/tools), via the one shared entry-list module* (clause 6). Kim's literal wording
  named the two panes, which already span all five kinds (Context's grounding correction). The
  alternative — prompt-section only — loses: it requires kind-conditional editor divergence inside
  the module ADR-0132 cl.1 keeps deliberately uniform, and it leaves four editors plain whose content
  feeds the *same* markdown-composed prompt (`### {label}` blocks) — an inconsistency with no
  offsetting saving, since the editor cost is per-module, not per-kind.

- **F4 — the exact pillar wording.** *Recommend the clause-7 sentence* (parenthetical exception,
  named ADR, "every default barrel stays dependency-free" as the operative guarantee). The
  alternative — a softer "zero-dependency core" rephrase — loses: it silently reclassifies the whole
  claim instead of recording one ruled exception, making the next exception cheaper; the pillar
  should stay absolute-with-a-named-exception, so every future breach costs another ADR.

- **F5 — the packaging/isolation gate set.** *Recommend clause 8 in full* (identity + confinement
  grep + size line-items + lockfile discipline; lazy chunks, never bundled). The alternative —
  bundling CM statically into the `./editor` entry (simpler build, no chunk loading) — loses: every
  `./editor` importer would carry the full CM mass in its main graph even when no editor mounts,
  the size line-item becomes a main-bundle tax, and the gen-ui-kit-proven per-mount lazy shape
  (the exact shape TKT-0090's acceptance names) is abandoned for build convenience.

**Explicit non-goal: live-preview/WYSIWYG markdown.** This ADR ships syntax-highlighted **source**
editing only — the same split gen-ui-kit itself proves (CodeMirror for highlighted source; rendered
markdown is a separate component there). If rendered-preview is wanted later, the fleet's own
`ui-markdown` (ADR-0119, read-only) is the natural composing partner — a future intake composes the
two; nothing here designs that composition.

## Consequences

- **The repo joins an upstream release train for the first time.** CM/Lezer versioning, security
  advisories, and breaking-change absorption are now real, recurring costs owned by this repo —
  bounded to one package's dependency block and gated by the standing suites, but permanent. This is
  the honest price the five precedents refused; it is being paid knowingly, for a capability with no
  hand-rolled substitute.
- **The zero-dep pillar becomes "zero-dep with one ruled exception."** Clause 2 is the measuring
  stick for every future "just add a dependency" ask: display-class capability ⇒ the ADR-0119
  hand-rolled law still governs; only a capability whose hand-rolled equal is economically
  unreachable AND whose prior alternatives (inert data, wire-speaking, seam-only) are all
  demonstrably inapplicable can even reach a fork, and only Kim can rule it.
- **jsdom is blind to the CM path** — the enhancement handoff, highlight rendering, undo/IME, and
  the fallback-to-CM value continuity are browser-leg obligations (both engines), per clause 5. The
  deterministic CI story survives BECAUSE the fallback surface is the jsdom-testable contract.
- **`ui-textarea` keeps its role** — plain long-form prose entry fleet-wide; `entry-list.ts` was its
  flagship consumer and migrates, which is expected churn for ADR-0134's own precedent (it migrated
  the same call sites once before, native `<textarea>` → `ui-textarea`).
- **The `./editor` wrapper is a new FACE control outside `@agent-ui/components`** — the first
  form-associated element outside the core package. The fleet DoD (descriptor, probes, states,
  forced-colors, reduced-motion) applies unchanged; the catalog does not (clause 4).
- **Stale → re-verify at the build wave:** CLAUDE.md's three edits (clause 7) · the PRD §3
  amendment · ADR-0113's "language is inert" site prose (unchanged for `ui-code` — verify no page
  conflates the two elements) · `measure-size.mjs` §code line-items · the layering trip-wire matrix ·
  TKT-0090 Findings + close-out.

## Acceptance

This is an **intake** ADR — realized in two stages:

- **Intake (this change):** this record passes the ADR gates (`site/lib/adr.test.ts` grammar,
  `docs-grammar.test.ts` link sweep) and is indexed in the README; F1–F5 carry firm recommendations
  awaiting Kim; the ticket gains a dated Finding. **No code changes, no package.json edit, no new
  file under `packages/`.**
- **Build wave (separately dispatched, gated on Kim's ratification):** the `./editor` subpath +
  `ui-code-editor` land with the clause-8 gate set green (identity byte-identical, confinement grep,
  size line-items, lockfile); the clause-5 fallback is jsdom-gated and the CM path browser-gated both
  engines; `entry-list.ts`'s two call sites migrate (clause 6) with the mid-edit
  preservation/`selectToEnd` behavior re-proven; CLAUDE.md + PRD amendments land in the same change;
  `npm run check && npm test` green.

## Alternatives considered

- **Hand-roll the editable-markdown editor (extend `ui-textarea` + the `./highlight` pack).**
  Rejected: highlight-while-typing inside a contenteditable means re-tokenizing and re-painting
  around a live caret under IME/composition constraints — the "input-class explosion"
  ADR-0119's own PRD fence named. The hand-rolled-small law was scoped to display; extending it here
  produces either a broken editor or an unbounded project. The repo's hand-rolled editors
  (`ui-text-field`, `ui-textarea`) stay plain-text precisely because of this line.
- **Vendor CodeMirror at build time (the Phosphor model, ADR-0066).** Rejected: ADR-0107 already
  ruled vendored runtime code "a runtime dependency in costume," and ADR-0119 confirmed the icons
  precedent licenses only the *packaging geometry*, because icon packs are inert data. Vendoring CM
  would be the same bytes with worse honesty (no upstream security patches, a frozen fork, an
  unreviewable committed blob). Open adoption is the truthful form of this decision.
- **Seam-only: export an editor *seam* and let consumers register their own CM (no first-party
  adoption).** Rejected: the ADR-0119 peer-adapter rejection replays exactly — the capability stays
  theoretical, and the very consumer driving this intake (`ui-agent-admin`, in this repo) would have
  to adopt CM anyway, just less visibly. A seam without a first-party engine ships nothing.
- **The transparent-`<textarea>`-over-highlighted-`<pre>` overlay hack.** Rejected: scroll/caret
  sync between two stacked surfaces is notoriously fragile (wrap divergence, IME, zoom, RTL), it
  reuses none of the fleet's contenteditable machinery, and it still requires live tokenization —
  most of the hand-rolled cost with an extra failure mode on top.
- **Monaco (or another editor engine).** Rejected: Monaco is a monolithic bundle with its own
  worker/loader infrastructure and theming system — the opposite of the raw-primitives, lazy,
  tree-shakeable shape this repo needs; CM6 is modular, framework-agnostic, and already proven in the
  sibling gen-ui-kit codebase this ticket's research verified line-by-line.
- **A wholly separate `@agent-ui/editor` sibling package.** Rejected as the default (fork F1): a new
  DAG node + trip-wire widening for no isolation the `./editor` subpath doesn't already provide.
  Re-openable if editor surfaces ever grow their own family (multiple engines, multiple elements).
- **Scope the element inside `@agent-ui/app` (no exported control).** Rejected as the default
  (fork F2): makes the composition package the dependency carrier and forecloses reuse; the DAG edge
  amendment (clause 3) is the smaller, honest change.
- **Do nothing — keep `ui-textarea` for prompt editing.** Rejected: Kim ratified the direction; the
  content being edited is markdown by construction (`composeSystemPrompt`), and the plain editor is
  the named, grounded gap TKT-0090 records.
