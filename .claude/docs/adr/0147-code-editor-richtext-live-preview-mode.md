# ADR-0147 — `ui-code-editor` gains a richtext live-preview mode: the same CodeMirror document, decoration-rendered (Obsidian-style reveal-near-cursor); ADR-0139's live-preview non-goal is lifted, narrowly, with the markdown string staying the ONLY model

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-18
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-18 |
> | **Proposed by** | design seat — from Kim's explicitly ratified DIRECTION, 2026-07-18: two architecture forks were presented with a firm recommendation each and Kim picked the recommendation BOTH times — (1) the richtext mechanism is CodeMirror 6 **decorations over the same `EditorView` document** (never a contenteditable-DOM + serializer, never a third-party rich-text library), and (2) the mode **lives on `ui-code-editor` itself** (a prop + a small built-in toggle, not a wrapper component). Those two forks are DECIDED input to this record, cited as direction throughout; this ADR turns them into a contract + the remaining sub-forks (F1–F5), never a build |
> | **Ratified by** | Kim, 2026-07-18 (the Status cell flipped to `accepted` by Kim's own edit, per the [ADR-0138](./0138-a2ui-producer-persona-seam.md) Status-flip-is-ratification precedent; F1–F5's firm recommendations adopted as stated, no objection raised) |
> | **Repairs** | on ratification+build: `packages/agent-ui/code/src/editor/{editor.ts,editor.css,editor.md,cm-editor.ts}` (+ NEW `cm-richtext.ts`) · `editor/confinement.test.ts` (the designated-module allowlist becomes the lazy PAIR, clause 7) · `editor/{editor,editor.browser}.test.ts` (the clause-8 legs) · `scripts/measure-size.mjs` (the lazy CM chunk line-item re-measured — decoration bytes are lazy-chunk-only) · [ADR-0139](./0139-codemirror-editor-first-runtime-dependency.md)'s `Supersedes / Superseded by` cell gains `Amended by ADR-0147` (a REV-annotated mechanical pointer repair to the accepted body — the body's prose is never edited) · [`../prd/code-prose-family.prd.md`](../prd/code-prose-family.prd.md) header amendment block gains a v1.2 pointer line (the §3 fence-crossing now includes a rendered VIEW of the same source — still editing, still never the display family's territory; `ui-markdown` untouched) · LLD: [`../lld/code-editor-richtext.lld.md`](../lld/code-editor-richtext.lld.md) |
> | **Supersedes / Superseded by** | (none) — **Amends [ADR-0139](./0139-codemirror-editor-first-runtime-dependency.md)**: its explicit *"non-goal: live-preview/WYSIWYG markdown"* clause is lifted for `ui-code-editor` ONLY, via this append-only amendment record (the ADR-0139-amending-ADR-0119 citation shape); every OTHER ADR-0139 clause — dependency bounds (cl.1), the `./editor` confinement geometry (cl.3/cl.8), editable-first (cl.5), the FACE/event contract (cl.4) — stands and BINDS this work · Relates [ADR-0119](./0119-code-prose-family-v1-scope.md) (`ui-markdown` stays read-only, hand-rolled, untouched — deliberately NOT the composing partner ADR-0139's non-goal paragraph foresaw; Context rules that route out) · [ADR-0134](./0134-multiline-textarea-face-editor.md) (the blur-with-change commit timing this mode must not disturb) |

## Context

**The clause being amended, verbatim.** ADR-0139 closed its Decision with: *"**Explicit non-goal:
live-preview/WYSIWYG markdown.** This ADR ships syntax-highlighted **source** editing only — the same
split gen-ui-kit itself proves (CodeMirror for highlighted source; rendered markdown is a separate
component there). If rendered-preview is wanted later, the fleet's own `ui-markdown` (ADR-0119,
read-only) is the natural composing partner — a future intake composes the two; nothing here designs
that composition."* This record is that foreseen future intake — but it deliberately does NOT take
the composition route the paragraph predicted, and must say why.

**Why the foreseen `ui-markdown`-composition route loses.** Composing the editor with the read-only
`ui-markdown` yields a **split source+preview pane** — exactly the architecture gen-ui-kit's own
unbuilt SPEC-104 ("Markdown editor with preview", status *Not started*, read-verified) designed for
this same problem: an editable CodeMirror pane beside a read-only rendered pane with proportional
scroll-sync. That shape is honest but it is not the ask: the rendered surface is never *editable*,
the user context-switches between two representations, and scroll-sync between independently-wrapped
panes is a standing fragility class. Kim's ratified direction is a **merged** surface — the rendered
view IS the editing surface.

**Why the merged-contenteditable route was never on the table.** The classic merged WYSIWYG shape —
render markdown to DOM, let the user edit the DOM, serialize the DOM back to markdown — carries a
round-trip-loss hazard that Adia's own design record names as its First Principle #2 (SPEC-104:
*"Form value is the raw source, not the rendered HTML… persisting rendered HTML produces lossy
round-trips"*). Read-verified across gen-ui-kit: `<richtext-ui>` is display-only by construction
(`static template = () => null`, `innerHTML = renderMarkdown(...)`; its own `.d.ts` says *"Not a
Markdown editor"*), editing capability was never attempted in its history, and the two specs that ARE
merged editable surfaces (SPEC-130/132) use a block-JSON tree as the model — a different, inapplicable
architecture. Nobody at Adia has ever shipped a markdown-source-of-truth merged editor; their design
work treats DOM-parse-then-reserialize as risky enough to avoid entirely.

**The route Kim ratified sidesteps the hazard instead of managing it.** CodeMirror 6 "live preview"
(the Obsidian-style UX): the richtext view stays the **exact same `EditorView` and the exact same
document** as source mode. A decoration/widget extension layer styles the constructs (headings large,
bold bold, links styled+activatable, list bullets rendered) and *hides* the raw markup characters
(`##`, `**`, `[…](…)`) — except on the line the cursor occupies, where the raw source reveals for
editing. Decorations are a pure VIEW transform: there is no second DOM tree that gets parsed back,
therefore no markdown↔DOM round-trip step, therefore no round-trip-loss risk *by construction* —
`.value` is the markdown string because the document never stops being the markdown string.

**Zero new dependencies — verified against the tree.** The mechanism needs `Decoration` /
`WidgetType` / `ViewPlugin` (`@codemirror/view`) and `syntaxTree` (`@codemirror/language`) walking the
node tree `@codemirror/lang-markdown` already produces for the shipped `tok-*` highlighting
(`cm-editor.ts`'s `highlightStyle` — the same constructs, the same parse). All three packages are
already declared in `packages/agent-ui/code/package.json` (ADR-0139 cl.1). The gen-ui-kit P0 lesson —
an early release left CM packages undeclared and consumer bundlers broke on the dynamic-import
specifiers — is carried as a standing build gate: this work imports nothing new, and if a later
extension ever does, the same declared-dependency discipline applies before it ships.

**What must not move.** ADR-0139's editable-first law (cl.5): the plain contenteditable fallback is
the jsdom-tested contract and CM is a progressive enhancement — decorations are a CM-only mechanism,
so richtext can only ever exist ON the enhanced surface. The five `ui-agent-admin` call sites
(`entry-list.ts`, `<ui-code-editor language="markdown">`) must keep working byte-unchanged by
default. And the closed event vocabulary, the FACE contract, and the blur-with-change commit timing
(ADR-0134) are untouched in both modes.

## Decision

**`ui-code-editor` grows a second editing mode — `mode="richtext"`, a CodeMirror-decoration live
preview over the same document — with markdown text as the single source of truth in both modes,
a built-in availability-gated mode toggle, and zero new dependencies; ADR-0139's live-preview
non-goal is lifted for this element only.** Realized in eight clauses; the LLD owns mechanisms.

1. **The mode contract.** One new prop: `mode: 'source' | 'richtext'`, default `'source'`,
   reflected (`[mode]` CSS hooks; unknown values behave as `'source'`). `.value` is the markdown
   string in BOTH modes — no rendered-HTML or block-JSON model ever becomes a source of truth, no
   serializer exists anywhere. FACE participation (`formValue`/validity/reset/restore), `input` on
   edit, and `change` on blur-with-change are byte-identical across modes. Default `'source'` is
   what keeps every existing consumer — `entry-list.ts`'s five call sites included — unchanged
   without an edit.

2. **The mechanism: decorations over the same view.** Richtext is one CM extension layer
   (`ViewPlugin` + `Decoration.mark`/`Decoration.line`/`Decoration.replace` + one `WidgetType`),
   compartment-swapped at runtime exactly like the shipped editable/readonly toggle
   (`editableCompartment`, the direct precedent). Toggling mode reconfigures the LIVE view — same
   document, same selection, same undo history; nothing remounts, nothing reparses from DOM.

3. **Reveal-near-cursor.** On the line(s) any selection range touches, the HIDE decorations are
   suppressed — raw markup shows for editing — while the styling stays (the heading line keeps its
   size with its `##` visible). Everywhere else the markup characters are hidden. This is the
   standard live-preview UX and the whole editing story: there is no toolbar, no formatting
   commands in v1 — you edit markdown, near the cursor, always.

4. **The v1 construct set** (mirrors what `cm-editor.ts`'s `highlightStyle` already tags — same
   parse, richer paint): **ATX headings 1–6** (line-level size/weight, `#` marks hidden) ·
   **strong / emphasis** (real weight/style, `**`/`_` hidden) · **inline code** (mono chip,
   backticks hidden) · **links** (styled + underlined, `[`/`](url)` hidden; Cmd/Ctrl+click opens
   `noopener`, plain click places the cursor — editing stays primary) · **unordered-list bullets**
   (`-`/`*`/`+` → a bullet widget; indentation untouched) · **blockquote** (`>` hidden, inset-border
   line styling). **Explicitly OUT of v1:** tables, images, task-list checkboxes as interactive
   widgets, setext headings, horizontal rules, raw HTML — all render as source; **fenced code
   blocks stay verbatim source deliberately** (fences visible, contents keep the existing `tok-*`
   highlight — code inside a markdown doc is source by nature). Each out is a future append, not a
   gap: the decoration walk is per-construct additive.

5. **The built-in toggle.** A control-owned `data-part="mode-toggle"` part (`role="button"`,
   `tabindex="0"`, the fleet's no-native-form-elements law): visible label/icon, `aria-pressed`
   mirroring `mode === 'richtext'`, operable by click, Enter, and Space. A **user-initiated** toggle
   flips `mode` and emits one host-targeted `toggle` (inside the closed six-event vocabulary); a
   **programmatic** `mode` set is silent (the `value`/`input` symmetry). Disabled hosts render no
   operable toggle; readonly hosts keep it (a readonly rendered view is legitimate reading).

6. **The availability law (editable-first untouched).** Richtext requires the CM mount AND the
   markdown language pack (no syntax tree ⇒ nothing to decorate). Wherever CM cannot or does not
   mount — jsdom, load failure/timeout, non-markdown `language` — `mode="richtext"` is **inert**:
   the attribute stands, the plain source surface stays fully editable, the toggle part never
   renders. The affordance appears WITH the capability, which is also why the toggle is built-in
   rather than opt-in chrome (fork F2).

7. **Confinement + size bounds.** Decoration code lives in a NEW `cm-richtext.ts`, statically
   imported ONLY by `cm-editor.ts` — inside the one lazy chunk. The confinement trip-wire's
   designated-module allowlist widens from one file to the lazy pair `{cm-editor.ts, cm-richtext.ts}`;
   its load-bearing invariants are unchanged: `editor.ts`'s graph stays static-CM-free, CM arrives
   via dynamic `import()` only, no static CM import exists anywhere else, and every default barrel
   stays CM-free and byte-identical (ADR-0139 cl.8 gates, all still green). Zero new npm
   dependencies; the lazy-chunk size line-item is re-measured at build.

8. **Accessibility + fleet law.** The hidden markup is removed from the rendered/accessible output
   (a screen reader hears clean prose in richtext, raw source in source mode — each mode's honest
   content); the editor part stays `role="textbox"` with the same accessible name in both modes;
   the mode toggle announces via `aria-pressed` + its visible name and carries the shared focus
   ring. SPEC-C5 holds: no information rides hue alone (weight/style/size survive forced-colors;
   the forced-colors block degrades every `rt-*` color to `CanvasText`). No new motion — the mode
   switch snaps. Every new `[data-part]` display rule carries `:not([hidden])` — the exact guard
   whose absence on `[data-part='editor']` already caused a live duplicate-surface bug in this
   file; the LLD makes it a named build requirement, not folklore.

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection — the TWO architecture forks above are already Kim-ratified and are NOT re-opened here)

- **F1 — prop name/shape.** *Recommend: `mode: 'source' | 'richtext'`, default `'source'`,
  reflected* (clause 1). The alternative — a boolean `richtext` attribute — loses: a third view is
  foreseeable (gen-ui-kit's own spec shelf holds a split-pane design; a future `'split'` would force
  a second boolean and a precedence rule), and an enum names the current state where a boolean names
  only a departure. `mode` over `view`: the fleet has no `view` precedent and CM's own vocabulary
  overloads "view".

- **F2 — toggle affordance policy.** *Recommend: built-in and auto-visible whenever richtext is
  available (CM mounted + markdown pack), no opt-out prop in v1* (clauses 5–6). The alternative —
  an opt-in attribute per consumer — loses: it defeats the ratified point that existing consumers
  gain the capability without an edit (the five `entry-list.ts` call sites would each need touching),
  and "unchanged by default" is already delivered by `mode` defaulting to `'source'` — the toggle is
  additive chrome, not a behavior change. A suppression prop is a cheap later append if a consumer
  materializes.

- **F3 — the v1 construct set.** *Recommend clause 4's set exactly* (headings/strong/emphasis/
  inline-code/links/bullets/blockquote in; tables/images/checkboxes/setext/HR/HTML out; fences
  verbatim). The alternative — chase construct completeness in v1 — loses: every out is an additive
  decoration case later, while interactive widgets (checkbox toggles writing back into the doc,
  table editing) are a genuinely different interaction class that deserves its own record if ever
  wanted.

- **F4 — the mode-change event.** *Recommend: user-initiated toggle emits `toggle`; programmatic
  set is silent* (clause 5). The alternative — no event at all — loses a consumer's ability to
  persist the user's mode preference; the alternative of a NEW event name is barred by the closed
  vocabulary, and `toggle` is its exact semantic row.

- **F5 — readonly interplay.** *Recommend: richtext + the toggle stay available under `readonly`;
  only `disabled` suppresses the toggle* (clause 5). Readonly richtext is a legitimate "read this
  rendered" surface (reveal-near-cursor still works — selection exists under readonly). The
  alternative — source-only when readonly — loses the mode's best passive use for no safety gain
  (the document is unwritable either way).

## Consequences

- **The non-goal inversion is bounded and priced.** What ADR-0139 declined was designing a
  *composition* with `ui-markdown`; what this record adopts is a mechanism ADR-0139 could not
  cite (decorations were not evaluated there). `ui-markdown` remains the fleet's display renderer;
  no display-family law moves; the display packs stay hand-rolled (ADR-0119 intact).
- **`ui-agent-admin` gains live preview for free at ratification+build** — five markdown prompt
  editors grow a rendered mode with zero call-site edits (default source, toggle built-in). Whether
  any of those surfaces should DEFAULT to richtext is a consumer decision for a later pass, not
  this record.
- **The decoration walk is a per-keystroke cost on the enhanced path** — bounded by CM's
  viewport-limited plugin model (`visibleRanges`), but real; the LLD's browser legs must include a
  long-document sanity probe. The plain fallback path pays nothing.
- **The reveal unit is the LINE** — multi-line constructs (a blockquote spanning lines) reveal only
  the cursor's line. This is the standard UX and accepted as v1 behavior, not a defect.
- **Stale → re-verify at build:** `editor.md` prose + descriptor rows · the PRD v1.2 pointer line ·
  ADR-0139's amended-by pointer · the `measure-size` lazy-chunk figure · site docs pages that
  describe `ui-code-editor` as source-only, if any.

## Acceptance

This is an **intake** ADR — realized in two stages:

- **Intake (this change):** this record passes the ADR gates (`site/lib/adr.test.ts` grammar,
  `docs-grammar.test.ts` link sweep) and is indexed in the README; the LLD
  ([`../lld/code-editor-richtext.lld.md`](../lld/code-editor-richtext.lld.md)) and the decomposition
  ([`../decompositions/code-editor-richtext-mode.decomp.json`](../decompositions/code-editor-richtext-mode.decomp.json))
  land with it. **No code changes, no package.json edit, no file under `packages/` touched.**
- **Build wave (separately dispatched, gated on Kim's ratification):** the decomposition's leaves
  n2–n14 land with every accept predicate green — cross-engine browser legs (Chromium + WebKit,
  the `editor.browser.test.ts` pattern extended, never replaced) for hide/reveal/round-trip-identity/
  undo-across-toggle/toggle-a11y/forced-colors; jsdom legs for the inert-fallback + FACE identity;
  the confinement pair-allowlist, identity, and size gates green; `npm run check && npm test` green;
  an independent component-reviewer GO before commit.

## Alternatives considered

- **Compose `ui-markdown` as a preview pane (the route ADR-0139's non-goal paragraph foresaw).**
  Rejected: delivers a split source+preview surface (gen-ui-kit SPEC-104's unbuilt shape), not the
  ratified merged editing surface; adds scroll-sync fragility; the rendered half is never editable.
- **Hand-rolled merged WYSIWYG (render to DOM, edit the DOM, serialize back).** Rejected: the
  round-trip-loss hazard Adia's own First Principle #2 names; never shipped anywhere at Adia;
  ADR-0119's "input-class explosion" fence named this exact cost class. The decoration route makes
  the hazard structurally impossible rather than carefully managed.
- **Adopt a third-party rich-text library (Milkdown / TipTap / ProseMirror).** Rejected: a second
  editing runtime + a second document model beside the one ADR-0139 just adopted, new dependencies
  against ADR-0139 cl.1's "no other package may declare" bound and clause 2's measuring stick —
  the capability is reachable with the ALREADY-ADOPTED runtime's own view primitives at zero new
  dependency cost.
- **A wrapper component (`ui-markdown-editor`) around `ui-code-editor`.** Ruled out by Kim's
  ratified fork 2 — recorded, not re-argued: the mode lives on the element; a wrapper would fork
  the FACE contract and leave the five existing call sites behind.
- **Do nothing.** Rejected: Kim ratified the direction; the content the five admin editors hold is
  markdown by construction and its authors read raw markup today.

## Amendment (2026-07-20 — revealed-line styling reversed, GH #165)

**What clause 3 said.** The reveal-near-cursor clause specified the Obsidian-style pattern: on the
line(s) any selection range touches, "the HIDE decorations are suppressed — raw markup shows for
editing — **while the styling stays** (the heading line keeps its size with its `##` visible)".
`cm-richtext.ts` implemented that faithfully — `hide()` was suppressed on a revealed line while the
styling decoration ran unconditionally — so a revealed `**Festivals**:` rendered visibly BOLD with
the raw `**` marks showing at once (GH #165's screenshots).

**What it now is.** The revealed line shows the **raw source only** — plain, unstyled text with
every markup character visible. The two presentations are strictly either/or, for every v1
construct uniformly: richtext elsewhere is *styled with no marks*; a revealed line is *marks with
no styling*; never both at once. Mechanically, a construct touching a revealed line emits NEITHER
its hide decorations NOR its styling decoration (the same reveal predicate decides both). The
clause's other legs stand unchanged: the reveal unit is still the line, reveal still fires from the
selection, everything off the revealed line(s) keeps the full styled-with-hidden-marks rendering,
and there is still no toolbar — you edit markdown, near the cursor, always.

**Authority.** Kim's explicit ruling on the GH #165 intake, 2026-07-20 — the issue's own
investigation classified the reported both-at-once rendering as a correct implementation of
clause 3 as ratified, conflicting with Kim's expected either/or; Kim ruled the ADR amends, the
either/or wins. Recorded here per this repo's append-only convention for accepted ADRs (the
ADR-0151 amendment precedent): the accepted body above is untouched, the Status cell does not
move, and clause 3's styling-retention sentence is superseded by this section.
