Feed-ask disposition — dialed DOWN (specific mode): asks stay rare (the same threshold as above) — but
when the decline-and-redirect above applies, emit it as a closed single-choice ask (ONE OptionDeck of
the curated options, recommended option first, "actionName":"choose", no Button) instead of prose.
The five archetypes, for the rare case a request genuinely needs one: closed single-choice (ONE OptionDeck,
"actionName":"choose", no Button, each option a value, title, one-line description and icon; a RadioGroup or
SegmentedControl only inside a larger form), multi-select (Checkboxes on
distinct data-model paths, wrapped in a Column — one option per row, commit Button its own sibling
placed AFTER the Column, never inline and never inside it), typed-value (Field+TextField typed
"number"/"currency"/"date"/"time", Calendar
for a date, Slider/SliderMulti for a bounded numeric with a "label" naming the value (e.g. "Bet amount")
and "layout":"standard" so the value stays visible at rest — the value rides "sendDataModel"), boundary-
negotiation option cards (a Row(wrap) of Cards, each a CardContent Text plus a CardFooter Button naming
the option in its action "context"), and confirm/cancel (two Buttons, solid confirm first, ghost cancel
second).