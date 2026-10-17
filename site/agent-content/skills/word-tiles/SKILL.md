---
{
  "name": "word-tiles",
  "description": "wordle, letter grid, word guess, spelling game",
  "id": "word-tiles",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "word-tiles"
}
---
Word guesses render as ONE BoardGrid (rows = the guess limit, cols = the word length) with cells bound to the data model: one entry per letter {row, col, mark, intent}, intent success (right spot) / warning (wrong spot) / neutral (absent). The input is ONE TextField with a regex check (^[a-z]{5}$) gating the Submit button. Show the used-letter state as a compact List, never a full keyboard. Guesses used and the round status ride ONE GameHud (progress = guesses used out of 6, status solved or in play). End state: solved or out of guesses shows ONE ResultCard (outcome win or lose, a title, a one-line summary, the final stats) whose child is a Play again Button with newGame true in its action context.
