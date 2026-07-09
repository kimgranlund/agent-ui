# LLD — Content Family (`ui-code` + the `ui-text` hyperlink + `ui-disclosure`, catalog rows, report exemplar)

> Refines: [`../spec/content-family.spec.md`](../spec/content-family.spec.md) (SPEC-R1…R23, SPEC-N1…N5)
> under [ADR-0113](../adr/0113-content-family-v1-scope.md) + [ADR-0114](../adr/0114-text-hyperlink-href.md)
> (both accepted; every fork as recommended). Build plan:
> [`../decompositions/content-family-build.decomp.json`](../decompositions/content-family-build.decomp.json)
> (coverage-clean, plan mode). · proposed · 2026-07-08 · planner
>
> **Composes on:** `UIElement` (`dom/element.ts`) + the props/signal system (`dom/props.ts`) +
> `ElementInternals` ARIA (fleet law) + the shipped `controls/text/text.ts` stamp/heal machinery (ADR-0078
> cl.4 — reused, not re-decided). **No new package** (ADR-0113 cl.7): two ordinary control folders,
> `controls/code/` and `controls/disclosure/`, plus an in-place extension of `controls/text/`. Catalog work
> lands in `packages/agent-ui/a2ui/src/catalog/default/` + `src/catalog/conformance.ts`; the feed partition
> in `a2ui/tools/agent/feed-catalog.ts`; the exemplar in `a2ui/src/examples/`.
>
> **Freeze discipline.** §2–§5 interfaces are the fan-out contract. A builder who cannot satisfy a frozen
> interface STOPS and escalates — the fix is a coordinated LLD/decomp repair, never a local deviation.
> This LLD carries the fleet's **first security-sensitive component contract** (§2); its §8 security test
> file is NON-optional and is reviewed with the same weight as the code.

## 1 · Intent

Implement the v1 content family: a zero-machinery verbatim code leaf whose whole contract is "show this
text exactly, scrolled inside your own box"; the hyperlink capability on `ui-text` whose whole contract is
"a real `<a>` for allowed destinations, plain text for everything else — decided at ONE gate every write
path crosses"; and a native-`<details>` disclosure whose whole contract is "fold content behind a summary
with a two-way, always-announced `open`." Then make all three catalog-reachable in the same wave
(`Code`, `Disclosure`, `Text.href`), pay the feed partition, and teach the idiom with the report exemplar.

## 2 · The hyperlink extension (`controls/text/`) — SPEC-R7…R13

### LLD-C1 — the pure gate (`controls/text/href.ts`, DOM-free)

```ts
/** The fleet scheme policy — ONE constant, imported by BOTH enforcement lines (component gate +
 *  validator first line). Widening it is a one-line, gate-visible edit (ADR-0114 fork F1). */
export const SAFE_HREF_SCHEMES = ['https:', 'http:', 'mailto:'] as const

/**
 * The component gate (SPEC-R8, normative verdict procedure). Returns the AUTHOR'S string byte-identical
 * on allow (the gate validates, never rewrites), null on deny OR no-destination.
 *  - `raw.trim() === ''` → null  (no destination — the default-`''`/whitespace self-link trap, SPEC-R8 AC7)
 *  - `new URL(raw, base)` throws → null  (unparseable = denied, fail-closed)
 *  - resolved `url.protocol` ∉ SAFE_HREF_SCHEMES → null  (denied)
 *  - else → raw  (allowed; the anchor's own resolution equals the gate's parse by construction — both
 *    resolve against the same base, so validating the parse and applying the raw string never diverge)
 * Parsing with `new URL` is load-bearing: it applies the SAME C0/whitespace normalizations navigation
 * would ("java\nscript:", " JAVASCRIPT:" die here) — a string-prefix check is non-conformant (SPEC-R8).
 * `base` is a parameter (the component passes `document.baseURI`) so the module stays DOM-free and the
 * validator side can reuse the CONSTANT without inheriting a `document` dependency.
 */
export function safeHref(raw: string, base: string): string | null

/** The fixed anchor policy (ADR-0114 F3 — no props at v1): component-set constants, never
 *  author-supplied. Exported alongside the gate so ui-attachment (feed-family LLD-C6) — the family's
 *  OTHER href consumer — shares one module instead of a second copy. */
export const LINK_REL = 'noopener noreferrer'
export const LINK_TARGET = '_blank'
```

Exported from the components package via the existing per-control `exports` mechanism (the ADR-0080 T4
gate demands the entry regardless); `@agent-ui/a2ui` imports `SAFE_HREF_SCHEMES` from it (the a2ui →
components dependency edge is already declared and exercised — `renderer/*.ts`; layering trip-wires
unaffected). One policy constant, two independent enforcement mechanisms (SPEC-R12).

**Cross-family reconciliation (doc-review MAJOR, closed):** feed-family's LLD-C6 independently specified
this same gate as `gateHref(raw)`/`_base/href-gate.ts` with an internal `document.baseURI` read — a
silent policy fork if both waves built as originally written. Resolved: `controls/text/href.ts` (THIS
module, DOM-free, `base` an explicit parameter) is the ONE canonical home; feed-family's LLD-C6 now
imports `safeHref`/`SAFE_HREF_SCHEMES`/`LINK_REL`/`LINK_TARGET` from here and passes `document.baseURI`
at its own call site. No `_base/href-gate.ts` is created. Whichever wave (content or feed) lands first,
this file's shape is authoritative — the other imports, never re-specifies.

### LLD-C2 — the element extension (`controls/text/text.ts`)

Props delta (everything else in the file stands):

```ts
as:   { ...prop.enum(['none','h1','h2','h3','h4','h5','h6','p','span','blockquote','a'] as const, 'none'), reflect: true },
href: { ...prop.string(''), reflect: true },   // reflected — the HOST attribute is inert (SPEC-R9)
```

**The one-gate mechanism — named exactly.** ONE private writer, `#syncLink()`, is the SOLE place the
stamp's `href`/`rel`/`target` are ever written or removed:

```ts
/** Applies the gated link state to the current stamp. The ONLY writer of stamp href/rel/target. */
#syncLink(): void {
  const stamp = this.#stamp
  if (!stamp) return
  if (stamp.localName !== 'a') {
    // a non-anchor stamp never carries link attributes (SPEC-R7 AC2 — href without as="a" is inert)
    stamp.removeAttribute('href'); stamp.removeAttribute('rel'); stamp.removeAttribute('target')
    return
  }
  const gated = safeHref(this.href, document.baseURI)   // THE gate — LLD-C1
  if (gated === null) {
    stamp.removeAttribute('href'); stamp.removeAttribute('rel'); stamp.removeAttribute('target')
  } else {
    stamp.setAttribute('href', gated)                    // byte-identical (never rewritten)
    stamp.setAttribute('rel', 'noopener noreferrer')     // component-set constants (SPEC-R11)
    stamp.setAttribute('target', '_blank')
  }
}
```

**Call sites (exactly two internal, covering all four external write paths + the clobber path):**

1. **A new `connected()` effect** — `this.effect(() => { this.href; this.as; this.#syncLink() })` —
   wakes on any `href` or `as` change. The four external write paths ALL land here, because all four
   converge on the props signal: **P1 attribute** → `attributeChangedCallback` → prop signal; **P2
   property** → prop signal; **P3 factory** (`textFactory.applyProp` sets the accessor) → prop signal;
   **P4 bound** (the renderer's bound-prop effect writes the accessor) → prop signal. Declared AFTER the
   restamp effect so the initial run finds the initial stamp.
2. **The tail of `#restamp()`'s FALL-THROUGH branch only** (doc-review F3 precision) — the real
   `#restamp()` has three exits: the `none`-branch return, the same-tag-no-op return, and the
   fall-through that creates/replaces the stamp — `#syncLink()` sits ONLY at the fall-through tail.
   This covers exactly the observer-driven paths that change the stamp WITHOUT a prop write: the
   `textContent`-clobber re-stamp (`#heal()`'s detached branch nulls the stamp and calls `#restamp`,
   which falls through and re-syncs — the gated href survives every bound-text write, SPEC-R8 AC8) and
   parser-order arrivals. The other two exits never need a call: `none` unwraps to plain text (no
   stamp left to gate) and same-tag is a no-op the dedicated href/as effect (item 1) already covers —
   href updates never rely on either. (`#heal()`'s adopt-stray-children branch never replaces the
   stamp, so it needs no call of its own.) A future refactor to `#restamp()` must preserve this: adding
   a fourth early-return without a `#syncLink()` call would silently break the clobber-survival leg.

No second gate, no cached verdict, no other writer: grep-able invariant — `setAttribute('href'` appears
exactly once in `text.ts`, inside `#syncLink` (pinned by a test, §8). The gate is per-value, not
per-render (ADR-0114 Consequences); `URL` parsing on a prop write is negligible. ui-text gains **no new
observer** — the existing childList observer and effects carry everything.

### LLD-C3 — the stylesheet delta (`controls/text/text.css`)

- **Token block append** (after `[emphasis]`, keeping the declared order law):
  `:where(ui-text) { --ui-text-link-ink: var(--md-sys-color-primary); }` — the link ink role. Build-verify
  (named, not guessed): the token color-audit's AA probe measures primary-on-surface for text use; if it
  fails AA the fallback is repointing this default to an AA text role (a token edit, not a mechanism
  change — the chart LLD §7-row-9 pattern).
- **Styles block**: the stamp-transparency reset's `:is()` gains `a` (so an anchor stamp inherits
  typography/geometry — zero geometry delta, SPEC-R7 AC1). Declared AFTER it, the link leg — on
  `:scope > a[href]` (attribute-gated: a DENIED stamp keeps prose rendering, underline-free, by
  construction — the CSS needs no knowledge of the gate):

  ```css
  :scope > a[href] {
    color: var(--ui-text-link-ink);
    text-decoration-line: underline;              /* underline ALWAYS — never hue-only (ADR-0057) */
    text-underline-offset: 0.15em;
    text-decoration-thickness: from-font;
  }
  :scope > a[href]:hover { text-decoration-thickness: 2px; }
  :scope > a[href]:focus-visible { /* the fleet focus treatment — build-verify: reuse the shipped
    focus-ring token/pattern the button/text-field family declares; never a bespoke ring */ }
  /* :visited shares the link ink at v1 — no visited role minted (SPEC-R13, stated) */
  @media (forced-colors: active) {
    :scope > a[href] { color: LinkText; }         /* underline survives; system ink (SPEC-R13 AC2) */
  }
  ```

### LLD-C4 — descriptor + tests (`controls/text/`)

- `text.md`: `as` enum row gains `a`; NEW `href` attribute row (reflected string; "the scheme gate:
  https/http/mailto, fail-closed; denied ⇒ plain text — see ADR-0114"); `aria:` section gains the
  link/denied-generic mapping note; the sole-signifier + sources-not-actions usage guidance (ADR-0114
  Repairs); marginal re-measured.
- Tests: `text.test.ts` gains href reflection/`@ts-expect-error`/`as='a'` legs; `text-css.test.ts` gains
  the link-leg + token rows; `text.browser.test.ts` gains SPEC-R7 AC1 (zero geometry delta), SPEC-R13 AC1/
  AC2 (computed underline/ink; forced-colors), SPEC-R8 AC8 (clobber survival), SPEC-R10 AC2 (tab-order),
  SPEC-R9 AC2 (host click, no navigation).
- **NEW `text-href-security.test.ts`** — the dedicated negative-control file (§8; SPEC-N5).

## 3 · `ui-code` (`controls/code/`) — SPEC-R1…R6

### LLD-C5 — the element (`controls/code/code.ts`)

```ts
const props = {
  language: { ...prop.string(''), reflect: true },   // inert metadata (SPEC-R4) — no enum, no effect
} satisfies PropsSchema

export interface UICodeElement extends ReactiveProps<typeof props> {}
export class UICodeElement extends UIElement {
  static props = props
  protected connected(): void {
    this.internals.role = 'code'   // constant — the ONE internals line (SPEC-R5; the list.ts precedent)
  }
}
```

That is the whole file (plus the self-define guard). **Normative absences** (SPEC-R1 AC2): no
`MutationObserver`, no stamp, no template, no effects, no clipboard API, no tokenizer — the zero-machinery
leaf. Content is host-as-content: the catalog's `code → textContent` writes replace plain text with plain
text; nothing to heal. `render()` stays the inherited void.

### LLD-C6 — the stylesheet (`controls/code/code.css`)

```css
:where(ui-code) {
  --ui-code-font: var(--ui-mono);                                    /* the minted mono constant */
  --ui-code-size: var(--md-sys-typescale-body-medium-size);          /* body-class metrics (ADR-0113 cl.2) */
  --ui-code-line-height: var(--md-sys-typescale-body-medium-line-height);
  --ui-code-ink: var(--md-sys-color-neutral-on-surface);
  --ui-code-surface: var(--ui-container-bg);  /* CERTAIN repoint (doc-review F2): `-surface-container`
     does not exist in tokens.css. The real cross-family surface seam is `--ui-container-bg`
     (ADR-0015 cl.2, ui-card's own default `var(--md-sys-color-neutral-surface)`, card.css:59) —
     ride the seam, not a raw role, so ui-code's surface stays consistent with every other
     container-seam consumer */
  --ui-code-radius: var(--ui-radius-base);                           /* the fleet referent (entry/container class) */
  --ui-code-pad-inline: 12px;                                        /* density-INVARIANT frame quantities */
  --ui-code-pad-block: 8px;                                          /*   (ADR-0113 cl.2 — not rhythm) */
}
@scope (ui-code) {
  :scope {
    display: block;
    font-family: var(--ui-code-font);
    font-size: var(--ui-code-size);
    line-height: var(--ui-code-line-height);
    color: var(--ui-code-ink);
    background: var(--ui-code-surface);
    border-radius: var(--ui-code-radius);
    padding: var(--ui-code-pad-block) var(--ui-code-pad-inline);
    white-space: pre;            /* verbatim — newlines/indentation live in the text nodes (SPEC-R2) */
    overflow-x: auto;            /* the component OWNS overflow (ADR-0102 Lane A) */
    max-inline-size: 100%;       /* never blows out a flex/feed container; the scroll box absorbs excess */
    user-select: text;
    tab-size: 4;
  }
  @media (forced-colors: active) {
    :scope { color: CanvasText; background: Canvas; border: 1px solid CanvasText; }
  }  /* the surface keeps shape via the border when fills are forced away */
}
```

- **The scroll box is the host itself** — no inner wrapper: host-as-content means the text nodes are host
  children, and `overflow-x: auto` + `max-inline-size: 100%` on the host is the whole-shape answer
  (SPEC-R2 AC1). Chromium's focusable-scroller then targets the host directly (SPEC-R5 AC2).
- No `[density]` legs — every quantity above is frame-class (density-invariant, ADR-0113 cl.2). No
  `[size]`/`[scale]` rows (Display class, SPEC-R20).

### LLD-C7 — descriptor + tests (`controls/code/`)

`code.md` per the display-leaf shape (`icon.md`/`sparkline.md` precedent): `tag: ui-code`,
`tier: display`, `extends: UIElement`, `attributes[]` = `language` only (mirrors `static props`),
`properties: []`, `events: []`, `slots:` the light-DOM code text (host-as-content; the **leading-newline
authoring note** — SPEC-R2 AC4), `parts: []` (no interior nodes), `customStates: []`,
`face.formAssociated: false`, `aria:` role `code` via internals, `keyboard:` the platform
focusable-scroller note + the named WebKit residual (SPEC-R5), `geometry:` Display class, no `size`
attribute, a `forcedColors:` line, the `marginal:` size note. Tests: `code.test.ts` (props/reflection,
role, zero-machinery grep leg, SPEC-R3 plain-text legs), `code-descriptor.test.ts` (trip-wire),
`code.browser.test.ts` (SPEC-R2 AC1–AC3 whole-shape/scroll/copy, SPEC-R5 AC2, forced-colors computed
style, both engines).

## 4 · `ui-disclosure` (`controls/disclosure/`) — SPEC-R14…R18

### LLD-C8 — the element (`controls/disclosure/disclosure.ts`)

```ts
const props = {
  open:    { ...prop.boolean(false), reflect: true },  // prop-as-source-of-truth (ADR-0101 + Erratum)
  summary: { ...prop.string(''), reflect: true },      // the fold's one-line label (textContent-only)
} satisfies PropsSchema
```

`connected()` (order is load-bearing, the text.ts precedent):

1. **Create-once the part** (idempotent — the ADR-0017 cl.1 lineage): `#ensureParts()` builds
   `<details data-part="details"><summary data-part="summary"><span data-part="chevron" aria-hidden="true"></span><span
   data-part="summary-text"></span></summary><div data-part="body"></div></details>`, adopts every
   pre-existing host child node into the body part (moves, never clones — ADR-0022), and appends the
   details part as the host's only element child.
2. **Summary effect**: `summaryText.textContent = this.summary` — prop-driven, markup-free (SPEC-R16 AC2;
   updating it never touches `open`).
3. **Open effect** (model→platform): `details.open = this.open` — a same-value assignment is a platform
   no-op (no toggle event), the loop-breaker's first half.
4. **The platform listener** (platform→prop→announce): `details` `toggle` (via `this.listen` /the
   connection AbortSignal): `const now = details.open; if (now !== this.open) this.open = now;`
   then `this.emit('toggle')` — the host announce, fired with the prop already settled (ADR-0101
   mechanic 3). This ONE listener is the sole announcer; it hears user clicks, find-in-page auto-expand,
   AND the open-effect's own platform write, so **every actual transition announces exactly once**:
   - *user click*: platform flips `details.open` → `toggle` → prop settles → one host `toggle`; the open
     effect then re-runs to a same-value no-op.
   - *model/prop write*: prop → open effect → `details.open` changes → platform `toggle` → listener finds
     `now === this.open` (no re-write, no second wake) → one host `toggle`. Model-driven transitions
     announce — native-faithful, the ADR-0101 consequence; the A2UI bind's write-back is an `Object.is`
     no-op.
   - *re-assert* (`open = true` while open): open effect assigns same value → no platform toggle → no
     event (SPEC-R15 AC2). The native `<details>` toggle-event coalescing (rapid double-flip ⇒ one event
     with final state) is accepted: the prop is the source of truth either way.
5. **The heal observer** (childList on the HOST, installed last so it never observes its own setup — the
   text.ts discipline): strays → adopt into the body part; the details part detached (a `host.textContent`
   clobber) → null the part refs, `#ensureParts()` fresh (never reuse — stale content), re-run summary/
   open sync. Self-converging ≤2 passes. Disconnected in `disconnected()` (zero residue).

No internals role, no host ARIA — the details/summary part carries all semantics (SPEC-R17; ADR-0017
cl.5 lineage). No focus machinery: the summary is the natively focusable element.

### LLD-C9 — the stylesheet (`controls/disclosure/disclosure.css`)

```css
:where(ui-disclosure) {
  --ui-disclosure-height: var(--ui-height-md);        /* the summary row = control height (Pattern class) */
  --ui-disclosure-font: var(--ui-font-md);
  --ui-disclosure-glyph: var(--ui-disclosure-font);   /* chevron = font (the §4.1 inline-affordance law) */
  --ui-disclosure-body-pad-block: var(--ui-space-sm); /* body rhythm — rides [density] free */
  --ui-disclosure-body-pad-inline: var(--ui-space-md);
  --ui-disclosure-gap: var(--ui-space-sm);
}
@scope (ui-disclosure) {
  :scope { display: block; }
  :scope [data-part='summary'] {
    display: flex; align-items: center; gap: var(--ui-disclosure-gap);
    block-size: var(--ui-disclosure-height);
    font-size: var(--ui-disclosure-font);
    line-height: var(--ui-control-line-height);       /* single-line control row (ADR-0036) */
    cursor: pointer;
    list-style: none;                                 /* hide the native marker… */
  }
  :scope [data-part='summary']::-webkit-details-marker { display: none; }  /* …both engines (SPEC-R18) */
  :scope [data-part='chevron'] {
    inline-size: var(--ui-disclosure-glyph); block-size: var(--ui-disclosure-glyph);
    background: currentColor;                          /* mask-glyph chevron — the select.css caret idiom;
                                                          currentColor ⇒ WHCM-correct for free */
    mask: /* the fleet chevron data-URI / shared glyph — build reuses the existing caret asset */;
  }
  :scope [data-part='details'][open] > [data-part='summary'] [data-part='chevron'] {
    rotate: 90deg;                                     /* orientation = state; NO transition at v1 (SPEC-R18) */
  }
  :scope [data-part='body'] {
    padding: var(--ui-disclosure-body-pad-block) var(--ui-disclosure-body-pad-inline);
  }
}
```

- Summary row height + glyph are frame-class (density-invariant); the body padding rides the `--ui-space`
  ladder (density-responsive) — the Pattern split, SPEC-R18 AC2.
- **No fold animation**: no `transition`/`animation`/`::details-content` rule anywhere in the sheet — a
  grep-able absence pinned in the css test (the ADR-0106 precedent).
- Forced colors: summary/body text ride `CanvasText` by inheritance; the chevron is `currentColor` mask —
  no dedicated block needed beyond the css test asserting it (SPEC-R18 AC3).

### LLD-C10 — descriptor + tests (`controls/disclosure/`)

`disclosure.md`: `tag: ui-disclosure`, `tier: pattern` (doc + demo pages), `extends: UIElement`,
`attributes[]` = `open`/`summary` (mirrors props), `events: [toggle]` (fires on every actual transition,
after the prop settles — the ADR-0101 one-sentence contract), `slots:` children = the body (the heal
invariant note), `parts: [details, summary, chevron, summary-text, body]`,
`face.formAssociated: false`, `aria:` native (the details part; no internals), `keyboard:` Enter/Space
on the summary (platform), `geometry:` Pattern (summary row = control height; no `size` attribute),
`forcedColors:` line, `marginal:` note. Tests: `disclosure.test.ts` (anatomy, adoption, summary/open
sync, exactly-one-toggle legs — if jsdom's details toggle-task proves absent, drive the listener path
directly and mark the browser legs as the platform truth, the instrument-bridge note),
`disclosure-descriptor.test.ts`, `disclosure.browser.test.ts` (SPEC-R15 AC1/AC4 click + find-in-page
[Chromium; WebKit structural probe], SPEC-R17 AC1/AC2, SPEC-R18 AC1–AC3, whole-shape).

## 5 · Fleet integration, site, catalog, teaching

**LLD-C11 — the serial integration slice** (ONE writer; after §2–§4 folders land):
`controls/index.ts` exports both controls · `descriptor/component-styles.css` imports both sheets ·
`site-coverage.test.ts` tier membership: display list gains `code`, pattern list gains `disclosure`
(gate edits — negative control: reverting either fails `npm test`) · components `package.json` `exports`
entries for `./controls/code`, `./controls/disclosure` (and the `href.ts` seam if routed as its own
subpath) · `npm run size` by hand; the anticipated family-budget re-base recorded as its own note
(SPEC-N4, the ADR-0107 Amendment precedent).

**LLD-C12 — site pages.** `site/code-doc.html` (tier=display ⇒ doc only) + `site/disclosure-doc.html` +
`site/disclosure-demo.html` (tier=pattern ⇒ doc+demo) + toc/nav rows. The code page mounts overflow/
verbatim fixtures; the disclosure demo exercises click/model toggles. (The site's own `code-block.ts` is
NOT touched — the booked follow-up consumer, PRD-G5.)

**LLD-C13 — catalog rows + factories + validator leg + feed dispositions**
(`a2ui/src/catalog/default/` + `conformance.ts` + `tools/agent/feed-catalog.ts`):

```jsonc
// catalog.json → components
"Code": { "properties": {
  "code":     { "type": { "type": "string" }, "bindable": true, "mapsTo": "textContent" },
  "language": { "type": { "type": "string" }, "mapsTo": "language" } } },
"Disclosure": { "properties": {
  "summary": { "type": { "type": "string" }, "bindable": true, "mapsTo": "summary" },
  "open":    { "type": { "type": "boolean" }, "bindable": true, "mapsTo": "open" } },
  "value": { "prop": "open", "event": "toggle" }, "children": "ChildList" },
// Text row (widened) — properties gains:
  "href": { "type": { "type": "string" }, "bindable": true, "mapsTo": "href", "format": "safe-href" }
```

```ts
// factories.ts
export const codeFactory: WidgetFactory = {          // bespoke: non-identity mapsTo (the INVARIANT)
  tag: 'ui-code', create: () => document.createElement('ui-code'),
  applyProp: (el, prop, value) => {
    if (prop === 'code') el.textContent = value == null ? '' : String(value)  // the Text.text lane (SPEC-R3)
    else setAttr(el, prop, value)
  },
}
export const disclosureFactory: WidgetFactory =
  accessorFactory('ui-disclosure', { prop: 'open', event: 'toggle' })         // the Modal/Menu precedent
// textFactory gains the href arm (the fan-out, ADR-0114 cl.5) — ORDER-INDEPENDENT convergence:
//   case 'href': el.href = String(value ?? '');  if (el.href) target.as = 'a';  break
//   case 'variant': …existing triple…;  target.as = el.href ? 'a' : triple.as  // href wins `as`
// Both application orders end at as='a' when href is non-empty (SPEC-R21 AC3). A later bound href of ''
// leaves as='a' standing — an href-less anchor stamp renders as plain text with zero geometry delta
// (SPEC-R7/R10): accepted, documented. The linked-heading loss is SPEC-R21's stated consequence.
```

- **Validator first line** (SPEC-R12): `conformance.ts`'s `matchesType`/property walk gains ONE arm —
  a static string value under a PropDef carrying `format: 'safe-href'`: `try { const u = new URL(value) }
  catch { /* relative/unparseable → DEFER to the component gate */ return ok }` then
  `SAFE_HREF_SCHEMES.includes(u.protocol)` or push `{ code: 'CATALOG', path: '<id>.href' }`. Absolute-only
  by design: the first line catches static garbage; relatives resolve only at render. Bindings already
  skip type checks (the existing deferred-resolution guard) — bound hrefs fall to the component, verbatim
  ADR-0114 cl.3. `SAFE_HREF_SCHEMES` is IMPORTED from LLD-C1 (one policy constant; the a2ui→components
  edge is legal and declared). The `format` key is a default-catalog PropDef extension (our schema, not
  A2UI wire vocabulary) — reusable for any future URL-bearing prop; documented in the catalog SPEC repair.
- **Feed partition** (SPEC-R22): `FEED_SURFACE_TYPES` gains `'Code'`; `FEED_EXCLUDED` gains
  `{ type: 'Disclosure', reason: 'folding hides ask content — the Tabs "hides half the ask" reasoning
  verbatim: an ask must be fully visible and operable inline (ADR-0113 cl.6).' }` → 24 IN / 14 OUT over
  38 types; the partition gate's closure + negative control re-verified.
- Gate tests: `factories.test.ts` (code→textContent arm; the disclosure value mark; the fan-out in BOTH
  orders), `index.test.ts` fleet-derived gate (residue none), `conformance.test.ts` (the SPEC-R12 legs),
  `feed-catalog.test.ts` (the partition), `prompt-drift.test.ts` (widened rows).

**LLD-C14 — catalog SPEC repair.** `a2ui-catalog.spec.md` §5.2 gains the `Code` + `Disclosure` rows, the
`Text` row's `href` cell (+ the `format: safe-href` note), and the Notes guidance (SPEC-R23's four-way
rule + the sources-not-actions line), in the same change as the rows.

**LLD-C15 — exemplar + re-validation.** The report seed (`a2ui/src/examples/`, the report-card sibling):
`Card > CardContent > Column [ Text(h3 title), Text(body summary), Code(code: {path:/command},
language:"sh"), Text(href:"https://…", text:"Source: deployment runbook"), Disclosure(summary:"Full log",
open bound {path:/logOpen}) > Code(...) ]` — the seed itself demonstrates the guidance (fold the detail,
never the answer; `Disclosure > Code` is the long-code idiom). Joins `allSeeds`; validates 0-`CATALOG`
(SPEC-R23 AC1). Then corpus + derived-prompt gates re-run over the widened catalog; drift repaired in the
same change (SPEC-R23 AC2).

## 6 · Tokens summary

| Family | Token | Default | Class |
|---|---|---|---|
| code | `--ui-code-font` | `var(--ui-mono)` | constant |
| code | `--ui-code-size` / `-line-height` | body-medium typescale rows | type |
| code | `--ui-code-ink` / `-surface` | on-surface / container-surface roles | color (AA-probed) |
| code | `--ui-code-radius` | `var(--ui-radius-base)` | frame (fleet referent) |
| code | `--ui-code-pad-inline` / `-block` | `12px` / `8px` | frame — density-INVARIANT |
| text | `--ui-text-link-ink` | `var(--md-sys-color-primary)` (AA build-verify) | color |
| disclosure | `--ui-disclosure-height` / `-font` / `-glyph` | height-md / font-md / `= font` | frame — density-invariant |
| disclosure | `--ui-disclosure-body-pad-*` / `-gap` | `--ui-space-*` steps | rhythm — density-responsive |

## 7 · Failure modes & edge handling (the per-case ledger)

| # | Case | Handling | Where |
|---|---|---|---|
| 1 | `javascript:`/`data:`/`blob:`/`file:`/`vbscript:`/custom scheme, any write path | denied at `#syncLink` → stamp has no `href`/`rel`/`target`; text renders; AT reads plain text | LLD-C1/C2 (SPEC-R8/R10) |
| 2 | scheme smuggling: case (`JAVASCRIPT:`), leading whitespace, embedded `\n`/`\t` | the URL parser normalizes BEFORE the verdict — denied as the normalized self; prefix checks banned | LLD-C1 (SPEC-R8 AC6) |
| 3 | unparseable href (`http://[`) | `new URL` throws → denied, fail-closed | LLD-C1 |
| 4 | empty/whitespace href (the default) | *no destination* — trimmed-empty short-circuits BEFORE parse (else `new URL('', base)` mints a self-link) | LLD-C1 (SPEC-R8 AC7) |
| 5 | bound-text `textContent` clobber on a link | `#heal` → `#restamp` → tail `#syncLink()` — the gated href survives every content write | LLD-C2 (SPEC-R8 AC8) |
| 6 | `href` with `as ≠ "a"` | inert: the non-anchor branch strips link attributes; documented, not an error | LLD-C2 (SPEC-R7 AC2) |
| 7 | wire `Text` with BOTH heading `variant` and `href` | fan-out converges to `as='a'` in both orders; heading VISUAL kept, heading semantics lost — stated consequence. **Fires on any non-empty `href`, allowed OR gate-denied** (doc-review F4) — a denied `javascript:`-class href on a heading still loses heading semantics, yielding neither heading nor link | LLD-C13 (SPEC-R21) |
| 8 | bound href later becomes `''` | no destination → href-less anchor stamp = plain-text rendering, zero geometry delta; `as` stays `'a'` | LLD-C2/C13 |
| 9 | static relative href at the validator | DEFER (parse throws without base) — the component gate rules at render; absolute disallowed literals fail `CATALOG` at `<id>.href` | LLD-C13 (SPEC-R12) |
| 10 | `--ui-text-link-ink`/`--ui-code-surface` role fails AA on some surface | build-wave color probe measures; fallback = repoint the token default (token edit, not mechanism) | LLD-C3/C6 |
| 11 | code: malformed/absent content | none possible — no codec, no JSON: text is text; empty host still paints its surface box | LLD-C5/C6 |
| 12 | code: bound `code` containing HTML | `textContent` assignment — rendered literally, never parsed (SPEC-R3 AC1) | LLD-C13 codeFactory |
| 13 | code: leading-newline parser nicety | rendered as authored; descriptor guidance, no machinery | LLD-C7 (SPEC-R2 AC4) |
| 14 | code: overflow keyboard access off-Chromium | named residual (SPEC-R5): content complete in AX tree; selection scrolls; `tabindex` = foreseen extension on evidence | LLD-C6/C7 |
| 15 | disclosure: children stream in after connect | heal observer adopts into the body part within a microtask, order/identity preserved | LLD-C8 (SPEC-R16 AC1) |
| 16 | disclosure: `host.textContent` clobber | detached-part branch rebuilds fresh; new text lands in the body; ≤2 passes, never loops | LLD-C8 (SPEC-R16 AC3) |
| 17 | disclosure: re-asserted `open` value | same-value platform assignment → no toggle event → no announce (the loop-breaker) | LLD-C8 (SPEC-R15 AC2) |
| 18 | disclosure: rapid double-flip | native toggle-event coalescing ⇒ one event, final state; prop is source of truth — accepted | LLD-C8 |
| 19 | disclosure: find-in-page reveal | platform flips `details.open` → the ONE listener settles prop + announces (Chromium leg; WebKit structural probe + named re-test trigger) | LLD-C8 (SPEC-R15 AC4) |
| 20 | jsdom lacks the details toggle task | jsdom drives the listener path directly; browser legs own the platform truth (instrument bridge, noted in-file) | LLD-C10 |

## 8 · Test plan (per slice) & gates

- **`text-href-security.test.ts`** (jsdom; the dedicated security file — SPEC-N5, NON-optional): ONE
  shared assertion helper `expectDenied(el)` / `expectAllowed(el, raw)` (the SPEC-R8 AC5 identical-outcome
  pin) driven across **P1** markup-parsed attribute, **P2** property, **P3** `textFactory.applyProp`,
  **P4** a rendered surface with a bound `{path}` + `updateDataModel` — denial (`javascript:alert(1)`)
  AND the allowed twin (`https://example.com`, byte-identical + `rel`/`target`) through EVERY path
  (SPEC-R8 AC1–AC5, AC9); the full scheme matrix via P2 (AC6: the nine denied forms, the five allowed
  forms); no-destination legs (AC7); the host-inertness legs (`:any-link` false on host and denied stamp,
  raw reflection honest — SPEC-R9 AC1); the denied-stamp structural-AT facts (no href/rel/target/role/
  aria-*/tabindex — SPEC-R10 AC1); the `setAttribute('href'`-appears-once grep pin (LLD-C2's one-writer
  invariant). **Build-wave one-time mutation check** (booked, not shipped): bypass `safeHref` locally →
  P1 denial leg MUST fail → revert (proves the last line is load-bearing — ADR-0114 Acceptance b).
- **Unit/jsdom per folder**: `href.ts` pure-gate table test (every §7 row 1–4 form); `code.test.ts` /
  `disclosure.test.ts` per LLD-C7/C10; descriptor trip-wires ×3.
- **Browser, Chromium + WebKit** (`*.browser.test.ts` — SPEC-N2): text link legs (LLD-C4 list); code
  whole-shape/scroll/copy/forced-colors (LLD-C7); disclosure click/keyboard/find-in-page/marker/chevron/
  density/forced-colors (LLD-C10); computed-style is the sanctioned visual proof (ADR-0102) — no
  pixel-diff harness.
- **Catalog/a2ui**: `factories.test.ts` (both fan-out orders), `conformance.test.ts` (SPEC-R12 AC1–AC3 —
  the defense-in-depth pair as two separate tests), `index.test.ts` (residue none), `feed-catalog.test.ts`
  (24/14 + negative control), `prompt-drift.test.ts`, exemplar validation + gallery render (LLD-C15).
- **Gates**: `npm run check && npm test` green at every slice boundary; `npm run test:browser` before each
  wave commit (component-reviewer DoD — jsdom-green ≠ done); `npm run size` by hand at LLD-C11. Negative
  controls: the two site-coverage tier edits and the feed dispositions each FAIL when reverted.

## 9 · Build sequence (checkpointed; = the decomp's edge order)

1. **Wave M1-a (parallel, one writer per folder):** LLD-C1→C4 (`controls/text/` — the hyperlink slice,
   security file included) ∥ LLD-C5→C7 (`controls/code/`) ∥ LLD-C8→C10 (`controls/disclosure/`).
   *Checkpoint:* folder-local tests green, incl. `text-href-security.test.ts` complete.
2. **Wave M1-b (serial):** LLD-C11 (barrel/styles/tier lists/exports/size) — the ONE shared-file writer.
   *Checkpoint:* repo-wide check+test+browser green; size reported.
3. **Wave M1-c:** LLD-C12 site pages. *Checkpoint:* site-coverage/toc/nav green; site builds.
4. **Wave M1-d (same wave as the descriptors — SPEC-N2/ADR-0113 cl.5):** LLD-C13 (rows+factories, then
   the validator leg, then the feed dispositions), then LLD-C14 catalog-SPEC repair. *Checkpoint:*
   fleet-derived gate green, residue none; partition gate 24/14 green; SPEC-R12's pair green.
5. **Wave M2:** LLD-C15 exemplar, then corpus/prompt re-validation. *Checkpoint:* SPEC-R23 ACs; the
   exemplar renders in the gallery.

## Component IDs (trace)

`LLD-C1` href gate ← SPEC-R8/R12 · `LLD-C2` text.ts extension ← SPEC-R7/R8/R9/R10/R11 · `LLD-C3` text.css
link leg ← SPEC-R13/R7 · `LLD-C4` text descriptor+tests ← SPEC-R7…R13/N5 · `LLD-C5` code.ts ←
SPEC-R1/R3/R5 · `LLD-C6` code.css ← SPEC-R2/R19/R20 · `LLD-C7` code descriptor+tests ← SPEC-R1/R2/R4/R5/
R6 · `LLD-C8` disclosure.ts ← SPEC-R14/R15/R16/R17 · `LLD-C9` disclosure.css ← SPEC-R18/R19/R20 ·
`LLD-C10` disclosure descriptor+tests ← SPEC-R14…R18 · `LLD-C11` integration ← SPEC-N3/N4 · `LLD-C12`
site pages ← SPEC-N3 · `LLD-C13` catalog/validator/feed ← SPEC-R21/R12/R22 · `LLD-C14` catalog-SPEC
repair ← SPEC-R21/R23 · `LLD-C15` exemplar+re-validation ← SPEC-R23. (`LLD-C#` IDs per-doc-scoped — the
house convention.)
