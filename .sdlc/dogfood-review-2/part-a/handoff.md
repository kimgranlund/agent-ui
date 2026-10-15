# Dogfood design review pass 2, part-a: A2UI widgets and app shell

mode: review

## Goal
Judge the LOOK AND FEEL of these families on current main as a demanding product designer dogfooding a design system: A2UI widgets and app shell. This is pass 2. First, for each pass-1 finding in your families (.sdlc/dogfood-design-review/part-a/ui-designer-L1.md), say in one line whether it is fixed, partly fixed or still there, with the screenshot. Then report NEW findings: shapes that read wrong for their role, inconsistent radius, weight or spacing between siblings, controls that do not look like what they are, spacing against the level ladder, weak contrast or hierarchy, misaligned text edges, focus rings colliding with neighbours, broken-looking empty or disabled states, icon and glyph sizing against the text beside them, hand-built stand-ins for fleet controls. Do not re-report what the dogfood lint already enforces (.claude/docs/references/dogfood-lint.md lists the rules).

## Inputs
Screenshots of current main: .sdlc/dogfood-review-2/shots/<family>__<page>__<400|1000>__<light|dark>.png (families: a2ui, shell). Look at every 1000 light and 400 dark image; open the others only where something looks off. Design law: ADR-0245 Amendments 1 to 7 (.claude/docs/adr/0245-foundations-derive-from-one-n.md), ADR-0105 Amendment 2. Kim's rulings that stand: pills for single-line controls and chips; square entry cells are round squares at radius n; icon-only buttons are round; the segmented control is a pill; icon and glyph are distinct (glyph box max(8px, 2n - 2c); icon 2n inside a control or a tier region, 1em in plain prose); one fleet disabled recipe; field outline at least 3:1; cards keep their level radius; the full-width toggle's centred label, the slider thumb and rail, and agent-admin's uppercase provider headings stay as they are.

## Output
## Findings: first the pass-1 status lines, then new findings ranked most visible first, each with the screenshot path, what a person sees, the file:line cause, what to do instead, and whether it is measurable (with the measure). At most 25 new findings; nits last.
