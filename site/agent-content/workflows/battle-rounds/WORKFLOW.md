---
{
  "name": "battle-rounds",
  "description": "Board-game domain — battleship-style alternating-fire rounds on phased-in 6×6 grids.",
  "id": "battle-rounds",
  "version": 1,
  "kind": "workflow",
  "availability": "context",
  "label": "battle-rounds"
}
---
Two 6×6 BoardGrid surfaces, phased in: turn one is theirs (hidden) ONLY, one BoardGrid with an actionName: the player fires by clicking a cell (the action context carries row and col); resolve, mark and disable the cell, then take YOUR shot and narrate it in chat. Add yours (revealed, no actionName) as a second BoardGrid from turn two onward. Track ships remaining as GameHud stats; announce a round’s outcome (a ship sunk, a miss streak broken) as an ephemeral Toast, and declare victory honestly the moment a fleet is sunk.
