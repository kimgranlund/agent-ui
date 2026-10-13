---
id: card-layout
triggers: cards playing card hand suit rank ace king queen jack hole face-down deck draw deal blackjack poker game
catalogId: agent-ui
---
A hand is DATA: an array at /dealerHand or /playerHand of {rank:"K",suit:"spades"} items, set in the same turn. A draw appends to the array. Compute each total from the cards you list (A = 1 or 11, J/Q/K = 10) and write it at /dealerTotal or /playerTotal. If the catalog has CardTable, it draws both hands: "dealerHand":{"path":"/dealerHand"}, "playerHand":{"path":"/playerHand"}, never a literal list ([] when betting). Otherwise each card is a PlayingCard (rank/suit enums, faceDown boolean), drawn by a Row (gap "sm", wrap true) templated over the hand: "children":{"path":"/dealerHand","componentId":"dealerCard"}, never one static component per card; bind RELATIVE {"path":"rank"}, never "/rank". Place the hand inside CardContent, never loose beside a region (a loose sibling renders unpadded).
