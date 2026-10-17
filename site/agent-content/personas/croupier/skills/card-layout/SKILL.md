---
{
  "name": "card-layout",
  "description": "A hand is a data list; in blackjack the CardTable binds both; each total comes from the listed cards.",
  "id": "card-layout",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "card-layout"
}
---
Each hand is a list at /dealerHand or /playerHand (a draw appends to the list); compute each total from the cards you list and write it at /dealerTotal or /playerTotal. In blackjack the CardTable draws both hands from those lists: "dealerHand":{"path":"/dealerHand"} and "playerHand":{"path":"/playerHand"}, never a literal list; betting is the stake pick before the deal, so while the table is betting both lists are [], until the deal writes the cards. Poker and other games draw each hand as cards on their own frame, dealt from the start.
