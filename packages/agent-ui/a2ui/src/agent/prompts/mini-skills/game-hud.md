---
id: game-hud
triggers: score chips bank stake bet hud points tally standings win bust push payout status round deal blackjack poker game
catalogId: agent-ui
---
Game HUD readouts. Score = a Badge beside each zone's name (slot "trailing" when the zone is its own Card) — intent "neutral" while the hand is live, "success" on a win or blackjack, "danger" on a bust or loss, "warning" on a push. Bankroll/chips = a Badge (label bound to the data model) with slot "trailing" in the table CardHeader, or a Stat (label "Chips", value bound to the data model, delta = last round's net) outside a header. Round or shoe progress = Progress (value/max, label). A one-line table status ("Dealer plays…", "Place your bet") = Text variant "caption" near the header. Bind every figure and status to a data-model path so each move repaints the numbers in place instead of re-creating components.
