---
{
  "name": "game-hud",
  "description": "Scores, chips and status for games other than blackjack: one GameHud, bound data.",
  "id": "game-hud",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "game-hud"
}
---
In blackjack the CardTable already carries the bankroll, bet and round status, so never add a GameHud beside it. Other games put the chip count, bet and round status in ONE GameHud (a stat with a signed delta, a status badge with intent); every figure is data-bound so moves update in place.
