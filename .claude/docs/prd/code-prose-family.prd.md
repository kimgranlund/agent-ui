# PRD — Code + Prose Component Family (`@agent-ui/code`: highlight · markdown · diff)

> Status: **accepted · v1.2 · Owner: agent-ui** — direction RATIFIED by Kim 2026-07-10 (all ADR-0119 forks answered at the ratification pass; began life as a v0.1 scope intake, 2026-07-10) — authored 2026-07-10 by the design seat
> at the design-system-surfaces intake ([TKT-0007](../tickets/tkt-0007-design-system-surfaces.md)).
>
> **v1.1 amendment (2026-07-17, docs-only — the accepted body below is UNCHANGED, append-only):** the §3
> *"Editing (a code editor, editable markdown) — input-class explosion; this family is display-class
> throughout"* out-of-scope fence is CROSSED, deliberately and narrowly, by the opt-in `./editor` surface
> (`ui-code-editor`) per **[ADR-0139](../adr/0139-codemirror-editor-first-runtime-dependency.md)** — agent-ui's
> first ruled zero-dependency exception, adopting CodeMirror 6 (lazy-loaded, confined to `./editor`) for
> editable markdown SOURCE editing only. The display-class law otherwise STANDS: `./highlight`'s tokenizers and
> `./markdown` remain hand-rolled and zero-dep and untouched, and live-preview/WYSIWYG markdown stays out of
> scope (ADR-0139's explicit non-goal — `ui-markdown` is the future composing partner, a separate intake).
> Kim pre-answered the load-bearing packaging fork at intake (Q4, 2026-07-10): **a swappable pack
> adapter on the `@agent-ui/icons` model — `@agent-ui/code` (new) → pure core + `./highlight` +
> `./markdown` subpaths.** The remaining contract forks await his pass on
> [ADR-0119](../adr/0119-code-prose-family-v1-scope.md). This is an INTAKE, not a build authorization.
> Ratification = doc-review + Kim's fork answers.
>
> **v1.2 amendment (2026-07-18, docs-only — the accepted body below is UNCHANGED, append-only):** the v1.1
> amendment's "live-preview/WYSIWYG markdown stays out of scope" line is narrowed by
> **[ADR-0147](../adr/0147-code-editor-richtext-live-preview-mode.md)** — `ui-code-editor` gains an opt-in
> `mode="richtext"` live-preview (CodeMirror decorations over the SAME document, reveal-near-cursor; markdown
> stays the ONLY model, no serializer, no second document). §3's fence-crossing now includes a RENDERED VIEW
> of the same editable source, still editing, still never the display family's territory: `ui-markdown`
> remains the fleet's hand-rolled, read-only renderer, untouched, and is NOT the composing partner this
> richtext mode uses (ADR-0147's Context names why that route lost). `./highlight`/`./markdown` are
> unaffected.
> Altitude: this document owns **why + what-should-exist**. The scope/contract-direction record is
> [ADR-0119](../adr/0119-code-prose-family-v1-scope.md); SPEC/LLD are authored at the build wave.
> **Sibling-vs-extension ruling:** a **new sibling PRD**, and a *named intake firing*: the
> content-family PRD fenced highlighting out with *"any highlighter is a **new intake**"* (its §3), and
> [ADR-0113](../adr/0113-content-family-v1-scope.md) cl.2 named the exact escape hatch this family
> realizes — *"(b) a future opt-in adapter package outside the zero-dep core — its own intake."*
> `content-family.prd.md` keeps owning the zero-dep leaves (`ui-code` verbatim rendering, the
> `ui-text` hyperlink capability, disclosure); this family owns everything past that fence.
> Grounding: Kim's seed (TKT-0007: *"code viewers"*) + his Q4 pack-adapter answer ·
> [ADR-0113](../adr/0113-content-family-v1-scope.md) (the fence + escape hatches, `language` shipped
> inert, host-as-content) · [ADR-0065](../adr/0065-icon-adapter-swappable-pack-architecture.md)/
> [ADR-0066](../adr/0066-phosphor-default-pack-buildtime-vendoring.md) (the pure-core + subpath pack architecture
> this reuses) · [ADR-0107](../adr/0107-chart-family-v1-scope.md) Alternatives (vendored *runtime
> code* is "a dependency in costume" — the law this family must satisfy, not dodge) · `CLAUDE.md`
> (zero-dep pillar, DAG law).

## 1. Problem

Agents speak in three text shapes the fleet renders dishonestly or not at all:

1. **Highlighted code.** `ui-code` ships deliberately verbatim — `language` is a reflected, **inert**
   prop (ADR-0113 cl.2). That was the right zero-dep call for the core, and the fence explicitly
   deferred the real ask: agent output is code-dense, and unhighlighted walls of code are measurably
   harder to scan. The fence named the adapter-package escape hatch; nobody has built it.
2. **Markdown prose.** Every agent message is markdown by default — headings, lists, emphasis, inline
   code, links, fenced blocks. The conversation/feed surfaces print it as plain text today: literal
   `**bold**` and `# heading` reach the user. There is no markdown rendering anywhere in the fleet
   (grep-verified at intake), and the zero-dep core rightly refuses a parser for the same
   tokenizer-is-runtime-code reason.
3. **Diffs.** The agent-native artifact for code *change* — review, edit proposals, before/after — has
   no presentation: no line-based diff view exists, and composing one from `ui-code` loses the
   add/remove/context semantics AT and color must carry.

**Who has the problem.** (1) *The docs site + the artifact feed* — the grounded internal instances:
agent prose renders flat; the feed's report artifacts print markdown syntax as text. (2) *Models
emitting A2UI payloads* — a model answering "explain this and show the fix" can emit `Code` (verbatim)
and `Text` (plain) but nothing between: no emphasis, no structure, no diff. (3) *App developers* — who
would otherwise import highlight.js/marked/diff — a stack the zero-dep pillar forbids in the core and
that unsanitized markdown turns into an injection surface.

**Why a new package, not new core controls.** The zero-dep pillar is load-bearing for
`@agent-ui/components`: a tokenizer, a markdown grammar, and a diff algorithm are all *runtime code*
(ADR-0107's vendored-library rejection verbatim). Kim's ratified direction resolves the tension the
way the fleet already solved it once for icon mass (ADR-0065): a **pure zero-dep core seam** plus
**opt-in subpath packs** that carry the code mass only for consumers who choose it. The core stays
honest; the capability becomes real.

## 2. Goals & success metrics

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must (flagship) | Agent markdown renders as structure: a markdown control renders the agent-common subset into fleet elements, sanitized by construction |
| **PRD-G2** | must | `ui-code` gains real highlighting through an opt-in pack — the core stays zero-dep and byte-identical for non-adopters |
| **PRD-G3** | should | Diffs present honestly: a line-based diff view with add/remove/context semantics carried to AT, not just color |
| **PRD-G4** | must (cross-cutting) | The package holds every fleet pillar + the DAG law: a sibling branch off `components`, catalog-invisible to the default catalog, size-gated per pack |

**PRD-G1 — Markdown renders as structure (flagship).** A markdown surface renders the agent-common
subset (headings, paragraphs, lists, emphasis/strong, inline code, fenced code → `ui-code`, links →
the ADR-0114 policy, blockquotes) into real fleet DOM — never `innerHTML` of unsanitized input; raw
HTML pass-through is fenced out entirely.
- *Metric*: a conformance corpus of agent-real markdown renders structurally (asserted per block
  type); an injection corpus (`<script>`, event handlers, `javascript:` URLs, raw HTML) renders
  **inert text or is dropped**, asserted.
- *Baseline*: **0** (no markdown rendering in the repo).
- *Target*: the subset renders; the injection corpus is 100 % inert; fenced blocks reach `ui-code`
  (and highlight when the pack is present — the two packs compose).
- *Timeframe*: **M1**.

**PRD-G2 — Highlighting as an opt-in pack.** The `./highlight` subpath registers a highlighter for
the agent-common language set; `ui-code` (unchanged in the core) renders highlighted output when a
highlighter is registered, verbatim otherwise — the ADR-0113 light-DOM escape hatch (a), made
systematic by the seam instead of ad-hoc children.
- *Metric*: with the pack: tokenized rendering for the v1 language set; without: `ui-code` byte-identical
  behavior (the identity gate); tree-shake proof that non-adopters carry 0 pack bytes (the icons
  `zero-runtime-Phosphor` gate pattern).
- *Baseline*: `language` inert (ADR-0113).
- *Target*: pack shipped; identity + tree-shake gates green; per-pack size line-item in `npm run size`.
- *Timeframe*: **M1** (highlight) — it is the fence's named debt.

**PRD-G3 — Diffs present honestly.** A line-based diff view (unified, v1) renders add/remove/context
rows with the semantics announced to AT (per-row "added/removed" — never color-only, the fleet's
non-color-signifier posture) from either a pre-computed structure or two texts.
- *Metric*: a diff renders with per-row semantics announced; the color channel is redundant with a
  textual/structural signifier.
- *Baseline*: **0**.
- *Target*: shipped at **M2** (after the two must-goals prove the package).
- *Timeframe*: **M2**.

**PRD-G4 — Pillars + DAG (cross-cutting).** `@agent-ui/code` enters the DAG as a **sibling branch off
`components`** (`shared ← components ← code`, the router precedent) — never imported by `a2ui` or
`app` (the default catalog stays zero-dep; catalog reachability for `Markdown` is a consumer-tier
catalog extension — the two-tier "stricter overrides" model,
[ADR-0034](../adr/0034-a2ui-server-initiated-function-invocation.md)/`registry.ts`). Strict TS, fleet DoD per control, per-pack size budgets, the
layering trip-wire extended.
- *Metric*: layering trip-wire green with the new node; default catalog unchanged; fleet DoD per
  shipped control.
- *Baseline*: n/a.
- *Target*: all gates green from M1.
- *Timeframe*: continuous.

## 3. Scope

**In scope (v1):**
- The **`@agent-ui/code` package**: a pure core (the highlighter/renderer seams, zero-dep) +
  `./highlight` and `./markdown` subpath packs (Kim's ratified shape).
- **`./markdown`** — the agent-common subset renderer (PRD-G1's block/inline list), rendering into
  fleet elements; sanitized by construction (no raw-HTML lane exists to sanitize).
- **`./highlight`** — hand-rolled, dependency-free tokenizers for the agent-common language set
  (the exact v1 set is ADR-0119 F2), registered through the core seam `ui-code` consumes.
- **M2: the diff view** — unified, line-based, pre-computed-structure-first (ADR-0119 F3).
- Descriptors + fleet DoD for every shipped element; per-pack size line-items.

**Out of scope (v1) — the fence, each with its reason:**
- **Raw HTML pass-through in markdown** — an injection surface with no agent-honest need; markdown
  that needs arbitrary HTML is an app, not a message. Fenced entirely (not sanitized-in — *absent*).
- **Third-party parser/highlighter adoption, including vendoring** (highlight.js, Shiki, marked,
  remark) — vendored runtime code is "a runtime dependency in costume" (ADR-0107) even inside a pack; the
  packs are hand-rolled and small or they do not ship. The core **seam** accepts a consumer-supplied
  highlighter, so apps that want Shiki can adapt it themselves — outside this repo's mass.
- **Full CommonMark/GFM conformance** — the long tail (reference links, HTML blocks, autolink
  edge-cases, tables-v1) is where markdown parsers become frameworks; the subset is chosen by what
  agents actually emit. Extensions are per-need intakes. (GFM tables: ADR-0119 F2 carries the
  in-or-out recommendation.)
- **Side-by-side / intraline / syntax-aware diff** — each multiplies the algorithm and the a11y
  contract; unified line-based serves the agent artifact. Foreseen extensions, named.
- **Editing** (a code editor, editable markdown) — input-class explosion; this family is
  display-class throughout.
- **Default-catalog rows** — the default catalog is zero-dep and `a2ui` never imports this package;
  `Markdown`/`Diff` reachability for agents is a **consumer catalog extension** (two-tier model),
  documented, not defaulted.

## 4. Milestones

| Milestone | Delivers | Gate |
|---|---|---|
| **M0 (this intake)** | This PRD + ADR-0119 (scope + contract forks) — docs only | doc-review + Kim's fork answers; harness gates green |
| **M1** | The package + core seams · `./markdown` (PRD-G1) · `./highlight` (PRD-G2) · identity + tree-shake + injection gates | fleet DoD; layering trip-wire extended green; `ui-code` identity gate; injection corpus 100 % inert |
| **M2** | The diff view (PRD-G3) + consumer-catalog extension docs (PRD-G4) | fleet DoD; per-row semantics probes; size line-items hold |

## 5. Open decisions

Kim pre-answered the packaging fork (the pack-adapter shape + the `@agent-ui/code` home — recorded,
with the naming caveat, in [ADR-0119](../adr/0119-code-prose-family-v1-scope.md) F1). The remaining
forks are owned there with firm recommendations: **F2** the v1 language set + markdown subset (incl.
GFM tables in/out) · **F3** the diff input contract (pre-computed structure vs two-text compute) ·
**F4** the markdown element's home (core package vs `./markdown`-only definition). Mechanisms are
SPEC/LLD business at the build wave.
