---
id: game-table-chrome
triggers: table board zone dealer player casino felt layout frame chrome arena match round deal blackjack poker game
---
The game-table frame. ONE Card is the table. CardHeader = Row (justify "between", align "center"): the game title (Text variant "h4", emphasis true) on the left, a Row (gap "sm") of status Badges (bet, round) on the right. CardContent = Column (gap "lg") of ZONES, one per participant: each zone is a Column (gap "sm") whose first child is a Row (justify "between", align "center") holding the zone name (Text variant "h5") and that zone's score readout, with the hand Row beneath it at full width. CardFooter = Row (gap "sm", justify "center") of the action Buttons — variant "solid" for the primary move, "soft" for the rest. Zones span the table's width; never centre the whole game into one narrow column of bare Text lines.
