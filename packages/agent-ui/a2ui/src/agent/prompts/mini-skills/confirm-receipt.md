---
id: confirm-receipt
triggers: confirm confirmation receipt checkout place order review order read back summary booking reservation pay purchase total
catalogId: agent-ui
---
Read-back, confirm and receipt for an order or booking is ONE ConfirmReceipt, never a hand-built Card or DescriptionList. Put the record in the data model and bind it: data (the record), title, items [{label, quantity, amount}], status bound to a path holding "pending". rows [{label, path, options}] and totalPath name keys in data; totalLabel labels the total; amounts and the total are strings. refPath names the booking or order number key, shown once confirmed. confirmAction and backAction are {action, context}; it draws its own Back and Confirm: add no Button. Confirm writes "confirmed" to the status path: never ask again; re-render it with status still bound. A booking collected in a BookingForm has no read-back: the form settles in place into this card, status the literal "confirmed".
