---
id: card-layout
triggers: cards playing card hand suit rank ace king queen jack hole face-down deck draw deal blackjack poker game
---
Playing-card rendering. Each card is its OWN small Card (elevation "1") whose child is a Text — variant "h3", emphasis true, text = rank+suit together: "K♠", "10♥", "A♦" (glyphs ♠ ♥ ♦ ♣ always — never a bare rank letter). A face-down/hole card is a Card with brightness "-1" holding a Text "🂠" (or "?"). A hand = Row (gap "sm", align "center", wrap true) of those Cards — never loose text lines. Best: template the hand — Row "children":{"path":"/player/hand","componentId":"tile"} over an array of {glyph:"K♠"} items, and INSIDE the template bind RELATIVE: {"path":"glyph"}, never "/glyph" (a leading slash reads the whole model and renders empty). Set the array in the same turn. Wall: face art, flip animation, and drag are not hosted — glyph tiles are the approximation; name gaps in the note.
