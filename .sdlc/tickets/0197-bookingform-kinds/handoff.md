---
id: T-0197
title: "BookingForm field kinds (dateRange, radio, time, stepper) and sharing it with the Maitre d'"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0196]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
budget_usd: 60
---

## Goal
The Concierge hand-built a booking form although `BookingForm` is in its catalog, because the form cannot express the ask (trace 6: RadioGroup restaurant, Calendar single date, time TextField, party-size Slider).

## Intent
- Do: add field kinds `dateRange`, `radio`, `time` and `stepper` (stepper uses T-0196's control) to `BookingForm`; single dates stay `ui-text-field type=date` (T-0135); move BookingForm from the concierge fragment to a shared hospitality fragment or the default catalog so the Maitre d' (no fragment today, `localPatterns` unset) gets it; teach "never rebuild a booking form from primitives" in both presets and the `booking-flow` and `table-reservation` playbooks.
- Done when: the common process below is complete, and a live Concierge and Maitre d' table booking renders BookingForm on both models.

## Context
- Pattern sweep 2026-10-14 (all 15 presets, `.agent-traces/2026-10-14.jsonl`, corpus, fixtures); Kim ticketed it the same day. Process like T-0193 (OptionDeck): design intake with skill `component-design` (precedent sweep, fork sheet, decisions recorded in this ticket, ADRs retired), then a mockup at widget / md on the A2UI canvas, light and dark and the 400px column, approved by Kim before any build; then control or composite, descriptor, default catalog row with `selection.json` intents and notFor, mini-skill, factory and browser tests in both engines, visual golden, render lint clean; adopt in the presets and bump their seedVersion and manifests; live `npm run chat:probe` on Haiku 5.5 and Sonnet 5.5 (conductor runs live).
- Commit off origin/main, never push. Zero dependencies; light DOM, ARIA via ElementInternals; no buttons inside card containers (Kim 2026-10-14).

## Constraints
- No em dashes.

## Notes
Lessons from the T-0193, T-0195 and T-0196 wave (2026-10-20). Plan for each one up front so the plan review passes the first time:
- Each catalog type holds at most 4 `notFor` edges (`NOT_FOR_MAX`), every edge must be reciprocal, and a domain sidecar can append one more. Count the free slots on every type you link to before you name the edges.
- A new default-catalog row has to be placed IN or OUT of the feed partition (`agent/feed-catalog.ts`), with its count pin. It also needs a frontier seed or an exemption, the `actionEvent` pin in `catalog/default/index.test.ts`, and a site tier row.
- The renderer treats any object with a string `path` key as a binding, so never teach a literal `{label, path}` prop.
- Re-measure the prompt, selection and dogfood budgets with dated lines, and recapture prompt-equivalence deliberately.
- grammar.md is byte-pinned (Kim's ruling plus the debate rule). Persona and playbook text is model-read, so keep it unambiguous.
- A docs nav group holds at most 10 tags.
- Bump the persona seedVersions, run the manifest writer and re-pin the seed digests.
- The ambient library entry budget is 200 B per entry.
- Run node with `env -u NODE_OPTIONS`, and heavy gates through gate_lock.
- The live chat:probe on Haiku and Sonnet is folded into the round 13 live run.

## Design
Design intake for T-0197 (skill `component-design` steps 1 to 6 for a change to an existing composite, the T-0196 shape, 2026-10-20). ADRs are retired (T-0164), so this ticket holds the decisions. No new control and no new catalog type: four field kinds on `BookingForm` and a new home for the concierge fragment. The step ends at the human gate: the forks at the end wait for Kim, and Kim's answers go under each one. Mockup: `mockup/booking-form.html` (real controls, served through Vite), screenshots `mockup/widget-light.png`, `widget-dark.png`, `widget-400.png` (git-ignored, in the lane tree).

### Job
`BookingForm` lets a guest give every detail of one booking in one card (a date or a stay, a fixed choice such as a seating, a time, a party size, a room, notes) and submit it with one button, so the producer never rebuilds a booking form from RadioGroup, Calendar, a time TextField and a Slider (trace 6), and the Maitre d' gets the same form as the Concierge.

### Precedent sweep
Read end to end: the concierge fragment (`a2ui/src/catalog/personas/concierge/`: `catalog.json`, `factories.ts`, `selection.json`, `manifest.ts`, `index.ts`, the head of `checks.ts`), the domain mechanism (`catalog/domains/{index,body,manifests}.ts`, `compose.ts` `DomainCatalogManifest`/`DomainCatalogPackage` at 342-361), `resolveEffectiveCatalogId` (`app/src/controls/agent-admin/agent-admin-schema.ts:612-629`), `DOMAIN_ALIASES` (same file, 586-591), the preset identity check (`site/lib/agent-manifest/agent-manifest.ts:224`), the catalog architecture SPEC (§4 rows 152-153, §5.4 rows 200-201), the `ui-amount-picker`, `ui-text-field` and `ui-radio-group` descriptors, the default `selection.json` notFor counts, the concierge and restaurant `agent.md` front matter, and the T-0196 `## Design`.
- `bookingFormFactory` (factories.ts:373-447) already mints a multi-control subtree: `ui-form-provider` root painted as the card surface and a `[data-box]`, an h4 `ui-text` title, a `fields` column, one `ui-field` per control (the `checkbox` kind too, `labelledField` at 159-165, although the header comment calls it self-labelled), a `date-row` flex run for consecutive `dateSingle` fields (256-346: side by side at two 12rem, the later field's `min` is the earlier date, an earlier pick that passes a later one clears it), and the producer's one child Button stepped to md (`sizedActionButtons(el, 'md')`). The aggregate is `ui-form-provider.values()`, one scalar per `name` (`a2uiFormValue`, 404-409). Every new kind reuses this, nothing in the renderer changes.
- The `checkbox` kind (185-197) is the radio precedent: a `ui-radio-group orientation=horizontal` of `ui-radio` under a `ui-field`. `radio` is the same build with the item's `options` in place of Yes and No.
- The `text`/`number` branch (199-215) is the time precedent: `ui-text-field` with `type` set; `type=time` ships (ADR-0048, text-field.md:39 enum, its codec submits the canonical parsed value, text-field.md:157).
- `ui-amount-picker` (T-0196) is a `UIFormElement` with `name`, `min`, `max`, `step`, `label` and an optional `actionName`; with `actionName` empty it renders no commit part, and it hides its own label part when a `ui-field` owns the label (amount-picker.md:130). Inside `ui-form-provider` it is one more FACE descendant, so `values()` and the required gate pick it up with no change.
- The domain mechanism has shipped with no domain: `SHIPPED_DOMAIN_CATALOGS` and `SHIPPED_DOMAIN_CATALOG_MANIFESTS` are both `[]` (W0, "games, hospitality and design domains arrive in W1"), and no preset sets `domains` today. Hospitality is the first shipped domain, so this ticket is also the mechanism's first end-to-end run (`records.test.ts` holds the two lists equal; `DomainCatalogManifest.semanticChecks` exists for the moved `checks.ts`, D4).
- `resolveEffectiveCatalogId` returns on a `domains` selection before it reads `localPatterns` (agent-admin-schema.ts:620-624), so one preset cannot carry both, which is why the whole fragment moves and not only `BookingForm`.
- The persona identity check (agent-manifest.ts:224) refuses a preset whose `localPatterns` is not its own manifest's `fragment.personaId`, so the Maitre d' cannot borrow `"localPatterns": "concierge"`.
- Default `selection.json` today: `TextField` notFor is full at 4 (Textarea, Calendar, ComboBox, AmountPicker); `RadioGroup` is full at 4 (Checkbox, Select, SegmentedControl, ChoiceGroup); `AmountPicker` holds 2; `Calendar` 1. BookingForm's fragment edges are BookingConfirmation, TextField, Column; a domain-to-base edge is exempt from reciprocity (SPEC §5 line 66, D8), so the move adds no reciprocal edge.
- The id `agent-ui--concierge` is cited by 75 files under `packages`, `site` and `scripts` (corpus shard `corpus/exemplar/v1_0/agent-ui--concierge.jsonl` and `corpus/index.json`, `retrieve-presets.test.ts`, `records.test.ts`, `compose.test.ts`, the concierge tests, the worker, `prompt-budget.ts`, `examples/domain-seeds.ts`, the agent-eval `persona-cases.json`, and the concierge probe replays under `scripts/e2e-admin/probe/replays/`). The move turns it into `agent-ui--hospitality`, so each site is re-pointed or re-recorded in the build, not left for a later builder to find.

Why no new control and no new type: every kind is a shipped control already used inside this composite or a sibling (`ui-radio-group`, `ui-text-field type=time`, `ui-amount-picker`, the date pair). The gap in trace 6 is expressiveness of the `kind` enum, a wire gap, not a missing control (mint-vs-compose TYPE arm: the producer could not say "two to five fixed choices", "a time" or "a party size" in one BookingForm, so it left the composite).

### Wire contract
- `fields[].kind` enum grows from `dateSingle | select | checkbox | text | number` to add `dateRange | radio | time | stepper`.
- New optional item properties: `endPath` (string, `dateRange` only, required for it), `endLabel` (string, `dateRange` only, default "End date"), `min`, `max`, `step` (number, `stepper` only; absent falls to the control's defaults). `options` (already on the item) now also feeds `radio`.
- Submitted value per new kind, one scalar per path in the aggregate: `dateRange` writes two ISO `YYYY-MM-DD` strings, under `path` (start) and `endPath` (end); `radio` writes the chosen option's `value`; `time` writes the text-field codec's canonical time string (`HH:MM`); `stepper` writes the picker's FACE `String(value)`, the same string shape `number` submits. `BookingConfirmation` and `ConfirmReceipt` rows read these unchanged (`displayValue`, factories.ts:96).
- Prefill (`applyProp('value', obj)`): `dateRange` sets each end from `obj[path]` and `obj[endPath]` and re-holds the run; `radio` sets the group value to `String(raw)`; `time` writes `String(raw)`; `stepper` writes `Number(raw)` when finite, else leaves the control's default.
- `endPath` is not a binding. The renderer resolves bindings on a top-level prop value only (factories.ts header, lines 8-15), and `fields` is a literal array whose items already carry a string `path` today without being read as bindings. The Notes landmine (an object with a string `path` key is a binding) applies to a top-level prop, never to a `fields` item.
- `BookingForm` keeps `children: "child"` and the one producer Button; no new prop, no new event, no renderer change.

### Fork sheet
| Row | Decision | Reason |
|---|---|---|
| Home | the whole concierge fragment (`BookingForm`, `BookingConfirmation`, `checks.ts`, factories, `selection.json`, tests) moves to `a2ui/src/catalog/domains/hospitality/` with a `manifest.ts` (semanticChecks carried) and joins `SHIPPED_DOMAIN_CATALOGS` and its manifests twin; the concierge preset swaps `"localPatterns": "concierge"` for `"domains": ["hospitality"]`; the restaurant preset gains `"domains": ["hospitality"]` | SPEC §5.4 row 200 ("hospitality (T-0197 moves it there)") and §4 rows 152-153; `DOMAIN_ALIASES` already maps `concierge` to `hospitality`; `resolveEffectiveCatalogId` lets `domains` win over `localPatterns`; the identity check refuses a borrowed fragment; the default catalog is ruled out because `TextField` has no free notFor slot and a default row also needs a feed-partition placement, a frontier seed, the `actionEvent` pin and a site tier row |
| `dateRange` | one item, `path` + required `endPath`, `label` + optional `endLabel`; renders as the shipped linked `date-row` pair of `ui-text-field type=date`; no `endPath` renders as `dateSingle` | each date stays a scalar per path (`ui-calendar mode="range"` commits a two-entry FormData that `values()` does not flatten); the run logic already exists |
| `radio` | `ui-radio-group orientation=horizontal` of the item's `options` under a `ui-field`, the `checkbox` build; taught for two to five fixed choices, `select` for more | the shipped precedent; RadioGroup's own default notFor already holds Select, so the threshold is teaching, not a new edge |
| `time` | `ui-text-field type=time` under a `ui-field`, on the `text`/`number` branch | ADR-0048 ships the type and codec |
| `stepper` | `ui-amount-picker` with no `actionName` (no inner commit; the producer's one Button still submits), `min`/`max`/`step` from the item; labelled per fork 5 | T-0196 Adoption scope names this kind as the follow-up; the picker is a FACE descendant, so the gate and aggregate need no change |
| Factory `uses` | add `ui-amount-picker` to `bookingFormFactory.uses` (ADR-0233) | the composite now mints it |
| Look | no change to the composite's box: the root is the form surface (T-0085, the ADR-0046 region-less card reading) and the producer's Button sits inside it at md | Kim's "no buttons inside card containers" (2026-10-14, ticket Context) is about a Card wrapping a choice or an action; BookingForm's root is the form itself, settled at T-0085. Named here so Kim can overturn it if the ruling reaches this composite |
| Restaurant skills | the restaurant drops `hotel-booking-form@1` | that skill teaches the primitive form (Card, date TextField, Select, Slider, Checkboxes, one Submit); the concierge excludes it for the same reason (concierge `agent.md:50`) |
| Teaching | both presets and the `booking-flow` and `table-reservation` playbooks say "never rebuild a booking form from primitives", naming each kind by the guest's words (a seating, a time, a party size, a stay) | ticket Intent; persona and playbook text is model-read, so one unambiguous line each |

Observed in the mockup, for the build (not forks): the `ui-radio` option text renders larger than the field text at widget md (sheet 1 and 3 "18:00 / 20:30"; the shipped `checkbox` kind shares it), and in the 400px column, and in any canvas under about 24rem of form width, the `dateRange` pair stacks (each date field is `flex: 1 1 12rem`), so side by side appears only on wider canvases.

### Test plan
- Catalog: `catalog.json` kind enum and the new item properties; `selection.json` intents gain "a stay from arrival to departure", "a seating or time", "party size"; the `notFor` set unchanged in count (domain-to-base edges exempt).
- Factory (`domains/hospitality/factories.test.ts`, moved from concierge): each new kind mints its control with the path as `name`; `dateRange` with and without `endPath`; the end field's `min` follows the start and a passing start clears the end; `radio` options; `time` type; `stepper` min, max, step, no `action-name`, label per fork 5; prefill of each kind from the bound aggregate (`Number(raw)` finite only); `a2uiFormValue` holds one scalar per path, two for a `dateRange`; `uses` lists `ui-amount-picker`.
- Checks (`checks.test.ts`, moved): `BOOKING_FIELD_PATH` (T-0293) and the T-0278 blank-required hold read `endPath` as well as `path`.
- Domain mechanism: `records.test.ts` (index equals manifests), `compose.test.ts` and `renderer-persona-catalogs.test.ts` re-pointed to `agent-ui--hospitality` and `a2ui-basic--hospitality`; `agent-manifest.ts` gate passes the concierge with no `localPatterns` and the restaurant with `domains`; `resolveEffectiveCatalogId` gives `agent-ui--hospitality` for both presets.
- Corpus and retrieval: re-home `agent-ui--concierge.jsonl` through the admission flow (skill `a2ui-corpus-curation`) or show the domain-shard path that replaces it; `retrieve-presets.test.ts` top-3 pins re-measured for concierge and restaurant.
- Browser (`concierge.browser.test.ts`, moved and renamed for the domain) in Chromium and WebKit: each new kind renders at widget md (24px rows), the `stepper` submits through the producer Button, the required gate refuses a blank `radio`; dogfood render lint clean on the catalog widget.
- Presets: concierge and restaurant seedVersion bumps, manifest writer, seed digests, `registry.gen.ts` by `generate-agent-content.mjs`; prompt, selection and dogfood budgets re-measured with dated lines; prompt-equivalence recaptured deliberately; the probe replays that pin `agent-ui--concierge` re-recorded or re-pointed.
- Live: `npm run chat:probe` Concierge and Maitre d' table booking on Haiku 5.5 and Sonnet 5.5 renders BookingForm (folded into the round 13 live run).

### Forks for Kim
Each fork has a firm recommendation. Kim's answer goes on the `Answer:` line.
1. Home: move the whole concierge fragment to the new `hospitality` domain (the first shipped domain), the concierge swaps `localPatterns` for `domains: ["hospitality"]` and the restaurant gains `domains: ["hospitality"]`. Alternatives: a default-catalog row (no free `TextField` notFor slot, plus feed, frontier, pin and tier rows), or two persona fragments (duplicate types, against SPEC §5.4). Recommendation: the hospitality domain. Answer: Kim 2026-10-20: hospitality domain.
2. `dateRange`: one item with `path` and a required `endPath`, drawn as the linked pair of date inputs (sheet 2), each date a scalar. Alternative: one range-calendar trigger, which needs `values()` to flatten a two-entry FormData and a confirmation row that reads two paths. Recommendation: the linked pair. Answer: Kim 2026-10-20: as recommended.
3. `radio`: a horizontal `ui-radio-group` of `options` under a `ui-field`, taught for two to five fixed choices, `select` for more. Recommendation: as stated. Answer: Kim 2026-10-20: as recommended.
4. `time`: `ui-text-field type=time` under a `ui-field`. Recommendation: as stated. Answer: Kim 2026-10-20: as recommended.
5. `stepper` label: the handoff settled a self-labelled `ui-amount-picker` with no `ui-field`. The mockup shows the picker's own label part in the muted, smaller label ink (sheet 1 "Covers"), unlike every other field label, and the picker hides its label part under a `ui-field` (amount-picker.md:130; sheet 3 shows the result matching the others). Recommendation: wrap the stepper in a `ui-field` like every other kind, overturning the settled choice; `min`/`max`/`step` and no `actionName` stay as settled. Answer: Kim 2026-10-20: wrap the stepper in a ui-field (sheet 3).
6. Restaurant skills: the restaurant drops `hotel-booking-form@1`, the primitive form the concierge already excludes. Recommendation: drop it. Answer: Kim 2026-10-20: drop it.

## Plan review
- Kim 2026-10-20: approved the step 1 mockup and design. Forks 1 to 6 are answered above, and the stepper sits under a ui-field.
- Kim 2026-10-20 (new scope): move the form's commit Button outside the bordered BookingForm card, under it like ConfirmReceipt's action bar (no buttons inside card containers, Kim 2026-10-14). This changes the existing composite's layout and re-baselines its goldens.
- Kim 2026-10-20 (new scope): fix the radio and checkbox option text that renders larger than the field text at widget md, in this ticket.
- Conductor: the planner L3 replans steps 2 and 3 to cover these rulings. Step 1 is done.
- Kim 2026-10-20: plan-reviewer-L1-2 said replan with mechanical findings only. Kim approved applying them directly (split steps 2 to 4 with --override-review, the step 4 criterion swap, notes into the step handoffs) instead of a third planner run.
