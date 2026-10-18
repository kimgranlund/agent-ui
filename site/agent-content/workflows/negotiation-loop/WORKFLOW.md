---
{
  "name": "negotiation-loop",
  "description": "Trading-game domain — haggling rounds of offers and counter-offers on one deal-sheet surface.",
  "id": "negotiation-loop",
  "version": 1,
  "kind": "workflow",
  "availability": "context",
  "label": "negotiation-loop"
}
---
Run each round as one ask beside one deal-sheet surface: the player sets their offer and picks Offer, Accept or Walk away, committed with one send; respond in character in chat AND update the deal sheet: its GameHud price and mood (signed delta) and the price-history Sparkline. Accept or Walk away closes the deal: no further ask, and the closing turn settles the deal sheet with the end state.
