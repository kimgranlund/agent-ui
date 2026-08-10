---
# toggle.md frontmatter — the GENERATION SOURCE for ui-toggle's `static props` block (ADR-0173, the
# button.md precedent — a control converted onto the ratchet from birth). The machine-checkable public
# surface lives HERE (frontmatter); the prose below the fence is the /site doc. `toggle.props.gen.ts` is
# GENERATED from the `attributes[]` block below (`node scripts/generate-props.mjs toggle`); toggle.ts
# imports it — never hand-edit the generated file. The fleet drift gate
# (descriptor/props-gen-driftwire.test.ts) keeps the two byte-identical. Field set per .claude/docs/plan.md
# §10 / ADR-0004, widened by ADR-0173 cl.2/OF1/OF2.
#
# ADR-0179 GH #686 Amendment S7-a (admin-three-pane-ia.lld.md §16.4) — the fleet has no pressed-pill
# toggle-button primitive; this mints ui-toggle (the amendment's own ruling, LLD §16's "the fleet has no
# ui-toggle — mint it" paragraph). Downstream consumer (the agent-admin unified header's three pane pills,
# S7-c) is OUT of this slice's scope — this ships only the standalone control.
tag: ui-toggle
tier: control       # Control-band geometry (full control height, the button.css ramp) — a "pressed pill
                     # BUTTON" per the amendment's own words, NOT the Indicator compact/widget-box ramp
                     # ui-switch/ui-checkbox use (ADR-0041); ui-toggle carries no form value at all.
extends: UIElement  # reactive display control, NOT form-associated (face below) — the button.ts precedent,
                     # not the UIIndicatorElement one: aria-pressed is a toggle-BUTTON pattern, not a
                     # checkbox/switch boolean-form-value pattern.
# bundle: measured post-build via `npm run size` (manual by Kim's ruling) — not run this pass; the marginal
# cost rides the already-shipped UIElement + pressActivation/tabbable traits (both already in the bundle
# via ui-button), so ui-toggle's own marginal is small (props + connected() wiring only).

attributes:
  - name: pressed
    type: boolean
    default: false
    reflect: true      # reflects so [pressed] drives CSS paint (:state(pressed) pairs with it, the
                        # segmented-control precedent — [pressed] also works under jsdom, where
                        # CustomStateSet is absent) and is observable/settable as an attribute
    description: The toggle's ON/OFF state — mirrors internals.ariaPressed ("true"/"false"). A press flips it ONLY if no `toggle` listener calls preventDefault() first (see Refused toggle below); setting it directly (JS/attribute) always applies immediately, no refusal path.
  - name: disabled
    type: boolean
    default: false
    reflect: true      # reflects to a `disabled` attribute → CSS pointer-inert hook + the traits' inert guards
    description: Fully inert — no press activation, no key handling, removed from the tab order.
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true      # reflects so the [size] dimensional-ramp repoint applies to JS-set values too
    description: A step on the Control-band dimensional ramp (sm, md default, lg); an ancestor [scale]/[density] also apply (the button.css ramp, geometry.md).

properties: []         # no manual accessors beyond the attributes-as-API

events:
  - name: toggle
    detail: 'null'
    description: Fired on a press (pointer click, or Space/Enter via pressActivation) BEFORE `pressed` is committed — the platform `<input type=checkbox>` click-then-commit precedent, adapted (see Refused toggle below). Cancelable (this.emit's default shape): a listener calling event.preventDefault() REFUSES the toggle — `pressed` does not flip, no second event fires. Uncanceled, `pressed` flips immediately after (same tick) and internals.ariaPressed/:state(pressed) update. Never emitted from a programmatic `pressed` write (naming.md §4's commit-semantics law — a direct property/attribute set is not a user press).

slots:
  - name: icon
    optional: true
    description: The identity icon — a light-DOM child in the start cell (e.g. `<ui-icon slot="icon" glyph="chats-circle">`). Named for its FIXED role (unlike ui-button's position-named leading/trailing, which can hold any data-role) — this slot holds exactly one thing, the toggle's identity glyph. Absent ⇒ the slotless bare-label layout.
  - name: label
    optional: true
    description: The label — the default/unnamed children (an explicit `slot="label"` is equivalent); the accessible name, filling the centre cell. Anonymous grid text (no control-created wrapper, no overflow/ellipsis handling — unlike ui-button's ADR-0133 wrapper, out of scope here: every named consumer usage is a single short word, "Chat"/"Settings"/"Co-pilot").
  - name: state-icon
    optional: true
    description: An optional orthogonal state indicator in the end cell (e.g. the Eye/EyeSlash visibility glyph the agent-admin header pills carry, `<ui-icon slot="state-icon" glyph="eye">`). Named for its fixed role, same rationale as `icon`. Purely presentational — toggling `pressed` never touches this slot's content; a consumer swaps its `glyph` itself in response to whatever state it represents.

parts: []               # light-DOM host, no control-created wrapper — see the `label` slot note above

customStates:
  - pressed              # the ON state: internals.states.add('pressed') mirrors the pressed prop; pairs with [pressed] for the jsdom-and-CSS-state dual write (indicator-element.ts / segmented-control.css precedent)
  - ready                 # the motion gate (ADR-0008): armed one frame past first paint via internals.states (never a host attr), so the upgrade snaps and only subsequent state changes animate (button.ts precedent)

face:
  formAssociated: false   # NOT a FACE form control — extends UIElement, no value/validity participation, carries no name/value

aria:
  role: button            # set via ElementInternals — never a host role/aria-* attribute
  roleSource: internals
  labelSource: textContent    # the light-DOM label text is the accessible name
  disabledState: internals.ariaDisabled   # disabled AX state — a reactive effect sets ariaDisabled 'true' when disabled / null otherwise (ADR-0010); never a host aria-disabled attr

keyboard:
  - keys: Space
    action: Activates on keyup (pressActivation trait; keydown preventDefaults page scroll) — native toggle-button parity (unlike the Indicator class, Enter is NOT suppressed here — see the next row).
  - keys: Enter
    action: Activates on keydown — native `<button aria-pressed>` parity (both Space and Enter activate a real button; ui-toggle carries role=button, not role=checkbox/switch, so it does NOT inherit the Indicator class's Enter-suppression).
  - note: Focusable by default — the `tabbable` trait sets tabindex=0; `disabled` removes the host from the tab order, so a disabled control is never keyboard-focusable.
  - note: Disabled is fully inert — no activation, no key handling.

geometry:
  sizeClass: control
  blockSize: var(--ui-toggle-height)   # the Control-band ramp (button.css's own — `--md-sys-height-{size}`), NOT the Indicator compact/widget-box ramp
  paddingBlock: 0
  inlinePad: h/2 (slotless bare label) · ½(h−icon) (icon and/or state-icon slot edge, symmetric when both present)   # the centering law, geometry.md — button.css's own host-as-grid anatomy, minus the position/role split (both icon slots are fixed-role, see Slots above)
  gap: var(--ui-toggle-gap)             # icon/state-icon ↔ label column-gap — the one density-bearing quantity (gap = font/2 × density)

forcedColors: A `@media (forced-colors: active)` block keeps the ink + border visible under WHCM, and repaints the pressed fill to Highlight/HighlightText (the segmented-control indicator precedent) so the ON/OFF distinction survives high-contrast mode without relying on hue alone.
---

# ui-toggle

`ui-toggle` is a light-DOM pressed-state pill button (`extends UIElement`, ADR-0179 GH #686 Amendment
S7-a) — icon + label + an optional orthogonal state icon, toggling an ARIA-pressed boolean. It is **not**
form-associated: it carries no value/name and does not participate in form submission. ARIA
`role="button"` + `aria-pressed` are applied through `ElementInternals`, never as host attributes. The
fleet had no toggle-button primitive before this — `ui-switch` is a track-and-thumb FORM control,
`ui-segmented-control` is single-select-by-construction (extends the radio group), and `ui-button` carries
no pressed state at all (the amendment's own survey, ADR-0179 GH #686).

```html
<ui-toggle><ui-icon slot="icon" glyph="chats-circle"></ui-icon>Chat</ui-toggle>
<ui-toggle pressed><ui-icon slot="icon" glyph="gear-six"></ui-icon>Settings<ui-icon slot="state-icon" glyph="eye"></ui-icon></ui-toggle>
<ui-toggle disabled><ui-icon slot="icon" glyph="robot"></ui-icon>Co-pilot</ui-toggle>
```

## Refused toggle — the cancelable-before-commit design (LLD §16.2's min-one invariant)

The amendment names a real, load-bearing requirement downstream (S7-b, not built in this slice): a
consumer must be able to REFUSE a toggle press — e.g. "turning off the last shown pane pill is refused;
the pill no-ops and stays pressed" — without the control itself knowing anything about that policy (min-one
membership is the *consumer's* invariant, not the control's).

**The mechanism: `toggle` fires BEFORE `pressed` commits, and it is cancelable.** `UIElement.emit()`
already dispatches a `cancelable: true` `CustomEvent` and returns `dispatchEvent`'s boolean (`element.ts`) —
this is the exact platform precedent `<input type="checkbox">` itself follows: a real checkbox fires a
cancelable `click` *before* the browser applies the default action (flip `checked`, fire `change`); calling
`preventDefault()` on that `click` suppresses both. `ui-toggle` reproduces that shape on its OWN vocabulary
member: a press (pointer or keyboard) emits `toggle` first; if no listener calls `event.preventDefault()`,
`pressed` flips immediately after (same tick, `internals.ariaPressed` + `:state(pressed)` follow). If a
listener DOES cancel it, `pressed` is left untouched — a true no-op, not a flip-then-revert (so there is no
visible flicker for a consumer to suppress).

**Why not a second event (e.g. a `beforetoggle` pair, matching `<details>`'s newer two-event model)?** The
fleet's event vocabulary is a CLOSED seven-member set (`change · input · select · open · close · toggle ·
action`, naming.md §4) — minting an eighth is an ADR-level decision, out of this slice's scope entirely.
Making the ALREADY-legal `toggle` member itself cancelable-before-commit reuses the vocabulary as-is and
needs no widening; a consumer that does not care about refusal (the common case) needs no `preventDefault`
call at all and sees ordinary post-commit state exactly as it would from any other control's event.

**Why not "fire after commit, let the consumer revert `pressed`"?** That shape is available too — nothing
stops a consumer from setting `el.pressed = false` inside a listener — but it commits the flip and its
paint (background/ink transition) before reverting it, a visible flicker for the exact case the amendment
names (refusing the LAST visible pill, the case most likely to draw the user's eye). The before-commit
cancel has zero paint to revert.

Directly setting `pressed` (JS property or the reflected attribute) is **never** subject to refusal — only
a real press (the `toggle` emission path) can be canceled, matching `naming.md §4`'s commit-semantics law
("`change`/`select` are user commits, never emitted from programmatic writes"): a programmatic write is not
a user press, so there is nothing to refuse.

## States & colour

Idle (unpressed): a ghost-like transparent-background pill with a neutral-family ink and a hover wash — the
same channel `ui-button[variant='ghost']` uses. Pressed (`:state(pressed)`, mirrored by the `[pressed]`
reflected attribute so the paint applies under jsdom too): a tonal `primary-container` fill with
`primary-high` ink — the same channel `ui-button[variant='soft']` uses, and the same "primary marks ON"
convention `ui-switch`/`ui-segmented-control` both already use. Disabled: muted neutral roles, pointer-inert
(the `ui-button[disabled]` pattern). No `color-mix` — every colour is a role step (ADR-0008).

## Slots

Three named-by-ROLE slots (a deliberate departure from `ui-button`'s position-named `leading`/`trailing`,
which can hold *any* `data-role`): `icon` (the identity glyph, start cell), the default/`label` slot (the
accessible name, centre cell), and `state-icon` (an optional orthogonal indicator, end cell). Each slot has
exactly one fixed conceptual role in this control's anatomy, so the slot name IS the role — no extra
`data-role` attribute is needed the way `ui-button`'s generic adornment slots require one. The host is a
presence-driven CSS grid (`:has()`, ADR-0006's host-as-grid, the button.css anatomy minus its position/role
split): `[label]` bare, `[icon | label]`, `[label | state-icon]`, or `[icon | label | state-icon]`, each
adornment a square icon-sized cell with a `½(h − icon)` edge inset and `--ui-toggle-gap` between cells.

## Keyboard & focus

Space and Enter both activate (the `pressActivation` trait) — native `<button aria-pressed>` parity. Unlike
the Indicator class (`ui-checkbox`/`ui-switch`/`ui-radio`), Enter is **not** suppressed: `ui-toggle` carries
`role="button"`, not `role="checkbox"`/`"switch"`, so both platform activation keys apply, matching
`ui-button`'s own keyboard model. The `tabbable` trait sets `tabindex="0"` while enabled; `disabled` removes
the host from the tab order.

## Accessibility

- `role="button"` + `aria-pressed` (`"true"`/`"false"`, mirroring `pressed`) are set via `ElementInternals` —
  no host `role`/`aria-*` attribute.
- The accessible name comes from the light-DOM label text (the `label` slot).
- Disabled is announced via `ElementInternals.ariaDisabled` (ADR-0010) — an AX state, never a host
  `aria-disabled` attribute.
- A `forced-colors` block keeps the ink/border visible and repaints the pressed fill to
  `Highlight`/`HighlightText` (the `ui-segmented-control` indicator precedent), so ON/OFF survives WHCM
  without relying on hue alone.
