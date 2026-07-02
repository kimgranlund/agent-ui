---
# form-provider.md frontmatter — the attributes-as-API descriptor for ui-form-provider (ADR-0004 / ADR-0050).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# ui-form-provider takes NO configuration — `attributes: []` is the deliberate, verified-parseable empty
# sequence (component-descriptor.ts: the inline `[]` branch sets an empty `sequences` entry, which satisfies
# the required-sequence-shape check with zero items to validate — the LLD-C7 flag this slice was asked to
# confirm). Field set per .claude/docs/plan.md §10 / ADR-0004; the aggregation/coordination layer over
# UIFormElement descendants per ADR-0050 / .claude/docs/llds/field-form-provider.lld.md LLD-C7/C8.
tag: ui-form-provider
tier: container          # geometry size-class (comment: pure coordination, no geometry — no control height, no surface paint)
extends: UIElement       # NOT UIFormElement — the provider carries no value/validity of its own; wrapping it formAssociated would double-submit (ADR-0050 "alternatives considered"). NOT UIContainerElement either — no surface paint.
# marginal: ui-form-provider adds 794 B gz (~4029 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken — it + the traits/form-registry.ts controller it invokes). The family total (21599 B gz) stays within the 22528 B gz budget (ADR-0049) — 929 B headroom left after this wave (form-provider + ui-field + the dom/form.ts protocol growth)

attributes: []           # a coordination element takes no configuration (LLD-C7); form-provider.ts declares `static props = {} satisfies PropsSchema` — the EMPTY schema, present for the fleet convention + the descriptor trip-wire's empty-bijection (the s10 finding)

properties:              # the public IDL (LLD-C7) — with no attributes, this is the ENTIRE public surface beyond the one event
  - name: controls
    description: Getter. The live registered UIFormElement members, in registration (≈ document) order — a reactive read projecting the registry's `members` signal. Empty array while disconnected.
  - name: entries
    description: Method — the submission entries as [name, value] pairs (native FormData parity — name is non-empty, not effectiveDisabled(), value() is non-null; duplicate names PRESERVED). Empty array while disconnected.
  - name: values
    description: Method — a keyed convenience view of entries() — LAST entry wins on a duplicate name (documented, not corrected). Empty object while disconnected.
  - name: invalid
    description: Method — the members whose MERGED validity verdict is invalid (unnamed controls INCLUDED — validation is name-independent; effectiveDisabled() members EXCLUDED — native parity, disabled is barred from constraint validation). Empty array while disconnected.
  - name: valid
    description: Method — invalid().length === 0. Vacuously true while disconnected.
  - name: submit
    description: Method — see the Protocol section below (first-invalid reportValidity, or emit the change aggregate).
  - name: reset
    description: Method — see the Protocol section below (native <form> composition; both reset paths converge on ui-form-reset).

events:
  - name: change
    detail: '{ entries: readonly (readonly [string, FormValue])[]; values: Readonly<Record<string, FormValue>> }'
    description: Fired by submit() on a valid aggregate — the FormSubmitDetail shape (same entries()/values() views). Disambiguation (the closed house event vocab has no `submit`; a provider-level submit IS a commit semantically) — a MEMBER control's own change event bubbles THROUGH the provider unchanged, with detail null; the provider's OWN change carries this typed aggregate and event.target === the provider. Never fired on an invalid submit() — reportValidity() runs instead, no event.

slots:
  - name: default
    optional: false
    description: The coordinated subtree — any UIFormElement descendant (direct, or nested inside a ui-field / plain wrapper) registers with this provider at connect via the ADR-0050 ui-form-connect protocol event. Non-form children lay out normally and are ignored for aggregation.

parts: []                 # light-DOM coordination container — no control-owned [data-part] nodes, no visual surface

customStates: []           # no :state() hooks — the provider has no interaction states of its own

face:
  formAssociated: false    # the provider AGGREGATES other controls' values/validity — it contributes nothing of its own to a form and is NOT itself form-associated (ADR-0050 "alternatives considered": formAssociated here would double-submit)

aria:
  role: none               # pure coordination — no accessible surface, no role, no aria-* attribute on the host
  roleSource: none
  labelSource: none

keyboard: []               # no keyboard contract of its own — the coordinated descendants (fields, controls) own their own keyboard models

geometry:
  sizeClass: container      # Container/layout band — no control height, no --ui-space opinion of its own
  display: block            # the host's only CSS rule (an unstyled custom element defaults to inline, which would lay slotted block-level descendants out inline against it)
  note: form-provider.css declares NO --ui-form-provider-* token chain (LLD-C8 — a pure coordination element has no colour/geometry/spacing voice of its own); the deliberate absence is documented in the sheet, not invented as an empty block.

forcedColors: No forced-colors rules needed — the provider paints nothing; its coordinated descendants carry their own WHCM treatment.
---

# ui-form-provider

`ui-form-provider` is the fleet's first **context/provider primitive** — a pure coordination layer over
`UIFormElement` descendants (ADR-0050). It takes no configuration (`attributes: []`, no `static props`):
discovery, aggregation, submit, and reset are entirely behavioral, driven by the descendants it coordinates.

```html
<ui-form-provider>
  <ui-field label="Name"><ui-text-field name="name" required></ui-text-field></ui-field>
  <ui-field label="Email"><ui-text-field name="email" type="email"></ui-text-field></ui-field>
  <ui-checkbox name="subscribe">Subscribe</ui-checkbox>
</ui-form-provider>
```

## Protocol

**`ui-form-connect` (ADR-0050 plumbing — not a consumer event).** Every `UIFormElement` dispatches this
`ui-`-prefixed, composed, bubbling, NOT-cancelable event at the END of its own `connectedCallback`,
deliberately OUTSIDE the public component-event vocab (`change · input · select · open · close · toggle`).
The provider listens for it on itself and adds the control to its reactive registry
(`traits/form-registry.ts`). Discovery rides this event alone — no `MutationObserver` — so a late-added
control registers by construction: its own connect dispatch fires the moment it connects.

**Nearest-provider nesting.** The provider calls `stopPropagation()` on every accepted registration, so a
control nested under two providers registers with the NEAREST one only; the outer provider never sees it. A
provider that is not an ancestor of a control sees nothing (context flows down the tree, never sideways).

**Teardown-by-abort.** Each `ui-form-connect` detail carries a connection-scoped `AbortSignal` — a
disconnected control cannot dispatch a second event, so the registry subscribes to the handle's `abort`
instead. A single member's disconnect removes only its entry; the provider's OWN disconnect aborts the host
signal every per-member listener rides, tearing all of them down at once. Zero residue either way.

**The upgrade catch-up.** Custom-element UPGRADE follows *define* order, not tree order — pre-existing DOM
can upgrade a control before its provider, and that control's one connect dispatch lands in the void (no
listener yet). The complement: the provider runs a ONE-SHOT catch-up scan in its own `connected()`, AFTER its
registry listener is live — `querySelectorAll('*')` filtered to `instanceof UIFormElement`, calling the
public `announceFormConnect()` on each. This is idempotent both ways: an already-registered control's
re-announce is a no-op (the registry's dup guard), and a still-un-upgraded control is skipped by the
`instanceof` filter — it covers itself with its own dispatch at its own upgrade.

**`ui-form-reset`.** Both reset paths below end by dispatching this protocol event (bubbling, no detail — the
target IS the resetting control). **RESERVED** — zero fleet consumers today (`ui-field` re-suppresses via its
tracker's signal write, not this event); activation trigger = the first coordination consumer outside the
field family (A2UI's form surface is the named candidate) — the ADR-0031 reserved-arm precedent, per
ADR-0051 cl.4.

## Aggregation

`controls`, `entries()`, `values()`, `invalid()`, and `valid()` are reactive projections of the registry's
`members` signal, so an effect reading any one of them re-runs exactly when a member's value or validity
changes (fine-grained waking, no polling). `entries()` follows native `FormData` parity — unnamed controls
(`name === ''`) and `effectiveDisabled()` members are excluded, duplicate names preserved; `values()` is the
keyed view, last entry wins on a duplicate name. `invalid()` includes unnamed controls (validation is
name-independent) but excludes `effectiveDisabled()` members (native parity: disabled is barred from
constraint validation). All five read empty / vacuously-true once the provider itself disconnects.

## `submit()`

If any member is invalid, `submit()` calls `reportValidity()` on the FIRST invalid member in registration
order (native "focus the first invalid control" parity — the UA focuses/announces it) and returns `false`;
**no event fires**. Otherwise it emits `change` with the aggregate `{ entries: entries(), values: values() }`
and returns `true`.

**Event disambiguation** (the closed house vocab has no `submit`; a provider-level submit IS a commit
semantically, so it rides `change`): a MEMBER control's own `change` bubbles THROUGH the provider unchanged
— its `detail` stays `null`. The provider's OWN `change` carries the aggregate detail, and
`event.target === ` the provider — a listener disambiguates the two by checking `event.target`, never by
shape-sniffing `detail`.

## `reset()` — native `<form>` composition

The provider never creates or replaces a native `<form>`; native submission still rides the platform (FACE
`setFormValue`/`setValidity`). `reset()` partitions its members by their public `.form`: for each DISTINCT
non-null owning `<form>` it calls that form's `reset()` **once** (the platform then walks its own FACE
members' `formResetCallback`s itself — resetting per-member here would double-reset); form-less members get
`formResetCallback()` called on them directly (the same public platform callback).

**Shared-form blast radius:** a `form.reset()` resets ALL of that form's controls, including any NOT
registered with this provider — native semantics (reset is form-scoped, not provider-scoped). This is
documented here rather than "corrected" — narrowing it would fork native `<form>` behavior.

## Accessibility

The provider carries no role and no `aria-*` attribute — it is pure coordination, not an accessible
container. Its descendants (fields, controls) own their own accessible names and roles.
