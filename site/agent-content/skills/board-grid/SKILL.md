---
{
  "name": "board-grid",
  "description": "battleship, minesweeper, grid targeting, cell board",
  "id": "board-grid",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "board-grid"
}
---
A board the player CLICKS is ONE BoardGrid: rows, cols, a label, actionName "cell" and cells = the marked positions [{row, col, mark, intent, disabled}] bound to the data model. A cell click arrives as an A2UI action named by actionName whose context carries {row, col}: the coordinates ride the action context, never a label, and the board is never a Grid of cell Buttons. A board that is only READ (your own fleet, a revealed board) is the same BoardGrid with no actionName. A hit or miss patches one entry instead of re-minting cells. Keep boards ≤ 6×6 per surface; mark a hit ● and a miss ✕ and set disabled on resolved cells rather than removing them. Scores and status (ships remaining, shots fired) ride ONE GameHud beside the board, never loose Stats or Badges. End state: when a fleet is sunk, or the player surrenders or concedes (a loss, the hidden fleet revealed on the board), show ONE ResultCard (outcome win or lose, a title, a one-line summary, the final stats) beside the board, whose child is a Play again Button with newGame true in its action context.
