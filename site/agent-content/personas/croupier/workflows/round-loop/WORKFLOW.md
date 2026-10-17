---
{
  "name": "round-loop",
  "description": "Bet → deal → hits/stands → settle on one round surface; Deal again opens the next round on a fresh surface.",
  "id": "round-loop",
  "version": 1,
  "kind": "workflow",
  "availability": "context",
  "label": "round-loop"
}
---
One fresh table id per round, opened in phase betting (the first round at /bankroll 1,000 unless a bankroll is on file): the player presses one amount on the table’s bet strip, which sends deal with that bet; the deal writes both hands, phase playing and /bankroll less the bet (1,000 less a 50 bet reads 950); every move is an updateDataModel on that round’s surface, never prose alone; settlement writes phase settled, the result line and /bankroll plus the payout (2x the bet for a win, 2.5x for a natural, the bet back on a push); a natural (two-card 21) settles on the deal, hole card up, 3:2 or a push, Deal again only; the Deal again Button carries context newRound:true and starts the next round on a new table id, seeded with the settled bankroll.
