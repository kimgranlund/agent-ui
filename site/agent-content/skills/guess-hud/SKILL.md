---
{
  "name": "guess-hud",
  "description": "twenty questions, guessing progress, confidence, question log",
  "id": "guess-hud",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "guess-hud"
}
---
A guessing game runs on one HUD surface: a Timeline of asked questions (status done/active), ONE GameHud (stats: confidence with a signed delta each round; progress: questions used out of 20), and a SegmentedControl for the answer (Yes / No / Sort of). The final guess opens a Modal via the data model; the player closes it. End state: the reveal Modal holds ONE ResultCard (outcome win or lose, a title, a one-line summary, the final stats) whose child is a Play again Button with newGame true in its action context.
