---
# field.md frontmatter — the attributes-as-API descriptor for ui-field (ADR-0004 / ADR-0051). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The
# `attributes[]` block MUST mirror field.ts `static props` (LLD-C4: label + description) — the contract↔props
# trip-wire (field-descriptor.test.ts, decomp g7-field-form-provider s10) targets this fence. Field set per
# .claude/docs/plan.md §10 / ADR-0004; the labelling seam + association model per ADR-0051 and
# .claude/docs/llds/field-form-provider.lld.md LLD-C4/LLD-C9.
tag: ui-field
tier: container        # geometry size-class (the radio-group precedent — not a sized control): NO control height, the label rides the font/type tokens, spacing off --ui-space
extends: UIElement     # a structural label/description/error wrapper — NOT form-associated (carries no value of its own) and NOT UIContainerElement (no elevation/brightness surface paint)
# marginal: ui-field adds 475 B gz (~2166 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken — a structural wrapper with no trait). The family total (21599 B gz) stays within the 22528 B gz budget (ADR-0049) — 929 B headroom left after this wave (field + ui-form-provider + the dom/form.ts protocol growth)

attributes:            # attributes-as-API — mirrors field.ts `static props` (LLD-C4): label + description, both plain strings, both un-reflected
  - name: label
    type: string
    default: ''
    reflect: false     # the visible label text → [data-part=label]; not reflected (rendered content, not a CSS hook) — the text-field `label`/`placeholder` precedent
  - name: description
    type: string
    default: ''
    reflect: false     # the visible description text → [data-part=description]; not reflected

properties: []         # no manual accessors beyond the attributes-as-API — the field carries no form value, no validity, no other IDL

events: []             # the field only LISTENS — ui-form-connect (association) and the accepted control's own connect-signal abort (deregistration); it emits nothing of its own. Error rendering is NOT event-driven (gen-3, LLD-C4): a scope-owned reactive effect over the association detail's userInvalid()/validity() closures, installed at association and disposed at dissociation — no input/change/blur/invalid listeners exist, and the reserved ui-form-reset event is not consumed

slots:
  - name: default
    optional: false
    description: The ONE form control this field wraps (any UIFormElement — text-field is the reference wire this wave; LLD-C9 lists the per-control follow-ups). Extra element children are permitted static content and render normally in the column flow. Only the first UIFormElement descendant whose closest('ui-field') resolves to this field associates (first-wins, ADR-0051 / LLD-C4); a second form control still renders and still registers with an ancestor ui-form-provider, but stays un-associated with this field's labelling/error. First-wins is per-tenure, not forever — if the associated control is removed while the field stays connected, the field re-scans and the next slotted control associates.

parts:
  - name: label
    description: The visible label text node — a control-created `<div data-part="label">`, created once (idempotent) in connected() and PREPENDED, so it always reads first in DOM/column order regardless of author children. Carries a stable, module-seeded id (`ui-field-label-N`, the text-field message-node precedent) handed to the associated control via the ADR-0051 labelling seam (`setFieldLabelling`).
  - name: description
    description: The visible description text node — a control-created `<div data-part="description">`, APPENDED after the default slot's content. Stable module-seeded id (`ui-field-description-N`); joins the associated control's accessible description via the seam.
  - name: error
    description: The visible error text node — a control-created `<div data-part="error">`, appended after description. Starts empty and `hidden`. Rendered by a scope-owned reactive effect over the association detail's `userInvalid()`/`validity()` closures (ADR-0050 §4) — installed at association, disposed at dissociation; the effect depends on signal VALUES, never on listener/dispatch ordering, so there are no input/change/blur/invalid listeners, and the reserved `ui-form-reset` event is not consumed (reset re-suppression rides the tracker's own signal write, tracked by the same effect) — never a second timing source. Stable module-seeded id (`ui-field-error-N`); joins the accessible description alongside `description`, and the control's OWN internal message node yields (empty + hidden) while associated, so AT hears exactly ONE announced error.

customStates:
  - user-invalid   # mirrors the associated control's user-invalid gate; a CSS hook only (jsdom cannot match :state()) — the s11 browser smoke asserts equivalence with the control's own :state(user-invalid), same tracker source

face:
  formAssociated: false  # a structural wrapper — extends UIElement, no value/validity of its own; the slotted control is the form participant

aria:
  role: none             # a structural wrapper — internals.role stays unset (the column/layout precedent); no host role or aria-* attribute
  roleSource: none
  labelSource: the field label part's text reaches the associated control's role-carrying part as ITS accessible name, via the ADR-0051 labelling seam (setFieldLabelling to the control, forwarded through the overridable applyFieldLabelling hook — guarded internals ARIA-element reflection for an internals-role control, or an id-referencing override for a part-role control such as text-field's editor); an unwired control instead receives the label TEXT through the option-A bridge (one-way sync into the control's own label prop, armed only while that prop is empty)
  describedBy: the description and error part ids join the associated control's accessible description through the same seam; the control's own internal message node yields (empty + hidden) while associated, so assistive tech hears exactly ONE announced error — the field's, not a duplicate

keyboard: []           # not interactive itself — no tabindex, no keyboard contract; the slotted control owns its own keyboard model entirely

geometry:
  sizeClass: container   # Container/layout band — NO control height (never reads --ui-height-*); the radio-group precedent
  display: flex          # column flow: label / control slot / description / error, top to bottom (DOM placement IS reading order)
  gap: var(--ui-field-gap)   # label↔control↔description↔error rhythm, off --ui-space × density — the one density-bearing quantity (field.css)
  note: The slotted control brings its own geometry (e.g. text-field's ADR-0021 min-inline-size floor); the field itself adds none — it is a pure label/description/error wrapper, never a sizing surface.

forcedColors: A `@media (forced-colors: active)` block keeps the label/description/error ink visible (CanvasText — real text, not decorative glyphs); the error stays distinguishable by PRESENCE, not colour alone (WCAG 1.4.1 — field.css).
---

# ui-field

`ui-field` is the **visible label / description / error wrapper** around ONE slotted form control. It
`extends UIElement` (not form-associated, not a surface container) and does exactly two jobs: it renders a
label/description/error trio as light-DOM parts, and it hands their identity to the slotted control through
the ADR-0051 **labelling seam** so the control's own role-carrying part (an internals-role control, or a
part-role control like text-field's editor) carries the right accessible name and description — without
`ui-field` ever reaching into the control's internals directly.

```html
<ui-field label="Email" description="We'll never share it">
  <ui-text-field type="email" required></ui-text-field>
</ui-field>
```

## Association model

At connect, `ui-field` creates its three parts once (label prepended, description + error appended — column
order matches DOM order, no CSS `order` needed) and listens for the `ui-form-connect` protocol event
(ADR-0050) bubbling up from a descendant control — **without** stopping its propagation, so it continues on
to an ancestor `ui-form-provider`. It accepts the **first** `UIFormElement` descendant whose
`closest('ui-field')` resolves to itself (the nearest-field rule; a deeper nested field's control is
correctly refused). A second form control inside one field renders normally and still provider-registers,
but stays un-associated — `ui-field` documents a **one-control** contract.

Because custom-element **upgrade follows define order, not tree order**, a control can announce into the
void before its field is upgraded and listening. `ui-field` closes that gap with a **one-shot catch-up scan**
at its own connect (`querySelectorAll('*')` filtered to `UIFormElement`, calling the base's public
`announceFormConnect()` on each) — so a field defined/upgraded *after* its slotted control still associates
it. If the associated control is later removed while the field stays connected, the field clears its state
and re-runs the same catch-up scan, so a second, still-slotted control can associate next — first-wins is
per-tenure, not forever. If the field itself is removed, association is torn down without a re-scan (nothing
should attach into a detached subtree).

## The labelling seam + the bridge

Association calls the control's `setFieldLabelling({ label, description, error })` (elements, not id
strings). A base-owned effect on the control forwards them through the overridable `applyFieldLabelling`
hook: the **guarded default** reflects via `ElementInternals` ARIA-element accessors whenever the control
carries an `internals.role` (checkbox/switch/radio/slider — free); a **part-role** control overrides the
hook to id-reference its own role-carrying part (text-field's editor is the reference wire this wave). A
control that is neither yet falls back to the **option-A bridge**: `ui-field` one-way-syncs its own label
text into the control's `label` prop, but only while that prop is empty (a consumer-set label is never
clobbered) — the bridge is lossy by design: name-only, text-only, and inert for a control with no `label`
prop. LLD-C9 tracks the remaining per-control wiring (combo-box, select, calendar).

## Error rendering (reactive, no second timing source)

`ui-field` renders its error part with a **scope-owned reactive effect**, not event listeners. At
association it installs one effect over the connect detail's tracked closures — `assoc.validity()` and
`assoc.userInvalid()` (ADR-0050 §4) — disposed again at dissociation. The render depends only on signal
**values**: every real trigger (typing, a blur/change flipping the control's own `interacted` tracker, a
live `setCustomValidity` write, or a reset writing `interacted` back to `false`) is a plain signal write the
kernel wakes this effect for directly, so there is no listener ordering, dispatch phase, or task timing to
depend on. The error part shows the associated control's validation message **only** while the control's
user-invalid gate is true, and stays empty + hidden otherwise — composing the control's own
`trackUserInvalid` timing rather than inventing a second one, exactly as before.

The reserved `ui-form-reset` protocol event (ADR-0050/ADR-0051) is **not** consumed here: both reset paths
end in the tracker's own signal write, which the render effect already tracks, so reset re-suppression
falls out of the same mechanism with no separate observation path.

**Limitation (F4):** the visible error requires the associated control to wire `formUserInvalid()` (one
tracker source); at G7 only text-field does. An invalid indicator/range/select member shows no field
error — consistent, since it exposes no `:state(user-invalid)` either. Per-control error legs are the
LLD-C9 follow-ups.

## required / disabled affordances

`ui-field` duplicates no state of its own for these: `field.css` keys a required-marker and a muted
label/description ink off `:has([required])` / `:has([disabled])` on the slotted control's reflected
attributes (LLD-C5).

The required marker is a `[data-part='label']::after` `' *'` appended to the **label** — a static
requiredness affordance, never emitted by the slotted control or the form provider. It reads its own
`--ui-field-required-ink` (defaulting to the label ink), **not** `--ui-field-error-ink`: requiredness is
invariant, so the mark must not wear the danger colour and be misread as a persistent validity error after
a valid value lands (ADR-0057 — intent never by colour alone; the error signifier stays the separate
`[data-part='error']` text). Because `--ui-field-required-ink` follows `--ui-field-label-ink`, it mutes with
the label under `[disabled]`.
