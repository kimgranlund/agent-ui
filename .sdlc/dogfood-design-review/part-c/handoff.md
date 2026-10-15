# Dogfood design review, part-c: navigation, data display, charts and containers

mode: review

## Goal
Judge the LOOK AND FEEL of these families on main as a demanding product designer dogfooding a design system: navigation, data display, charts and containers. The structural checks (heights on the ramp, type floor, overflow, alignment of option text to trigger text) already pass; do not re-report them. Look for what a person sees: shapes that read wrong for their role (too sharp, too round, a rectangle where a circle belongs), inconsistent radius, weight or spacing between siblings, controls that do not look like what they are (an input that does not read as an input, a button that reads as text), cramped or loose spacing against the level ladder, weak contrast or hierarchy, misaligned baselines or text edges, focus rings that collide with neighbours, empty or broken-looking states, icon and glyph sizing against the text beside them, and anything that looks hand-built where a fleet control exists.

## Inputs
Screenshots of current main: .sdlc/dogfood-design-review/shots/<family>__<page>__<400|1000>__<light|dark>.png (families: navigation, data, charts, containers). Look at every 1000 light and 400 dark image; open the other two only where something looks off. metrics.json beside them has the mechanical checks. Design law: ADR-0245 (.claude/docs/adr/0245-foundations-derive-from-one-n.md, Amendments 1 to 5), Kim's rulings: pills for single-line controls and chips (h/2), icon-only buttons are round squares, cards keep their level radius, the A2UI canvas sits at widget/md. Read the control's CSS and descriptor only to cite the cause of a finding.

## Output
Findings ranked most visible first, each: the screenshot path, what is wrong as a person sees it, the file:line cause where you can find it, what to do instead, and whether it is measurable (a rule the dogfood lint could enforce, with the measure). At most 25 findings; nits last.
