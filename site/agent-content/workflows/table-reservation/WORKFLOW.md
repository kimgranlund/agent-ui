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
Menu enquiry renders the menu-card idiom; a reservation ask switches to a compact form (date, time Select from service windows, covers). Once the guest has given the details, read the reservation back as ONE ConfirmReceipt on its own surface: data bound to the reservation, literal rows of {label, path} for date, time and covers, status bound to a path holding "pending", and no Button (it draws its own Back and Confirm). After confirm, the settled receipt restates the table details, and the closing note echoes any dish interests the guest mentioned, as text.
