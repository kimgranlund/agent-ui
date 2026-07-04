# ADR-0050 — form-provider context via a connect-time registration event (the fleet's first context/provider primitive)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-01
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-01 |
> | **Proposed by** | the host session (design intake, G7 completion — the system-planner seat was infra-blocked; authored inline against the adr-author standard) |
> | **Ratified by** | Kim (user) — 2026-07-01, the explicit fork ruling "1b + 2B, go" |
> | **Repairs** | goals §G7 (the `form-provider` DoD box — the discovery mechanism named there as "MutationObserver" is satisfied by registration-on-connect, asserted by behavior) · plan §3/§5 (the reserved context primitive / `controls/field/`) · `dom/form.ts` (gains the connect-time dispatch) · **NEW** `traits/form-registry.ts` · **NEW** `controls/form-provider/*` · decomp `g7-field-form-provider.decomp.json` (s1/s5/s9) — all edited at build time, gated on this ADR's ratification. |
> | **Supersedes / Superseded by** | None. **Relates ADR-0013** (UIFormElement, the base that dispatches) · **ADR-0029** (the validity seams the aggregate reads) · **ADR-0042/0043** (the `controls/_base`/traits composition pattern the registry controller follows). |

## Context

G7's `form-provider` must **discover** `UIFormElement` descendants (including late-added ones), **aggregate**
their values/errors/validity reactively, and support submit/reset — and it is the fleet's **first
context/provider primitive** (the `dom` barrel exports element hosts, props, directives, and `mount`; no
context mechanism exists). The mechanism choice is load-bearing: it decides whether the base class changes,
how teardown stays zero-residue (the trait contract), how nested providers scope, and what a second context
consumer (theme, density, A2UI surface state) would later reuse. Every value control already natively
form-associates via `ElementInternals`, so the provider is an aggregation layer **on top of** native `<form>`
association — never a replacement.

## Decision

We will build the provider on a **connect-time registration event + a reactive registry**:

1. **`UIFormElement` announces itself at connect.** In its (already super-wrapped) `connectedCallback`, the
   base dispatches a **composed, bubbling protocol event** (working name `ui-form-connect`) whose detail
   carries the control and a **connection-scoped teardown handle** (an `AbortSignal` tied to the connection
   scope). The event name is deliberately `ui-`-prefixed and **outside** the public component-event vocab
   (`change · input · select · open · close · toggle`) — it is base↔provider plumbing, not a consumer-facing
   semantic event.
2. **The nearest provider registers it.** `ui-form-provider` listens for the event, calls
   `stopPropagation()` (nearest-provider scoping under nesting), and adds the control to a **reactive
   registry** (a signal-held set) via a `traits/form-registry.ts` controller.
3. **Deregistration rides the handle, not an event.** A disconnected node cannot dispatch to the provider,
   so the registry subscribes to the handle's `abort` — the control's disconnect tears its entry down.
   Zero-residue holds by construction; **no MutationObserver is needed** (a late-added control registers
   because its own `connectedCallback` fires).
4. **Aggregation is computeds over member signals.** Props are signals, so the aggregate (values by `name` ·
   invalid set · overall validity) is built as scope-owned computeds reading each member's public reactive
   surface — fine-grained waking, zero polling.

## Consequences

- **The base class gains a dispatch.** Every `UIFormElement` now fires one event per connect — negligible
  cost, but it is a **base-contract change** all existing controls inherit; the form-suite tests must show
  zero behavioral drift for provider-less usage (the event simply bubbles to nobody).
- **The primitive is form-specific, not generic.** A future generic context (theme/density/A2UI) does NOT
  automatically fall out; if a second context consumer appears, the community `context-request` protocol is
  the named re-evaluation trigger (the same extract-on-second-consumer discipline as `roving-grid`, ADR-0048).
- **Nearest-provider scoping is event-path-based.** `stopPropagation()` at the first provider gives nesting
  semantics for free, but a provider that is *not* an ancestor sees nothing — intentional (context flows down
  the tree), documented in `form-provider.md`.
- **The protocol event name sits outside the event vocab** — recorded here so the naming trip-wire treats the
  `ui-`-prefixed protocol namespace as distinct from public component events.
- **Stale → re-verify:** `dom/form.ts` + its tests (the dispatch, zero-drift for provider-less controls) ·
  `traits/form-registry.ts` + tests (registry, teardown, nesting) · `controls/form-provider/*` ·
  goals §G7 · the decomp s1/s5/s9 acceptance rows.

## Acceptance

- A control connected under a provider appears in the aggregate; one added **later** appears too
  (registration-on-connect); a **removed** control leaves the aggregate (the handle path) — jsdom probes
  with negative controls (a non-`UIFormElement` child never registers; under two nested providers a control
  registers with the **nearest only**).
- An effect reading the aggregate re-runs on a member's value write (the props-are-signals proof).
- Provider-less controls show **zero** behavioral drift (the full existing form suite stays green).
- Disconnecting the provider leaves zero subscribers/listeners (`inspect` + AbortSignal checks).

## Alternatives considered

- **(a) The community `context-request` protocol** — rejected *for now*: it solves shadow-boundary crossing
  and generic typed-context injection that this light-DOM, single-consumer fleet doesn't need yet, and its
  direction (consumer requests, provider responds) inverts this use case (the provider aggregates passive
  controls). It remains the named candidate if a second context consumer appears — do not pre-abstract.
- **(c) `querySelectorAll` + MutationObserver scan** — rejected: zero base edit is its real virtue, but it
  re-scans the subtree on every mutation, couples the provider to DOM shape rather than the FACE type,
  discovers by selector heuristics (`[name]`) instead of identity, and needs its own teardown machinery the
  connection-scoped handle gives for free.
- **A global/static registry (module singleton)** — rejected: multiple providers, nesting, and zero-residue
  teardown all break against a process-wide set; ownership must ride the DOM tree and the connection scope.
- **Making the provider a `<form>` subclass / FACE participant** — rejected: the provider carries no form
  value (it aggregates others'); `formAssociated` would double-submit, and the zero-native rule plus the
  existing native-`<form>` association make wrapping-composition the correct relationship.
