# LLD — `<component-preview>` tabbed code view (HTML / JS / CSS / JSON)

> Component LLD for GH [#1664](https://github.com/kimgranlund/agent-ui/issues/1664) (`size:big`,
> due-process Phase 2). Site-internal docs infra, tier: none — the `component-gallery.lld.md`
> precedent (no descriptor/coverage/budget obligation, no `SPEC-R#` family to trace). Trace targets:
> **GH #1664 Acceptance** (all four bullets) · **ADR-0077** (the `<component-preview>` this extends) ·
> **ADR-0119** (the code+prose family whose `./highlight` pack + `projectHighlight` seam this reuses;
> ADR-0139's editor is explicitly NOT reached — a read-only highlighted view suffices) · **ADR-0074**
> (the `--md-sys-color-*` token namespace the CSS tab surfaces).
> · proposed · 2026-08-26 · planner
>
> **Rulings honored as fixed constraints** (Kim 2026-08-26 + build-1664 Findings, both on the issue
> thread — none re-litigated here): component mode shows HTML + JS + CSS; a2ui mode shows JSON + CSS;
> no specimen shows all four. One Copy control per tab panel. Tab selection persists across knob
> edits. Always-on, no opt-out attribute. CSS tab = the `--md-sys-*` tokens the specimen's current
> state resolves to (token-driven per ADR-0078, not a `::part()` example).
>
> **Composes on (reused, never rebuilt):** `#state`/`#knobs`/`#refreshers` and the `#applyKnob` /
> `#rootProps` / `#a2uiPayload` semantics in `site/lib/component-preview.ts` · `bundledHighlighter`
> via `@agent-ui/code/highlight` (self-registering) + **`projectHighlight`** from `@agent-ui/code`
> (the existing Token[]→light-DOM projector, `code/src/core/project.ts`) + `@agent-ui/code/highlight.css`
> (the existing `[data-token]` color sheet — no new tokens minted, per the ticket's Token-bindings
> note) · `ui-code` as the panel body host (the display leaf `projectHighlight` was built to fill;
> zero change to `ui-code` itself, its SPEC-R6 "no highlighting built here" law stays intact) · the
> `import.meta.glob(..., { query: '?raw' })` bulk raw-import pattern already used 3× in `site/lib`.
>
> **Freeze discipline.** §3 (Interfaces) is the contract the builder codes against. A builder who
> cannot satisfy a frozen interface STOPS and escalates — the fix is a coordinated LLD repair, never
> a local deviation.

## 1 · Intent

Outside-in: every docs-site `<component-preview>` gains a tabbed code view in the canvas column,
sibling to the live artboard — each tab showing syntax-highlighted source that reproduces the
CURRENT knob state, with a per-panel Copy control, driven by the SAME `#state` the canvas renders
from (no second source of truth). Inside-out, the estate already provides almost everything: the
canvas semantics to mirror (`#applyKnob` for HTML, `#rootProps` for JS typing), the exact JSON
payload (`#a2uiPayload`), a complete highlighter + DOM projector + color sheet (`@agent-ui/code`),
and a proven raw-CSS glob pattern. The genuinely new logic is three pure string generators, one
tag→CSS-source resolver, and the tab/panel/copy chrome — all site-internal.

## 2 · Components

| ID | Component | File | Traces |
|---|---|---|---|
| LLD-C1 | pure source generators: `generateComponentHtml` · `generateComponentJs` · `formatA2uiJson` | `site/lib/preview-source.ts` (NEW) | #1664 Acceptance b1/b3 |
| LLD-C2 | CSS token source: raw-CSS glob + `--md-sys-*` extraction + computed-value resolution (`cssTokenSource`) | `site/lib/preview-source.ts` | Kim's CSS-tab ruling; ADR-0074 |
| LLD-C3 | tag→descriptor-key resolver (`descriptorKeyByTag`) | `site/lib/frontmatter.ts` (small addition — the md glob's ONE home) | derive-don't-duplicate |
| LLD-C4 | tab chrome: tablist + panels + per-panel header (label · Copy · status) + `ui-code` bodies | `site/lib/component-preview.ts` (`#buildCodeView` + helpers) | #1664 UI-shape schema |
| LLD-C5 | refresh wiring: rAF-coalesced regeneration of the ACTIVE panel, joined to `#refreshers` | `site/lib/component-preview.ts` | Acceptance b1 "same #state" |
| LLD-C6 | chrome styles (tab strip, header, focus ring, panel frame) | `site/lib/component-preview.css` | Feedback notes (focus ring) |
| LLD-C7 | gates: pure-generator jsdom probes + browser-tier tab suite | `site/lib/preview-source.test.ts` (NEW) · `site/lib/component-preview-code.browser.test.ts` (NEW sibling) | Acceptance b4 |

## 3 · Interfaces (frozen)

```ts
// ── LLD-C1/C2 — site/lib/preview-source.ts (pure module: no imports from component-preview.ts,
//    so no cycle; the caller passes the minimal structural shapes it already holds) ──────────────

/** The minimal knob shape the generators need — structurally satisfied by component-preview's
 *  internal Knob (name + kind); deliberately NOT an import from component-preview.ts. */
export interface KnobLike { readonly name: string; readonly kind: string }

/** HTML tab (component mode). Mirrors #applyKnob EXACTLY: kind 'skip' → omitted · boolean →
 *  bare attribute when raw === 'true', absent otherwise · SLOT_TEXT sentinel → escaped text child,
 *  never an attribute · undefined/'' raw → attribute omitted · else attr="escaped value".
 *  sampleAttrs (COMPONENT_SAMPLE_ATTRS) render as ordinary attributes; sampleChildren is the
 *  serialized outerHTML of a fresh COMPONENT_SAMPLE_CHILDREN[tag]() call (indented), '' when none. */
export function generateComponentHtml(
  tag: string, knobs: readonly KnobLike[], state: ReadonlyMap<string, string>,
  sampleAttrs: Readonly<Record<string, string>>, sampleChildren: string,
): string

/** JS tab (component mode). document.createElement + property assignments, typed EXACTLY as
 *  #rootProps types a2ui props: boolean knob → true (omitted when not 'true', matching HTML's
 *  absent-attribute default) · number knob → Number(raw), omitted when not finite · else →
 *  JSON.stringify(raw). SLOT_TEXT → el.textContent = JSON.stringify(text). kind 'skip' omitted.
 *  Closes with document.body.append(el). */
export function generateComponentJs(
  tag: string, knobs: readonly KnobLike[], state: ReadonlyMap<string, string>,
  sampleAttrs: Readonly<Record<string, string>>,
): string

/** JSON tab (a2ui mode). Input IS #a2uiPayload()'s two JSONL lines; output is each line parsed and
 *  re-stringified with 2-space indent, joined by a blank line — the literal JSONL a renderer
 *  ingests, pretty-printed, NOT a fresh derivation. */
export function formatA2uiJson(lines: readonly [string, string]): string

/** CSS tab (both modes). Resolves tag → its control's own .css source via LLD-C3 + the raw-CSS
 *  glob, extracts every distinct token name matching /var\(\s*(--md-sys-[\w-]+)/g (deduped,
 *  source order), resolves each via getComputedStyle(liveRoot).getPropertyValue(name), and renders:
 *    tag {
 *      /* --md-sys tokens this control's stylesheet consumes, resolved for the current state *​/
 *      --md-sys-color-primary-base: #6750a4;
 *      …
 *    }
 *  Unresolvable tag / missing css / empty extraction / null liveRoot → a single CSS comment line
 *  naming the reason (legible, never throws) — E2/E5. */
export function cssTokenSource(tag: string, liveRoot: Element | null): string

// ── LLD-C3 — site/lib/frontmatter.ts (addition) ──────────────────────────────────────────────
/** The ALL_DESCRIPTORS glob KEY whose parsed descriptor `tag` scalar equals `tag`, or undefined.
 *  preview-source.ts derives the sibling stylesheet key as key.replace(/\.md$/, '.css') — the
 *  md-basename ≡ css-basename invariant verified repo-wide 2026-08-26 across the full descriptor
 *  set (82 docs incl. the multi-doc folders radio · split · swiper ×5 · toast; pinned mechanically
 *  by an LLD-C7 probe, not by this prose count). */
export function descriptorKeyByTag(tag: string): string | undefined

// ── LLD-C4 — component-preview.ts internals (shape, not exports) ─────────────────────────────
type CodeTab = 'html' | 'js' | 'css' | 'json'
// component mode → ['html','js','css'] · a2ui mode → ['json','css']; active = first by default.
// Per-panel cache: #codeSources: Map<CodeTab, string> — Copy reads this, never re-serializes DOM.
```

New imports in `component-preview.ts`: `import '@agent-ui/code/highlight'` (self-registers the
tokenizers into the default registry) · `import '@agent-ui/code/highlight.css'` (the `[data-token]`
color sheet — rides the module exactly like its own `component-preview.css` import already does) ·
`import { projectHighlight } from '@agent-ui/code'`. Tab→language: html→`html`, js→`js`,
css→`css`, json→`json` (all in `bundledHighlighter`'s dispatch table).

## 4 · Structure + data flow

```
.preview-canvas (role=figure, existing #canvasCol)
 ├─ stage (createCanvasSurface — UNCHANGED; a2ui's surface.replaceChildren() only ever
 │         tears down INSIDE the surface)
 └─ .preview-code                          ← NEW, appended AFTER stage in #build(): a SIBLING of
     │                                       the artboard, so no rebuild ever touches it (E1)
     ├─ .preview-code-tabs  role=tablist aria-label="{target} source code"
     │    └─ <button role=tab id=… aria-selected aria-controls=…>HTML|JS|CSS|JSON</button> ×N
     └─ .preview-code-panel ×N  role=tabpanel aria-labelledby=… [hidden unless active]
          ├─ .preview-code-head
          │    ├─ <span class=preview-code-lang>HTML</span>       (the language label)
          │    ├─ <button class=preview-code-copy>Copy</button>   (per-panel, reference pattern)
          │    └─ <span class=preview-code-status role=status></span>  (accessible confirmation)
          └─ <ui-code> ← projectHighlight(codeEl, source, language)
```

- **Build (LLD-C4).** `#build()` appends `.preview-code` after `stage` inside `canvasCol`, with
  the mode's tab set. Panels exist up front (static DOM); only their `ui-code` bodies regenerate.
- **Refresh (LLD-C5).** One closure `#refreshCode` joins `#refreshers` — the existing array runs
  on first paint, every `#setKnob`, and every canvas read-back, so the code view rides the exact
  channel the knob controls already ride. It is **rAF-coalesced** (one pending flag): (a) knob-edit
  bursts collapse to one regeneration per frame, (b) first-paint ordering is immaterial (`#render`
  runs refreshers BEFORE building the canvas — the deferred pass runs after the live root exists,
  so `cssTokenSource`'s `getComputedStyle` target is present), (c) a2ui's dispose+rebuild settles
  before resolution.
- **Lazy generation.** Only the ACTIVE tab's source regenerates on refresh; activating a tab
  regenerates that panel immediately. `#codeSources` caches each panel's latest string — Copy
  copies the cache, so clipboard text ≡ rendered text by construction.
- **Generators' inputs** are what the element already holds: `#target`, `#knobs`, `#state`,
  `COMPONENT_SAMPLE_ATTRS[#target]`, a fresh `COMPONENT_SAMPLE_CHILDREN[#target]()` serialization
  (computed once at build, cached — sample children are knob-independent), `#a2uiPayload()`, and
  the live root (`#liveEl` in component mode; `(#surface).firstElementChild` in a2ui mode).
- **Tablist a11y** (Feedback note): roving tabindex (active 0, rest −1); ArrowLeft/ArrowRight +
  Home/End move focus AND selection (selection-follows-focus, the simple-tablist pattern);
  `aria-selected` + `aria-controls`/`aria-labelledby` pairing; `:focus-visible` ring in
  `component-preview.css` via existing `--md-sys-color-*` roles (no new tokens).
- **Copy confirmation** (Feedback note): `navigator.clipboard.writeText(#codeSources.get(tab))`;
  on resolve the panel's `role="status"` span reads "Copied" (announced text, not a color/icon
  flip alone) and clears after ~1.5 s; on reject it reads "Copy failed" (E3). The button itself
  never changes accessible name mid-press (no name-flap for AT).

## 5 · The CSS-tab mechanism (LLD-C2/C3 — the one open design, settled)

**Source acquisition:** `preview-source.ts` owns one glob —
`import.meta.glob('../../packages/agent-ui/components/src/controls/*/*.css', { query: '?raw',
import: 'default', eager: true })` — the exact pattern `frontmatter.ts`/`component-gallery.ts`/
`theme-loader.ts` already use. **Correlation is by descriptor, never folder name:** `frontmatter.ts`
(the md glob's one home) gains `descriptorKeyByTag(tag)` returning the glob KEY of the descriptor
whose parsed `tag` scalar matches; the stylesheet key is that key with `.md` → `.css`. This survives
the multi-doc folders (radio/split/swiper/toast each host several tag-named md+css pairs) where a
`folder → ui-{folder}` guess would mis-resolve; the basename invariant is pinned by a jsdom probe
(E4) so a future rename fails loud.

**Extraction:** every distinct `--md-sys-[\w-]+` name referenced via `var(...)` anywhere in that one
file, deduped, source order. **Deliberately NOT selector/state-matched** — matching would mean
re-implementing the cascade (`@scope`, `:where`, state selectors, light-dark()) in site JS, a forked
second cascade that WILL drift. Instead each name resolves to its **current computed value** via
`getComputedStyle(liveRoot).getPropertyValue(name)`: custom properties inherit, so the live
specimen's computed value already reflects whichever cascade branch is active (scheme, density,
scale, and any knob-driven attribute state that re-points a token). Output is a legible CSS block
(`ui-button { --md-sys-…: value; … }` — the tag as selector; light DOM, no `:host`), highlighted
with the `css` grammar. Honest documented limitation: the token LIST is file-scoped (every token the
stylesheet ever references), not filtered to the currently-consumed subset — the VALUES are
state-true; the list is complete rather than state-minimal. That trade is the ruling's substance
("which tokens are actually driving the rendered look") at a fraction of the machinery.

**Live root per mode:** component → `#liveEl` (its tag IS `#target`); a2ui → the surface's
`firstElementChild`, with the TAG read off that element (`tagName.toLowerCase()`) — a2ui targets are
catalog NAMES (`Button`), not tags, and the rendered root is the real `ui-*` element. A root whose
tag falls outside the controls glob (an app-tier component) degrades to the E2 comment line.

## 6 · Failure modes, edges, empties

| # | Case | Handling |
|---|---|---|
| E1 | a2ui knob edit tears down the surface (`replaceChildren` + renderer dispose) every edit | `.preview-code` is a sibling of `stage`, never inside the surface — tab selection + strip DOM persist by construction (the ratified persistence ruling). Browser probe: active tab unchanged across an a2ui knob edit. |
| E2 | tag unresolvable to a stylesheet (a2ui root outside the controls glob; missing css entry) | `cssTokenSource` returns one CSS comment naming the tag + reason; panel stays legible, nothing throws. |
| E3 | clipboard unavailable / write rejected (permissions, non-secure context) | Promise rejection caught → status "Copy failed"; no throw, no unhandled rejection. |
| E4 | md/css basename invariant breaks (a future rename) | jsdom probe walks every `ALL_DESCRIPTORS` key and asserts the sibling `.css` glob entry exists — the drift fails THAT gate, not a user's CSS tab. |
| E5 | stylesheet references zero `--md-sys-*` tokens, or live root absent at resolve time | Comment-line degradation (same shape as E2); the rAF-coalesced refresh re-runs on the next knob edit once a root exists. |
| E6 | hidden canvas (the tabbed-page precedent from `#updateEmptyHint`) | `getComputedStyle` still resolves custom properties inside `display:none` subtrees — values render; no reveal-observer machinery needed here. |
| E7 | JSON tab is two pretty-printed objects (JSONL), not one JSON document | Intentional — it is the literal ingest payload. The scanner-based `json` tokenizer degrades gracefully on the concatenation; worst case is plain ink (highlighting is a non-essential enhancement per the highlight pack's own SPEC-C5 stance). |
| E8 | `COMPONENT_SAMPLE_INIT` property-only seeds (no attribute form) | Documented limitation: they appear in neither generated HTML nor JS (they are demo scaffolding, not knob state). Noted here, not papered over with fake output. |
| E9 | disconnect/reconnect (`#built` short-circuit) | The code view lives in the element's own subtree like the knob column — persists across moves; a2ui's reconnect canvas rebuild (existing path) triggers no code-view work until the next refresher run. |
| E10 | XSS-shaped knob text (free-text knobs) | Generators build STRINGS; `projectHighlight` writes via `createTextNode`/`textContent`, never innerHTML — no injection surface. HTML-generator escaping (`& < > "`) is about output correctness, pinned by an LLD-C7 probe. |

**Risks / non-decisions (no ADR earned):** no ratified decision is contradicted; the five forks were
resolved on the issue thread (Kim ×2, build-1664 Findings ×3) and are treated as fixed inputs. The
one judgment original to this LLD — file-scoped token list over selector-matched — is a reversible
site-internal rendering choice, recorded in §5, not an architecture fork.

## 7 · Acceptance criteria (checkable predicates)

1. `npm run check` exit 0 · `npm test` exit 0 · `npm run test:browser` exit 0 (judged by exit
   codes, per CLAUDE.md).
2. jsdom (`site/lib/preview-source.test.ts`): HTML generator ≡ `#applyKnob` semantics per kind
   (boolean presence/absence · skip omitted · SLOT_TEXT as text child · escaping, E10) · JS
   generator ≡ `#rootProps` typing (boolean/number/string; non-finite number omitted) ·
   `formatA2uiJson` round-trips (`JSON.parse` of each pretty block ≡ the input lines) · E4
   basename-invariant probe · E2/E5 comment-line degradations.
3. Browser (`site/lib/component-preview-code.browser.test.ts`, Chromium + WebKit, same mount/raf
   conventions as `component-preview.browser.test.ts`): component mode renders a tablist of
   exactly HTML/JS/CSS and a2ui mode exactly JSON/CSS · clicking a tab swaps the visible panel
   (`hidden` toggling + `aria-selected`) · a knob edit updates the visible panel's rendered text
   (e.g. `variant` knob → generated HTML gains `variant="…"`) · active tab survives an a2ui knob
   edit (E1) · ArrowRight moves selection + focus (roving tabindex) · Copy writes the panel source
   to the (stubbed) clipboard and the `role=status` span reads "Copied" · the CSS panel contains at
   least one `--md-sys-` line resolved to a non-empty value for `ui-button`.
4. No new highlighter, no CodeMirror: the diff imports only `@agent-ui/code` /
   `@agent-ui/code/highlight` / `@agent-ui/code/highlight.css` from the code family (grep-checkable).
5. Existing gates stay green untouched: the three current `component-preview*` browser suites +
   the slot-text partition gate run unmodified.

## 8 · Agent verification

No existing instrument covers this surface — the build creates both harnesses named in §7:
`site/lib/preview-source.test.ts` (jsdom, item 2) proves the three generators + `cssTokenSource`
against `#applyKnob`/`#rootProps` semantics and the E2/E4/E5 edges; `site/lib/component-preview-
code.browser.test.ts` (Chromium + WebKit, item 3) proves the tab strip, switching, knob-driven
regeneration, tab persistence across an a2ui rebuild, tablist a11y, and Copy end to end on the real
DOM. Both run under the standing gates (§7 item 1).

## 9 · Build sequence (checkpointed)

1. **s1** `descriptorKeyByTag` (frontmatter.ts) + `preview-source.ts` generators + the full jsdom
   probe file — checkpoint: `npm test` green.
2. **s2** `#buildCodeView` chrome + refresh wiring + highlight imports in `component-preview.ts`,
   styles in `component-preview.css` — checkpoint: `npm run check` green, manual `npm run dev` look.
3. **s3** `component-preview-code.browser.test.ts` complete — checkpoint: `npm run test:browser`
   green both engines.
4. **s4** doc-checker review of this LLD's as-built fidelity + code review per the ticket's
   dod-checker routing; findings closed; commit.
