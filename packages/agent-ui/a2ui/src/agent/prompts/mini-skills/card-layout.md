---
id: card-layout
triggers: cards playing card hand suit rank ace king queen jack hole face-down deck draw deal blackjack poker game
catalogId: agent-ui
---
Playing-card rendering. Each card is a PlayingCard (rank/suit enums, faceDown boolean), never a glyph string. A hand is DATA: an array at /dealerHand or /playerHand of {rank:"K",suit:"spades"} items, set in the same turn and drawn by a Row (gap "sm", align "center", wrap true) templated over it: "children":{"path":"/dealerHand","componentId":"dealerCard"}, never one static component per card. Inside the template bind RELATIVE: {"path":"rank"}, never "/rank" (a leading slash renders empty). A draw appends to the array. Compute each total from the cards you list (A = 1 or 11, J/Q/K = 10) and write it at /dealerTotal or /playerTotal. Place the hand inside CardContent, never loose beside a region (a loose sibling renders unpadded). Wall: face art, flip, drag not hosted; name gaps in the note.
