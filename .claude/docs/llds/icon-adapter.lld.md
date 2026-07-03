# LLD — the icon adapter (`@agent-ui/icons`) + the Phosphor default pack + `ui-icon`

> Component LLD for the icon-adapter intake (decomp `icon-adapter.decomp.json`). **Trace note.** Component
> LLDs trace to the **ADR log + `goals.md` milestones** (the components' design authority); they do **not**
> use the A2UI `SPEC-R#` family (the components have none — there is no `SPEC-R1` here to trace), so the
> A2UI LLD harness's `SPEC-R#` check is N/A here (the house convention, per `indicator-element.lld.md:13`
> / `field-form-provider.lld.md`). Trace targets: **ADR-0065** (the adapter architecture) · **ADR-0066**
> (the Phosphor default pack). · proposed · 2026-07-03 · planner
>
> **Composes on:** the FACE `UIElement` base (`dom/element.ts`) for `ui-icon` only; the adapter core
> depends on nothing (zero-dep leaf). **Layers/packages:** NEW leaf **`@agent-ui/icons`** (registry +
> resolve + `setIcon` + the Phosphor pack — zero dependency) · `@agent-ui/components/src/controls/icon/`
> (`ui-icon`, imports `@agent-ui/icons`). Edge direction: `components → icons` (inward, mirroring
> `components → shared`).
>
> **Freeze discipline.** §2 (Interfaces) is the contract the build fan-out codes against without talking
> to each other. A builder who cannot satisfy a frozen interface STOPS and escalates — the fix is a
> coordinated LLD/decomp repair, never a local deviation.

## 1 · Intent

Replace the ad-hoc, per-site glyph literals across the control suite with one swappable icon-sourcing
architecture: a pack-agnostic adapter (registry + resolver) with Phosphor as the shipped default,
feeding inline `<svg>` content **into the existing `[data-role='icon'|'caret']` geometry cells without
redesigning them**. This wave ships the mechanism + the Phosphor pack + the `ui-icon` consumer surface.
It does NOT migrate any existing caret — that is a separate, later, per-control wave (§8).

## Audit (grounded against the tree — the migration surface)

Every current glyph touchpoint, its technique, and what "migrated" means. **In scope (real icon
content):**

| # | Site | Current | Canonical icon | "Migrated" means |
|---|---|---|---|---|
| 1 | `controls/select/select.ts:282` | `caretSpan.textContent = '▾'` | `caret-down` | `setIcon(caretSpan, 'caret-down')`; caret cell CSS unchanged |
| 2 | `controls/calendar/calendar.ts:318` | `prev.textContent = '‹'` | `caret-left` | `setIcon(prev, 'caret-left')` |
| 3 | `controls/calendar/calendar.ts:332` | `next.textContent = '›'` | `caret-right` | `setIcon(next, 'caret-right')` |
| 4 | `controls/text-field/text-field.ts:725` | `btn.textContent = '✕'` | `x` | `setIcon(btn, 'x')` |
| 5 | `controls/text-field/text-field.ts:742` | `btn.textContent = '👁'` (emoji) | `eye`/`eye-slash` | `setIcon(btn, revealed ? 'eye-slash' : 'eye')` on toggle |
| 6 | `controls/text-field/text-field.ts:764` | `btn.textContent = '📅'` (emoji) | `calendar-blank` | `setIcon(btn, 'calendar-blank')` |
| 7 | `controls/text-field/text-field.ts:798` | `up.textContent = '▲'` | `caret-up` | `setIcon(up, 'caret-up')` |
| 8 | `controls/text-field/text-field.ts:805` | `down.textContent = '▼'` | `caret-down` | `setIcon(down, 'caret-down')` |

**Corrections to the intake's candidate list (verified against the tree):**

- **`ui-combo-box` has NO caret today** — `combo-box.ts` renders no disclosure glyph; `combo-box.css:73`
  only comments "stacking context for any decorative caret pseudo" (no element, no pseudo). It is NOT a
  current touchpoint. A future disclosure-caret for select-parity would be net-NEW content, not a
  migration — flagged as an optional design decision for the migration wave, not scoped here.
- **`text-field`'s "caret" is two different things.** Its text-editing caret guard (the model→surface
  write discipline, `[[g4-g6-form-text-field-design]]`) is the TEXT CURSOR — unrelated to icons, scoped
  OUT. Its real icon touchpoints are the adornment buttons (rows 4–8), which ARE in scope.
- **`traits/value-codec.ts`** — value transformation (currency/number/date); no glyph. Verified OUT.

**CSS-drawn decorations (NOT glyph content — stay CSS, OUT of the adapter):** `checkbox.css:114-122`
(checkmark via `clip-path` polygon — crisp, geometry-scaled, state-transition-animated), `radio.css:75`
(dot), `switch.css:88/114` (thumb), `slider.css:97/126` (thumb/track), `tabs.css:90` (active underline),
`field.css:87` (`content: ' *'` required asterisk — typographic, not an icon). The `check` icon IS
vendored (ADR-0066) as the forward companion **only if** a future ADR elects to migrate the checkbox
checkmark to an icon; the CSS tick is the recommended default and no migration is scoped.

## 2 · Interfaces (FROZEN — the fan-out contract)

### LLD-C1 — canonical names + pack type (`@agent-ui/icons/src/types.ts`)

```ts
// erasableSyntaxOnly-safe: an `as const` array → a literal union (NO enum).
export const ICON_NAMES = [
  'caret-down', 'caret-up', 'caret-left', 'caret-right',
  'x', 'eye', 'eye-slash', 'calendar-blank', 'check',
] as const
export type IconName = (typeof ICON_NAMES)[number]

/** An inert, swappable pack. `icons[name]` is the INNER SVG body (the `<path>`/`<rect>` markup,
 *  NO outer `<svg>`); `viewBox` is pack-wide (Phosphor = '0 0 256 256'). */
export interface IconPack {
  readonly id: string
  readonly viewBox: string
  readonly icons: Readonly<Record<IconName, string>>
}
```

### LLD-C2 — the registry (`@agent-ui/icons/src/registry.ts`)

```ts
export interface IconRegistry {
  registerPack(pack: IconPack): void        // last-wins; first registered becomes active
  setActivePack(id: string): void           // throws if id unknown
  activePack(): IconPack | null
  overrideIcon(name: IconName, body: string): void  // registry-level, pack-independent; survives setActivePack
  body(name: IconName): string | null       // the resolution read: override map FIRST, then active pack; null if neither
}
export declare class Registry implements IconRegistry { /* … */ }
/** The default singleton — what `resolveIcon`/`setIcon`/`ui-icon` read by default. */
export declare const iconRegistry: IconRegistry
```

Semantics: `registerPack` stores by `pack.id` (a duplicate id is a last-wins override, `console.warn`ed
— the a2ui `Registry` precedent, `a2ui/src/catalog/registry.ts:58`). `overrideIcon` writes to a
**registry-level, pack-independent** override map (NOT the pack object — packs stay immutable). **Scope
(frozen):** an override is keyed by NAME alone, so it **survives `setActivePack`** — it shadows whatever
pack is active until explicitly cleared (a future `clearOverride`/`overrideIcon(name, null)` is a noted
extension, unbuilt). **Precedence:** resolution is encapsulated by `body(name)` — override map FIRST,
then the active pack — and `resolveIcon` reads it (LLD-C3 snippet), so the precedence lives in ONE place.
`registerPack`/`setActivePack`/`overrideIcon` are PUBLIC (ADR-0065 clause 5 — consumer extensibility);
`body()` is the internal read the resolver + tests share.

### LLD-C3 — resolve + inject (`@agent-ui/icons/src/resolve.ts`)

```ts
/** Build a fresh `<svg>` (SVG namespace) for `name` from the active pack. Unknown name / no active
 *  pack → a non-throwing empty `<svg data-icon-missing="name">`. Each call returns a NEW element. */
export declare function resolveIcon(name: IconName, registry?: IconRegistry): SVGElement

/** Imperative sugar: replace `el`'s children with `resolveIcon(name)`. The one-liner the migration
 *  wave drops in at each audit site. */
export declare function setIcon(el: Element, name: IconName, registry?: IconRegistry): void
```

`resolveIcon` construction (zero-dep, jsdom + browser safe):

```ts
// Body lookup is encapsulated by the registry (LLD-C2 `body()`): override map FIRST, then active pack.
// The viewBox comes from the active pack (an override body is authored for the active pack's viewBox —
// a documented v1 constraint); no active pack ⇒ missing, even if an override body exists.
const pack = registry.activePack()
const body = registry.body(name)
if (pack == null || body == null) return emptyMissing(name)   // <svg data-icon-missing="name"> — non-throwing

const NS = 'http://www.w3.org/2000/svg'
const svg = document.createElementNS(NS, 'svg')
svg.setAttribute('viewBox', pack.viewBox)
svg.setAttribute('fill', 'currentColor')     // inherits control ink
svg.setAttribute('width', '100%')            // fills its containing cell's content box
svg.setAttribute('height', '100%')
svg.setAttribute('aria-hidden', 'true')      // decorative by default
svg.setAttribute('focusable', 'false')       // legacy-IE/Edge tab-stop guard
svg.innerHTML = body                         // parsed in the SVG namespace (svg is an SVG element)
```

### LLD-C4 — the Phosphor pack (`@agent-ui/icons/src/phosphor/`)

```ts
// icons.gen.ts — GENERATED, committed (ADR-0066). Inert bodies keyed by canonical name.
export const phosphorIcons: Record<IconName, string> = { 'caret-down': '<path …/>', /* … ×9 */ }

// index.ts — the '@agent-ui/icons/phosphor' subpath.
export const phosphorPack: IconPack = { id: 'phosphor', viewBox: '0 0 256 256', icons: phosphorIcons }
iconRegistry.registerPack(phosphorPack)   // SIDE EFFECT: self-register + activate on import
```

### LLD-C5 — `ui-icon` (`@agent-ui/components/src/controls/icon/icon.ts`)

```ts
import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { setIcon, type IconName } from '@agent-ui/icons'   // the cross-package edge (trip-wire allowlist, LLD-C6)

const props = {
  name: prop.string(''),    // an IconName; empty → renders nothing (clears children)
  label: prop.string(''),   // non-empty → meaningful: role=img + aria-label; empty → decorative (aria-hidden)
} satisfies PropsSchema

// The declare-merge accessor interface (erasableSyntaxOnly — no decorators; the fleet pattern).
export interface UIIconElement extends ReactiveProps<typeof props> {}
export class UIIconElement extends UIElement {
  static props = props
  protected override connected(): void {
    // name effect: (re)inject the active pack's svg on name change; an empty name clears the host.
    this.effect(() => {
      if (this.name) setIcon(this, this.name as IconName)
      else this.replaceChildren()
    })
    // label effect: decorative vs meaningful. ARIA via ElementInternals ONLY (the FACE rule — never a
    // host attribute), and aria-hidden is toggled BOTH directions — a labelled icon must CLEAR it, or an
    // icon that was ever decorative stays aria-hidden forever despite carrying role=img + aria-label.
    this.effect(() => {
      if (this.label) {
        this.internals.role = 'img'; this.internals.ariaLabel = this.label; this.internals.ariaHidden = null
      } else {
        this.internals.role = null; this.internals.ariaLabel = null; this.internals.ariaHidden = 'true'
      }
    })
  }
}
if (!customElements.get('ui-icon')) customElements.define('ui-icon', UIIconElement)   // idempotent self-define
```

Host is its own sized cell — `icon.css`: `:where(ui-icon){ inline-size:1em; block-size:1em }`,
`@scope(ui-icon){ :scope{ display:inline-flex; color:inherit } :scope svg{ display:block } }`. Consumers
size via `font-size` or an explicit `inline-size`. Self-defines `ui-icon` on import; joins the family
barrel (`controls/index.ts`).

**Reactivity scope (frozen).** `ui-icon` reacts to `name` and `label` ONLY. **Live pack-swap
reactivity is DEFERRED** — an already-rendered `<ui-icon>` does NOT auto-update when
`setActivePack`/`overrideIcon` is called *after* it rendered, because the frozen `IconRegistry` (LLD-C2)
exposes no subscribable signal and apps register their pack ONCE at startup before first render (the
normal case; ADR-0065 clause 4). Re-setting `name` (or an app restart) reflects a swap. **Future
extension trigger** = the first app that swaps packs live; the amendment then adds a zero-dep
`subscribe(cb): () => void` listener to `IconRegistry` that `ui-icon` (in the signals-bearing components
layer) bridges into an effect — deliberately NOT a signal *inside* the zero-dep `@agent-ui/icons`
package (that would import the components kernel and invert the `components → icons` arrow — the
invariant §6 gates).

## 3 · Content-into-cell contract (the geometry reconciliation — NO law change)

The existing cells are UNTOUCHED (`button.css:118-140`, `select.css:165-178`). An `<svg width=100%
height=100% fill=currentColor>` dropped into:

- an **`[data-role='icon']`** cell (icon-sized, `padding:0`) → fills the icon size. ✅
- a **`[data-role='caret']`** cell (icon-sized cell, `padding:(icon−glyph)/2`) → the existing padding
  insets the SVG's content box to the font-rhythm box, so the SVG caret renders at font size within that
  padding-inset content box. The §4.1 caret law holds **with no CSS edit**. ✅ (Centering is whatever the
  cell already does: `select.css:173-175`'s caret cell flex-centers the svg; `button.css`'s adornment
  cell is a fixed-size grid cell on the inline-grid host — the svg fills its content box either way. §3
  does NOT depend on the cell being flex.)

This is the load-bearing reason migrations are content-only (`textContent = …` → `setIcon(…)`), and why
a geometry regression in a migrated control would indicate a content bug, not a re-cut cell.

## 4 · Packaging (LLD-C6)

- **NEW workspace `packages/agent-ui/icons/`** (`workspaces` glob `packages/agent-ui/*` already matches).
  - `package.json`: `"name": "@agent-ui/icons"`, `private`, `type: module`, exports
    `"." → ./src/index.ts`, `"./phosphor" → ./src/phosphor/index.ts`; `devDependencies:
    { "@phosphor-icons/core": "<pin>" }` (build-time only — the vendor script's source).
  - `src/index.ts` barrel: re-exports `types` + `registry` + `resolve` (`ICON_NAMES`, `IconName`,
    `IconPack`, `IconRegistry`, `Registry`, `iconRegistry`, `resolveIcon`, `setIcon`). Does NOT re-export
    `phosphor` (subpath-only — zero Phosphor bytes on the root barrel; ADR-0055/0062 rule).
  - tsconfig: the root `tsconfig.json` `include: ["packages/agent-ui/*/src"]` already globs the new
    `packages/agent-ui/icons/src`, so `tsc` compiles it automatically — BUT the root `paths` map has no
    `@agent-ui/icons` entry; add `"@agent-ui/icons": ["./packages/agent-ui/icons/src/index.ts"]` +
    `"@agent-ui/icons/*": ["./packages/agent-ui/icons/src/*"]` (mirroring the shared/components/a2ui
    rows) so the `@agent-ui/icons` + `@agent-ui/icons/phosphor` specifiers resolve. This is a shared-file
    edit → the PREP slice owns it.
- **Trip-wire** `components/src/layering.test.ts:57` — extend the allowed-non-relative branch from
  `@agent-ui/shared` only to also admit `@agent-ui/icons` (a second declared lower-tier sibling).
- **Size** — `ui-icon` joins the `components` family barrel; report `npm run size` (ADR-0040 manual
  discipline; the family budget may re-base for the marginal control).

## 5 · The vendor script (`packages/agent-ui/icons/scripts/vendor-phosphor.mjs`)

A Node ESM script (not shipped): (1) a `NAME_MAP: Record<IconName, string>` canonical→Phosphor basename
(identity for all nine — Phosphor's names match); (2) reads each `regular`-weight SVG from
`@phosphor-icons/core` (resolve its assets dir); (3) strips fixed `width`/`height`/`fill`/`stroke`
attributes and the outer `<svg>`, keeping the inner body; (4) asserts viewBox `0 0 256 256`; (5) emits
`src/phosphor/icons.gen.ts` deterministically (stable key order over `ICON_NAMES`, one entry per line).
Re-running with an unchanged map + pinned version is byte-stable. The generated file is committed.

## 6 · Testing & gates

- `@agent-ui/icons` unit (vitest jsdom): `ICON_NAMES` completeness (all nine resolve to distinct
  non-empty bodies); `resolveIcon` returns an SVG-namespace element with `fill=currentColor` + a child;
  unknown name → `data-icon-missing`, no throw; `registerPack`/`setActivePack`/`overrideIcon` semantics
  (override reflected + override precedence over the pack body, last-wins warn, unknown-active throws);
  Phosphor subpath self-registers on import; root barrel imports zero Phosphor (grep/shape).
- **The two cross-package grep invariants (raw-text scan of `packages/agent-ui/icons/src/**`, the
  `layering.test.ts` idiom — no execution):** (1) NO module imports `@phosphor-icons/*` (the zero-runtime
  -dep pillar, ADR-0066); (2) **NO module imports `@agent-ui/components`** — the `icons ↛ components`
  invariant that ADR-0065's entire rejected-alternatives case rests on (a signal-backed registry or a
  `ui-icon` in the icons package would trip it). This gate is what keeps the `components → icons` arrow
  one-directional; without it the invariant is asserted but ungated. Both live in the icons unit suite.
- `ui-icon` browser (vitest-browser, Chromium + WebKit): renders the SVG; `name` change re-resolves;
  the **cell probe** — inject `resolveIcon('caret-down')` into a real `[data-role='caret']` cell and a
  real `[data-role='icon']` cell and assert the rendered box (icon-size vs font-rhythm) with NO CSS edit
  (proves §3).
- Gates: `npm run check` (folds `check:site`) green · `npm test` green · `npm run size` reported.
- **Negative controls for the new gates** (fan-out discipline): the trip-wire must FAIL if a
  `components` file imports a non-allowlisted package; the no-runtime-Phosphor grep must FAIL if an
  `icons/src/**` module imports `@phosphor-icons/*`; the icons↛components grep must FAIL if an
  `icons/src/**` module imports `@agent-ui/components`.

## Component IDs (trace)

`LLD-C1` names/pack type · `LLD-C2` registry · `LLD-C3` resolve+setIcon · `LLD-C4` Phosphor pack ·
`LLD-C5` ui-icon · `LLD-C6` packaging/trip-wire/size. C1–C3,C5 ← ADR-0065; C4,C6 (devDep/subpath) ←
ADR-0066. (`LLD-C#` IDs are per-doc-scoped — the house convention, indicator-element.lld.md:13.)
