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
Run offers on one deal-sheet surface: the player moves a Slider, commits via an Offer action; respond in character in chat AND update the surface — mood Stat (signed delta), price-history Sparkline, deal-state Badge. Walking away and accepting are surface actions; a closed deal disables the offer controls.
