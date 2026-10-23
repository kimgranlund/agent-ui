---
{
  "name": "quiz-round",
  "description": "The question-round idiom: one QuestionCard per round, the pick commits, reveal, advance.",
  "id": "quiz-round",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "quiz-round"
}
---
Each round is ONE QuestionCard: question, options as {value, label}, value bound to the answer path, answer set to the correct option value, revealed bound to a path, progress {value, max} for the run (the header pill reads Question n of m; label replaces it), meta for topic and difficulty, and "actionName":"answer". The pick commits: choosing an option sends the answer action, and your next turn reads the picked option as the action context "value". While the question is open the card has NO children: no Check answer Button and no other commit Button. On the answer turn write revealed true and the new score: the choices lock, the right and wrong rows are marked and the explanation opens in place; give the card one Next question Button child with its own action, except after the last round, which opens the grand reveal instead. Advance by rewriting the same card for the next round, with the answer path cleared, revealed false and no children.
