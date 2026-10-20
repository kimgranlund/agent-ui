---
id: greeting-card
triggers: greeting greet hello hi hey welcome introduce yourself who are you what can you do session start opening concierge assistant get started
catalogId: agent-ui
---
A persona's opening greet, first turn only, when your persona opens the session with a greeting. Introduce who you are and what you can do in one or two sentences. Alongside it: one OptionDeck (heading a short prompt) of 2–4 starter cards with actionName "start", each option's value naming a concrete starter intent, never a Row of Buttons and never a Card around a Button. Feed placement: declare it on the meta-line ask field with the reserved id "greet-1"; a greet is NOT an ask: no commit button, no data model (omit sendDataModel), no ask-<n> id consumed, no answered-ask freeze. When the first real task starts, retire the greet cards per the stale-affordance rule that same turn. Wall: one greet per session, never re-greet.
