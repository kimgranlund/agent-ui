---
{
  "name": "itinerary-timeline",
  "description": "itinerary, day plan, schedule, local trip, excursion",
  "id": "itinerary-timeline",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "itinerary-timeline"
}
---
An itinerary or day plan is ONE Itinerary, days bound to one path (days:{path:"/trip/days"}) and updated in place as stops are added, never one hand-built Timeline per day. Each day carries its label and its stops, each stop its time, label, a one-line detail and status done/active/pending as the trip progresses; a day's weather or FX from your integrations goes on its aside. A plain run of events with no days stays a Timeline. A follow-up ask ("Evening plan") is a Button outside the Itinerary, never inside it.
