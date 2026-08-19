# ADR-0220 — `ui-choice-group` + `ui-choice-card`: the rich-card selection container (a committed choice over agent-composed option cards, single or multi — GH #1368)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-19 |
> | **Proposed by** | planning-leader seat (design intake GH [#1368](https://github.com/kimgranlund/agent-ui/issues/1368), the 2026-08-18 preset-vs-catalog gap analysis's rich-option-selection item) — ruled mint-earned on the TYPE arm of the mint-vs-compose test (`.claude/skills/component-design/references/mint-vs-compose.md`): semantics+behavior inexpressible — `Card` carries no selected state and no value mark, `List`/`Grid` carry no value mark, `RadioGroup`/`SegmentedControl` are label-grade, `Table.selectable` is row-grade over textual cells; there is no element to hang a committed rich-card choice on |
> | **Ratified by** | *pending — Kim ratifies (`ratify ADR-0220` utterance, `scripts/adr_ratify.py` per ADR-0149)* |
> | **Repairs** | on ratification+build (not authored here): **NEW** `controls/choice-group/*` (`ui-choice-group` + `ui-choice-card` + family CSS + descriptors) · `catalog.json` + `factories.ts` (**NEW** `ChoiceGroup`/`ChoiceCard` rows — §5.2 delta drafted below lands verbatim in [`../spec/a2ui-catalog.spec.md`](../spec/a2ui-catalog.spec.md) §5.2) · `src/agent/feed-catalog.ts` (both types → `FEED_SURFACE_TYPES`, exact-count pins) · the full new-catalog-type coverage-machinery lanes (index/tier/site-coverage/llms/seeds/baselines — the checklist at `.claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md` §"(iii) New catalog type / pattern, end to end", steps 1–8) · one frontier corpus seed + prompt-inventory teaching · **one additive trait seam** — `traits/selection-commit.ts` gains optional `itemFromTarget`/`reflectSelected` hooks (clause 1; defaults unchanged, shipped consumers the negative control) · plan-mode decomposition: [`../decompositions/choice-group.decomp.json`](../decompositions/choice-group.decomp.json) (coverage-clean under `--strict`) · **LLD posture: none new** — the shipped listbox-roving LLD-C2/C3 (`selectionCommit`/`rovingFocus` seams) + multi-select-field LLD-C4 (`multi-toggle`) are the implementation contracts this family composes; per-slice gates live in the decomposition, not a new LLD |
> | **Supersedes / Superseded by** | None. Relates [ADR-0161](./0161-catalog-multi-slot-two-way-value-marks.md) (the multi-slot value-mark vocabulary this row's mode-gated mark rides — the Calendar per-slot-opt-in precedent) · [ADR-0175](./0175-association-multiselect-field-design-intake.md) (the aggregate-value bar; `MultiSelect.value` is the shipped array-typed-prop precedent) · [ADR-0095](./0095-ui-segmented-control-standalone-component.md) (group+child subclass-pair prior art; its T1 note — "a multi-select segmented control … will be a separate component" — is honored here, not reopened) · [ADR-0050](./0050-form-provider-context-registration.md) (the depth-spanning registration contrast case) · [ADR-0103](./0103-radio-group-owns-layout-form-provider-teaches-wrap.md) (the group-owns-interior-layout law, adopted) · ADR-0212 (proposed, PR [#1367](https://github.com/kimgranlund/agent-ui/pull/1367) — nearest-group-scoped descendant discovery; posture stated in clause 7: aligned-by-construction, NOT dependent) · [ADR-0097](./0097-a2ui-feed-embedded-asks.md) Decision (`FEED_SURFACE_TYPES` / the LLD-C14 partition gate both new types enter) · [ADR-0057](./0057-intent-non-color-signifier-rule.md) (non-color selected signifier) · [ADR-0042](./0042-face-widget-value-control-bases.md) (`UIListboxElement` — the shipped selection base this family does NOT extend; it composes the same two traits directly on `UIFormElement`, clause 1) · GH #1374 (the Timeline plan-mode lane also edits `feed-catalog.ts` — disjoint rows, cited to avoid collision, no shared decision) |

## Context

**The shape that cannot be expressed.** "Scan and choose from rich options" — three hotel cards,
four product variants, the OpenAI inline-carousel pattern — is the single most common commerce/
hospitality generative-UI gesture, and the catalog has no expression for it (GH #1368's gap
analysis, verified against `origin/main` @ `5fd45a51`):

- `Card` (`catalog.json`) is a structural container — `elevation`/`brightness` + `ChildList`, no
  selected state, no value mark, no interactivity.
- `List`/`Grid` are layout washes; no value mark, no selection semantics.
- `RadioGroup`/`Radio` and `SegmentedControl`/`Segment` are label-grade: `Radio.label` maps to
  `textContent` (bespoke); a radio's dot is the hit target and the a11y unit, not a card.
- `Table.selectable` (ADR-0163) is row-grade over textual `columns`/`rows` — §5.2's own usage
  guidance routes it to "picking rows over exact values", not product cards.

An agent can render three beautiful Cards today; it cannot receive a committed choice from them
through the data model. That is the TYPE arm of the mint-vs-compose test — semantics+behavior
inexpressible, not a teaching gap — and PRD §8 clause 1's own bar ("new types are minted only when
composition is provably impossible") is met by that analysis.

**Why ADR-0212 (even ratified) does not close this.** ADR-0212 (proposed, PR #1367) widens
`ui-radio-group` discovery to nearest-group-scoped descendants, making `RadioGroup > Card > Radio`
functional. But in that composition the RADIO stays the hit target and the a11y unit: the card is
unselectable chrome with no selected-state rendering, clicking the card body does nothing, and
multi mode has no analog at all (no checkbox group exists). The #1368 shape needs the CARD to be
the option.

**What already exists to build on.** The selection machinery is two shipped TRAITS, not a base
class: `traits/roving-focus.ts` (`rovingFocus`) + `traits/selection-commit.ts` (`selectionCommit`,
listbox-roving LLD-C2) — the latter (verified at source) commits on real user gestures (click/
Enter — explicit activation, never selection-follows-focus), emits `select` on commit, carries a
`'multi-toggle'` mode (multi-select-field LLD-C4), and parameterizes `items()`/`keyOf()`/
`syncSelection()`. The fleet idiom for a selection CONTROL is to compose both traits directly on
a `UIFormElement` host — `select.ts`, `multi-select.ts`, and `_base/listbox-element.ts` (whose test exercises the DEFAULT accessors — the most load-bearing negative control; `multi-select.ts`'s header, lines 1–10,
states it: traits on the control, never via extending `UIListboxElement`).
`controls/_base/listbox-element.ts` (`UIListboxElement`, ADR-0042) exists but has NO production
subclass (only its own test fixture), hard-wires `querySelectorAll('[role=option]')` (lines
61–85), holds a private `#selection`, knows only `'multi'` (not `'multi-toggle'`), and exposes no
protected hooks — it is not an extension seam. Two verified limits in `selectionCommit` bound the
build: its click AND Enter paths BOTH resolve the option via a hard-coded `closest('[role=option]')` (click: `optionFromTarget`; Enter: the `document.activeElement` lookup at `selection-commit.ts:191`), and its
commit-time reflect SETS an `aria-selected` ATTRIBUTE on each item (its header, lines 6–11:
attribute-reflected `[role=option]` hosts ONLY; ui-tab, internals-driven, cannot consume it
as-is). Clause 1 rules how a card family — whose option unit is a FACE host carrying ARIA through
internals — meets those limits. The missing piece is a thin family plus one additive trait seam,
not a new interaction model — the "minting is cheap when it is" check (mint-vs-compose reference)
applies verbatim.

## Decision

**We mint the `choice` family — `ui-choice-group` (the selection container) + `ui-choice-card`
(the rich option unit) — in `controls/choice-group/`, with wire types `ChoiceGroup`/`ChoiceCard`.**
Eight clauses:

1. **Identity & class.** `UIChoiceGroupElement extends UIFormElement`, composing `rovingFocus` +
   `selectionCommit` directly from `connected()` — the `select`/`multi-select` idiom (`combo-box` is bespoke and does NOT use this trait, `combo-box.ts:27`),
   NOT a `UIListboxElement` subclass (Context: the base has no production subclass and no
   protected hooks). The group owns its own `value`/`values` props, `formValue()`/
   `formValidity()` (`required`+empty → `valueMissing`), and `internals.role = 'listbox'`.
   `UIChoiceCardElement` is the option unit — a light-DOM card-shaped FACE host whose ENTIRE
   surface is the hit target, carrying `role=option` + `aria-selected` via `ElementInternals`
   (never host attributes — the fleet ARIA law; the ui-tab precedent). **Role-carriage ruling
   (decided here, not deferred):** cards do NOT grow a host `role` attribute to become visible to
   the trait's attribute-keyed defaults; instead the build's FIRST slice adds two optional,
   backwards-compatible seams to `selectionCommit` — `itemFromTarget?: (target) => HTMLElement |
   null` (replaces BOTH hard-coded `[role=option]` resolution sites — the click target (`optionFromTarget`) AND the Enter path's `document.activeElement` lookup at `selection-commit.ts:191`, else an internals-role card's Enter commit never fires; the group
   passes a `closest('ui-choice-card')` scoped by clause 7) and `reflectSelected?: (el, selected)
   => void` (replaces the per-item `setAttribute('aria-selected')` paint; the group routes it to
   the card's `internals.ariaSelected`) — both defaulting to today's behaviour, so `ui-select`/
   `ui-multi-select`/`ui-listbox` are byte-unaffected (their suites plus `listbox-element.test.ts`, which exercises the default accessors, are the slice's negative
   control), and the trait header's consumer contract is amended to name internals-reflected
   hosts as consumable THROUGH these seams. The group layers its own value-keyed reflect on top
   (the trait's reflect is commit-time only — GH #908/#905 header contract; the `multi-select.ts`
   `syncOptionState` precedent). Tag→type is mechanical PascalCase (no alias row needed in the
   fleet-derived coverage gate). Names derive from the family name `choice` per `naming.md` §13.
2. **One control, two modes.** `multiple: boolean` (structural, reflected; read at connect time —
   the shipped idiom) flips single (exclusive, radio-like — `selectionCommit` mode `'single'`) vs
   multi (toggle — the trait's shipped `'multi-toggle'` mode, multi-select-field LLD-C4, the
   `multi-select` precedent; never the modifier-keyed `'multi'`). ADR-0095's T1 fact — a multi-select
   segmented control was always a separate component — is honored: this IS that component's
   rich-card realization, not a RadioGroup axis.
3. **The wire value mark — ADR-0161's array form, mode-gated per-slot opt-in (the Calendar
   precedent).** The group exposes `value` (string — the committed key, single mode) and `values`
   (string[] — the committed set, multi mode), both bindable; the catalog mark is
   `value: [{prop:'value',event:'select'},{prop:'values',event:'select'}]` — distinct props, one
   shared commit event (sanctioned; the `Table` `sort`/`page` shape). A single-mode payload binds
   `value`; a multi-mode payload binds `values`; an unbound off-mode slot installs nothing
   (ADR-0161 clause 3's per-slot opt-in). `select` is the commit event by verified source
   (`selection-commit.ts` emits `select`; the `Select`/`MultiSelect` rows' precedent) — **subject
   to the Fork-T1/D1 obligation: the build PROBES event-vs-commit ordering (both props readable
   with committed values at listener time) before the mark is declared; this ADR does not waive
   that probe.**
4. **Card-as-hit-target + the display-only content law.** Selection renders on the card itself: a
   selected frame (border + wash) plus a dedicated check indicator — a non-color signifier
   (ADR-0057), with a forced-colors leg. `ChoiceCard` children are agent-composed DISPLAY content
   (`Text`/`Image`/`Badge`/`Stat`/`Icon`/layout); **interactive controls inside a card are
   non-conforming** (ARIA: `option` permits no interactive descendants). The grammar cannot
   type-restrict `ChildList`, so v1 enforcement is teaching + review tier (prompt inventory + the
   corpus seed + catalog-rendering review), named honestly as prompt-enforced with the ADR-0201
   enforcement-locus falsifier: repeated interactive-descendant payloads in review escalate this
   law to a validator/renderer guard as its own follow-up.
5. **Keyboard/ARIA: listbox semantics, both modes, explicit activation.** `role=listbox` on the
   group (`aria-multiselectable` in multi), `role=option` + `aria-selected` on cards (all via
   internals — the clause-1 `reflectSelected` seam is what lets the trait's commit-time paint land
   there);
   arrow-key roving in tree order over OWNED cards, disabled cards skipped; commit by click or
   Enter/Space — never selection-follows-focus (browsing rich cards must not commit; this is also
   the shipped `selectionCommit` model, so the fleet gains no second convention). Radiogroup
   semantics for single mode were considered and rejected: they'd fork the a11y model across modes
   (radiogroup vs nothing-for-multi) and drag selection-follows-focus in with them. The shared
   trait has no Space leg (its header says so); the group synthesizes Space→click on the focused
   card, the `multi-select.ts` precedent — a build fact, not a contract change.
6. **The group owns interior layout (ADR-0103's law, adopted at birth).** One mechanism: a
   responsive auto-fit grid — `min` (CSS length, the column floor; the `Grid.min` precedent) +
   `gap` (the `--ui-space` ladder enum). The stacked single-column list is the degenerate case
   (`min` ≥ container). No `orientation` prop, no wrapper type, no carousel (fenced, clause 8).
7. **ADR-0212 posture: aligned-by-construction, NOT dependent.** `ui-choice-group` discovery is
   born nearest-group-scoped-descendant: the group's `items()` is its own
   `querySelectorAll('ui-choice-card')` FILTERED to cards whose nearest choice-group ancestor is
   THIS group — a filter the family adds on top (the trait's default accessor is an unscoped
   `[role=option]` query the family never uses); an inner group is the ownership boundary, and the
   inner-group negative control (a nested group's cards neither roved nor committed by the outer)
   is the guard. The same filter backs `itemFromTarget` (clause 1) and `keyOf()`. This is the same rule ADR-0212 proposes
   retrofitting onto `ui-radio-group`, adopted here as a fresh contract: if 0212 ratifies, the
   fleet has one discovery rule; if 0212 is rejected, that rejection is about changing a SHIPPED
   direct-children contract, which this new family never had — nothing here waits on, or is
   invalidated by, that ruling.
8. **Smallest floor + fences (the ADR-0107→0205 scoping test).** v1 = single+multi committed
   selection over display-only rich cards, group-owned grid layout, `disabled` (group, bindable;
   per-card), `required`+empty → `valueMissing`, zero-cards renders nothing (the honest empty
   state; the `Pagination` `<2` precedent). Fenced OUT as named later intakes, never riders:
   per-card secondary actions (a "Details" button inside an option breaks the option contract —
   pair a `ChoiceGroup` with a `Drill`/`Card` composition instead) · min/max multi-selection
   counts · comparison-table presentation · horizontal carousel/scroll-snap presentation (swiper-
   family territory; see Alternatives variant C) · remote/paginated options (the ADR-0175 fence,
   unchanged).

### The §5.2 delta (drafted here; lands verbatim in `a2ui-catalog.spec.md` §5.2 on ratification+build)

> | `ChoiceGroup` | `ui-choice-group` | **NEW** (ADR-0220, GH #1368). The rich-card selection container — a committed choice over agent-composed option cards. `multiple` (boolean, structural — single=exclusive, multi=toggle); bindable `value` (string, the single-mode committed key) and `values` (string[], the multi-mode committed set); `min` (CSS length, the auto-fit column floor — the `Grid.min` precedent) + `gap` (space-ladder enum) — the group owns its interior layout (ADR-0103's law, adopted); bindable `disabled`; `required`; `label` (bindable, the accessible name → `internals.ariaLabel`, the `Toolbar.label` precedent). `value:[{prop:'value',event:'select'},{prop:'values',event:'select'}]` (ADR-0161 array form, mode-gated per-slot opt-in — the `Calendar` single-vs-range precedent; distinct props, one commit event, the `Table` sanction). `ChildList` of `ChoiceCard` — discovery is nearest-group-scoped descendants from birth (ADR-0220 cl.7). Listbox semantics, explicit activation, never selection-follows-focus |
> | `ChoiceCard` | `ui-choice-card` | **NEW** (ADR-0220). The option unit — the WHOLE card is the hit target and the a11y unit (`role=option` via internals; selected frame + non-color check indicator, ADR-0057). `value` (string, the option's committed identity key); bindable `disabled`. No `value` mark of its own — the group owns the commit (the `Radio`/`RadioGroup` precedent). `ChildList` children: DISPLAY-ONLY agent content (`Text`/`Image`/`Badge`/`Stat`/`Icon`/layout); interactive descendants are non-conforming (ADR-0220 cl.4, prompt-enforced v1) |

Both types enter `FEED_SURFACE_TYPES` (ADR-0097 Decision, the LLD-C14 partition gate): a rich-option pick IS the canonical
commit-gated ask ("choose one of these three hotels"); `ChoiceCard` rides in under composite
closure. GH #1374's Timeline plan-mode lane edits other rows of the same partition file —
disjoint entries, no shared decision.

## Acceptance

- **This pass (docs only):** this file `proposed`, never self-flipped; PRD §8 delta additive;
  `choice-group.decomp.json` coverage-clean under `--strict`; docs-grammar suite green on the
  branch (S8 with 0209–0219 allowlisted as reserved-in-flight); no file outside `.claude/docs/` +
  the two rider files (`site/lib/docs-grammar.test.ts` KNOWN_GAPS, `site/public/adr-index.json`)
  touched.
- **On ratification+build (exit gates; per-slice gates in the decomposition):** jsdom — single
  exclusivity, multi toggle, `required`+empty → `valueMissing`, programmatic `value`/`values`
  writes reflect without self-emitting, nearest-group discovery incl. the inner-group boundary
  negative control, disabled cards skipped by roving and never committed, the `selectionCommit` seam slice's
  negative control (shipped `select`/`multi-select` suites + `listbox-element.test.ts` unchanged-green); browser — selected
  frame + indicator, forced-colors leg, stacked→grid reflow at `min`, exactly-one-tabindex roving;
  **the Fork-T1/D1 event-vs-commit ordering probe recorded in #1368's Findings BEFORE the value
  mark lands**; catalog/conformance/factory legs (rubric `a2ui-catalog` D1–D3 ≥ 4 hard);
  feed-partition exact-count pins updated; the full new-catalog-type coverage-machinery checklist
  lanes green; `npm run check && npm test` + the relevant browser shard green, judged by exit
  codes.

## Consequences

- **The #1368 shape becomes wire-expressible**: an agent emits `ChoiceGroup > ChoiceCard×N` with
  rich card content and receives a committed key (or key set) through the data model — closing
  the widest gap in the 2026-08-18 preset-vs-catalog analysis without touching `Card`, `List`,
  `Grid`, `RadioGroup`, or `Table` (zero shipped-row edits; pure addition).
- **Two new catalog types, not one** — the group/child composite cost (`Radio`, `Segment`,
  `SwiperItem` precedents). Accepted: a childless `options`-array spelling was rejected
  (Alternatives) because rich card content is exactly what an aggregate data prop cannot carry.
- **The display-only content law is prompt-enforced at v1** — the honest weak point (clause 4's
  falsifier names its own escalation). The validator cannot see it; review + teaching hold it.
- **`selectionCommit` gains its first internals-reflected consumer, through two additive seams
  (clause 1)** — `itemFromTarget` + `reflectSelected`, defaults unchanged, the shipped
  attribute-reflected consumers the negative control; its header's "attribute-reflected hosts
  ONLY" contract is amended, not broken. `UIListboxElement` stays unextended (its zero-production-
  subclass state is unchanged; extract-vs-retire is a later pass's question, not this ADR's). If
  the seams prove insufficient at build (the trait's `isDisabled` attribute backstop is expected to
  hold because the card reflects `disabled` as an attribute), the builder escalates per the
  ADR-0095 subclass-vs-extract precedent rather than forcing it — a build-time re-verify, not a
  fork for Kim.
- **Stale → re-verify on build:** §5.2 (the drafted rows) · `feed-catalog.ts` counts ·
  `site/pages/choosing.ts` GROUPS routing (line ~108; a "pick from rich options" arm beside the
  `Table.selectable` guidance) · the prompt inventory + one frontier seed · this ADR's Repairs cell.

## Alternatives considered

Layout variants argued from concrete shapes (clause 6 picks B, with A as its degenerate case):

**A — stacked full-width option rows** (the mobile/feed-ask default):

```
+------------------------------------------+
|  Hotel Astoria         ★4.6   $210/night |
|  "Near the old town — walk everywhere"   |
+------------------------------------------+
|  Hotel Meridian ✓      ★4.8   $185/night |
|  [img]  "Rooftop pool, 10 min to center" |
+------------------------------------------+
```

**B — responsive auto-fit card grid** (the chosen mechanism; A is `min` ≥ container):

```
+--------------+  +--------------+  +--------------+
| [image]      |  | [image]    ✓ |  | [image]      |
| Standard     |  | Deluxe       |  | Suite        |
| $120   ★4.2  |  | $185   ★4.8  |  | $310   ★4.9  |
+--------------+  +--------------+  +--------------+
```

**C — horizontal scroll carousel** (the OpenAI inline-carousel; FENCED, not chosen):

```
 < +---------+ +---------+ +---------+ >
   | card 1  | | card 2 ✓| | card 3  |
   +---------+ +---------+ +---------+
```

C needs scroll-snap/paddle/pagination machinery the swiper family already owns — bolting it onto
a selection control doubles that machinery; if a carousel presentation is ever earned it is a
`Swiper`-composition or swiper-widening intake, not a `ChoiceGroup` axis.

- **Compose via ADR-0212 (`RadioGroup > Card > Radio` at depth).** Rejected: the radio stays the
  hit target and a11y unit; the card gets no selected state and no click surface; multi mode has
  no analog. 0212 fixes a real RadioGroup defect; it does not make cards selectable.
- **Widen `Card` with `selectable`/`value` (the ADR-0163 Table-widening shape).** Rejected: a lone
  selectable card has no commit owner — exclusivity, roving, form value, and the value mark all
  need a GROUP, so the widening grows a group anyway and leaves `Card`'s structural identity
  blurred (every card everywhere becomes a potential input; `Table` could absorb `selectable`
  precisely because it already owned its homogeneous rows).
- **Widen `List`/`Grid` with selection.** Rejected: same missing-commit-owner argument on layout
  washes whose children are arbitrary; selection semantics over non-option children is exactly
  the half-connected hazard class ADR-0212 documents.
- **An `options`-array data prop on one type (the `MultiSelect`/`ui-description-list` spelling).**
  Rejected: rich card content (image + badges + stat + prose, agent-composed per option) is
  tree-shaped, not row-shaped — an aggregate prop would need a whole nested component grammar
  inside JSON, forfeiting the catalog's own composition model. `MultiSelect` stays the compact
  label-grade aggregate; `ChoiceGroup` is its rich-content sibling, not its replacement.
- **Two types (`ChoiceGroup` + `MultiChoiceGroup`).** Rejected: `selectionCommit` already
  unifies the modes (`'single'`/`'multi-toggle'`) behind one `multiple` prop; two types double the vocabulary and the teaching surface
  for one mechanism (the `Calendar mode` precedent keeps one type with mode-gated slots).
- **One always-array `value` (bind an array even for a single pick).** Rejected: makes the
  dominant single-pick case an array dance for producers and diverges from `RadioGroup`/`Select`
  familiarity; the ADR-0161 per-slot opt-in gives each mode its natural shape at zero mechanism
  cost.
