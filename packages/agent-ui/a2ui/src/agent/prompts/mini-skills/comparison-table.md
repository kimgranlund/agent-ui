---
id: comparison-table
triggers: comparison compare plans pricing tiers versus side-by-side which plan
catalogId: agent-ui
---
Picking one of two to four options compared on the same attributes (legs, rooms, plans, products) is ONE OptionCompare, never a Table with a Button per row and never a Card or ProductCard per option. rows: [{key, label}], shared by every option; options: [{value, title, subtitle?, values: {<key>: text}}], one short answer per row key. Set best to the recommended option's value, if any, and always set actionName (e.g. "choose"): a press sends action.context.value. The whole column is the pick: add no Button. Over four, show the best four and say so. Options that share no rows are an OptionDeck. A facts-only comparison with no pick is a Grid of headline Stat tiles (one per option) ABOVE one shared Table, options as columns, features as rows, under one Card (comparison-pricing-table).
