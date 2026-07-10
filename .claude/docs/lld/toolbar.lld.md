# LLD — `ui-toolbar`

> Refines: [`../spec/toolbar.spec.md`](../spec/toolbar.spec.md) (SPEC-R1…R12) under
> [ADR-0121](../adr/0121-ui-toolbar-pattern-control.md) (proposed; every fork as recommended). Build plan:
> [`../decompositions/toolbar-ship.decomp.json`](../decompositions/toolbar-ship.decomp.json) (coverage-clean,
> plan mode). · proposed · 2026-07-10 · designer (agent-ui-component-design)
>
> **Composes on:** `UIContainerElement` (the surface-axes + non-form base `ui-row`/`ui-tabs` use) + the
> `roving-focus` trait (`traits/roving-focus.ts`, reused decoupled from selection) + the ADR-0015 container
> surface seam (`_surface/`) + the ADR-0052 `[data-box]` z-scope. **No new package, no new trait, no new base
> class**: one ordinary control folder, `controls/toolbar/`. The only cross-package work is the F7 `Toolbar`
> catalog row (an a2ui-package build slice, `a2ui-builder` seat).
>
> **Freeze discipline.** §3's interface is the fan-out contract. A builder who cannot satisfy it STOPS and
> escalates — the fix is a coordinated LLD repair, never a local deviation.

## 1 · Intent

Ship a Pattern-class host-as-flex container that (a) arranges the consumer's light-DOM interactive children as
flex items, (b) gives the host `role="toolbar"` + arrow-key roving focus over those items via the existing
trait, and (c) reads as a floating or embedded bar purely through the `elevation`/`brightness` surface axis.
The code is small and almost entirely reuse: no value, no events, no overlay, no positioning, no measurement.
The behavioral surface is one `connected()` wiring (roving + ARIA reflection) + one `{name}.css` (flex layout
+ the surface/geometry roles). The rest is descriptor, catalog row, tests, and two site pages.

## 2 · Components

| ID | Component | File | Traces |
|---|---|---|---|
| LLD-C1 | class + tag + self-define (tier pattern) AND the props schema — `surfaceProps` spread (`elevation`/`brightness`) + `orientation`/`align`/`justify`/`gap`/`overflow`/`label` | `controls/toolbar/toolbar.ts` | SPEC-R1, R2 |
| LLD-C2 | `role="toolbar"` + `ariaOrientation`/`ariaLabel` reflection via `ElementInternals` | `controls/toolbar/toolbar.ts` | SPEC-R3 |
| LLD-C3 | roving-focus wiring — trait over the item query, `loop:false`/`typeAhead:false`, focus-only `onMove` | `controls/toolbar/toolbar.ts` | SPEC-R4 |
| LLD-C4 | the item query — focusable descendants in DOM order, nesting-tolerant, disabled-excluding | `controls/toolbar/toolbar.ts` | SPEC-R4 |
| LLD-C5 | `toolbar.css` — host-as-flex (orientation/align/justify/gap/overflow), surface seam, min-block-size floor, forced-colors | `controls/toolbar/toolbar.css` | SPEC-R6, R7, R8, R9 |
| LLD-C6 | `toolbar.md` descriptor (tier: pattern, extends UIContainerElement, events:[], slots:[], keyboard map) | `controls/toolbar/toolbar.md` | SPEC-R10 |
| LLD-C7 | descriptor↔props trip-wire test | `controls/toolbar/toolbar-descriptor.test.ts` | SPEC-R10 |
| LLD-C8 | jsdom behavior suite (props reflect/fail-open, ARIA-via-internals, no-event negative control, item discovery) | `controls/toolbar/toolbar.test.ts` | SPEC-R2, R3, R5 |
| LLD-C9 | cross-engine browser suite — real-focus-order roving (one Tab stop, arrow/Home/End, no wrap, no type-ahead), whole-shape both postures | `controls/toolbar/toolbar.browser.test.ts` | SPEC-R4, R7, R8, R12 |
| LLD-C10 | `Toolbar` default-catalog row (attrs + `children`) — **a2ui build slice** | `packages/agent-ui/a2ui/src/catalog/default/*` | SPEC-R11 |
| LLD-C11 | `document-row-toolbar` corpus seed upgraded to the real `Toolbar` type — **a2ui build slice** | `packages/agent-ui/a2ui/src/examples/catalog-coverage.ts` | SPEC-R11 |
| LLD-C12 | site pages — API doc + both-posture demo + representative gallery specimen | `site/pages/toolbar-doc.ts`, `site/pages/toolbar-demo.ts`, `site/lib/component-preview.ts` | SPEC-R12 |
| LLD-C13 | barrel/exports/size integration | `packages/agent-ui/components/{package.json,src/controls/index.ts}`, `barrels.test.ts` | ADR-0080 |

## 3 · Interfaces (frozen)

```ts
// controls/toolbar/toolbar.ts — LLD-C1..C4.
import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { rovingFocus } from '../../traits/roving-focus.ts'

const ORIENTATIONS = ['horizontal', 'vertical'] as const
const ALIGNS = ['start', 'center', 'end', 'stretch', 'baseline'] as const   // ADR-0039 box-alignment dialect
const JUSTIFIES = ['start', 'center', 'end', 'between', 'around', 'evenly'] as const
const GAPS = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const
const OVERFLOWS = ['wrap', 'scroll'] as const   // F4 — the `menu` member is a fenced, additive v2

// Item discovery (LLD-C4): the toolbar's focusable interactive descendants, in DOM order, excluding disabled.
// Descendant query (not direct-child) so ui-row grouping still roves (SPEC-R4 AC3). `data-toolbar-item` is the
// explicit escape hatch for a control the button-like set misses.
const ITEM_SELECTOR = 'ui-button, button, a[href], [role="button"], [data-toolbar-item]'

const props = {
  // Surface axis (ADR-0015) — the F1 posture lever. Spread from the container base's surfaceProps so the
  // enum/default/reflect match the fleet seam ui-row/ui-card/ui-tabs share (do NOT redefine the values).
  ...UIContainerElement.surfaceProps,           // elevation, brightness — enum [0,1,2,3,-1,-2,-3], default 0, reflect
  orientation: { ...prop.enum(ORIENTATIONS, 'horizontal'), reflect: true },
  align: { ...prop.enum(ALIGNS, 'center'), reflect: true },       // NOTE default 'center' (bar look), not row's 'start'
  justify: { ...prop.enum(JUSTIFIES, 'start'), reflect: true },
  gap: { ...prop.enum(GAPS, 'sm'), reflect: true },               // NOTE default 'sm' (toolbars are tight)
  overflow: { ...prop.enum(OVERFLOWS, 'wrap'), reflect: true },
  label: { ...prop.string(''), reflect: true },                   // author accessible name → internals.ariaLabel
} satisfies PropsSchema

export interface UIToolbarElement extends ReactiveProps<typeof props> {}
export class UIToolbarElement extends UIContainerElement {
  static props = props

  protected connected(): void {
    // LLD-C2 — role + ARIA via internals ONLY (never a host attribute). role is static; aria reflects live.
    this.internals.role = 'toolbar'
    this.effect(() => {
      this.internals.ariaOrientation = this.orientation === 'vertical' ? 'vertical' : null
    })
    this.effect(() => {
      this.internals.ariaLabel = this.label === '' ? null : this.label
    })

    // LLD-C3 — roving focus, decoupled from selection: focus-only, no wrap, no type-ahead, no commit.
    // Called DIRECTLY — traits are bare calls in this fleet; there is NO host.use() (popover.ts:5 says so
    // explicitly; tabs.ts / radio-group.ts / menu.ts / select.ts / listbox-element.ts all call
    // rovingFocus(this, {…}) directly). It rides connected()'s connection AbortSignal, so it auto-releases
    // on disconnect and re-arms on reconnect. orientation is RESOLVED ONCE here as a VALUE (the trait's
    // `orientation` is a RovingOrientation read once at invoke — roving-focus.ts:100 — NOT an accessor;
    // passing a function is a type error and leaves the comparison permanently false); the radio-group.ts:
    // 120-144 precedent — connect-resolve the axis, pass the value (see §3 note + §8).
    const rovingOrientation = this.orientation === 'vertical' ? 'vertical' : 'horizontal'
    rovingFocus(this, {
      items: () => this.#items(),
      orientation: rovingOrientation,
      loop: false,
      typeAhead: false,
      // no onMove selection coupling, no syncIndex — the trait moves focus, the toolbar tracks nothing.
    })
  }

  // LLD-C4 — live descendant query, DOM order, disabled excluded (the trait re-reads this on every key event).
  #items(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
      (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true',
    )
  }
}

if (!customElements.get('ui-toolbar')) customElements.define('ui-toolbar', UIToolbarElement)
```

**Interface notes (the load-bearing constraints a builder must not silently change):**

- **`roving-focus` `orientation` is resolved ONCE at connect as a value (the `radio-group` precedent) — NOT
  a live key-axis.** The trait's `orientation` is typed `RovingOrientation` (`'vertical'|'horizontal'`) and
  captured once at `rovingFocus(...)` time (roving-focus.ts:100), never re-read; passing an accessor is a
  strict-`tsc` type error AND leaves `orientation === 'vertical'` permanently false. The fleet's settled
  posture for a reactive `orientation` prop feeding this trait is `radio-group.ts:120-144` — connect-resolve
  the axis to a `const`, pass the VALUE. `orientation` still `reflect`s (so the CSS `[orientation=vertical]`
  selector flips live), but the roving KEY-axis is connect-resolved: a post-connect flip re-resolves only on
  the reconnect `connected()` re-run — matching `radio-group` and `ui-segmented-control`, both of which treat
  orientation as connect-fixed. A genuinely live key-axis flip is **not a v1 requirement** (SPEC-R4 does not
  demand it) and would need a shared-trait amendment (`orientation` accepting `() => RovingOrientation`, the
  `initialIndex` precedent at roving-focus.ts:40) touching `ui-tabs`/`ui-menu`/`ui-select`/`ui-radio-group` —
  the named escalation only, not v1.
- **`UIContainerElement.surfaceProps`** must be the real exported shape (the same spread `row.ts`/`tabs.ts`
  use). If its export name differs, use whatever `ui-row` imports — the contract is "the identical
  elevation/brightness seam," not a re-declared copy.
- **`this.internals.role = 'toolbar'`** is set once (static). `ariaOrientation`/`ariaLabel` are reactive
  (they follow props). Confirm `ElementInternals.ariaOrientation`/`ariaLabel` are the reflection surface the
  fleet uses (the `ui-tabs` internals precedent) — never a host attribute (SPEC-R3 AC1).
- **No `size`/`density`/`wrap`/`reflow`/`posture` prop** exists (SPEC-R2). `overflow` subsumes wrap;
  `[scale]`/`[density]` are ambient.

```css
/* controls/toolbar/toolbar.css — LLD-C5 (abbreviated; full sheet at build time). */
:where(ui-toolbar) {
  /* --ui-toolbar-* roles */
  --ui-toolbar-gap: var(--ui-space-sm);              /* gap default; the [gap=…] selectors repoint (density-responsive) */
  --ui-toolbar-pad-inline: var(--ui-space-sm);
  --ui-toolbar-pad-block: var(--ui-space-xs);
  --ui-toolbar-min-block-size: var(--ui-height-md);  /* the whole-shape bar floor (SPEC-R7 AC2) — control-height register */

  box-sizing: border-box;
  display: flex;
  flex-direction: row;                                /* [orientation=vertical] flips to column */
  align-items: center;                                /* [align=…] repoints */
  justify-content: flex-start;                        /* [justify=…] repoints; between/around/evenly → space-* */
  gap: var(--ui-toolbar-gap);
  min-block-size: var(--ui-toolbar-min-block-size);
  padding: var(--ui-toolbar-pad-block) var(--ui-toolbar-pad-inline);
  min-inline-size: 0;                                 /* allow shrink within a flex/grid parent */
  /* surface: the container seam (ADR-0015) — transparent at elevation 0 (embedded), a raised plane at ≥1
     (floating). [data-box] establishes the ADR-0052 isolation z-scope when a plane is asked for. */
}
/* [orientation] · [align] · [justify] · [gap] · [overflow=wrap|scroll] selectors repoint the roles/flex props.
   overflow=scroll → flex-wrap:nowrap + overflow-inline:auto (a toolbar-owned scroll region);
   overflow=wrap  → flex-wrap:wrap. Vertical + wrap is documented as odd, not an error. */
/* @media (forced-colors: active) — keep the bar surface/boundary legible (the ui-tabs precedent). */
```

```yaml
# controls/toolbar/toolbar.md frontmatter — LLD-C6 (abbreviated; full fence at build time).
tag: ui-toolbar
tier: pattern            # geometry.md named Pattern-class example (container + control-height item rows)
extends: UIContainerElement   # surface axes + non-form; UIContainerElement is in the descriptor BASE_CLASSES
attributes:              # mirrors static props 1:1 (the surfaceProps spread, then the toolbar-own props)
  - { name: elevation,   type: enum, values: [0, 1, 2, 3, -1, -2, -3], default: 0, reflect: true }
  - { name: brightness,  type: enum, values: [0, 1, 2, 3, -1, -2, -3], default: 0, reflect: true }
  - { name: orientation, type: enum, values: [horizontal, vertical], default: horizontal, reflect: true }
  - { name: align,       type: enum, values: [start, center, end, stretch, baseline], default: center, reflect: true }
  - { name: justify,     type: enum, values: [start, center, end, between, around, evenly], default: start, reflect: true }
  - { name: gap,         type: enum, values: [none, xs, sm, md, lg, xl, 2xl], default: sm, reflect: true }
  - { name: overflow,    type: enum, values: [wrap, scroll], default: wrap, reflect: true }
  - { name: label,       type: string, default: '', reflect: true }
properties: []
events: []               # the toolbar emits nothing (SPEC-R5); items emit their own
slots: []                # host-as-flex — light-DOM children ARE the items (the ui-row precedent)
parts: []                # role rides the host via internals; no control-created part (unlike tabs' tablist)
customStates: []         # no interaction/motion state of its own in v1
face: { formAssociated: false }
aria:
  role: toolbar          # via ElementInternals — the host carries NO role/aria-* attribute
  roleSource: internals
  orientationSource: internals.ariaOrientation (set only when orientation=vertical)
  labelSource: internals.ariaLabel (author-supplied via the `label` prop, when non-empty)
keyboard:
  - { keys: ArrowRight, action: "(horizontal) move roving focus to the next item; STOPS at the end (no wrap)." }
  - { keys: ArrowLeft,  action: "(horizontal) move roving focus to the previous item; STOPS at the start." }
  - { keys: ArrowDown,  action: "(vertical) move roving focus to the next item; stops at the end." }
  - { keys: ArrowUp,    action: "(vertical) move roving focus to the previous item; stops at the start." }
  - { keys: Home,       action: "move roving focus to the first item." }
  - { keys: End,        action: "move roving focus to the last item." }
  - note: "ROVING TABINDEX — exactly one item tabindex=0, the rest -1 (one Tab stop). NO wrap, NO type-ahead, NO selection/commit (focus-only). Re-armed on reconnect."
geometry:
  sizeClass: pattern
  itemHeight: "the items' own control height (the toolbar owns no size prop)"
  gap: var(--ui-toolbar-gap)            # off --ui-space (density-responsive)
  padInline: var(--ui-toolbar-pad-inline)
  minBlockSize: var(--ui-toolbar-min-block-size)   # the whole-shape bar floor (control-height register)
  surface: --ui-container-bg            # ADR-0015 seam; transparent at elevation 0, raised at ≥1
forcedColors: "A forced-colors block keeps the toolbar surface/boundary legible (Canvas/CanvasText); the bar paints no intent surface of its own in v1."
```

## 4 · The catalog row + corpus upgrade (LLD-C10/C11 — a2ui build slices)

The `Toolbar` type is A2UI-emittable (SPEC-R11 / ADR-0121 F7). The moment `toolbar.md` ships, ADR-0087's
fleet-derived gate (`descriptor-glob → PascalCase`) admits `Toolbar` into `FLEET_TYPES` and demands a catalog
row (or an allowlist entry) — this LLD directs a **row**, not an exclusion. The row maps the descriptor
attributes to catalog attrs (`orientation`/`align`/`justify`/`gap`/`overflow`/`elevation`/`brightness`/`label`)
and takes a `children` list of item components, mirroring how `Row` is catalogued (the a2ui-builder seat owns
the exact `factories.ts`/`catalog.json` mechanics — this LLD fixes the shape, not the wire code).

The `document-row-toolbar` seed (in `catalog-coverage.ts`) is upgraded: its **action cluster** — the
`doc_actions` `Row` child (on the post-ADR-0112 seed, whose top-level `Row{justify:between}` holds an
`Attachment` file card + that action `Row`) — becomes a real `Toolbar` node (its Tooltip/Popover/Menu buttons
as item children), the same "hand-composed shape → real type" upgrade the seed's own comment records for
`Row[Icon,Text]` → `Attachment` (feed-family LLD-C15). The `Attachment` card and the overlay children
themselves are unchanged (they already ride their real types).

**Sequencing:** LLD-C10/C11 are dispatched to the `a2ui-builder` seat AFTER the component (LLD-C1..C9) is
green — the catalog row needs the shipped descriptor to derive its type, and the corpus seed needs the row.

## 5 · Site surfaces (LLD-C12)

- **`toolbar-doc.ts`** — the standard descriptor-derived API page (the `tabs-doc.ts`/`form-provider-doc.ts`
  precedent): the attributes table, the keyboard map, the geometry note, a minimal live specimen.
- **`toolbar-demo.ts`** — new CONTENT (not a restatement): (a) an **embedded** action bar (a document-header
  toolbar, `elevation=0`, flush) and (b) a **floating** raised bar (`elevation=2`, positioned by the demo's
  own layout — a formatting palette), each populated with multiple real `ui-button`s (icon + label), plus a
  keyboard-focus callout demonstrating the one-Tab-stop roving. Both postures visible on one page (TKT-0009).
- **`component-preview.ts`** — a representative specimen (the `example-builder` concern): a populated toolbar
  (e.g. a bold/italic/underline group + an alignment group + undo/redo), NOT a one-child lorem stub — the
  whole-shape/representative-specimen law. Knob config surfaces `orientation`/`align`/`justify`/`gap`/
  `overflow`/`elevation` as the appropriate knob types (menu/enum), one knob per prop.

## 6 · Failure/edge summary (cross-cutting)

- **Orientation flip after connect** — the §3 interface note names the resolution (an `effect`-keyed re-wire
  of `rovingFocus`, or the trait amendment); a builder hitting focus-loss escalates rather than patching.
- **All-disabled item set** — the trait already handles a `-1` roving index (all items disabled ⇒ no
  `tabindex=0`); a toolbar with every item disabled is a valid, focus-inert bar. LLD-C8 covers it.
- **Empty toolbar** — no items; `#items()` returns `[]`, the trait no-ops; the min-block-size floor still
  renders a bar (SPEC-R7 AC2). A degenerate but valid state.
- **Arrow-consuming child (`ui-slider`, text editor)** — out of v1 scope (SPEC §4); v1's `ITEM_SELECTOR`
  matches button-like items only, so an embedded slider is not a roving item and keeps its own arrow handling.
  Named follow-up, not a v1 guarantee.
- **`overflow=scroll` + `orientation=vertical`** — the sensible pairing; `overflow=wrap` + vertical is
  documented as odd (column-wrap), not an error.
- **Zero residue** — the roving listeners + the two ARIA effects all ride `connected()`'s
  connection-`AbortSignal` scope (the fleet re-arm-on-reconnect contract); no timer, observer, or global
  listener exists. Verified by a disconnect/reconnect probe (LLD-C8) — no duplicate listeners, no leaked
  handlers (SPEC-R4 AC4).

## 7 · Gates (the definition of done)

`npm run check`(+site) · `npm test` (`toolbar.test.ts` + `toolbar-descriptor.test.ts` +
`family-coherence.test.ts` + the a2ui catalog-coverage suite once LLD-C10 lands + the corpus judge for the
upgraded seed + `site-coverage.test.ts`) · `npm run test:browser toolbar` (Chromium + WebKit — the real-focus
roving leg AND the whole-shape both-posture leg, per the mandatory cross-engine keyboard proof) · `npm run
size` measured by hand (ADR-0040 §3; the toolbar's leave-one-out marginal pinned if material) · independent
`component-reviewer` GO before commit. **jsdom-green ≠ done** — the roving-focus real-focus-order proof and the
whole-shape render are browser-only (the checkbox/date-time precedent: a browser leg catches what jsdom's
locators and non-layout engine cannot).

## 8 · Open (named, not blocking)

- **Live orientation-flip after connect** — resolved as a v1 NON-behavior: the roving key-axis is
  connect-resolved (the `radio-group`/`ui-segmented-control` precedent, §3), not a live axis; SPEC-R4 does not
  demand a live flip. A future live axis would need the shared-trait amendment (`orientation` accepting an
  accessor, the `initialIndex` precedent) — ADR-tracked, touching every roving-focus consumer — the named
  escalation only.
- **`ui-toolbar-group` (role=group cluster)** — fenced v2, additive; no v1 hook needed beyond the descendant
  item query already tolerating nested clusters.
- **The overflow-*menu* (spillover)** — fenced v2; a new `overflow` enum member built on the real `ui-menu`,
  default-preserving.
- **`ui-divider` hosting** — once the Display-class `ui-divider` ships, the toolbar hosts it as an ordinary
  (non-item) child; no toolbar change.
