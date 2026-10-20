---
id: T-0196
title: "Amount picker pattern (the missing Stepper): one bound number with chips, +/- or slider, bounds, step and one commit"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`mini-skills/quantity.md` calls a number picker "a fleet gap"; one idiom has four spellings today (Slider, number TextField, Slider plus Button, chips).

## Intent
- Do: a default-catalog control or composite for picking a bounded number and committing it: preset chips (optional), minus and plus, optional slider, min, max, step, bound value, one commit action, read-only formatted value (units, currency through the codec). Compare with the CardTable bet strip (T-0172), which stays a fixed strip for blackjack.
- Evidence: negotiator `deal-sheet` (`agent-admin-libraries.ts` about :305, Slider plus Offer Button), shopkeeper quantity (corpus `product-options-quantity`), concierge party size (trace 6 Slider, `booking-flow` number TextField), Croupier's old bet Card+Slider+Button (traces 1, 11).
- Adopt in Negotiator, Shopkeeper, Concierge and BookingForm's stepper kind (T-0197).
- Done when: the common process below is complete.

## Context
- Pattern sweep 2026-10-14 (all 15 presets, `.agent-traces/2026-10-14.jsonl`, corpus, fixtures); Kim ticketed it the same day. Process like T-0193 (OptionDeck): design intake with skill `component-design` (precedent sweep, fork sheet, decisions recorded in this ticket, ADRs retired), then a mockup at widget / md on the A2UI canvas, light and dark and the 400px column, approved by Kim before any build; then control or composite, descriptor, default catalog row with `selection.json` intents and notFor, mini-skill, factory and browser tests in both engines, visual golden, render lint clean; adopt in the presets and bump their seedVersion and manifests; live `npm run chat:probe` on Haiku 5.5 and Sonnet 5.5 (conductor runs live).
- Commit off origin/main, never push. Zero dependencies; light DOM, ARIA via ElementInternals; no buttons inside card containers (Kim 2026-10-14).

## Constraints
- No em dashes.

## Design
Design intake for T-0196 (skill `component-design` steps 1 to 6 plus its Naming section, 2026-10-20). ADRs are retired (T-0164), so this ticket holds the decisions. The step ends at the human gate: the forks at the end wait for Kim, and Kim's answers go under each one.

### Job
`ui-amount-picker` lets a person pick one bounded number (min, max, step) with minus and plus, optional preset chips and an optional slider, sees it formatted as a number, a currency amount or a unit amount, and commits it once.

### Naming (naming.md sections 10, 12, 13)
Family `amount-picker`. Derived from it with no further choice: folder `packages/agent-ui/components/src/controls/amount-picker/`, tag `ui-amount-picker`, class `UIAmountPickerElement`, catalog type `AmountPicker`, tokens `--ui-amount-picker-*`, subpath `./controls/amount-picker`, descriptor `amount-picker.md`, pages `amount-picker-{doc,demo}.html`. Confirmed as settled.
1. Namespaces entered: tag, class, folder, descriptor, token prefix, parts (`data-part`), catalog type, `selection.json` key, components subpath, site pages. All derive from the family name.
2. Reserved-word and concept-canon collisions: "stepper" already names the wizard-step concept (`site/pages/onboarding-checklist.ts:7`, the `ui-stepper` mint-last decision), so `ui-stepper` would mean two things; `amount-picker` collides with nothing. Props reuse the canon: `value` is the FACE value, `label` the accessible name and reflects, `min`/`max` take the value-domain numeric sense (the slider sense, naming.md section 3), `currency` and `unit` keep `ui-text-field`'s exact meaning (ISO 4217 code, CLDR unit id), `actionName`/`action-name` follows the BoardGrid and service-card kebab precedent. No new prop name needs a ruling. The mini-skill word "Stepper" in `mini-skills/quantity.md` is retired by the build.
3. Closed sets: none joined. Events stay `input`, `change`, `action` (naming.md section 4); `tier: pattern` and the `UIFormElement` base are existing members; parts are nouns declared in the descriptor.
4. Prefix and ownership: `--ui-amount-picker-*` is declared only in `amount-picker.css`; the control consumes `--md-sys-*` foundations and composes `ui-slider` and `ui-glyph` without declaring their tokens.
5. Derivable: yes, the section 13 derivation gives every name above from the one family decision. No section 12 exception is extended.

### Precedent sweep
Read end to end: the `ui-slider`, `ui-text-field` and `ui-segmented-control` descriptors, `controls/_base/range-element.ts`, `traits/value-codec.ts` (the Intl helpers), the CardTable bet strip in `a2ui/src/catalog/personas/croupier/factories.ts` (T-0172), the `ProductCard` and `BoardGrid` descriptors and catalog rows, the default `selection.json`, and `mint-vs-compose.md`.
- `ui-slider` (Range class, `UIRangeElement`): owns clamp and snap (`#normalize`), keyboard step, `label`, and an always-visible readout. Its `change` commits on blur. It has no discrete plus and minus, no presets, no formatting hook on the wire, and no commit action. `range-element.ts` sets `internals.role = 'slider'` before the `ownsValueModel()` gate, so anything that extends the Range base is announced as a slider.
- `ui-text-field` `type=number|currency|unit`: owns the minus and plus `<button data-part="step-down|step-up">` pair with `ui-glyph` marks (the minus-left, plus-right order, GH #1406), ArrowUp and ArrowDown, and the codec (`currencyCodecOptions`, `currencySymbol`, `unitLabel`). Its value is a string, its bounds are strings with native `<input min>` parity, it is a typing surface, and it has no presets, slider or commit action.
- `ui-segmented-control`: a single-select of labelled options. A preset row of numbers is not a one-of choice (the value can sit between presets), and `quantity.md` already forbids "a SegmentedControl of numbers as a stand-in stepper".
- CardTable bet strip (T-0172): one `lg` soft `ui-button` per fixed amount (25, 50, 75, 100, 250, no wire prop), an amount above the bankroll disabled, a press writes `bet` (a bubbling `change` read through `a2uiCardTableBet`) and then fires `action` with `{action: betAction, context: {bet, bankrollAfterBet}}`. Reused here: the "one press, one value write, then one action with the value in context" order, and the bound-disables-the-option rule. It stays as it is (a fixed strip owned by the table).
- `ProductCard` and `BoardGrid`: the action wiring. `BoardGrid.actionName` is a plain string with `"actionEvent": "action"` on the row (`catalog.json:1029`) and the element emits `action` with `{action, context}`; ProductCard's `action` part is the sanctioned descriptor-documented internal `<button data-part>`. The picker takes the BoardGrid string form (`actionName`), not ProductCard's object form, because the context is the picker's own value, never author data.
- Pattern rows reused (component-patterns): trait `(host, opts) => cleanup` and `controls/_base/` plumbing (ADR-0010, ADR-0042), the value codec helpers (ADR-0047), the FUNCTION arm's root-cause rule that the data model stays numeric (ADR-0217).

Why a new control and not a Slider variant: a Slider variant would have to change the slider's role (slider to group plus spinbutton), its commit model (blur to an explicit action), its anatomy (two buttons, a chip row and a commit button around the rail) and its wire (presets, currency, unit, actionName) all at once; four axes flipping together is two controls (step 1's mechanics test). On the TYPE arm (`mint-vs-compose.md`, ADR-0220) the gap is not a teaching gap: the four spellings in the traces (Slider, number TextField, Slider plus Button, chips) each bind the number, but no shipped row carries one bound number together with discrete steps, presets that reflect the current value, a formatted readout and one commit action that carries the value, so the producer writes three loosely coupled nodes that drift (T-0172's slider reading 160 while the bet was 50). The aggregate-value bar (ADR-0175) does not apply: the value is a scalar; `presets` is configuration, not the value.

### Three axes
- Base class: `UIFormElement`. The picker is value-bearing (FACE) but not a Range: extending `UIRangeElement` forces `role="slider"` on the host. Build note, not a fork: lift the Range base's clamp and snap rule (`#normalize`, `decimalPlaces`) into one exported pure helper in `controls/_base/` that both the Range base and the picker call, so the snapping law has one home.
- Size class (`tier:`): `pattern`. Geometry.md's Pattern band (container plus control-height rows): the stepper row, the chip row and the commit row are each a `4n` control row; the optional slider row composes `ui-slider`'s indicator box.
- Catalog posture: emittable. A default-catalog `AmountPicker` row lands with the build, with a `selection.json` entry: intents "pick a quantity or amount with plus and minus", "a bounded number with presets and one commit"; `notFor` names `Slider` (why: "a free drag with no presets or commit") and `TextField` (why: "a typed number or free-form amount"). Slider's and TextField's own `notFor` gain `AmountPicker` back.

### Wire contract (confirmed)
- `"value": { "prop": "value", "event": "change" }`, the Slider row's two-way mark.
- `actionName` with `"mapsTo": "actionName", "actionEvent": "action"`, the BoardGrid row (T-0081). The emitted detail is `{ action: actionName, context: { value } }`; `value` is the number, unformatted.
- Row properties: `value` (number, bindable), `min`, `max`, `step` (number), `presets` (array of numbers), `slider` (boolean), `currency` (string), `unit` (string), `label` (string, bindable), `actionName` (string), `actionLabel` (string), `disabled` (boolean, bindable), `name` (string), `required` (boolean).
- DOM events stay inside the ADR-0153 set: `input`, `change`, `action`.

### Fork sheet
| Row | Decision | Reason |
|---|---|---|
| Tag | `ui-amount-picker`, class `UIAmountPickerElement`, catalog `AmountPicker` | the section 13 derivation from family `amount-picker`; `ui-stepper` collides with the wizard-step concept |
| Anatomy | host-as-grid, all control-created parts, no author slots: `label` (text, `aria-hidden`), `readout` (the formatted value), `decrease` and `increase` (`<button data-part>` with `ui-glyph` minus and plus, readout between them), `presets` row of `preset` buttons (absent when `presets` is empty), `slider` (a composed `ui-slider`, absent unless `slider`), `commit` (`<button data-part>`, absent when `actionName` is empty). No card chrome: the picker sits inside the producer's layout and never draws a card around its buttons | the text-field stepper parts and ProductCard's action part are the sanctioned internal non-value activation buttons; composing `ui-slider` reuses the shipped rail instead of a second one |
| Props | `value` number 0 reflect; `min` number 0 reflect; `max` number 100 reflect; `step` number 1 reflect; `presets` json number[] default [] (codec drops non-finite and out-of-bounds entries, sorts, dedupes); `slider` boolean false reflect; `currency` string '' reflect; `unit` string '' reflect; `label` string '' reflect; `actionName` string '' attribute `action-name`; `actionLabel` string '' attribute `action-label` (empty reads "Confirm"); `size` enum sm, md, lg default md reflect; `inline` boolean false reflect; plus `name`, `disabled`, `required` from formProps | canon names only (section 3); `currency` and `unit` mirror `ui-text-field`; `inline` is ADR-0223's one sizing opt-out the sizing gate requires |
| Events | `input` on every live change (preset, minus, plus, arrow keys, slider drag); `change` on every discrete user commit of the value (a preset, minus or plus press, a key step on blur, a slider release); `action` once per commit press, detail `{action: actionName, context: {value}}`, after the value is written. None from programmatic writes | all three are in the closed set; the press order (value, then action) is the T-0172 bet-strip order, so a bound data model holds the value the action reports |
| Geometry | rows are the control row `4n` (`--md-sys-height`): `decrease` and `increase` are square `4n` with the glyph box `n + 6` centred (ADR-0245 cl.3); the readout takes `1fr` between them with tabular numerals and a min inline size from the longest formatted bound; preset buttons and commit are control-height pills (`--md-sys-control-radius`, label inset `2n - c`); row gap `--md-sys-group-gutter`; the slider row is `ui-slider`'s own box. At widget md (the A2UI canvas) that is 24px rows; `size` sm and lg give 20 and 28 | the Pattern band law; every length reads a derived foundation, no px literal (the foundations census) |
| Tokens | `--ui-amount-picker-gap`, `-readout-ink` (neutral-on-surface), `-label-ink` (neutral-on-surface-variant), `-step-bg`/`-step-ink` (`neutral-container-low`, `neutral-on-surface`), `-preset-bg`/`-preset-ink` (`primary-container-low`, `primary-high`, the soft-button pair), `-preset-selected-bg`/`-preset-selected-ink` (`primary-fill`, `primary-on-primary`), `-commit-bg`/`-commit-ink` (`primary-fill`, `primary-on-primary`, the solid-button pair), each `--md-sys-color-*`. Non-color signifiers: the selected preset carries `aria-pressed="true"` and a check glyph before its label; a bound-side button is `disabled` and its glyph drops to the disabled ink with no hover wash | one owner prefix; color never the only carrier (ADR-0057) |
| A11y | host: `internals.role = 'group'`, `internals.ariaLabel = label`. The `readout` part carries `role="spinbutton"`, `tabindex="0"`, `aria-valuenow`/`-valuemin`/`-valuemax` and `aria-valuetext` (the formatted string, "$25.00", "3 guests"), and owns the keyboard: ArrowUp/ArrowRight +step, ArrowDown/ArrowLeft -step, PageUp/PageDown 10 steps, Home/End min/max, Enter fires the commit when `actionName` is set. `decrease`/`increase` are `tabindex="-1"` (the APG spinbutton pattern) with aria-labels "Decrease"/"Increase"; preset buttons stay in tab order with `aria-pressed`; the composed slider carries the same label; commit's accessible name is `actionLabel` | the role on a control-created part follows `ui-text-field`'s editor precedent (host role-free of attributes, ARIA through internals or the part) |
| Interaction states | no deviation from the four-state law (`interaction-states.md`); disabled host disables every part | nothing new to rule |
| Form participation | FACE value `String(value)` after clamp and snap; no validity constraint raised (always a number in range, slider parity; `required` is informational); no labelling-seam change: inside `ui-field` the field's label ids land on the readout's `aria-labelledby`, as on text-field's editor | value is a scalar, so the ADR-0175 aggregate bar does not apply |
| Site surfaces | descriptor `amount-picker.md`; `amount-picker-doc.html` and `-demo.html`; a gallery preview specimen with one knob per prop (a quantity with presets 1, 2, 4, 8 and a currency bet with the slider); the default catalog row, `selection.json` entry and both `notFor` back-links; `mini-skills/quantity.md` rewritten to teach AmountPicker; regenerated `registry.gen.ts`, `all.gen.*`, `*.props.gen.ts`, `assets.gen.ts`, `selection-projection.gen.ts` by their scripts | the standing descriptor, site, catalog-or-allowlist (ADR-0087), sizing and naming gates read these |

### Formatting codec
The readout is display only: no typing surface in this control (typed entry is `TextField type=number`). It formats with the shared `traits/value-codec.ts` helpers, never a new codec: `currency` non-empty wins and formats with `Intl.NumberFormat` `style: 'currency'` (fraction digits from the currency, `currencyCodecOptions` and `currencySymbol`); else `unit` non-empty formats with `style: 'unit'`, `unitDisplay: 'short'` (`unitLabel`); else plain grouped `Intl.NumberFormat`. The same string feeds the readout and `aria-valuetext`, and preset chip labels use the same formatter. The value, the form value, the bound data-model path and the action context stay numeric (the ADR-0217 root-cause rule: one locale is never baked into the data). The catalog `formatCurrency` function is not used here because the readout is not a bound text prop.

### Adoption scope (confirmed)
- Negotiator: the `deal-sheet` skill offer (replaces the Slider for the offer; Offer, Accept and Walk away stay a SegmentedControl plus the one Send Button, or the picker's commit carries the offer, decided at that step).
- Shopkeeper: the `cart-summary` quantity.
- Concierge: `booking-flow` scene 2, guests (replaces Field plus TextField type number).
- Out of scope: BookingForm's `stepper` kind (T-0197, depends on this ticket); CardTable's bet strip (T-0172) stays as it is.

### Test plan
- Factory: `a2ui/src/catalog/default/factories.test.ts` builds `AmountPicker` from the row (every property maps, presets array, `actionName` routes `action` to the A2UI action with `{value}` in context, the value mark reads `change`); conformance and catalog-or-allowlist pass.
- jsdom (`amount-picker.test.ts`): descriptor-to-props trip-wire; clamp and snap on every write (shared helper); minus and plus disabled at the bound; presets codec (drop, sort, dedupe); `input` and `change` per press and none on programmatic writes; `action` after the value write with the right detail and none when `actionName` is empty; formatting for number, USD, JPY and a unit; FACE form value.
- Browser in Chromium and WebKit (`amount-picker.browser.test.ts`): keyboard map on the readout, tab order (minus and plus skipped), slider and readout stay in sync, ARIA through internals and the readout part, geometry at widget md (24px rows, square steps, glyph box), sizing gate (fill and `inline`).
- Visual golden (`amount-picker.visual.browser.test.ts`): the mockup's states, light and dark.
- Dogfood render lint (`site/pages/dogfood-render.browser.test.ts`): the demo and catalog widget pass computed radius, height, text edge, type floor and the 400px column; `foundations-census --gate` and `dogfood-compose --gate` clean with no allowlist lines added.

### Forks for Kim
Each fork has a firm recommendation. Kim's answer goes on the `Answer:` line.
1. Name: `ui-amount-picker` / `AmountPicker`, not `ui-stepper` (wizard-step collision) and not `ui-number-picker` (the value can be money or a unit). Recommendation: `ui-amount-picker`. Answer: Kim 2026-10-20: as recommended.
2. Commit inside the control: the picker renders its own commit button when `actionName` is set, so one node carries both the value and the commit; a producer may still omit `actionName` and commit with a sibling Button. Recommendation: commit inside, optional. Answer: Kim 2026-10-20: as recommended.
3. Typed entry in the readout: not in v1; a typed amount is `TextField type=number`. Recommendation: display-only readout. Answer: Kim 2026-10-20: as recommended.
4. Preset chips follow the value: a chip reads selected only when the value equals it (a minus press after a chip clears the selection), never a sticky choice. Recommendation: derived, not stored. Answer: Kim 2026-10-20: as recommended.
5. Slider on large ranges: `slider` is the producer's choice; the mini-skill teaches it for ranges over about 20 steps and never for small counts. Recommendation: producer-chosen boolean, taught. Answer: Kim 2026-10-20: as recommended.

## Plan review
- Kim 2026-10-20: approved the AmountPicker mockup as drawn, with all five fork recommendations.
