# ADR-0011 — Canonical inbound `action`-prop shape (`{ action, context?, wantResponse? }`)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-27
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-27 — orchestration-lead; pin canonical {action,context?,wantResponse?}, keep lenient name/bare-string fallbacks (Postel))* |
> | **Date** | 2026-06-27 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, pinning the contract the renderer's tolerant reader currently guesses |
> | **Ratified by** | orchestration-lead — 2026-06-27 |
> | **Repairs** | `a2ui-catalog SPEC §5.1` (the `PropDef` for an action-typed prop) + `§5.2` (the `Button` row) · `catalog/default/catalog.json` (`Button.action` prop type) · renderer `LLD-C13` / `renderer.ts` `readActionSpec` (the consumer) |
> | **Supersedes / Superseded by** | Relates: **ADR-0002** (validator/renderer parity — the shared-contract discipline this continues). **Extended by ADR-0054** (adds an optional, client-consumed `submit: true` key to this ADR's canonical shape — the wire `action` message stays byte-identical; this ADR's Decision stands unmodified) |

## Context

The default catalog declares `Button.action` with a **bare** type — `{ "type": { "type": "object" }, "mapsTo":
"action" }` — and the renderer host reads it with a **tolerant** `readActionSpec` (`renderer.ts`) that accepts
three shapes: `{ action: <name> }` (the established fixture convention), `{ name: <name> }` (a synonym), or a
bare string, plus `context`/`wantResponse` passthrough. `readActionSpec`'s own doc-comment closes with: *"the
full inbound action-prop schema is a catalog/spec concern — see the build hand-back's open item."* So the
reader is implementing a convention that no document pins — exactly the "the reader is guessing" gap.

The convention is, in practice, already settled. The renderer integration test fixture is
`action: { action: 'submit' }`, and the outbound `A2uiAction` builder (`action.ts`) consumes `{ name, context?,
wantResponse? }` — so the inbound prop must supply a name plus the optional `context`/`wantResponse`. The
`type: object` in the catalog already declares an object (a bare string would contradict the declared type).

## Decision

We **pin the canonical inbound `action`-prop shape** as an object, in the catalog SPEC and the default
`catalog.json`, and align the reader to it:

```ts
{ action: string; context?: Record<string, unknown>; wantResponse?: boolean }   // `action` = the action NAME
```

- **Catalog SPEC (§5.1 `PropDef` / §5.2 `Button` row):** an action-typed prop (`mapsTo: 'action'`) carries
  this object schema — `action` (required, the action name), `context` (optional object), `wantResponse`
  (optional boolean). The `Button` row records "`action` object → click triggers the named action."
- **`catalog/default/catalog.json`:** `Button.action`'s type tightens from bare `{ "type": "object" }` to the
  `{ action, context?, wantResponse? }` object schema, so the declared contract matches what the renderer
  reads.
- **`renderer.ts` `readActionSpec`:** `action` is the **canonical** name key (the path the pinned shape and the
  fixture use). The `name`-synonym and bare-string branches are **retained as documented Postel's-law
  tolerance**, not silent guesses — see the Open question for the tighten-vs-keep decision.

## Consequences

- **The reader implements a contract, not a convention.** `readActionSpec`'s open doc-item is closed: the
  shape is pinned in the SPEC + `catalog.json`, and the comment points at this ADR instead of "see the build
  hand-back."
- **The catalog's declared type matches reality.** `Button.action`'s schema describes the object the host
  actually consumes, so validation/conformance and the action wiring agree (the ADR-0002 parity discipline).
- **Extensible without a reshape.** `context`/`wantResponse` are already first-class on the outbound
  `A2uiAction`; pinning them on the inbound prop means a future `wantResponse: true` flows end-to-end with no
  reader change.
- **Low blast radius.** The renderer round-trip fixture already uses the canonical `{ action: 'submit' }`, so
  the consumer is conformant today; this pass records the contract and tightens the catalog declaration.
- **Track-disjoint.** This change lives entirely in `@agent-ui/a2ui` + the catalog SPEC — file-disjoint from
  the `ui-button` standards work, so it fans out concurrently (decomposition Track B).

## Resolved on ratification (2026-06-27 — orchestration-lead)

CONFIRMED — **(b) keep-lenient (Postel):** pin `{ action, context?, wantResponse? }` as **THE canonical
shape** (catalog SPEC + `catalog.json`), and the reader **keeps** the `name`-synonym + bare-string fallbacks
as documented inbound tolerance (training-corpus fixtures may use a fallback shape; Postel's law on an inbound
contract is defensible). `act-reader` documents `action` as canonical with the fallbacks marked tolerance.

## Alternatives considered

- **Bare string** (`action: "submit"`) as canonical — rejected: it contradicts the catalog's declared
  `type: object`, and it cannot carry `context`/`wantResponse`. Kept only as a tolerated fallback.
- **`{ name, context?, wantResponse? }`** (use `name`, matching the outbound `A2uiAction.name`) — rejected as
  canonical: the established fixture + the `mapsTo: 'action'` convention use the key `action`; aligning the
  inbound key to the *prop name* (`action`) reads more naturally than to the *outbound field* (`name`). `name`
  stays a tolerated synonym.
- **Leave it unpinned (status quo)** — rejected: that is the defect — the reader guesses a shape no document
  owns, so a corpus author or a catalog extender has nothing to conform to.
