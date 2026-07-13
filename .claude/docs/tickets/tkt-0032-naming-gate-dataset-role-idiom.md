---
doc-type: ticket
id: tkt-0032
status: open
date: 2026-07-13
owner:
kind: bug
---
# TKT-0032 — naming-gates Gate-3 doesn't pattern-match the `dataset.role = ident` write idiom

## Summary
Surfaced during the M2 review (2026-07-13, `58bc577`): `naming-gates.test.ts` Gate 3 (the
`data-role` registry trip-wire) governs two write idioms — a literal `dataset.role = '<string>'`
(the `usedRoles` matcher) and a dynamic `setAttribute('data-role', <ident>)` (the `dynamicRoleSites`
fail-closed matcher, backed by `ROLE_IDENTIFIER_EXCEPTIONS`). It does NOT recognize a **dynamic**
`element.dataset.role = <ident>` assignment — the `dataset.X = ident` form matches neither matcher.
`ui-conversation` originally wrote `bubble.dataset.role = role` (role ∈ a closed 3-member union) and
the gate stayed green **vacuously on the `.ts`** — governance came only from the CSS `[data-role='…']`
selectors. Worked around in M2 by switching to `setAttribute('data-role', role)` (which the dynamic
matcher DOES govern) + a `ROLE_IDENTIFIER_EXCEPTIONS` entry, so the specific site is now enforced —
but the gate's coverage gap remains: a future control writing `dataset.role = someIdent` with an
UNregistered value would pass the gate silently.

## Acceptance
- Gate 3 recognizes the dynamic `<expr>.dataset.role = <ident>` write idiom the same way it recognizes
  `setAttribute('data-role', <ident>)` — fail-closed against `ROLE_IDENTIFIER_EXCEPTIONS`, so an
  unregistered dynamic value trips the gate regardless of which of the two write forms is used.
- A non-vacuous proof: a fixture (or a temporary probe verified then removed) confirming an unregistered
  `dataset.role = ident` write is actually caught.
- No false positives on the existing green tree (the M2 `setAttribute` site + all literal/CSS usages
  stay green; the `dataset.role = ident` exception, if any site keeps that idiom, is representable).

## Repro
`naming-gates.test.ts` Gate 3 passes on a source file whose only `data-role` write is
`el.dataset.role = someUnregisteredIdent` — the value is never checked against `ALLOWED_ROLES`.

## Expected vs actual
- **Expected:** every dynamic `data-role` write idiom (`setAttribute` AND `dataset.X =`) is governed
  fail-closed.
- **Actual:** only `setAttribute('data-role', ident)` is; `dataset.role = ident` slips through.

## Classification
Axis: **structural (gate under-enforcement / coverage gap)** — plane:
`packages/agent-ui/components/src/controls/naming-gates.test.ts` (Gate 3's `dynamicRoleSites` matcher).
The naming law (TKT-0025, `references/naming.md` §6/§11) is correct; the enforcing gate is incomplete.

## Severity
**minor** — no live defect (the one dynamic-write site is governed via the M2 `setAttribute` workaround;
all current values are registered). The cost is a latent enforcement hole a future control could fall into.

## Links
- `packages/agent-ui/components/src/controls/naming-gates.test.ts` (Gate 3: `usedRoles` /
  `dynamicRoleSites` / `ROLE_IDENTIFIER_EXCEPTIONS`) · `references/naming.md` §6 (the registry) + §11
  (the gates) · commit `58bc577` (the M2 `setAttribute` workaround that motivated this) · TKT-0025
  (the naming master plan that minted the gate).

## Findings
