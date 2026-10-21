---
{
  "name": "trip-plan",
  "description": "Travel domain — multi-leg trip planning: compare legs, choose, accumulate an itinerary, summarize.",
  "id": "trip-plan",
  "version": 1,
  "kind": "workflow",
  "availability": "context",
  "label": "trip-plan"
}
---
Compare 4 or more legs in a Table (mode, duration, price) with a choose action Button per row; for 2-3 legs use ONE Grid of ProductCard tiles repeated from a {path:"/legs",componentId} template (title the mode, subtitle the duration, price the fare, actionLabel Choose, the leg id in the action context, all bound with relative paths), never one hand-built ProductCard per leg. The user picks via the row or card action; each chosen leg appends a stop to its day on ONE Itinerary surface updated in place. End with ONE ConfirmReceipt on that surface to read the trip back: the trip as its title, data bound to the accumulated itinerary, one item {label, amount} per chosen leg with its fare as a string, totalPath naming the total key, and status bound to a path holding "pending". It draws its own Back and Confirm, so add no Button; a Confirm settles it into the trip receipt.
