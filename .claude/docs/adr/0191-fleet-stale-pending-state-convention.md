# ADR-0191 — a fleet-wide stale/pending visual state convention (GH #974, seed 1): ONE `:state(pending)` host custom state + ONE `--ui-pending-*` token pair, the TKT-0062 filled-state law's shape re-applied to async staleness, proposed BEFORE any component wires it

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-16
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-16 |
> | **Proposed by** | build-lead dispatch (GH [#974](https://github.com/kimgranlund/agent-ui/issues/974)'s own Acceptance requires this proposal BEFORE the styling hook ships — a contract-changing, TKT-0062-shaped decision, explicitly deferred from the trait build in the same issue) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-16, via the [`ratify ADR-0191` utterance](https://github.com/kimgranlund/agent-ui/pull/988#issuecomment-5310074014) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification (not authored here): `shared/src/tokens/dimensions.css` (mints `--ui-pending-opacity`/`--ui-pending-duration`) · `.claude/docs/references/interaction-states.md` (a new `§5 · Pending / stale content` section, alongside its existing `§1b` TKT-0062 section) · first consumer `controls/status-stream/status-stream.{ts,css}` (wires `pendingComputed` + `:state(pending)`, reconciling with its existing `:state(settled)`) · each wired control's own CSS pin-test |
> | **Supersedes / Superseded by** | **Relates** [TKT-0062](../tickets/tkt-0062-entry-control-filled-state-law.md) (the precedent this convention's SHAPE re-applies — one fleet-wide state law, not per-component hacks) · **Relates** [TKT-0047](../tickets/tkt-0047-interaction-state-design-gaps-from-fleet-audit.md) (the disabled-opacity-vs-repoint ruling this convention's own opacity choice is grounded in) · **Relates** ADR-0014 cl.2c (the state-law mechanism TKT-0062 itself superseded — same mechanism family, a disjoint state axis: validity/fill vs. async freshness) · **Extends** none (no prior async-state convention exists) · **Resolves** GH #974's ADR-proposal half (the trait itself ships in the same PR as this ADR; the styling hook does not) |

## Context

GH #974 (Kim's analysis of the [Solid 2.0 RC announcement](https://www.solidjs.com/blog/solid-2-0-rc-the-big-reveal))
asks for a `pendingComputed` trait so async-producing surfaces can keep rendering their LAST SETTLED
value while a new answer is in flight, instead of blanking to a spinner on every re-fetch. That trait
ships in the same PR as this ADR (`packages/agent-ui/components/src/traits/pending-computed.ts`) — it
is pure reactive plumbing (last-settled `value` + query-scoped `pending` + `error` signals) and touches
no DOM, no CSS, no component.

The issue's own Acceptance separately names a companion half: "ONE fleet-wide styling hook for the
stale/pending state — a token or state class, same shape as the TKT-0062 filled-state law (one
fleet-wide state convention, not per-component hacks)." That is exactly the shape of decision TKT-0062
made directly (Kim's own ruling, no ADR needed — a literal table handed down). This decision has no such
direct ruling behind it: it is a NEW visual-state axis nobody has specified yet, genuinely contract-
changing the moment a real consumer's CSS starts keying off it (a new entry in the fleet's closed
host-state/token vocabulary, and every future async-driven control inherits whichever shape is chosen
here). Per the operating contract, a fork needing a recommendation weighed — not a decision already
made — earns an ADR, not a silent per-component hack. GH #974's Acceptance makes that requirement
explicit: **the ADR must be proposed before the styling hook ships**, and the trait must ship without it
wired into anything. No consumer is being built in this dispatch — `ui-status-stream`, A2UI streaming
surfaces, and the agent Session seam are all named as a LIKELY follow-up slice, not required here (GH
#974's own Scope/Open).

**Fleet precedent check, done explicitly (not assumed):** this fleet already has a live, presentation-
only HOST-level boolean-state vocabulary — `:state(ready)` (button.ts, otp-field.ts, form-popover.ts —
the post-first-paint motion-gate pattern), `:state(dragging)`, `:state(truncated)`, `:state(revealed)`,
and — the direct semantic neighbour of "pending" — `ui-status-stream`'s own `:state(settled)`
(`status-stream.ts:578`, `this.internals.states?.add('settled')`, GH #722). None of these are
AX-reflected; every one is `ElementInternals`-backed presentation timing, exactly async pendingness'
own shape. The fleet's `data-*` attribute vocabulary (`data-fade-top`/`data-fade-bottom`,
`data-empty`), by contrast, is set on inner PARTS (a viewport, a trigger/editor span) — never the host
itself. This ADR's Decision follows the HOST-state precedent that actually exists, not the part-level
one.

## Decision

1. **One host custom state: `:state(pending)`.** Matches this fleet's own live precedent for
   presentation-only host booleans (`:state(ready)`/`:state(truncated)`/`:state(dragging)`/
   `:state(revealed)`/`:state(settled)`, Context above) rather than inventing a `data-*` exception at
   the host level, where no such precedent exists. Because `pendingComputed` is a CONTROLLER
   (`(host, opts) => …` returning signals, the `trackUserInvalid`/`valueCodec` shape) and a controller
   cannot reach the protected `host.internals` (the same split `trackUserInvalid` itself documents), the
   CONSUMING CONTROL applies the state — reading the controller's `pending` signal inside its own effect
   and calling `this.internals.states.add('pending')` / `.delete('pending')` — the exact
   `trackUserInvalid`/`userInvalid()` pattern, never a mechanism this trait or this ADR invents.
2. **One token pair, `--ui-pending-duration` + `--ui-pending-opacity`.** `--ui-pending-duration` ALIASES
   the fleet's existing `--md-sys-motion-duration-fast` (no new motion token — the `ui-drawer`/ADR-0188
   cl.5 precedent applied here too). `--ui-pending-opacity` is a genuinely NEW literal default (`0.6`) —
   no existing role covers it, and this ADR does not claim otherwise. The stale-content treatment is a
   DIMMING, not a recolor: content already rendered stays exactly where it is and keeps its existing
   ink/bg tokens (TKT-0062's law is untouched — filled/hover/focus/disabled continue to own bg/border/
   ink), and `:state(pending)` layers one additional `opacity` step on top, transitioned over
   `--ui-pending-duration`. Opacity, not a role-repoint, is the deliberate choice here — grounded in
   TKT-0047's own recorded exception (`calendar.css`/`color-picker.css`'s disabled rows), not a
   nonexistent "disabled uses opacity" convention (the fleet's DEFAULT disabled mechanism is in fact
   role-repoint, per TKT-0047/TKT-0062/`tokens.md` canon — Alternatives below states this correctly): a
   pending control's stale content can be ARBITRARY, unknown-depth author/control-rendered DOM (exactly
   the "collapse a multi-layer stacking context in one declaration" case TKT-0047 carved the opacity
   exception for), where a role-repoint would need to reach every nested ink/bg pair individually and
   cannot, in general, be expressed by this trait's consumer at all. `prefers-reduced-motion` suppresses
   the transition (instant opacity step), following every other fleet motion rule.
3. **Precedence: `disabled` > `pending` > every TKT-0062 fill/hover/focus state; `pending` composes
   under `settled` where both exist, never replaces it.** A disabled control showing stale content while
   a background refresh runs (a rare but real combination — e.g. a just-submitted form control disabled
   pending its own re-validation query) shows the disabled treatment, never a competing pending dim;
   short of disabled, pending's opacity step composes UNDER whichever TKT-0062 bg/border/ink state is
   active (a hovered-and-pending control keeps its hover border, dimmed) — additive, not a replacement
   axis, matching how `user-invalid` already composes on top of the TKT-0062 table today. On
   `ui-status-stream` specifically, `:state(settled)` (GH #722, "the stream has finished") and
   `:state(pending)` (this ADR, "a new answer to the CURRENT question is in flight") are NOT mutually
   exclusive labels for one axis — a settled stream can start a fresh query and go pending again without
   ever leaving `settled` until a NEW finalize/fail call — so the first real consumer's own CSS decides
   how the two compose visually; this ADR fixes only that both states can be true together, not the
   render when they are.
4. **No opinion on WHERE `pending` is read from.** A component's own `connected()` decides whether
   `pendingComputed`'s `pending` signal drives `:state(pending)` directly, or composes with other gates
   first (e.g. only dim after some minimum in-flight duration, to avoid flicker on a fast resolve) — this
   ADR fixes the STATE NAME and the TOKEN PAIR, not the composition logic, mirroring how TKT-0062 fixed
   the five-state table without dictating each component's own emptiness-detection wiring.
5. **Nothing ships wired to this ADR in the same PR.** The trait (`pendingComputed`) ships standalone;
   no `.css` file in this change references `:state(pending)` or `--ui-pending-*`, and no control's
   `connected()` calls `pendingComputed`. The first real consumer (most likely `ui-status-stream`, named
   in GH #974's Links) is its own future slice, built AFTER this ADR ratifies — not blocked on this PR.

## Consequences

- Every future async-driven surface has one fleet convention to reach for instead of re-deriving its own
  stale/dim treatment — the TKT-0062 outcome ("one fleet-wide state convention, not per-component
  hacks") repeated for a second state axis.
- `:state(pending)` joins the fleet's existing host custom-state vocabulary (`ready`/`truncated`/
  `dragging`/`revealed`/`settled`) — a future audit of that vocabulary now has one more member to
  account for, named here so it is a cited decision, not a drift discovered later.
- `ui-status-stream`'s eventual wiring must explicitly reconcile `:state(pending)` with its existing
  `:state(settled)` (Decision cl.3) — named here as a real open design question the first consumer's own
  build inherits, not resolved by this ADR.
- Until ratified, `pendingComputed` ships with ZERO visual consumers — a control needing pending-aware
  styling before ratification must wait, or (a narrower, ADR-less path) apply a component-local,
  non-`:state(pending)`-named treatment that this ADR's eventual ratification would then need to
  reconcile or deprecate; this ADR recommends waiting rather than pre-empting the convention it is
  itself proposing.
- The `0.6` default opacity and the disabled-over-pending precedence are this proposal's own judgment
  calls (unlike TKT-0062's literal Kim-specified table) — genuinely open to revision at ratification,
  which is the whole reason this lands as a proposed ADR rather than a merged styling hook.

## Alternatives considered

- **`[data-pending]`, a plain boolean attribute (the `data-fade-*`/`data-empty` shape), instead of
  `:state(pending)`** — rejected: those precedents are all set on inner PARTS (a scroll viewport, a
  trigger/editor span), never the host itself; the fleet's actual HOST-level boolean-state vocabulary is
  `:state()` (`ready`/`truncated`/`dragging`/`revealed`/`settled` — Context above, all presentation-only,
  none AX-reflected), so a `data-*` host attribute would be a NEW, ungrounded exception rather than a
  continuation of an existing pattern. `:state(pending)` also composes for free with `ui-status-stream`'s
  existing `:state(settled)` selector surface, which a host attribute would not.
- **A role-repoint (the disabled canon, TKT-0047/TKT-0062) instead of an opacity step** — rejected:
  stale content must keep its ALREADY-SETTLED ink/bg tokens untouched (repainting them would defeat the
  entire "keep showing the last answer" premise), and pending content can be arbitrary, unknown-depth
  DOM — a role-repoint can reach one ink/bg pair a component owns, not an arbitrary subtree a consumer
  or a control renders under it. TKT-0047's own carved exception (`calendar.css`/`color-picker.css`'s
  disabled rows: "opacity collapses a multi-layer stacking context … in one declaration where a token
  repoint would need a rule per pseudo-layer") is precisely this shape, generalized from "one control's multi-layer
  interior" to "any pending content, unknown depth" — the analogy this ADR's opacity choice rests on.
- **A CSS class (`.ui-pending`) instead of a custom state** — rejected: no fleet component uses
  author-facing or internal classes for state today (`@scope`-scoped `.css` files key off attributes/
  pseudo-classes/custom-states exclusively); a class would be the first exception and buys nothing
  `:state()` does not already provide, while losing the free composition with existing states like
  `:state(settled)`.
- **A full opacity+grayscale+blur "skeleton" treatment (nano-ui/Solid-RC's more elaborate stale
  presentations)** — rejected as the DEFAULT: a single opacity step is the minimal fleet-wide primitive
  that composes cleanly under every existing TKT-0062 state without a second CSS pass per component;
  a component wanting a richer stale treatment can still layer more onto `:state(pending)` locally
  without this ADR mandating the heavier default fleet-wide.
- **Folding this into TKT-0062's own five-state table (a sixth "pending" row)** — rejected: TKT-0062's
  table is CLOSED (a literal, already-shipped, Kim-specified ruling covering fill/hover/focus/disabled);
  reopening it to add an orthogonal async-freshness axis would conflate two independent state dimensions
  (entry-control fill state vs. any control's async staleness) into one table, the opposite of "one state
  law per axis" — a new, additive convention that COMPOSES with TKT-0062 (Decision cl.3) is the cleaner
  fork.
- **Shipping the styling hook in this same PR, deferring only the ADR's ratification** — rejected: this
  is exactly what GH #974's Acceptance forbids ("proposed as an ADR BEFORE the styling hook ships…this
  issue covers the trait + the ADR proposal, not a merged styling hook") — a merged hook ahead of
  ratification would be a self-ratified contract change in substance even if the ADR file's `Status` cell
  never flips (and `adr-status-guard.py` blocks that flip outright regardless).
