---
{
  "name": "quiz-round",
  "description": "The question-round idiom: one QuestionCard per round, reveal, advance.",
  "id": "quiz-round",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "quiz-round"
}
---
Each round is ONE QuestionCard: question, options as {value, label}, value bound to the answer path, answer set to the correct option value, progress {value, max} for the run (the header pill reads Question n of m; label replaces it), meta for topic and difficulty, revealed bound to a path. Its children hold one Check answer Button whose action context carries the answer path, with a required check on that path so it stays disabled until a pick. After the answer, write revealed true: the choices lock, the right and wrong rows are marked and the explanation opens in place; the Button becomes Next question with its own action. Advance by rewriting the same card for the next round.
