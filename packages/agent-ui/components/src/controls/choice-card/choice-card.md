---
# choice-card.md frontmatter — the attributes-as-API descriptor for ui-choice-card (ADR-0004 /
# ADR-0220). The `attributes[]` block MUST mirror choice-card.ts `static props` — the contract↔props
# trip-wire (choice-card-descriptor.test.ts) targets this fence. Field set per .claude/docs/plan.md §10.
tag: ui-choice-card
description: The rich option unit of the `choice` family — the WHOLE card is the hit target and the a11y unit; no selection commit of its own (the owning ui-choice-group commits).
tier: container         # geometry size-class (Container/layout band — a rich-content card, no control height; the ui-card precedent)
extends: UIElement      # NOT form-associated — a card carries no value of its own (the Radio/RadioGroup precedent: the GROUP owns the commit)
# marginal: measured at integration (npm run size, ADR-0040 §3)

attributes:             # attributes-as-API — mirrors choice-card.ts static props
  - name: value
    type: string
    default: ''
    reflect: true       # the option's committed identity key; read by the owning ui-choice-group's keyOf()
  - name: disabled
    type: boolean
    default: false
    reflect: true       # per-card disabled (ADR-0220 cl.8); reflects as a real attribute so rovingFocus/selectionCommit's own isDisabled() backstops catch it for free

properties:             # IDL beyond attributes-as-API
  - name: setSelected
    description: 'Method — setSelected(selected: boolean): void. Applied by the OWNING ui-choice-group (a sibling cannot set another element''s protected internals): sets aria-selected via ElementInternals and toggles the :state(selected) custom state. Called both as the selectionCommit `reflectSelected` seam (commit-time) and from the group''s own value-keyed re-sync effect (a declarative/programmatic value write).'

events: []              # a card emits no event of its own — the owning group emits `select` on commit

slots:
  - name: default
    optional: false
    description: Agent-composed DISPLAY content only (Text/Image/Badge/Stat/Icon/layout — ADR-0220 cl.4). Interactive descendants are non-conforming (ARIA `option` permits none); v1 enforcement is teaching + review tier, not a structural guard.

parts: []               # light-DOM host-as-content — no shadow parts

customStates:
  - selected            # set via setSelected() (internals.states), driving the selected frame + non-color check badge (ADR-0057); mirrors internals.ariaSelected

face:
  formAssociated: false  # NOT form-associated — the owning ui-choice-group is the sole form participant (the Radio/RadioGroup precedent)

aria:
  role: option            # set via internals.role in connected() — never a host role attribute (FACE)
  roleSource: internals
  selectedState: internals.ariaSelected — 'true' / 'false', set by setSelected() (never a host aria-selected attribute)
  labelSource: 'Name-from-content — the slotted display children ARE the accessible name/description (no separate label prop; a rich card''s content already carries it).'
  disabledState: 'Own `disabled` prop only (no ancestor-fieldset channel — this is not a UIFormElement); the owning group additionally cascades its own effective-disabled state onto non-individually-disabled cards.'

keyboard:
  - keys: (none directly)
    action: A card has no keyboard handling of its own — the owning ui-choice-group's rovingFocus (Arrow/Home/End) and selectionCommit (Enter, and a synthesized Space→click) traits drive all keyboard interaction over the card set.

geometry:
  sizeClass: container    # Container/layout band (geometry.md) — sizes to its own content + the group's grid track, no control height
  radius: var(--ui-choice-card-radius)     # = var(--md-sys-shape-corner-base), the family-tunnel mint (ADR-0124)
  padding: var(--ui-choice-card-padding)   # off the --md-sys-space ladder, minted into this control's own chain
  border: 2px solid var(--ui-choice-card-border)

forcedColors: A `@media (forced-colors: active)` block maps the idle frame to ButtonText, the selected frame to Highlight, and the selected badge/tick to Highlight/HighlightText — the system's own guaranteed-contrast reading pair.
---

# ui-choice-card

`ui-choice-card` is the **option unit** of the `choice` family (ADR-0220) — a light-DOM, rich-content
card whose **entire surface is the hit target and the a11y unit**. It carries no selection state or
commit logic of its own; an owning `ui-choice-group` roves and commits the whole set.

```html
<ui-choice-group name="room">
  <ui-choice-card value="standard">
    <ui-text as="strong">Standard</ui-text>
    <ui-stat figure="$120"></ui-stat>
  </ui-choice-card>
  <ui-choice-card value="deluxe">
    <ui-text as="strong">Deluxe</ui-text>
    <ui-stat figure="$185"></ui-stat>
  </ui-choice-card>
</ui-choice-group>
```

## Content model

Children are agent-composed **display-only** content — text, images, badges, stats, icons, layout
primitives. An interactive descendant (a button, a link) is non-conforming: ARIA `option` permits no
interactive children. This is taught and reviewed, not structurally blocked, at v1.

## Selection & accessibility

`role="option"` and `aria-selected` are both set through `ElementInternals` — never a host attribute
(the fleet ARIA law; the `ui-tab` precedent). The owning `ui-choice-group` calls `setSelected(boolean)`
on commit and whenever its own `value`/`values` changes externally. The selected state paints as a
bordered frame plus a non-color checkmark badge (WCAG 1.4.1, ADR-0057) — never color alone.

## Disabled

A card may be individually `disabled`; the owning group also disables every non-individually-disabled
card while the group itself is effectively disabled (its own `disabled` prop, or an ancestor
`<fieldset disabled>`).

## Standalone usage

A `ui-choice-card` with no owning `ui-choice-group` renders its content but carries no interactive
behaviour of its own — the same "meaningless without a coordinator" posture `ui-tab` documents outside
`ui-tabs`.
