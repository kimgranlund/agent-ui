# Wire tolerances — the A2UI Postel-arm registry

> Status: authored 2026-08-06 (GH #484) from a repo sweep of the renderer/producer's deliberate
> inbound-tolerance arms. Each row is a place the wire ACCEPTS something beyond the canonical A2UI
> shape — a synonym, a legacy framing, a graceful degrade — and every row must carry the record that
> sanctioned it plus the test that would fire if the arm silently widened. This doc is the INDEX;
> the arms themselves stay where they are (module-move to one consolidated registry is deferred to
> the M-E drift-audit slice, GH #477 — see "Deferred" below). Siblings: none yet — first doc of its
> kind on the map.
>
> Scope: only arms that accept a NON-canonical inbound shape or value. A field simply being
> optional/unchecked (e.g. `callFunction`'s `args`/`wantResponse` in `validate.ts`) is not a
> tolerance arm by this doc's definition — it is not accepting anything beyond the canonical schema,
> so it is not indexed here.

## The arms

| # | What the wire accepts beyond canonical | Where | Sanctioning record | Pinning test | Widening risk |
|---|---|---|---|---|---|
| A1 | A bare string as an `action` prop value, taken as the action name (no `context`/`wantResponse`/`submit`) | `packages/agent-ui/a2ui/src/renderer/renderer.ts:517-518` (`readActionSpec`) | ADR-0011 (canonical `{action,context?,wantResponse?}` shape decision, "keep-lenient (Postel)" ruling) | `packages/agent-ui/a2ui/src/renderer/renderer.test.ts:272-275` ("keeps the lenient bare-string fallback (Postel)") | A future author reading `action` as a string in a NEW context (not this one narrow reader) would silently swallow malformed data with no `context`/`wantResponse` surfaced — never widen the reader to also accept e.g. a bare number. |
| A2 | Upstream A2UI Basic Catalog's `{event:{name, context?}}` Action shape, normalized to `{name, context}` (`wantResponse`/`submit` stay `undefined`) | `packages/agent-ui/a2ui/src/renderer/renderer.ts:520-528` (`readActionSpec`) | ADR-0169 cl.10 (amends ADR-0011) | `packages/agent-ui/a2ui/src/catalog/a2ui-basic/upstream-fixtures.test.ts:101-120` (real click on a rendered upstream fixture, asserts the normalized `{action,context}` wire shape) | The `{functionCall}` sibling Action arm is DELIBERATELY excluded (ADR-0169 E7/GH #429 — see row E7 below); widening this arm to also read `{functionCall}` would silently execute client-side actions the renderer has no path for. |
| A3 | `{name}` as a synonym for canonical `{action}` (taken only when `action` is absent; canonical wins when both present) | `packages/agent-ui/a2ui/src/renderer/renderer.ts:529-530` (`readActionSpec`) | ADR-0011 ("keep-lenient (Postel)" ruling — the `name`-synonym + bare-string fallbacks retained as documented inbound tolerance) | `packages/agent-ui/a2ui/src/renderer/renderer.test.ts:261-270` (canonical-wins-when-both-present + the lenient-`name`-synonym cases) | Same reader, same risk class as A1 — do not extend past the one `name`/`action` pair. |
| C1 | The `checks` array's Button-example wire shape `{condition:{call,args}, message}`, unwrapped to the internal flat `{call,args,message}` `Check` type (alongside the canonical flat shape, which is read as-is) | `packages/agent-ui/a2ui/src/renderer/checks.ts:55-77` (`readCheck`) | ADR-0029 §1 / Decision 1 ("Fork 1 — Postel": two accepted wire shapes, symmetric with ADR-0011's action-shape reader) | `packages/agent-ui/a2ui/src/renderer/checks.test.ts:132-145` (8d — "condition wrapper is unwrapped and evaluated identically to the flat shape") | The unwrap keys ONLY on the literal `condition` wrapper key — it must stay orthogonal to the check's own `call` name (a combinator check named `and`/`or` is a flat check, not a `condition` wrapper); do not widen the key match. |
| S1 | A non-string or unrecognized `catalogId` on a produce request degrades to the default catalog fallback (never a 400/500, never a mixed catalog+prompt) | `packages/agent-ui/a2ui/tools/agent/chat-validation.ts:79-81` (`selectCatalog`) | ADR-0169 cl.3 (server-side catalog selection, "fail-closed" ruling) | **NONE FOUND** — see Gaps below | Silent — there is no regression trip-wire today if `selectCatalog`'s fail-closed default were accidentally inverted (e.g. throwing, or falling through to `undefined`). |
| V1 | Upstream A2UI Basic Catalog fixture payloads' `version: "v0.9"` envelope field, rewritten to the fleet's pinned `v1.0` before validation/render (a FRAMING-only translation — every component-tree byte stays verbatim) | `packages/agent-ui/a2ui/src/catalog/a2ui-basic/upstream-fixtures.test.ts:30-32` (`toV1`) | ADR-0169 cl.1 (Package home section, `upstream-fixtures.test.ts` row: "The fixture harness rewrites each message's `version: "v0.9"` envelope field to our pinned `v1.0`") | The function itself IS the test harness — exercised by every `describe` block in the same file (e.g. `:71`, `:101`, `:124`) | **Not a runtime tolerance** — `SUPPORTED_VERSIONS` (`packages/agent-ui/a2ui/src/protocol.ts:160`) has no `v0.9` member at all, only `v1.0`/`v0.9.1`. This arm exists ONLY in the test harness, translating a fixture-authoring convention; production `validateA2ui` never sees a bare `v0.9` and would reject it. Listed here because GH #484 named it explicitly, not because it is wire-reachable. |
| E7 | An object VALUE carrying an own `functionCall` key on a prop declaring `PropDef.rejectFunctionCall: true` fails `CATALOG` at validate time (the INVERSE of a tolerance — a narrowing, not a widening) | `packages/agent-ui/a2ui/src/catalog/conformance.ts:69-84` (`matchesType`/`isFunctionCallAction`), declared at `packages/agent-ui/a2ui/src/catalog/a2ui-basic/catalog.json:111` (`Button.action.rejectFunctionCall`) | ADR-0169 E7 row (exclusion table) / GH #429 | `packages/agent-ui/a2ui/src/catalog/conformance.test.ts:148-172` (describe block "PropDef.rejectFunctionCall (ADR-0169 E7 / GH #429)") | Absent on the DEFAULT catalog's `Button.action` — the default catalog's own Postel tolerance for an unrecognized action shape (A1/A3 above) stays untouched, byte-identical, confirmed by the negative control at `a2ui-basic/index.test.ts:172` ("the SAME `{functionCall}` shape still VALIDATES on the default catalog"). Declaring `rejectFunctionCall` on a NEW catalog/prop pair without also adding a negative control here would silently narrow that catalog's Postel tolerance with no gate noticing. |

## Gaps found (report-only, not fixed this pass)

- **S1 (`selectCatalog`) has no test anywhere in the repo that pins its fail-closed behavior by
  name.** A repo-wide search for `selectCatalog` across every `*.test.ts` file returns zero hits —
  the arm is sanctioned (ADR-0169 cl.3) but unpinned. Flagging per GH #484's "report, don't fix"
  instruction; a follow-up should add a direct unit test (unknown id → fallback catalog, non-string
  id → fallback catalog, known id → that catalog) alongside `chat-validation.ts`.
- No tolerance arm was found that is NOT sanctioned by an existing ADR/GH-issue record. The sweep
  (`grep -rn` for `tolerance`/`Postel`/`degrade`/`fail-closed`/`fallback` across
  `packages/agent-ui/a2ui/src` and `packages/agent-ui/a2ui/tools`) also surfaced several
  request-validation degrades (`validateMode`, `validateGenuiSurface`, `validateA2uiEnabled`,
  `validateEffort` in `chat-validation.ts`) — those are HTTP-request trust-boundary defaults (a
  crafted/stale field degrades to `undefined`, never a wire-shape tolerance), out of this doc's
  scope by the definition above; each already carries its own ADR/SPEC citation in its own comment
  block and is not duplicated here.

## Deferred — the module-move phase

GH #484's "mechanical-first candidate" shape offered two options: a module move (consolidating
every arm above into one physical registry file the renderer/producer import from) or, at minimum,
this INDEX + a linking gate. **This build ships the INDEX + gate only.** The module move rides
M-E's drift-audit slice (GH #477), which walks the same wire surfaces — moving `readActionSpec`'s
arms, `selectCatalog`, and `readCheck`'s wrapper-unwrap into one file is a structural refactor
across files the M-D build campaign is concurrently modifying (`renderer.ts`, `catalog.ts`,
`chat-validation.ts`), and is out of scope for this pass's new-files-only fence.

## Mechanization

The linking gate (`site/lib/wire-tolerance-index.test.ts`) asserts, for every row above with a
`Where` cell: the cited file exists, and a source-text anchor drawn from that row's own doc-comment
is present at (or near) the cited location. It also asserts the row COUNT is exact — a new
tolerance arm (a new Postel-comment anchor) appearing anywhere in the swept files without a
matching INDEX row turns the gate red.

## Decisions (source)

This doc carries no decisions of its own; it indexes arms already ruled by:

- [**ADR-0011**](../adr/0011-canonical-action-prop-shape.md) — the canonical `{action,context?,wantResponse?}`
  shape + the `name`-synonym/bare-string Postel fallbacks (A1/A3).
- [**ADR-0029**](../adr/0029-a2ui-v1-checks-inline-validation.md) — the `checks` `condition`-wrapper
  Postel reader (C1).
- [**ADR-0034**](../adr/0034-a2ui-server-initiated-function-invocation.md) — `callableFrom`/execution-boundary
  vocabulary the E7 exclusion sits alongside.
- [**ADR-0169**](../adr/0169-a2ui-basic-catalog-upstream-interop.md) — the upstream `{event}` Action arm
  (cl.10/A2), the fail-closed catalog selection (cl.3/S1), the version-envelope test-harness translation
  (cl.1/V1), and the `{functionCall}` exclusion (E7 row).
