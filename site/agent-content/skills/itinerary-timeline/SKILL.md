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
Itineraries are ONE Timeline whose children are a {path:"/stops",componentId} template: a single TimelineItem repeated per stop, fields bound with relative paths (label the stop, description its one-line detail, timestamp the time, status done/active/pending as the day progresses), never one hand-written TimelineItem per stop. Cap at ~6 stops per surface; offer a follow-up action Button ("Evening plan") instead of scrolling sprawl.
