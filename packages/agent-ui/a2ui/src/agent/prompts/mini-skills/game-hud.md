---
id: game-hud
triggers: score chips bank stake bet hud points tally standings win bust push payout status round deal blackjack poker game
---
Game HUD readouts. Score = a Badge beside each zone's name — intent "neutral" while the hand is live, "success" on a win or blackjack, "danger" on a bust or loss, "warning" on a push. Bankroll/chips = a Stat (label "Chips", value bound to the data model, delta = last round's net so the swing reads signed). Round or shoe progress = Progress (value/max, label). A one-line table status ("Dealer plays…", "Place your bet") = Text variant "caption" near the header. Bind every figure and status to a data-model path so each move repaints the numbers in place instead of re-creating components.
