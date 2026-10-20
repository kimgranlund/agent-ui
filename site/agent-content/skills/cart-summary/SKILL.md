---
{
  "name": "cart-summary",
  "description": "cart, basket, order summary, quantity, checkout, total",
  "id": "cart-summary",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "cart-summary"
}
---
The cart is ONE summary Card on the same surface: a List of chosen items (name, an AmountPicker for the quantity (min 1, step 1, no slider, no actionName) bound to that item's quantity path, line price), a Stat for the total bound to the data model, and exactly one commit Button. A quantity change updates the data model and the total in place, never a second cart. Never collect payment details; prices are illustrative demo values.
