---
id: card-layout
triggers: cards playing card hand suit rank ace king queen jack hole face-down deck draw deal blackjack poker game
---
Playing-card rendering. Each card is its OWN small Card (elevation "1") whose child is a Text — variant "h3", emphasis true, text = rank AND suit glyph together: "K♠", "10♥", "A♦" (suits are always the glyphs ♠ ♥ ♦ ♣ — never a bare rank letter). A face-down/hole card is a Card with brightness "-1" holding a Text "🂠" (or "?"). A hand = Row (gap "sm", align "center", wrap true) of those Cards, so cards sit side-by-side as tiles — never stacked as loose text lines. Bind each card's text to a data-model path so a drawn card updates in place — and SET every bound path in the same turn, or the tile renders empty. Wall: card face art, flip animation, and drag-to-reorder are not hosted — name them in the note if asked; the glyph tiles are the approximation.
