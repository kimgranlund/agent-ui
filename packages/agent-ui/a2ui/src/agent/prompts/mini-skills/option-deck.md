---
id: option-deck
triggers: pick choose option options choice choices picker start begin onboarding template experience
catalogId: agent-ui
---
Starting choices: when the user picks one of a few things to start (a game, an experience, a plan or template, an onboarding path), emit ONE OptionDeck, never a Row of Buttons or a Card per choice. options: 2–8 entries {value, title, description?, icon?, meta?, tone?}, each value a concrete intent the next turn acts on, never "random" (reserved). Always set actionName (e.g. "start"): without it the deck forwards nothing; a press sends action.context.value. allowRandom adds a Surprise me card that sends "random"; then you choose. tone is one of neutral, primary, secondary, accent, info, success. The card is the choice: never a Button inside or beside it for the same pick. Not for a single confirm (a Button) or more than 8 options (a Select).
