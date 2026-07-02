# ADR-0025 — `ui-text`: the Display-class text primitive + the `--ui-type-*` typographic scale (+ the A2UI `Text` catalog type)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-28 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, turning the task #5 demo-fix design into the control + token contract |
> | **Ratified by** | orchestration-lead (on gate) — Forks 1+2 ratified by team-lead 2026-06-28; **Fork 3 (heading semantics) resolved by the user 2026-06-28 — real headings** (cl.4) |
> | **Repairs** | `goals` (NEW — the *Display*-control DoD) · `references/geometry.md` (the *Display* size-class — the typographic ramp lever) · **NEW** `@agent-ui/shared` `dimensions.css` (`--ui-type-*`) · **NEW** `controls/text/*` · `a2ui-catalog SPEC-R3/R8` + `catalog/default/{catalog.json,factories.ts}` (NEW `Text` — the first *display* catalog type) |
> | **Supersedes / Superseded by** | Relates: **ADR-0006** (host-as-content / void `render()` — the slotted-text mechanism cl.2 reuses) · **ADR-0015** (the new-token-family precedent — `--ui-space`/`--ui-radius-base`; `--ui-type-*` follows its `*`-ramp-vs-`:root`-constant law) · **ADR-0024** (the dynamic-list demo whose leaf content this fixes) |

## Context

The A2UI v1.0 dynamic-list demo (ADR-0024, `site/pages/a2ui-list.ts`) renders pure display content — a
person's name and role, a tag chip, a section title — as `ui-button` labels, because the component fleet has
**no text-display primitive**. `controls/` ships `button` + `text-field` + the G9 container family only;
`catalog/default/factories.ts` has no `Text`. A name is not an action, so a clickable button is the wrong
element: the user flagged it visually (names reading as buttons), and it is also an accessibility lie (a
`role="button"` on inert text).

A2UI v1.0 specifies the fix as a single **`Text`** component (a2ui.org/reference/components/): one unified
type — **no** separate `Label`/`Heading` — with two properties: **`text`** (a string literal **or** a
`{path}` DataBinding) and **`variant`** (`h1`/`h2`/`h3`/`h4`/`h5`/`caption`/`body` — the typographic
hierarchy). Binding it to a live control surfaces three forces with no contract yet:

- **No display leaf exists.** Every shipped control is either a *control-band frame* (button/text-field) or a
  *structural container surface* (the G9 family, `UIContainerElement`). A pure, non-interactive text **leaf**
  — neither a frame nor a surface — is a control class the fleet has not built. `references/geometry.md`
  already names a **Display** size-class (`divider · icon · spinner · … | font-size where text-bearing`) but
  it only contemplates the *control-band* font for text-bearing display.
- **No typographic scale exists.** Confirmed (grep, 2026-06-28): `tokens.css` is colour-only and
  `dimensions.css` ships only the **control-band** font ramp (`--ui-font-sm/md/lg` = 13/14/16, bound to the
  control frame law, `× var(--ui-scale)`). There is **no** `h1…h5`/`caption`/`body` size, **no** font-weight
  token, **no** line-height token anywhere. The seven `variant` levels have nothing to read.
- **No display catalog type exists.** The default catalog (`catalog.json`) declares control, container, and
  input types; `Text` would be its first *display* type. Its `text` property is content, not configuration.

This ADR is the contract for all three. All three design forks are settled (2026-06-28): Forks 1+2 ratified by
the team-lead; Fork 3 (heading semantics) — an accessibility taste call — was routed to the user, who chose
**real headings** (cl.4).

## Decision

We add **`ui-text`**, a Display-class text leaf, the **`--ui-type-*`** fleet typographic scale it consumes
role-purely, and the A2UI **`Text`** default-catalog type bound to it. Five clauses, each a buildable
acceptance.

1. **`ui-text` — the Display-class leaf.** A light-DOM custom element `extends UIElement` (NOT
   `UIFormElement`, NOT `UIContainerElement` — it is neither form-associated nor a surface). It carries one
   public prop: **`variant`**, a reflected literal union `'h1'|'h2'|'h3'|'h4'|'h5'|'caption'|'body'`, default
   `'body'` (typed as a literal union, not `string` — matching `button`'s `size`; a `@ts-expect-error` proves
   a bare string is rejected). It has **no** interaction state, **no** focus/keyboard, and **no** motion gate
   (no `:state(ready)` — there is nothing to transition). `user-select` stays **enabled** (display text is
   selectable — the deliberate inverse of `button`, which disables it). It is the **Display** size-class
   (`geometry.md`): no control height, no `padding-block` law, no frame — the lever is the type scale (cl.3),
   not `--ui-height-*`.

2. **Content model — slotted `textContent`, not a `text` prop (Fork 1, ratified).** The displayed text is the
   element's **light-DOM children**; `render()` stays the inherited **void**, so the children flow through the
   host untouched (the host-as-content mechanism of **ADR-0006**, exactly as `button`'s label and every
   container's children do). The host *is* the styled text node; `text.css`'s `[variant]` selector drives its
   typography. The text is therefore **not** a `static prop` — it is content, like `button`'s label (which
   maps to `textContent`, not a prop). This keeps `ui-text` HTML-idiomatic (`<ui-text variant="h1">Hello
   </ui-text>`), gives a heading its accessible name for free (cl.4), and avoids the clobber a
   text-prop→`textContent` effect would inflict on slotted children. The catalog `text` property
   (`mapsTo: textContent`, cl.5) is the renderer-side consequence.

3. **`--ui-type-*` — the fleet typographic scale (Fork 2, ratified).** A NEW token family in
   `@agent-ui/shared` `dimensions.css`, a peer of `--ui-font-*`/`--ui-space-*`, with one triple per level:
   **`--ui-type-{h1,h2,h3,h4,h5,caption,body}-{size, weight, leading}`**. It follows the existing dimensions
   law (the ADR-0007 `*`-ramp-vs-`:root`-constant split):
   - **`-size`** carries `× var(--ui-scale)` and is declared on the **`*` subtree ramp**, so a subtree
     `[scale]` re-multiplies it (the same pre-substitution reason as `--ui-font-*`); it does **NOT** carry
     `var(--ui-density)` — **type is density-invariant** (glyph size is a frame-family quantity, not rhythm;
     `[density]` touches only gaps).
   - **`-weight`** and **`-leading`** are **constants on `:root`** (like the focus-ring / motion constants):
     weight is a number; leading is a **unitless** line-height multiplier (it scales with the already-scaled
     `-size`).

   The **recommended default ramp** (ratio ≈ 1.2 anchored at `body` = 16px — "one rule sampled", per
   `geometry.md`'s arithmetic-not-taste ethos): `h1` 40/700/1.15 · `h2` 33/700/1.2 · `h3` 28/600/1.25 · `h4`
   23/600/1.3 · `h5` 19/600/1.35 · `body` 16/400/1.5 · `caption` 13/400/1.4 (`size`/`weight`/`leading`).
   `caption` 13 ties to the existing control-`sm` font; `body` 16 to control-`lg`. **The exact size rounding,
   the weight pair (700/600 vs a single 600), and the leading values are tokens-specialist's** (the
   ADR-0015 hand-off boundary — planning fixes the *family, the law, and a sound default*; the table is
   build work). The **component contract is fixed regardless**: `ui-text` reads only `--ui-text-{size,
   weight, leading}` (cl.3a), so a value change never touches the control.

   - **3a · Role-pure consumption (the seam).** `text.css` has the two-block shape every control uses
     (button.css): the **`:where(ui-text)` token block** declares `--ui-text-size: var(--ui-type-body-size)`
     etc. (defaulting to `body`), and each `:where(ui-text[variant='h1'])` … repoints the three component
     tokens to the matching `--ui-type-h1-*`; the **`@scope (ui-text)` styles block** consumes **only**
     `--ui-text-*` (`font-size: var(--ui-text-size)`; `font-weight`; `line-height`). The component holds zero
     scale opinion and reads no `--ui-type-*` (or `--c-*` ink role) directly. Naming: the **fleet** scale is
     `--ui-type-*` (NOT `--ui-text-*`) — deliberately, because `--ui-text-*` is the component prefix and is a
     strict prefix of `--ui-text-field-*`; keeping the fleet family `--ui-type-*` avoids the ambiguity.

4. **Heading semantics — `role=heading` for `h1`–`h5` (Fork 3, resolved: real headings).** A2UI frames the
   `variant` as a typographic *hierarchy*, so `h1`–`h5` ARE document headings; the user chose native-heading
   parity (2026-06-28). `ui-text` carries one small `connected()` effect off the `variant` signal — mirroring
   `button`'s role/`ariaDisabled` effect — that, for `variant ∈ h1…h5`, sets `internals.role = 'heading'` +
   `internals.ariaLevel = 1…5`, and for `body`/`caption` clears **both** (generic styled text, like
   `<p>`/`<span>`). Set through `ElementInternals` — **never** a host `role`/`aria-*` attribute (the FACE
   pattern). The accessible name is the slotted text (cl.2), so a heading is named by its own light-DOM text.
   This `connected()` leg is the **only** behavioural code `ui-text` carries; everything else is prop + CSS.
   (The rejected "purely-visual, no implicit role" alternative is recorded below — the user accepted the
   spurious-heading tradeoff in exchange for AX-correct hierarchy.)

5. **The A2UI `Text` catalog type → `ui-text`.** `catalog.json` gains a `Text` component with two properties:
   **`text`** `{ type: string, bindable: true, mapsTo: "textContent" }` and **`variant`** `{ type: string,
   enum: [h1…h5, caption, body], mapsTo: "variant" }`. No `children` (a leaf — text is content, not a
   ChildList) and no `value` (not an input). `text`'s `bindable: true` lets a `{path}` resolve at render and a
   literal string conform (`conformance.ts`); `text`'s `mapsTo` (`textContent`) ≠ its name, so — exactly like
   `Button.label` — it needs a **bespoke `textFactory`** (the ratified exception to `accessorFactory`):
   `text → el.textContent` (with the `value == null ? '' : String(value)` coercion `buttonFactory` uses),
   `variant → el.variant` (the accessor prop), `setAttr` fallback. `Text: textFactory` joins
   `defaultFactories`. **No renderer change** — a bound `text:{path}` flows through the existing scope-owned
   bound-prop effect (`widget.ts`) untouched. `Text` is the first **display** type in the default catalog
   (beyond control/container/input).

## Consequences

- **Realized by** four slices, in dependency order: **tokens-specialist** (the `--ui-type-*` family in
  `dimensions.css` + `dimensions.test.ts` + the `geometry.md` *Display*-row repair) → **execution-lead**
  (`controls/text/{text.ts,text.css,text.md}` + the per-component probes; the barrel registration in
  `controls/index.ts` + the `barrels.test.ts`/`tree-shake.test.ts` family enumerations; the catalog wiring —
  `factories.ts` `textFactory`, `catalog.json` `Text`, and the `index.test.ts`/`factories.test.ts`/conformance
  updates) → **docs-site-steward** (the demo switch, below) → **component-reviewer** (the Display-class DoD — realized as the [`component.md`](../rubrics/component.md) §"Class lens — the Display control class" addendum, #8).
- **The demo switch is this wave's scope; `ui-text` gets NO `/site` doc page yet** (a follow-up). In
  `site/pages/a2ui-list.ts`: demo 1 `tag_chip` Button→`Text` `body`; demo 2 `person_name` Button→`Text` `h5`,
  `person_role` Button→`Text` `caption`; demo 4 `section_title` Button→`Text` `h4`, `item_chip` Button→`Text`
  `body`. **Demo 3 is untouched** (its leaves are real `TextField` inputs + a real action Button). Each switch
  is `label:{path}` → `text:{path}`, `variant` button→type.
- **`--ui-type-*` ≠ `--ui-font-*`.** Two ledgers kept separate, deliberately: the control-band font is glyph
  sizing *inside a control frame* (paired to `--ui-height-*`, the square-centring law); the type scale is
  *document typography* (free-standing, with its own line-height). A control never reads `--ui-type-*`; a
  `ui-text` never reads `--ui-font-*`/`--ui-height-*`.
- **Stale → re-verify:** `geometry.md`'s *Display* row gains the `--ui-type-*` lever (text-bearing display now
  reads the typographic ramp, not only the control font); `goals` gains a Display-control DoD; the default
  catalog's shipped-family count rises by one (`Text`), so `index.test.ts`'s expected-keys list and
  `factories.test.ts`'s table-parity gain `Text`, and `Text` leaves the deliberately-absent list. Nothing
  shipped reads `--ui-type-*` or renders `Text` today, so the adds are **purely additive**.
- **Honest negatives.** (a) The `--ui-text-*` component prefix is a strict prefix of `--ui-text-field-*` — no
  real collision (distinct full names), but a prefix-matching lint could trip; mitigated by keeping the fleet
  family `--ui-type-*` (cl.3a). (b) Heading semantics (cl.4) can emit spurious headings if an agent misuses an
  `h`-level for visual size only — the user accepted this tradeoff (native-heading parity) over purely-visual
  text. (c) A future `/site` doc page will need a `display`
  group in the site-TOC editorial rule (`site-toc.test.ts` today knows control/container/pattern/layout) — a
  follow-up, not this wave.

## Alternatives considered

- **A `text` prop (typed signal) instead of slotted children** — rejected (Fork 1): display content is not
  configuration, so the prop could not reflect (a paragraph in an attribute is wrong), and an effect writing
  `this.textContent = this.text` would **clobber** any slotted children — you cannot cleanly support both. It
  also breaks the fleet's void-`render()`/light-DOM-children law for no gain: a display leaf has nothing to
  recompute from its text. The one upside (a signal) buys nothing here.
- **Reuse the control-band `--ui-font-sm/md/lg` for the variants** — rejected (Fork 2): the control font tops
  out at 16px (an `h1` is ~40px) and is bound to the control-frame law (`× scale`, paired to `--ui-height-*`).
  Typography is a separate ledger; overloading the control ramp would couple page headings to control sizing.
- **`--ui-type-*` with `× var(--ui-density)` on size** — rejected: glyph size is density-invariant (the
  `geometry.md` frame/rhythm split); `[density]` re-multiplies gaps, never the frame. Type follows the frame
  family (scale-yes, density-no), like `--ui-font-*`/`--ui-height-*`.
- **`--ui-type-*` size constants on `:root`** — rejected: a subtree `[scale]` must re-multiply type the same
  way it re-multiplies the control font (ADR-0007's exact lesson — a `:root` constant freezes scale at 1 for
  subtrees). The *sizes* join the `*` ramp; only the scale-free *weight*/*leading* constants sit on `:root`.
- **Purely-visual typography — no implicit role (the Fork 3 fallback)** — rejected by the user: `ui-text`
  would carry no `role` (structure left entirely to the parent), avoiding any spurious-heading risk and
  dropping the `connected()` leg (a pure-CSS element like `ui-column`). Rejected because A2UI frames the
  `variant` as a *hierarchy* and native `<h1>` is a heading — the user chose AX-correct headings, accepting
  the misuse risk. (Had this been chosen, only cl.4's `connected()` leg + the descriptor's `aria` role/level
  rows would differ; cl.1–3,5 are identical.)
- **A separate `Heading` component (and/or a `Label`)** — rejected: A2UI v1.0 is explicit — one unified `Text`
  with a `variant` hierarchy, no separate heading/label types. The fleet follows the protocol.
- **Route `Text` through `accessorFactory` (`mapsTo: text`, a `text` prop)** — rejected: it would force the
  `text`-prop design (above) just to satisfy the 1:1 accessor pattern. The bespoke `textFactory` (the
  `buttonFactory` precedent) is the correct, already-blessed exception for a content property whose `mapsTo`
  differs from its name.
