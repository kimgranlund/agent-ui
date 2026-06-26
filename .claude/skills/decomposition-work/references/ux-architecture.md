# Domain: UX Architecture

> `decomposition-work` domain reference. Method depth in `method.md`. · 2026-06-26

## OUTSIDE-IN axis (structure)

`journey → flows → screens → states`

- **journey** — the end-to-end arc a user travels (onboard, purchase, recover).
- **flows** — ordered segments of the journey (sign-up flow, checkout flow).
- **screens** — a place that presents one decision or step.
- **states** — the variants of a screen (empty, loading, error, success, partial).

## INSIDE-OUT axis (behavior)

`user-goals → tasks → interactions → feedback`

- **user-goals** — what the person is trying to accomplish (not features).
- **tasks** — the concrete steps that satisfy a goal.
- **interactions** — the input acts a task requires.
- **feedback** — what the system shows so the user knows the task's result/system status.

## Stop rule

Stop dividing when a **screen presents one decision** and a **task is one user intent**. A screen asking two unrelated decisions is two screens; a "task" with no observable feedback is unfinished.

## Cross-check (defect quadrant)

- Every task must have a screen/state to occur in → else `UNHOSTED` (a step with no place to happen).
- Every leaf screen/state must serve a task **or** carry a `justify` (`transition`, `confirmation`) → else `UNJUSTIFIED-LEAF` (a screen for the org chart, not the user).
- A task with no `feedback` interaction is a coverage gap even if hosted (no failure-support / status visibility).

## Worked pass (account recovery flow)

OUTSIDE-IN: `recovery` (flow) → `{request-screen, sent-screen, reset-screen}` → `reset-screen` → states `{form, error, success}`.
INSIDE-OUT goals/tasks: `request a reset link`, `confirm it was sent`, `set a new password`, `see why a reset failed`.
Map: `see why a reset failed` hosts on `reset-screen:error`. `sent-screen` hosts `confirm it was sent` (tag `justify:"confirmation"`). Re-check → clean.

```json
{
  "domain": "ux-architecture",
  "nodes": [
    {"id":"request","label":"request-screen","leaf":true},
    {"id":"sent","label":"sent-screen","leaf":true,"justify":"confirmation"},
    {"id":"reset","label":"reset-screen"},
    {"id":"reset_err","label":"reset:error","leaf":true}
  ],
  "actions": [
    {"id":"req","label":"request reset link"},{"id":"setpw","label":"set new password"},
    {"id":"whyfail","label":"see why reset failed"}
  ],
  "hosts": [
    {"action":"req","node":"request"},{"action":"setpw","node":"reset"},
    {"action":"whyfail","node":"reset_err"}
  ]
}
```
