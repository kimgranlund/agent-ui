---
# code.md frontmatter — the attributes-as-API descriptor for ui-code (ADR-0004; LLD-C7,
# content-family.lld.md §3). The machine-checkable public surface lives HERE (frontmatter); the prose
# below the fence is the /site doc. The `attributes[]` block MUST mirror code.ts `static props`
# (language) — the contract↔props trip-wire (code-descriptor.test.ts) targets this fence.
tag: ui-code
tier: display          # geometry size-class (Display band — NO control frame/height/[size]/[scale]; SPEC-R20)
extends: UIElement     # a non-interactive, non-form-associated, ZERO-MACHINERY display LEAF (SPEC-R1)
# marginal: measured at the build wave (`npm run size`, manual discipline, ADR-0040/SPEC-N4) once
# controls/index.ts wires this folder in (LLD-C11, a separate serial wave — not this fence).

attributes:            # attributes-as-API — mirrors code.ts `static props` (language)
  - name: language
    type: string
    default: ''
    reflect: true      # reflects so a JS-set value is inspectable/stylable too (the fleet reflect precedent)
    # INERT metadata at v1 (SPEC-R4) — no enum (nothing for the ADR-0098 static-enum lane to gate), zero
    # rendering effect, no highlighter dispatch. Exists so model-emitted markdown-fence habits (```json`)
    # round-trip losslessly; a future syntax-highlighting consumer is a NAMED, FENCED escape hatch
    # (SPEC-R6), never built here.

properties: []         # no manual accessors — the displayed code is light-DOM children (textContent), NOT a prop (the ui-text/button-label precedent)

events: []             # display-only — emits nothing (not interactive, SPEC-R1)

slots:                 # light-DOM, host-as-content (ADR-0006/ADR-0113 fork F2) — the default/unnamed children ARE the verbatim code text
  - name: code
    optional: true
    description: >-
      The verbatim code text — the default/unnamed children (textContent); rendered with `white-space:
      pre` (newlines/indentation preserved). No stamp, no template, no MutationObserver — a bound
      `Code.code` write (the catalog `textContent` lane) replaces plain text with plain text; author-
      injected element children (e.g. pre-highlighted spans, the light-DOM freedom escape hatch) render
      untouched until such a write clobbers them to one text node. Authoring note: `<ui-code>\ncode</ui-code>`
      renders its leading newline (unlike native `<pre>`, which the HTML parser strips) — author without
      a leading blank line, or trim before assigning `code`.

parts: []              # no interior nodes — the host itself is the code box AND the scroll container (host-as-content)

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: code             # role=code via ElementInternals — the HTML-AAM mapping of native <code>, applied to the custom element
  roleSource: internals   # `this.internals.role = 'code'` — a CONSTANT, set once in connected() (the list.ts/bar-chart precedent); NEVER a host role attribute
  labelSource: textContent  # the light-DOM text is both the visible content and (via normal text-node accessible-name computation) what AT reads — no internals.ariaLabel is set

keyboard:
  - The host itself is the scroll container (no inner wrapper). Keyboard access to horizontal overflow
    rides the platform's focusable-scroller behavior where an engine implements it (Chromium: Tab reaches
    the scroller, ArrowRight scrolls it). No `tabindex` is minted (the zero-machinery ruling, SPEC-R5) —
    on engines without a focusable scroller (WebKit, at time of writing) the residual is NAMED and
    ACCEPTED: content stays complete in the DOM/AX tree regardless of scroll position; a `tabindex`
    affordance is a foreseen extension on evidence, not shipped here.

geometry:
  sizeClass: display
  blockSize: content     # NO control height (Display class) — block-size is content-driven
  fontFamily: var(--ui-code-font)         # --ui-mono, the minted monospace constant
  fontSize: var(--ui-code-size)           # --md-sys-typescale-body-medium-size
  lineHeight: var(--ui-code-line-height)  # --md-sys-typescale-body-medium-line-height
  padding: var(--ui-code-pad-block) var(--ui-code-pad-inline)  # density-INVARIANT frame (12px/8px, ADR-0113 cl.2 — not the --ui-space rhythm ladder)
  radius: var(--ui-code-radius)           # the fleet --ui-radius-base referent

forcedColors: An explicit `@media (forced-colors: active)` block (SPEC-R19) — the host paints CanvasText on Canvas with a 1px CanvasText border, so the surface keeps a visible shape even when the container-seam fill is forced away.
---

# ui-code

`ui-code` is the **Display**-class, zero-machinery verbatim code leaf (ADR-0113, content family v1) — a
block-level element that shows exactly what it is given: mono, whitespace-preserved, scrolled inside its
own box. It is **not** interactive and **not** form-associated: no events, no keyboard contract, no
clipboard affordance, no syntax highlighting.

```html
<ui-code>npm run check && npm test</ui-code>
<ui-code language="json">{"ok": true}</ui-code>
```

## Content model — host-as-content, zero machinery

The displayed code is the element's **light-DOM children** (textContent), not a property — exactly the
`ui-text`/`button`-label precedent. `render()` stays the inherited void; there is **no** stamp, **no**
`MutationObserver`, **no** adoption code, and **no** clipboard API — `ui-code` is simpler than `ui-text`
because there is nothing to heal: the A2UI catalog's bindable `Code.code` property maps directly to
`textContent`, so a bound write replaces plain text with plain text (the `Text.text` lane).

**The light-DOM freedom escape hatch**: an app author MAY inject pre-highlighted element children
directly (`<ui-code><span class="tok">...</span></ui-code>`); the component leaves them untouched. A
subsequent bound `code` write clobbers them to a single text node — guaranteed plain text always wins.

## Verbatim, self-scrolling rendering

Whitespace is preserved (`white-space: pre` — newlines and indentation live in the text nodes, so
copy-paste fidelity is free), in the `--ui-mono` typeface at `--md-sys-typescale-body-medium-*` metrics,
on a component-owned surface (`--ui-code-surface`, the `--ui-container-bg` cross-family seam) with the
fleet `--ui-radius-base` corner. The component **owns its own horizontal overflow**: `overflow-x: auto`
on the host itself (host-as-content means the text nodes are host children, so no inner wrapper is
needed) — a bare `<ui-code>` in any container, including a narrow flex column or a feed bubble, never
wraps mid-token and never blows out its container, with zero consumer CSS (ADR-0102 Lane A). Long
content scrolls **inside the component's own box**.

A parser nicety is accepted: `<ui-code>\ncode</ui-code>` renders its leading newline (unlike native
`<pre>`, which the HTML parser strips one). Author without a leading blank line inside the tag, or trim
before assigning to `code` from script/the catalog.

## `language` — inert metadata

`language` is a reflected, free-string prop with **zero rendering effect** at v1 — no enum, no
highlighter dispatch, no class toggling. It exists so model-emitted markdown-fence habits (` ```json `)
round-trip losslessly, and as the forward hook a future syntax-highlighting adapter package would consume
— that adapter is an explicit, fenced, out-of-v1 extension (the zero-dependency pillar rules out any
tokenizer shipping in the core: "a dependency in costume," ADR-0107).

## The fences (normative), with escape hatches

`ui-code` MUST NOT ship a syntax highlighter/tokenizer of any provenance, a copy-to-clipboard affordance
(interactivity would change the size class — Display stays passive), or soft-wrap/line-number/max-height
knobs. Escape hatches, named: **(a)** light-DOM freedom (author-injected pre-highlighted children);
**(b)** a future opt-in adapter package outside the zero-dep core (its own intake); **(c)** copy = app-
layer composition (`Row > [Code, Button]`); **(d)** long-code folding = composition
(`Disclosure > Code`).

## Accessibility

The host carries `role="code"` via `ElementInternals` (never a host attribute) — the HTML-AAM mapping of
native `<code>`. The text is real, selectable light-DOM text (`user-select: text`) and is fully present
in the accessibility tree regardless of visual scroll position. Keyboard access to the scrolled overflow
rides the platform's focusable-scroller behavior where it exists; `ui-code` mints no `tabindex` and no
measurement machinery for it — engines without a focusable scroller leave horizontal scrolling to
selection/AT navigation (a named, accepted residual; a `tabindex` affordance is a foreseen extension on
evidence, not a rider).

## Sizing

Display-class (`geometry.md`): no control height, no `[size]`/`[scale]` attribute, no `[density]` legs —
every frame quantity (`--ui-code-pad-inline`/`-pad-block`, `--ui-code-radius`) is density-**invariant**
(ADR-0113 cl.2), unlike a Pattern control's space-ladder rhythm. The type lever is the fixed
`--md-sys-typescale-body-medium-*` row, not a size ramp.

## Forced colors (WHCM)

An explicit `@media (forced-colors: active)` block paints `CanvasText` on `Canvas` with a 1px
`CanvasText` border, so the surface keeps a visible shape when the container-seam fill is forced away —
the same pattern the container/card family uses.
