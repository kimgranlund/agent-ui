---
# step-flow.md frontmatter: the attributes-as-API descriptor for ui-step-flow (T-0198, Direction B approved by Kim
# 2026-10-21). The machine-checkable public surface lives here; the prose below the fence is the /site doc.
# `attributes[]` is the generation source for step-flow.props.gen.ts (ADR-0173) and its order is pinned by the
# dogfood fleet row. The contract<->props trip-wire (step-flow-descriptor.test.ts) targets this fence.
tag: ui-step-flow
description: A client-side wizard that shows its scene children one at a time under a "Step n of m" bar, with Back and Next of its own, Next gated on the scene's validity, and a last scene that commits.
tier: pattern           # geometry size-class: container spacing plus one control-height action row (the ConfirmReceipt size-class)
extends: UIElement      # a display primitive: not form-associated; each scene field is its own FACE member
uses:
  - ui-glyph
# marginal: not yet measured; measured at the fleet size gate (npm run size)

attributes:             # attributes-as-API, the generation source for step-flow.props.gen.ts
  - name: steps
    type: json
    tsType: 'string[] | null'
    default: null       # the descriptor grammar reads an inline `[]` as a sequence, so the empty list is null
    reflect: false      # NOT reflected; a JSON-string attribute round-trips through the codec, not setAttribute
    description: The scene labels by index; a scene with no label, or a null list, reads "Step n".
  - name: step
    type: number
    default: 1
    reflect: true       # the bindable position; read clamped to 1 and the scene count, never written back clamped
    description: The current scene, 1-based. Back and Next write it and emit change.
  - name: draft
    type: json
    tsType: 'Record<string, unknown> | null'
    default: null
    reflect: false
    description: The bound aggregate of every scene's answers (the `/draft/*` prefix), folded into the finish action's context as `draft`.
  - name: finishAction
    type: json
    tsType: '{ action: string; context?: Record<string, unknown> } | null'
    default: null
    reflect: false
    attribute: finish-action
    description: The action the last scene's forward button emits; null leaves the commit to the last scene itself, and StepFlow draws Back only.
  - name: finishLabel
    type: string
    default: Continue
    reflect: false
    attribute: finish-label
    description: The word on the finish button.
  - name: inline
    type: boolean
    default: false
    reflect: true       # ADR-0223 R2: the one sizing opt-out; the host hugs its content under [inline]

properties: []          # no manual accessors beyond the six typed props

events:
  - name: change
    detail: 'number, the new `step`'
    description: Fired on every Back press and every accepted Next press, after `step` is already written, so a listener reading `el.step` sees the new value.
  - name: action
    detail: '`{action, context: {...context, draft}}` from `finishAction`'
    description: Fired on a finish press once the last scene is valid, with the bound `draft` folded into the context.

slots: []               # no named slots; the producer's direct element children are the scenes, one per step

parts:
  - name: header
    description: The `<div data-part="header">`, the host's first child, holding the position, the label and the bar.
  - name: position
    description: The `<span data-part="position">` with the text "Step n of m", tabular numerals.
  - name: label
    description: The `<span data-part="label" tabindex="-1">` naming the current scene, `steps[n-1]` or "Step n". Back and Next move focus here; Tab never stops on it.
  - name: bar
    description: The `<div data-part="bar" aria-hidden="true">` segmented track, one segment per scene.
  - name: segment
    description: One `<span data-part="segment">` with `data-state` done, current or upcoming. The current segment is taller as well as filled, never color alone.
  - name: actions
    description: The `<div data-part="actions">`, the host's last child, holding Back, Next and Finish. Carries `data-self-commit` on the last scene when `finishAction` is null, and then shares the scene's last line.
  - name: back
    description: The native `<button type="button" data-part="back">` with a caret glyph and the word Back. Absent on step 1. `lg`, or `md` on the self-commit scene, matching the scene's own commit Button.
  - name: next
    description: The native `<button type="button" data-part="next" data-size="lg">`, the word Next and a caret glyph. Absent on the last scene. Never disabled.
  - name: finish
    description: The native `<button type="button" data-part="finish" data-size="lg">` labelled `finishLabel`. Present only on the last scene when `finishAction` is set.
  - name: glyph
    description: A decorative `<ui-glyph data-part="glyph">`, the caret in Back and Next. ui-glyph hides itself through ElementInternals; the word beside it carries the meaning.

customStates: []        # no custom state; the self-commit row rides a data- attribute on the actions part

face:
  formAssociated: false  # a display primitive, no value/validity participation of its own

aria:
  role: group
  roleSource: internals   # set via ElementInternals in connected(), never a host role/aria-* attribute
  labelSource: prop       # internals.ariaLabel is the current scene's label
  nonColorSignifier: The current segment is taller than the others as well as filled, and the position text names the step. Color is the redundant channel (ADR-0057).

keyboard:
  - note: No keyboard model of the host's own; the host takes no focus. Back, Next and Finish are native buttons in Tab order and activate on Enter and Space. After Back or Next, focus moves to the label (tabindex -1, never a Tab stop). Enter in a scene field does not advance.

geometry:
  sizeClass: pattern
  gap: var(--ui-step-flow-gap)                            # = --md-sys-group-gutter (the approved mockup's), between the header, the scene and the actions row
  actionHeight: var(--md-sys-height)                      # Back, Next and Finish resolve on their own lg step (`data-size="lg"`): 28px on an A2UI canvas (ADR-0245 Amendment 2), 40px at the root; Back is md on the self-commit scene
  note: Block-level fill by default (ADR-0223); `inline` flips the host to inline-grid and hugs. The host is a one-column grid with areas header and scene, and the actions row on a third track; on the self-commit scene the actions row takes the scene's area instead, so no empty track or gap is left under the scene.

forcedColors: Back, Next and Finish keep a ButtonText border, and every segment gains a CanvasText border so the done and current fills survive. The glyphs stroke in currentColor and need no adjustment.
---

# ui-step-flow

`ui-step-flow` walks the user through its scenes one at a time, with Back and Next of its own and a last scene that commits.

Each direct element child is one scene. The control shows the current one, hides the rest with `hidden` and
`inert` (so their values and validity survive Back), and draws its own header and actions row around them.

```html
<ui-step-flow steps='["Dates","Guests","Confirm"]' finish-action='{"action":"review_stay"}'>
  <ui-column>...</ui-column>
  <ui-column>...</ui-column>
  <ui-column>...</ui-column>
</ui-step-flow>
```

## Anatomy

In DOM order: the header (the "Step n of m" position, the current label and the segmented bar), the scenes, then
the actions row with Back, Next and Finish. The control keeps the header first and the actions row last: when a
scene lands after the actions row, the control moves its own actions row back to the end, never a scene.

## Back, Next and finish

Back and Next run on the client, with no agent turn per step. Back is absent on step 1, and Next is absent on the
last scene. Next is never disabled: a press checks the current scene's form fields and, when one is invalid,
reports the first and stays. An accepted move writes `step` and emits `change`. With `finishAction` set, the last
scene shows a finish button labelled `finishLabel`, gated the same way, which emits `action` with the bound
`draft` folded into the context. Every scene field binds under one `/draft/<key>` prefix, so `draft` is the
whole answer.

## The self-commit row

With `finishAction` null, the last scene commits itself, and StepFlow draws Back only. The scope is the BookingForm
shape: a self-committing scene whose commit Button hugs the end edge of its last line. There the actions row carries
`data-self-commit` and shares that line, Back at the start and the scene's own commit at the end, and Back steps
down to `md` so the row holds one height. The commit Button is never moved and the scene is never restyled.

## Accessibility

The host is `role="group"`, named by the current label, through `ElementInternals`. After Back or Next, focus
moves to the label, described by the position text, so a screen reader reads the step and its name. Back, Next
and Finish are native buttons in Tab order. On the self-commit scene Back takes focus after the scene's commit
Button, because the actions row is the host's last child.
