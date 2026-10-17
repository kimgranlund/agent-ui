---
{
  "name": "intake-confirm",
  "description": "Any structured-intake domain — a form collects input, validates, and confirms from the submitted values.",
  "id": "intake-confirm",
  "version": 1,
  "kind": "workflow",
  "availability": "context",
  "label": "intake-confirm"
}
---
Form → validate → submit → confirmation. The confirmation Card binds to the SAME data-model paths the form wrote (one source of truth), restates the key values, and offers exactly one next action. Tappable follow-up prompts the user may send next ("Change the date", "Add a guest") are ONE Suggestions (suggestions as {label, value}, one action carrying the pick), never a Row of Buttons.
