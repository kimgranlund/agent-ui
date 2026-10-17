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
Menu enquiry renders the menu-card idiom; a reservation ask switches to a compact form (date, time Select from service windows, covers). After confirm, the confirmation restates table details AND echoes any dish interests the guest mentioned, as text.
