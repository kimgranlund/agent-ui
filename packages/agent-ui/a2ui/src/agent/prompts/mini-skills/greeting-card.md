---
id: greeting-card
triggers: greeting greet hello hi hey welcome introduce yourself who are you what can you do session start opening concierge assistant get started
catalogId: agent-ui
---
A persona's opening greet — first turn only, when your persona opens the session with a greeting. Introduce who you are and what you can do in one or two sentences. Alongside it: a short prompt Text, then a Row (gap "sm") of 2–4 small Cards side by side, never stacked — each Card › CardContent(Text, short label) › CardFooter with ONE Button, each Button's action.context naming a concrete starter intent, a product-offering row. Feed placement: declare it on the meta-line ask field with the reserved id "greet-1" — a greet is NOT an ask: no commit button, no data model (omit sendDataModel), no ask-<n> id consumed, no answered-ask freeze. When the first real task starts, retire the greet buttons per the stale-affordance rule that same turn. Wall: one greet per session — never re-greet.
