---
id: game-table-chrome
triggers: table board zone dealer player casino felt layout frame chrome arena match round deal blackjack poker game
catalogId: agent-ui
---
The game-table frame. ONE Card is the table. CardHeader = the game title (Text variant "h4", emphasis true) plus ONE status Badge (bankroll, bet or round) with slot "trailing", both direct children. Never wrap them in a Row, never put status Badges in CardContent. CardContent = Column (gap "lg") of ZONES, one per participant: each zone is a Column (gap "sm") whose first child is a Row (justify "between", align "center") holding the zone name (Text variant "h5") and that zone's total, bound to /dealerTotal or /playerTotal and stating the total only, the hand Row beneath at full width. CardFooter = Row (gap "sm", justify "center") of the action Buttons: variant "solid" for the primary move, "soft" for the rest. Zones span the table's width; never centre the game in one narrow column.
