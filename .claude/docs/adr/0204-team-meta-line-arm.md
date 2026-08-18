# ADR-0204 — `team` becomes the meta-line envelope's FIFTH additive model-authored arm (GH #1196): the Builder's team-shaped generation path declares a name-only proposed roster (`label`/`tagline?`/`members: {name, role, routingDescription}[]`), whole-arm-validated the `plan`/`personaPatch` way, peeled gate-blind through `produce()`, consumed only by `ui-agent-admin`'s `onTeamDeclared` seam

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each
> ADR's own header). · 2026-08-17
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-17 |
> | **Proposed by** | planner seat, from the merged implementation (GH #1196, PR #1242) — the build
>   lane flagged explicitly that the `team` meta-line arm shipped without its own decision record,
>   unlike every one of its four sibling arms |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-18, via the [`ratify ADR-0204` utterance](https://github.com/kimgranlund/agent-ui/issues/1196#issuecomment-5329176020) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | none — this is a RECORDING ADR: the arm, its validation, and its consumer seam are
>   already merged (PR #1242) exactly as this record describes; nothing here is gated on ratification
>   except the record's own Status cell. Future callers citing the `team` arm's provenance cite this
>   ADR going forward. |
> | **Supersedes / Superseded by** | **Extends** [ADR-0088](./0088-a2ui-live-conversational-channel.md)
>   (the `a2uiMeta` envelope gains a fifth additive field; nothing existing is touched) ·
>   **Extends** [ADR-0097](./0097-a2ui-feed-embedded-asks.md) / [ADR-0174](./0174-planner-stage-pilot-sequential-opt-in-loop.md) /
>   [ADR-0178](./0178-agent-authoring-conversational-persona-hydration.md) / [ADR-0198](./0198-ask-flow-completion-flowend-meta-signal.md)
>   (the `ask → plan → personaPatch → flowEnd → team` arm lineage — `team` is the fifth and, for the
>   whole-arm/malformed-drops-everything validation posture specifically, the `plan`/`personaPatch`
>   precedent applied point-for-point) · **Realizes** [ADR-0203](./0203-agentteam-declaration-first-record.md)
>   clause 4 (the Builder one-shot requirement this wire arm exists to carry) · Relates
>   [`req-agent-teams.md`](../research/req-agent-teams.md) R4 (Builder team-shaped interview output) |

## Context

[ADR-0203](./0203-agentteam-declaration-first-record.md) clause 4 requires the Builder interview to
one-shot N member-agent seeds plus one `AgentTeam` record from a single conversation. GH #1196 built
the wire mechanism this requires — the meta-line's fifth additive model-authored arm — and PR #1242
merged it (`packages/agent-ui/a2ui/src/agent/meta-line.ts`'s `team` field + guard,
`produce.ts`'s pass-through, and `ui-agent-admin`'s `onTeamDeclared` consumer seam). Every one of the
arm's four predecessors (`ask` — ADR-0097, `plan` — ADR-0174, `personaPatch` — ADR-0178, `flowEnd` —
ADR-0198) earned its own decision record naming the wire shape, the validation posture, and the
consumer boundary before or alongside landing. `team` shipped without one — the build lane's own
handoff flagged the gap explicitly, naming this record as the fix. This ADR is written AFTER the
merge, recording the decision the build already embodies (a documentation debt repair, not a design
proposal awaiting a build) — its Repairs cell states this plainly and its Status stays `proposed`
only because status flips are Kim's alone (ADR-0149), never because any build work remains gated.

**Why a fifth arm, not an extension of `personaPatch`.** `personaPatch` already carries model-proposed
mutations onto ONE existing store (persona field values, capability-entry deltas). A team declaration
proposes something categorically different: N-to-be-MINTED personas that do not yet exist, plus a
team record naming them — not a patch onto an existing thing, but a request to CREATE several new
things plus their grouping. Overloading `personaPatch.entries` to carry "mint N personas" would smuggle
a creation request through a mutation-shaped field; `team` rides its own field for the same reason
`flowEnd` didn't ride inside `plan` — a structurally different proposal earns its own name.

**Why name-only member seeds, not rich per-member authoring.** The wire arm's `TeamMemberSeed` carries
exactly three fields — `name`, `role`, `routingDescription` — matching `AgentTeamMember`'s own two
declared-prose fields (`role`, `routingDescription`) plus a display `name` used only to seed the minted
persona's label. It deliberately does NOT carry a member's system prompt, model choice, temperature,
skills, or any other `AgentConfigSnapshot` field. Richly authoring one agent's full configuration is
already the existing, proven single-agent Builder interview flow (ADR-0097's clickable-options +
live-draft-fill discipline) — reachable for any minted member AFTER the team lands. Carrying that same
richness N-at-once through one meta-line would either (a) demand the model author N full configs in a
single turn, degrading interview quality for every member simultaneously, or (b) require a bespoke
per-member sub-interview protocol this ADR's own scope does not need — R4's acceptance asks only for
"≥2 member agents + 1 GM + 1 team record," each member's routing description non-empty, which the
three-field shape satisfies exactly. A member's own settings stay the existing flow's job.

## Decision

**`team?: TeamDeclaration` joins the meta-line envelope as the fifth additive MODEL-authored field,
alongside `ask`/`plan`/`personaPatch`/`flowEnd`, whole-arm-validated the `plan`/`personaPatch` way, and
consumed ONLY through `ui-agent-admin`'s registered `onTeamDeclared` callback.** Realized in five
clauses, matching the merged implementation exactly.

1. **The wire shape.**
   ```ts
   interface TeamMemberSeed { name: string; role: string; routingDescription: string }
   interface TeamDeclaration { label: string; tagline?: string; members: TeamMemberSeed[] }
   ```
   `label`/`tagline` seed `AgentTeam`'s own fields 1:1; each `TeamMemberSeed` seeds one
   `AgentTeamMember` 1:1 on `role`/`routingDescription` (`agentId` is filled in by the host at mint
   time — the wire never carries an id that does not exist yet, since the member doesn't exist yet).
   The field lives on the SAME leading meta-line as `note`/`ask`/`plan`/`personaPatch`/`flowEnd`
   (`packages/agent-ui/a2ui/src/agent/meta-line.ts`).
2. **Whole-arm validation, the `plan`/`personaPatch` posture exactly.** `team` is shallow-validated
   the same per-field-independent way every arm is (a malformed `team` drops only `team`, never the
   whole envelope — `note`/`ask`/`plan`/`personaPatch`/`flowEnd`/`trace`/`progress`/`error` on the
   same line still parse normally), but the ARM ITSELF validates as a whole: a non-object arm, a
   missing/non-string `label`, a present-but-non-string `tagline`, a missing/non-array `members`, or
   ANY member missing a string `name`/`role`/`routingDescription` drops the ENTIRE arm — never a
   partial roster. This is the identical law `plan` (a malformed step drops the whole `plan`) and
   `personaPatch` (a malformed member drops the whole patch) already apply, chosen for the identical
   reason named in the arm's own file-header comment: a half-parsed roster is the one shape a host
   mint loop must never be handed.
3. **Gate-blind pass-through in `produce()`.** `packages/agent-ui/a2ui/src/agent/produce.ts` peels
   `team` on the SAME terms as `plan`/`personaPatch` — no integrity check, no re-validation, passed
   through unchanged in both the peel path and `formatMetaLine`'s writer. `produce()` performs no
   semantic check on a declared team's contents (it does not verify the roster is sensible, that
   member count is reasonable, or anything else) — it is a pure wire carrier, exactly as it is for
   every prior arm. Whether a declared team is ever CONSUMED is entirely the host's call.
4. **The sole consumer: `ui-agent-admin`'s `onTeamDeclared` seam.** `agent-admin.ts` exposes
   `onTeamDeclared(callback: (team: TeamDeclaration) => void): void`, registered by the host page
   (`site/pages/agent-admin-app.ts`'s `handleTeamDeclared`). Unregistered ⇒ a declared team is
   silently dropped — the SAME degrade law `personaPatch`'s own unregistered path already follows
   (SPEC-R30's degrade posture): a `team` arm arriving with no listener produces no error, no partial
   mint, no UI change. The consumer performs its OWN structural pre-check (non-empty label, non-empty
   member array, every member's three fields non-empty — catching what the wire guard's TYPE-only
   check cannot) before minting a single persona, then validates the assembled `AgentTeam` through
   [ADR-0203](./0203-agentteam-declaration-first-record.md) clause 1's closed validator
   (`validateAgentTeam`) before persisting — nothing lands, notified as a failure, never a partial
   roster, matching this arm's own whole-or-nothing law one layer up.
5. **The GM is host-designated, never model-declared.** The wire arm carries no GM field — the
   consumer designates the CURRENTLY ACTIVE persona (the one already being authored when the
   team-shaped ask was recognized) as the GM, per `handleTeamDeclared`'s own documented behavior. This
   keeps the wire arm's surface minimal (member seeds + team identity only) and matches the natural
   authoring flow: a user builds one agent, asks the Builder to give it a team, and that agent becomes
   the GM of the roster it requested.

## Non-goals

- **No rich per-member authoring on the wire.** A member's system prompt, model, temperature, or
  capability entries are never carried by `TeamMemberSeed` — reachable only through the existing
  single-agent Builder flow after the team lands (Context, above).
- **No routing/dispatch semantics on the wire.** `routingDescription` is declared prose only; nothing
  in `meta-line.ts`, `produce.ts`, or the consumer seam reads it to actually select a member or
  execute a handoff — [ADR-0203](./0203-agentteam-declaration-first-record.md) clause 2's
  `composeTeamPromptSection` (GH #1194) is the composition step that reads it into a prompt; no
  runtime dispatch exists anywhere in this arc (IDR-0001's fence, restated).
- **No GM field on the wire** — clause 5's host-side designation is deliberate, not an oversight to
  fill in later.
- **No new event name, no new validator surface on the A2UI protocol wire.** Exactly like every prior
  arm, `team` rides the meta-line framing convention only — provably NOT an `A2uiServerMessage` (no
  `version` key), peeled before the validator, never entering the corpus path (SPEC-N3 wire purity,
  restated for the fifth time).
- **No re-validation inside `produce()`.** Clause 3's gate-blindness is deliberate symmetry with
  `plan`/`personaPatch`, not a gap this ADR asks to be closed.

## Consequences

- **The meta-line's reserved MODEL-authored vocabulary grows to five**
  (`ask · plan · personaPatch · flowEnd · team`) — named here so the next envelope audit finds a cited
  decision for all five, matching the bookkeeping role ADR-0198's Consequences already performed for
  the fourth.
- **A malformed `team` degrades gracefully** — at worst, no team is minted for that turn and the
  model's prose note (if any) still ships; no other arm on the same line is affected.
- **The Builder's team-shaped path is fully additive** — `createGeneratedAgent`'s existing
  single-agent flow is byte-unaffected; nothing in `handleTeamDeclared` runs unless the model actually
  declares a `team`.
- **This ADR closes a documentation-debt gap, not a design question** — no Repairs are gated on its
  ratification because the arm, its guard, and its consumer are already shipped and tested
  (`meta-line.ts`, `produce.ts`, `agent-admin.ts`, `agent-admin-app.ts` + their respective test files).
  Future citations of the `team` arm's provenance should reference this ADR going forward, the same
  way `flowEnd` citations reference ADR-0198.

## Acceptance

This is a **recording** ADR, not an intake/build-wave pair: the arm, its validation, and its consumer
seam are already merged. Acceptance is the record itself passing the ADR gates
(`site/lib/adr.test.ts` grammar, `docs-grammar.test.ts` link sweep) and being indexed in the README;
no code change accompanies this record.

## Alternatives considered

- **Overload `personaPatch` to carry a "mint N personas" instruction.** Rejected (Context): a
  creation request is categorically different from a patch onto an existing store; smuggling it
  through `personaPatch.entries` would give that field two incompatible meanings depending on payload
  shape, the exact ambiguity every prior arm's own separate-field precedent (most recently `flowEnd`
  vs. `ask`) was designed to avoid.
- **Carry a member's full `AgentConfigSnapshot` per seed.** Rejected (Context): degrades single-agent
  interview quality by demanding N full configs at once, or requires an unneeded bespoke per-member
  sub-interview protocol; R4's acceptance criteria are satisfied by the three-field shape without
  either cost.
- **A model-declared GM field.** Rejected (clause 5): the natural authoring flow already designates
  the active persona as GM; a wire field would be redundant with, and could contradict, the host's own
  contextual knowledge of which persona initiated the team-shaped ask.
- **Skip this ADR entirely (treat the merged PR as sufficient documentation).** Rejected: the build
  lane explicitly flagged the gap, and every sibling arm (`ask`/`plan`/`personaPatch`/`flowEnd`) has
  its own citable record; leaving `team` as the one undocumented arm would break the citation
  precedent this repo already leans on when auditing the envelope's reserved vocabulary.
