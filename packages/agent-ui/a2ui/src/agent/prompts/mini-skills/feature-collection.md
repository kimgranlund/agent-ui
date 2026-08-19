---
id: feature-collection
triggers: spec specs specification facts details compare features table description list attributes
catalogId: agent-ui
---
Presenting a set of named facts. ONE entity's own spec sheet (material, dimensions, warranty) is a DescriptionList — `rows` bound to `{label,value}[]`, no columns to align. Comparing the SAME facts across MULTIPLE entities is a Table — `columns`+`rows` bound, exact values scanned row-by-row (comparison-pricing-table proves the shape). Never use DescriptionList to compare many items (no per-column alignment) and never use a Table for one item's own facts (a one-row table teaches nothing a DescriptionList doesn't). See comparison-table for the higher-order Stat-tiles+Table plan-comparison composition — that idiom is table+headline metrics together, not a bare fact list.
