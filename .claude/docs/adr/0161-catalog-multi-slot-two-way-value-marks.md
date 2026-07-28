# ADR-0161 — The catalog's two-way `value` mark widens to one-or-more slots (Calendar range + SliderMulti write-back)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-28 |
> | **Proposed by** | design-314-range-binding — the design pass GH #314's investigation escalated to ("either path is a SPEC/LLD-level decision"), on Kim's bug intake: the Hotel persona's booking form loses its date-range selection because range values bind one-way only. |
> | **Ratified by** | *(pending — never self-ratified)* |
> | **Repairs** | on ratification+build: `a2ui/src/catalog/{catalog.ts,types.ts}` (the `value` union + `validateComponent` legs) · `a2ui/src/renderer/input.ts` (the slot loop) · `a2ui/src/catalog/default/{factories.ts,catalog.json}` (Calendar + SliderMulti row edits) · their co-located tests (`catalog.test.ts`, `factories.test.ts`, `input.test.ts`) · realize the REV'd contract text in [`../spec/a2ui-catalog.spec.md`](../spec/a2ui-catalog.spec.md) §5.1/SPEC-R4/rows + [`../lld/a2ui-renderer.lld.md`](../lld/a2ui-renderer.lld.md) §6 + [`../lld/a2ui-catalog.lld.md`](../lld/a2ui-catalog.lld.md) §factories · reciprocal `Extended by` back-link on ADR-0093 · the GH #314 build task. Docs-only NOW: forward-pointer REV notes at the three limitation call-sites (catalog SPEC rows + the two LLDs). |
> | **Supersedes / Superseded by** | None. **Extends ADR-0019** (renderer LLD-C8 two-way binding — via its own discovered-reality guard: `input.ts`'s header rules "if a future control's commit/value shape cannot be expressed by `{prop,event}`, that is a catalog SPEC gap — repair `a2ui-catalog` and re-derive, do not improvise here"; this is that repair) and **ADR-0093** (calendar range mode — its clause 7 named exactly this follow-up: "range values bind one-way until the catalog schema grows a second two-way slot"). Relates ADR-0087 (the SliderMulti Wave-B row carrying the same documented seam limitation) · GH #314. |

## Context

The catalog schema permits **exactly one** two-way slot per component: `ComponentDef.value` /
`WidgetFactory.value` is a single `{ prop, event }` mark (`catalog.ts:26`, `types.ts:30`), and the
renderer's generic input controller installs one commit listener per widget from it
(`input.ts:71-99`, renderer LLD-C8, runtime SPEC-R7). Two shipped controls commit **two** values and
therefore cannot write back at all under that shape:

- **`Calendar` in `mode="range"`** (ADR-0093): the live pair is `valueStart`/`valueEnd`; `value`
  is inert by the one-live-value-surface rule (clause 1). The row's one mark stays
  `value:{prop:'value',event:'change'}`, so on range completion the listener fires (`change` is
  emitted, `calendar.ts:1041`) but reads the inert `value` — still `''` — and `surface.data`
  never receives the pair. GH #314's trace: the Hotel persona's `hotel-booking-form` mini-skill
  (`site/pages/agent-admin-libraries.ts:83-90`) teaches exactly the binding the catalog schema
  advertises (`valueStart`/`valueEnd` are `bindable: true`), the user picks a range, the
  confirmation card and the submit snapshot (`action.ts`, `surface.data.peek()`) read empty
  check-in/check-out. A user-facing dead-end in a flagship flow.
- **`SliderMulti`** (ADR-0087 Wave B): `valueLo`/`valueHi`, same shape — the row carries **no**
  `value` mark at all, documented as "the ADR-0019 seam permits only ONE `value:{prop,event}`
  mark per component" (`factories.ts:497-505`; the catalog SPEC's own row states it as "only ONE
  two-way slot per component").

Both call-sites, plus ADR-0093 clause 7 and the catalog SPEC's own rows, all label this the same
way: a known schema limitation whose fix is "the catalog schema grows a second two-way slot" —
future work. GH #314 supplies the forcing evidence that the future is now.

`bindable` on a `PropDef` is **read-direction only** (data model → control, `widget.ts:184-211`);
the write direction is exclusively the `value` mark. The payload-side shared validator
(`conformance.ts`) never reads the `value` mark — verified by inspection — so the write-direction
contract lives in exactly three code homes: the catalog document validator
(`catalog.ts:189-193`), the factory type (`types.ts`), and the input controller (`input.ts`).

## Decision

The `value` mark becomes **one-or-more slots**: a component whose commit gesture finalizes
several props declares one slot per prop. The single-object form stays legal, unchanged, forever.

1. **Schema widening.** `ComponentDef.value` and `WidgetFactory.value` widen from
   `{ prop: string; event: string }` to `ValueSlot | readonly ValueSlot[]` (where
   `ValueSlot = { prop: string; event: string }`). In `catalog.json` the field accepts an object
   (today's form, byte-unchanged everywhere it appears) or a non-empty array of such objects. One
   exported normalizer (`valueSlots(mark) → readonly ValueSlot[]`, home: `catalog/types.ts` or
   sibling — build's call) is the single reader both the validator and the controller share.
2. **Validation (document-side only).** `validateComponent` (`catalog.ts:189-193`) accepts the
   union: an array must be non-empty, every entry `{ prop: string; event: string }`, and the
   `prop` names **distinct** across slots (two slots writing back the same DOM prop is ambiguous
   — reject at catalog load with the existing `bad(...)` diagnostic). Events MAY repeat (the
   Calendar pair commits on one `change`). **Payload-side parity is untouched by construction:**
   the shared validator (`conformance.ts`, catalog SPEC-R7 / corpus SPEC-N1 / runtime SPEC-N6) never
   consumes the `value` mark — verified — so renderer and corpus admission stay parity-identical
   with zero edits.
3. **Controller semantics (`installInputBinding`, renderer LLD-C8).** Normalize the mark to
   slots, then apply today's per-mark rules **per slot**: a slot installs a listener only when
   the node's `slot.prop` is a `{path}` binding (per-slot opt-in — the controller still never
   installs a listener it cannot honour); each listener writes its own `el[slot.prop]` to its own
   resolved path through the structural-sharing `setPointer` (per-path waking, SPEC-N2,
   unchanged). Several slots on one event mean several listeners firing on that event, writes
   landing in slot-declaration order, all synchronous — so a subsequent action's
   `dataModel` snapshot (`action.ts`) sees every slot's committed value, exactly as today's
   single write does. Teardown discipline is untouched: every listener registers on the same
   `ac.signal` (surface or per-item). A factory carrying the single-object form takes a
   one-element loop — behaviorally byte-equivalent to today.
4. **Default-catalog row edits (the two known multi-value controls).**
   - `Calendar`: `value` → `[{prop:'value',event:'change'}, {prop:'valueStart',event:'change'},
     {prop:'valueEnd',event:'change'}]` (row + `calendarFactory`). ADR-0093's mode contract is
     untouched and is what makes this safe: in `mode="single"` a payload binds `value` (one
     listener, today's behavior); in `mode="range"` it binds `valueStart`/`valueEnd` — `change`
     fires **only on completion** (clause 2), with both props already final
     (`#commitRangeDate`, `calendar.ts:1036-1041`), so the pair lands atomically-in-effect and a
     half-open range never writes. An off-mode slot the payload didn't bind installs nothing
     (clause 3's opt-in); binding an off-mode prop writes that inert prop's constant — the same
     author error it is today, no worse.
   - `SliderMulti`: gains `value: [{prop:'valueLo',event:'change'}, {prop:'valueHi',event:'change'}]`
     (row + factory) — same mechanism, closing the sibling limitation in the same wave;
     `valueLo`/`valueHi` are verified real 1:1 reflecting accessor props committing on `change`
     (`factories.ts:497-505`, its own row's verification note).
   - **No `ui-calendar`/`ui-slider-multi` component change at all** — the components already emit
     the right events with the right props; only the catalog's write-direction wiring was missing.
5. **Teaching + producer surfaces: no change needed.** The system prompt's `catalogInventory`
   (`system-prompt.ts`) renders prop types, not value marks — unchanged. The Hotel persona's
   `hotel-booking-form` mini-skill already teaches "a confirmation Card bound to the SAME
   data-model values the form wrote" — text unchanged; this ADR makes it true. The GH #314 build
   task re-verifies the flow end-to-end against the live persona.

## Consequences

- **The one-mark-per-component LAW retires as a schema constraint; the rows that cited it keep
  their outcomes.** `Select` and `ComboBox` deliberately do not bind `open` — their own stated
  reasons (platform light-dismiss desync; the overlay-family shape) stand on their own and those
  rows are not edited. The law's retirement removes a justification, not a decision.
- **Multiple synchronous writes per commit.** A two-slot commit runs `setPointer` twice — two
  structural-sharing copies of the path spine, two waking passes. Bounded by slot count
  (2–3 in practice), synchronous, and only on user commit gestures; accepted without a batching
  mechanism (premature — revisit only if a control with many slots appears).
- **A payload may bind a subset of slots.** Per-slot opt-in means an agent can bind `valueEnd`
  and not `valueStart` — legal, writes only what's bound. The teaching layer (mini-skills,
  exemplars) is what steers models to bind the pair; the schema does not enforce pairing. Same
  posture as today's optional binding of any single mark.
- **Project catalogs (two-tier, SPEC-R6) get the widened shape for free** — `register` validates
  through the same `validateComponent`; an existing project catalog's object form parses
  identically.
- **Stale → re-verify on build:** the REV'd contract text in `a2ui-catalog.spec.md` §5.1 /
  SPEC-R4 / the SliderMulti + Calendar rows · `a2ui-renderer.lld.md` §6 (LLD-C8) ·
  `a2ui-catalog.lld.md` factories note · `factories.ts` doc comments (the two limitation
  paragraphs) · ADR-0093 clause 7's reciprocal back-link.

## Acceptance

Regression: every existing suite passes **unmodified** — in particular the single-mark input
legs (TextField/Tabs/Modal/Slider write-back) and the whole calendar suite. Catalog validation
(`catalog.test.ts`): object form accepted byte-identically; non-empty array accepted; empty
array rejected; non-`{prop,event}` entry rejected; duplicate slot `prop` rejected. Controller
(jsdom): a two-slot factory with both props bound installs two listeners and one commit event
writes both paths; a bound/unbound slot mix installs only the bound slot's listener; item-scoped
(list) and teardown (`ac.abort`) behavior identical per slot. End-to-end (the GH #314 shape): a
`Calendar` `mode="range"` payload binding `valueStart`/`valueEnd` — after a two-pick range
completion `surface.data` holds the normalized pair, and a subsequent submit action's
`dataModel` snapshot carries both; the first pick alone writes nothing. `SliderMulti`: a
drag-commit writes both `valueLo`/`valueHi` paths.

## Alternatives considered

- **(b) Composite range value — `value` becomes `{start,end}` (or an ISO `"start/end"` string)
  in range mode, one slot suffices.** Rejected. ADR-0093's Alternatives already rejected the
  delimited-interval single value for this control ("not independently bindable … needs a parse
  step in every consumer, and diverges from the fleet's `valueLo`/`valueHi` precedent") — this
  fork would overturn a ratified rejection on no new evidence. It also reopens ADR-0093 clauses
  1–2 (the one-live-value-surface rule and the form seams), forks `ui-calendar`'s public
  contract (a components-package change: props, descriptor, form semantics, tests — ADR
  territory of its own), forces the persona to bind one path and destructure halves, and still
  leaves `SliderMulti` broken. Larger real blast radius than the schema widening, hidden inside
  one component.
- **(c) A write direction on `bindable`** — e.g. `bindable: 'two-way'` per `PropDef` plus a
  per-prop commit event. Rejected: it scatters the input-widget identity across PropDefs (the
  `value` mark is today the single declaration that a component is an input, SPEC-R4 AC1),
  changes every row's `bindable` vocabulary, and still requires the same validator + controller
  work — strictly more contract surface than (a) for the same outcome.
- **(d) A per-component special case in the input controller** (read `valueStart`/`valueEnd`
  when the tag is `ui-calendar`). Rejected by `input.ts`'s own load-bearing invariant ("every
  branch is driven by the factory mark + the node's binding, never by a component name") and its
  header's explicit instruction to repair the catalog SPEC instead of improvising.
- **(e) A second field (`values?: ValueSlot[]`) beside `value`.** Rejected: two spellings of one
  concept plus a precedence rule; the union on the existing field keeps one home and reads as
  what it is.
