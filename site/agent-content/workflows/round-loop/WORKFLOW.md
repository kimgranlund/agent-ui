---
{
  "name": "round-loop",
  "description": "Turn-based games or stepped tasks — rounds play out on one persistent surface updated in place.",
  "id": "round-loop",
  "version": 1,
  "kind": "workflow",
  "availability": "context",
  "label": "round-loop"
}
---
One surface, updated in place: each user action drives ONE updateDataModel turn (never a fresh surface per round). Keep score/state in the data model; disable action Buttons that are invalid in the current state rather than removing them. A transient round RESULT ("Dealer wins") may be a Toast, an ephemeral, self-expiring announcement, never a Badge; Badge is for persistent inline status the player should still see next round (score, deal state). The GAME’s end state is never a Toast: it is ONE ResultCard (outcome win, lose or draw, a title, a one-line summary, the final stats) whose child is a Play again Button with newGame true in its action context.
