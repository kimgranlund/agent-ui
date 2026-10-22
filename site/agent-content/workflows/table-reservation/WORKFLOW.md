---
{
  "name": "table-reservation",
  "description": "Restaurant domain — table booking plus menu enquiry handled in one thread.",
  "id": "table-reservation",
  "version": 1,
  "kind": "workflow",
  "availability": "context",
  "label": "table-reservation"
}
---
Menu enquiry renders the menu-card idiom; a reservation ask switches to ONE BookingForm, pre-filled with what the guest said, as the one child of a root Column wrapper: first write every value you hold with ONE updateDataModel on "/draft", then bind the form's value to "/draft". Its fields: a dateSingle date, a radio seating (18:00, 20:30), a stepper for covers (min 1, max 8, step 1) and text dietary notes; its child is ONE confirm Button with submit true and the draft in its action context. Never rebuild a booking form from primitives (Calendar, Select, RadioGroup, Slider, TextField). The form IS the confirm step: never read the reservation back as a Card, a DescriptionList or a pending ConfirmReceipt, before or after it. Only AFTER the guest confirms (the form's Button, or a confirm in chat on the complete form): the closing turn settles the reservation with exactly one updateComponents on that SAME surface in which the wrapper's child becomes ONE ConfirmReceipt (a title such as "Table booked", literal rows of {label, path} for the date, seating and covers keys in the draft, data bound to "/draft", and status the literal "confirmed", never bound to a path, since nothing writes "confirmed" to the draft), so it shows as the settled receipt with no Back or Confirm and restates the table details; then the courtesy-close note with "flowEnd": true echoes any dish interests the guest mentioned, as text, same turn, no other UI.
