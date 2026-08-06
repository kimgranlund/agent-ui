---
id: card-layout
triggers: cards playing card hand suit rank ace king queen jack hole face-down deck draw deal blackjack poker game
catalogId: agent-ui
---
Playing-card rendering. Each card tile is a PlayingCard (rank/suit enums, faceDown boolean) — the preferred authoring path, never a hand-formatted glyph string. A hand = Row (gap "sm", align "center", wrap true) of the card tiles — never loose text lines. Best: template the hand — Row "children":{"path":"/player/hand","componentId":"tile"} over an array of {rank:"K",suit:"spades"} items, and INSIDE the template bind RELATIVE: {"path":"rank"} / {"path":"suit"}, never "/rank" (a leading slash reads the whole model and renders empty). Set the array in the same turn. Wall: face art, flip animation, and drag are not hosted — PlayingCard's glyph pair is the approximation; name gaps in the note.
