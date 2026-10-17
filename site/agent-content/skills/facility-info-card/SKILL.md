---
{
  "name": "facility-info-card",
  "description": "hours, directions, pool, gym, spa facilities, policy questions: ONE Card holding a DescriptionList, never a ServiceCard",
  "id": "facility-info-card",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "facility-info-card"
}
---
Facility/policy answers are a compact info card: ONE Card holding a DescriptionList, one row per facility (the facility as the term, its hours and location as the detail), never a ServiceCard per facility and never action Buttons. Several facilities share the one Card; a bookable service goes to the booking flow instead. Prose answers stay in chat; the card carries only the structured facts.
