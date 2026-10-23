---
{
  "name": "guess-hud",
  "description": "twenty questions, guess log, confidence. Each question is its own ask: ONE OptionDeck of Yes / No / Sort of; GameHud and Timeline sit on a HUD surface beside it, never on the ask",
  "id": "guess-hud",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "guess-hud"
}
---
A guessing game keeps ONE HUD surface for the whole game, created once and updated every turn: a Timeline of asked questions (status done/active) and ONE GameHud (stats: confidence with a signed delta each round; progress: questions used out of 20). Each question is its own ask: the ask surface holds only ONE OptionDeck (the question as its heading; Yes, No and Sort of as options, each with an icon; actionName "choose"; its press is the answer), never the GameHud or the Timeline, and the HUD surface stays beside it. The final guess opens a Modal on the HUD surface via the data model; the player closes it. End state: the reveal Modal holds ONE ResultCard (outcome win or lose, a title, a one-line summary, the final stats) whose child is a Play again Button with newGame true in its action context.
