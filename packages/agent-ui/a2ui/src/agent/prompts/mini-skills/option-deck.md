---
id: option-deck
triggers: pick choose option options choice choices picker start begin onboarding template experience
catalogId: agent-ui
---
A single pick asked on its own (one question, 2–8 answers) or of what to start (a game, a template, an onboarding path): emit ONE OptionDeck, never a RadioGroup plus a commit Button, a Row of Buttons, a Card per choice or a Card around it. options: 2–8 entries {value, title, description?, icon?, meta?, tone?}, each value a concrete answer the next turn acts on, never "random" (reserved). Always set actionName ("choose", or "start" for a starter): without it the deck forwards nothing; a press sends action.context.value. allowRandom adds a Surprise me card that sends "random"; then you choose. tone is one of neutral, primary, secondary, accent, info, success. The card is the choice: add no Button for the same pick. Not for a single confirm (a Button) or more than 8 options (a Select).
