# Composition patterns — the eight seeded idioms (packs A + B)

The eight dispositioned composition patterns of `req-a2ui-library` R4 (GH #1213; packs A + B, GH
#1205/#1206), each a pattern over EXISTING catalog types — never a new component. Every section
cites its shipped seed BY NAME: the seed is the ground truth (`packages/agent-ui/a2ui/src/examples/
composition-pack-a.ts` · `composition-pack-b.ts`, both on `allSeeds` and proven by the shared
validate+render-smoke gate in `examples.test.ts`); quoted node records below are byte-for-byte from
the seed source. Re-open the seed on any suspicion of drift — the seed, not this file, is what the
gate proves.

Shared laws every section assumes (stated once): live data-model binding for everything that varies
per instance (`updateDataModel` carries `value:`; varying content rides `{path}`/`${…}` — the
"dead data" defect class), realistic content (no lorem), and the card-anatomy clause wherever a Card
appears (`src/agent/prompts/grammar.md:138` — CardHeader carries identity, CardContent the
substance, CardFooter the actions). Routing: these are PAYLOAD idioms — a missing catalog
component/prop is an `a2ui-build-agent` escalation (see SKILL.md's hand-back rule), never patched
here.

## 1 · Slideshow / gallery (seed: `slideshow-gallery`, pack A)

**Mechanism.** A paddled, paginated `Swiper` of `SwiperItem` slides, each holding one full-bleed
`Image` (`fit: 'cover'`, one shared `aspect` so the deck holds a stable box — zero CLS per slide).
The caption is a `Text` node default-slotted as the Image's CHILD — `Image` declares
`children: "ChildList"` in `catalog.json`, and the control pins default-slotted content to the
bottom over its own scrim gradient (the R2 contract, `controls/image/image.md` §"The bottom scrim +
caption content (R2)"; no caption child ⇒ no scrim box painted at all). Never bolt a caption Row
under the photo. The active index is bound (`Swiper`'s `active` is its two-way value prop —
`value: {prop: 'active', event: 'select'}` in the catalog) so the agent can jump the deck to the
slide it is talking about with a one-path `updateDataModel`.

**Worked shape** (seed source, verbatim):

```ts
{
  id: 'root', component: 'Swiper', pagination: true, paddles: true, align: 'start',
  active: { path: '/gallery/active' }, children: ['slide_living', 'slide_terrace', 'slide_bedroom'],
},
{ id: 'slide_living', component: 'SwiperItem', children: ['img_living'] },
{
  id: 'img_living', component: 'Image', src: { path: '/gallery/photos/living' },
  alt: 'Living room with arched windows over the rooftops', fit: 'cover', aspect: '16/9',
  children: ['cap_living'],
},
{ id: 'cap_living', component: 'Text', text: 'Living room — morning light over the Alfama rooftops' },
```

**Policies + consequences.** `src` is BOUND so an amend turn swaps a photo in place (one
`updateDataModel`, no tree resend); `alt` is a static producer-authored literal every time —
`alt` is `required: true` in the catalog (image.md's admission-enforced accessible-name contract),
and a payload omitting it fails validate. **Boundary:** a single hero image inside a card is not
this pattern — that is the plain Image-in-Card idiom (`node-idioms.md`'s Image card); reach for the
Swiper only when the user pages through a SET.

## 2 · Confirmation view (seed: `confirmation-view`, pack A)

**Mechanism.** The full three-slot confirmation card a producer emits when a flow reaches its
confirm step: `Card > CardHeader` (identity title ONLY) + `CardContent` holding the ADR-0201
`DescriptionList` receipt + `CardFooter` holding the action pair — the card-anatomy clause
(`grammar.md:138`) applied end to end. `DescriptionList.rows` is bindable
(`{label, value}[]`, both required per its catalog entry), so the receipt is bound to a model
array and an amend-answer turn updates the summary in place by rewriting `/reservation/rows` —
never by resending the card. Values arrive HUMANIZED from the producer
(`'€40.00 — refundable until Aug 21'`, never a raw number).

**Worked shape** (seed source, verbatim):

```ts
{ id: 'root', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
{ id: 'receipt', component: 'DescriptionList', rows: { path: '/reservation/rows' } },
{ id: 'btn_back', component: 'Button', variant: 'ghost', label: 'Change details', action: { action: 'edit_reservation', wantResponse: false } },
{ id: 'btn_confirm', component: 'Button', variant: 'solid', label: 'Confirm reservation', action: { action: 'confirm_reservation' } },
```

**Policies + consequences.** Exactly ONE solid commit button, ghost go-back beside it (the
confirm-before-concluding law's flow-final commit); the go-back action carries
`wantResponse: false`. **Boundary:** the `frontier-booking-receipt` seed (#1185) exercises the
DescriptionList PRIMITIVE bare — this section is the whole three-slot confirmation CARD a flow's
confirm step emits. If the ask is "show the receipt data" mid-conversation, the bare primitive
suffices; if the ask is "let me confirm/commit", emit this pattern.

## 3 · Trend list (seed: `trend-list`, pack A)

**Mechanism.** Up/down metrics as a `List` TEMPLATED over the model
(`children: { path, componentId }`), each item one `Row{Text label · Sparkline · Stat delta}` with
RELATIVE per-item binds (the person_card idiom, `dynamic-lists.ts` — inside a template, `{path}`
resolves against the item). `Sparkline.values` carries the metric's recent numeric series;
`Stat.value` carries the current value and `Stat.delta` the SIGNED change — the sign IS the
direction, rendered in ui-stat's intent color (green-up/red-down, the Domo/ClearPoint KPI
convention).

**Worked shape** (seed source, verbatim):

```ts
{ id: 'trend_list', component: 'List', gap: 'sm', children: { path: '/metrics', componentId: 'metric_tpl' } },
{ id: 'metric_tpl', component: 'Row', gap: 'md', align: 'center', justify: 'between', children: ['tpl_label', 'tpl_spark', 'tpl_stat'] },
{ id: 'tpl_label', component: 'Text', text: '${label}' },
{ id: 'tpl_spark', component: 'Sparkline', values: { path: 'spark' }, label: { path: 'label' }, variant: 'line' },
{ id: 'tpl_stat', component: 'Stat', value: { path: 'value' }, delta: { path: 'delta' } },
```

**Policies + consequences.** A lower-is-better metric (error rate) reports its REAL signed change
(`delta: -3`) — presentation inversion is a component concern, never faked in the payload. `delta`
is typed `number` in the catalog; a humanized string there fails validate. Refreshing the metrics
is a one-message `updateDataModel` on `/metrics` — the template re-renders positionally (ADR-0024,
index-based, no per-item key). **Boundary:** one headline number with no series is a bare `Stat`
tile (see §4's scoreboard body); a full chart ask exceeds the catalog and escalates.

## 4 · Card layouts (seed: `card-layouts`, pack A)

**Mechanism.** Cards whose BODIES are list/columns/grid arrangements — already fully expressible
with Card children (the disposition row's finding; no new component). The seed shows all three side
by side on one track `Grid` (`min: '16rem'` — the track law), each obeying card anatomy: the
arrangement always lives in `CardContent`, never beside the card. Three bodies: a LIST body (a
templated `List`), a COLUMNS body (a `Row` of labeled `Column`s), and a GRID body (a nested track
`Grid` of `Stat` tiles).

**Worked shape** (seed source, verbatim — one line per body kind):

```ts
{ id: 'root', component: 'Grid', gap: 'md', min: '16rem', children: ['card_list', 'card_columns', 'card_grid'] },
{ id: 'standup_list', component: 'List', gap: 'xs', children: { path: '/standup', componentId: 'standup_tpl' } },
{ id: 'standup_tpl', component: 'Text', text: { path: '' } },
{ id: 'cols_row', component: 'Row', gap: 'lg', children: ['col_now', 'col_next'] },
{ id: 'stats_grid', component: 'Grid', gap: 'sm', min: '6rem', children: ['st_done', 'st_review', 'st_blocked', 'st_days'] },
```

**Policies + consequences.** A template over an array of bare STRINGS binds with the empty relative
path — `text: { path: "" }` resolves to the item itself. Nesting a Grid inside CardContent is legal
and idiomatic (the scoreboard); resist inventing a "dashboard" container. **Boundary:** this
section is the reference for ARRANGEMENT-inside-a-card; a card whose body is a receipt is §2, a
card whose body is trend rows is §3's List dropped into a CardContent.

## 5 · Five-day weather (seed: `five-day-weather`, pack B)

**Mechanism.** A `Card` whose header carries only the place+range identity and whose content is one
`Row` (`justify: 'between'`) of five day `Column`s, each stacking day label · condition · hi/lo
(the Subframe/Tubik survey convention: day+icon+hi/lo). Every per-day VALUE is bound
(`/forecast/<day>/cond`, `/forecast/<day>/temps`) so a morning re-forecast updates a day in place;
day LABELS are static (the week's shape doesn't change mid-conversation).

**The glyph gap (why condition is TEXT, not an Icon).** The icon pack's canonical vocabulary
(`@agent-ui/icons` `ICON_NAMES`, `packages/agent-ui/icons/src/types.ts`) ships ZERO weather glyphs
— no sun/cloud/cloud-rain/snowflake/etc. — and an unknown name resolves to a non-throwing blank
`<svg data-icon-missing>` (`icons/src/resolve.ts:12`): dead pixels, not a fallback. So v1 realizes
the disposition row's Icon slot as a condition Text label; when a weather-glyph wave lands in the
icon pack, swap the `cond_*` Text nodes for Icon nodes bound to the SAME model paths.

**Worked shape** (seed source, verbatim — one day column; five repeat):

```ts
{ id: 'd_mon', component: 'Column', gap: 'xs', align: 'start', children: ['day_mon', 'cond_mon', 'temps_mon'] },
{ id: 'day_mon', component: 'Text', variant: 'label', text: 'Mon' },
{ id: 'cond_mon', component: 'Text', variant: 'caption', text: { path: '/forecast/mon/cond' } },
{ id: 'temps_mon', component: 'Text', text: { path: '/forecast/mon/temps' } },
```

**Boundary.** Five fixed columns are STATIC children keyed by day — not a `{path, componentId}`
template (§3/§6 own templating); the fixed-width week earns explicit ids so per-day binds stay
addressable. The hero variant (full-bleed condition Image behind today's temp) is a booked
follow-up, not this pattern.

## 6 · Restaurant / drinks menu (seed: `restaurant-menu`, pack B)

**Mechanism.** A `Column` of category sections — each a `Text` heading over a `List` templated on
the model, each row `Row{Column{name, caption desc} · price}` with the price RIGHT-ALIGNED by the
Row's own `justify: 'between'` (NO dot leaders in v1 — the disposition row's typography call). The
long tail section (wines) sits behind a `Disclosure` so the surface stays scannable.

**Price humanization.** Prices arrive HUMANIZED from the producer — `'€9.50'`, never `9.5` (the §2
receipt precedent): the model carries the display string, the payload binds it verbatim
(`"text": "${price}"`). Currency formatting is producer work, never a renderer function call.

**Worked shape** (seed source, verbatim):

```ts
{ id: 'petiscos_list', component: 'List', gap: 'sm', children: { path: '/menu/petiscos', componentId: 'dish_tpl' } },
{ id: 'dish_tpl', component: 'Row', gap: 'md', justify: 'between', align: 'baseline', children: ['dish_col', 'dish_price'] },
{ id: 'dish_name', component: 'Text', text: '${name}' },
{ id: 'dish_price', component: 'Text', text: '${price}' },
{ id: 'sec_wines', component: 'Disclosure', summary: 'Wines by the glass', open: true, children: ['wines_list'] },
```

**Policies + consequences.** Sections are templated with relative binds, so the agent regenerates a
section by rewriting ONE array — never the tree. The seed ships the Disclosure `open: true` so the
render smoke exercises its rows; a producer folds it shut on a crowded surface. **Boundary:** a
menu the user ORDERS from adds per-row actions and routes toward the form patterns
(`bindings-actions-checks.md`); this pattern is the read-only browse surface.

## 7 · Travel itinerary (seed: `travel-itinerary`, pack B)

**Mechanism.** The day's events on a `Timeline` spine — each `TimelineItem`'s `status` carries
past/current/future (`done` · `active` · `pending`, from its catalog enum) — with the ACTIVE
event's detail broken out BESIDE the spine as a Card whose header Row pairs a typed intent `Badge`
with the title.

**Timeline-leaf reality (the deviation, stated loudly).** `TimelineItem` is a LEAF: its catalog
entry declares only `status/label/description/timestamp/icon` and NO `children` — so the
disposition sketch's "Badge type + detail Card INSIDE the item" is NOT expressible. The event type
rides each item's own typed fields; ONE detail Card (typed Badge · bound substance · footer action)
accompanies the timeline for the event that matters now. Emitting a `TimelineItem` with `children`
is a validate failure, not a rendering nuance.

**Worked shape** (seed source, verbatim):

```ts
{ id: 'spine', component: 'Timeline', label: 'Saturday itinerary', children: ['ev_flight', 'ev_hotel', 'ev_dinner', 'ev_fado'] },
{ id: 'ev_hotel', component: 'TimelineItem', status: 'active', label: 'Check in — Memmo Alfama', description: 'Room ready from 15:00.', timestamp: '15:00' },
{ id: 'det_id_row', component: 'Row', gap: 'sm', align: 'center', children: ['det_badge', 'det_title'] },
{ id: 'det_badge', component: 'Badge', intent: 'info', label: { path: '/upNext/type' } },
```

**Policies + consequences.** The detail card's fields are ALL bound (`/upNext/*`) so the agent
retargets it to the next event with one `updateDataModel` — never resending the spine. Advancing an
event's status is a resend of that ONE TimelineItem record IN FULL (the whole-node-replace law —
SKILL.md's first Common trap). **Boundary:** a process the AGENT is running live (steps streaming
in) is the status-stream idiom, not this itinerary snapshot.

## 8 · Wizard step, presentation (seed: `wizard-step-progress`, pack B)

**Mechanism.** The visual anatomy of ONE wizard step as a snapshot: `Column > Progress` meter
pinning "step N of M" (`value`/`max` both bound — advancing the meter is a one-path data write),
the step's title, its selection body (`RadioGroup` with `value` on the step's OWN dataModel path —
`/wizard/plan` here; each step binds a DISTINCT path, the state-per-step law), and the
`Row{ghost Back · solid Next}` nav pair.

**Worked shape** (seed source, verbatim):

```ts
{ id: 'meter', component: 'Progress', label: 'Setup — step 2 of 3', value: { path: '/wizard/step' }, max: { path: '/wizard/steps' } },
{ id: 'plans', component: 'RadioGroup', value: { path: '/wizard/plan' }, orientation: 'vertical', children: ['plan_solo', 'plan_team', 'plan_business'] },
{ id: 'btn_back', component: 'Button', variant: 'ghost', label: 'Back', action: { action: 'wizard_step', context: { to: 1 }, wantResponse: false } },
{ id: 'btn_next', component: 'Button', variant: 'solid', label: 'Next', action: { action: 'wizard_step', context: { to: 3 } } },
```

**Presentation vs. protocol (the known confusable — get this boundary right).** This pattern is
DISTINCT from the `backable-wizard` seed (`catalog-frontier.ts`, GH #1192): THAT seed is the
FLOW-PROTOCOL exemplar — one ask surface across turns, root-immutability, the scene-resend +
draft-persistence (`/draft/*`) mechanics of going Back. THIS pattern is the single-turn
PRESENTATION composition — what one step LOOKS like (meter + body + nav) — and never exercises the
multi-turn scene-swap protocol. A producer building a real flow combines THIS anatomy with THAT
protocol; a producer asked only to "show where I am in the flow" emits this snapshot alone.
**Consequence of confusing them:** re-emitting `id:"root"` per step (presentation thinking applied
to a live flow) trips the never-resend-root law (runtime SPEC-R3 AC2 — the second root delivery is
dropped); the protocol seed's stable-root + swapped-scene shape exists exactly to avoid that.
