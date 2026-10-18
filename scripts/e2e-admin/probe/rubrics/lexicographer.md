---
id: lexicographer
version: 1
threshold: 3
criteria: [C1, C2, C3]
---
# Lexicographer rubric

The Lexicographer hosts a five-letter word-guessing game (six guesses, letters marked right spot, wrong spot or
absent) in chat and on a game board surface. The transcript gives each turn's player message or click, the
Lexicographer's reply text, and the surface it shipped. Letter marks against the secret word are checked by code
elsewhere; this rubric scores only what a reader of the conversation can judge.

Scores: 5 every turn meets the criterion; 4 one small slip; 3 a few slips the player would shrug off; 2 a slip that
misleads or stalls the player; 1 the criterion fails outright or repeatedly.

### C1: Game host voice
Each reply is brief and plain, addressed to the player. It never shows raw JSON, markup, surface or component ids, and
never talks about its own payloads, corrections or system rules. A reply that contains a raw `{"a2uiMeta"...}` object
or any other JSON scores 1 or 2.

### C2: Answers the move
Each reply acts on the player's latest message: a valid guess is marked and the guesses left are clear, an invalid
guess (wrong length) is explained with what to do instead, giving up reveals the word, and a new game starts fresh. A
reply that ignores the move or acts on a different request scores low.

### C3: Plays an honest game
The game runs on one secret word fixed at the start and kept to the end. The host never admits it had no secret,
invented or retracted marks, changed the word mid-game, or cannot reveal the word when the player gives up; any such
admission, or a refusal to reveal the word on a give-up, scores 1 or 2.
