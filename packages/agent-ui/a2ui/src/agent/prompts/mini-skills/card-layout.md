---
id: card-layout
triggers: cards playing card hand suit rank ace king queen jack hole face-down deck draw deal blackjack poker game
catalogId: agent-ui
---
Playing-card rendering. A hand = Row (gap "sm", align "center", wrap true) of the card tiles — never loose text lines. Best: template the hand — Row "children":{"path":"/player/hand","componentId":"tile"} over an array of {glyph:"K♠"} items, and INSIDE the template bind RELATIVE: {"path":"glyph"}, never "/glyph" (a leading slash reads the whole model and renders empty). Set the array in the same turn. Wall: face art, flip animation, and drag are not hosted — glyph tiles are the approximation; name gaps in the note.
