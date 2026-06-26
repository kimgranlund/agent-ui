# Domain: Layout

> `decomposition-work` domain reference. Method depth in `method.md`. · 2026-06-26

## OUTSIDE-IN axis (structure)

`frame → regions → groups → atoms`

- **frame** — the viewport/surface and its archetype (shell, dashboard, marketing page, mobile).
- **regions** — the named macro-areas (header, nav, main, aside, footer; or hero/sections).
- **groups** — clusters within a region (a toolbar, a form section, a card grid).
- **atoms** — the smallest placed unit (a control, a label, an icon slot).

## INSIDE-OUT axis (behavior)

`feature-actions → bindings → surfaces`

- **feature-actions** — what the user does here (submit, filter, navigate, dismiss).
- **bindings** — the state/data each action reads or writes.
- **surfaces** — the region/atom that must host the action so it is reachable.

## Stop rule

Stop dividing a region when it maps to **one layout primitive / one responsibility** (a single grid, stack, or control). Stop reducing an action when it is **one user intent with one commit**.

## Cross-check (defect quadrant)

- Every feature-action must host on a region or atom → else `UNHOSTED` (the screen can't do it).
- Every leaf atom must host an action **or** carry a `justify` (`content`, `affordance`, `spacing`) → else `UNJUSTIFIED-LEAF` (decoration).

## Worked pass (a sign-in screen)

OUTSIDE-IN: `frame` → `{header, main, footer}` → `main` → `{credentials-group, submit-bar}` → `submit-bar` → `{submit-button}` (leaf).
INSIDE-OUT actions: `enter email`, `enter password`, `submit`, `recover password`.
Map: `recover password` finds no node → `UNHOSTED` → add a `recovery-link` atom under `main`. Re-check → clean.

```json
{
  "domain": "layout",
  "nodes": [
    {"id":"main","label":"main"},
    {"id":"creds","label":"credentials-group"},
    {"id":"submit","label":"submit-button","leaf":true},
    {"id":"recover","label":"recovery-link","leaf":true}
  ],
  "actions": [
    {"id":"email","label":"enter email"},
    {"id":"pass","label":"enter password"},
    {"id":"go","label":"submit"},
    {"id":"recoverpw","label":"recover password"}
  ],
  "hosts": [
    {"action":"email","node":"creds"},{"action":"pass","node":"creds"},
    {"action":"go","node":"submit"},{"action":"recoverpw","node":"recover"}
  ]
}
```
