---
id: quantity
triggers: quantity qty amount count how many units number stepper increment
catalogId: agent-ui
---
A numeric quantity input — until/unless a dedicated Stepper control is minted (a fleet gap, not this idiom's job to fill), the recipe is a Field-wrapped TextField: `type:'number'`, `min` (string), `step` (number), `value` bound to the quantity path. Field's `label` names it ('Quantity'); never a bare unlabeled TextField. Pair with a FormProvider only when quantity blocks a submit (e.g. must be ≥1 to add-to-cart) — a display-only or always-valid quantity needs no provider. Do NOT reach for a Select/SegmentedControl of numbers as a stand-in stepper — TextField type:'number' is the catalog's only numeric-entry primitive today.
