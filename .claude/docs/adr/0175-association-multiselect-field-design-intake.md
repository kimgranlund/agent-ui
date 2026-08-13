# ADR-0175 — M-F design intake: a multi-select FIELD primitive is minted for the record-editing/binding case (PRD-D3's composed facet vehicle stands, unreopened, for the filter case); its wire value rides the ORIGINAL single two-way slot with an array-typed prop — ADR-0161's multi-slot mechanism is not what this needs; to-many relationship/association editing is fenced OUT as a strictly harder, separately-scoped problem the primitive only becomes one building block of

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-06
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-06 |
> | **Proposed by** | planner (design seat — the GH [#498](https://github.com/kimgranlund/agent-ui/issues/498) intake, filed to convert the fleet's most-cited recurring gap — four independent citations across two roadmap inventory waves — into a tracked, re-discoverable design decision, per `inv-5-saas.md` §4 candidate #1's own recommendation) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-06, via the [`ratify ADR-0175` utterance](https://github.com/kimgranlund/agent-ui/pull/505#issuecomment-5208651715) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | **On ratification:** `roadmap.md` §3's M-F line (`roadmap.md:158-159`, currently "the second SaaS composition + the association/multi-select intake") restates to the three frozen answers below, not the open-intake framing it carries today. **On ratification+build (M-F's own future SPEC/LLD, not authored here):** a new `packages/agent-ui/components/src/controls/<multi-select-field>/` folder (own `.md` descriptor, own FACE form-participation tests, own geometry row — cl.1) · the default catalog (`a2ui/src/catalog/default/{catalog.json,factories.ts}`) gains a new row for it · `a2ui/src/catalog/a2ui-basic/` drains ADR-0169's E6 exclusion (`ChoicePicker.variant` enum widens past `['mutuallyExclusive']`, a NEW factory arm — cl.2's own text names this as the literal follow-through E6 already anticipated) · `agent-ui-composition-patterns` SKILL.md gains a row once a real recipe exists. |
> | **Supersedes / Superseded by** | None. **Relates** [ADR-0161](./0161-catalog-multi-slot-two-way-value-marks.md) (the multi-slot mechanism this ADR rules is NOT what a multi-select field's own array value needs — cl.2 distinguishes precisely) · [ADR-0163](./0163-ui-table-interactive-widening.md) cl.9 (the `Table.selected` array-typed single slot — the in-tree precedent cl.2 argues from) · [ADR-0169](./0169-a2ui-basic-catalog-upstream-interop.md) cl.9b row 16 / Exclusion E6 (`ChoicePicker.variant: multipleSelection`, gate-excluded v1, its own text naming "a multi-select control or commit shape — its own intake" — this ADR is that intake) · [ADR-0050](./0050-form-provider-context-registration.md) (its own "make the provider form-associated" rejection — the reason a compose-side "teach `ui-form-provider` to aggregate" third option is blocked, cl.1) · [ADR-0019](./0019-pull-renderer-lld-c8-two-way-binding.md) (the bindable state-prop + commit-event pattern the minted primitive's single slot reuses unchanged) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (the CSS-less-consumer law PRD-D3's residual is argued against, cl.1) · **Relates** `saas-data-workbench.prd.md` §4/§5/§9 (PRD-D3, the composed facet vehicle; the "Checked and found NOT to be gaps" association paragraph this ADR tests and partially overturns) · **Resolves** GH [#498](https://github.com/kimgranlund/agent-ui/issues/498) (the design-intake box) — filing does not commit to the build; M-F's own SPEC/LLD is the next artifact once ratified. |

## Context

**The gap, cited four times across two inventory waves, never independently filed until now.**
GH #498 (verbatim): *"The FACE control suite has no multi-select field: every shipped picker binds
one scalar value. This is the fourth independent citation of the same hole across two roadmap
inventory waves."* The citations, verified in-tree:

- `inv-6-saas.md` (2026-07-28) §1d: *"No association/relationship UI (e.g., 'assign dataset to
  account', multi-select linking) exists yet."* §2d: *"no association/multi-select-linking
  pattern."*
- `saas-data-workbench.prd.md` §5, "Checked and found NOT to be gaps": *"the FACE control suite
  genuinely has no multi-select field: every shipped picker binds one scalar value. This is the
  same missing primitive as PRD-D3's facet gap, seen from the edit side rather than the filter
  side — not a second hole."* §4: *"No new multi-select control. The facet affordance composes
  from shipped controls (PRD-D3)... a new primitive earns its own ADR, not a rider on a demo."*
  §9: *"If that fence is ever overturned and a multi-select primitive is minted, **that** earns
  its own intake and its own ADR; it does not ride this wave."*
- `inv-5-saas.md` (2026-08-05) §3.1: restates all of the above as *"the recurring, twice-fenced
  gap"* and §4 candidate #1: *"File the association/multi-select re-entry intake... the single
  most-cited recurring gap... Filing it does not commit to building it."*

`roadmap.md` §3 (`roadmap.md:158-159`) already names the next arc's third leg as **M-F — "the
second SaaS composition + the association/multi-select intake"** — this ADR is that intake, filed
per GH #498 and `inv-5-saas.md` §4 candidate #1's own recommendation.

**Fact 1 — every shipped picker really is scalar, verified against three descriptors, not
asserted.** `select.md:12` — `extends: UIFormElement`, `formValue() = selected key` (one string).
`checkbox.md:18-20` — `value: string` submits once, only when `checked`; there is no
`ui-checkbox-group` element, only individual checkboxes. `combo-box.md:102` — `value = the
committed option key (or free text)`. No shipped control's `value` prop is ever array-typed.

**Fact 2 — a plain composition (N checkboxes sharing one `name`) already gets native FormData
multiplicity for free, but NOT one bindable aggregate value.** `ui-form-provider`'s own descriptor
(`form-provider.md:20-22`) states `entries()` *"follows native FormData parity — duplicate names
PRESERVED,"* which is genuinely how N checkboxes sharing a `name` submit today, with zero new
mechanism. But `values()` — the keyed, single-value-per-name view a consumer actually binds
against — is documented as *"LAST entry wins on a duplicate name (documented, not corrected)"*
(`form-provider.md:21-22`, restated at `:116`). There is no aggregation step anywhere in the
provider that turns N same-named entries into one array. This is the precise mechanical shape of
PRD-D3's own residual: *"the aggregation from N checkbox commits to one `{key,values[]}` entry is
still page-side glue"* (`saas-data-workbench.prd.md:161`).

**Fact 3 — that residual is not a gap the provider could plausibly grow into fixing.** ADR-0050's
own Alternatives considered already rejected making the provider itself form-associated: *"the
provider carries no form value (it aggregates others'); `formAssociated` would double-submit"*
(`0050:85-87`). A "teach `ui-form-provider` to collapse duplicate-name entries into one array
value" fix would be exactly that rejected shape — the provider becoming a value-carrying
participant, not a pure coordinator. This option is closed by a standing ruling, not merely
undesigned.

**Fact 4 — a real primitive's form participation is mechanically cheap, verified against the base
class.** `dom/form.ts:62` — `export type FormValue = File | string | FormData | null`. A
form-associated control committing `internals.setFormValue(new FormData())` already contributes
**multiple entries under one name** — the platform mechanism `<select multiple>` and native
checkbox groups both use — and the fleet's own `UIFormElement` base already accepts it with zero
widening (`formValue()`'s return type already includes `FormData`, per the type's own doc comment:
*"a subclass's typed value coerced into this shape... a `File`/`FormData` for richer controls"*,
`form.ts:58-60`). Minting a new form-associated control that carries an aggregate value is not a
base-class change; it is an ordinary new leaf.

**Fact 5 — the widened `Table`'s `selected` prop is already an in-tree precedent for an
array-typed value riding the ORIGINAL, single-slot two-way mark — not ADR-0161's multi-slot
mechanism.** ADR-0163 cl.9 (`0163:170-183`): the `Table` row's catalog mark is
`[{prop:'selected',event:'select'}, {prop:'sort',event:'change'}, {prop:'page',event:'change'}]`
— **three DISTINCT props** riding ADR-0161's array-of-slots widening, because Table's one commit
surface juggles three independent concerns (which rows, which sort, which page). But `selected`
itself is a **single slot** whose bound prop is array-typed (a set of row keys) — nothing about
`ValueSlot`'s shape (`catalog.ts:48-53`: `{prop: string; event: string; readProp?; marshal?}`) or
the input controller's per-slot write (`input.ts:104-108`: `setPointer(..., committed)` where
`committed` is whatever `slot.readProp ?? slot.prop` reads off the element) constrains the RUNTIME
TYPE of that prop to a scalar. ADR-0161 solved "several distinct props commit together" (Calendar's
`valueStart`/`valueEnd`, SliderMulti's `valueLo`/`valueHi`); it never restricted array-typed props
in the first place, because nothing in the pre-ADR-0161 single-slot mark ever did either.

**Fact 6 — the upstream A2UI wire protocol already defines the exact multi-select shape this ADR
would otherwise have to invent, and the in-tree record already named this ADR by name.** ADR-0169
(accepted) cl.9b row 16 pins upstream Basic's `ChoicePicker` schema: with `variant:
'mutuallyExclusive'` it maps to `ui-select`, value mark `{prop:'value', event:'select',
marshal:'singletonStringList'}` — the wire `value` is a **`DynamicStringList`** even in the
single-select case, and the shipped control's single string is marshalled into a one-element array
on commit (`0169:362`). The **`multipleSelection` variant is gate-excluded v1** (Exclusion E6,
`0169:486`, verbatim): *"No honest existing-control mapping for a multi-select commit (`ui-select`/
`ui-combo-box` are single-value; M-B excludes new components)... GATE-ENCODED by declaring the
`variant` enum as `['mutuallyExclusive']` only... an upstream payload declaring `multipleSelection`
fails the enum conformance check — recorded, loud, never wrong-rendered."* Its own "what would
close it" column: *"a multi-select control or commit shape — its own intake; draining E6 = widening
the declared enum + the factory."* This ADR is that intake. The wire shape is therefore not open —
it is `value: DynamicStringList` (an array of strings), already pinned by the upstream schema
ADR-0169 already ingested.

**Fact 7 — no shipped or planned control does remote/async search over a large option set with
create-in-place, at any cardinality.** `combo-box.md` (`extends: UIFormElement`,
`value = the committed option key (or free text)`) is the fleet's nearest "search a list" control
and is single-value, no create affordance, no "already-associated vs. available" distinction.
Nothing in the composition inventory (`saas-data-workbench.prd.md` §5) or either grounding
inventory names a control or pattern for paginated/remote option loading, inline record creation,
or a distinct associated-set display — the workbench's own record-edit flow (`ui-master-detail`,
`ui-modal`, `mountEntryList`) edits ONE record's own fields, never a relationship BETWEEN two
record types.

## Decision

### 1 · Mint vs. compose

**Ruling: a multi-select FIELD primitive — one FACE, form-associated control carrying one
array-typed bindable value — is minted for the record-editing/binding case. PRD-D3's composed
vehicle (`ui-form-popover` + a checkbox group, page-side aggregation) stands, unreopened, as the
ratified answer for the FILTER/facet case.** These are not the same question reopened twice; they
have different acceptance bars, and Facts 2–3 show composition structurally cannot meet the
edit-side bar.

**Why the filter case tolerates composition and the edit case does not.** PRD-D3's facet vehicle
never needed a single bindable aggregate value — a filter's job is to drive `Table.filter`, and the
page-side glue that turns N checkbox commits into one `{key, values[]}` entry is explicitly named,
accepted, and carried as a residual (`saas-data-workbench.prd.md:161`), not a defect. A
record-edit/association FIELD is different in kind: it needs to be **read from** a record (a
dataset's `accountIds` starts populated), **written to** one path in a form/data-model, and
**round-tripped** through `ui-form-provider.values()` and an A2UI value mark — exactly the three
things Fact 2 shows composition cannot do (duplicate-name entries, not one keyed value) and Fact 3
shows cannot be retrofitted onto the provider (ADR-0050's own rejection). A control whose entire
job is "hold and commit one to-many value" is what closes that gap; nothing already shipped does.

**Why minting is architecturally cheap despite being a new primitive.** Fact 4 shows the hard part
— an aggregate form value — is already a zero-cost base-class capability
(`FormValue` already includes `FormData`). The new control's INTERNALS need not be built from raw
DOM: it can host `ui-form-popover`'s exact disclosure/trigger/live-apply mechanics (or an inline
listbox — an LLD-level choice, Open fork OF1) around a checkbox-shaped child set, and simply be the
one FACE-associated HOST that aggregates its children's commits into one `FormData`/array value and
publishes it through `formValue()` — the missing piece is a thin aggregation shell, not a new
interaction model. This is a genuine "mint," following the same design-intake → build sequencing
this repo already used for `ui-table`'s own widening (ADR-0163) — a new control ADR-numbered at
build time, its own geometry row, its own `.md` descriptor, its own FACE form-participation tests —
not a rider on this intake.

**Why "widen `ui-select` in place with a `multiple` attribute" is rejected.** `ui-select.md:12`'s
`formValue() = selected key` is a single string by construction, threaded through its overlay
controller, its `open`/`value` two-way mark, and its trigger-label rendering (the selected item's
own text). Native `<select multiple>` changes its submission AND its rendering model
simultaneously (a listbox surface, not a dropdown-with-one-visible-value); forcing that fork onto
`ui-select`'s existing single-value contract would either break the scalar case's byte-identity
(the same discipline ADR-0163 cl.10 held for `ui-table`) or require a parallel code path inside one
control that is really two controls wearing one tag. A new tag is the honest boundary, not a widened
attribute.

### 2 · Wire/catalog shape

**Ruling: the minted primitive's value mark is the ORIGINAL single-slot two-way mark —
`{prop: 'value', event: <commit>}` — where `value`'s wire type is an array of strings
(`DynamicStringList`, matching Fact 6's upstream pin exactly). ADR-0161's multi-slot array-of-slots
mechanism is not consumed by this primitive at all**, unless a later LLD decides the control also
needs a second, genuinely distinct committed prop alongside its array value (e.g., an embedded
search-query prop with its own commit event) — a real possibility (Open fork OF2), but not
something this intake invents or requires.

**This corrects the ticket's own framing, precisely.** GH #498's acceptance criterion asked
whether the wire shape is *"a multi-value value mark per ADR-0161's array-mark precedent, or
something else."* Neither, exactly: ADR-0161 never restricted a single slot's prop to a scalar
runtime type — nothing in `ValueSlot`'s shape or the input controller's per-slot write does that
(Fact 5) — so the "array value" question was never actually gated behind ADR-0161's widening.
ADR-0161's real, distinct contribution (several DISTINCT props riding one row, Calendar's
`valueStart`/`valueEnd`, Table's `selected`+`sort`+`page`) answers a different problem than "one
prop, array-typed." `Table.selected` already proves the single-slot/array-typed-prop shape works
end-to-end, in a shipped, tested control (ADR-0163 cl.9/cl.10), zero marshal step needed — a
minted multi-select field's own `value` prop, if authored as `string[]` from the start, needs no
`marshal` transform either (unlike `ChoicePicker`'s `singletonStringList`, which exists ONLY
because `ui-select`'s DOM value is a scalar being forced to match a list-shaped wire contract — a
mismatch a purpose-built multi-select control never has, since its own DOM value IS the array).

**What this ADR does NOT decide, because it is a build-time catalog-shape call, not an
architecture question:** whether `options` is declared as a `PropDef` (mirroring `ChoicePicker`'s
`options®: array of {label®, value®}`, `0169:362`) or as reconciled catalog `children` (mirroring
`Select`/`Option`'s pattern) — Open fork OF3. Both are legal under the existing schema; neither
changes this clause's ruling on the `value` mark itself.

**Draining Exclusion E6 is named, not built, here.** ADR-0169's own text (`0169:486`) already
scoped the follow-through: *"draining E6 = widening the declared enum + the factory"* — once a
fleet control exists that legitimately maps to `ChoicePicker.variant: multipleSelection`, the
`a2ui-basic` catalog's narrowed enum (`['mutuallyExclusive']`) widens and a new factory arm lands.
This ADR's Repairs cell records that as owed on ratification+build; whether it ships in the SAME
wave as the default-catalog primitive or as its own follow-up is Open fork OF4.

### 3 · Association-editing scope fence

**Ruling: "plain multi-pick from a fixed, already-loaded option list" and "to-many
relationship/association editing" are NOT the same primitive, despite the PRD's own "seen from the
edit side rather than the filter side — not a second hole" framing (`saas-data-workbench.prd.md:124`).
That framing is TRUE as a
necessary-prerequisite claim — both are blocked by the fleet's missing multi-value bindable field —
and FALSE as a sufficiency claim. Cl.1's minted primitive closes the multi-pick case completely; it
closes only the first, smaller layer of the relationship-editing case, which needs strictly more
and is fenced OUT of this intake as its own, later, harder problem.**

**What the minted primitive genuinely covers.** "Assign tags from these 12 tags," "pick which
columns to show," any field whose option set is small, already in memory, and known at render
time — this is architecturally identical to `Table`'s `selected` shape (Fact 5) and to
`ChoicePicker`'s upstream contract (Fact 6): bind an array value, commit on selection change, done.
Cl.1/cl.2 fully specify this.

**What it does not cover, verified against Fact 7 (no candidate control or pattern exists for any
of these):**
- **Remote/paginated option loading.** "Assign a dataset to an account" implies searching
  potentially thousands of accounts, not picking from a dozen in-memory rows — a fundamentally
  different data-fetching shape the multi-select field's own contract (bind an array, commit a
  change) says nothing about.
- **Inline creation of the related record.** A relationship editor commonly needs "create a new
  account, right here, while assigning" — no shipped or fenced FACE control has a create-affordance
  built in; `mountEntryList`'s create flow is scoped to editing one entity's OWN typed entries, not
  spawning a foreign-key target.
- **A distinct associated/available split.** A real relationship editor typically shows "currently
  assigned" (removable, often as chips) separately from "available to add" (searchable) — two
  populations with different affordances, not one flat checkable list the minted field's own
  anatomy would ever need to grow.
- **Fleet architectural constraints that a real association editor collides with, that a plain
  multi-select never does.** The fleet is zero-dependency with no data-fetching layer by design
  (`saas-data-workbench.prd.md` §4, §8 C1); an association editor's remote-search/create affordances
  are inescapably a data/backend question a component library's primitive cannot itself answer —
  the multi-select field can bind an array; it cannot originate a network call.

**Consequence: association/relationship editing is fenced OUT of this intake and this primitive's
build.** It re-enters, if it ever does, as its OWN future design intake — composing the minted
multi-select field as one building block (the "which N are currently assigned" value-carrying leg)
alongside a search/typeahead surface and a create-affordance this ADR does not design. This is
consistent with, and sharpens rather than contradicts, `saas-data-workbench.prd.md` §9's own
fence ("a new primitive earns its own ADR... does not ride this wave") and GH #498's own explicit
Scope/Open section, which already excludes "building the primitive itself" and a related future
CSS-less-consumer facet picker from THIS filing's scope.

## Non-goals (recorded, not silent)

- **No component build.** No `.md` descriptor, no `UIElement` subclass, no geometry row, no
  catalog row lands here. This intake freezes the architecture the future SPEC/LLD build from
  (GH #498's own Acceptance criterion 1).
- **No naming decision.** The primitive is referred to descriptively throughout ("a multi-select
  field"); its tag name is an M-F build-time call (Open fork OF1 names the geometry/class question
  it rides alongside).
- **No association/relationship editing design.** Cl.3 fences it out entirely — no search UI, no
  create-in-place affordance, no associated/available split is designed here.
- **No draining of ADR-0169's Exclusion E6.** Cl.2 names the follow-through; the enum widening and
  new factory arm are M-F's own build (Open fork OF4 on sequencing).
- **No PRD-D3 reopening.** The filter/facet vehicle stays `ui-form-popover` + a checkbox group,
  page-side aggregation, exactly as ratified — cl.1 explicitly does not reopen it.
- **No `saas-data-workbench` fixture change.** The workbench's record fields stay scalar per its own
  ratified §4 non-goal; nothing here reopens that fence or implies the workbench itself grows a
  to-many field.

## Consequences

- GH #498 gains a ratified architecture to build against once accepted: mint (cl.1, record-edit
  case only), the wire shape needs nothing new beyond the original single-slot mark with an
  array-typed prop (cl.2), and association/relationship editing is a separately-scoped, harder
  future intake (cl.3) — three settled forks instead of three open ones.
- `roadmap.md` §3's M-F line is stale the moment this ADR is proposed and must be restated to the
  frozen answers on ratification (Repairs cell) — the same discipline ADR-0172's own Consequences
  recorded for its M-D line.
- M-F's own SPEC/LLD inherits the architecture decided here but still owns real work this intake
  deliberately leaves open: the primitive's exact geometry/base-class shape (OF1), whether it needs
  a second value-mark slot (OF2), its `options` catalog shape (OF3), and E6's drain sequencing
  (OF4) — this intake narrows the design space, it does not finish it.
- The association/relationship-editing gap (cl.3) stays a recorded, citable, UNCLOSED future item
  independent of M-F's fate — the multi-select field closes ONE of the two angles PRD §5 named, not
  both; a future reader must not treat this ADR as having closed the relationship-editing case too.
- `saas-data-workbench.prd.md` §5's "Checked and found NOT to be gaps" association paragraph
  becomes partially stale the moment this ADR is proposed: its "not a second hole" framing is
  narrowed by cl.3 to "a necessary-but-not-sufficient shared prerequisite" — worth a citation-only
  repair note at that paragraph when M-F's build actually lands (not urgent; the PRD's own
  ratified fence — no new primitive rides the M-A wave — is unaffected either way).

## Open forks

- **OF1 — The minted primitive's geometry/base-class shape.** Cl.1 names a plausible internal
  shape (host `ui-form-popover`'s disclosure mechanics around checkbox children, aggregating their
  commits into one `FormData`/array value) but does not rule it; an inline always-visible listbox,
  a `ui-combo-box`-style overlay with checkable rows, or another shape entirely are all live
  options an LLD must actually weigh against the fleet's geometry-by-part convention
  (`references/geometry-sizing-spec.md`). Flagged for M-F's SPEC/LLD.
- **OF2 — Whether the primitive ever needs a second, distinct value-mark slot** (e.g., an embedded
  search-query prop alongside the array value) — if so, THAT is when ADR-0161's multi-slot
  mechanism is actually consumed, contrary to what GH #498's own framing assumed up front (cl.2).
  Not derivable without the LLD's actual anatomy decided (OF1).
- **OF3 — The catalog `options` shape**: a `PropDef` array (the `ChoicePicker` precedent) vs.
  reconciled `children` (the `Select`/`Option` precedent) — both legal, a real build-time catalog
  design call, not an architecture question this intake needs to settle (cl.2).
- **OF4 — Sequencing: does draining ADR-0169's Exclusion E6 (the `a2ui-basic` enum widening + new
  factory arm) ship in the SAME wave as the default-catalog primitive, or as its own smaller
  follow-up once the primitive is proven?** Both reasonable; Kim's call, the same shape as
  ADR-0172's own OF2.

## Alternatives considered

- **Do nothing / leave the gap fenced as-is** — rejected: the gap has been independently
  rediscovered four times by two separate inventory waves without a tracked intake
  (`inv-5-saas.md` §6's own risk: *"confidence buried in ratified-doc prose is not the same as a
  re-discoverable backlog item... the risk is a fifth wave re-deriving the same finding from
  scratch"*) — GH #498 and this ADR exist specifically to stop that recurrence, per
  `inv-5-saas.md` §4 candidate #1's own recommendation.
- **Compose for BOTH the filter and the edit case** (extend PRD-D3's vehicle to record editing too)
  — rejected: Facts 2–3 show composition cannot produce one bindable aggregate value at all, only
  N duplicate-name FormData entries a consumer must filter/aggregate page-side — exactly the
  residual PRD-D3 already carries as acceptable for a FILTER (read-mostly, page-side glue is a
  tolerable cost) but not for a FIELD a form must get/set/round-trip as one value.
- **Mint one primitive that ALSO does relationship/association editing** (search, create-in-place,
  associated/available split, all in one control) — rejected by cl.3: Fact 7 shows none of those
  sub-capabilities exist anywhere in the fleet today, each is a substantial design problem on its
  own (remote data-fetching collides with the fleet's zero-backend posture), and bundling them
  would make this intake's mint decision (cl.1, mechanically cheap per Fact 4) into an
  open-ended one. Keeping the fence where cl.3 draws it keeps cl.1's ruling buildable.
- **Answer OF1-OF4 in this ADR rather than leaving them open** — rejected: a design-intake ADR's
  job (GH #498's own Acceptance criterion 1, "freezes... whether... vs...") is to freeze the
  ARCHITECTURE, not pre-build the SPEC/LLD — the same discipline ADR-0172's own Alternatives
  recorded for its own three questions.
