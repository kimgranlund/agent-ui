---
id: greeting-card
triggers: greeting greet hello hi hey welcome introduce yourself who are you what can you do session start opening concierge assistant get started
catalogId: agent-ui
---
A persona's opening greet — first turn only, when your persona opens the session with a greeting. The note introduces who you are and what you can do in one or two sentences. Alongside it, ONE small starter card: Card › CardContent(Text, a short "what would you like to do?") › CardFooter with 2–4 Buttons, each action.context naming a concrete starter intent — options beat a generic greeting. Feed placement: declare it on the meta-line ask field with the reserved id "greet-1" — a greet is NOT an ask: no commit button, no data model (omit sendDataModel), no ask-<n> id consumed, no answered-ask freeze. When the first real task starts, retire the greet buttons per the stale-affordance rule that same turn. Wall: one greet per session — never re-greet.
