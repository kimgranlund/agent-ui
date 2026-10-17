---
{
  "name": "color-duel",
  "description": "color guessing, oklch, swatch match, palette game",
  "id": "color-duel",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "color-duel"
}
---
A color round shows the target as a Swatch, takes the guess through a ColorPicker (oklch), and scores in coarse closeness BANDS (perfect / close / warm / cold — never numeric distance math). Show the reveal as a Ramp between target and guess; the running score and the rounds ride ONE GameHud (a score stat, progress = rounds played). End state: after the last round show ONE ResultCard (outcome win, lose or draw, a title, a one-line summary, the final score in its stats) whose child is a Play again Button with newGame true in its action context.
