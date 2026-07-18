# LLD — `ui-code-editor` richtext live-preview mode (`@agent-ui/code/editor`)

> Status: proposed · v0.1 · 2026-07-18 · Layer: LLD (implementation plan)
> Refines: [ADR-0147](../adr/0147-code-editor-richtext-live-preview-mode.md) (**proposed — NOT self-ratified**; Kim's two pre-ratified architecture forks + F1–F5 resolved-by-recommendation; build dispatch waits on Kim's flip). Composes on: the SHIPPED `./editor` surface ([ADR-0139](../adr/0139-codemirror-editor-first-runtime-dependency.md) build, `code/src/editor/*`) — this LLD extends those files, it never re-derives them.
> Decomposition: [`../decompositions/code-editor-richtext-mode.decomp.json`](../decompositions/code-editor-richtext-mode.decomp.json) (coverage-clean: 12 actions ↔ 12 leaves, bijective; build-order edges are the decomposition's).
> Altitude: owns **how v1 is built** — file map, concrete interfaces, per-component edge handling, test plan. The behavior contract is ADR-0147's (clauses 1–8); acceptance criteria live there + in the decomposition's per-leaf predicates — **no separate SPEC is authored for this change, deliberately**: both architecture forks arrived pre-ratified, the remaining contract is fully stated at ADR altitude, and the `./editor` surface's own build precedent (ADR-0139) went ADR→build with no spec file. A SPEC nobody was unsure about would be manufactured process.

## 1. Component map (LLD-C# → ADR-0147 clause, → decomp node)

| LLD-C | Component | Files | Realizes | Decomp |
|---|---|---|---|---|
| **LLD-C1** | `mode` prop + inert-fallback law | `editor/editor.ts` | cl.1, cl.6 | n2 |
| **LLD-C2** | richtext Compartment seam on the CM handle | `editor/cm-editor.ts` | cl.2 | n3 |
| **LLD-C3** | decoration engine (constructs + reveal + links) | NEW `editor/cm-richtext.ts` | cl.2–cl.4 | n5, n6, n7 |
| **LLD-C4** | mode-toggle part | `editor/editor.ts` | cl.5, cl.8 | n8 |
| **LLD-C5** | `rt-*` styling + tokens + toggle CSS + guards | `editor/editor.css` | cl.4, cl.8 | n9 |
| **LLD-C6** | confinement allowlist pair + descriptor | `editor/confinement.test.ts` · `editor/editor.md` | cl.7 | n10, n11 |
| **LLD-C7** | identity/size gates + test legs + reviewer | `editor/{editor,editor.browser}.test.ts` · `scripts/measure-size.mjs` | cl.7, Acceptance | n12, n13, n14 |

No orphan components (each traces to an ADR clause + a decomp leaf); no decomp leaf without a home row.

## 2. LLD-C1 — the `mode` prop (`editor.ts`)

```ts
// added to the props schema (after `language`):
// v1: 'source' (default) | 'richtext'. Reflects for [mode] CSS hooks. Unknown ⇒ treated as 'source'.
mode: { ...prop.string('source'), reflect: true },
```

- Type surface: `'source' | 'richtext'` as a literal union in prose/descriptor; the prop plumbing is
  `prop.string` (the `language` precedent — `erasableSyntaxOnly` bars an enum; the runtime guard is
  `this.mode === 'richtext'`, everything else IS source behavior, so unknown values degrade safely
  with zero validation code).
- One new effect, mirroring the shipped disabled/readonly→`setEditable` effect shape:

```ts
this.effect(() => {
  const rich = this.mode === 'richtext'
  this.#cm?.setRichtext(rich && this.#cm.richtextAvailable)
  this.#syncModeToggle() // aria-pressed + presence; a no-op before the toggle part exists
})
```

- **Inert-fallback law (ADR-0147 cl.6):** no CM (`#cm === null`) ⇒ the effect's CM call is a no-op
  via optional chaining; the plain surface, FACE hooks, and event wiring are untouched by `mode` on
  every code path. jsdom asserts this by diffing behavior with/without `mode="richtext"`.
- Post-mount sync: `#enhanceWithCodeMirror`'s success path already re-syncs value/editable; it adds
  `richtext` to the `mountCodeMirror` options (captured at mount) AND the effect above re-fires on
  the signal read, so a mode set during the async load window is not lost (the M1a lesson's shape,
  reused).

## 3. LLD-C2 — the handle seam (`cm-editor.ts`)

```ts
export interface CmHandle {
  // …existing members unchanged…
  /** Whether richtext CAN render here — true iff the lang-markdown pack loaded (no tree ⇒ nothing to decorate). */
  richtextAvailable: boolean
  /** Reconfigure the richtext decoration layer at runtime (the setEditable Compartment precedent). */
  setRichtext(on: boolean): void
}
export interface CmOptions {
  // …existing members unchanged…
  richtext: boolean // initial mode, captured at mount (the placeholder/language capture precedent — but LIVE via setRichtext)
}
```

- `const richtextCompartment = new Compartment()` beside `editableCompartment`; initial config
  `richtextCompartment.of(opts.richtext && languageExtension ? richtextExtension() : [])`.
- `setRichtext(on)` → `view.dispatch({ effects: richtextCompartment.reconfigure(on ? richtextExtension() : []) })`.
  Reconfiguration is state-preserving by CM's own contract: same doc, same selection, same history
  — the browser leg asserts undo reaches pre-toggle edits (n3's predicate).
- `richtextExtension` is a static import from `./cm-richtext.ts` — same lazy chunk (see LLD-C6).
- `richtextAvailable = languageExtension !== null`: the optional `@codemirror/lang-markdown` failed
  ⇒ richtext silently unavailable (toggle never renders), highlight-degrade parity with the shipped
  behavior.

## 4. LLD-C3 — the decoration engine (NEW `cm-richtext.ts`)

One exported `richtextExtension(): Extension` returning `[viewPlugin, clickHandler]`.

**The plugin.** `ViewPlugin.fromClass(class { decorations: DecorationSet }, { decorations: v => v.decorations })`;
rebuild in `update()` when `update.docChanged || update.viewportChanged || update.selectionSet`.
Build walks `syntaxTree(view.state).iterate({ from, to })` over `view.visibleRanges` into a
`RangeSetBuilder<Decoration>` (viewport-bounded — the per-keystroke cost stays O(visible), the
ADR's Consequences bullet).

**Reveal set first.** Before the walk, compute the revealed line range set: for every selection
range, every line from `doc.lineAt(range.from).number` through `doc.lineAt(range.to).number`.
During the walk, any **hide** decoration whose range intersects a revealed line is skipped;
**styling** decorations (marks, line classes, sizes) are always emitted — the heading stays big
with its `##` visible (ADR-0147 cl.3).

**Construct table** (Lezer node names from `@codemirror/lang-markdown`'s tree — the same parse the
shipped `highlightStyle` rides):

| Node(s) | Styling decoration | Hide decoration (suppressed on revealed lines) |
|---|---|---|
| `ATXHeading1`…`ATXHeading6` | `Decoration.line({ class: 'rt-heading rt-h{n}' })` | `Decoration.replace({})` over the `HeaderMark` + one following space |
| `StrongEmphasis` | `Decoration.mark({ class: 'rt-strong' })` | replace over both `EmphasisMark`s |
| `Emphasis` | `Decoration.mark({ class: 'rt-emphasis' })` | replace over both `EmphasisMark`s |
| `InlineCode` | `Decoration.mark({ class: 'rt-code' })` | replace over both `CodeMark`s |
| `Link` | `Decoration.mark({ class: 'rt-link' })` on the link-text span | replace over `LinkMark`s (`[`,`]`) + `(URL)` (the paren range through the closing `LinkMark`) |
| `ListItem` (bullet lists) | — | `Decoration.replace({ widget: new BulletWidget() })` over the `ListMark` (`-`/`*`/`+`) |
| `Blockquote` | `Decoration.line({ class: 'rt-quote-line' })` | replace over each `QuoteMark` + one following space |
| `FencedCode`, `Table`, `Image`, `TaskMarker`, `SetextHeading*`, `HorizontalRule`, HTML nodes | **none — verbatim source** (ADR-0147 cl.4's outs; the walk simply has no case) | none |

- `BulletWidget extends WidgetType`: `toDOM()` → `<span class="rt-bullet">•</span>`; `eq()` true
  (stateless); the bullet character is real text content (readable, matches the visual — no
  `aria-hidden` games).
- **Ordering/nesting:** `RangeSetBuilder` requires sorted ranges — the tree iteration is in-order;
  where a line decoration and a replace start at the same position, emit the line decoration first
  (CM's documented precedence: line before inline at equal `from`). Nested constructs (bold inside
  a heading) compose naturally as overlapping marks.
- **Atomic ranges — considered, dropped for v1:** hidden ranges never sit on the cursor's own line
  (reveal fires on `selectionSet` before the cursor can land inside one), so arrow-key traversal
  never steps "into" hidden text. If a real traversal glitch surfaces cross-engine, the fix is the
  plugin additionally providing `EditorView.atomicRanges` from the same set — named here so the
  builder patches, not re-designs. **Risk R1.**
- **The click handler.** `EditorView.domEventHandlers({ mousedown })`: only when
  `event.metaKey || event.ctrlKey`; resolve `view.posAtDOM(event.target)` → walk up the syntax tree
  for the enclosing `Link` → extract the `URL` node's text → `window.open(url, '_blank', 'noopener')`,
  `preventDefault()`, return true. Plain click falls through to CM (cursor placement). Non-http(s)
  schemes (`javascript:` etc.): **refuse** — only `http:`/`https:`/`mailto:`/relative are opened
  (the sanitize-by-construction posture `ui-markdown` set). **Risk R2** if omitted.

## 5. LLD-C4 — the mode-toggle part (`editor.ts`)

- Created ONLY on the `#enhanceWithCodeMirror` success path, and only if `handle.richtextAvailable`
  — never in `#ensureParts` (jsdom/plain never has it; the affordance appears WITH the capability).
  Removed in `disconnected()` alongside `#cmMount` (recreated on a reconnect's re-enhance).

```ts
const toggle = this.ownerDocument.createElement('div')
toggle.setAttribute('data-part', 'mode-toggle')
toggle.setAttribute('role', 'button')          // the no-native-form-elements law; role rides the PART
toggle.setAttribute('tabindex', '0')
toggle.setAttribute('aria-label', 'Rendered markdown view')
// aria-pressed synced by #syncModeToggle(); Enter/Space/click → #userToggleMode()
```

- `#userToggleMode()`: flip `this.mode` (`'source'` ⇄ `'richtext'`), then `this.emit('toggle')` —
  **only** from this path; the mode effect (LLD-C1) never emits (programmatic sets are silent,
  ADR-0147 F4). Keydown handles `Enter` + `Space` (Space on keyup-parity is not owed; keydown +
  `preventDefault` for Space's scroll).
- Disabled interplay: the existing disabled effect additionally strips the toggle's `tabindex` and
  sets `aria-disabled="true"` while `effectiveDisabled()` (the host's `pointer-events:none` already
  kills click); readonly leaves it fully operable (F5).
- Placement in DOM: first child of the host (before `[data-part='cm']`), so tab order is
  toggle → editor surface. Note: CM's `indentWithTab` captures Tab inside the content — `Esc` then
  `Tab` is CM's standing escape hatch; documented in `editor.md`'s keyboard rows, not new machinery.

## 6. LLD-C5 — CSS (`editor.css`)

Token block additions (section [1], fed from the component's own chain — self-contained, no new
cross-family coupling):

```css
--ui-code-editor-rt-h1-scale: 1.6;  /* …h2 1.45 · h3 1.3 · h4 1.15 · h5 1.05 · h6 1 (weight-only) */
--ui-code-editor-rt-heading-weight: 700;
--ui-code-editor-rt-bullet-ink: var(--ui-code-editor-token-punctuation);
--ui-code-editor-rt-quote-border: var(--md-sys-color-neutral-outline-variant);
--ui-code-editor-toggle-ink: var(--md-sys-color-neutral-on-surface-variant);
--ui-code-editor-toggle-bg-hover: var(--md-sys-color-neutral-container);
```

Styles block (section [2], `@scope`):

- `.rt-h{n}` → `font-size: calc(var(--ui-code-editor-font) * var(--ui-code-editor-rt-h{n}-scale))`
  + the heading weight; CM measures variable line heights natively — no geometry compensation.
  `.rt-strong`/`.rt-emphasis`/`.rt-code`/`.rt-link` reuse the existing `tok-*` treatments' shape
  (weight/style/mono-chip/underline+ink); `.rt-quote-line` → `border-inline-start` +
  `padding-inline-start` (quote border token).
- Toggle part: `position: sticky; inset-block-start: 0; float: inline-end;` (stays visible under
  the host's own scroll — the host is the scroller, so `absolute` would scroll away), compact
  hit-target ≥ 24px, shared focus ring on `:focus-visible`, hover bg token.
- **The `:not([hidden])` guard is a named requirement:** every new display rule targeting a part —
  `[data-part='mode-toggle']:not([hidden])` — carries the guard. This exact omission on
  `[data-part='editor']` caused the live duplicate-surface bug (plain editor visible under the CM
  mount); **the builder must also verify at build time that the `[data-part='editor']` rule carries
  the guard** — the fix was made same-day in the main checkout and may or may not have landed on
  the build branch. **Risk R3.**
- Forced-colors: extend the existing block — `rt-*` inks → `CanvasText` (weight/style/size survive,
  SPEC-C5: nothing rides hue alone); toggle border/ink → `ButtonText`. Reduced-motion: nothing new
  (the mode switch snaps; no transition is added).

## 7. LLD-C6 — confinement + descriptor

- `confinement.test.ts`: `DESIGNATED` (one string) becomes the pair set
  `{'editor/cm-editor.ts', 'editor/cm-richtext.ts'}`; add the anti-vacuous case for the new module
  (it DOES statically import CM) and a NEW invariant: `cm-richtext.ts` is statically imported by
  `cm-editor.ts` ONLY (a source-text probe over `code/src` mirroring the existing shape) — the lazy
  chunk boundary is the load-bearing fact, the pair is inside it. Every other case byte-unchanged.
- `editor.md`: `attributes[]` += `mode` (type string, default `'source'`, reflect true, the
  `'source' | 'richtext'` union in the comment); `parts[]` += `mode-toggle`; `events[]` += `toggle`
  (user-initiated mode flip only); `keyboard[]` += Enter/Space-on-toggle + the Esc-then-Tab note;
  prose gains a "Richtext live preview" section (availability law, reveal UX, v1 outs). The
  descriptor↔props trip-wire (`editor-descriptor.test.ts`) forces the lockstep.

## 8. LLD-C7 — test plan + gates (the `editor.browser.test.ts` pattern EXTENDED, never replaced)

**jsdom (`editor.test.ts`):** mode default/reflection/unknown-value; inert-fallback diff (with vs
without `mode="richtext"`: identical DOM, FACE, events); no toggle part ever; FACE suite re-run
with mode set.

**Browser, BOTH engines (`editor.browser.test.ts`):** the decomposition's n3/n5/n6/n7/n8/n12
predicates verbatim — markup hidden off-cursor-line / revealed on it (styling retained), bullet
widget, fences verbatim, modifier-click link (stubbed `window.open`, scheme refusal case), toggle
click/Enter/Space + `aria-pressed` + single `toggle` event, undo-across-toggle, `.value`
byte-identity under repeated mode flips + typing-in-richtext, blur-with-change timing in richtext,
forced-colors leg, plus a long-document sanity probe (≥ 500 lines: typing latency observably sane,
no per-keystroke full-document walk — `visibleRanges` bounded).

**Gates:** confinement pair-allowlist green · identity/barrels/layering byte-unchanged ·
`measure-size.mjs` lazy-chunk line-item re-measured (decoration bytes lazy-only; main-graph budgets
untouched) · zero new deps in `code/package.json` (the gen-ui-kit undeclared-CM-package P0 gate:
nothing new is imported; any future `@codemirror/*` addition must be declared before ship) ·
independent component-reviewer GO before commit (n14).

## 9. Risks

- **R1 — cursor traversal over hidden ranges** (cross-engine): mitigation named in LLD-C3
  (`atomicRanges` from the same set — a patch, not a redesign). Probe both engines explicitly.
- **R2 — link scheme injection**: `[x](javascript:…)` must never open; the scheme allowlist in the
  click handler is normative, with a negative test.
- **R3 — the `[hidden]` guard drift**: the same-day `[data-part='editor']` fix may not be on the
  build branch; the builder verifies + the css-probe leg asserts BOTH parts' rules carry
  `:not([hidden])`.
- **R4 — Lezer node-name drift**: the construct table's node names pin to the installed
  `@codemirror/lang-markdown` version; a version bump that renames nodes fails the browser legs
  loudly (acceptable — the standing release-train cost ADR-0139 already priced).
- **Non-decision noted (no ADR owed):** decoration classes are `rt-*` (beside `tok-*`) rather than
  reusing `tok-*` — pure namespacing, reversible, zero contract weight.

## 10. Build order

Decomposition edges, linearized: **LLD-C3 (engine) → LLD-C2 (compartment/handle) → LLD-C1 (prop) →
LLD-C4 (toggle) → LLD-C5 (CSS) → LLD-C6 (gates/descriptor) → LLD-C7 (legs + size + reviewer GO)** —
each leaf's accept predicate green before the next leans on it; the reviewer gate is last and
blocking.
