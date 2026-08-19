---
# suggestions.md frontmatter — the attributes-as-API descriptor for ui-suggestions (ADR-0004; ADR-0213).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site
# doc. The `attributes[]` block MUST mirror suggestions.ts `static props` (suggestions, selected) — the
# contract<->props trip-wire (suggestions-descriptor.test.ts) targets this fence. `suggestions` classifies
# by BEHAVIOUR (component-descriptor.ts `kindOf`) as `json`: its codec's `from(null)` is `[]` (an array),
# the descriptionRowsProp/tableRowsProp shape verbatim (ADR-0201's hardened-data-prop idiom, ADR-0213
# cl.2's own citation). `disabled` is intentionally ABSENT from this list — it is a plain, DERIVED getter
# (suggestions.ts), never a `static props` entry, so it carries no row here (the bijection trip-wire would
# flag it as DRIFT_EXTRA otherwise).
tag: ui-suggestions
tier: pattern          # geometry size-class — geometry.md's Pattern band ("container + control-height
                        # rows"), the segmented-control/toolbar/menu company this leaf keeps: a container
                        # of multiple independently-interactive rows. The INTERIOR chip geometry itself
                        # deliberately deviates from that band's usual control-height law: geometry.md's
                        # own "compact realm" list names `chip` alongside checkbox/switch/tag/badge — the
                        # ADR-0213 Context fact 2 wording ("deliberately lighter [than Button] — the
                        # compact chip") is exactly that law, applied to a brand-new leaf the size-class
                        # table's worked examples predate.
extends: UIElement     # NOT form-associated (ADR-0213 cl.2's {prop:'selected',event:'select'} two-way
                        # slot needs only {prop,event} — the table.md precedent for the identical shape,
                        # table.md:148: "no name/value pair, no validity/reset semantics apply")
# marginal: not yet measured via `npm run size` (new control; measure at the integration wave per
# component-testing's gates step 3 — manual by Kim's ruling).

attributes:            # attributes-as-API — mirrors suggestions.ts `static props` (suggestions, selected)
  - name: suggestions
    type: json          # {label:string, value?:string}[], JSON-string attribute form (ADR-0213 cl.2)
    default: ''         # the LIVE default is `[]` — `String([])===''` is the bijection form (the
                         # table.md/description-list.md columns/rows precedent)
    reflect: false       # NOT reflected — a JSON-string attribute round-trips through the codec, not
                          # setAttribute (the Table.rows / DescriptionList.rows posture)
    # cleanSuggestions (ADR-0213 cl.2, the ADR-0201 idiom) drops any entry whose `label` is not a
    # non-empty, non-whitespace string; a present-but-blank/absent/non-string `value` DEFAULTS to
    # `label` — every surviving item always carries a real, non-empty `value` a tap can commit through
    # `selected` without colliding with `''` (reserved for "nothing taken yet").
  - name: selected
    type: string
    default: ''          # '' = live/untaken — the one-shot law's OFF state
    reflect: true         # `<ui-suggestions selected="…">` works declaratively AND a two-way data bind
                           # (value:{prop:'selected',event:'select'}) reads it back off the attribute —
                           # the select.ts `value` prop precedent
    # ADR-0213 cl.2/cl.3 — the value mark. Non-empty ⇒ the taken suggestion's `value` string; the ENTIRE
    # set then renders SPENT (cl.3): the taken chip stays visible and marked, untaken siblings render
    # muted and inert, and the host reflects `disabled` (see `face`/`aria` below — `disabled` itself is
    # a derived getter, not a row on this list). Committing through the data model is what makes
    # spent-ness DURABLE across a history re-render (ADR-0097's frozen-history law, relocated into the
    # component per ADR-0213's own framing).

properties: []         # no manual accessors beyond the two typed props (`disabled` is a plain getter —
                        # see the frontmatter header note; it is source-truth, not a `static props` row)

events:
  - name: select
    detail: string
    description: Fired when a chip commits — a real, enabled chip click ONLY (never a programmatic `selected` write, the table.ts `#commitSelected` fleet commit law). `event.detail` is the committed `value` string (also readable off `el.selected` afterward, the ADR-0161 pull-renderer convention). Never fires a second time for the same set — the one-shot law renders every chip inert immediately after the first commit.

slots: []              # no light-DOM content model — render() stays the inherited no-op; every chip is
                        # component-built (createElement + replaceChildren, the description-list.ts whole-
                        # swap shape), never author-slotted (ADR-0213 cl.1 — a leaf, no ChildList)

parts:
  - name: chip
    description: One `<button type="button" data-part="chip">` per surviving suggestion (post-`cleanSuggestions`) — a plain internal activation part (NOT the table.md checkbox/radio "sanctioned no-native-form-elements exception"; the same class as `select.ts`'s `<button data-part="trigger">` / `table.ts`'s `<button data-part="sort-button">`, neither of which carries a submittable form value). Rebuilt whole-array-swap on every `suggestions`/`selected` change (the description-list.ts/table.ts VIEW-effect shape). Carries `aria-pressed` (`"true"` for the taken chip, `"false"` otherwise) and, once the set is spent, a real native `disabled` — pointer AND keyboard inertness for free, on every chip including the taken one. The taken chip additionally carries `[data-taken]` for its distinct paint (suggestions.css) and stays in the DOM (never removed) so the history record shows what was offered and taken.

customStates:
  - ready
    # The motion gate (interaction-states standard, button.ts precedent) — added via
    # `requestAnimationFrame` one frame past first connect, optional-chained (jsdom has no
    # CustomStateSet). Presentation-only: gates the hover/active/taken transition so the first paint
    # never animates in.

face:
  formAssociated: false  # NOT a FACE form control — the table.md precedent for an identical
                          # {prop,event} two-way slot: no name/value pair, no validity/reset semantics

aria:
  role: none              # the HOST mints no role at all (the table.md/description-list.md precedent) —
                           # every chip is a REAL native <button>, which already carries its own
                           # role=button + name-from-content; a host role would add nothing
  roleSource: native-button
  labelSource: none        # no `label`/accessible-name prop is offered by ADR-0213 — each chip's own
                            # text content IS its accessible name; an unnamed host set is an accepted
                            # residual (the table.md "unlabeled table" / card.md "headerless scrollable
                            # card" precedent for the same class of gap)
  markSource: The taken chip's `aria-pressed="true"` (vs `"false"` on every other chip, live or spent) is the ONLY state a screen reader needs — a toggle-button pattern already in the ARIA vocabulary, requiring no bespoke role.

keyboard:
  - note: "ACCEPTED RESIDUAL (checker finding 2): committing a chip rebuilds the whole set as disabled buttons, so keyboard focus drops to the body after Enter — inherent to any spend-the-set control with no focusable successor inside it; a host composer wanting continuity refocuses its own input on the `select` event."
  - note: Every chip is a REAL native `<button type="button">` in the NORMAL tab order (the table.md "all focusable elements … included in the page tab sequence" precedent, applied per-chip here) — NO roving tabindex, NO composite-widget keyboard contract, NO `UIListboxElement`. A 3-chip suggestion set has 3 button tab stops, native-honest.
  - note: Each chip activates via the platform's own native Space/Enter button activation — no component-defined key binding is added (no `pressActivation` trait; none is needed for a real `<button>`).
  - note: Once the set is spent, every chip carries a real `disabled` attribute — the platform removes each one from the tab order and blocks click dispatch entirely, on every engine, with zero component-level guard needed (the `#onClick` re-check is a defensive backstop only, load-bearing under jsdom's looser disabled enforcement on a plain `<button>`).

geometry:
  sizeClass: pattern
  chipHeight: var(--ui-suggestions-chip-height)   # the compact-realm box (--md-sys-compact-lg) — geometry.md names `chip` in its compact-realm list; NOT the control-height ramp Pattern-class rows usually take (ADR-0213's own "deliberately lighter [than Button]" wording is exactly this deviation)
  chipPad: var(--ui-suggestions-chip-pad)          # the compact-realm pad law `2px + box·ratio·density` (never h/2 — the badge.css precedent)
  rowGap: var(--ui-suggestions-row-gap)            # between wrapped rows of chips — density-responsive
  colGap: var(--ui-suggestions-col-gap)            # between chips on the same row

forcedColors: A dedicated `@media (forced-colors: active)` block (suggestions.css) — every chip is a real bordered/filled box: idle chips repaint to `Canvas`/`ButtonText`, the taken chip inverts to `Highlight`/`HighlightText` (the segmented-control.css moving-fill precedent), and spent untaken siblings step to `GrayText` (the platform's own disabled-text convention).
---

# ui-suggestions

`ui-suggestions` is the **one-shot follow-up/next-prompt chip set** (ADR-0213, GH #1393) — a Pattern-class
leaf that renders `suggestions` (a bindable array of `{label, value?}`) as tappable chips, commits the
taken one's `value` into `selected`, and then renders the WHOLE set spent: every chip goes inert, the
taken one stays visibly marked. It is the catalog's `Suggestions` type — the universal chat-widget pattern
(OpenAI Apps / CopilotKit / C1) for tappable conversational offers under an agent response.

```html
<ui-suggestions
  suggestions='[{"label":"Book the Deluxe King"},{"label":"See more photos","value":"more-photos"},{"label":"Compare rooms","value":"compare"}]'
></ui-suggestions>
```

> **An A2UI catalog type.** `ui-suggestions` renders the catalog's `Suggestions` type — reach for it
> whenever a flow offers a small set of one-shot next-prompt chips under an agent turn; reach for
> composed `Row` + `Button`s only when the affordances are genuinely independent commands, never a
> single spent-together SET (ADR-0213's own rejected alternative).

## Suggestions are data, never children

`suggestions` is a hardened JSON array prop — `{label: string, value?: string}[]`, the
`DescriptionList.rows`/`Table.rows` codec shape verbatim (ADR-0201's idiom, reused per ADR-0213 cl.2): an
absent attribute or malformed JSON yields `[]`, never a throw. A label-less entry is dropped, never
coerced; a present-but-blank/absent `value` defaults to `label`. Suggestions are rendered as `<button
type="button" data-part="chip">` parts the component builds itself (whole-array swap per change, the
`ui-description-list`/`ui-table` shape) — there is no `ChildList`, no author-slotted content model.

## The one-shot law — by construction

A tap on any LIVE chip writes its `value` into `selected` and fires `select` — and from that instant the
WHOLE set renders **spent**: every chip (the taken one included) carries a real native `disabled`, so
pointer AND keyboard activation both go inert on the platform's own terms, with the renderer's own
disabled-guard (GH #1164) suppressing any further action emit on top. The taken chip is the one exception
to "inert" — it stays **visible and marked** (`[data-taken]`, `aria-pressed="true"`), never removed, so the
history record shows what was offered AND what was taken. Because spent-ness rides through the `selected`
data-model value (not local-only state), a set re-rendered from history renders spent from the model alone
— the ADR-0097 frozen-history law, relocated into the component.

## Accessibility

The host mints no ARIA role — every chip is a real `<button>`, already carrying `role=button` and a
content-derived accessible name. The taken chip's `aria-pressed="true"` (`"false"` on every other chip) is
the one state a screen reader needs; once spent, the platform's own `disabled` semantics remove every chip
from the tab order. There is no accessible name for the SET itself — ADR-0213 offers no `label` prop, an
accepted residual matching `ui-table`'s own unlabeled-table posture.

## Sizing

`ui-suggestions` chips are **compact-realm** geometry (`geometry.md`'s "compact realm" list names `chip`
directly, alongside checkbox/switch/tag/badge): `--md-sys-compact-lg` for the box, the compact pad law
(`2px + box·ratio·density`, never `h/2`) for the inline padding — deliberately lighter than a full
Control-height `ui-button`, per ADR-0213's own "a suggestion is a conversational offer … deliberately
lighter" framing. No `[size]`/`[scale]` attribute in v1 (ADR-0213 names no size axis).
