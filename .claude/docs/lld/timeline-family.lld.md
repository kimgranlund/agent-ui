# LLD — `ui-timeline` family (`ui-timeline` · `ui-timeline-item` · `ui-status-stream`)

> Status: proposed · v0.1 · 2026-07-10 · Layer: LLD (implementation contract)
> Refines: [`../spec/timeline-family.spec.md`](../spec/timeline-family.spec.md) under
> [ADR-0122](../adr/0122-timeline-family-and-live-status-stream.md) (proposed).
> Build plan: [`../decompositions/timeline-family-ship.decomp.json`](../decompositions/timeline-family-ship.decomp.json).
> Altitude: owns the **mechanisms** — the exact class interfaces, the marker-system CSS grid + the explicit
> token rows, the imperative live-host API + tail-follow guard, the disclosure composition, and the
> frozen-interface-vs-real-code check. Every API named here is verified against a REAL shipped consumer (§7);
> a builder implements this without re-deriving. One writer per file (§6 sequence).

---

## 1. Layout & files

Three sibling `controls/` folders, each self-defining on import (the fleet precedent):

```
packages/agent-ui/components/src/controls/
  timeline-item/    timeline-item.ts · timeline-item.css · timeline-item.md · {*.test.ts, *.browser.test.ts, *-descriptor.test.ts}
  timeline/         timeline.ts      · timeline.css      · timeline.md      · {…}
  status-stream/    status-stream.ts · status-stream.css · status-stream.md · {…}
```

Import edges (inward only): `timeline-item` imports `../../dom` + (composition) `../disclosure/disclosure.ts`;
`timeline` and `status-stream` import `../../dom` + `./…/timeline-item.ts` (the same-folder-sibling cross-control
edge, the `toast`→`button`/`icon` and `segmented-control`→`radio` precedent). None import `../../a2a` (the
`TaskState` pairing is catalog §guidance, never an import — the layering trip-wire).

## 2. `ui-timeline-item` — the shared inert atom

### 2.1 Frozen class interface

```ts
// timeline-item.ts
import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import '../disclosure/disclosure.ts' // the collapse mechanism (F6) — composed, not reinvented

const STATUS = ['', 'pending', 'active', 'done', 'error'] as const
const SIZE = ['sm', 'md', 'lg'] as const

const props = {
  status: { ...prop.enum(STATUS, ''), reflect: true },  // '' = neutral marker (F3); reflect added at build — CSS [status] selectors + SPEC-R2 AC2 round-trip (review-ratified)
  label: prop.string(''),
  description: prop.string(''),
  timestamp: prop.string(''),           // the consumer's string — NO codec (F6)
  icon: prop.string(''),                // a marker glyph name replacing the dot (adia icon-mode)
  size: { ...prop.enum(SIZE, 'md'), reflect: true },    // first-class geometry (F2); reflect added at build (CSS [size] registers)
} satisfies PropsSchema

export interface UITimelineItemElement extends ReactiveProps<typeof props> {}
export class UITimelineItemElement extends UIElement {
  static props = props

  constructor() {
    super()
    this.internals.role = 'listitem' // set in the CONSTRUCTOR (the toast role precedent) — semantics before insertion
  }

  protected connected(): void {
    this.#ensureAnatomy()             // idempotent, ONCE (the toast/modal/disclosure part-persistence guard)
    this.effect(() => this.#renderContent()) // re-stamps label/description/timestamp/marker on prop change
  }

  /** Reveal/collapse the detail region (used by ui-status-stream's update({detail})); no-op if no detail. */
  toggleDetail(open?: boolean): void { /* delegates to the composed ui-disclosure (§2.3) */ }
}

if (!customElements.get('ui-timeline-item')) customElements.define('ui-timeline-item', UITimelineItemElement)
```

`ReactiveProps<typeof props>` + the `interface` declaration-merge installs typed signal accessors (the
`verbatimModuleSyntax`/`erasableSyntaxOnly`-safe pattern — the toast precedent verbatim). No decorators.

### 2.2 Anatomy — host-as-grid, content by `data-role`

`#ensureAnatomy()` builds the light-DOM cells ONCE (idempotent guard, persists across reconnect):

- a `<span data-part="marker">` (the dot/icon cell) — the CSS paints the dot via `::before` and the connector
  via `::after`, both absolutely positioned in the marker column (the adia mechanism, promoted); when `icon` is
  set (or a consumer `[data-role="marker"]` child is present at connect), the dot is suppressed
  (`:scope:has([data-role="marker"])::before { display: none }`) and the slotted marker fills the cell.
- content cells keyed by `data-role`: `label` · `description` · `timestamp` (the aside) · `trailing`. Pre-existing
  light-DOM children carrying `[data-role]` are ADOPTED (moved, ADR-0022 `moveBefore`/`appendEntry`) into position;
  otherwise `#renderContent()` stamps `label`/`description`/`timestamp` from the props (the adia stamp-if-absent
  model + its wrapper-trap regression: a wrapped consumer `[data-role="label"]` must SUPPRESS the default stamp,
  not duplicate — the adia `timeline.test.js` lesson, carried as a probe).
- Empty cells collapse (`:scope > [data-role]:empty { display: none }`) — no phantom gutter (SPEC-R3 AC1).

### 2.3 The collapsible detail (disclosure reuse, F6)

An item with detail content (a consumer `[data-role="detail"]` child, or `ui-status-stream` revealing streamed
sub-steps) composes a **`ui-disclosure`** (`import '../disclosure/disclosure.ts'`) — its `open` state + `toggle`
event are reused verbatim; the item does NOT reimplement a caret+`hidden`. `toggleDetail(open?)` sets the
disclosure's `open` prop. The `toggle` event bubbles from the composed `ui-disclosure` (allowlisted; NO new
event name — the adia `timeline-toggle` custom name is dropped). One nesting level (flat + 1); the descriptor's
`events` is `[]` on the item itself (the event originates in the composed child), documented in `timeline-item.md`.

### 2.4 `timeline-item.css` — the marker-system grid

Scoped `@scope (ui-timeline-item)` / `:where(ui-timeline-item)`. Host is `display: grid` with the shared
three-column track — `[gutter] var(--ui-timeline-item-gutter) [content] 1fr [aside] auto` — so an item inside a
`ui-timeline`/`ui-status-stream` aligns to ONE vertical axis (the adia subgrid idea, realized as inherited
custom props the host sets, kept jsdom-safe — no `subgrid` dependency for the alignment proof). The marker
`::before` dot and `::after` connector are absolutely positioned in the gutter column; the connector's
`bottom` reaches the next row (suppressed on the host's last item, §3.2). All rail quantities read the
`--ui-timeline-item-*` chain (§5). Content text reads the ambient type scale (`--md-sys-typescale-*`), NOT the marker
table. A `@media (forced-colors: active)` block keeps each `status` marker shape legible (SPEC-R4/R15).

> *Import-edge amendment (build, review-ratified): `ui-timeline-item` ALSO imports `@agent-ui/icons` (+ the phosphor pack activation in consumers/tests) for the done/error marker glyphs (SPEC-R4) — the sanctioned cross-control edge; §1's original dom+disclosure-only edge list was incomplete.*


## 3. `ui-timeline` — the durable host

### 3.1 Frozen class interface

```ts
// timeline.ts
import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import '../timeline-item/timeline-item.ts' // registers the item child (the same-folder sibling edge is timeline-item next door;
                            // this import is the cross-folder sibling — the toast→button precedent direction)

const SIZE = ['sm', 'md', 'lg'] as const
const props = {
  size: { ...prop.enum(SIZE, 'md'), reflect: true },   // first-class geometry (F2), reflect at build; NO variant/data/orientation prop in v1
  label: prop.string(''),        // author accessible name → internals.ariaLabel when non-empty (ADR-0051 spirit)
} satisfies PropsSchema

export interface UITimelineElement extends ReactiveProps<typeof props> {}
export class UITimelineElement extends UIContainerElement {
  static props = props // deliberately does NOT spread surfaceProps/flexProps — a timeline owns no elevation axis

  constructor() {
    super()
    this.internals.role = 'list' // role VALUE = the ui-list precedent (list.ts:50); constructor PLACEMENT
                                // (semantics before insertion) = the toast precedent (toast.ts:68)
  }

  protected connected(): void {
    this.effect(() => { this.internals.ariaLabel = this.label || null }) // clear to null on ''
    this.effect(() => this.#markLastItem())                              // suppress the terminal connector
  }
}

if (!customElements.get('ui-timeline')) customElements.define('ui-timeline', UITimelineElement)
```

### 3.2 Behavior

- **Authored-children ingress, DOM order, no auto-sort** (the adia rule). `#markLastItem()` queries
  `:scope > ui-timeline-item`, clears `data-last` on all, sets it on the last — the CSS suppresses that item's
  `::after` connector. Re-run on child-list change via a `MutationObserver({ childList: true })` (the
  toast-region observer precedent) so a late-appended durable item re-marks the terminal correctly.
- **Static** — NO imperative `appendEntry`/`update`/`finalize`, NO tail-follow, NO live-region role. This is the
  negative control separating it from `ui-status-stream` (SPEC-R6 AC3): a grep of `timeline.ts` finds none of
  those (a standing probe).
- `internals.role = 'list'` + `internals.ariaLabel` from `label`; items are `role="listitem"` (§2.1) — the
  honest AT list structure the ticket names.

## 4. `ui-status-stream` — the live host

### 4.1 Frozen class interface

```ts
// status-stream.ts
import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UITimelineItemElement } from './timeline-item.ts' // constructs items via its own API (F4)

/** The structured entry a consumer pushes as its stream yields (F4). NOT parsed — a plain record. */
export interface StatusEntry {
  key: string
  status?: '' | 'pending' | 'active' | 'done' | 'error'
  label?: string
  description?: string
  timestamp?: string
  icon?: string
  text?: string   // streamed chain-of-thought text — appended/replaced in place, NEVER tokenized/parsed
}

const SIZE = ['sm', 'md', 'lg'] as const
const props = {
  size: prop.enum(SIZE, 'md'),
  label: prop.string(''),
} satisfies PropsSchema

export interface UIStatusStreamElement extends ReactiveProps<typeof props> {}
export class UIStatusStreamElement extends UIContainerElement {
  static props = props

  #byKey = new Map<string, UITimelineItemElement>()
  #stuckToBottom = true // the tail-follow guard (§4.3)

  constructor() {
    super()
    this.internals.role = 'log' // a POLITE live region via internals.role (the toast role='status' precedent —
                                // the fleet does live regions through internals.role; role=log ⇒ aria-live polite)
  }

  protected connected(): void {
    this.effect(() => { this.internals.ariaLabel = this.label || null })
    this.listen(this, 'scroll', () => this.#trackStickToBottom()) // update the tail-follow guard on user scroll
  }

  /** Append a new entry, tail-follow to it, return the created item (the toast-region.show() return precedent). */
  append(entry: StatusEntry): UITimelineItemElement {
    const item = document.createElement('ui-timeline-item') as UITimelineItemElement
    this.#assign(item, entry)
    this.#byKey.set(entry.key, item)
    this.appendChild(item)
    this.#tailFollow(item)
    return item
  }

  /** Keyed, in-place mutation — transition status / grow text / reveal detail. No-op if the key is unknown. */
  update(key: string, patch: Partial<StatusEntry>): void {
    const item = this.#byKey.get(key)
    if (item === undefined) return // a late update after truncation is tolerated (never a throw) — SPEC-R9 AC2
    this.#assign(item, patch)
    if (this.#growsTail(patch)) this.#tailFollow(item)
  }

  /** The completion invariant — mark every still-pending/active entry TRUNCATED (SPEC-R11). */
  finalize(): void {
    for (const item of this.#byKey.values()) {
      if (item.status === 'active' || item.status === 'pending') this.#markTruncated(item)
    }
  }
}

if (!customElements.get('ui-status-stream')) customElements.define('ui-status-stream', UIStatusStreamElement)
```

### 4.2 `#assign` — the entry → item projection

Sets only the provided fields onto the item's typed props (`status`/`label`/`description`/`timestamp`/`icon`);
`text` appends/replaces the item's streamed-text region (a `[data-role="text"]` cell inside the item's content
column — grown in place, never re-parsed). Transport is the consumer's: `status-stream.ts` contains NO
`fetch`/`ReadableStream`/`readNdjsonLines` (a standing negative-control grep — SPEC-R9 AC3).

### 4.3 Tail-follow + the stick-to-bottom guard (F4, SPEC-R10)

- `#tailFollow(item)` scrolls the item's END into view IFF `#stuckToBottom`, smooth by default, **instant under
  `prefers-reduced-motion`** (`item.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' })` —
  the a2a-artifact-feed `revealScroll` mechanism, promoted to component behavior; the two-rAF settle-defer is
  the same when a lazily-laid-out child must measure first).
- `#trackStickToBottom()` recomputes `#stuckToBottom = (scrollHeight - scrollTop - clientHeight) <= threshold`
  on user scroll — so scrolling UP to read history pins the viewport (new arrivals do not yank it), and scrolling
  back to the bottom resumes follow (SPEC-R10 AC2). The stream OWNS its scroll region (`overflow-block: auto` on
  the host in `status-stream.css` — the one-owned-scroll-region law).

### 4.4 The completion invariant (F4, SPEC-R11)

`#markTruncated(item)` renders a distinct, non-color-only interrupted affordance (a `data-truncated` state on
the item → a break/`⚠` marker shape, forced-colors-legible — ADR-0057), fail-closed: an unresolved-at-end entry
is TRUNCATED, never left `active` spinning. A torn transport (the consumer's `sendTurn` throws — the B7
fail-closed path) calls `finalize()` (or `update(key,{status:'error'})` then `finalize()`); no entry ever shows
"still working" after the stream ends.

## 5. The marker-system geometry — the explicit token table (F2, SPEC-R13)

A NEW `--ui-timeline-item-*` token set, hoisted per `[size]` × `[scale]` — the ADR-0035/0036 `--ui-font`/`--ui-icon`
hoisted-per-`[scale]` pattern, and Kim's `(scale × size) → row` LOOKUP (NO multiplier — ADR-0038). Authored on
`:root` + per-`[scale]` + per-`[size]` selectors (the item reads `--ui-timeline-item-*`; the host sets `size`).
The rail quantities and their families:

| Token | Family | Notes |
|---|---|---|
| `--ui-timeline-item-marker-box` | frame ∝ (scale×size) | the marker footprint (dot + slotted-icon share it) |
| `--ui-timeline-item-dot-size` | frame ∝ (scale×size) | the plain-status dot (< marker-box) |
| `--ui-timeline-item-icon-size` | content-icon register | a slotted marker glyph = `--ui-icon-{size}` |
| `--ui-timeline-item-connector-width` | NEW structural | a hairline (NOT `= font`); explicit per row |
| `--ui-timeline-item-gutter` | frame ∝ marker-box | the marker-column width (≥ marker-box for breathing room) |
| `--ui-timeline-item-row-gap` | rhythm ∝ font × density | the ONLY density-multiplied quantity (the gap) |

**The frozen integer rows at the default `[scale]`** (px; SPEC-R13 AC2's "the integers the LLD fixes" — pinned
HERE, not deferred to the build). Grounded in the shipped ramps: `marker-box` reads the compact widget ramp
`--ui-compact-{size}` (`12·14·16·18·20·22·24·28`, ADR-0041); `dot` ≈ marker-box − a ring inset; `gutter` =
marker-box + breathing margin (the adia `marker-w 1.25rem` over a `1rem` box); `connector-width` a 2px hairline
(the adia `line-size`); `row-gap` off the `--space-*` ladder × density:

| `size` | `marker-box` | `dot-size` | `connector-width` | `gutter` | `row-gap` |
|---|---|---|---|---|---|
| `sm` | 14 | 6 | 2 | 18 | 8 |
| `md` | 16 | 8 | 2 | 20 | 12 |
| `lg` | 20 | 10 | 2 | 24 | 16 |

`connector-width` is deliberately **2 across all three tiers** — a shared value that DEMONSTRATES the ADR-0038
stepping law the probe must honor (SPEC-R13 AC2: assert the explicit values, do NOT assume adjacent tiers are
all-distinct). A slotted marker `icon-size` = the content-icon register `--ui-icon-{size}` (not this table).

**Per-`[scale]` registers** extend this table the way the shipped `--ui-font`/`--ui-icon` tables do (ADR-0035/
0036): the `--ui-timeline-item-*` rows above are the default-register (`[scale]` unset ≡ the `md`-scale register);
each `[scale]` value re-declares the six tokens on `:root[scale=…]` / `[scale=…]` selectors, hoisted the SAME
way (NO `pow()`, NO multiplier — ADR-0038), so `(scale × size)` selects a cell by explicit lookup. The compact
band (xs·sm·md) steps gently; the expressive band (lg·xl·2xl) steps larger — the build fills the remaining
registers by the same generating discipline the ADR-0035/0036 tables used, PINNED in `timeline-item.css` and
asserted per `(scale, size)` cell by the geometry probe. `[density]` multiplies `--ui-timeline-item-row-gap` ONLY;
`marker-box`/`dot`/`gutter`/`connector-width` are density-invariant (the centering law — scaling the frame
un-centers the marker).

## 6. Build sequence (one writer per file)

1. **`timeline-item`** — class + anatomy + `status` markers (ADR-0057 shapes) + the marker-system CSS/tokens
   (§2, §5); the disclosure composition (§2.3); descriptor; jsdom + browser (whole-shape + geometry-under-
   `[size]` + forced-colors) probes. *The atom lands first — both hosts depend on it.*
2. **`timeline`** — the durable host (§3): role=list, authored-children, terminal-connector suppression,
   the static negative-control; descriptor; probes (whole-shape aligned-marker rail).
3. **`status-stream`** — the live host (§4): role=log, the imperative API, tail-follow + guard, the completion
   invariant; descriptor; the REAL-stream browser proof (§SPEC-R19, fed the in-repo arena NDJSON via
   `readNdjsonLines` as an INSTRUMENT-BRIDGE).
4. **Catalog slices (a2ui-builder seat, after the components are green)** — the `Timeline`+`TimelineItem`
   catalog rows + the `StatusStream` `EXCLUSION_ALLOWLIST` entry (F5); an agent-activity exemplar composing a
   `Timeline`.
5. **Site pages** — `timeline-{doc,demo}` + `status-stream-{doc,demo}` (docs-writer/example-builder concern per
   the site skill); the status-stream demo drives a recorded stream.
6. **Integration** — barrels/exports; `npm run size` (manual, ADR-0040 §3) measured + pinned if material;
   independent `component-reviewer` GO per host before commit.

## 7. Frozen-interface-vs-real-code check

Every API this LLD's interfaces name, verified to EXIST with that exact signature in a shipped consumer
(the toolbar-shakedown lesson — a frozen interface built on a summary ships a type error):

| API named | Verified against (shipped source) | Signature confirmed |
|---|---|---|
| `UIElement` / `UIContainerElement` | `dom/container.ts:60` (`UIContainerElement extends UIElement`) | ✓ container gives `static surfaceProps`/`flexProps` as OPT-IN spreads (not auto-applied) — the hosts deliberately do NOT spread them |
| `prop.enum(values as const, def)` | `dom/props.ts:114` `enum<const T extends readonly string[]>(values: T, def: T[number])` | ✓ the `<const T>` param infers the literal tuple; the fleet convention writes `as const` at the call site (not strictly required) |
| `prop.string(def='')` | `dom/props.ts:105` | ✓ |
| `PropsSchema` / `ReactiveProps<typeof props>` + `interface` merge | `controls/toast/toast.ts:36,46-48` | ✓ the declare-merge accessor pattern |
| `this.internals.role` (live region via role) | `controls/toast/toast.ts:68` (`internals.role = 'status'` in the constructor) | ✓ the fleet does live regions through `internals.role`; `role='log'` ⇒ polite. `internals.ariaLive`/`ariaRelevant` are NOT relied on (not in the fleet's used-set) |
| `this.internals.ariaLabel = x \|\| null` | `_base`/controls set `ariaLabel` (in the internals used-set) | ✓ clear-to-null on `''` |
| `this.effect(fn)` | `dom/element.ts:148` `effect(fn): () => void`; `toast.ts:75,82` | ✓ |
| `this.listen(target, type, handler, opts?)` | `dom/element.ts:160`; `toast.ts:90` | ✓ rides the connection AbortSignal |
| `this.emit('toggle')` | `controls/disclosure/disclosure.ts:126`; `toast.ts:124` (`emit('close')`) | ✓ event name ∈ the allowlist |
| `connected()` / `disconnected()` idempotent-part guard | `toast.ts:71,110,163`; `toast-region.ts:52` | ✓ the part-persistence precedent |
| `MutationObserver({childList:true})` re-mark | `controls/toast/toast-region.ts:55-57` | ✓ the child-count/last-item observer precedent |
| `document.createElement('ui-timeline-item')` + assign-before-append | `toast-region.ts:74-82` (`show()` creates a toast, assigns, appends, returns) | ✓ the imperative-host precedent |
| `scrollIntoView({behavior, block:'end'})` + reduced-motion + 2×rAF | `site/pages/a2a-artifact-feed.ts:231-238` (`revealScroll`) | ✓ promoted from page code to component behavior |
| `ui-disclosure` (`open`/`summary` props, `toggle` emit) | `controls/disclosure/disclosure.ts:56,60,126` | ✓ the composed collapse mechanism |
| `ui-list` `internals.role='list'` (durable host precedent) | `controls/list/list.ts:42,50` | ✓ `UIListElement extends UIContainerElement`, sets role=list |
| `readNdjsonLines(body)` (the browser-proof stream feeder) | `site/lib/ndjson-lines.ts:13` | ✓ the recorded arena stream is the fixture |
| descriptor schema (`tier`∈size-classes, `extends`∈BASE_CLASSES, `attributes[]`↔props) | `descriptor/component-descriptor.ts:227-237` | ✓ `pattern` ∈ SIZE_CLASSES; `UIElement`/`UIContainerElement` ∈ BASE_CLASSES |

**One residual note the build must honor:** the `text` streamed-region and the `data-truncated` state are the
only two item facts NOT expressible as `status props` — they are imperative/CSS-state (the toast
`#message`-adoption + `:state()` precedent). `compareDescriptorToSource` (states via `:state()` + `.ts`
mutations, slots/roles via CSS selectors) must document any `:state(truncated)` used — declare it in
`timeline-item.md`'s `customStates` (the standing source-drift trip-wire).

## 8. Risks / tradeoffs

- **Unconditional `import '../disclosure/disclosure.ts'` on every `timeline-item`** (§2.1) — a detail-less item
  still pulls the disclosure module into the bundle. *Accepted:* disclosure is a small shipped control and the
  reuse buys the correct `toggle` semantics (vs a bespoke caret) — the size marginal (n34) measures it; if it
  proves material, the composition moves to a lazy `import()` on first-detail (the calendar lazy-import
  precedent, ADR-0048), a build-time swap with no contract change.
- **Alignment via inherited custom props, NOT CSS `subgrid`** (§2.4) — the shared gutter axis is realized by the
  host setting `--ui-timeline-item-gutter` that every item reads, rather than the adia `subgrid`. *Tradeoff:* keeps
  the whole-shape alignment proof jsdom-legible and dodges cross-engine `subgrid` variance, at the cost of a
  looser coupling than true subgrid (the host must set the gutter var; a stray non-item child would not align).
  Accepted — the item query is family-scoped so strays are out of contract.
- **The `text`/`data-truncated` imperative-state escape hatch** (§4.2, §4.4, §7) — two item facts live outside
  the `static props` schema (imperative text region + a `:state(truncated)`). *Risk:* they can drift from the
  descriptor silently. *Mitigation:* `compareDescriptorToSource` gates `:state(truncated)` (declared in
  `customStates`), and the `text` region is a documented `[data-role="text"]` styled slot the same trip-wire
  covers — the toast `#message` + `:state()` precedent, already gated fleet-wide.

## 9. Deviation note (house convention)

This LLD uses the fleet's blockquote-header doc style (matching every sibling under `.claude/docs/{spec,lld}/`
and the ratified ADRs), NOT generic YAML frontmatter — so the generic scribe `doc_lint` abstains on it by
construction, as it does on `toolbar.lld.md` and the whole corpus. The repo gates these docs with its OWN checks
(`site-adr-index.test.ts`, `harness_checks.py`, `coverage_check.py` for the decomp). Recorded as a known,
corpus-wide convention, not a silent miss; a fleet-wide switch to YAML frontmatter is a doc-forge/Kim decision
outside this intake's scope.
