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
> | **Status** | accepted |
> | **Date** | 2026-08-14 |
> | **Proposed by** | planner seat, GH #891 design dispatch; rev.2 same day, revised to the owner's 2026-08-14 ruling (quoted verbatim in Context) — a proposed ADR's text is revisable before ratification |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-14, via the [`ratify ADR-0190` utterance](https://github.com/kimgranlund/agent-ui/issues/891#issuecomment-5295370816) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | `SPEC-R12` (capability-availability-tagging.spec.md §11.4 — the gated requirement this ruling unblocks, now ruled into §12's SPEC-R13; the disclosure constraint lands as SPEC-R14/R15) |
> | **Supersedes / Superseded by** | — |

## Context

GH #891 adds a third composer menu beside the Models/Effort triggers: every capability entry
listed with an enable/disable switch. The composer-side contract is fork-independent and already
specified (SPEC-R11: rows down as a default-off prop, one `onCapabilityToggle(id, included)`
callback up, the composer never writes any store under either arm — the store-blind seam of the
SPEC's §5 layering clause holds regardless). What the fork decides is the CONSUMER's wiring in
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

## Amendment (2026-08-16, **ratified** — kimgranlund, [utterance](https://github.com/kimgranlund/agent-ui/pull/1041#issuecomment-5315590364), verified 2026-08-17) — client-side capability auto-attach on an exact text match — GH [#1030](https://github.com/kimgranlund/agent-ui/issues/1030)

> Append-only, and **proposed**: the Status cell reads `accepted` for the record as a whole and stays
> byte-untouched — agents never flip status (`.claude/hooks/adr-status-guard.py`), and this amendment
> carries no ratification of its own until Kim gives one (`ratify ADR-0190 amendment`, executed by
> `scripts/adr_ratify.py`'s amendment mode, GH #664). Every accepted section above — Context, Decision,
> Consequences, Alternatives — is unedited. GH [#1030](https://github.com/kimgranlund/agent-ui/issues/1030)
> is the durable record: after "lets play texas hold'em", the dealer persona replied "tag @texas-holdem in
> your next message" — one turn after offering the game itself, because SPEC-R15's teaching (this ADR's own
> Decision, "only the user can, by tagging") told it a formal `@`/`/` tag was the only load path. Kim: "this
> should probably load it on demand." RULING: HYBRID (b) — client-side auto-attach, not (a) a real
> model-side pull tool.

**cl.A1 — what stands, what's added.** This amendment does NOT reverse the three-tier reach model
(§"Decision" above): `enabled` × `availability` still governs what is reachable at all, and the switch
this ADR rules is untouched. What's added is a FOURTH way an already-reachable `context`-or-`invocable`
entry's full content can reach the model on a given turn, alongside the shipped express `@`/`/` tag
(SPEC-R4/R8, unchanged): when the USER's own typed text names the entry's `label` EXACTLY (case-
insensitive, whitespace/punctuation-normalized — `"texas hold'em"` ↔ `texas-holdem` / `Texas Hold'em`,
all three tokenize identically), the client resolves it through the SAME `resolveTurnReferences` path a
committed chip resolves through, before the turn sends — indistinguishable, downstream, from an explicit
chip. One per turn maximum (first exact hit in text order; a second is silently dropped — "keep it
simple"); never a disabled entry or a master-off kind's entry (the roster fed to the matcher is already
the reachable set); no fuzzy or description matching (label only — the false-positive risk the ruling
explicitly declined). The resolved entry surfaces as the SAME dismiss-less reference tag SPEC-R10 already
renders on the sent bubble — reusing the existing chip rendering, never a new visual.

**cl.A2 — the teaching block, re-taught.** `CAPABILITY_INDEX_TEACHING` (GH #891/SPEC-R15, this ADR's own
Decision naming it "only the user can, by tagging it") no longer claims tagging is the ONLY load path: the
model is now told that the user's own message naming an item exactly loads it too, tagging remains a
working fallback, and the model itself still cannot load anything — the instruction to ASK the user by
name (tag or name it) stands for anything not yet named. Full requirement text: `capability-availability-
tagging.spec.md` §13 (SPEC-R16 + the SPEC-R15 wording amendment, v0.6).

**cl.A3 — why an amendment to THIS ADR, not a new one or a supersession.** The GLOBAL enable/disable
Decision (§"Decision" above) stands untouched — nothing here reverses it, widens the switch's meaning, or
opens a second store-write seam. What changes is downstream of that Decision: an already-`enabled`,
already-reachable entry gaining a SECOND way to resolve into a turn (client-side, no model tool loop, no
new wire shape) is squarely the kind of foreseen follow-through `doc-standards`' amendment-vs-supersession
test names — the original Decision still stands, so this is an amendment, not a new file.

**cl.A4 — design (a) stays named, not built.** A real model-side pull (`load_capability(label)`, resolved
client-side against the store and framed into the turn like SPEC-R4's express invocation) remains
ADR-0132's own named future — the actual fix, gated on the tool-execution loop ADR-0132 explicitly defers
(parameter schemas first, SPEC-N3). This amendment does not touch that boundary; it is the poor-man's
UX repair on TOP of the poor-man's context-window bridge §12 already shipped.

## Alternatives considered (the amendment's own fork)

- **(a) Real model-side pull — a `load_capability(label)` tool call** — the architecturally-named future
  (ADR-0132), rejected FOR THIS BUILD on cost: it needs a real tool-execution loop (touching
  `dev-proxy-plugin.ts`), which ADR-0132 already defers behind parameter schemas. Cited, not built.
- **Fuzzy / description matching** — rejected: matching against a description (free, user-authored prose)
  or a partial/similar label risks attaching the wrong entry on an incidental mention — the false-positive
  cost the ruling weighed against (b)'s cheapness and declined to accept.
- **More than one auto-attach per turn** — rejected as unneeded complexity ("keep it simple", the ruling's
  own words) — a second exact hit is dropped silently rather than resolved or surfaced as an error.
