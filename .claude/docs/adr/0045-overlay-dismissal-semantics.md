# ADR-0045 — Overlay dismissal semantics: platform-owned light-dismiss, anchor focus-restore, DOM-state-resilient close

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-01
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-01 |
> | **Proposed by** | orchestration-lead — driving the Wave-4 overlay family to the cross-engine browser gate; the reconciliation the smokes forced (jsdom-green controls failed 18 cross-engine assertions) |
> | **Ratified by** | orchestration-lead — on the green `test:browser` (Chromium **and** WebKit), the ADR-0043 overlay-half ratification |
> | **Repairs** | `traits/overlay.ts` (restoreFocus target · resilient close · gap-aware positioning) · `traits/selection-commit.ts` (the committing-Enter `preventDefault`) · `controls/combo-box/combo-box.ts` (drop the control Escape handler) · the five overlay controls' browser smokes (dismiss-timing + the jsdom `simulateLightDismiss` convention). |
> | **Supersedes / Superseded by** | **Superseded by ADR-0101 in part** *(proposed, pending ratification — the event-discipline leg only: clause 1's suppression sentence + the "fire only on platform-driven dismissal" consequence; clauses 2/3/4 and platform-owned light-dismiss **STAND** — this ADR stays accepted, the ADR-0025/0078 precedent)*. **Relates** ADR-0043 (the overlay/selection primitives this hardens) + ADR-0019 (the two-way `open` contract). |

## Context

The Wave-4 overlay family (`ui-popover`/`-tooltip`/`-menu`/`-select`/`-combo-box`) was jsdom-green and
adversarially reviewed, yet its **first** cross-engine browser run failed **18** assertions in both Chromium
and WebKit — all in the dismissal/focus paths that jsdom (no Popover API, no layout, no real focus) cannot
exercise. jsdom-green is necessary but not sufficient for an overlay; the browser smoke is the real gate.

## Decision

Four rulings, all now proven by the green cross-engine smokes.

1. **`auto` popovers → the PLATFORM owns Escape + outside-click light-dismiss.** The Popover API close-signal
   is document-level and fires regardless of focus location, so the overlay controller's `toggle` listener
   emits `close`+`toggle` and syncs the bound `open` on platform dismissal (ADR-0019). A control must **NOT**
   add its own Escape handler: `this.open = false` there is a *programmatic* close, which the discriminator
   deliberately suppresses (no event) — the control would swallow the platform dismissal. `ui-combo-box`'s
   Escape handler was removed for exactly this. jsdom has no light-dismiss, so jsdom dismiss-probes use a
   `simulateLightDismiss` helper (dispatch the `closed` toggle the controller listens for) — not a control
   handler standing in for a platform behaviour.

2. **`restoreFocus()` targets the ANCHOR, not `document.activeElement`.** The captured "opener" is unreliable:
   WebKit does not focus a `<button>` on click (so it reads as `body`), and it can be stale by the time the
   scope-owned effect runs. The anchor (the trigger) is the deterministic, DoD-expected restore target;
   `opener` remains only a fallback for a non-focusable anchor.

3. **`close()` is resilient to `isOpen`-flag desync.** An async/spurious platform toggle can drift the internal
   flag false while the panel is still in the top layer. `close()` therefore hides whenever the popup is
   **actually** `:popover-open` (with `isOpen` as the pre-`:popover-open`-engine fallback), and `hidePopover()`
   is `try`-guarded (it throws only when not showing). This fixed the commit→close path where `el.open` was
   false but the listbox stayed open.

4. **`selectionCommit` `preventDefault`s the committing Enter.** After a commit closes an overlay and restores
   focus to a `<button>` trigger, the *same* Enter keypress would natively re-activate that button →
   `handle.toggle()` → re-open. Suppressing the Enter default stops the re-open (`el.open` false but the panel
   visibly re-open — the exact `ui-select` commit-close failure).

**Adjacent (same pass):** the overlay controller adds a **0.25rem anchor↔panel gap** (root-font-size-scaled),
counted toward the flip collision so a panel flips to the opposite side when the preferred side can't fit the
panel **plus** its gap — viewport-collision-aware placement.

## Consequences

- The family dismissal contract is uniform: `toggle`/`close` fire **only** on platform-driven dismissal; the
  open transition and programmatic/commit closes do not emit (the renderer set them, so it already knows).
- **Known deferred MINOR:** the *informational* `close`/`open` events have a listener-registration-order race
  (a listener registered before connect can read a stale `el.open`). The load-bearing **bind** event
  (`toggle`) is settled/correct on every overlay. A future controller change (sync the bound prop via an
  `onDismiss` callback *before* emitting) would settle `close`/`open` family-wide; not a wave blocker.
- jsdom overlay dismiss-tests are, and should stay, `simulateLightDismiss`-based — a real Popover light-dismiss
  is a browser-only behaviour.
