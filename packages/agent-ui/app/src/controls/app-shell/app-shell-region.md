---
# app-shell-region.md frontmatter — the attributes-as-API descriptor for ui-app-shell-region (ADR-0004).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror app-shell.ts `regionProps` — the contract↔props trip-wire
# (app-shell.test.ts) targets this fence. Field set per .claude/docs/plan.md §10 / ADR-0004. See app-shell.md
# for the grid CONTAINER's own descriptor (LLD-C6 — one file per element, both behaviour-sourced from the
# ONE shared app-shell.ts/app-shell.css pair, LLD-C3).
tag: ui-app-shell-region
tier: container          # geometry size-class (Container band — a passive landmark region, no control height, no flex/grid distribution of its own children; geometry.md)
extends: UIElement       # a plain structural base — NOT UIContainerElement: no surfaceProps/flexProps folded in (LLD §4)
# marginal: not yet measured — folds into the same @agent-ui/app line-item as ui-app-shell (LLD-C8, a later serial integration slice)

attributes:              # attributes-as-API — mirrors app-shell.ts `regionProps`
  - name: region
    type: enum
    values: [main, banner, navigation, complementary, contentinfo]   # ORDER-SIGNIFICANT: `main` LEADS — props.ts' enumType.from fallback snaps a non-member to values[0], NOT the declared default (the SURFACE_STEPS/container.ts precedent); SPEC-R4 AC2 requires an unknown region to resolve to `main`
    default: main
    reflect: true         # reflects so app-shell.css's [region=…] grid-area/divider selectors apply to JS-set values too
  - name: landmark
    type: enum
    values: ['', banner, navigation, main, complementary, contentinfo, region, form, search]   # ORDER-SIGNIFICANT: '' LEADS (= the declared default) — an out-of-set value snaps back to '', which falls through to region's own default (ADR-0083)
    default: ''
    reflect: true         # reflects so the override is inspectable/testable as a plain attribute (drives NO css of its own — role only)
  - name: collapse
    type: enum
    values: [hide, stack, toggle]   # ORDER-SIGNIFICANT: `hide` LEADS (= the declared default = today's back-compat display:none). `toggle` is now a REAL member (ADR-0084/SPEC-R8, LLD-C11, M4 Phase 2) — a user-collapsible region behind a control-rendered affordance
    default: hide
    reflect: true         # reflects so app-shell.css's/app-shell-isolation.css's [collapse="stack"/"toggle"] narrow-reflow selectors apply to JS-set values too

properties:               # `region`/`landmark`/`collapse` beyond the bare attributes-as-API rows
  - name: region
    description: The landmark this element occupies (banner · navigation · main · complementary · contentinfo; default main). REACTIVE — a runtime reassignment re-derives BOTH the ARIA landmark role (an effect over `this.region`, ElementInternals) and, when docked inside a `ui-app-shell`, the grid-area placement (a plain CSS attribute-selector repoint, live for free). An out-of-set value coerces to `main` (order-significant codec fallback, see attributes.region above) rather than throwing.
  - name: landmark
    description: (ADR-0083) An OPTIONAL override of the ARIA landmark role, independent of `region`'s grid-column duty — lets an author pick the column via `region` and the landmark separately (e.g. `region="navigation" landmark="complementary"`, a chat composer in the left column with a correct, non-navigation landmark). Absent/`''` (the default) ⇒ the role falls through to `region`'s own default (back-compat, no migration). Resolution is `internals.role = landmark || REGION_ROLE[region]` — the `||`, not `??`, is load-bearing (the unset value is the falsy `''`). An out-of-set value coerces to `''` (the same order-significant codec fallback `region` uses) and likewise falls through. Author responsibility: exactly one `main` landmark per document; a second `landmark="main"` is a duplicate-landmark author error the generic element cannot prevent cross-instance (documented, not enforced).
  - name: collapse
    description: (ADR-0084/SPEC-R8) Per-region narrow-reflow behaviour, reflected so app-shell.css's/app-shell-isolation.css's `@container` branch can read it as a plain CSS attribute selector. `hide` (default) is today's `display:none` below the 40rem threshold; `stack` keeps the region visible + spans the full single-column width (DOM order) instead of hiding — BOTH pure-CSS, no `.ts` behaviour. `toggle` (LLD-C11, M4 Phase 2) is the exception: this element LAZILY creates a control-rendered `<button data-part="collapse-toggle">` + a `<div data-part="content">` wrapping its original children the first time `collapse` is ever `'toggle'` (created once, persists — the disclosure.ts precedent) — narrow, the region stays visible/full-width like `stack` UNLESS the user clicks the affordance to collapse it (a `collapsed` custom state + an emitted `toggle` event), in which case only the affordance itself remains reachable. Wide, `toggle` has NO effect at all (the affordance is invisible, the content wrapper is `display:contents`) — byte-identical to a region that never uses it.

events:
  - name: toggle
    detail: 'boolean'
    description: Fired when the user activates the `collapse="toggle"` affordance (never for `hide`/`stack`, which carry no behaviour). Detail is the NEW collapsed state (`true` = now collapsed). Only ever fires on a `collapse="toggle"` region — a region using `hide`/`stack` creates no affordance and so never fires this.

slots: []                 # plain default/unnamed light-DOM children (a ChildList, no anatomy grid) — no NAMED slots; a `collapse="toggle"` region ADOPTS these into its own `content` part rather than slotting them

parts:                    # NOT shadow-DOM ::part() (light-DOM only) — control-rendered ONLY when `collapse="toggle"` (LLD-C11); documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the split.md precedent)
  - name: collapse-toggle
    description: A `<button data-part="collapse-toggle" type="button">`, created lazily the first time `collapse` is `'toggle'`. Invisible outside the narrow `@container` branch (the wide-layout-unchanged invariant, SPEC-R8 AC2). Native `<button>` — keyboard-operable (Enter/Space) with no bespoke handling.
  - name: content
    description: A `<div data-part="content">` wrapping the region's original light-DOM children, created alongside `collapse-toggle`. `display:contents` when expanded (visually identical to unwrapped children); `display:none` when the region is collapsed AND narrow.

customStates:            # a scalar sequence (the split.md `dragging` precedent) — NOT a name/description map
  - collapsed             # (SPEC-R8) set via `internals.states` when the user has collapsed a `collapse="toggle"` region (cleared on disconnect); only ever used on a `collapse="toggle"` region — `hide`/`stack` never touch it

face:
  formAssociated: false    # NOT a FACE form control — a container contributes nothing to a form

aria:
  role: banner | navigation | main | complementary | contentinfo | region | form | search   # DEFAULT is the reflected `region` value, 1:1 (SPEC-R3 AC2); `landmark` (ADR-0083), when set, OVERRIDES it independently of `region`
  roleSource: internals     # set THROUGH ElementInternals in a reactive effect at connect (tracks BOTH `region` and `landmark`) — NEVER a host role attribute (the family discipline)
  labelSource: aria-label / aria-labelledby (author-supplied, optional)   # no built-in accessible name

keyboard: []               # no keyboard interaction — a landmark region is not itself focusable; interactive content is the agent's own controls placed inside it

geometry:
  sizeClass: container      # Container — NO control height (never reads --ui-height-*); no own padding/gap opinion at M1
  blockSize: auto            # content-driven
  paddingBlock: 0            # this element declares no padding of its own; any inset is the author's/composed content's job
  display: block                     # this element's OWN base rule (an unstyled custom element defaults to inline otherwise) — the SPEC-R3 degrade-gracefully block, unconditional, in app-shell.css
  gridPlacement: owned by the PARENT ui-app-shell (app-shell.css's `[region=…]` attribute selectors), not by this element — a region used standalone has no grid to place into and simply renders as a plain block (SPEC-R3's degrade-gracefully edge)
  narrowCollapse: owned by the PARENT ui-app-shell's `@container` narrow branch, reading this element's reflected `collapse` attribute directly (ADR-0084/SPEC-R8) — `hide` (default) display:nones below 40rem; `stack` stays visible + spans the full column instead — BOTH pure CSS attribute-selector consumption, no .ts behaviour. `toggle` is the one exception: THIS element lazily creates its own `collapse-toggle`/`content` parts (see `properties.collapse` above) — the narrow branch only decides where those parts are VISIBLE, not whether they exist.

forcedColors: The region-facing DIVIDER borders (and their CanvasText high-contrast override) are owned by the PARENT `ui-app-shell`'s own stylesheet (app-shell.css, `@scope (ui-app-shell) > ui-app-shell-region[region=…]`) — this element carries no CSS of its own, so it declares no forced-colors rule independently. A standalone (shell-less) region has no divider to begin with.
---

# ui-app-shell-region

`ui-app-shell-region` is the **generic landmark region** element the M1 app-shell composes (Kim ratified the
generic-element model over five named `ui-app-shell-{region}` sub-elements — `app-shell.md` §"Region model").
It is a structural, **non-form-associated** `UIElement` carrying three reflected props: **`region`**
(`banner` · `navigation` · `main` · `complementary` · `contentinfo`, default `main`), **`landmark`** (an
optional ARIA-role override, ADR-0083), and **`collapse`** (per-region narrow-reflow behaviour, ADR-0084).

```html
<ui-app-shell-region region="navigation">
  <nav>…</nav>
</ui-app-shell-region>
```

## Landmark role — reactive, via internals

The element sets its ARIA landmark role **through `ElementInternals`** (never a host `role` attribute) — by
default the `region` value **is** the landmark role name, 1:1. This is wired as a **reactive effect**, not a
one-shot connect-time assignment: if an agent or the page author reassigns `.region` (or `.landmark`, below)
after connect, the landmark role re-derives live (the same reactive-prop-drives-ARIA shape `ui-tabs` uses for
its selection state, as opposed to the constant-role pattern `ui-list`/`ui-tab` use for a role that never
changes per instance).

An **out-of-set** `region` value (an unrecognized string written to the attribute) coerces to `main` rather
than throwing — the props-as-signals codec's fallback snaps to the *first* member of the declared value set,
so `main` deliberately **leads** the array in `app-shell.ts` (and this descriptor's `values:` list) for that
fallback to land where SPEC-R4 AC2 requires.

## `landmark` — decoupling the column from the ARIA role (ADR-0083)

`region` drives **two** things at once by default: the grid **column** (`region="navigation"` → the left
column) and the **landmark** (`role="navigation"`). That fusion breaks down when the right column for a
surface is the wrong landmark for it — e.g. a chat composer belongs in the left column but reads correctly to
assistive tech as `complementary`, not `navigation`. The optional **`landmark`** prop overrides the role
**independently** of the column:

```html
<ui-app-shell-region region="navigation" landmark="complementary">
  <!-- left column, `role="complementary"` — NOT "navigation" -->
</ui-app-shell-region>
```

Resolution is `internals.role = landmark || REGION_ROLE[region]` — absent/`''` (the default) falls through to
`region`'s own default landmark, so every existing `region`-only usage is **unchanged** (no migration). An
out-of-set `landmark` value coerces to `''` (the same order-significant codec fallback `region` uses) and
likewise falls through — it never throws and never sets a garbage role. **Author responsibility:** exactly one
`main` landmark per document remains the author's job, as it already is for `region` — a second
`landmark="main"` is a duplicate-landmark error the generic element cannot prevent cross-instance.

## `collapse` — per-region narrow-reflow behaviour (ADR-0084/SPEC-R8)

Below the shell's `40rem` narrow threshold (SPEC-R5), a side region's default fate is to **hide**
(`display:none`) — right for a secondary rail, wrong for a region carrying essential, interactive content
(the same chat composer would otherwise vanish, making the app's primary input unreachable narrow).
**`collapse="stack"`** opts a region OUT of hiding: it stays visible and **stacks** full-width into the
single-column narrow layout instead, in DOM order (the author controls stack order via composition order).
Both `hide` and `stack` are purely **CSS attribute selectors** the PARENT `ui-app-shell`'s stylesheet reads —
this element's own `.ts` has no behaviour for either. The wide (non-narrow) layout is **unchanged** regardless
of `collapse` — it only ever affects the `@container` narrow branch.

**`collapse="toggle"`** (M4 Phase 2) is the exception: a **user-collapsible** region behind a control-rendered
affordance. The first time `collapse` is `'toggle'`, this element lazily wraps its original children in a
`<div data-part="content">` and inserts a `<button data-part="collapse-toggle">` ahead of it (created once,
persisting even if `collapse` later changes away from `toggle`). Narrow, the region starts **expanded** —
visible and full-width, exactly like `stack` — until the user clicks the button, which sets a `collapsed`
custom state (`:state(collapsed)`), hides the `content` part, and fires an allow-listed `toggle` event
(detail: the new collapsed boolean). The affordance itself is invisible wide and the content wrapper is
`display:contents` when expanded — an EXPANDED `collapse="toggle"` region wide is byte-identical to a region
that never uses `toggle` at all (the wide-layout-unchanged invariant, SPEC-R8 AC2). An out-of-set `collapse`
value still coerces to `hide` via the ordinary out-of-set fallback (unchanged).

## Docking — composition, not an attribute-on-arbitrary-child

A `ui-app-shell-region` is how a developer **docks** a surface into the shell (SPEC-R4): compose the element
as a child of `ui-app-shell` and set its `region` prop. The parent's own stylesheet (`app-shell.css`) reads
the reflected `[region=…]` attribute to place the region in its grid — this element carries **no** grid or
placement CSS of its own.

## Used outside a shell

A `ui-app-shell-region` with no `ui-app-shell` ancestor still sets its landmark role (accessibility does not
depend on the parent) and renders as a **plain block** — there is no grid to place into, so it simply flows
in the surrounding document. This is a deliberate degrade-gracefully edge (LLD §4), not a broken state.

## Accessibility

`role` rides `ElementInternals`, reactively, as described above. Give the region an accessible name with
`aria-label`/`aria-labelledby` when the landmark type alone is not descriptive enough (e.g. more than one
`navigation` region on the same page). The element is not itself focusable or interactive — interactive
content is whatever the author/agent composes inside it.
