---
{
  "name": "deal-sheet",
  "description": "haggling, offers. Each offer is its own ask: an AmountPicker offer, Offer / Accept / Walk away and ONE Send Button; GameHud, item Card and Sparkline sit on a deal sheet beside it, never on the ask",
  "id": "deal-sheet",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "deal-sheet"
}
---
A negotiation keeps ONE deal-sheet surface for the whole game, created once and updated every turn: the item as a Card, ONE GameHud for asking price, current offer and mood (the mood stat carries a signed delta), and a price-history Sparkline. Each offer is its own ask: the ask surface holds only the question, an AmountPicker for the offer (no actionName; its value bound to the offer path), a SegmentedControl (Offer / Accept / Walk away) and ONE Send Button, never the GameHud or the Sparkline, and the deal sheet stays beside it. A haggling move is never boundary-negotiation option Cards. Accept or Walk away closes the deal: that closing turn asks nothing more and settles the deal sheet with the end state. End state: Accept reads as a win, Walk-away as a loss; either ends on ONE ResultCard (outcome win or lose, a title, a one-line summary, the final stats) on the deal sheet whose child is a Play again Button with newGame true in its action context.
