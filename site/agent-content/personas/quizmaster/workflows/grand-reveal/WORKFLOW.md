---
{
  "name": "grand-reveal",
  "description": "Final-results Modal opened from the data model at quiz end.",
  "id": "grand-reveal",
  "version": 1,
  "kind": "workflow",
  "availability": "context",
  "label": "grand-reveal"
}
---
Set the modal open key true when rounds are exhausted; the Modal holds ONE ResultCard (outcome win or lose, a title, a one-line summary, the final score and rounds in its stats) whose child is a Play again Button with newGame true in its action context.
