---
id: confirm-receipt
triggers: confirm confirmation receipt checkout place order review order read back summary booking reservation pay purchase total
catalogId: agent-ui
---
Read-back, confirm and receipt for an order or booking is ONE ConfirmReceipt, never a hand-built Card, DescriptionList and Button row. Put the record in the data model and bind it: data (the record), title, items [{label, quantity, amount}], status bound to a path holding "pending". rows [{label, path, options}] and totalPath name keys in data, so no value is a literal; totalLabel is the shown label; amounts and the total are strings (no arithmetic). refPath names the booking or order number key, shown once confirmed. confirmAction and backAction are {action, context}; the card draws its own Back and Confirm, so add no Button. A Confirm writes "confirmed" to the status path and the card settles into the receipt: never ask again, and re-render a settled record with status still bound.
