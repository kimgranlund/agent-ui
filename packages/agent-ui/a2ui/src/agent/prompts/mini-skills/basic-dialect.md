---
id: basic-dialect
triggers: form button submit action event input field text textfield checkbox picker choice select slider date time list row column card settings booking contact register
catalogId: a2ui-basic
---
The Basic catalog dialect, which differs from agent-ui. Button: its label is a child Text node (the Button's child id), never a label prop; its action is an event with a name and a context of bound values. Inputs label themselves (label on TextField, CheckBox, ChoicePicker, Slider, DateTimeInput); there is no Field wrapper. ChoicePicker value is a string ARRAY even when mutuallyExclusive. Computed text is a function call (formatString, formatCurrency, formatNumber, pluralize), not a literal. createSurface catalogId is the short id a2ui-basic. Card wraps exactly one child. Wall: no agent-ui components.
