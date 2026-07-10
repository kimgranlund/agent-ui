# LLD — Code + Prose family v1 / M1 (`@agent-ui/code`)

> Status: proposed · v0.1 · 2026-07-10 · Layer: LLD (implementation plan)
> Implements: [`../spec/code-prose.spec.md`](../spec/code-prose.spec.md) (`SPEC-C1…C11`). Realizes [ADR-0119](../adr/0119-code-prose-family-v1-scope.md) clauses 1–4 + 6–8 (**accepted 2026-07-10**; **`ui-diff` / cl.5 is M2 — not planned here**).
> Decomposition: [`../decompositions/code-prose-m1.decomp.json`](../decompositions/code-prose-m1.decomp.json) (coverage-clean, strict tier; nodes n1a…n8 ≈ the components below). Build-order edges are the decomposition's.
> Altitude: owns **how M1 is built** — the file map, concrete interfaces, per-component failure/edge handling, and the single-writer build sequence. Behavior is the SPEC's; this doc never re-derives it. Precedent code is cited, never copied: `@agent-ui/icons` (registry/subpath/self-registration), `@agent-ui/router` (sibling-package skeleton, layering trip-wire, barrels test, size row), `controls/code` (the unchanged `ui-code` host), `controls/text` (`as="a"`/`href` gate), `controls/table` (`columns`/`rows` model), `descriptor/component-descriptor.ts` (the trip-wire).

## 1. Component map (LLD-C# → SPEC-C#, → decomp node)

| LLD-C | Component | Files | Implements | Decomp |
|---|---|---|---|---|
| **LLD-C1** | package skeleton | `packages/agent-ui/code/{package.json,tsconfig.json}` + root workspace row | SPEC-C1 | n1a |
| **LLD-C2** | layering trip-wire | `code/src/layering.test.ts` | SPEC-C1, C11 | n1b |
| **LLD-C3** | core token types + shared predicate | `code/src/core/token.ts` (+ `token.test.ts`) | SPEC-C2 | n2a |
| **LLD-C4** | highlighter registry | `code/src/core/registry.ts` (+ `registry.test.ts`, `no-kernel.test.ts`) | SPEC-C2 | n2b |
| **LLD-C5** | projection seam | `code/src/core/project.ts` (+ `project.test.ts`) | SPEC-C3 | n2c |
| **LLD-C6** | the seven tokenizers | `code/src/highlight/langs/{ts,json,html,css,python,shell,markdown}.ts` (+ `*.test.ts`) | SPEC-C4 | n3a |
| **LLD-C7** | highlight self-registration + token CSS | `code/src/highlight/{index.ts,highlight.css}` (+ `highlight.test.ts`, `highlight-css.test.ts`) | SPEC-C4, C5 | n3b |
| **LLD-C8** | markdown parser | `code/src/markdown/parse.ts` (+ `parse.test.ts`, `injection.test.ts`) | SPEC-C6, C7 | n4a |
| **LLD-C9** | markdown renderer + `ui-markdown` | `code/src/markdown/{render.ts,markdown.ts,markdown.css,markdown.md}` (+ `markdown.test.ts`, `markdown-descriptor.test.ts`) | SPEC-C6, C7, C8, C9 | n4b |
| **LLD-C10** | gates + browser legs + size + reviewer | `code/src/{identity.test.ts,barrels.test.ts,markdown.browser.test.ts}` · `scripts/measure-size.mjs` rows · reviewer record | SPEC-C7, C8, C9 | n5a, n5b, n5c |
| **LLD-C11** | barrels/subpaths + CLAUDE.md DAG rows | `code/src/index.ts` · `package.json` exports · `CLAUDE.md` | SPEC-C1, C10, C11 | n6, n7 |

No orphan components (each traces to a SPEC-C); no SPEC-C without a component.

## 2. LLD-C1 — package skeleton (→ SPEC-C1)

`packages/agent-ui/code/package.json` (the `@agent-ui/router` shape, one more subpath pair per pack):
```jsonc
{
  "name": "@agent-ui/code",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",                                  // CORE only — token types + registry + seam
    "./highlight": "./src/highlight/index.ts",              // self-registers on import
    "./highlight.css": "./src/highlight/highlight.css",
    "./markdown": "./src/markdown/index.ts",                // self-defines <ui-markdown> on import
    "./markdown.css": "./src/markdown/markdown.css"
  },
  "dependencies": { "@agent-ui/components": "*", "@agent-ui/shared": "*" }
}
```
`tsconfig.json` extends the repo strict base. The root workspace list gains the package. Exports point at
`.ts` source (the fleet ADR-0080 pattern; the `dist/` flip rides the fleet-wide deferral).

**Failure/edge handling.**
- *Name collision* — `npm run check` errors at install; verify `@agent-ui/code` is free (it is — grep 2026-07-10).
- *Do NOT export a pack from the `.` barrel* — SPEC-C1 AC3's tree-shake proof depends on it (the barrel header names the regression, the `@agent-ui/router/src/index.ts` precedent).

**Checkpoint:** `npm run check` exits 0; no other `package.json` changed.

## 3. LLD-C2 — layering trip-wire (→ SPEC-C1, C11)

`code/src/layering.test.ts` mirrors `router/src/layering.test.ts` exactly (the `import.meta.glob('?raw')`
specifier scan + the recursive inward-walk): (1) every import under `code/src/**` resolves to
`{@agent-ui/components, @agent-ui/shared}` or a local `./`/`../` path; (2) no source under
`components/src`, `a2ui/src`, `shared/src` imports `@agent-ui/code` (the structural catalog fence). The
allowed-specifier predicate and the inward-scan are the router file's, re-typed for `code`.

**Failure/edge handling.**
- *Negative control (required)* — plant an upward import on a unique token in `a2ui/src`; grep-confirm
  applied; the test MUST go red; revert.
- *Dynamic-`import()` blind spot* — the static regex is blind to `import()` (the documented router/app
  gap); no dynamic import exists under `code/src` at M1 — document, don't pretend coverage.
- *Sibling `router`* — `code` and `router` never import each other; the inward-scan covers
  `components/a2ui/shared`, and `router` is not a scan root (nor a dependency) — no assertion owed.

**Checkpoint:** `npm test` green incl. the trip-wire; NC bit and was reverted.

## 4. LLD-C3 — core token types + shared predicate (→ SPEC-C2)

```ts
// core/token.ts — the token types + ONE shared test-only predicate; zero imports (the sole runtime export
// is `roundTrips`, a pure helper the tests share — no DOM, no kernel).
export type TokenKind = 'plain' | 'comment' | 'string' | 'keyword' | 'number' | 'punctuation'
export interface Token { readonly kind: TokenKind; readonly text: string }
export type Highlighter = (code: string, language: string) => Token[]
// a shared assert helper the tokenizer tests reuse — NOT exported from the barrel (test-only):
export const roundTrips = (tokens: Token[], code: string): boolean =>
  tokens.map((t) => t.text).join('') === code
```
`TokenKind` is an `as const`-free literal union (erasableSyntaxOnly-safe). `roundTrips` is the SPEC-C2
invariant as a one-line predicate every tokenizer test and the seam test share (one definition, no drift).

**Failure/edge handling.** None (pure types + a pure predicate). The invariant is *enforced* at LLD-C4/C6,
*defined* here.

**Checkpoint:** `token.test.ts` proves `roundTrips` bites (a gap/overlap fixture fails).

## 5. LLD-C4 — highlighter registry (→ SPEC-C2)

```ts
// core/registry.ts — the icons Registry shape, signal-free, one engine slot (not a pack Map — a single
// active highlighter, last-wins).
export interface HighlighterRegistry {
  registerHighlighter(fn: Highlighter): void
  activeHighlighter(): Highlighter | null
  tokenize(code: string, language: string): Token[]
}
export class Registry implements HighlighterRegistry {
  #active: Highlighter | null = null
  registerHighlighter(fn: Highlighter): void { this.#active = fn }          // last-wins (SPEC-C2 AC2)
  activeHighlighter(): Highlighter | null { return this.#active }
  tokenize(code: string, language: string): Token[] {
    const fn = this.#active
    if (fn === null) return [{ kind: 'plain', text: code }]                 // verbatim-empty (SPEC-C2)
    const out = fn(code, language)
    if (out.map((t) => t.text).join('') === code) return out               // round-trips — accept
    console.warn(`[@agent-ui/code] highlighter (${fn.name || 'anonymous'}) output did not round-trip for language "${language}" — falling back to verbatim`)
    return [{ kind: 'plain', text: code }]                                  // fidelity floor — DOWNGRADE, logged not silent (SPEC-C2 AC4)
  }
}
export const highlighterRegistry: HighlighterRegistry = new Registry()      // the default singleton
export const registerHighlighter = (fn: Highlighter): void => highlighterRegistry.registerHighlighter(fn)
export const tokenize = (code: string, language: string): Token[] => highlighterRegistry.tokenize(code, language)
```
`tokenize` **hard-enforces** the round-trip invariant at the boundary: a misbehaving highlighter that
drops or reorders text is caught and downgraded to a single `plain` token — the code the user sees is
never corrupted (the ADR-0113 plain-wins spirit). The downgrade is **logged, not silent**: a single
`console.warn` names the offending highlighter (the `@agent-ui/icons` registry's last-wins `console.warn`
posture — a broken highlighter must surface, SPEC-C2 AC4). This is the *one* place resolution precedence
lives; `project.ts` reads it, never re-implements it (the icons `registry.body()` precedent).

**Failure/edge handling.**
- *Misbehaving highlighter* — the boundary `join()` check downgrades to plain AND warns once (above);
  unit-locked, with a well-behaved-highlighter no-warn negative control (SPEC-C2 AC4).
- *No-kernel gate* (`no-kernel.test.ts`) — a static scan asserts `core/*.ts` imports neither
  `@agent-ui/components` runtime (signals/kernel) nor a DOM signal; a planted `import { signal }` goes RED
  (SPEC-C2 AC3). The registry is a plain object holder — no reactivity (the ADR-0065 cl.4(b) reason).
- *Instance isolation* — `new Registry()` is independent of the singleton (SPEC-C2 AC2).

**Checkpoint:** registry + no-kernel suites green; the planted-import NC bit.

## 6. LLD-C5 — projection seam (→ SPEC-C3)

```ts
// core/project.ts — the ONLY core module that touches the DOM (document.createElement/createTextNode).
export function projectHighlight(host: Element, code: string, language: string): void {
  const tokens = tokenize(code, language)                                   // reads the active registry
  if (tokens.length === 1 && tokens[0].kind === 'plain') {                  // empty-registry / verbatim path
    host.replaceChildren(document.createTextNode(code))                     // SINGLE text node — byte-identical
    return
  }
  const frag = document.createDocumentFragment()
  for (const t of tokens) {
    if (t.kind === 'plain') frag.appendChild(document.createTextNode(t.text))
    else {
      const span = document.createElement('span')
      span.setAttribute('data-token', t.kind)                              // highlight.css targets this
      span.textContent = t.text                                            // textContent — never innerHTML
      frag.appendChild(span)
    }
  }
  host.replaceChildren(frag)
}
```
The seam builds the *pre-highlighted children* ADR-0113 escape hatch (a) always permitted, so `ui-code`
needs **zero** change — it is a plain `<ui-code>` whose light-DOM children happen to be token spans, still
`white-space: pre`, still `role="code"`. The verbatim branch's single text node is exactly the byte shape
a plain host-as-content `ui-code` has (SPEC-C3 AC2), so importing the core and calling the seam with no
highlighter registered is byte-identical to today.

**Failure/edge handling.**
- *`host` not a `ui-code`* — the seam is content-agnostic (it writes children of whatever `Element` it is
  given); the LLD-C9 renderer only ever passes a fresh `ui-code`. Documented: the seam does not assert the
  tag (keeps it reusable for the M2 diff view's rows).
- *Newline fidelity* — `code` carries its own `\n`s in text nodes (the `ui-code` `white-space: pre`
  contract, ADR-0113); the seam adds none. A trailing newline in `code` survives (round-trip).
- *Re-projection* — `replaceChildren` is idempotent; a later bound `Code.code` write (plain) clobbers the
  spans (SPEC-C3 AC3 — the ADR-0113 plain-wins lane, unchanged).
- *SSR/no-`document`* — `projectHighlight` touches `document`; a headless caller simply never calls it
  (the tokenize half is DOM-free — usable server-side).

**Checkpoint:** `project.test.ts` green incl. the empty-path single-text-node leg + the compose leg.

## 7. LLD-C6 — the seven tokenizers (→ SPEC-C4)

`highlight/langs/{ts,json,html,css,python,shell,markdown}.ts`, each `(code: string) => Token[]`, **line-
oriented with a single-level block-mode carry** (SPEC-C4): the scanner walks the code once, line by line
(keeping each `\n` as a `plain` boundary token so the round-trip holds), scanning each line
left-to-right for the coarsest classification and coalescing adjacent `plain` runs — **but it threads a
`BlockMode` across line boundaries** so a construct that opens on one line and closes on a later one
classifies every line it covers:

```ts
// highlight/scan.ts — the shared lexer core. ONE non-nesting block mode at a time (coarse, ADR-0119 cl.3).
type BlockMode = null | 'block-comment' | 'triple-string' | 'template'   // what carries into the next line
export interface ScanState { mode: BlockMode; closer: string }           // `closer` = the delimiter that ends it
// scanLine(line, state) -> { tokens, state }: if state.mode !== null it FIRST consumes up to (and incl.)
// the closer as the carried tier (comment/string), resetting mode; a line with no closer emits the WHOLE
// line at the carried tier and returns mode unchanged (the middle-of-block line — NOT plain). Only once
// mode is null does it fall to the ordinary line scan (string/comment/keyword/number/punctuation), which
// may itself OPEN a block mode (an unterminated `/*`, `'''`, or `` ` ``) that the next line inherits.
export function scan(code: string, open: /* language block-opener table */ BlockOpeners): Token[]
```
A shared `scan.ts` carries the common primitives (string-literal spans with escape handling, line- and
block-comment spans, number lexemes, a keyword-set matcher, a punctuation-set) **and** the `ScanState`
threading, so seven grammars share one lexer core — each language supplies only its opener table (which
delimiters start a block mode, its keyword set, its number shape). Per-language specifics (block-mode
constructs marked ⟂ carry across lines):

| Lang | comment | string | keyword | number | notes |
|---|---|---|---|---|---|
| ts/js | `//`, `/*…*/` ⟂ | `'` `"` `` ` `` ⟂ (template ⟂ carries; no interpolation recursion — coarse) | a fixed reserved-word set | int/float/hex | one grammar, two language keys |
| json | — | `"` keys+values | `true`/`false`/`null` | numbers | punctuation `{}[]:,`  |
| html | `<!--…-->` ⟂ | attr `"`/`'` values | tag names (as keyword) | — | `<`/`>`/`=` punctuation; **entities stay plain text** |
| css | `/*…*/` ⟂ | `"`/`'` | at-rules + property names (as keyword) | numbers+units | `{};:` punctuation |
| python | `#` | `'` `"` · `'''…'''` ⟂ / `"""…"""` ⟂ | a fixed keyword set | numbers | indentation stays plain |
| shell | `#` | `"`/`'` | a small builtin/keyword set (`if`/`then`/`fi`/`for`…) | — | `|`/`>`/`&` punctuation; `$VAR` plain |
| markdown | — | — | — | — | **fence-oriented**: only fenced/inline-code spans classify; prose stays plain (the "markdown fences" scope, ADR-0119 cl.3) |

_⟂ = a block-mode construct: it opens a `BlockMode` that the carry threads across line boundaries until its
closer (SPEC-C4 AC4). All others are single-line lexemes._

**Fidelity fence (SPEC-C4):** classification is best-effort and coarse — a keyword inside a string stays
`string` (strings scanned first), a CSS `#id` stays `punctuation`+`plain`, an HTML entity stays `plain`.
The tests assert the *tier on a marked span* of an agent-real fixture + the round-trip; they never assert
full-grammar fidelity.

**Failure/edge handling.**
- *Multi-line block (`/*…*/`, `'''…'''`, `` `…` ``)* — the `BlockMode` carry classifies every covered
  line at the carried tier, including delimiter-free middle lines (SPEC-C4 AC4). One level only: a `/*`
  inside a triple-string does NOT nest (coarse — the outer mode owns the span until its own closer).
- *Unterminated block* (opener with no closer to EOF) — the carry runs the tier to end-of-input; never
  throws, always round-trips (the last line simply ends still in-mode).
- *Empty input* — `[]` (or `[{plain,''}]`); `roundTrips([], '')` holds.
- *Non-ASCII / emoji* — treated as `plain` word chars; the scanner is byte-agnostic (operates on the
  string, no `RegExp` unicode assumptions that could drop a code unit).
- *Huge input* — line-oriented single pass, O(n); no backtracking regex (a catastrophic-backtrack pattern
  is the banned shape — the scanner uses index walks, not nested `*` regex).

**Checkpoint:** seven tokenizer suites green — each with its agent-real fixture, its tier assertion, its
round-trip, and one planted-misclassification NC; plus the SPEC-C4 AC4 three-line-block leg (all three
lines carried; a planted per-line mode-reset leaves the middle line `plain` and fails — the carry NC).

## 8. LLD-C7 — highlight self-registration + token CSS (→ SPEC-C4, C5)

```ts
// highlight/index.ts — the pack barrel. Self-registers on import (phosphor precedent), and exports the
// explicit control + the raw tokenizers (for a consumer building its own dispatch).
import { registerHighlighter, type Highlighter, type HighlighterRegistry } from '../index.ts'
import { tsjs } from './langs/ts.ts' /* …the seven… */
const GRAMMARS: Record<string, (code: string) => Token[]> = {
  ts: tsjs, js: tsjs, json, html, css, python, shell, markdown, md: markdown,
}
export const bundledHighlighter: Highlighter = (code, language) =>
  (GRAMMARS[language.toLowerCase()] ?? ((c: string) => [{ kind: 'plain', text: c }]))(code)  // unknown → plain
export const registerHighlight = (registry?: HighlighterRegistry): void =>
  (registry ?? undefined)?.registerHighlighter(bundledHighlighter) ?? registerHighlighter(bundledHighlighter)
registerHighlight()   // self-register into the default singleton on import (SPEC-C4 AC1)
```
`highlight/highlight.css` — the `:where()` token block + `@scope`d `[data-token]` consumption, mirroring
`code.css`'s two-block shape:
```css
:where(ui-code) {
  /* ROLE-level, NOT numbered steps — the token sheet is mid-migration by another seat (SPEC-C5). The
     build resolves each role against the LANDED --md-sys-color-* sheet. */
  --ui-code-token-comment:     var(--md-sys-color-neutral-on-surface-variant);   /* muted */
  --ui-code-token-keyword:     var(--md-sys-color-primary-on-surface);           /* accent */
  --ui-code-token-string:      var(--md-sys-color-success-on-surface);           /* distinct accent */
  --ui-code-token-number:      var(--md-sys-color-tertiary-on-surface);          /* further accent */
  --ui-code-token-punctuation: var(--md-sys-color-neutral-on-surface);           /* default ink */
}
@scope (ui-code) {
  [data-token='comment']     { color: var(--ui-code-token-comment) }
  [data-token='keyword']     { color: var(--ui-code-token-keyword) }
  [data-token='string']      { color: var(--ui-code-token-string) }
  [data-token='number']      { color: var(--ui-code-token-number) }
  [data-token='punctuation'] { color: var(--ui-code-token-punctuation) }
  @media (forced-colors: active) { [data-token] { color: CanvasText } }  /* never invisible (SPEC-C5) */
}
```
The role *choices* above are the build's to confirm against the landed sheet and a `color-verify` pass
(the palette owner may re-assign which accent family carries keyword vs string); the LLD pins only that
each is an **on-surface** role, distinct, and forced-colors-degrading.

**Failure/edge handling.**
- *CSS comment `*/` pitfall* — no `--c-*/…` token names in the block (the G9 `tabs.css` lesson); a browser
  smoke catches a mis-closed comment a jsdom text probe misses.
- *`data-token` on a non-highlight page* — inert (no `highlight.css` adopted ⇒ spans inherit `ui-code`'s
  ink; still legible — the identity spirit).
- *Adopting `highlight.css` without registering the highlighter* — harmless: no spans are produced, the
  CSS matches nothing.

**Checkpoint:** `highlight.test.ts` (self-registration + dispatch + unknown→plain) + `highlight-css.test.ts`
(role-level resolution, forced-colors leg) green.

## 9. LLD-C8 — markdown parser (→ SPEC-C6, C7)

```ts
// markdown/parse.ts — a small hand-rolled block+inline parser. Output is an AST of KNOWN node kinds only
// (no raw-HTML node kind exists — sanitization by construction, SPEC-C7).
export type Block =
  | { kind: 'heading'; level: 1|2|3|4|5|6; inline: Inline[] }
  | { kind: 'paragraph'; inline: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Block[][] }      // each item is a block sequence (nesting)
  | { kind: 'blockquote'; blocks: Block[] }
  | { kind: 'code'; language: string; text: string }          // fenced
  | { kind: 'table'; header: string[]; rows: string[][] }     // GFM; cells are plain strings (I-3)
export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'em'; inline: Inline[] } | { kind: 'strong'; inline: Inline[] }
  | { kind: 'code'; text: string }                            // inline code
  | { kind: 'link'; text: string; href: string }
export function parse(src: string): Block[]
```
Two passes: a **block** pass (line classification — ATX headings, fence open/close, `-`/`*`/`1.` list
markers with indent depth, `>` blockquote prefix, `|`-delimited table rows with a `---` separator line,
blank-line paragraph breaks) and an **inline** pass over each text run (`**`/`*` emphasis, `` ` ``
inline-code spans, `[text](url)` links). **Every `<…>` in the source is text** — the block pass never
opens an HTML lane; a `<script>` line is a paragraph whose inline is one `text` node containing `<script>…`
(SPEC-C7). Links keep their raw `href` string in the AST; the *renderer* hands it to `ui-text` whose gate
denies `javascript:` (LLD-C9) — the parser does no scheme logic (one gate, not two).

**Failure/edge handling.**
- *Unterminated fence* — the fence runs to end-of-input as a `code` block (never throws).
- *Malformed table* (ragged rows) — pad/truncate body rows to the header width; a table with no `---`
  separator is NOT a table (falls back to paragraphs) — the GFM rule.
- *Unbalanced emphasis* (`**bold`) — the unmatched marker stays literal `text` (no span opened).
- *Nested emphasis depth / pathological input* — the inline scanner is a single left-to-right pass with a
  small marker stack, O(n); no recursive regex.
- *Raw HTML block* (`<div>…</div>`) — renders as literal text lines (SPEC-C7 AC1); this IS the fence, not
  a bug.
- *Autolinks / reference links / footnotes / math* — unrecognized syntax stays literal text (out of subset,
  PRD §3) — never a throw, never a half-render.

**Checkpoint:** `parse.test.ts` (the conformance corpus, per construct) + `injection.test.ts` (the
injection corpus produces only `text`/denied-`link` nodes — no HTML node kind exists to produce).

## 10. LLD-C9 — markdown renderer + `ui-markdown` (→ SPEC-C6, C7, C8, C9)

```ts
// markdown/render.ts — AST → real fleet DOM. Side-effect imports self-define the fleet elements it builds.
import '@agent-ui/components/controls/text'   // ui-text (headings, paragraphs, blockquote, links)
import '@agent-ui/components/controls/code'   // ui-code (fenced)
import '@agent-ui/components/controls/table'  // ui-table (GFM tables)
import { projectHighlight } from '../index.ts'
export function renderBlocks(blocks: Block[]): Node[]   // → the fleet-DOM children ui-markdown adopts
```
The construct→element map (SPEC-C6 table) realized with `document.createElement` + property/attribute sets
only — **no `innerHTML` anywhere** (the grep-able absence, SPEC-C7 AC2):
- **heading** → `document.createElement('ui-text')`; `.setAttribute('as', 'h'+level)`; inline run appended
  as children (ui-text stamps the `<hN>` around them, ADR-0078 cl.4).
- **paragraph** → `ui-text as="p"`, inline run as children.
- **list** → native `document.createElement('ul'|'ol')`; each item → `<li>` holding its block sequence
  (a nested list is a `<ul>`/`<ol>` child — **I-2**; the fleet's `ui-list` is a `role="list"` flex stack
  that renders no `<li>`/ordinal/nesting, so it cannot serve this — SPEC I-2).
- **blockquote** → `ui-text as="blockquote"`, its block children rendered inside.
- **code** (fenced) → `document.createElement('ui-code')`; `.setAttribute('language', node.language)`;
  then `projectHighlight(el, node.text, node.language)` — verbatim single text node when `./highlight`
  is not registered, token spans when it is (**SPEC-C8**, the packs compose via the registry).
- **inline em/strong/code** → native `<em>`/`<strong>`/`<code>` (**I-1**), children recursed.
- **link** → `ui-text as="a"`; `.setAttribute('href', node.href)` — ui-text's `#syncLink` gate resolves +
  denies unsafe schemes (SPEC-C6 AC3); the renderer never touches `safeHref` itself (one gate).
- **table** → `document.createElement('ui-table')`; `.columns = header.map((label,i)=>({key:'c'+i,label}))`;
  `.rows = rows.map(r => Object.fromEntries(r.map((v,i)=>['c'+i, v])))` (**I-3** — plain-string cells).

```ts
// markdown/markdown.ts — the element (Display-class UIElement, defined in the pack, F4).
const props = { markdown: { ...prop.string(''), reflect: false } } satisfies PropsSchema
export class UIMarkdownElement extends UIElement {
  static props = props
  protected connected(): void {
    this.internals.role = ''            // transparent container (no role) — SPEC §4
    this.effect(() => this.replaceChildren(...renderBlocks(parse(this.markdown))))  // re-render on prop change
  }
}
if (!customElements.get('ui-markdown')) customElements.define('ui-markdown', UIMarkdownElement)
```
`markdown/markdown.css` scopes `ui-markdown` block flow + the native `<em>/<strong>/<code>/<ul>/<ol>/<li>`
styling (I-1/I-2) within `@scope (ui-markdown)`; every element owns its overflow (ADR-0102 — a wide table
scrolls inside `ui-table`, a wide fenced block inside `ui-code`). `markdown/markdown.md` is the ADR-0004
descriptor: `tag: ui-markdown`, `tier: display`, `extends: UIElement`, one `attributes[]` row (`markdown`,
string, default `''`, reflect `false`), `slots: []` (content is the prop, not host-as-content — the
`ui-table` precedent), `events: []`, `face.formAssociated: false`, `aria.role` transparent.

**Failure/edge handling.**
- *`markdown = ''`* — `renderBlocks([])` → `[]` → children cleared (SPEC-C6 AC4, no residue).
- *Re-assignment churn* — the `effect` re-runs and `replaceChildren` swaps wholesale; prior `ui-text`/
  `ui-code`/`ui-table` children disconnect (their own teardown runs — the fleet zero-residue contract).
- *`ui-text` `as="h6"`* — supported (ui-text `as` enum includes h1–h6, verified 2026-07-10); no clamp
  needed.
- *A link whose scheme ui-text denies* — the `ui-text as="a"` renders with no `href` (an inert placeholder,
  ADR-0114) — the link text is still visible; the injection corpus asserts this.
- *Empty/`null` table cell* — `resolveCell` (ui-table) already hardens; the renderer passes strings.
- *Descriptor drift* — `markdown-descriptor.test.ts` runs `validateComponentDescriptor` +
  `compareDescriptorToProps(parsed.attributes, UIMarkdownElement.props)` imported from
  `@agent-ui/components/descriptor` (the router per-package precedent — no components-side gate governs
  this element; SPEC-C10).

**Checkpoint:** `markdown.test.ts` (render structure per construct, jsdom) + descriptor trip-wire green;
browser structure legs deferred to LLD-C10.

## 11. LLD-C10 — gates · browser legs · size · reviewer (→ SPEC-C7, C8, C9)

- **`identity.test.ts`** (SPEC-C3 AC2, SPEC-C9): importing the `.` barrel registers **no** custom element
  and installs **no** global observer (`customElements.get('ui-markdown')` undefined after a core-only
  import; no `MutationObserver` constructed at module scope — grep + functional); `projectHighlight` with
  an empty registry yields a single text node equal to the code (byte-level). A structural note asserts
  the wave touches **no** file under `packages/agent-ui/components` (single-writer discipline — `ui-code`
  is unchanged, the identity guarantee's root).
- **`barrels.test.ts`** (SPEC-C1 AC3, SPEC-C8 tree-shake leg): the `.` barrel source re-exports no
  `./highlight`/`./markdown` module (grep); importing it registers no element and no highlighter;
  `./markdown` imported alone registers `ui-markdown` but leaves `activeHighlighter()` **null** (no
  tokenizer bytes — the compose separation, SPEC-C8 AC1); the exports map's targets all resolve (the
  router barrels.test.ts precedent + its negative controls).
- **`markdown.browser.test.ts`** (Chromium + WebKit — SPEC-C6/C7): rendered structure for each construct
  (heading/paragraph/list-nested/blockquote/fenced/table/link/emphasis) is non-zero and correctly nested;
  the **injection corpus** renders inert (zero `<script>`, no `on*` attr, raw tags visible as text); the
  `forced-colors` token-degrade leg (SPEC-C5 AC2) when `./highlight` is adopted. Each leg ships a biting
  negative control.
- **`scripts/measure-size.mjs`** gains **three** `@agent-ui/code` rows (the `@agent-ui/router` section is
  the template — one synthetic virtual entry per target, marginal over the components foundation):
  `@agent-ui/code .` (core), `@agent-ui/code/highlight`, `@agent-ui/code/markdown`. Budgets are
  **measured first at kickoff, then pinned** (ADR-0080); the core row doubles as the tree-shake byte proof
  (no pack mass). Provisional placeholders to confirm-then-pin: core ≤ 1.5 KB, `./highlight` ≤ 6 KB (seven
  grammars), `./markdown` ≤ 5 KB — **not gated until measured** (the ADR-0080 "measured, not guessed"
  rule; the LLD records intent, the build pins reality).
- **Reviewer** — `component-reviewer` GO (both axes ≥4, zero blockers) on `ui-markdown` before the M1
  commit; non-optional (the ui-slider DOT lesson; the whole-shape law — a markdown doc must render as a
  realistic multi-block specimen, not one paragraph).

**Failure/edge handling.**
- *One-engine pass* — a fail (the Wave-4 18-bug lesson); every browser leg runs both engines.
- *jsdom blind spots* — computed-style/forced-colors truth is browser-only; the WebKit forced-colors leg
  uses the structural-probe instrument-bridge (Chromium emulates, WebKit asserts the baseline).
- *Size measured over budget* — re-base needs its own note (the ADR-0049 precedent); do not silently widen
  a provisional number — pin the measured reality.

**Checkpoint:** all three gate suites green both engines; three size rows within pinned budgets; reviewer
GO recorded.

## 12. LLD-C11 — barrels/subpaths + CLAUDE.md DAG rows (→ SPEC-C1, C10, C11)

```ts
// code/src/index.ts — the CORE barrel. Token types + registry + the seam ONLY. NEVER a pack (SPEC-C1 AC3);
// a "convenience re-export" of ui-markdown or a tokenizer is the regression this header names (router
// precedent). ./highlight and ./markdown are reachable ONLY on their own subpaths.
export type { Token, TokenKind, Highlighter } from './core/token.ts'
export { Registry, highlighterRegistry, registerHighlighter, tokenize } from './core/registry.ts'
export type { HighlighterRegistry } from './core/registry.ts'
export { projectHighlight } from './core/project.ts'
```
`CLAUDE.md` edits (SPEC-C11, same change): the **Layout** list gains a `@agent-ui/code` row
(`@agent-ui/code`, the code+prose layer: core seams + `./highlight` + `./markdown`; sibling branch off
`components`, catalog-invisible by construction; depends on `components` + `shared`); the **Conventions**
DAG line extends to `shared ← components ← {a2ui, router, code} ← app` with `code` a sibling that `a2ui`/
`app` never import at v1 (like `router`). doc-review confirms no dangling reference.

**Failure/edge handling.**
- *Barrel leaks a pack* — `barrels.test.ts` grep (LLD-C10) catches it; the header names the regression.
- *CLAUDE.md drift* — the DAG line and Layout row are the records that would otherwise lie; repairing them
  in this change is the context-is-memory rule, not a follow-up.

**Checkpoint:** `npm run check && npm test` green; CLAUDE.md updated; doc-review clean.

## 13. Build sequence (dependency-ordered — matches the decomp edges; one writer per file)

1. **LLD-C1** skeleton *(serial PREP; `check` 0)*
2. **LLD-C2** trip-wire + NC *(after C1)*
3. **LLD-C3** token types *(after C1)*
4. **LLD-C4 + LLD-C5** registry · projection seam *(after C3; C5 needs C4's `tokenize`)* — C4 then C5, file-disjoint from C6+
5. **LLD-C6** the seven tokenizers *(after C3; parallel with C4/C5 — they share only the token type)*
6. **LLD-C7** highlight self-registration + `highlight.css` *(after C4+C6)*
7. **LLD-C8** markdown parser *(after C3; parallel with the highlight arm)*
8. **LLD-C9** markdown renderer + `ui-markdown` *(after C5+C8; consumes the seam + the AST)*
9. **LLD-C11a** core barrel + subpaths *(serial integration, after C5+C7+C9)*
10. **LLD-C10** identity + tree-shake + injection gates · browser legs *(after C9+C11a)*; size rows *(after C11a)*
11. **LLD-C11b** CLAUDE.md DAG rows *(with C2/C11a — the records repaired in-change)*
12. **Reviewer gate** *(after C10; before the M1 commit)*

## 14. Failure/edge summary (cross-cutting)

- **The core never imports upward** — the registry is a plain holder, signal-free; only `project.ts`
  touches `document`, and the `tokenize` half stays DOM-free (headless-usable). The no-kernel gate (C4) is
  the standing proof.
- **Plain always wins** — an empty registry, an unknown language, and a misbehaving highlighter all
  degrade to a single `plain` token / verbatim text (C4 boundary + C5 empty path); the user never sees
  corrupted code. This is the byte level of the identity guarantee (ADR-0113 preserved).
- **No raw-HTML lane exists** — the parser has no HTML node kind to produce and the renderer calls no
  `innerHTML`; the injection corpus proves inertness by construction, not by filter (C8/C10).
- **Sanitization on the one dangerous edge is inherited, not re-implemented** — links route through
  `ui-text`'s fail-closed scheme gate; the markdown layer owns no second `safeHref` (C9).
- **Single-writer discipline** — `package.json` is written by **LLD-C1 only** (it lands the full `exports`
  map + `dependencies` at skeleton time; the pack targets exist as files by the time their slice runs, so
  no later slice re-touches it); **LLD-C11a writes `code/src/index.ts` only** (the core barrel body — not
  `package.json`); only C10 writes `measure-size.mjs`; only C11b writes CLAUDE.md;
  `packages/agent-ui/components` is touched by **no** slice (the identity root); everything else is
  file-disjoint per the decomp.
- **Negative-control discipline** — every new gate ships a biting NC, grep-confirmed applied before
  trusting green (layering upward-import, planted kernel import, over-budget size, planted `innerHTML`,
  per-language misclassification, a barrel pack-leak).
