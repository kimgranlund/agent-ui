# Mint vs. compose — deciding when an aggregate-valued FACE field earns a new primitive

Decision record: ADR-0175 (the multi-select/association field intake). Read this at fork-sheet
step 6 (agent-ui-component-design's "decide what the change earns") whenever the candidate value is
an ARRAY or aggregate, not a scalar — a plain new-control-vs-compose call is already covered by
step 2's precedent sweep; this reference is for the narrower, recurring aggregate-value question.

## The bar: does the case need ONE bindable aggregate value?

ADR-0102's three-lane chooser (compose from shipped controls / widen an existing control / mint a
new one) still applies as the first pass. ADR-0175's refinement is the test that actually decides
the compose-vs-mint lane for anything array/aggregate-valued:

**A case needs minting when it must be read FROM a record, written TO one path in a
form/data-model, and round-tripped through `ui-form-provider.values()` (or an A2UI value mark) as
ONE keyed value.** A case tolerates composition when it never needs that — a filter/facet driving a
derived query has no single value to round-trip; page-side glue turning N control commits into one
`{key, values[]}` shape is an accepted, named residual there, not a defect (ADR-0175 Context, PRD-D3).

Concretely, before minting, check:

1. **Does `ui-form-provider.values()` need to see this as one array-typed entry**, not N
   duplicate-name entries it happens to also collect? `values()` keeps LAST-entry-wins on a
   duplicate name by design (`form-provider.md`) — there is no aggregation step anywhere in the
   provider, and there will not be: ADR-0050 already rejected making the provider itself
   form-associated (it would double-submit; the provider coordinates, it does not carry a value).
   A "teach the provider to aggregate" fix is not on the table — it's a closed door, not an
   undesigned one.
2. **Is the aggregate value read from an existing record on open** (a dataset's `accountIds`
   starts populated), not assembled fresh from user picks each time? Composition (checkbox group +
   page glue) can build a value; it cannot naturally seed one FROM a bound path the way a real
   `value` prop does.
3. **Does an A2UI catalog row need a `{prop: 'value', event: <commit>}` mark whose wire value is
   array-typed** so an agent producer can bind/commit it in one step? A composed vehicle has no
   single element to hang that mark on.

If the answer to (1)–(3) is genuinely no for every one of them, composition is still the right
default (KISS: don't mint what you can compose) — mint only when the aggregate-value bar above is
actually crossed, not preemptively.

## Minting is cheap when it is — check before treating "new primitive" as expensive

A mint decision often reads as heavyweight; verify the actual cost before deferring to composition
out of caution. `FormValue` (`dom/form.ts`) already includes `FormData` — a form-associated control
committing `internals.setFormValue(new FormData())` contributes multiple entries under one name with
**zero base-class widening**. The new control's interior need not be a from-scratch interaction
model: it can host an EXISTING disclosure mechanism (e.g. `ui-form-popover`'s trigger/live-apply
mechanics) around aggregate-shaped children, and simply be the one FACE-associated host that
collapses its children's commits into one `FormData`/array value. The missing piece in most of these
cases is a thin aggregation shell, not new interaction design — don't let "it's a new tag" read as
"it's a big build."

## The wire shape: the ORIGINAL single two-way slot, array-typed — not ADR-0161's multi-slot mechanism

**Ruling (ADR-0175 cl.2): an aggregate-valued field's catalog mark is the ordinary single-slot
`{prop: 'value', event: <commit>}`, where `value`'s wire type is array-typed** (e.g.
`DynamicStringList`). ADR-0161's multi-slot array-of-slots widening solves a DIFFERENT problem —
several DISTINCT props riding one commit surface (Calendar's `valueStart`/`valueEnd`, Table's
`selected`+`sort`+`page`) — and never restricted a single slot's own prop to a scalar runtime type
in the first place. `ValueSlot`'s shape (`{prop, event, readProp?, marshal?}`) and the input
controller's per-slot write don't constrain the bound prop's TYPE at all.

**Don't reach for ADR-0161 just because the value is a list.** `Table.selected` is the in-tree,
shipped precedent that an array-typed prop already rides the single-slot mark cleanly, zero marshal
step, today. Only reach for ADR-0161's multi-slot mechanism when the design genuinely needs a
SECOND, independently-committed prop alongside the aggregate value (e.g. an embedded search-query
prop with its own commit event) — that's a real but separate fork, decided by the control's own
anatomy, not assumed up front.

## Sequencing precedent: design-intake ADR now, SPEC/LLD later, never bundled

ADR-0163's `ui-table` interactive widening is the worked precedent for this sequencing: a design
intake ADR freezes the ARCHITECTURE (mint-vs-compose, the wire shape) without authoring the
component build itself — no `.md` descriptor, no `UIElement` subclass, no geometry row, no catalog
row lands in the intake. Follow the same shape: freeze mint-vs-compose and the wire mark here, leave
the primitive's geometry/base-class shape, its exact catalog `options` representation, and any
second-slot need as open forks for the SPEC/LLD that actually builds it.

## A structurally harder case: fence it out rather than bundling it in

When the aggregate-value case gestures at something bigger — ADR-0175's own example is
"association/relationship editing" (remote/paginated option search, inline create-in-place, a
distinct assigned-vs-available split) riding on top of what looks like the same multi-select gap —
**do not bundle the harder capability into the same mint decision.** Check whether the harder case
needs capabilities the fleet has nowhere (a data-fetching layer, in this repo's case, which the
fleet is deliberately zero-dependency about) — if so, mint the narrower primitive that closes the
aggregate-value bar, and fence the harder case out as its own future intake explicitly, naming what
it would still need. A "seen from another angle, not a second hole" framing is true only as a
necessary-prerequisite claim, never automatically a sufficiency claim — verify which one applies
before treating the narrower mint as having closed the bigger question too.
