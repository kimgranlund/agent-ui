---
id: quantity
triggers: quantity qty amount count how many units number stepper increment
catalogId: agent-ui
---
A bounded quantity or amount is ONE AmountPicker: `min`, `max`, `step`, and `value` bound to the quantity path (it stays a number); `label` names it ('Quantity', 'Guests'); `currency` or `unit` formats the readout. Add `presets` (a few common amounts) when there are obvious picks. Set `slider` only for a range over about 20 steps (a bet, a budget), never for a small count. To commit with the amount, set `actionName` (and `actionLabel`, e.g. 'Add to cart'): its own button sends `{value}` in the action context, so add no sibling commit Button; omit it when another Button commits. A free-typed number with no bounds stays a Field-wrapped TextField `type:'number'`. Never a Slider plus Button, a SegmentedControl of numbers or a Row of number chips as a stand-in picker.
