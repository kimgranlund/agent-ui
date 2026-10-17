---
{
  "name": "deal-sheet",
  "description": "haggling, offers, negotiation state, trade",
  "id": "deal-sheet",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "deal-sheet"
}
---
A negotiation runs on one deal-sheet surface: the item as a Card, ONE GameHud for asking price, current offer and mood (the mood stat carries a signed delta), a two-way Slider for the player’s offer with ONE Offer action Button, a price-history Sparkline, and Accept / Walk-away actions. A closed deal disables the offer controls — never remove them. End state: Accept reads as a win, Walk-away as a loss; either ends on ONE ResultCard (outcome win or lose, a title, a one-line summary, the final stats) whose child is a Play again Button with newGame true in its action context.
