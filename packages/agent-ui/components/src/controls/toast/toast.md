---
# toast.md frontmatter — the attributes-as-API descriptor for ui-toast (ADR-0004 / feed-family.lld.md
# LLD-C7 / ADR-0112 cl.5/cl.6). The machine-checkable public surface lives HERE (frontmatter); the
# prose below the fence is the /site doc. The `attributes[]` block MUST mirror toast.ts `static props`
# (urgent/duration/action) — the contract↔props trip-wire (toast-descriptor.test.ts) and the
# frontmatter schema (validateComponentDescriptor) both target this fence. Field set per
# .claude/docs/plan.md §10 / ADR-0004. NOT catalogued — ADR-0112 cl.6's first reasoned EXCLUSION_ALLOWLIST
# entry (a toast is app-surface chrome, never agent-emittable content); see "App-surface consumption
# story" below.
tag: ui-toast
description: A self-expiring, non-interrupting notification card shown in the platform's top layer via ui-toast-region.
tier: pattern            # geometry size-class — a fixed-width notification card (Container/surface geometry), NOT a control height
extends: UIElement       # NOT form-associated — a toast carries no value; it announces + optionally emits an action (select)
# marginal: measured at the LLD-C11 shared-file integration slice (npm run size, ADR-0040 §3) — not measured in this folder-local wave

attributes:               # attributes-as-API — mirrors toast.ts static props (urgent, duration, action)
  - name: urgent
    type: boolean
    default: false
    reflect: false        # NOT reflected — an internal effect reads it to flip internals.role status↔alert; nothing renders off the attribute itself
  - name: duration
    type: number
    default: 6000
    reflect: false        # NOT reflected — an input to the timer effect, not an inspectable output state
  - name: action
    type: string
    default: ''
    reflect: false        # NOT reflected — read once at connect to build the affordance cluster; not a rendered/reflected state

properties:                # IDL beyond attributes-as-API
  - name: close
    description: Method — idempotent (a closed latch). Clears any running auto-dismiss timer, dispatches exactly ONE close event, then removes the element from the DOM. Invoked by the close affordance, timer expiry, and an actionable commit (which emits select first).

events:
  - name: select
    detail: 'null'
    description: Fired when the user activates the optional action affordance (the ui-button data-part="action", present only when the action prop is non-empty). The toast closes immediately after (close() runs synchronously following the emit).
  - name: close
    detail: 'null'
    description: Fired exactly once, whatever drove the close — the close affordance, the auto-dismiss timer expiring, or an actionable commit. Never fired more than once per instance (the closed latch); the element is removed from the DOM immediately after.

slots: []                  # no [slot=x] composition — light-DOM children present at connect are ADOPTED (moved) into the message part, not slotted

parts:
  - name: message
    description: The control-created <span data-part="message"> that the host's light-DOM children (present at connect — typically message text set by a caller BEFORE append, e.g. UIToastRegionElement.show()) are adopted into ONCE, at connect. Children added to the host after connect are out of scope v1 (not adopted; no MutationObserver heal).
  - name: action
    description: An optional <ui-button data-part="action"> rendered ONLY when the action prop is non-empty at connect time (read once — a later action prop change does not retroactively add/remove this part). Its label is the action prop's text. Activating it emits select, then closes the toast.
  - name: close
    description: The ALWAYS-present icon-only <ui-button data-part="close" variant="ghost" icon-only>, containing a decorative <ui-icon glyph="x"> and carrying aria-label="Dismiss" (the icon-only-button idiom — the accessible name has nothing to read from textContent; `icon-only` opts into ui-button's square fifth structure, geometry.md). Pinned to the card's grid-column 3 explicitly (toast.css), so its optical inset from the card's right edge always matches the message's inset from the left edge, whether or not the action part is present (TKT-0014). Activating it closes the toast.

customStates: []           # no :state() hooks — the LLD ships no entrance/exit animation in v1 (a fade/slide-in is a named foreseen extension)

face:
  formAssociated: false    # NOT a FACE form control — a toast carries no value and participates in no form

aria:
  role: status              # set via ElementInternals IN THE CONSTRUCTOR (before insertion — SPEC-R15 AC2), not connected()
  roleSource: internals
  labelSource: none         # a toast has no accessible NAME — its role=status/alert live-region ANNOUNCES the adopted message text content, not a labelled name
  urgentState: internals.role toggles status↔alert — a scope-owned effect (connected()) sets 'alert' when the urgent prop is true, 'status' otherwise; re-runs on every urgent change
  focusPolicy: NEVER takes focus on show (document.activeElement is unchanged across a show()) — the ADR-0020 interruption-inversion prior art; the action/close affordances are reachable by normal Tab order while present, never via a programmatic focus move

keyboard:
  - note: No keyboard model of its own — the toast never takes focus on show. The optional action and the always-present close ui-button parts are reachable via normal Tab order (each carries its own tabbable-trait tabindex=0); no tabindex games, no autofocus (SPEC-R15 AC3).

geometry:
  sizeClass: pattern                                  # a fixed-width notification card — Container/surface geometry, not a control-height ramp
  inlineSize: var(--ui-toast-inline-size)              # = 20em, fixed (max-inline-size:100% floors small viewports) — the ui-menu panel's fixed-surface precedent, NOT a [size]/[scale] control ramp
  paddingInline: var(--ui-space-md)
  paddingBlock: var(--ui-space-sm)
  gap: var(--ui-space-sm)                              # message | action | close column gap
  radius: var(--ui-radius-base)                        # the shared fleet radius (ui-menu/ui-card precedent)
  note: No [size] attribute (SPEC-R19) — a notification card has no size axis; family-coherence A2b holds trivially (toast.css declares no [size] selector).

forcedColors: A forced-colors block keeps the card bordered in CanvasText once the box-shadow (an arbitrary-alpha rgb() literal, flattened away under WHCM) vanishes — the border alone carries the card's edge (the bar-chart fill lesson); the ui-button/ui-icon affordance children carry their own independent forced-colors treatment.
---

# ui-toast

`ui-toast` is the fleet's **first transient notification surface** — a self-expiring, non-interrupting
announcement card, region-hosted in the platform top layer via its sibling `ui-toast-region`. It
extends `UIElement` and is **not** form-associated. `ui-toast` is **deliberately not catalogued**
(ADR-0112 cl.6, the ADR-0087 `EXCLUSION_ALLOWLIST`'s first reasoned entry) — see "App-surface
consumption story" below.

```html
<ui-toast-region>
  <ui-toast>File uploaded.</ui-toast>
  <ui-toast urgent duration="0" action="Retry">Upload failed.</ui-toast>
</ui-toast-region>
```

Direct markup like the above works, but the sanctioned entry point is `ui-toast-region.show()` (see
`toast-region.md`) — it handles the announcement-correct ordering (message text set BEFORE append) a
hand-authored `<ui-toast>` must replicate by hand.

## App-surface consumption story

A toast is **app-surface chrome, not agent-emittable content** (ADR-0112 cl.6): a self-expiring message
inside an append-only feed would break the history-must-not-lie doctrine, and an agent-raised toast
would mutate page chrome outside the payload↔DOM traceability the A2UI renderer's charter guarantees.
`ui-toast`/`ui-toast-region` are consequently **not** in the default catalog — they are page/app-shell
primitives, mounted and driven imperatively (`region.show({ message, action })`), never something a
model emits directly.

## Props

- **`urgent`** (boolean, default `false`) — opts into `role="alert"` (assertive announcement) instead of
  the default `role="status"` (polite). Reserve this for failures that genuinely warrant interrupting
  the screen reader's current speech.
- **`duration`** (number, default `6000`) — milliseconds before auto-dismiss. `0`, a negative number, or
  a non-finite value (`NaN`/`Infinity`) means **never auto-dismiss**. Ignored entirely when `action` is
  non-empty (see below).
- **`action`** (string, default `''`) — non-empty renders an `<ui-button data-part="action">` labelled
  with this text. A non-empty `action` makes the toast **actionable**, which means it **never
  auto-dismisses** (WCAG 2.2.1, timing-adjustable) — the user (or the page) must dismiss it explicitly.

## Anatomy

At connect, any light-DOM children present on the host (typically message text) are **adopted** —
moved, not cloned — into a component-built `<span data-part="message">`. This is a **one-time** move:
children added to the host after connect are not adopted (out of scope v1). The affordance cluster is
appended alongside it: an `<ui-button data-part="action">` **only** when `action` is non-empty at
connect, and an icon-only `<ui-button data-part="close" icon-only>` (`<ui-icon glyph="x">`, `aria-label="Dismiss"`)
**always**. Both affordances are `ui-button` instances — native `<button>` is banned (fleet law) — and
are reachable in normal Tab order via `ui-button`'s own `tabbable` trait; no tabindex games, no
autofocus.

## Announcement + focus

`role="status"` is set via `ElementInternals` **in the constructor** — before the element is ever
inserted into the document — so a screen reader treats it as an established live region the instant its
content (the adopted message) becomes visible at append. Setting `urgent` flips this to `role="alert"`
(assertive) via a reactive effect. **The toast never takes focus on show** (`document.activeElement` is
unchanged across a `show()` call) — the ADR-0020 interruption-inversion prior art: a completion
notification must never steal keyboard focus from whatever the user is doing.

## Timing

Armed automatically on connect **iff** the toast is not actionable and `duration` is a positive finite
number. The countdown **pauses** while the pointer hovers the toast (`pointerenter`/`pointerleave`) OR
while focus is anywhere inside it (`focusin`/`focusout`, the reader/magnifier case) — both conditions
are independent; either one pauses. It resumes with the remaining time (not a fresh countdown) once
both conditions clear. A `focusout` whose `relatedTarget` is `null` (a window blur) is treated as
focus-left, resuming the timer — a countdown running in a background tab is the platform norm, and the
hover flag still pauses it independently if the pointer stays over the card.

## Events

- **`select`** — fired when the user activates the action affordance; the toast closes immediately
  after.
- **`close`** — fired exactly once per instance, whatever drove the close (the close affordance, timer
  expiry, or an actionable commit). The element removes itself from the DOM immediately after.

## Accessibility

- `role="status"`/`role="alert"` via `ElementInternals`, set pre-insertion (never a host attribute).
- No accessible NAME — the live region announces the adopted message **content**, not a labelled name.
- The close affordance's accessible name (`aria-label="Dismiss"`) is set directly on the `ui-button`
  child the toast owns — the icon-only-button idiom (an icon carries no readable text of its own).
- A `forced-colors` block keeps the card bordered in `CanvasText` once its box-shadow (an arbitrary-alpha
  colour, flattened under WHCM) vanishes.
