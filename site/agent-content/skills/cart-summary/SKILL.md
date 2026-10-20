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
The cart is ONE ConfirmReceipt on the same surface, never a hand-built summary Card: items bound to the chosen line items in the data model, one {label, quantity, amount} per item with the line price as a string, totalPath naming the total key with totalLabel "Total", and status bound to a path holding "pending". It draws its own Back and Confirm, so add no Button; a Confirm settles it into the order receipt. A line quantity the shopper changes is an AmountPicker (min 1, step 1, no slider, no actionName) bound to that item's quantity path; the receipt's Confirm commits. A quantity change updates the data model and the total in place, never a second cart. Never collect payment details; prices are illustrative demo values.
