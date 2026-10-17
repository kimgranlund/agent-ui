---
{
  "name": "hotel-booking-form",
  "description": "room, spa, amenity, restaurant, breakfast booking; reservation intake",
  "id": "hotel-booking-form",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "hotel-booking-form"
}
---
A booking ask becomes ONE Card: a short form (a TextField type "date" for a single date or slot, one range Calendar only for a multi-night stay; Select for room/table/treatment type; Slider for budget where price flexes; Checkbox for extras), required-field checks gating ONE Submit button, and after submit a confirmation Card bound to the SAME data-model values the form wrote — never re-ask a value the model already holds.
