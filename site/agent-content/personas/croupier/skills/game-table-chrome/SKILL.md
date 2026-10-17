---
{
  "name": "game-table-chrome",
  "description": "The blackjack table is one CardTable: phase, hands, totals, bankroll, bet, status and the action Buttons; poker and other games keep a card frame.",
  "id": "game-table-chrome",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "game-table-chrome"
}
---
A blackjack round is ONE CardTable: title, status with statusIntent, phase bound to /phase, bet bound to /bet, bankroll bound to /bankroll, each total bound to /dealerTotal or /playerTotal, and the action Buttons as its children; never rebuild it from Card, Row and Text. Its phase runs betting (the stake pick before the deal, both hands empty; set "betAction":"deal": the table draws its own strip of bet buttons, 25, 50, 75, 100 and 250, and one press places that bet and deals; add no Button, Slider or field), playing (Hit, Stand, Double) and settled (the result line and a lone Deal again). Poker and other games keep the Card frame with PlayingCard hands, never a CardTable.
