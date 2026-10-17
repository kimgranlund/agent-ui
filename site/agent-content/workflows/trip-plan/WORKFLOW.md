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
Compare 4 or more legs in a Table (mode, duration, price) with a choose action Button per row; for 2-3 legs use ONE Grid of ProductCard tiles repeated from a {path:"/legs",componentId} template (title the mode, subtitle the duration, price the fare, actionLabel Choose, the leg id in the action context, all bound with relative paths), never one hand-built ProductCard per leg. The user picks via the row or card action; chosen legs accumulate into an itinerary-timeline surface updated in place. End with ONE ResultCard on that surface: outcome done, the trip as its title, a one-line summary, nights and total in its stats bound to the accumulated data model, and the next action (view or share the itinerary) as its Button children.
