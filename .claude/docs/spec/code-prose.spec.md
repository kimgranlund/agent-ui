# SPEC — Code + Prose family v1 / M1 (`@agent-ui/code`: core seams · `./highlight` · `./markdown`)

> Status: proposed · v0.1 · 2026-07-10 · Layer: SPEC (execution contract)
> Refines: [`../prd/code-prose-family.prd.md`](../prd/code-prose-family.prd.md) — **PRD-G1** (markdown-as-structure, flagship), **PRD-G2** (highlight as an opt-in pack), **PRD-G4** (package + DAG + pillars); realizes [ADR-0119](../adr/0119-code-prose-family-v1-scope.md) clauses 1–4 + 6–8 (**accepted 2026-07-10** — all forks answered). **PRD-G3 / ADR-0119 cl.5 (`ui-diff`) is M2 — out of this SPEC.**
> Refined by: [`../lld/code-prose.lld.md`](../lld/code-prose.lld.md). Decomposition: [`../decompositions/code-prose-m1.decomp.json`](../decompositions/code-prose-m1.decomp.json) (coverage-clean, strict).
> Altitude: owns the **M1 behavior contract** — the package boundary, the highlighter-registry + token-stream types, the light-DOM projection seam, the seven tokenizers' coarse-tier contract, the markdown subset's construct→element rendering, sanitization-by-construction, and the standing gates. File map + mechanisms are the LLD's. Requirement IDs file-scoped (`SPEC-C1…`); cross-document references qualify by doc name.

---

## 1. Purpose

Define what `@agent-ui/code` is at **M1**: a new **sibling package off `@agent-ui/components`** carrying a
**pure, zero-dep core** (an engine-agnostic token-stream type, a swappable **highlighter registry**, and a
light-DOM **projection seam** that renders tokens into an unchanged `ui-code` host) plus two **opt-in
subpath packs** — `./highlight` (seven hand-rolled, line-oriented tokenizers for the agent-common
language set, self-registering on import) and `./markdown` (a `ui-markdown` element that renders the
agent-common markdown subset into **real fleet DOM**, sanitized by the *absence* of a raw-HTML lane). The
core stays byte-identical for non-adopters (an **identity gate**); the packs carry their mass only when
imported (a **tree-shake gate**); markdown never becomes an injection surface (an **injection corpus** as
a standing gate). The diff view (`ui-diff`) is M2 and is out of scope here.

## 2. Definitions

- **Token** — one span of a tokenized code string: `{ kind, text }`. The **token stream** `Token[]` is a
  *contiguous, gap-free partition* of the input — concatenating every `text` reproduces the input
  **exactly** (the round-trip invariant, SPEC-C2). `kind` is one of six coarse tiers (`plain` + the five
  classed tiers `comment` · `string` · `keyword` · `number` · `punctuation`).
- **Highlighter** — an engine: `(code: string, language: string) => Token[]`. Consumer-supplied or the
  bundled `./highlight` one; the core owns only the *registry* and *type*, never an engine.
- **Highlighter registry** — the pack-independent, **signal-free** holder of the active highlighter
  (last-wins registration; the `@agent-ui/icons` registry precedent, ADR-0065 cl.2/4). `tokenize(code,
  language)` reads it; with **nothing registered it returns a single `plain` token** = verbatim.
- **Projection seam** — the core function that turns a token stream into light-DOM `<span data-token>`
  children of a `ui-code` host (ADR-0113 escape hatch (a), *made systematic*). With nothing registered it
  writes a single text node — **byte-identical** to a plain host-as-content `ui-code`.
- **Pack** — an opt-in subpath (`./highlight`, `./markdown`) carrying runtime code (tokenizers, a
  grammar) that a consumer imports explicitly; the core barrel (`.`) re-exports **no** pack.
- **The markdown subset** — headings · paragraphs · lists (ordered/unordered, nested) · emphasis/strong ·
  inline code · fenced code · links · blockquotes · GFM tables (ADR-0119 cl.4). Everything else — raw
  HTML, footnotes, math, reference/auto links, HTML blocks — is **out** (PRD §3 fence).
- **Sanitized by construction** — no raw-HTML lane exists: the parser recognizes only the subset, every
  node is built via `createElement`/`textContent`, and no path ever calls `innerHTML` on input. HTML in
  the source renders as **inert text**. There is nothing to sanitize because there is no lane (ADR-0119
  cl.4; PRD-G1).

---

## 3. Requirements

Normative per RFC 2119; each carries an ID, a PRD/ADR trace, and testable acceptance criteria.

### 3.1 Package boundary + DAG

**SPEC-C1 — `@agent-ui/code` joins the DAG as a components-consumer sibling; nothing imports it inward;
the core barrel carries no pack.** The package MUST declare runtime dependencies of exactly
`{@agent-ui/components, @agent-ui/shared}`; MUST NOT be imported by `components`, `a2ui`, `shared`, or any
of their internals (the **structural catalog fence** — `a2ui` has no route to markdown, ADR-0119 cl.1/7);
MUST follow the strict TS posture (`erasableSyntaxOnly`/`verbatimModuleSyntax`/`.ts` local imports); and
MUST expose the packs on subpaths (`./highlight`, `./markdown`, + their `.css`) with the `.` barrel
exporting **only the core** (token types + registry + projection seam) — so a core-only consumer drags no
tokenizer and no `ui-markdown` bytes (the pure-core + subpath pattern, ADR-0065/0066; the `@agent-ui/router`
sibling precedent, ADR-0115). *(→ PRD-G4; ADR-0119 cl.1)*
- **AC1** *Given* the package, *when* `code/src/layering.test.ts` runs, *then* every import under
  `code/src` resolves to `{@agent-ui/components, @agent-ui/shared}` or a local path, and the test goes RED
  under a planted upward import (negative control, unique token, grep-confirmed applied then reverted).
- **AC2** *Given* the repo, *when* grepped, *then* no source under `components/src`, `a2ui/src`, or
  `shared/src` imports `@agent-ui/code` (the catalog fence is structural, not conventional).
- **AC3** *Given* a consumer importing only the `.` barrel, *when* the tree-shake probe runs, *then*
  neither a tokenizer nor the `ui-markdown` class is in the output and no custom element is registered
  (SPEC-C9 owns the assertion; this AC pins the barrel's *contents*: it re-exports no `./highlight` or
  `./markdown` module — grep-confirmed, the `@agent-ui/router` barrels.test.ts precedent).

### 3.2 The core seams (zero-dep)

**SPEC-C2 — The token stream is a contiguous partition; the highlighter registry is signal-free and
last-wins; `tokenize` is verbatim when empty.** The core MUST export the **type**
`Token = { kind: TokenKind; text: string }` with `TokenKind = 'plain' | 'comment' | 'string' | 'keyword'
| 'number' | 'punctuation'`, the type `Highlighter = (code: string, language: string) => Token[]`, and a
registry surface — `registerHighlighter(fn)` (last registration wins), `activeHighlighter(): Highlighter |
null`, and `tokenize(code, language): Token[]`. The registry MUST be **signal-free** (no import of the
components kernel — the ADR-0065 cl.4(b) reason: never invert the `components ← code` arrow) and expose an
instance class **plus** a default singleton (the icons `Registry`/`iconRegistry` shape) so tests and apps
can hold an isolated registry. **Every** highlighter's output MUST be a *contiguous, gap-free* partition:
`tokens.map(t => t.text).join('') === code`, exactly (the round-trip invariant — the fidelity floor and
the identity guarantee). With **no** highlighter registered, `tokenize(code, language)` MUST return
`[{ kind: 'plain', text: code }]` (a single plain token = verbatim). **`tokenize` MUST enforce the
invariant at the boundary**: if the active highlighter's output does NOT round-trip (drops, reorders, or
mutates text), `tokenize` MUST discard it and return `[{ kind: 'plain', text: code }]` — the code the user
sees is never corrupted (the ADR-0113 plain-wins spirit). The downgrade MUST NOT be silent: it MUST emit
a single dev-facing `console.warn` naming the offending highlighter (the `@agent-ui/icons` registry's
last-wins `console.warn` posture — a broken highlighter must surface, not hide). *(→ PRD-G2; ADR-0119 cl.2/3)*
- **AC1** *Given* an empty registry, *then* `tokenize('const x = 1', 'ts')` is
  `[{kind:'plain', text:'const x = 1'}]`; the round-trip holds trivially.
- **AC2** *Given* two independent `Registry` instances, *when* one registers a highlighter, *then* the
  other's `tokenize` still returns plain (instance isolation); a second `registerHighlighter` on the same
  registry replaces the first (last-wins), asserted.
- **AC3** *Given* the no-kernel gate, *when* a components-kernel or DOM-signal import is planted in
  `core/*.ts` (unique token), *then* the gate goes RED (negative control) — the registry never imports
  upward.
- **AC4** *Given* a **text-dropping** highlighter registered (returns tokens whose concatenation ≠ the
  input — e.g. it silently drops a comment), *when* `tokenize(code, language)` runs, *then* the result is
  `[{ kind: 'plain', text: code }]` (the boundary downgrade, code intact) **and** exactly one
  `console.warn` fires naming the highlighter; a well-behaved highlighter fires no warn (negative control —
  the downgrade path bites only on a real invariant breach).

**SPEC-C3 — The projection seam renders tokens into a `ui-code` host through light DOM; `ui-code` itself
is unchanged; the empty path is byte-identical.** The core MUST export a projection function that, given a
`ui-code` host + a code string + a language, replaces the host's children with a light-DOM rendering of
`tokenize(code, language)`: each token becomes a `<span data-token="{kind}">` carrying that token's `text`
(the five classed tiers) or a bare text node (`plain`), in order — so the concatenated rendered text
equals `code` exactly (SPEC-C2's invariant, projected). This is ADR-0113 escape hatch (a) made
systematic: the seam produces the *pre-highlighted children* the hatch always permitted; `ui-code` keeps
its **zero machinery** (no observer, no stamp) and is **not modified by this wave** — the whole package
lives outside `@agent-ui/components`. With **no** highlighter registered, the seam MUST write a **single
text node** whose `textContent === code` (no spans) — byte-identical to a plain host-as-content `ui-code`.
A subsequent bound `Code.code` write clobbers the projection to plain text (the ADR-0113 guarantee: plain
always wins). *(→ PRD-G2; ADR-0119 cl.2)*
- **AC1** *Given* a registered highlighter and a `ui-code` host, *when* the seam projects `'const x = 1'`,
  *then* the host's children are `<span data-token>`s whose concatenated text is exactly `'const x = 1'`
  and whose tiers include a `keyword` span for `const` (the compose leg).
- **AC2** *Given* an **empty** registry and the same host, *when* the seam runs, *then* the host holds one
  text node equal to `'const x = 1'` and **zero** `[data-token]` spans (the identity path — the byte level
  of the SPEC-C9 identity gate).
- **AC3** *Given* a projected host, *when* a plain-text `textContent` write lands on it (the shape the
  a2ui `Code.code` clobber lane produces downstream — this package neither imports nor invokes that lane;
  the AC exercises the equivalent bare write), *then* the spans are gone and the host is a plain-text
  `ui-code` (plain-wins clobber survives BY DESIGN, ADR-0113 — the seam does not re-project on mutation).

### 3.3 The `./highlight` pack

**SPEC-C4 — Seven hand-rolled, line-oriented tokenizers for the agent-common set; coarse on purpose;
self-registering.** The `./highlight` subpath MUST ship dependency-free, line-oriented tokenizers for the
v1 language set (ADR-0119 cl.3, fork F2 as answered): **ts/js · json · html · css · python · shell ·
markdown fences** (ts and js share one tokenizer — eight language *keys*, seven grammars). Each MUST
classify into the five coarse tiers (`comment` · `string` · `keyword` · `number` · `punctuation`), leave
everything else `plain`, and satisfy SPEC-C2's round-trip invariant **unconditionally** (classification is
best-effort; contiguity is not). A tokenizer is line-oriented but MUST carry a **single-level block-mode
flag across line boundaries** so a construct that spans lines classifies on every line it covers: a block
comment (`/*…*/`, `<!--…-->`, CSS `/*…*/`), a triple-quoted Python string (`'''…'''`/`"""…"""`), and a
JS/TS template literal (`` `…` ``) each open a block mode that persists line-to-line until its closer —
without a full parser (one non-nesting mode at a time; coarse on purpose, ADR-0119 cl.3). Importing
`@agent-ui/code/highlight` MUST **self-register** the bundled
highlighter into the default registry (the `@agent-ui/icons/phosphor` self-registration precedent,
ADR-0066) and MUST also export an idempotent `registerHighlight(registry?)` for explicit control. The
bundled highlighter MUST dispatch by `language` to the matching tokenizer and return a single `plain`
token for an unknown language (verbatim — never throw). **Fidelity fence:** the tokenizers are a *scanning
aid*, not parsers — a keyword inside a string stays `string`, a `#` in CSS stays `punctuation`; the ACs
assert the coarse tiers on **agent-real fixtures**, never full-grammar fidelity. *(→ PRD-G2; ADR-0119
cl.3)*
- **AC1** *Given* `import '@agent-ui/code/highlight'`, *then* `activeHighlighter()` is non-null and
  `tokenize('// hi\nconst x = 1', 'ts')` yields a `comment` token for `// hi`, a `keyword` for `const`, a
  `number` for `1`, and round-trips exactly.
- **AC2** *Given* one agent-real fixture per language (a JSON config, an HTML fragment, a CSS block, a
  Python function, a shell pipeline, a markdown snippet, a TS module), *then* each tokenizes with the
  expected tier present on the marked span AND round-trips exactly; a planted classification error fails
  the fixture (negative control per language).
- **AC3** *Given* `tokenize(code, 'brainfuck')` (unknown language) with the pack registered, *then* the
  result is `[{kind:'plain', text: code}]` and nothing throws.
- **AC4** *Given* a **three-line block construct** per block-mode language — a `/*\n…\n*/` comment (ts/css),
  a `'''\n…\n'''` Python string, and a `` `\n…\n` `` template literal — *then* the tier (`comment` /
  `string`) is carried on **all three lines** (the middle line, which contains no delimiter, is not
  `plain`), and the whole input round-trips exactly; a planted per-line-reset (dropping the carry) leaves
  the middle line `plain` and fails the AC (negative control — the carry-state is what bites).

**SPEC-C5 — Token tiers map to theme-honest `--ui-code-token-*` roles; forced-colors degrades to plain
ink.** The `./highlight` pack MUST ship a stylesheet (`highlight.css`, exported as a subpath) that
declares the five `--ui-code-token-*` custom properties in a `:where(...)` block from `--md-sys-color-*`
**roles** and consumes them via `[data-token="{tier}"]` selectors scoped to `ui-code`. The mapping MUST be
**role-level** (comment → the muted on-surface-variant role; keyword → an accent on-surface role; string →
a distinct accent on-surface role; number → a further accent on-surface role; punctuation → the default
on-surface ink) — **pinned to role families, never to numbered palette steps**: the color token sheet is
mid-migration by another seat, so the build resolves each role against the *landed* sheet (do not pin
`-NNN` steps here). Under `@media (forced-colors: active)` every tier MUST degrade to `CanvasText` (plain
ink — a token is **never** invisible). Token color is a **non-essential** enhancement — the code is
complete and fully legible as plain ink, so no information is carried by hue alone; this does **not** owe a
non-color signifier (the ADR-0057 rule binds *intent*, and highlighting conveys none). *(→ PRD-G2;
ADR-0119 cl.3/6)*
- **AC1** *Given* `highlight.css` adopted, *when* the five `--ui-code-token-*` roles are resolved in light
  and dark, *then* each is a real `--md-sys-color-*` role value (a jsdom text probe over the declared
  block; the exact numbered step is NOT asserted — role-family only).
- **AC2** *Given* `forced-colors: active` (browser), *then* every `[data-token]` span computes
  `CanvasText` (no tier vanishes) — Chromium; WebKit structural probe per the instrument-bridge precedent.

### 3.4 The `./markdown` pack (flagship)

**SPEC-C6 — `ui-markdown` renders the agent-common subset into real fleet DOM from a bindable `markdown`
prop.** The `./markdown` subpath MUST define a `ui-markdown` element (a Display-class `UIElement`, defined
**in the pack** — ADR-0119 cl.4/fork F4) with a single **bindable `markdown` string prop** (the source
document; the `Text.text` clobber-lane shape — a prop, not host-as-content, since the source is generated,
the `ui-table` columns/rows precedent), non-reflected (a document string is not an attribute-sane value).
On `markdown` change it MUST parse the subset and **replace its children** with real fleet DOM (never
`innerHTML`), per this construct→element map (mechanisms + the two interpretations below are the LLD's;
the *mapping* is normative): *(→ PRD-G1; ADR-0119 cl.4)*

| Construct | Renders as |
|---|---|
| Heading `#`…`######` | `ui-text as="h1"…"h6"` (the real heading element; ui-text `as` supports h1–h6) |
| Paragraph | `ui-text as="p"` wrapping the inline run |
| Unordered / ordered list (nested) | native `<ul>` / `<ol>` with `<li>` children; nesting nests natively **(Interpretation I-2)** |
| Blockquote | `ui-text as="blockquote"` wrapping its block children |
| Fenced code ` ``` ` | `ui-code` with the fence info-string forwarded to `language`; content set as `textContent` (SPEC-C8) |
| Inline emphasis `*…*` / strong `**…**` | native `<em>` / `<strong>` inline elements **(Interpretation I-1)** |
| Inline code `` `…` `` | native `<code>` inline element **(Interpretation I-1)** |
| Link `[text](url)` | `ui-text as="a" href="url"` — the ADR-0114 vehicle; `href` passes ui-text's fail-closed scheme gate (`javascript:`/`data:`/etc. denied there — inherited, not re-implemented) |
| GFM table | `ui-table` with `columns` (from the header row) + `rows` (body records keyed by column key); cells are plain text at v1 **(Interpretation I-3)** |

**Interpretations (SPEC-level mechanism choices, flagged — the ADR left the element vocabulary to
SPEC/LLD):**
- **I-1 — inline emphasis/strong/inline-code render as native `<em>`/`<strong>`/`<code>`.** ui-text's `as`
  axis has **no** em/strong/code member and its `emphasis` axis is explicitly CSS-only + non-semantic; block
  `ui-code` cannot serve *inline* code. Native semantic inline elements are inert (no script/href surface),
  built structurally via `createElement` — so they honor sanitization-by-construction. `markdown.css`
  styles them within `ui-markdown`'s scope. A future ui-text semantic-inline extension is the named
  alternative (not built).
- **I-2 — lists render as native `<ul>`/`<ol>`/`<li>`.** A fleet `ui-list` **does** exist
  (`controls/list/list.ts`) — but it is a `ui-column` flex specialization that adds only `role="list"` and
  imposes **no** item element, no ordinal, and no nested-list rendering (its children are agent-composed
  `ChildList` items). Markdown lists need exactly what `ui-list` declines to render: `<li>` items, `<ol>`
  ordinals, and structural nesting. So `ui-list` is dismissed for this job on mechanics, and lists render
  as native `<ul>`/`<ol>`/`<li>` — semantic, inert, nesting naturally, built via `createElement`.
  `markdown.css` styles them within `ui-markdown`'s scope. (A future `ui-list`/`ui-list-item` ordinal +
  nesting capability is the named alternative — not built here.)
- **I-3 — GFM table cells are plain text at v1.** `ui-table`'s model is `string|number` cells
  (`resolveCell`), not rich nodes, so inline formatting *inside* a cell (bold, links) renders as literal
  text at v1; GFM column-alignment markers are parsed but not rendered (ui-table has no `align` prop). Both
  are named, foreseen extensions — excluding them keeps the subset honest, not the "literal syntax"
  problem this family exists to end (the whole document still renders as structure).

- **AC1** *Given* `markdown = "# Title\n\nA **bold** word and \`code\`."`, *then* the children are a
  `ui-text as="h1"` and a `ui-text as="p"` whose inline run contains a `<strong>bold</strong>` and a
  `<code>code</code>` — asserted by rendered structure (browser leg, both engines).
- **AC2** *Given* an ordered list with a nested unordered list, *then* the DOM is `<ol><li>…<ul><li>…`
  (nesting preserved); *given* a blockquote containing two paragraphs, *then* a `ui-text as="blockquote"`
  wraps two `ui-text as="p"`.
- **AC3** *Given* a link `[src](https://example.com)`, *then* a `ui-text as="a"` renders with the stamped
  `<a href="https://example.com">`; *given* `[x](javascript:alert(1))`, *then* the `ui-text as="a"`'s
  stamp carries **no** `href` (ui-text's gate denied it — the injection leg, cross-referenced by SPEC-C7).
- **AC4** *Given* a GFM table with a header + two body rows, *then* a `ui-table` renders with `columns`
  from the header and two `rows`; *given* re-assigning `markdown = ''`, *then* the children are cleared
  (no residue).

**SPEC-C7 — Markdown is sanitized by the absence of a raw-HTML lane; the injection corpus is a standing
gate.** `ui-markdown` MUST NOT contain any path that assigns input to `innerHTML`/`outerHTML`/
`insertAdjacentHTML` or constructs a `<script>`/`<style>`/event-handler-attributed element from input.
Raw HTML in the source MUST render as **inert text** (a text node showing the literal tags), never as
parsed HTML (no raw-HTML lane exists — ADR-0119 cl.4). An **injection corpus** MUST ship as a standing
test: `<script>`, `<img onerror=…>`, `<a href="javascript:…">`, event-handler attributes, and raw HTML
blocks all render **inert** (no such element/attribute reaches the DOM; the `javascript:` link is denied
by ui-text's gate per SPEC-C6 AC3). *(→ PRD-G1; ADR-0119 cl.4)*
- **AC1** *Given* the injection corpus fed to `ui-markdown`, *then* **zero** `<script>` elements exist in
  its subtree, **no** rendered element carries an `on*` attribute, and every raw tag appears as visible
  text — asserted per corpus entry (browser leg; each entry a biting case).
- **AC2** *Given* a source-text grep of `markdown/*.ts`, *then* no `innerHTML`/`outerHTML`/
  `insertAdjacentHTML` write of input exists (the grep-able-absence discipline, the `code.ts`/`text.ts`
  banned-API precedent); a planted `innerHTML = src` fails the grep (negative control).

**SPEC-C8 — The two packs compose through the registry: fenced code reaches `ui-code` with `language`
forwarded, and highlights iff `./highlight` is registered.** A fenced block MUST render as a `ui-code`
whose `language` is the fence info-string and whose content is the verbatim code (the SPEC-C3 seam
applied). `ui-markdown` MUST reach highlighting **only through the core registry** — it MUST NOT import
`./highlight` (so `./markdown` alone drags zero tokenizer bytes). When `./highlight` is *also* imported by
the app, the same fenced `ui-code` highlights; when it is not, the fenced block renders verbatim (the
identity path). *(→ PRD-G1/G2; ADR-0119 cl.4)*
- **AC1** *Given* only `./markdown` imported and a fenced ` ```json ` block, *then* a `ui-code
  language="json"` renders verbatim (no `[data-token]` spans) — the tree-shake + identity leg.
- **AC2** *Given* `./markdown` **and** `./highlight` imported and the same block, *then* the fenced
  `ui-code` carries `[data-token]` spans (the packs composed via the registry, no import edge between
  them) and its concatenated text still equals the source code exactly.

### 3.5 Fleet definition-of-done + catalog disposition

**SPEC-C9 — The pack elements meet the standing bar; three gates are standing tests; per-pack size
line-items hold.** `ui-markdown` MUST ship a `{name}.md` descriptor (ADR-0004) whose contract↔props
trip-wire is green, run **inside `@agent-ui/code`** by importing the shared parser from
`@agent-ui/components/descriptor` (the `@agent-ui/router` per-package pattern — the components SPEC-N2
catalog/allowlist gate walks only `components/src`, so no allowlist entry is owed; SPEC-C10). The **three
gates** MUST be standing tests: the **identity gate** (SPEC-C3 AC2 + no core import registers an element
or installs a global observer), the **tree-shake gate** (SPEC-C1 AC3 realized functionally: importing the
`.` barrel registers no custom element and no highlighter, and a `measure-size` core row carries no pack
mass), and the **injection corpus** (SPEC-C7). Rendered structure MUST be proven **cross-engine (Chromium
AND WebKit)**. `scripts/measure-size.mjs` MUST gain **per-pack** line-items — core (marginal over the
components foundation), `./highlight`, `./markdown` — each budget **measured first at M1 kickoff, then
pinned** (the ADR-0080 "measured, not guessed" discipline; no re-base guessed here). An independent
`component-reviewer` pass MUST record GO (both axes ≥4, zero blockers) on `ui-markdown` before the M1
commit. *(→ PRD-G4; ADR-0119 cl.8)*
- **AC1** *Given* `ui-markdown.md`, *when* the trip-wire runs, *then* it is a faithful bijection with
  `UIMarkdownElement.props` (the one `markdown` prop); a planted extra attribute fails (negative control).
- **AC2** *Given* `npm run size`, *then* the three `@agent-ui/code` line-items are within their pinned
  budgets and the core row proves no pack mass; a planted over-budget number fails (negative control).
- **AC3** *Given* the finished pack, *then* `component-reviewer` records GO before the commit; a NO-GO
  loops back to the owning slice (generator ≠ critic — the ui-slider DOT lesson).

**SPEC-C10 — The default catalog is untouched; no `@agent-ui/components` allowlist entry is owed;
agent-reachability is an M2 consumer-tier extension.** M1 MUST add **no** default-catalog row and **no**
`@agent-ui/components` descriptor/allowlist entry — the default catalog is zero-dep and `a2ui` cannot
import this package (SPEC-C1). The verification (ADR-0119 cl.7, "verify at build: the gate's scope is
package-bound, not repo-bound") is **confirmed**: the components SPEC-N2 gates (`site-coverage`/
`site-canon`/`site-toc`) walk only `packages/agent-ui/components/src/{controls,components}`; `ui-markdown`
lives in `code/src/markdown/` — outside that scan — so it owes no allowlist entry and instead carries its
own per-package descriptor trip-wire (SPEC-C9). `Markdown`/`Diff` reachability for agent emission is a
documented **consumer catalog extension** shipped at **M2** (the two-tier "stricter overrides" model,
ADR-0034). *(→ PRD-G4; ADR-0119 cl.7)*
- **AC1** *Given* the M1 change, *then* `catalog/default/*` and the components allowlist are byte-unchanged
  and every components SPEC-N2 gate stays green (no new residue).
- **AC2** *Given* the components descriptor-gate source, *when* its scan roots are inspected, *then* they
  are `components/src/{controls,components}` only — the package-bound scope the interpretation rests on
  (grep-confirmed, cited in the LLD).

**SPEC-C11 — CLAUDE.md DAG rows + the layering trip-wire extend in the same change.** The M1 change MUST
update `CLAUDE.md`'s Layout list (a `@agent-ui/code` package row) and the Conventions DAG line to record
`@agent-ui/code` as a second sibling branch off `components` (`shared ← components ← code`, alongside
`router`; never imported by `a2ui`/`app` at v1), and MUST land `code/src/layering.test.ts` as the standing
structural gate (SPEC-C1). Records that would otherwise lie MUST be repaired in the same change (the
context-is-memory rule). *(→ PRD-G4; ADR-0119 cl.1/8, Consequences "Stale → re-verify")*
- **AC1** *Given* the change, *then* CLAUDE.md's DAG line names `code` as a `components` sibling and the
  layering trip-wire is green (SPEC-C1 AC1/AC2); a doc-review confirms no dangling reference.

---

## 4. Typed contracts (behavioral — signatures normative in shape, not spelling; internals are the LLD's)

```ts
// core (the `.` barrel) — zero-dep, signal-free
type TokenKind = 'plain' | 'comment' | 'string' | 'keyword' | 'number' | 'punctuation'
interface Token { kind: TokenKind; text: string }               // Σ text === input (contiguous partition)
type Highlighter = (code: string, language: string) => Token[]

interface HighlighterRegistry {
  registerHighlighter(fn: Highlighter): void                     // last-wins
  activeHighlighter(): Highlighter | null
  tokenize(code: string, language: string): Token[]              // [{plain, code}] when empty
}
declare const highlighterRegistry: HighlighterRegistry           // default singleton (icons precedent)
declare function registerHighlighter(fn: Highlighter): void      // sugar over the singleton
declare function tokenize(code: string, language: string): Token[]
declare function projectHighlight(host: Element, code: string, language: string): void  // the seam (SPEC-C3)

// ./highlight (subpath) — self-registers on import; also:
declare function registerHighlight(registry?: HighlighterRegistry): void

// ./markdown (subpath) — self-defines <ui-markdown> on import
interface UIMarkdownElement { markdown: string }                 // bindable; renders into fleet DOM
```

- **Events:** none at M1 — both surfaces are Display-class (no interactivity, the six-name event law is
  untouched). **ARIA:** fenced code keeps `ui-code`'s `role="code"`; headings/lists/blockquote/table carry
  native/`ui-text`/`ui-table` semantics; `ui-markdown` itself is a transparent container (no role).

## 5. Non-functionals

- **Zero-dependency:** no runtime dependency beyond the two workspace packages; every grammar and
  tokenizer is hand-rolled (ADR-0119 cl.3 — vendoring is "a dependency in costume", ADR-0107).
- **Cross-engine truth (gate):** SPEC-C5/C6/C7 rendered-structure legs pass in **Chromium AND WebKit**.
- **Budget (gate, manual):** the three per-pack `measure-size` line-items within their pinned budgets
  (SPEC-C9 AC2; the ADR-0040 manual posture).
- **Layering (gate):** SPEC-C1 runs as a standing trip-wire; SPEC-C10's catalog fence is structural.
- **Identity (gate):** SPEC-C3 AC2 + the no-element-registration barrel property (SPEC-C9) — a non-adopter
  pays nothing and sees `ui-code` unchanged.

## 6. Traceability (this SPEC → PRD / ADR-0119)

| SPEC-C | Requirement | PRD | ADR-0119 |
|---|---|---|---|
| SPEC-C1 | package boundary, subpaths, structural catalog fence | PRD-G4 | cl.1 |
| SPEC-C2 | token stream type + registry (signal-free, verbatim-empty, round-trip) | PRD-G2 | cl.2/3 |
| SPEC-C3 | projection seam; ui-code unchanged; byte-identical empty path | PRD-G2 | cl.2 |
| SPEC-C4 | seven tokenizers, coarse tiers, self-registration, fidelity fence | PRD-G2 | cl.3 |
| SPEC-C5 | `--ui-code-token-*` role mapping + forced-colors degrade | PRD-G2 | cl.3/6 |
| SPEC-C6 | ui-markdown subset → fleet DOM (construct→element map + I-1/I-2/I-3) | PRD-G1 | cl.4 |
| SPEC-C7 | sanitized-by-construction + injection corpus | PRD-G1 | cl.4 |
| SPEC-C8 | the packs compose through the registry | PRD-G1/G2 | cl.4 |
| SPEC-C9 | fleet DoD + three gates + per-pack size + reviewer | PRD-G4 | cl.8 |
| SPEC-C10 | default catalog untouched; package-bound gate; M2 extension | PRD-G4 | cl.7 |
| SPEC-C11 | CLAUDE.md DAG rows + layering trip-wire, same change | PRD-G4 | cl.1/8 |

_All eleven requirements trace to a PRD must-goal; PRD-G3 (`ui-diff`) is deliberately M2 (ADR-0119 cl.5) —
out of this SPEC. Every M1 clause of ADR-0119 (1–4, 6–8) is covered; cl.5 is M2, cl.6's control-geometry
half is a non-requirement here (both surfaces are Display-class — no `[scale]`/`[size]` rows)._
