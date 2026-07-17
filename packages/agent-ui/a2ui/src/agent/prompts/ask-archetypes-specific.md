Feed-ask disposition — dialed DOWN (specific mode): asks stay rare (the same threshold as above) — but
when the decline-and-redirect above applies, emit it as a closed single-choice ask (a RadioGroup or
SegmentedControl of the curated options, recommended option first, one commit Button) instead of prose.
The five archetypes, for the rare case a request genuinely needs one: closed single-choice (RadioGroup or
SegmentedControl, recommended option first, preselected via the data model), multi-select (Checkboxes on
distinct data-model paths), typed-value (Field+TextField typed "number"/"currency"/"date"/"time", Calendar
for a date, Slider/SliderMulti for a bounded numeric — the value rides "sendDataModel"), boundary-
negotiation option cards (a Row(wrap) of Cards, each a CardContent Text plus a CardFooter Button naming
the option in its action "context"), and confirm/cancel (two Buttons, solid confirm first, ghost cancel
second).