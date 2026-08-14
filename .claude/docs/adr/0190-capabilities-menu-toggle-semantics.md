# ADR-0190 — Capabilities-menu toggle semantics: per-turn inclusion, never a roster write

> One paragraph: the composer's new capabilities menu (GH #891 ask 3, SPEC-R11/R12 of
> [capability-availability-tagging.spec.md](../spec/capability-availability-tagging.spec.md) §11)
> puts an enable/disable switch on every capability row — and the switch's MEANING is a genuine
> fork the intake itself left open: does a flip steer only the OUTGOING TURN (ephemeral,
> conversation-side), or does it WRITE the agent's persisted roster (`enabled`/availability — the
> entry rows' truth)? This ADR proposes the per-turn arm. · proposed
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-14 |
> | **Proposed by** | planner seat, GH #891 design dispatch (the intake's own open question: "does 'disable' remove the entry from the typeahead roster, or only exclude it from the outgoing turn?") |
> | **Ratified by** | — (Kim, on accept) |
> | **Repairs** | `SPEC-R12` (capability-availability-tagging.spec.md §11.4 — the gated requirement this ruling unblocks) |
> | **Supersedes / Superseded by** | — |

## Context

GH #891 adds a third composer menu beside the Models/Effort triggers: every included/available
skill, resource, and workflow listed with an enable/disable switch. The composer-side contract is
fork-independent and already specified (SPEC-R11: rows down as a default-off prop, one
`onCapabilityToggle(id, included)` callback up, the composer never writes any store under either
arm — the shipped SPEC-N1/§5 store-blind seam holds regardless). What the fork decides is the
CONSUMER's wiring in `ui-agent-admin`: the semantics a user learns.

The forces:

- **The shipped per-turn precedent.** The whole #849/#850 reference mechanism is ephemeral by
  ruled law: chips clear on send, and "no per-turn state persists: the next turn's `integrations`
  is the ambient projection again" (SPEC-R4). The composer is the turn-composition surface.
- **The persistent-write home already exists.** SPEC-R2 gave the entry ROW the availability
  control, with an at-a-glance marker, master-switch context, and the admin surface's full frame.
  A second persistent-write affordance in the chat composer is not a second source of truth (the
  store stays the one truth), but it IS a second, context-poor writer over agent identity — a flip
  made to answer one question silently reconfigures the agent for every later session.
- **Mechanics don't decide it.** Both arms are implementable with zero transport change (the
  prompt and `integrations` are computed per request, so a per-turn exclusion is host-side; a
  roster write rides the existing entry-store handler seam). Existing law constrains the composer
  (store-blind) but not the consumer — the model picker's own commits already persist through the
  consumer's store, so "composer menus never persist" is NOT a rule we have. Genuine alternatives,
  binding on later work: this is what earns the ADR (doc-standards §1c), unlike the arc's earlier
  tri-state fork which existing law resolved (the SPEC's §3 table).

## Decision

**Proposed:** the switch steers the OUTGOING COMPOSITION only — per-turn/ephemeral (SPEC-R12
arm A). `ui-agent-admin` derives the rows fresh per menu open (ambient entries `included: true`,
invocable entries `included: false` unless invoked this turn); a flip never touches the entry
store. An OFF on an ambient entry excludes it from that turn's projections host-side; an ON on an
invocable entry includes it exactly as a `/` commit does. Ephemeral state clears on send (the
chips' own symmetry); if session-stickiness ("mute this for the rest of this conversation") proves
wanted, it is an additive, still-never-stored widening of this same arm — its own later ruling,
inside this decision. The entry ROW (SPEC-R2) remains the ONLY persistent-write surface for
availability/enabled. SPEC-R12 is the owning requirement; slice S7 builds this arm on
ratification.

## Consequences

- The chat surface can never silently reconfigure the agent — a composer flip is scoped to what
  the user is looking at (this turn), and the admin surface keeps its single-writer clarity.
- The menu and the `@`/`/` typeahead CONVERGE on one mechanism: both express "what rides this
  turn", so a menu-ON of an invocable and a `/` commit are the same class of act (whether they
  share the reference/chip representation or an include list rides beside it is S7's build
  ruling, inside SPEC-R4's fail-closed constraints).
- New (small) mechanism accepted: per-turn ambient EXCLUSION — the first subtractive per-turn
  concept (references only ever added). Host-side only; the R4 AC4 empty-diff transport fence
  extends over it.
- Negative, owned honestly: a user who wants "turn this skill off for good" from the chat gets a
  one-turn effect and must go to the entry row — the menu's row can carry an affordance pointing
  there later, additively. And per-turn reset means repeated manual OFFs across a long
  conversation until/unless the session-sticky widening lands.
- If ratified the other way (arm B), SPEC-R12's arm-B text is the contract and this ADR flips
  `superseded` by the ruling that replaces it — the SPEC's S7 stays gated either way, so no build
  precedes the ruling.

## Alternatives considered

- **Arm B — persistent roster write (the switch mirrors and writes `enabled`/availability through
  the consumer)** — rejected because it makes the chat composer a context-poor admin remote:
  agent identity changes as a side effect of steering one turn, the learned UX is
  hard-to-walk-back (users trained on persistence can't be un-trained additively, while the
  per-turn arm can gain persistence affordances later), and it duplicates SPEC-R2's surface
  without its at-a-glance frame. Reversal asymmetry is the deciding weight, exactly as it was in
  the SPEC's §3 tri-state rejection.
- **Hybrid (per-turn switch + a secondary "always" affordance per row)** — rejected THIS ARC as
  scope: it presupposes the per-turn base anyway, so it is an additive later widening of arm A,
  not a third arm.
- **No menu — typeahead only** — rejected: GH #891's ask is explicit, and the typeahead cannot
  show at-a-glance state or express exclusion at all.
