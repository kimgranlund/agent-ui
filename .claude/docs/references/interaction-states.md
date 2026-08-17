# Interaction states — the four-state control standard

> Canonical normative standard for agent-ui interactive-control states: **hover · active · focus · disabled**.
> Distilled 2026-06-27 from the ratified decisions [ADR-0008](../adr/0008-interaction-state-styling-standard.md)
> (per-variant hover/active styling), [ADR-0009](../adr/0009-focus-ring-token-standard.md) (the shared
> focus-ring token) and [ADR-0010](../adr/0010-tabbable-trait-aria-disabled.md) (the `tabbable` trait +
> `ariaDisabled`). Those ADRs hold the *why* and the alternatives; this doc is the resolved *how-to-apply* the
> NEXT control copies. It reuses the role ladders of [`tokens.md`](./tokens.md) and must not perturb the box
> law of [`geometry.md`](./geometry.md). First consumer: `ui-button` (G5).
> **Amended 2026-07-15 (TKT-0062):** entry controls carry their OWN five-state law — §1b, with a **filled**
> state and a three-channel (bg/border/ink) repoint — superseding the ADR-0014 border-only channel; and the
> disabled contract gained the TKT-0057 accept-the-blur ruling (§3 note).
> **Amended 2026-08-16 ([ADR-0191](../adr/0191-fleet-stale-pending-state-convention.md)):** a fourth,
> ORTHOGONAL state axis — §5, async freshness — a `:state(pending)` host custom state + the
> `--ui-pending-duration`/`--ui-pending-opacity` token pair, dimming stale content while a fresh answer is
> in flight. First consumer: `ui-status-stream` (GH #999).
> **Amended 2026-08-17 ([ADR-0196](../adr/0196-answered-state-law-questionnaire-settle-edit-amend.md)):** a
> FIFTH, orthogonal axis — §6, answer settlement — a `:state(answered)` host custom state + the
> `--ui-answered-bg`/`--ui-answered-ink` alias pair on the choice-control family, precedence
> `disabled > pending > answered > focus > hover > filled > default`; consumed by the A2UI questionnaire
> card's settle/edit-amend flow.

## The four states (the one frame)

Beyond **idle**, an interactive control answers four states, carried by two layers — never crossed:

| state | trigger | carrier | what changes |
|---|---|---|---|
| **hover** | `:hover` | CSS (pure) | `background` → a role-ladder step |
| **active** | `:active` (pressed) | CSS (pure) | `background` → a deeper ladder step |
| **focus** | `:focus-visible` (keyboard) | CSS (pure) | an `outline` ring — layout-neutral |
| **disabled** | the `disabled` prop | control class + `tabbable` trait | inert: not focusable · not activatable · announced |

The three **visual** states (hover/active/focus) are platform pseudo-classes — **zero JS**, no `observedAttributes`,
no `[state]` attribute the control toggles. The **disabled** state is the only one with a behaviour/AX contract,
split between a reusable trait (focusability) and a control-level effect (the AX announcement), because the visual
hold falls out of the other three for free. No JS owns a visual state; no CSS owns the a11y contract.

## 1 · Hover / active — per-variant background steps from role ladders

A control reacts on `:hover` and `:active` by repointing **`background`** to a **different role step** — never a
`color-mix`. A mix ratio is a component-authored colour *opinion*, and the discipline is that components hold zero
colour opinions; all colour lives in the token layer (`tokens.md`). So a state shade is a *ladder step*, declared
as its own per-state token and consumed on the pseudo-class.

**[a] declare the state tokens** — in the control's `:where(ui-{cmp})` token block (specificity `(0,0,0)`), each
variant repoints `--ui-{cmp}-bg` (idle) and adds `--ui-{cmp}-bg-hover` / `--ui-{cmp}-bg-active` from a ladder step:

```css
:where(ui-{cmp}) {
  --ui-{cmp}-bg:        var(--md-sys-color-{f});        /* idle  */
  --ui-{cmp}-bg-hover:  var(--md-sys-color-{f}-dim);    /* hover */
  --ui-{cmp}-bg-active: var(--md-sys-color-{f}-high);   /* active */
}
```

**[b] consume them** — in the `@scope (ui-{cmp})` styles block, on the matching pseudo-classes, reading **only**
the component's own `--ui-{cmp}-*` chain (never a role or primitive directly):

```css
:scope:hover  { background: var(--ui-{cmp}-bg-hover); }
:scope:active { background: var(--ui-{cmp}-bg-active); }
```

### Mapping a variant to a ladder

A variant picks a **channel**; the channel fixes the three steps. Reuse `tokens.md`'s two ladders — no new roles:

| channel (variant kind) | idle | hover | active | ink |
|---|---|---|---|---|
| **filled** (a solid accent fill) | `--md-sys-color-{f}` | `--md-sys-color-{f}-dim` | `--md-sys-color-{f}-high` | `--md-sys-color-{f}-on-{f}` |
| **tonal** (a soft container tint) | `--md-sys-color-{f}-container-low` | `--md-sys-color-{f}-container` | `--md-sys-color-{f}-container-high` | `--md-sys-color-{f}-on-surface` |
| **text** (transparent at idle) | `transparent` | `--md-sys-color-{f}-container-low` | `--md-sys-color-{f}-container` | `--md-sys-color-{f}` |

The **text** channel has no idle fill to step, so its hover/active wash borrows the bottom two rungs of the
container ladder — a low tint appearing on interaction, vanishing at rest. Worked example, `ui-button`'s three
variants on the `primary` family:

| `ui-button` variant | `--ui-button-bg` | `-bg-hover` | `-bg-active` |
|---|---|---|---|
| **solid** (filled) | `--md-sys-color-primary` | `--md-sys-color-primary-hover` | `--md-sys-color-primary-active` |
| **soft** (tonal) | `--md-sys-color-primary-container-low` | `--md-sys-color-primary-container` | `--md-sys-color-primary-container-high` |
| **ghost** (text) | `transparent` | `--md-sys-color-primary-container-low` | `--md-sys-color-primary-container` |

> **When a generic ladder step collapses — dedicated `--md-sys-color-{f}-hover/-active` roles (ADR-0008 amendment).** The
> filled channel's default rungs (`--md-sys-color-{f}-dim`/`-high`) can resolve to the SAME step in one `light-dark()`
> branch: `--md-sys-color-primary-dim` and `--md-sys-color-primary-high` both land on `--md-sys-color-primary-650` in light, collapsing solid
> `hover`==`active` there (distinct in dark — the wave-2 cross-engine smoke caught it). The remedy is token-layer,
> NEVER a component `color-mix`: dedicated `--md-sys-color-{f}-hover/-active` roles with a real three-step monotonic-
> darkening ladder in BOTH schemes — `--md-sys-color-primary-hover` = `light-dark(700, 600)`, `--md-sys-color-primary-active` =
> `light-dark(750, 700)` (light 550→700→750, dark 450→600→700). The solid row above uses them; the next
> solid-filled control of any family gets its own `-hover/-active` roles the same way.

### Disabled holds at idle (no lift)

A disabled host must show **no** hover/active lift. The hold is **structural**, not a special case:

- `:scope:is([disabled])` already sets `pointer-events: none` (the inert rule, §3) — so `:hover`/`:active` can
  never match a disabled host, and neither state token is ever read.
- Keyboard focus cannot land on a disabled host (the `tabbable` trait removes it from the tab order, §3) — so no
  focus lift either.

The disabled token row repoints `--ui-{cmp}-bg` (and, for symmetry, `-bg-hover` / `-bg-active`) to the muted
neutral; the structural hold means the symmetry repoint is belt-and-suspenders, not load-bearing.

### Single-family now; the consumption seam is stable

This pass is **single-family (primary) and per-variant**. When a `family` attribute lands (`tokens.md`'s open
fleet decision — out of scope here), the per-variant×state rows refactor into `tokens.md`'s family→intermediates
form (`--_fill-*` / `--_tonal-*`); the `--ui-{cmp}-bg[-hover|-active]` **consumption seam is unchanged** by that
refactor, so the styles block never moves.

### The escalation (do not synthesize a shade)

If a ladder step reads too close to the one below it (idle ≈ hover, or hover ≈ active) in the real palette, the
fix is **token-layer dedicated state roles** (`--md-sys-color-{f}-hover` / `-active`) plus an amendment to ADR-0008 — **not**
a component `color-mix`. The control's consumption seam (`--ui-{cmp}-bg-hover/-active`) does not change; only the
ladder step it points at does. This is a design change: stop and escalate, don't invent the shade in the control.

## 1b · Entry controls — the filled/container five-state law (TKT-0062)

Entry controls (`ui-text-field` · `ui-textarea` · `ui-select` · `ui-combo-box` · `ui-conversation-composer` ·
`ui-command-modal`'s search, degenerately — see below) do
**not** use the action-control channel table above. Kim's ruling (TKT-0062, 2026-07-15 — specified directly as an
exact role table, ticket-ratified, superseding ADR-0014 cl.2c's border-only channel): **background, border AND
text-ink repoint together**, across five states — with a **filled** state (the control carries a value) sitting
between default and the interaction states:

| state | bg | border | ink |
|---|---|---|---|
| **default** (empty, idle) | `--md-sys-color-neutral-container-low` | `transparent` | `--md-sys-color-neutral` |
| **filled** (has a value, idle) | `--md-sys-color-neutral-container` | `transparent` | `--md-sys-color-neutral-on-surface-variant` |
| **hover** | `--md-sys-color-neutral-container` | `--md-sys-color-neutral-outline-variant` | `--md-sys-color-neutral-on-surface-variant` |
| **focus** | `--md-sys-color-neutral-container-low` | `transparent` (the §2 ring is the indicator) | `--md-sys-color-neutral-on-surface` |
| **disabled** | `--md-sys-color-neutral-container-low` | `transparent` | `--md-sys-color-neutral-low` |

The placeholder ink is **not a sixth row** — it aliases the default-state ink
(`--ui-{cmp}-placeholder: var(--ui-{cmp}-ink)`), so every state's repoint (including disabled) reaches it for
free. `user-invalid` (the danger border, ADR-0051 timing) is **orthogonal**: a border-only overlay on whichever
row above resolved — it never touches bg/ink. "Filled" reads the control's existing emptiness signal
(`[data-empty]` on the editor part; `ui-select` gained its own trigger-level toggle for this in TKT-0062). Entry
controls ring on **all** focus (`:focus-within`/`:focus`, ADR-0014 dev#1 — typing must signal where it lands,
mouse included) — EXCEPT `ui-select`'s trigger, a real `<button>` (action-control kin), which stays keyboard-only
`:focus-visible`: a ratified deviation (TKT-0062 Findings), not an accident.

Two load-bearing mechanics, both from **measured regressions** during TKT-0062's own build/review:

**[a] Precedence by MUTUAL EXCLUSION, never source-order.** "Filled" needs a content-based selector
(`:has(> [data-part='editor']:not([data-empty]))`, or `:not([data-empty])` where the editor IS the frame), and
`:has()`/`:not()` carry **real specificity** in a plain selector — a `:not(:is([disabled]))`-guarded `:hover`
measurably OUTRANKED an unguarded `:focus-within`, so a mouse-click focus (pointer still hovering) kept the hover
border instead of stepping transparent. Every state rule explicitly excludes every state that outranks it: filled
excludes hover + focus + disabled; hover excludes focus + disabled; focus is last and unguarded (a disabled
control is never focusable). Do not reason about specificity arithmetic — exclude.

**[b] Repoint the TOKEN, not the host property, when a child part reads it.** A state rule declaring
`color: var(--ui-{cmp}-ink-filled)` on the HOST never reaches an editor part carrying its own
`color: var(--ui-{cmp}-ink)` — an element's own declaration beats inheritance, so the visible typed text and
placeholder silently keep the default ink. This shipped broken in 3 of 5 components and was caught only by an
independent review's real-browser probe reading the **editor's** computed color (the builders' own tests read the
host — which DID repaint — and passed vacuously). State rules repoint the token itself:

```css
:scope:not(:hover):not(:focus-within):not(:is([disabled], :state(disabled))):has(> [data-part='editor']:not([data-empty])) {
  background: var(--ui-{cmp}-bg-filled);
  --ui-{cmp}-ink: var(--ui-{cmp}-ink-filled); /* cascades to the editor, the placeholder alias, every consumer */
}
```

Reference implementation: `controls/text-field/text-field.css` — the TKT-0062 hand-built template all five
components follow (its `text-field-css.test.ts` pins the table's exact roles + both mechanics structurally; its
`text-field-states.browser.test.ts` proves the real repaint, editor-targeted, in both engines).

> **The degenerate sixth member (TKT-0068 item 4, Kim-ruled 2026-07-15):** `ui-command-modal`'s palette
> search IS a fleet entry surface and belongs to this census, but it is always focused while the modal
> is open, so only the FOCUS row (+ per-option disabled, which never touches the field) is reachable —
> it wears that row permanently: `container-low` bg · `transparent` border · `on-surface` ink, with the
> placeholder riding the standard ink alias. The field/panel bg contrast carries the search/list
> separation the old solid divider drew; the suppressed focus ring (`outline: none`) stays — a ring on
> an always-focused surface is noise, the ratified palette deviation.

## 2 · Focus — the one shared `:focus-visible` ring

The focus indicator is a **fleet constant**, not a per-control opinion: identical on every control, keyboard-only,
forced-colors-safe, layout-neutral. It rides **three shared tokens** in `@agent-ui/shared` (the one allowed
cross-package import is `components → @agent-ui/shared`, so every control reads them with no layering violation):

| token | home | value | role |
|---|---|---|---|
| `--md-sys-color-focus-ring` | `shared/src/tokens/tokens.css` | a **dedicated** accent-leaning role (`→ Highlight` under forced-colors) | the ring colour |
| `--ui-focus-ring-width` | `shared/src/tokens/dimensions.css` | `2px` | the ring width |
| `--ui-focus-ring-offset` | `shared/src/tokens/dimensions.css` | `2px` | the gap to the box edge |

`--md-sys-color-focus-ring` is a **dedicated role, not `--md-sys-color-primary` reused** — so a `ghost`/secondary/neutral control gets
the *same* ring, not one tinted by the primary family. The width/offset are **constants** (no `var()` over a
subtree-repointable multiplier), so they live on `:root`, not on `*` — ADR-0007's universal-selector rule covers
only *derived* tokens.

**The recipe** — every control's `@scope` block applies the identical rule, reading only the shared tokens:

```css
:scope:focus-visible {
  outline: var(--ui-focus-ring-width) solid var(--md-sys-color-focus-ring);
  outline-offset: var(--ui-focus-ring-offset);
}
```

Three deliberate choices behind it:

- **`outline`, not `box-shadow`** — `outline` is painted *outside* the box without affecting layout, so the
  geometry law (`geometry.md`) and its smoke assertions stay intact; the UA preserves `outline` under
  `forced-colors`; and `--md-sys-color-focus-ring`'s `→ Highlight` mapping makes the WHCM ring **free**. (`box-shadow` is
  suppressed under forced-colors — kept on the shelf only as a fallback behind a later ADR.)
- **`:focus-visible`, not `:focus`** — the keyboard-only contract: no ring on a mouse click.
- The ring shows **only when keyboard-focused** — the `tabbable` trait (§3) supplies the `tabindex=0` a light-DOM
  custom element needs to be focusable, and removes it when disabled, so a disabled control never draws the ring.

**Cross-engine caveat:** `outline` rounding-follows-`border-radius` is engine-versioned — modern WebKit (≈16.4+)
rounds the outline to a pill, older WebKit squares it. The requirement is a *visible, keyboard-only,
forced-colors-safe* ring; perfect rounding on the pill is nice-to-have. A squared ring on an older WebKit is
acceptable (the wave-2 cross-engine smoke checks both engines).

## 3 · Disabled — the inert a11y contract (`tabbable` trait + `ariaDisabled`)

A disabled interactive control must be **three-fold inert**: **not focusable**, **not activatable**, and
**announced disabled** to assistive tech. The contract is split by *what can reach `internals`* — because
`UIElement.internals` is `protected`, a trait (which only receives `host: UIElement`) cannot set ARIA, so the AX
half must live in the control class.

**[a] `tabbable` — a reusable trait** (`components/src/traits/tabbable.ts`), a sibling of `press-activation`,
invoked from `connected()`:

```ts
export function tabbable(host: UIElement, opts: { disabled: () => boolean }): () => void
```

- **`tabindex=0` by default** (role=button focus parity — a light-DOM custom element inherits none), set through a
  **scope-owned `host.effect`** so it reacts to the `disabled` signal, is disposed with the connection scope, and
  **re-applies on reconnect** (`connected()` re-runs → the effect re-installs). Leak-free by construction.
- **Disabled → `removeAttribute('tabindex')`** — out of the tab order, matching native `<button disabled>`.
- **`release()` is idempotent** (a `released` guard), mirroring `press-activation`. Imports only `../dom` (the one
  allowed `traits → dom` direction).
- It uses an **effect** where `press-activation` uses **listeners** — deliberate: `tabbable` must *actively* change
  a DOM attribute when `disabled` toggles (reactive); `press-activation` only *guards at event time* (no
  reactivity). Both are scope/abort-owned and leak-free.

**[b] `ariaDisabled` — a control-level effect** in the control's `connected()`, alongside `role` (it **cannot** be
a trait — `internals` is protected):

```ts
this.internals.role = '{role}'
tabbable(this,       { disabled: () => this.disabled })
pressActivation(this, { disabled: () => this.disabled })
this.effect(() => { this.internals.ariaDisabled = this.disabled ? 'true' : null })
```

The effect reads the `disabled` prop signal, so the AX state stays in sync; it is scope-owned (disposed on
disconnect, re-run on reconnect → zero residue). `ariaDisabled` (not a native `disabled`) is correct because the
control extends `UIElement` and is **not** form-associated — it has no platform disabled state, so the AX state
rides `ElementInternals.ariaDisabled`.

> **Form-associated controls differ.** A `UIFormElement`-based control (`ui-text-field`, …) *is*
> form-associated and gains a platform `disabled` state — its AX-disabled may ride that platform state rather than
> `ariaDisabled`. This contract is written for non-form-associated (`UIElement`) interactive controls; confirm the
> disabled channel per family before copying it onto a form control.

> **Disabling a FOCUSED control blurs it — accept the blur (TKT-0057, ratified 2026-07-15).** A native
> `disabled` control cannot hold focus, and disabling an already-focused one blurs it — the long-standing,
> cross-engine-consistent platform convention (native `<input disabled>` parity; jsdom is the documented
> OUTLIER for *not* doing this — jsdom/jsdom#2931). A contenteditable-based FACE control simulating disabled
> (removing `contenteditable`/`tabindex`) gets the same treatment from Chromium, which re-checks the focused
> element's focusability on the mutation and blurs; WebKit currently retains focus — **WebKit is the outlier
> here, not Chromium**. Never build a focus-restoration mechanism to "fix" the Chromium blur: it fights native
> parity and strands AT users on an element that looks focused but accepts no input. Tests assert the
> engine-split reality (the `TKT-0057` blocks in `text-field-states.browser.test.ts` /
> `textarea.browser.test.ts`), never a universal "focus survives disabling" claim — the original universal
> claim only ever passed because the assertion ran before the disable effect's microtask flush.

**The split is the reusable lesson:** focusability recurs on every interactive control → a reusable **trait**;
`ariaDisabled` *cannot* be a trait (protected `internals`) → a one-line **control-level effect** any control with
a `disabled` prop copies. Do not try to push `ariaDisabled` into a trait.

> **PART-level disabled focusability: `removeAttribute('tabindex')`, never `tabindex="-1"` (TKT-0068
> item 2, Kim-ruled 2026-07-15).** `tabbable` owns only the HOST's tab participation; a control that
> hand-rolls a focusable interior part (an editor, a thumb, a canvas pad) repoints that part on
> disabled by REMOVING the attribute — native parity: a disabled native control is not even
> *programmatically* focusable, and TKT-0057's accept-the-blur ruling above already committed the fleet
> to native-parity disabled semantics. The `tabindex="-1"` dialect (out of the tab order but
> `.focus()`-able) is retired — slider-multi's thumbs and color-picker's pad were converted; the
> textarea/text-field/combo-box editors were already the ruled shape.

## 4 · Motion — transition the state paint, snap the geometry, gate past first paint

State changes (hover/active, and a JS-driven variant/colour change) **animate**; the first render and every
geometry change **snap**. Three fleet-wide rules:

**[a] Transition the state-PAINT properties only — never geometry, never `all`.** Enumerate
`background-color` / `color` / `border-color` (add `box-shadow` / `opacity`, or a caret `transform`, if the
control uses them). A `[scale]` / `[size]` / `[density]` change must be **instant** — the geometry ramp
(`geometry.md`) is never in the transition list; animating it fights the sizing law and reads as jank. The
keyboard focus ring stays instant too (omit `outline`): keyboard users want immediate, unambiguous feedback.
Durations/easings are **tokens** (`--ui-motion-fast`, `--ui-ease-standard` in `dimensions.css`) — constants on
`:root` like the focus-ring geometry, not magic numbers.

**[b] Gate the transition behind a post-first-paint `:state(ready)`.** A custom element paints once on upgrade
(UA defaults) before `@scope` styling applies; if `transition` is already declared, that first change animates —
the flash. So declare **no** transition until the control has settled, via an `ElementInternals` **custom state**
(not a host attribute), flipped one frame past first paint:

```ts
// connected(), after the role/trait/effect wiring:
requestAnimationFrame(() => this.internals.states?.add('ready'))
```
```css
:scope:state(ready) {
  transition: background-color var(--ui-motion-fast) var(--ui-ease-standard),
              color            var(--ui-motion-fast) var(--ui-ease-standard),
              border-color     var(--ui-motion-fast) var(--ui-ease-standard);
}
```

`requestAnimationFrame` (not `updateComplete`, a microtask *before* paint) clears the first paint; adding `ready`
afterward grants the *capability* without changing any transitioned value at that instant, so only **subsequent**
state changes animate. It also covers token/CSS-load races (ready flips only after the frame), and is idempotent
(a Set) so reconnect is safe. The fleet motion tokens are read DIRECTLY in `@scope` (like the focus-ring
constants) — a fleet token, not a per-control opinion.

**[c] Honour `prefers-reduced-motion: reduce` — zero the transitions (non-negotiable).**

```css
@media (prefers-reduced-motion: reduce) {
  :scope:state(ready) { transition: none; }
}
```

## 5 · Pending / stale content — the async-freshness state (ADR-0191)

A THIRD state axis, orthogonal to both the four base states (§1) and the entry-control filled/container
law (§1b): whether a control's CURRENTLY-DISPLAYED content is the answer to the question it's asking right
NOW, or a stale last-settled answer while a new one is in flight. TKT-0062's SHAPE re-applied to async
freshness — one fleet-wide convention, not a per-component hack — proposed and ratified as ADR-0191
because, unlike §1b's Kim-specified literal table, this was a genuine fork needing a recommendation
weighed. First consumer: `ui-status-stream` (GH #999).

**[a] One host custom state: `:state(pending)`.** Matches the fleet's existing host-boolean precedent
(`:state(ready)`/`:state(truncated)`/`:state(dragging)`/`:state(revealed)`/`ui-status-stream`'s own
`:state(settled)`) rather than a `data-*` attribute — this fleet reserves `data-*` for PART-level flags
(a scroll viewport, a trigger/editor span), never the host. Because the source of pendingness is the
[`pendingComputed`](../../../packages/agent-ui/components/src/traits/pending-computed.ts) trait — a
CONTROLLER, `(host, opts) => …`, which cannot reach the protected `host.internals` — the CONSUMING CONTROL
applies the state itself: read the controller's `pending` signal inside the control's own `connected()`
effect, then `this.internals.states?.add('pending')` / `.delete('pending')` — the exact
`trackUserInvalid`/`userInvalid()` split §3 already documents, never a mechanism the trait or this ADR
invents.

**[b] One token pair.** `--ui-pending-duration` (aliases `--md-sys-motion-duration-fast` — no new motion
primitive) and `--ui-pending-opacity` (`0.6`, a new literal), both minted in `dimensions.css` as :root
constants (like the focus-ring/motion geometry above) but **not** on tokens.md's sanctioned direct-read
list — a consuming control routes both through its own `--ui-{cmp}-*` chain
(`--ui-status-stream-pending-opacity: var(--ui-pending-opacity);` in the `:where()` token block), same as
every other dimensional constant a control consumes.

**[c] A dim, never a recolor.** Already-rendered stale content keeps its existing bg/border/ink tokens
untouched (§1b's filled/container law is not reopened) — `:state(pending)` layers ONE additional
`opacity: var(--ui-{cmp}-pending-opacity)` step on top, transitioned over
`var(--ui-{cmp}-pending-duration)`. Opacity, not a role-repoint, because pending content can be arbitrary,
unknown-depth DOM a role-repoint cannot reach in general (TKT-0047's disabled-opacity multi-layer-stacking
exception, generalized — never the nonexistent "disabled defaults to opacity" claim; the fleet's disabled
canon is role-repoint). `prefers-reduced-motion` suppresses the transition (an instant opacity step),
following every other fleet motion rule (§4c).

**[d] Precedence and composition.** `disabled` > `pending` > every §1b fill/hover/focus state (where a
control has a `disabled` prop at all — many `pending`-eligible surfaces, like `ui-status-stream`, do not).
`pending` COMPOSES with `:state(settled)` rather than being cleared by it: a settled stream can start a
fresh follow-up query and go pending again without ever leaving `settled` (both custom states true at
once is expected, not a bug) — the exact render when both are true is each consumer's own CSS call, not
fixed fleet-wide.

**[e] No opinion on the wiring mechanics.** A component's own `connected()` decides how it feeds
`pendingComputed` a source and when — an imperative `setPendingSource(promise | asyncIterable | null)`
method (`ui-status-stream`'s own shape, since it has no async source of its own — entries arrive pushed,
not fetched) is one valid wiring, a reactive query-signal read inside `source()` (the trait's own doc
comment) is another. This section fixes the STATE NAME and the TOKEN PAIR, not the composition logic —
mirroring how §1b fixed the five-state table without dictating each component's own emptiness detection.

## 6 · Answered / settled choice — the answer-settlement state (ADR-0196)

A FOURTH state axis, orthogonal to the base states (§1), the entry-control filled law (§1b) and async
freshness (§5): whether a CHOICE control holds a CONFIRMED answer — settled by a consuming surface (the
A2UI questionnaire card's submit) — as opposed to being live for entry. The TKT-0062/ADR-0191 SHAPE
re-applied a third time (fill → §1b, async freshness → §5, answer settlement → here). Scope: the choice
controls a questionnaire answer renders through — `ui-radio-group` (its `ui-radio` children painted via
the group's state; `ui-segmented-control` inherits the wiring) · `ui-checkbox` · `ui-switch` ·
`ui-segmented-control` · `ui-select` · `ui-multi-select` · `ui-combo-box`. Free-text entry controls are
OUT of scope — they settle at the card level.

**[a] One host custom state: `:state(answered)`** — deliberately NOT `settled` (already taken by
`ui-status-stream`, a different axis — one selector token must not mean two things). The CONSUMING
SURFACE sets a public boolean prop (`answered`, in the control's `static props`); the control's own
`connected()` effect mirrors it into `this.internals.states?.add('answered')` / `.delete('answered')` —
the exact `trackUserInvalid`/§5[a] split. Presentation-only, never AX-reflected: an answered control is
NOT disabled and NOT readonly at the platform level (correction stays live — the GH #805
disable-on-submit posture is retired).

**[b] One token pair: `--ui-answered-bg` + `--ui-answered-ink`** — minted in `tokens.css` as PURE
ALIASES (`--ui-answered-bg: var(--md-sys-color-neutral-container-low)`,
`--ui-answered-ink: var(--md-sys-color-neutral-on-surface-variant)`), zero new literals. The answered
treatment is a ROLE-REPOINT (the TKT-0047/§1b canon — the control's parts are its OWN known chrome),
never an opacity dim (§5's opacity exception covers arbitrary unknown-depth stale content only, and a
whole-control dim would dim the selected answer, the one thing that must stay legible). Inside its
`:state(answered)` rule each control repoints its own `--ui-{cmp}-{bg,ink}` chain to the
`--ui-answered-*` pair (the §1b[b] token-repoint mechanic, never a direct `color:`); only the UNSELECTED
options and the frame step back — the selected indicator keeps its existing selected tokens untouched.
Any layered tint obeys the G9 14%-alpha ceiling; the default treatment needs none.

**[c] Precedence, fixed: `disabled > pending > answered > focus > hover > filled > default`** —
`disabled` terminal (fleet canon); `pending` over `answered` (an in-flight amendment reconcile must stay
visible over the settled treatment; the two compose mechanically — opacity vs role-repoint — but where
CSS must pick a message, pending wins); `answered` over focus/hover/filled because hover/focus repaints
are live-entry AFFORDANCE signals and the settle flow moves the "change this" signal to the card's Edit
affordance. `user-invalid` stays orthogonal, exactly as §1b left it. Implementation is §1b[a]'s law:
MUTUAL EXCLUSION via `:not()` guards on every state selector, never source-order/specificity — every
answered rule excludes disabled + pending; every hover/focus/filled rule additionally excludes
`:state(answered)`.

**[d] The consuming template contract (the A2UI questionnaire/multiple-choice card)** — on submit the
card SETTLES, never disappears: options collapse to the selected answer(s) + one compact summary row
(the Edit-anchor law — full removal is banned; Edit needs a durable anchor), and the still-rendered
choice controls carry `answered`. Edit re-opens the options and clears `answered` for the edit's
duration; a confirmed change appends an amendment turn ("Changed: X → Y") reconciled FORWARD (never a
rewrite/rewind); re-confirming the same answer appends nothing. The Edit affordance is a plain fleet
button within the seven-member event vocabulary (ADR-0153) — no eighth event name.

## 7 · Working / live surface mutation — the alive-ambience state (ADR-0199)

A FIFTH state axis, orthogonal to the base states (§1), the filled law (§1b), async freshness (§5) and
answer settlement (§6): whether a SURFACE is the live target of an in-flight producer turn's in-place
mutations (GH #1104 — the A2UI card cycling pre-flop → flop with no other sign of life). The
TKT-0062/ADR-0191/ADR-0196 SHAPE re-applied a fourth time. **The semantics are the INVERSE of §5's
`pending`**: pending = the displayed content is STALE (dim it); working = the displayed content is FRESH
and mid-mutation (make the frame breathe). The two are disjoint channels (content opacity dim vs frame
overlay glow) and compose — a surface can be both at once. First consumer: `ui-surface-host`, driven by
`ui-conversation`'s turn handle.

**[a] One host custom state: `:state(working)`.** The eighth vocabulary member (naming.md §6). Not
`busy` (`aria-busy` is a platform AX semantic this presentation-only state must not claim), not `live`
(ARIA live regions), not `active` (a CSS pseudo-class). The ADR-0196 cl.1 mechanics exactly: the
consuming surface sets a public boolean `working` prop; the control's own `connected()` effect mirrors
it into `this.internals.states?.add('working')` / `.delete('working')` (`?.`-optional-chained, the
`:state(settled)` precedent). Presentation-only, never AX-reflected — the turn's announced face stays
the narration strip (ADR-0146).

**[b] The tokens.** Four constants in `dimensions.css` — `--ui-working-duration: 1600ms` (the fleet's
FIRST loop-motion literal; deliberately NOT an alias of `--md-sys-motion-duration-fast` — a 300ms
half-cycle is a strobe, not a breath), the overlay rungs `--ui-working-opacity-min: 0.15` /
`--ui-working-opacity-max: 0.55`, and the diffused spread `--ui-working-blur: 24px` (a paint constant,
no `[scale]` participation) — plus ONE pure color alias in `tokens.css`, `--ui-working-color:
var(--md-sys-color-primary)` (accent-family by intent; strength lives entirely in the opacity rungs,
which keep the effective tint under the G9 14%-alpha ceiling). None are on the sanctioned direct-read
list — a consuming control routes all five through its own `--ui-{cmp}-working-*` chain.

**[c] The treatment: a breathing diffused INNER shadow on an overlay, opacity-only.** The `:state(working)`
rule paints an `::after` overlay on the surface part (`position: absolute; inset: 0; pointer-events:
none; border-radius: inherit`) carrying `box-shadow: inset 0 0 var(--ui-{cmp}-working-blur)
var(--ui-{cmp}-working-color)`, and animates the OVERLAY's `opacity` between the two rungs via one
`@keyframes` breathe cycle (`alternate infinite`, duration per half-cycle, easing-standard). Animating
overlay opacity — never `box-shadow` itself — keeps the loop compositor-only (the ADR-0095 exemption
shape); §4[a] stays intact (no geometry, no ramp animation, content untouched — no dim, no recolor).
An INNER shadow (not an outline/border pulse) so it reads under `[bare]` chromeless mounts and never
collides with §2's focus-ring outline channel. **`prefers-reduced-motion: reduce` ⇒ STATIC, never
NOTHING**: `animation: none`, overlay held at the max rung — an animation that CARRIES STATE must
degrade to a legible static form (§4[c] extended), unlike pure transition polish which may degrade to
none.

**[d] Precedence, fixed: `disabled > pending > working > answered > focus > hover > filled > default`.**
`pending` over `working` (where one channel must pick a message, "what you see is stale" — a correctness
statement — outranks "activity is happening" — an ambience statement; mechanically they compose free);
`working` over `answered` (an answered card being amended in place is, for that window, live again;
again disjoint channels, message-precedence only). `disabled` stays terminal; `user-invalid` stays
orthogonal. Implementation is §1b[a]'s law: MUTUAL EXCLUSION via `:not()` guards where selectors
overlap, never source-order/specificity.

**[e] The wiring locus (first consumer).** `ui-conversation`'s turn handle owns the exact lifecycle
window (`beginAgentTurn` → the single guarded `endTurn` both `finalize()` and `fail()` funnel through,
TKT-0034): when a turn routes a line to a surface host — fresh OR known id (the in-place update is the
motivating case) — it sets that host's `working` prop; at `endTurn` it clears it on every host the turn
touched. `fail()` clears identically — a dead turn never leaves a card breathing. A host app driving
`ui-surface-host` directly may set the prop itself; the fleet law fixes the state name, tokens, and
treatment — not who flips it (the ADR-0191 cl.4 restraint).

## Mechanization

Each state lands with a probe (per [`process.md`](../process.md)) — a state without a probe is not enforced.
The carrier decides the harness:

- **hover / active / focus** are pure pseudo-class styling: jsdom does not evaluate them, so they are proven in
  the **cross-engine browser smoke** — the computed `background` changes idle→`:hover`→`:active`, and a
  `:focus-visible` `outline` is present (not `none`) and survives `forced-colors`.
- **tabbable / ariaDisabled** are DOM/AX state: proven in **jsdom unit tests** — `tabIndex === 0` while enabled,
  no `tabindex` attribute while disabled (and re-applied on reconnect); `internals.ariaDisabled` toggles
  `'true'`/`null` with the `disabled` prop, with **zero residue** after disconnect.
- **motion** is gated CSS + a one-line JS state flip: the `:state(ready)` transition rule (state-paint only, no
  geometry, no `all`) and the reduced-motion zero are pinned by the **jsdom CSS-text probe**; that the first
  paint does NOT animate and a subsequent hover DOES is the **cross-engine smoke**'s (jsdom has no
  `CustomStateSet`, so the `:state(ready)` behaviour can't be computed there).
- **pending** (§5) is a JS-state controller + gated CSS, the same division as motion: `pendingComputed`'s
  `pending` signal driving `:state(pending)` is proven in **jsdom unit tests** (the controller's own
  `pending-computed.test.ts`, plus the consuming control's own state-toggle probe — jsdom lacks
  `CustomStateSet` in some environments, so a consuming control's probe stays `?.`-optional-chained, the
  `:state(settled)` precedent); the CSS opacity/transition rule is a **jsdom CSS-text pin-test** per
  consuming control (`status-stream.test.ts`'s own gate, the GH #722 header-marker drift-gate precedent) —
  no real-engine assertion is required beyond that, since opacity/transition are computed styles a
  cross-engine smoke would only re-confirm, not a new risk class.

- **working** (§7) is a prop→state mirror + gated CSS: the `working` prop driving `:state(working)` is a
  **jsdom unit test** on the consuming control (`?.`-optional-chained and NON-VACUOUS — jsdom lacks
  `CustomStateSet` in some environments, so a jsdom states assertion must first prove the set exists or
  the behavioural claim moves to the browser leg); the `::after` overlay rule (keyframes present,
  opacity-only animation, reduced-motion static arm, no geometry/`all`) is a **jsdom CSS-text pin-test**;
  that the animation actually RUNS (computed `animation-name` + an opacity delta across rAF samples) and
  that reduced-motion holds the overlay static at the max rung is the **cross-engine browser smoke**'s.

## Decisions (source)

This doc carries no decisions of its own; it applies these ratified ADRs. Consult them for rationale, alternatives
and open questions:

- [**ADR-0008**](../adr/0008-interaction-state-styling-standard.md) — per-variant hover/active background steps
  from role ladders (no `color-mix`); the disabled hold.
- [**ADR-0009**](../adr/0009-focus-ring-token-standard.md) — the shared `--md-sys-color-focus-ring` role + the
  `--ui-focus-ring-width/-offset` constants, consumed via a `:focus-visible` `outline`.
- [**ADR-0010**](../adr/0010-tabbable-trait-aria-disabled.md) — the `tabbable` trait (focusable by default, out of
  the tab order when disabled) + the control-level `ariaDisabled` effect.
- [**TKT-0062**](../tickets/tkt-0062-entry-control-filled-state-law.md) — the entry-control filled/container
  five-state law (§1b): Kim specified the exact role table directly, so it is ticket-ratified with no ADR (a
  decision already made is not a fork needing a recommendation); the ticket's Findings carry the build/review
  trace behind both §1b mechanics.
- [**TKT-0057**](../tickets/tkt-0057-text-field-disable-focus-loss-chromium.md) — the disabled-blur parity
  ruling (§3 note): root cause + the ratified accept-the-blur decision.
- [**ADR-0191**](../adr/0191-fleet-stale-pending-state-convention.md) — the async-freshness state (§5):
  `:state(pending)` + the `--ui-pending-duration`/`--ui-pending-opacity` token pair, composing with
  `ui-status-stream`'s existing `:state(settled)` rather than being cleared by it; the styling companion to
  the `pendingComputed` trait (GH #974).

- [**ADR-0196**](../adr/0196-answered-state-law-questionnaire-settle-edit-amend.md) — the answer-settlement
  state (§6): `:state(answered)` + the `--ui-answered-bg`/`--ui-answered-ink` alias pair, precedence-composed
  under disabled/pending and over the TKT-0062 states; consumed by the A2UI questionnaire card's
  settle/edit-amend (append-amendment) flow.

- [**ADR-0199**](../adr/0199-working-state-live-surface-mutation.md) — the live-surface-mutation
  state (§7): `:state(working)` + the `--ui-working-{duration,opacity-min,opacity-max,blur}` constants
  and the `--ui-working-color` primary alias; the breathing `::after` inner-shadow overlay
  (opacity-only, compositor-only), reduced-motion "static, never nothing", precedence
  `disabled > pending > working > answered > …`; first consumer `ui-surface-host` driven by
  `ui-conversation`'s turn handle.

Colour ladders: [`tokens.md`](./tokens.md). Box law the ring must not perturb: [`geometry.md`](./geometry.md).
