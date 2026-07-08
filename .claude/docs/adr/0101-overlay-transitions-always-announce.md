# ADR-0101 — Overlay open-state transitions always announce: `toggle` fires on every actual show/hide

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-08
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-08 |
> | **Proposed by** | system-planner — root-caused from Kim's gallery ticket #28 ("ui-select and ui-menu: when a selection is made, the menu should close"); the fork investigation's diagnosis re-verified against source before design |
> | **Ratified by** | *(pending — orchestration-coordinator, on the doc-review + green gate)* |
> | **Repairs** | On ratification+build (the builder lands these with the code): `traits/overlay.ts` (the announce moves to the trait's actual-transition points) · `controls/tooltip/tooltip.ts` (`userClose`'s manual `close`/`toggle` emits retired — the trait becomes the sole announcer) · the descriptor event contracts `{menu,select,popover,tooltip,combo-box}.md` (`toggle`/`close` "when" rows re-derived; also corrects `tooltip.md:40`'s stale claim that `toggle` fires BEFORE `open` flips — `tooltip.ts:117-122` sets the prop first) · `overlay-controller.lld.md` (the LLD-C2 event clause) · the suppression pins inverted: `traits/overlay.test.ts:272`, `controls/menu/menu.test.ts:300/364/375/569`, `controls/popover/popover.test.ts:275` (+ browser legs). Docs-only this pass: this record · the index row · ADR-0045's reciprocal link. |
> | **Supersedes / Superseded by** | **Supersedes ADR-0045 in part — the event-discipline leg only**: clause 1's suppression sentence ("`this.open = false` there is a *programmatic* close, which the discriminator deliberately suppresses (no event)") and the Consequence "`toggle`/`close` fire **only** on platform-driven dismissal". Clauses 2 (anchor focus-restore), 3 (DOM-state-resilient `close()`), 4 (committing-Enter `preventDefault`) and the platform-owns-light-dismiss half of clause 1 **STAND** — ADR-0045 stays `accepted` (the ADR-0025/0078 partial-supersession precedent). ADR-0045's own "Known deferred MINOR" (the `close`/`open` listener-order race, with its foreshadowed "future controller change" settling it family-wide) lands here. Relates: **ADR-0019** (the `value:{prop,event}` two-way machinery this makes able to hear every transition) · **ADR-0043** (the primitives stand; its "Two-way `open` via the `toggle` event" clause becomes true on every transition, not only light-dismiss) · **ADR-0053** (its "a one-way `open` would desync on light-dismiss" rationale dissolves; the one-value-mark-per-component schema constraint stands, so `Select.open` stays unbound for that reason alone). |

## Context

Every overlay control already closes on selection — and the close is contractually **silent**. The
trait's `toggle` listener emits `close`+`toggle` only on platform light-dismiss (`newState === 'closed'
&& isOpen`, `traits/overlay.ts:248-261`), and `close()` sets `isOpen = false` *before* `hidePopover()`
precisely so the platform's echo-toggle is swallowed (`overlay.ts:283-285`). Commit paths are such
programmatic closes: `menu.ts:249-252` (`#commit` emits `select`, then `this.open = false`),
`select.ts:320-329` (`selectionCommit.onSelect` sets `value`, then `open = false`). ADR-0045 ratified
the suppression on the premise *"the renderer set them, so it already knows"* — **false for a
commit-close**: the component (a user gesture) set `open = false`; no renderer or data model did.

The mismatch bites because every mirror of `open` is event-driven. The A2UI default catalog marks
Menu/Popover/Tooltip/Modal `value:{prop:'open',event:'toggle'}` (`catalog.json`); the renderer's input
binding writes back **only** on the declared event (`renderer/input.ts:86-98`); and the bound-prop
effect re-applies the model's value unconditionally on each run (`renderer/widget.ts:163-168`). After a
commit-close the model still holds `open: true` — the binding's next wake re-asserts `open = true` and
the panel visibly reopens; until that wake the model lies (the agent sees a phantom open panel). The
gallery exhibits the same class through its own event-driven mirror: `site/lib/component-preview.ts:877`
reads back on `change/input/toggle/select` — the commit's `select` fires while `el.open` is still `true`
(menu emits before flipping), and the close itself never announces. That is ticket #28.

The suppression also **deviates from the platform the trait wraps**: native popovers dispatch
ToggleEvents on *every* transition, including programmatic `showPopover()`/`hidePopover()` — proven
in-repo by the trait's own echo-handling on both programmatic paths (`overlay.ts:268-269, 283-284`);
the discriminator exists solely to swallow what the platform deliberately fires. And the fleet is not
even uniform: tooltip (`popover=manual`, no platform light-dismiss) already emits `close`+`toggle` on
its own user-driven closes (`tooltip.ts:117-123`), while menu/select/popover suppress theirs.

## Decision

**We will make the overlay trait announce every actual open-state transition**: whenever `overlay()`
really shows or hides its panel — platform-, component-, or model-driven — it emits `toggle` on the
host, with `close` alongside every actual hide, after the host's `open` prop has settled. This is
platform fidelity: the same transitions on which the native Popover API fires ToggleEvents.

Mechanics — one home, the trait; all five consumers inherit (menu, select, combo-box, popover, tooltip):

1. **Announce at the trait's transition points** — `open()` on a real show, `close()` on a real hide;
   the light-dismiss path flows through the same points. Tooltip's manual `userClose` emits are retired.
2. **No transition ⇒ no event.** `close()` on an already-closed panel early-returns before any announce
   (`overlay.ts:281-282`, standing per ADR-0045 cl.3); double-open likewise. This is the loop-breaker.
3. **Ordering invariant** — the bind reads `el[prop]` at event time (`input.ts:89`), so the announce
   fires only once `open` is settled. Commit paths set the prop first; the scheduled effect drives
   `handle.close()` → announce, so `el.open === false` at every `close`/`toggle` listener. This settles
   the registration-order race ADR-0045 deferred.
4. **Loop-termination** — model-driven: data `open:false` → bound-prop effect → control effect →
   `close()` → real hide → `toggle` → input binding `setPointer(data, path, false)` → value unchanged →
   `Object.is` cutoff → no wake. Component-driven: commit → `open=false` → `close()` → `toggle` → bind
   writes `false` → model `true→false` wakes the bound-prop effect → `el.open` already `false` →
   props-signal cutoff → no control-effect re-run. Exactly one announce per transition; idempotent.
5. **No new surface otherwise** — no `open` event added, no ToggleEvent payload: we adopt native
   *timing* semantics, not the ToggleEvent interface (the bind reads the prop; a provenance payload is a
   future decision if a consumer ever needs to distinguish light-dismiss).
6. **`ui-modal` is out of scope** — verified conformant: `modal.ts:68-77` announces every user/platform
   close (`if (this.open)` at dialog-close time); its only silent path is genuinely model-driven.

## Consequences

- **+** Two-way binds hear every transition: the A2UI open-binds converge (data model true ⇄ panel state),
  the ticket-#28 class is fixed for menu **and** select (the gallery read-back self-corrects on the
  trailing `toggle` even where an earlier `select` read stale state), and ADR-0053's desync rationale
  dissolves. The fleet gets one uniform announcer; the descriptor "when" clauses collapse to one sentence.
- **−** The light-dismiss vs programmatic distinction is no longer observable from `toggle`/`close`
  alone. The sweep found **no shipped consumer relying on it** — the site demo pages
  (`select/popover/tooltip/modal-demo.ts`) and `component-preview`'s read-back listen to *mirror state*
  and want every transition; no test or page discriminates provenance.
- **−** Model-driven transitions now also announce (native-faithful): consumers receive an event for a
  change the model itself made; the bind's write-back is an idempotent no-op by the `Object.is` cutoff.
- **−** The build owes test inversions: the suppression pins flip to exactly-one-pair assertions —
  `overlay.test.ts:272-289`, `menu.test.ts:300-314, 363-384, 569-583`, `popover.test.ts:275-289`, plus
  browser legs — **and** a new negative control: one transition ⇒ exactly one write-back, no effect
  re-entry (the loop probe).
- **−** Descriptor re-derivations owed: the five overlay `.md` event rows + `overlay-controller.lld.md`;
  `tooltip.md:40`'s before/after ordering claim is corrected in the same pass.
- **−** Tooltip consumers see a small timing shift: `close`/`toggle` now fire from the effect-driven
  transition (the tick after `userClose` sets the prop) rather than synchronously inside `userClose`.
- jsdom is structurally unaffected: the announce is host-level (not a relay of the native echo), so the
  jsdom suites exercise it directly; `simulateLightDismiss` stays the light-dismiss convention (0045 cl.1).

## Alternatives considered

- **Per-control emits at each commit site** (menu `#commit`, select `onSelect`, …) — rejected: N sites to
  keep honest; tooltip's special-case emits plus `tooltip.md:40`'s drifted ordering claim are the
  in-repo evidence that per-control announcement rots. The trait owns the transition truth.
- **Relay the native echo-toggle** (re-emit whenever `newState==='closed'`, dropping the discriminator
  instead of the suppression) — rejected: engine-dependent (jsdom has no Popover API, so the jsdom suite
  goes blind on the new contract) and the echo's timing does not guarantee the host prop has settled —
  the ordering invariant (bind reads `el.open` at event time) would be lost.
- **Catalog-side dodge — drop the open binds** (extend ADR-0053's Select omission to
  Menu/Popover/Tooltip) — rejected: removes a core A2UI capability (agent-driven open/close) instead of
  repairing the contract, and leaves every non-A2UI event-driven mirror (the gallery) broken.
- **Renderer-side observation** (a MutationObserver on the reflected `open` attribute) — rejected:
  repairs one consumer inside one renderer; the family event vocabulary exists precisely so every
  consumer hears state changes the same way.
- **Add an `open` event and/or a provenance payload now** — deferred, not adopted: no consumer needs
  either today; the minimal contract repair is one firing rule.

## Acceptance

- Commit-close on menu/select/combo-box emits exactly one `close`+`toggle` pair with `el.open === false`
  at listener time (jsdom + browser legs).
- Programmatic close (`el.open = false`) emits exactly one pair; a second `open = false` emits nothing.
- Programmatic/trigger open emits exactly one `toggle`; a re-asserted `open = true` emits nothing.
- A2UI round-trip probe: a surface with a Menu open-bind; commit an item; `surface.data` reads
  `open: false` with no agent traffic, and the panel stays closed across a subsequent unrelated
  data-model write (the re-assert probe).
- Loop negative control: with the input binding installed, one transition produces exactly one
  write-back and no effect re-entry.
- The ADR-0045 light-dismiss suites stay green unchanged; `npm run check && npm test` green.
