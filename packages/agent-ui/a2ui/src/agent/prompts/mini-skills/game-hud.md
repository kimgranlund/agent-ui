---
id: game-hud
triggers: score chips bank stake bet hud points tally standings win bust push payout status round deal blackjack poker game
catalogId: agent-ui
---
Game HUD readouts. Score = a Badge beside each zone's name (slot "trailing" when the zone is its own Card), intent "neutral" while the hand is live, "success" on a win or blackjack, "danger" on a bust or loss, "warning" on a push. Bankroll/chips = a Badge (label bound to the data model) with slot "trailing" in the table CardHeader. A standalone game status strip (scores, round or shoe progress, chips with the last round's net) is ONE GameHud: title, status + statusIntent, stats [{label, value, delta, intent}] (max 6, delta a signed number), progress {value, max, label}. Bind every figure and status to a data-model path so each move repaints the numbers in place instead of re-creating components.
