# Domain: <NAME>

> Source: `decomposition-work` domain-reference template. Method depth in `method.md`. Set a real `· YYYY-MM-DD` freshness marker when you copy.
>
> Copy this file to `references/<name>.md`, fill the axes + stop rule, add a worked pass, and add a row to the SKILL.md domain table.

## OUTSIDE-IN axis (structure)

`<whole> → <…> → <…> → <atom>`

State the 3–4 levels from the whole down to the smallest part. One line each defining the level.

## INSIDE-OUT axis (behavior)

`<atom/need> → <…> → <surface> → <coherence>`

State the 3–4 levels from the irreducible unit up to a coherent whole. One line each.

## Stop rule

State when a structural part is atomic (one responsibility / one owner / one contract) and when an action is atomic (one intent / one check), in this domain's terms.

## Cross-check (defect quadrant)

- Every action must host on a node → else `UNHOSTED`.
- Every leaf node must host an action **or** carry a `justify` → else `UNJUSTIFIED-LEAF`. Name the legitimate `justify` values for this domain.
- Note any domain-specific invariant (e.g. dependency direction, feedback requirement).

## Worked pass (<short example>)

OUTSIDE-IN: … INSIDE-OUT: … Map: surface one `UNHOSTED`, fix it, re-check → clean. End with a `coverage_check.py`-shaped manifest:

```json
{ "domain": "<name>", "nodes": [], "actions": [], "hosts": [] }
```
