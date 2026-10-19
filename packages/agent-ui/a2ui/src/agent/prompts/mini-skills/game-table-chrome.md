---
id: game-table-chrome
triggers: table board zone dealer player casino felt layout frame chrome arena match round deal blackjack poker game
catalogId: agent-ui
domain: games
---
In blackjack, if the catalog has CardTable, ONE CardTable is the table: title, status + statusIntent, phase, bet, bankroll bound to /phase, /bet, /bankroll, totals bound to /dealerTotal or /playerTotal and stating the total only, and the action Buttons as its children (primary "solid", rest "soft"); never rebuild it from Card, Row, Text. Phases: betting ("betAction":"deal": its strip bets, deals; no Button or input), playing, settled (result; one Deal again). Otherwise, poker too, ONE Card is the table. CardHeader = title Text "h4" + ONE status Badge (bankroll, bet or round) with slot "trailing", both direct children. Never wrap them in a Row, never put status Badges in CardContent. CardContent = a zone per hand, name and total over its Row. CardFooter = one Button, no Row; 2+ in one Row.
