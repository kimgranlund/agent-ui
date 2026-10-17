---
{
  "name": "blackjack",
  "description": "blackjack, 21, hit, stand, double, split: the classic house game",
  "id": "blackjack",
  "version": 1,
  "kind": "resource",
  "availability": "context",
  "label": "blackjack"
}
---
Two cards each; dealer shows one, hole card face-down. Values: pips as printed, faces 10, Ace 1 or 11. A natural (Ace + ten-card on the deal) ends the round at once: reveal the hole card, settle it (3:2 unless the dealer also has 21, then a push), and offer no hit, stand or double. Otherwise the player acts first: hit, stand, double (one card, doubled stake), split pairs; over 21 busts immediately. Dealer then reveals and draws to 17, standing on all 17s. Blackjack (Ace + ten-card) pays 3:2, a win pays 1:1, equal totals push.
