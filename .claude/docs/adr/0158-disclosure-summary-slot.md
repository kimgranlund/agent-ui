# ADR-0158 — `ui-disclosure` realizes the `slot=summary` foreseen extension: summary-hosted controls adopt declaratively, survive heal-rebuilds, carry a component-owned activation guard, and the fold's accessible name scopes to the summary label

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-23
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-23 |
> | **Proposed by** | build seat ([GH #226](https://github.com/kimgranlund/agent-ui/issues/226) intake — the screens:component-checker review of GH #225 named the structural hazard AND the accessible-name finding; disclosure.md:28 / SPEC-R14 had already fenced `slot=summary` as the named foreseen extension) |
> | **Ratified by** | — |
> | **Repairs** | SPEC-R14 (the "summary is a prop, a rich `slot=summary` child is the fenced foreseen extension" fence — lifted by this, its own named re-entry record) · SPEC-R16 (the "children = body" anatomy invariant gains its one ruled exception: `slot="summary"` children = the summary row) · SPEC-R17 (the a11y contract gains a part-level accessible-name scoping rule; the no-internals-role/no-host-ARIA law itself stands byte-unchanged). On this build: `packages/agent-ui/components/src/controls/disclosure/{disclosure.ts,disclosure.css,disclosure.md,disclosure.test.ts,disclosure.browser.test.ts}` · `packages/agent-ui/app/src/controls/agent-admin/{agent-admin.ts,agent-admin.browser.test.ts}` (the GH #225 `placeSummaryControl` app-side injection + preventDefault guard retire in favor of declarative `slot="summary"` marking) |
> | **Supersedes / Superseded by** | Extends [ADR-0113](./0113-content-family-v1-scope.md) (cl.4's summary-as-prop fence is lifted by the extension record cl.4 itself foresaw; the native-`<details>` wrap, the component-owned parts, and the no-`[slot=]`-grammar-for-BODY-content rulings all stand) · Composes on [ADR-0101](./0101-overlay-transitions-always-announce.md) (the `open`/`toggle` announce law is untouched) and [ADR-0022](./0022-childpart-native-movebefore-reorder-focus.md) (adoption and rescue MOVE nodes, never clone) · Relates [ADR-0006](./0006-button-anatomy-optional-icon-slot-density-acceptance.md)/[ADR-0012](./0012-button-anatomy-trailing-adornment-slot.md) (the fleet's `[slot=…]` position-slot grammar this joins) · GH #226 / GH #225 |

## Context

GH #225 put the agent-admin master `ui-switch`es ON their settings folds' heading rows by appending them
into `ui-disclosure`'s **component-owned** summary part from the composing app (`placeSummaryControl`,
`agent-admin.ts`), with an app-side `preventDefault()` click guard so the switch flips without folding.
The independent review judged it acceptable as shipped but named the structural coupling: a disclosure
heal-rebuild (`disclosure.ts` — a destructive `host.textContent` clobber detaches the details part and
rebuilds fresh) would **silently drop** the injected control, because the component has no idea the app
put it there. Nothing triggers that today (agent-admin composes build-once), but the coupling is real,
and every future consumer would have to re-derive the same placement timing ("after connect, parts must
exist") and re-implement the same activation guard.

`disclosure.md:28` and SPEC-R14 already name the proper home: "a rich `slot=summary` child is the named
foreseen extension (not v1)." The review also found an accessible-name muddle: the native `<summary>`
computes its name from content, so a nested control's text ("Agent active") is absorbed into the fold's
name alongside the label.

**Verified against the real shipped source before deciding:** the components fleet's authored-child
projection grammar is the native `slot` **attribute** on light-DOM children — `[slot='leading']`/
`[slot='trailing']` (button ADR-0006/0012, text-field, card-header/footer), `[slot='empty']`
(command-modal) — and the descriptor gate (`component-descriptor.ts` `collectStyledSlots`) enforces
exactly that `[slot=…]` selector vocabulary against the descriptor's `slots[]`. `data-slot` is the
**app-package shell** vocabulary (`ui-super-shell`'s region slots), not a components-fleet control
grammar. The dispatch brief guessed `data-slot`; the fleet precedent, the descriptor gate machinery,
and the foreseen extension's own literal name (`slot=summary`) all rule `slot="summary"`.

## Decision

### 1 · The grammar: `slot="summary"` children join the summary row

A host light-DOM child marked `slot="summary"` is **adopted into the component-owned summary part**
(after the chevron and the `summary`-prop label, append order preserved) instead of the body — at
connect, and for late arrivals (parser streaming, a later `appendChild`) by the existing heal observer.
SPEC-R16's anatomy invariant becomes: *children = body, except `slot="summary"` children = the summary
row*. Everything else about the invariant (moved never cloned — ADR-0022; ≤2-pass self-convergence)
stands. No new prop, no new event (the closed event vocabulary is untouched), no geometry change — the
adopted control is a flex-frozen (`flex: none`) row item the flex-growing label naturally pushes to the
row's inline end, the GH #225 heading-row shape.

### 2 · Rebuild survival: the summary row's composition is declarative state

On a clobber rebuild (the detached-details branch of the heal), the slotted children still present in
the **detached old part are rescued** — moved, same node identity, listeners intact — into the fresh
summary part, exactly as the `summary`/`open` props re-sync onto the fresh parts. The law: the summary
row's composition (label prop + slotted controls) is **declarative state that re-converges**; a
destructive children write replaces the *body content* only. The detached part IS the record — no
tracking field: a control the author explicitly removed before the clobber is not in the old part and
stays gone. A clobber write that itself authors new `slot="summary"` children keeps both (new first,
rescued after); an author who wants the old control gone removes it explicitly. This closes GH #226's
silent-drop hazard by construction.

### 3 · The activation guard moves INTO the component

A component-owned `click` listener on the summary part calls `preventDefault()` iff the click
originated inside an adopted `slot="summary"` child — cancelling the `<summary>`'s details-toggle
activation behavior (the DOM canceled-activation rule) while the control's own click behavior
(e.g. `ui-switch`'s checked-flip, which lives in the control's OWN listener) is untouched — for real
pointer clicks AND the synthetic `host.click()` press-activation fires for Space/Enter on a focused
control. The summary's own keyboard activation needs no guard (a summary only key-activates while
itself focused). The guard is wired wherever the toggle listener is wired: at connect and in the heal
rebuild branch, abort-owned. Every consumer now gets the GH #225 semantics for free; the app-side
guard retires. A native-activatable slotted child (a real `<button>`) never needed the guard (it is
its own activation target); the guard exists for the fleet's non-natively-activatable custom controls.

### 4 · Accessible-name scoping: the fold's name IS the summary label

The summary part carries `aria-labelledby` pointing at the summary-text span's generated id (a module
sequence, the `ui-tabs-${seq}` precedent), set unconditionally at part creation. The fold's accessible
name is therefore **always the `summary` prop's text** — a slotted control's text ("Agent active") can
never be absorbed into it, and with no slotted content the computed name is identical to the previous
name-from-content result (the chevron was already `aria-hidden`). This is PART-level ARIA on
component-owned native elements — the same layer that already carries the chevron's `aria-hidden` —
so SPEC-R17's actual law (no internals role, no HOST ARIA; the native part is the semantic element)
stands byte-unchanged. The slotted control names itself (its own `aria-label`), unchanged.

## Alternatives considered

- **`data-slot="summary"`** (the dispatch brief's guess) — rejected: `data-slot` is the app-shell
  region vocabulary; the components fleet's projection grammar is `[slot=…]`, the descriptor gate
  polices exactly that, and the foreseen-extension fence literally names `slot=summary`.
- **A tracking field for rescue** (`#slotted: Element[]`) — rejected: it needs removal bookkeeping the
  host childList observer cannot see (removing a child from the summary part is not a host mutation);
  querying the detached part at rebuild time is stateless and cannot go stale.
- **`aria-labelledby` only while slot content exists** — rejected for path-dependence: always-on is
  deterministic, behavior-identical in every no-slot case, and states the cleaner law (the name is the
  prop, full stop).
- **Keeping `placeSummaryControl` app-side** — the status quo GH #226 exists to retire.

## Consequences

- `ui-disclosure`'s public API widens by one documented slot; descriptor `slots[]` gains the `summary`
  row (the CSS `[slot='summary']` rule keeps the descriptor gate's styled↔declared agreement).
- agent-admin's placement becomes one attribute + one append at compose time — the connect-order
  timing constraint (`placeSummaryControl` had to run after `this.append(shell)`) disappears.
- The GH #225 browser proofs run unchanged (same DOM shape: the switch sits in the summary part); a
  new rebuild-survival proof lands at both the component and the agent-admin level.
- SPEC-R14/R16/R17's texts lag until this record ratifies (the status-lag philosophy — the tree wins);
  the foreseen-extensions list re-entry condition ("each re-enters only by its own record") is met by
  this record.
