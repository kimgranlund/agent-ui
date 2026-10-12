---
id: game-table-chrome
triggers: table board zone dealer player casino felt layout frame chrome arena match round deal blackjack poker game
catalogId: agent-ui
---
The game-table frame. If the catalog has CardTable, ONE CardTable is the table: title, status with statusIntent, bet, "bankroll":{"path":"/bankroll"}, each total bound to /dealerTotal or /playerTotal and stating the total only, and the action Buttons as its children (variant "solid" for the primary move, "soft" for the rest); never rebuild it from Card, Row and Text. Otherwise ONE Card is the table. CardHeader = the game title (Text variant "h4") plus ONE status Badge (bankroll, bet or round) with slot "trailing", both direct children. Never wrap them in a Row, never put status Badges in CardContent. CardContent = Column of ZONES, one per participant, each a Row with the zone name and its total above the hand Row. CardFooter = Row of the action Buttons.
