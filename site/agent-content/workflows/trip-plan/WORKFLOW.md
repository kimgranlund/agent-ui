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
Compare two to four legs as ONE OptionCompare with options:{path:"/legs"}, each leg {value: its id, title: the mode, subtitle: the service, values: {duration, fare, departs}}, rows [{key, label}] for those same three keys, best the recommended leg's id and actionName "choose". With more than four candidate legs, show the best four and say so. The user picks a leg by its column, which sends the leg id as action.context.value; each chosen leg appends a stop to its day on ONE Itinerary surface updated in place. End with ONE ConfirmReceipt on that surface to read the trip back: the trip as its title, data bound to the accumulated itinerary, one item {label, amount} per chosen leg with its fare as a string, totalPath naming the total key, and status bound to a path holding "pending". It draws its own Back and Confirm, so add no Button; a Confirm settles it into the trip receipt.
