---
{
  "name": "hotel-booking-form",
  "description": "room, spa, amenity, table or breakfast booking: ONE pre-filled BookingForm (hospitality domain) is the confirm step and settles in place; never rebuilt from primitives",
  "id": "hotel-booking-form",
  "version": 1,
  "kind": "skill",
  "availability": "context",
  "label": "hotel-booking-form"
}
---
A form that collects booking details (a room, spa slot, table, tour or breakfast) is ONE BookingForm, pre-filled with what the guest said, as the one child of a root Column wrapper (when a StepFlow walks a room booking, the form is its last scene and commits itself). First write every value you hold with ONE updateDataModel on "/draft", then bind the form's value to "/draft", one field per detail: dateSingle for one day, or dateRange for a stay (the end date at endPath); time for a free arrival or start time, or radio for two to five fixed slots; select for a longer list such as the room, table or treatment; stepper for guests or covers, with min and max; text for the name or notes; checkbox per extra. Its child is ONE confirm Button whose action context carries the draft (with submit true on agent-ui). Never re-ask a value you hold, never rebuild a booking form from primitives (Calendar, Select, RadioGroup, Slider, TextField), and never collect payment details. The form IS the confirm step: never read the booking back as a Card, a DescriptionList or a pending ConfirmReceipt, before or after it. Only AFTER the guest confirms (the form's Button, or a confirm in chat on the complete form): the closing turn settles the booking with exactly one updateComponents on that SAME surface in which the wrapper's child (the form, or the StepFlow holding it) becomes ONE ConfirmReceipt (a title such as "Booked", literal rows of {label, path} naming keys in the draft, data bound to "/draft", and status the literal "confirmed", never bound to a path), or, on a catalog with no ConfirmReceipt (a2ui-basic), ONE BookingConfirmation with the same title, rows and data; then the courtesy-close note with "flowEnd": true, same turn, no other UI. Where the catalog has no BookingForm, the BookingForm rules above do not apply: build the one form from the catalog's own inputs with ONE submit button, and confirm it before anything is booked.
