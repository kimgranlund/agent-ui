# LLD — Feed / Agent-Activity Family (`ui-progress` · `ui-avatar` · `ui-attachment` · `ui-toast`/`ui-toast-region`, catalog rows + allowlist, agent-activity exemplar)

> Refines: [`../spec/feed-family.spec.md`](../spec/feed-family.spec.md) (SPEC-R1…R22, SPEC-N1…N6) under
> [ADR-0112](../adr/0112-feed-family-v1-scope.md) (accepted; F1–F4 as recommended) and — for the link leg —
> [ADR-0114](../adr/0114-text-hyperlink-href.md) (accepted; its policy is consumed, never redefined). Build plan:
> [`../decompositions/feed-family-build.decomp.json`](../decompositions/feed-family-build.decomp.json)
> (coverage-clean, plan+strict). · proposed · 2026-07-08 · planner
>
> **Composes on:** `UIElement` (`dom/element.ts`) + the props/signal system (`dom/props.ts`) + `ElementInternals`
> ARIA (fleet law) + the icon adapter (`@agent-ui/icons` via `ui-icon` — the sanctioned cross-package edge).
> **No new package** (ADR-0112 cl.8): four ordinary control folders — `controls/progress/`, `controls/avatar/`,
> `controls/attachment/`, `controls/toast/` (the toast folder holds BOTH file sets, `toast.*` + `toast-region.*` —
> the radio/radio-group same-folder precedent; the file-set gate checks the folder triple by folder name, so the
> folder is `toast/`). Pure modules live in-folder. Catalog work lands in `a2ui/src/catalog/default/`; the
> partition rows in `a2ui/tools/agent/feed-catalog.ts`; the exemplar in `a2ui/src/examples/`.
>
> **Freeze discipline.** §2–§6 interfaces are the fan-out contract. A builder who cannot satisfy a frozen
> interface STOPS and escalates — the fix is a coordinated LLD/decomp repair, never a local deviation.

## 1 · Intent

Make agent activity visible with four hand-rolled, zero-dep controls: a thin-rail progress bar whose whole
contract is "how far along, honestly announced"; an identity mark that never renders broken or empty; a
FilePart-shaped file card that retires the hand-composed Icon+Text idiom; and the fleet's first transient
notification surface — region-hosted in the top layer, never focus-stealing, humane about time. Three types
enter the catalog same-wave; the toast pair becomes the ADR-0087 allowlist's first reasoned permanent
residents. The icons vendor addition is the PREP slice everything glyph-bearing depends on.

## 2 · `ui-progress` (SPEC-R1…R3)

### LLD-C1 — the element + stylesheet (`controls/progress/progress.ts` / `.css`)

```ts
const props = {
  value: prop.number(null),   // null ⇒ indeterminate (the native <progress> semantic — no boolean to desync)
  max: prop.number(100),
  label: prop.string(''),
} satisfies PropsSchema
```

Hardening is a pure in-file pair (unit-tested; no separate module — the math is two clamps):
`effectiveMax(max)` → `Number.isFinite(max) && max > 0 ? max : 100`; `effectiveValue(value, eMax)` →
`value == null || !Number.isFinite(value) ? null : Math.min(Math.max(value, 0), eMax)` (SPEC-R1's table).
Percent text: a module-memoized `Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })`
over `eValue / eMax`.

`connected()` installs two effects; `render()` stays the inherited no-op (component-built children only):

1. **Mark effect** (reads `value`, `max`): builds once `<span data-part="track"><span data-part="fill"></span></span>`,
   then per change: determinate ⇒ `fill.style.setProperty('--_pct', String((eValue / eMax) * 100))` and the
   `data-indeterminate` attribute removed; indeterminate ⇒ `data-indeterminate` set on the **fill** (an
   interior node — never a host attribute; no `:state()` dependency, jsdom-assertable).
2. **ARIA effect** (reads all three): `internals.role = 'progressbar'` (constant, set in `connected()` — the
   list.ts precedent); `ariaValueMin = '0'`; `ariaValueMax = String(eMax)`; determinate ⇒
   `ariaValueNow = String(eValue)` + `ariaValueText = pct(eValue, eMax)`; indeterminate ⇒ both `null`
   (SPEC-R3 AC2 — role/min/max persist); `ariaLabel = this.label || null`. Never `aria-hidden` (SPEC-R3).

```css
:where(ui-progress) {
  --ui-progress-track-size: 4px;            /* thin rail — density-invariant constant (slider.css:76-79 kin) */
  --ui-progress-min-inline-size: 8em;       /* the whole-shape floor (SPEC-R18 AC1; the slider-dot lesson) */
  --ui-progress-track-ink: var(--md-sys-color-neutral-track);   /* ADR-0059 solid-track role */
  --ui-progress-fill-ink: var(--md-sys-color-primary);
}
@scope (ui-progress) {
  :scope { display: block; min-inline-size: var(--ui-progress-min-inline-size); }
  :scope [data-part='track'] { display: block; position: relative; overflow: hidden;
    block-size: var(--ui-progress-track-size); border-radius: calc(var(--ui-progress-track-size) / 2);
    background: var(--ui-progress-track-ink); }
  :scope [data-part='fill'] { position: absolute; inset-block: 0; inset-inline-start: 0;
    inline-size: calc(var(--_pct, 0) * 1%); background: var(--ui-progress-fill-ink); border-radius: inherit; }
  :scope [data-part='fill'][data-indeterminate] {                     /* the sweep (SPEC-R2 AC2) */
    inline-size: 40%; animation: ui-progress-sweep 1.5s linear infinite; }
  @media (prefers-reduced-motion: reduce) {
    :scope [data-part='fill'][data-indeterminate] {                   /* stationary; opacity-only — no translation */
      inset-inline-start: 30%; animation: ui-progress-pulse 2s ease-in-out infinite; } }
  @media (forced-colors: active) {                                    /* the bar-chart lesson (SPEC-R19) */
    :scope [data-part='fill'] { background: CanvasText; }
    :scope [data-part='track'] { background: Canvas; border: 1px solid CanvasText; } }
}
@keyframes ui-progress-sweep { from { inset-inline-start: -40%; } to { inset-inline-start: 100%; } }
@keyframes ui-progress-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
```

- The sweep animates `inset-inline-start` (logical — RTL mirrors for free, SPEC-R2 AC3); non-compositor
  animation is accepted at a 4px-tall rail (risk ledger §10.9). The RTL leg needs no per-direction code.
- The keyframes live at stylesheet top level (outside `@scope`) — scoped `@keyframes` name resolution is the
  kind of engine-variance the fleet doesn't need; names are `ui-progress-*`-prefixed instead.

## 3 · `ui-avatar` (SPEC-R4…R7)

### LLD-C2 — the pure module (`controls/avatar/avatar-initials.ts`, DOM-free)

```ts
/** SPEC-R5: first grapheme of first word + first grapheme of last word (single word ⇒ one grapheme),
 *  locale-uppercased. Grapheme-safe via Intl.Segmenter('grapheme') with an Array.from code-point
 *  fallback (ledger §10.4). '' / whitespace-only ⇒ '' (the caller falls through to the glyph). */
export function initialsFrom(name: string): string
```

### LLD-C3 — the element + stylesheet (`controls/avatar/avatar.ts` / `.css`)

```ts
const props = {
  src: prop.string(''),
  name: prop.string(''),                                  // identity for initials; NOT announced by default
  label: prop.string(''),                                 // the a11y escape hatch (SPEC-R6)
  size: prop.enum(['sm', 'md', 'lg'] as const, 'md'),     // reflected — the CSS [size] hook (slider precedent)
} satisfies PropsSchema
```

Fallback chain (SPEC-R5) — one **render effect** over `src`, `name`, and a private `failedSrc` signal
(`signal<string>('')`):

- `src && src !== failedSrc.get()` ⇒ `replaceChildren(img)` where `img = <img alt="" src={src}>` with an
  `error` listener doing `failedSrc.set(this.src)` — the effect re-runs and falls through (no broken-image
  final state; a NEW `src` no longer equals `failedSrc`, so it re-attempts — SPEC-R5's re-attempt transition
  falls out of the equality, no extra state machine). `alt=""` = empty-alt semantics on an interior node
  (the Option/MenuItem sanction; host ARIA stays on internals).
- else `initialsFrom(name)` non-empty ⇒ `<span data-part="initials">{initials}</span>`.
- else ⇒ `<ui-icon name="user">` (decorative by its own default; the icon control module is statically
  imported so the tag is defined — the sanctioned sibling-control import).

**ARIA effect** — the `ui-icon` contract shape verbatim (SPEC-R6): `label` non-empty ⇒ `role='img'` +
`ariaLabel` + `ariaHidden = null`; else `role = null`, `ariaLabel = null`, `ariaHidden = 'true'`.

```css
:where(ui-avatar) {
  --ui-avatar-size: var(--ui-compact-md);   /* fork F3 — the ratified widget-box ramp; page override for big chrome */
  --ui-avatar-plane: var(--md-sys-color-neutral-surface-high);   /* ONE neutral pair (SPEC-R7) — AA-probed once */
  --ui-avatar-ink: var(--md-sys-color-neutral-on-surface);
}
:where(ui-avatar[size='sm']) { --ui-avatar-size: var(--ui-compact-sm); }
:where(ui-avatar[size='lg']) { --ui-avatar-size: var(--ui-compact-lg); }
@scope (ui-avatar) {
  :scope { display: inline-grid; place-items: center; overflow: hidden; border-radius: 50%;
    inline-size: var(--ui-avatar-size); block-size: var(--ui-avatar-size);
    background: var(--ui-avatar-plane); color: var(--ui-avatar-ink); vertical-align: middle; }
  :scope img { inline-size: 100%; block-size: 100%; object-fit: cover; display: block; }
  :scope [data-part='initials'] { font-size: calc(var(--ui-avatar-size) * 0.42);
    font-weight: var(--md-sys-typescale-label-medium-weight); line-height: 1; user-select: none;
    text-transform: uppercase; letter-spacing: 0.02em; }
  :scope ui-icon { font-size: calc(var(--ui-avatar-size) * 0.6); }   /* glyph derives from the box (F3) */
  @media (forced-colors: active) { :scope { border: 1px solid CanvasText; } }  /* circle stays visible (SPEC-R19) */
}
```

No hue anywhere: two different `name`s compute identical planes (SPEC-R7 AC1 is a computed-style equality
probe). The geometry probe asserts the box tracks `--ui-compact-*` under `[size]`×`[scale]` (SPEC-R20 AC1).

## 4 · `ui-attachment` (SPEC-R8…R11)

### LLD-C4 — the pure module (`controls/attachment/attachment-meta.ts`, DOM-free)

```ts
export type FileCategory = 'image' | 'audio' | 'video' | 'pdf' | 'text' | 'archive' | 'data' | 'default'
/** SPEC-R9 AC1 — case-insensitive, parameters stripped (split on ';'). Order: exact matches first
 *  (application/pdf → pdf; text/csv, application/json, application/xml, *spreadsheet*, *csv* → data),
 *  then prefixes (image/ audio/ video/ text/), archive set (zip|tar|gzip|x-7z|rar → archive), else default. */
export function fileCategory(mimeType: string): FileCategory
/** The glyph name per category — all vendored by LLD-C9: image→file-image · audio→file-audio ·
 *  video→file-video · pdf→file-pdf · text→file-text · archive→file-zip · data→file-code · default→file. */
export function categoryGlyph(c: FileCategory): IconName
/** The SPEC-R8 name fallback: Image · Audio · Video · PDF document · Text document · Archive · Data file · File. */
export function categoryLabel(c: FileCategory): string
/** SPEC-R9 AC2 — null/non-finite/negative ⇒ null (cell absent). Decimal steps B/KB/MB/GB/TB,
 *  Intl.NumberFormat (default locale, memoized, maximumFractionDigits: 1). */
export function formatBytes(size: number | null): string | null
```

### LLD-C5 — the element + stylesheet (`controls/attachment/attachment.ts` / `.css`) — metadata surface

Props: `{ name: prop.string(''), mimeType: prop.string(''), size: prop.number(null), href: prop.string('') }`.
One render effect builds (whole-swap per change — inert display rows, the bar-chart posture):

```html
<ui-icon data-part="glyph" name="{categoryGlyph(fileCategory(mimeType))}"></ui-icon>
<span data-part="body">
  <span|a data-part="name">{name || categoryLabel(category)}</span>   <!-- <a> only under LLD-C6's gate -->
  <span data-part="meta">{formatBytes(size)}</span>                    <!-- absent when null -->
</span>
```

`ui-icon` is decorative by its own default (aria-hidden — SPEC-R10); the name/meta are real text (the
accessible datum). Host takes **no role** — internals untouched by default.

```css
:where(ui-attachment) {
  --ui-attachment-min-inline-size: 12em;    /* the whole-shape floor (SPEC-R18 AC1) */
  --ui-attachment-border: var(--md-sys-color-neutral-outline);
  --ui-attachment-surface: transparent;     /* rides the ambient plane; a page may lift it */
}
@scope (ui-attachment) {
  :scope { display: inline-grid; grid-template-columns: auto 1fr; align-items: center;
    gap: var(--ui-space-sm); padding-inline: var(--ui-space-sm); padding-block: var(--ui-space-xs);
    border: 1px solid var(--ui-attachment-border); border-radius: var(--ui-radius-base);  /* F4: entry/container radius kin */
    background: var(--ui-attachment-surface);
    min-inline-size: var(--ui-attachment-min-inline-size); max-inline-size: 100%; }
  :scope [data-part='glyph'] { font-size: var(--ui-icon-md); }        /* content-icon register (geometry.md taxonomy) — bare --ui-icon was never a real token; the fleet only defines --ui-icon-{sm,md,lg} (dimensions.css) */
  :scope [data-part='body'] { display: grid; min-inline-size: 0; }    /* min 0 ⇒ the name cell can shrink to truncate */
  :scope [data-part='name'] { white-space: nowrap; overflow: hidden; text-overflow: ellipsis;  /* ADR-0106 mechanism, cited */
    font-size: var(--md-sys-typescale-body-medium-size); line-height: var(--md-sys-typescale-body-medium-line-height); }
  :scope [data-part='meta'] { color: var(--md-sys-color-neutral-on-surface-variant);
    font-size: var(--md-sys-typescale-body-small-size); line-height: var(--md-sys-typescale-body-small-line-height); }
  @media (forced-colors: active) { :scope { border-color: CanvasText; } }
}
```

Rhythm (gap/padding) rides the space ladder — density-responsive for free; the border/radius/floor are frame
constants (SPEC-R18 AC3). Composability (F4): the card is `inline-grid` + `max-inline-size: 100%`, so N-up in
a `Row(wrap)` and `ui-list` childhood both hold with zero extra code.

### LLD-C6 — the `href` leg, consuming the ONE shared gate (`controls/text/href.ts`)

**Reconciled (doc-review MAJOR, closed 2026-07-09):** this LLD originally specified its OWN gate module
(`gateHref(raw)` in `controls/_base/href-gate.ts`, reading `document.baseURI` internally) — independently
of content-family's LLD-C1, which specifies the same policy as `safeHref(raw, base)` in
`controls/text/href.ts` (DOM-free, `base` an explicit parameter). Two incompatible signatures for one
gate would have silently forked the security policy the moment either wave built. Resolved: **there is
no `_base/href-gate.ts`.** `controls/text/href.ts` (content-family LLD-C1) is the single canonical
module; this family imports from it, never re-specifies:

```ts
import { safeHref, LINK_REL, LINK_TARGET } from '../text/href.ts'
// call site: safeHref(this.href, document.baseURI) — base passed explicitly, per LLD-C1's contract
```

Attachment consumption (SPEC-R11): `href` non-empty ⇒ the name cell is `<a data-part="name">`; `safeHref`
allowed ⇒ the anchor gets `href` + `rel=LINK_REL` + `target=LINK_TARGET`; denied ⇒ the `<a>` **never gets an
`href` attribute** (inert placeholder — not exposed as a link; text intact). Empty `href` ⇒ a plain `<span>`.
The gate sits in the render effect, so attribute/property/bound writes all cross it (the last line).

**Build-order note:** since `controls/text/href.ts` is content-family's file, ui-attachment's `href` leg
has a soft ordering preference (build after content-family's LLD-C1 lands) — but it is not a hard
blocker: if feed-family's M1-href slice lands first, it imports a module that does not yet exist and the
build simply fails loud (a missing-import error), not a silent fork. SPEC-R11 AC3's grep (one
URL-parse/allowlist site, now trivially true since there is exactly one file that defines it) is the
standing proof. The validator first line over static `Attachment.href` literals rides the same mechanism
ADR-0114 cl.3 mints for `Text.href` — the catalog-wave builder verifies the rule keys off prop name/type,
not off the `Text` row, and extends it if it does not.

## 5 · `ui-toast` + `ui-toast-region` (SPEC-R12…R17)

### LLD-C7 — the toast (`controls/toast/toast.ts` / `.css`)

```ts
const props = {
  urgent: prop.boolean(false),   // role=alert opt-in (SPEC-R15)
  duration: prop.number(6000),   // ms; ≤0/non-finite ⇒ never auto-dismiss (SPEC-R14)
  action: prop.string(''),       // non-empty ⇒ actionable ⇒ NEVER auto-dismisses (SPEC-R16, WCAG 2.2.1)
} satisfies PropsSchema
```

- **Role in the constructor** (SPEC-R15 AC2): `internals.role = 'status'` at construction — the live-region
  semantics exist **before** insertion, so content present at append announces; an `urgent` effect flips
  `status ↔ alert`. (Real SR announcement is manual-verification territory; the automated probes read
  internals — stated honestly, ledger §10.6.)
- **Anatomy** (`connected()`, once): adopt any light-DOM children into a component-built
  `<span data-part="message">` (one-time move; late-added children are out of scope v1 — ledger §10.7), then
  append the affordance cluster: `action` non-empty ⇒ `<ui-button data-part="action">{action}</ui-button>`;
  always `<ui-button data-part="close">` icon-only (`<ui-icon name="x">`) with accessible name **"Dismiss"**
  per the fleet's icon-only-button idiom (the stated English-only limitation). Native `<button>` is banned
  (fleet law) — the affordances are `ui-button` instances (sanctioned sibling import), reachable in normal
  tab order (SPEC-R15 AC3); no tabindex games, no autofocus.
- **Events** (fleet vocabulary only): action activation ⇒ dispatch `select`, then `close()`; the close
  affordance and timer expiry ⇒ `close()`. `close()` is idempotent (a `closed` latch): clear the timer,
  dispatch **one** `close`, `this.remove()` (SPEC-R14 AC1/AC2).
- **The timer** (SPEC-R16) — remaining-time accounting, all local state: `remaining = duration`,
  `startedAt = performance.now()` on arm; **pause** = `clearTimeout` + `remaining -= now − startedAt`;
  **resume** = re-arm with `remaining`. Armed on `connected()` iff `action === '' && Number.isFinite(duration)
  && duration > 0`; an `action`/`duration` change re-evaluates (an actionable toast never has a live timer).
  Pause predicate = `hovered ∨ focusWithin`, tracked by four host listeners — `pointerenter`/`pointerleave`,
  `focusin`/`focusout` (focusout consults `relatedTarget` containment; null-safe — ledger §10.5); the timer
  runs only when both flags are false. `disconnected()` clears everything.

```css
:where(ui-toast) {
  --ui-toast-inline-size: 20em;
  --ui-toast-surface: var(--md-sys-color-neutral-surface-brightest);
  --ui-toast-border: var(--md-sys-color-neutral-outline);
  --ui-toast-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
}
@scope (ui-toast) {
  :scope { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: var(--ui-space-sm);
    box-sizing: border-box; /* required so the fixed inline-size below is the RENDERED width, not content-box
      plus padding/border on top (build-verify: 20em measured 346px without this, 320px with it) */
    inline-size: var(--ui-toast-inline-size); max-inline-size: 100%;
    padding-inline: var(--ui-space-md); padding-block: var(--ui-space-sm);
    background: var(--ui-toast-surface); color: var(--md-sys-color-neutral-on-surface);
    border: 1px solid var(--ui-toast-border); border-radius: var(--ui-radius-base);
    box-shadow: var(--ui-toast-shadow); }
  :scope [data-part='message'] { min-inline-size: 0; overflow-wrap: anywhere; }
  @media (forced-colors: active) { :scope { border-color: CanvasText; } }  /* the shadow vanishes; the border carries the edge */
}
```

The three-column grid is safe against arbitrary message content **because** of the message-adoption wrap —
light-DOM nodes never become stray grid items (the reason LLD-C7 adopts instead of styling raw children).

### LLD-C8 — the region (`controls/toast/toast-region.ts` / `.css`)

No props in v1 (placement is tokens — SPEC-R12; a placement prop is the named foreseen extension).

- **Top layer** (fork F1): `connected()` sets `popover="manual"` on the host if absent — a platform
  attribute, not ARIA (the internals-only law governs ARIA; the overlay trait's popup precedent). A
  `MutationObserver` (childList) tracks `ui-toast` children: count ≥ 1 ⇒ `showPopover()` (guarded by
  `:popover-open`); count 0 ⇒ `hidePopover()` (SPEC-R12 AC1). Observer disconnects on `disconnected()`.
- **Above-late-modals** (SPEC-R12 AC2): `show()` **re-asserts top-layer order** — when already
  `:popover-open`, it calls `hidePopover(); showPopover()` back-to-back (synchronous, one frame, no focus
  implications — manual popovers never hold focus) before appending, so a completion arriving while a
  modal is open paints above it. Existing toasts under a *later* modal re-surface on the next show — the
  ADR requires exactly the arriving-completion case; ledger §10.8 records the residual.
- **`show()`** (SPEC-R13): `show(options: ToastOptions | string): UIToastElement` — normalize the string
  shorthand to `{ message }`; create `ui-toast`; assign `urgent`/`duration`/`action`; set
  `textContent = message` **before** append (announcement-correct); re-assert top layer; append; return the
  element. Calling `show()` on a disconnected region throws (a dev error, not a silent queue). No static
  API exists anywhere (SPEC-R13 AC2; ADR-0082).

```css
:where(ui-toast-region) {
  --ui-toast-region-inset: var(--ui-space-lg);
  --ui-toast-region-gap: var(--ui-space-sm);
}
@scope (ui-toast-region) {
  :scope:popover-open { position: fixed; inset: auto;                 /* override the UA popover centering */
    inset-block-end: var(--ui-toast-region-inset); inset-inline-end: var(--ui-toast-region-inset);
    display: flex; flex-direction: column; gap: var(--ui-toast-region-gap);
    margin: 0; border: 0; padding: 0; background: transparent; overflow: visible;
    pointer-events: none; }                                           /* empty area never intercepts (SPEC-R12) */
  :scope:popover-open > ui-toast { pointer-events: auto; }
}
```

Stacking: normal-flow column, append order = oldest→newest top→bottom — newest nearest the block-end inset
edge (SPEC-R12 AC3), zero JS positioning. Logical insets ⇒ RTL mirrors free.

### The ownership ruling (SPEC-R13's delegated call — resolved here, not left open)

**v1 ownership: the consumer mounts the region.** A page (or an app embedding `agent-app-shell`) declares
`<ui-toast-region>` where it wants announcement scope and holds the reference it calls `show()` on —
concretely: `const region = document.querySelector('ui-toast-region')!; region.show({ message, tone })`
(the LLD-C12 demo page is the canonical worked mount; a real consumer copies its shape). The
app-shell does **NOT** compose a default region in this wave. Grounds: (a) ADR-0082's per-instance isolation
holds trivially — the owner of the region is the owner of the chrome, no cross-shell contention by
construction; (b) a default region is dead top-layer chrome for every consumer that never toasts, and
invites double-region ambiguity the moment a page mounts its own; (c) adoption later is purely additive —
one composition slice in `@agent-ui/app` under that package's own record (exactly where ADR-0112 F2 left
it), taken with real usage evidence. **Named revisit trigger:** the first `@agent-ui/app` consumer needing
completion announcements without owning page chrome. This is a scope allocation inside F2's ratified
architecture, not a new fork — no ADR is owed (the ADR-default-NO); this section is the record, and the
site's toast demo page (LLD-C12) is the teaching consumer.

## 6 · Icons PREP + descriptors + fleet integration (SPEC-N3/N5)

**LLD-C9 — icons vendor addition (the PREP slice; ADR-0066 mechanics, icons package).** `ICON_NAMES` grows
11 → 20: `user` · `file` · `file-image` · `file-audio` · `file-video` · `file-pdf` · `file-text` ·
`file-zip` · `file-code`. The Phosphor pack vendors each verified inner-SVG payload (exact path data checked
against the pack at build — names exist in Phosphor's set; any rename is resolved at vendor time, the
`IconName` union is ours). Registry/type tests extend; **this lands before any fan-out slice renders a
glyph** (the document-row silent-empty defect is the counter-example; SPEC-N5).

**LLD-C10 — descriptors** (per the `icon.md`/display-leaf and pattern shapes): `progress.md`
(`tier: display`), `avatar.md` (`tier: indicator` — the F3 widget-box geometry class; non-interactive is
stated in prose), `attachment.md` (`tier: display`), `toast.md` (`tier: pattern` — interactive affordances;
`events: [select, close]`), `toast-region.md` (`tier: layout` — inset/gap only, no surface paint of its
own). Each: attributes mirror `static props`, `parts:` documented (`track/fill` · `initials` ·
`glyph/body/name/meta` · `message/action/close`), `aria:` block (progress `role: progressbar` + value
semantics; avatar decorative-default + `label` escape hatch **including the "label-less avatar beside no
name announces nothing" author-error note** — SPEC-R6; toast `role: status/alert`, `roleSource: internals`),
`forcedColors:` lines, geometry blocks (avatar names the compact-ramp lookup; progress/attachment declare NO
`size`), and the toast pair's **app-surface consumption story** (region-hosted, `show()`, not catalogued —
the ADR-0112 cl.6 pointer). The attachment descriptor states `sizeBytes` (renamed from `size`, ADR-0112
Amendment 1) is **embedder-supplied, not a wire field** (SPEC-R8). Each folder ships its
`{name}-descriptor.test.ts` trip-wire.

**LLD-C11 — the serial integration slice** (ONE writer, after all four folders land):
- `controls/index.ts` — export all five elements (family-coherence C1).
- `descriptor/component-styles.css` — import the five sheets (C3).
- `descriptor/site-coverage.test.ts` — tier-membership lists gain `progress`+`attachment` (display),
  `avatar` (indicator), `toast` (pattern), `toast-region` (layout). **Gate edit + negative control**:
  reverting it must fail `npm test`.
- components `package.json` per-control `exports` entries (the ADR-0080 T4 three-way gate).
- `npm run size` by hand (ADR-0040 §3); the family-ceiling re-base ADR-0112 cl.8 expects is recorded as its
  own note, never silently absorbed (SPEC-N4).
- **Housekeeping owed by ADR-0112's Repairs flag:** `references/geometry.md` content-icon taxonomy line
  drops the never-shipped `--ui-ind` (cites the shipped `--ui-icon` register) — one line, same slice.

**LLD-C12 — site pages.** Per `PAGES_BY_TIER`: `progress-doc` · `avatar-doc` · `attachment-doc` ·
`toast-region-doc` · `toast-doc` **+ `toast-demo`** — the demo is the app-surface consumption story
(a live region + `show()` buttons: plain, urgent, actionable — demonstrating pause-on-hover and the
never-expiring actionable toast), plus toc/nav rows the drift gates walk. Degenerate-input strips on the doc
pages double as visual fixtures (the chart precedent).

## 7 · Catalog wave (SPEC-R17/R21)

**LLD-C13 — rows + factories + allowlist + partition** (`a2ui/src/catalog/default/` + `a2ui/tools/agent/feed-catalog.ts`):

```jsonc
// catalog.json → components (all display-only: no value mark, no children)
"Progress":   { "properties": {
  "value": { "type": { "type": "number" }, "bindable": true, "mapsTo": "value" },
  "max":   { "type": { "type": "number" }, "bindable": true, "mapsTo": "max" },
  "label": { "type": { "type": "string" }, "bindable": true, "mapsTo": "label" } } },
"Avatar":     { "properties": {
  "src":   { "type": { "type": "string" }, "bindable": true, "mapsTo": "src" },
  "name":  { "type": { "type": "string" }, "bindable": true, "mapsTo": "name" },
  "label": { "type": { "type": "string" }, "bindable": true, "mapsTo": "label" },
  "size":  { "type": { "type": "string", "enum": ["sm", "md", "lg"] }, "mapsTo": "size" } } },
"Attachment": { "properties": {
  "name":     { "type": { "type": "string" }, "bindable": true, "mapsTo": "name" },
  "mimeType": { "type": { "type": "string" }, "bindable": true, "mapsTo": "mimeType" },
  "size":     { "type": { "type": "number" }, "bindable": true, "mapsTo": "size" },   // embedder-supplied — row note
  "href":     { "type": { "type": "string" }, "bindable": true, "mapsTo": "href" } } } // component-gated (ADR-0114)
```

```ts
// factories.ts — plain accessor factories (the chart precedent); no value mark, no submitGate.
export const progressFactory: WidgetFactory = accessorFactory('ui-progress')
export const avatarFactory: WidgetFactory = accessorFactory('ui-avatar')
export const attachmentFactory: WidgetFactory = accessorFactory('ui-attachment')
```

```ts
// index.test.ts — the allowlist's first permanent residents (SPEC-R17; ADR-0112 cl.6 reasons verbatim)
const EXCLUSION_ALLOWLIST = new Map<string, string>([
  ['Toast', 'ADR-0112 cl.6 — app-surface chrome, not agent-emittable: a self-expiring record breaks history-must-not-lie; agent-raised chrome breaks payload↔DOM traceability; the ADR-0097 partition bans overlays in asks'],
  ['ToastRegion', 'ADR-0112 cl.6 — the Toast host surface; same three reasons; consumed by page code only'],
])
```

The residue guard (already standing) proves neither key is catalogued. Partition rows (`feed-catalog.ts`,
ADR-0112 cl.7): `Avatar` → `FEED_SURFACE_TYPES` (the Icon-parity identity argument); `Progress` →
`FEED_EXCLUDED` (a live indicator inside a frozen-able ask is a lying record); `Attachment` →
`FEED_EXCLUDED` (artifact content; **revisit trigger**: a real file-pick ask) — 24 IN / 15 OUT over 39,
partition gate green. Build-verify (named, not guessed): the tag→PascalCase util yields
`toast-region → ToastRegion` (the `combo-box → ComboBox` precedent — assert in the gate run); the validator
first-line coverage of `Attachment.href` (LLD-C6's coordination note).

**LLD-C14 — catalog SPEC repair.** `a2ui-catalog.spec.md` §5.2 gains the three rows (cells per SPEC-R21's
table + landed factory facts) in the same change as the rows — the coverage table stays the one normative
home; this family's SPEC is cited as the behavior contract.

## 8 · Exemplar wave (SPEC-R22, M2)

**LLD-C15 — the agent-activity exemplar + the document-row upgrade + §5.2 Notes.** Seed
`agent-task-status` (`a2ui/src/examples/catalog-coverage.ts`): data model
`{ agent: { name }, task: { title, pct }, artifact: { name, mimeType, size } }`; components:
`Card > Column [ Row [ Avatar(name: {path:/agent/name}), Text(h4 title) ], Progress(value: {path:/task/pct},
label), Attachment(name/mimeType/size bound) ]` — identity + how-far + what-it-produced in one card: the
seed demonstrates the guidance. Joins `allSeeds`, validates 0-`CATALOG`. The `document-row-toolbar` seed's
hand-composed `Card`+`Row`+`Icon`+`Text` attachment assembly (`catalog-coverage.ts:184-235`) is **replaced**
by `Attachment` (its recorded missing-glyph comment block retires with it). §5.2 Notes gain the three
when-to-use lines + the TaskState mapping guidance (SPEC-R22's wording — prose only; the layering trip-wire
proves zero `a2a` imports).
**LLD-C16 — corpus/prompt re-validation** over the widened 39-type catalog (the ADR-0087 consequence
pattern); drift repaired in the same change.

## 9 · Failure modes & edge handling (the per-case ledger)

| # | Case | Handling | Where |
|---|---|---|---|
| 1 | non-finite/negative/over-max `value`, bad `max` | the effective-pair clamps at the effect boundary — no case throws, indeterminate is the null-safe default | LLD-C1 (SPEC-R1) |
| 2 | `src` load error / error on EVERY src | `failedSrc` equality — fallback renders, re-attempt on any new src; no listener leak (img is replaced wholesale) | LLD-C3 |
| 3 | `name` with grapheme clusters (emoji, combining) | `Intl.Segmenter` grapheme split; code-point `Array.from` fallback where Segmenter is absent (both unit-pinned) | LLD-C2 |
| 4 | `Intl.Segmenter` unavailable | the fallback path above — initials degrade to code-point-safe, never split surrogates | LLD-C2 |
| 5 | `focusout` with `relatedTarget: null` (window blur) | treated as focus-left ⇒ resume — a timer running in a blurred tab is the platform norm; hover flag still pauses | LLD-C7 |
| 6 | live-region announcement fidelity (SR × browser matrix) | role set in constructor + content before append is the best structural guarantee; automated probes read internals; real SR runs are manual-verification, stated not hidden | LLD-C7/C8 (SPEC-R15) |
| 7 | light-DOM children added to a toast AFTER adoption | out of scope v1 — the message is fixed at show/connect; documented in `toast.md` | LLD-C7 |
| 8 | toasts existing when a modal opens LATER | covered on the next `show()` (re-assert); the standing residual is recorded — the ADR requires the arriving-completion case only | LLD-C8 (SPEC-R12 AC2) |
| 9 | `inset-inline-start` sweep animation is not compositor-driven | accepted at a 4px rail; logical-property RTL correctness outweighs; revisit on a measured jank complaint | LLD-C1 |
| 10 | `show()` on a disconnected region | throws (dev error) — never a silent queue or a hidden global | LLD-C8 |
| 11 | duplicate `close` paths (button + timer race) | the `closed` latch — exactly one `close` event, remove() idempotent | LLD-C7 |
| 12 | denied/unparseable `href` | the gate returns null ⇒ anchor without `href` (inert, not a link to AT); never rewritten, never destroyed | LLD-C6 (ADR-0114) |
| 13 | mime garbage (`''`, `"x/"`, params, uppercase) | `fileCategory` total function ⇒ `default` glyph + "File" label — never an empty title or missing glyph | LLD-C4 |
| 14 | `size` = 0 / negative / NaN / huge | 0 ⇒ "0 B"; negative/NaN ⇒ cell absent; TB cap formats the tail | LLD-C4 |
| 15 | region unstyled consumer (ADR-0102 Lane A) | popover UA default + the token block ship the correct rendering with zero page CSS; page CSS is override freedom only | LLD-C8 |
| 16 | icons pack missing a new name | non-throwing `data-icon-missing` render (resolve.ts) — but the PREP gate makes this unreachable for the nine vendored names | LLD-C9 |

## 10 · Test plan (per slice) & gates

- **Pure units (DOM-free):** `avatar-initials.test.ts` (SPEC-R5 AC3 rows) · `attachment-meta.test.ts`
  (SPEC-R9 AC1/AC2 rows: categories incl. params/case, byte formatting, glyph/label maps) · progress
  effective-pair rows (SPEC-R1 table) · `href-gate.test.ts` (allowed/denied/relative/unparseable — mirrors
  ADR-0114's acceptance).
- **jsdom:** props/attribute reflection per control; internals probes (progressbar values incl. the
  indeterminate null-ness both ways; avatar decorative↔labelled; toast status/alert **read directly** — the
  tabs precedent); fallback-chain transitions; attachment DOM shape (glyph aria-hidden, name/meta text, no
  size cell when null); toast fake-timer suite (SPEC-R16 AC1–AC3: expiry, remaining-time pause/resume via
  synthesized pointer/focus events, actionable-never-expires); region childList show/hide; `show()` return
  value + throw-when-disconnected; descriptor trip-wires (5×).
- **Browser, Chromium + WebKit** (SPEC-N2 — jsdom is blind to top layer, real timers, WHCM, painted
  geometry): whole-shape floors (bare progress + populated attachment in an unstyled flex row); progress
  fill proportion ε-check + RTL fill direction + forced-colors computed styles + reduced-motion emulation
  (no translation animation); avatar box-tracks-compact-ramp geometry probe under `[size]`×`[scale]` +
  circle WHCM border; attachment truncation + RTL glyph position; toast focus-neutrality
  (`document.activeElement` unchanged across `show()`), tab-order reachability, real-duration
  expiry/pause, region top-layer above an open `ui-modal` (`elementsFromPoint` at the toast rect), region
  hides-on-empty, empty-region click-through (`pointer-events` probe).
- **Catalog/exemplar gates:** `factories.test.ts` (three types, binding); `index.test.ts` fleet-derived
  gate + the two-entry allowlist + residue guard; partition gate at 24/15; `validateA2ui` 0-`CATALOG` over
  the three-type payload and the exemplar; corpus + derived-prompt re-validation (M2).
- **Gates cadence:** `npm run check && npm test` at every slice boundary; `npm run test:browser` before
  each wave commit (the component-reviewer DoD — jsdom-green ≠ done); `npm run size` by hand at LLD-C11;
  negative controls on the site-coverage membership edit and the allowlist entries (revert ⇒ red).

## 11 · Build sequence (checkpointed; = the decomp's edge order)

1. **Wave M1-PREP (serial):** LLD-C9 icons vendor addition. *Checkpoint:* icons tests green; all nine
   names resolve real payloads (no `data-icon-missing`).
2. **Wave M1-a (parallel fan-out — one writer per folder):** LLD-C1 (progress) ∥ LLD-C2→C3 (avatar) ∥
   LLD-C4→C5 (attachment, metadata only) ∥ LLD-C7→C8 (toast + region, one writer for the folder).
   *Checkpoint:* folder-local jsdom + browser legs green per folder.
3. **Wave M1-b (serial):** LLD-C10 descriptors finalized in-folder, then LLD-C11 (barrel/styles/gate
   edits/exports/size/geometry.md repair) — the ONE shared-file writer. *Checkpoint:* repo-wide
   check+test+browser green; size reported.
4. **Wave M1-c (parallel):** LLD-C12 site pages ∥ LLD-C6 href leg (with-or-after the shared gate module
   exists — the content-wave coordination rule) ∥ LLD-C13 catalog rows+factories+allowlist+partition (same
   wave as the descriptors — ADR-0087), then LLD-C14 catalog-SPEC repair. *Checkpoint:* site gates green;
   fleet-derived gate green with exactly the two reasoned entries; partition 24/15; href negative controls
   green in both engines.
5. **Wave M2:** LLD-C15 exemplar + document-row upgrade + §5.2 Notes, then LLD-C16 corpus/prompt
   re-validation. *Checkpoint:* SPEC-R22 ACs; exemplar renders in the gallery; layering trip-wire green.

## Component IDs (trace)

`LLD-C1` progress element+css ← SPEC-R1/R2/R3/R18/R19/R20 · `LLD-C2` initials module ← SPEC-R5 · `LLD-C3`
avatar element+css ← SPEC-R4/R5/R6/R7/R19/R20 · `LLD-C4` attachment-meta module ← SPEC-R8/R9 · `LLD-C5`
attachment element+css ← SPEC-R8/R9/R10/R18/R19/R20 · `LLD-C6` href leg + shared gate ← SPEC-R11 ·
`LLD-C7` toast ← SPEC-R14/R15/R16/R19 · `LLD-C8` region + ownership ruling ← SPEC-R12/R13/R17 · `LLD-C9`
icons PREP ← SPEC-N5 · `LLD-C10` descriptors ← SPEC-R1/R4/R8/R14/R20 · `LLD-C11` integration ←
SPEC-N3/N4 · `LLD-C12` site pages ← SPEC-N3 · `LLD-C13` catalog/allowlist/partition ← SPEC-R17/R21 ·
`LLD-C14` catalog-SPEC repair ← SPEC-R21 · `LLD-C15` exemplar/Notes/doc-row ← SPEC-R22 · `LLD-C16` corpus
re-validation ← SPEC-R22. (`LLD-C#` IDs per-doc-scoped — the house convention.)
