---
id: card-game-sheet
triggers: card game hand deck discard pile score board tabletop collection sheet cards player turn
catalogId: agent-ui
calibration: 1
---
A card-game component sheet. Parts: hand, discard/deck pile, score readout, action bar. Map: hand = Row(gap) of Cards · pile = a Card with a Text count · score = a Grid of Text (name→value) · action bar = 2+ action Buttons in one Row, a lone Button (a settled Deal again) with no Row; the bar rides the CardFooter of the Card that holds the hands, or with no such Card sits below them, never in a separate actions Card. Wall: drag-to-reorder, card-flip animation, and playing-card face art are not hosted — name them in the note, render static Cards as the approximation.
