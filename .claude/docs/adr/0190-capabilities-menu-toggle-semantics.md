# ADR-0190 — Capabilities-menu toggle semantics: a GLOBAL enable/disable over the three-tier reach model

> One paragraph: the composer's new capabilities menu (GH #891 ask 3, SPEC-R11/R12 of
> [capability-availability-tagging.spec.md](../spec/capability-availability-tagging.spec.md) §11)
> puts an enable/disable switch on every capability row — and the switch's MEANING was a genuine
> fork the intake itself left open: does a flip steer only the OUTGOING TURN (ephemeral,
> conversation-side), or does it WRITE the agent's persisted roster (`enabled` — the entry rows'
> truth)? **Rev.2 (same day):** the owner RULED the persistent arm — the switch is a global
> enable/disable over the roster's existing `enabled` axis, with the three-tier reach model made
> explicit (ever-present · invocable-only · off) — overriding rev.1's per-turn recommendation,
> which moves to Alternatives as the graded rejected arm. The ruling's second half (index-line
> progressive disclosure, the context-window constraint) lands as the SPEC's §12. Still `proposed`:
> Kim ratifies THIS revised text. · proposed
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-14 |
> | **Proposed by** | planner seat, GH #891 design dispatch; rev.2 same day, revised to the owner's 2026-08-14 ruling (quoted verbatim in Context) — a proposed ADR's text is revisable before ratification |
> | **Ratified by** | — (Kim, on accepting the REVISED text) |
> | **Repairs** | `SPEC-R12` (capability-availability-tagging.spec.md §11.4 — the gated requirement this ruling unblocks, now ruled into §12's SPEC-R13; the disclosure constraint lands as SPEC-R14/R15) |
> | **Supersedes / Superseded by** | — |

## Context

GH #891 adds a third composer menu beside the Models/Effort triggers: every capability entry
listed with an enable/disable switch. The composer-side contract is fork-independent and already
specified (SPEC-R11: rows down as a default-off prop, one `onCapabilityToggle(id, included)`
callback up, the composer never writes any store under either arm — the shipped SPEC-N1/§5
store-blind seam holds regardless). What the fork decides is the CONSUMER's wiring in
`ui-agent-admin`: the semantics a user learns.

Rev.1 of this ADR proposed the per-turn/ephemeral arm (arm A), weighing the shipped #849/#850
per-turn precedent (chips clear on send, SPEC-R4's "no per-turn state persists") and the
reversal asymmetry against a second, context-poor writer over agent identity. The owner ruled the
other way, and widened the scope — Kim, 2026-08-14, verbatim:

> re ADR-0190: the capability switches are a global enable/disable. some items are ever present,
> and if a skill or tool is set to 'invocable' then it is only included once user expressly
> invoces/tags/triggers it.
>
> I assume we are not able to leverage front-matter context techniques here, so need a poor-mans
> solution that does not completely blow our context window.

That utterance carries two decisions. The first is this ADR's fork, ruled: the switch drives the
GLOBAL `enabled` axis, and the reach model the user learns is three explicit tiers. The second is
a new constraint — the composed prompt has no dynamic frontmatter-style loading (confirmed at
HEAD: `composeLiveSystemPrompt` composes the WHOLE live system prompt client-side per turn, and
the surface arm appends it whole through `buildSystemPrompt`'s ADR-0138 persona seam — there is
no model-side pull path), so "ever present" must not mean "full content ambient forever". That
half is contract-shaped, not fork-shaped: it lands as the SPEC's §12 requirement group
(SPEC-R14/R15 — index-line ambient disclosure + the teaching block), with the byte survey that
sizes it recorded there.

## Decision

**Ruled (the owner's arm — SPEC-R12 arm B, refined):** the capabilities-menu switch drives the
GLOBAL enabled/disabled axis — the roster's existing per-entry `enabled` state, a persistent
store write made by the CONSUMER (`ui-agent-admin`) in its `onCapabilityToggle` handler, through
the same store truth SPEC-R2's entry-row toggle writes. The composer stays store-blind (SPEC-R11,
unchanged). The reach model is three explicit tiers, two axes never collapsed
(`enabled` × `availability`, SPEC-R1's orthogonality preserved):

1. **enabled + `context` — "ever present":** contributes ambiently on every turn (from SPEC-R14
   as a compact index line, never full content), and remains invocable from the typeahead for a
   full-content load.
2. **enabled + `invocable` — invoke-only:** zero ambient bytes; included ONLY on the user's
   express invocation/tag (the shipped #850/SPEC-R3/R4 semantics — byte-unchanged by this ruling).
3. **disabled — off everywhere:** no ambient bytes, absent from the typeahead rosters, never
   resolves at send. The menu still LISTS it (switch off) — a global off-switch you cannot flip
   back on is not a switch.

The menu's rows therefore derive fresh per open from the store: the four capability kinds,
master-on kinds only, BOTH availability modes AND both enabled states, `included` mirroring
`enabled`. A flip on an invocable entry never invokes it — it enables/disables it; express
per-turn inclusion stays the typeahead's job (`@`/`/`, SPEC-R5–R8, untouched). SPEC-R13 (§12) is
the owning requirement; slice S7 builds this arm on ratification of this revised text.

## Consequences

- ONE mental model, two surfaces: the menu switch and the entry row's toggle are the same fact
  (`enabled`), read from and written to the one store truth — never a second source of truth, and
  no per-turn exclusion mechanism exists anywhere (rev.1's "first subtractive per-turn concept"
  is dead unbuilt; the R4 AC4 empty-diff transport fence stands as-is).
- The chat surface CAN now reconfigure the agent persistently — the risk rev.1 weighed is
  accepted deliberately by the owner's ruling, and mitigated by identity of semantics: the switch
  does exactly what the admin row does, so there is no second semantics to mislearn. The at-a-glance
  admin frame (SPEC-R2's marker, master-switch context) remains the richer surface.
- Clean division of labor: the MENU owns global availability (persistent), the TYPEAHEAD owns
  this-turn inclusion (ephemeral, chips clear on send). A menu-ON of an invocable entry does NOT
  converge with a `/` commit — rev.1's convergence consequence is void.
- The ruling's window-protection half becomes SPEC-R14/R15 (§12): ever-present entries contribute
  an index line (label + description), full content rides only the express-invocation framing
  path (SPEC-R4, shipped), prompt-sections stay full always. Measured on the shipped library
  packs: full-content ambient capability prose is ~10–16 KB per realistic agent and the index
  treatment cuts it 77–80% (the survey table lives in §12).
- Session-sticky per-turn muting (rev.1's named widening) is moot — a persistent switch already
  covers "stop including this", at the cost that re-enabling is also global. A user who wants
  one-turn-only steering of an ambient entry has no affordance this arc; if real use demands it,
  that is a NEW fork over this decision, filed on its own evidence.
- SPEC-R12's arm-A text stays in §11.4 as the ship record of the fork, annotated ruled; S7 builds
  against SPEC-R13.

## Alternatives considered

- **Arm A — per-turn/ephemeral steering (rev.1's own recommendation)** — rejected by the owner's
  ruling. Its weights were real (the chips' clear-on-send symmetry; a composer flip scoped to
  what the user is looking at; reversal asymmetry — persistence can't be un-trained additively)
  but the ruled model outweighs them with coherence: one axis, one truth, no new per-turn
  exclusion mechanism, and no repeated manual OFFs across a long conversation (arm A's owned
  negative). The context-poor-writer objection is answered by semantic identity with the entry
  row rather than by scoping the writer.
- **Hybrid (per-turn switch + a secondary "always" affordance per row)** — still rejected: it
  presupposes the per-turn base the ruling removed; under the ruled model its residue is the
  typeahead (per-turn) + the switch (global), which the shipped surfaces already are.
- **No menu — typeahead only** — still rejected: GH #891's ask is explicit, and the typeahead
  cannot show at-a-glance state or express disablement at all.
- **Global switch WITH full-content ambient composition (the ruling without §12)** — rejected by
  the ruling's own second half: with no dynamic loading, every ever-present entry's full content
  rides every request's system prompt forever (measured ~10–16 KB on realistic agents, unbounded
  in entry count and content size). The index-line disclosure is the poor-man's ceiling.
