# ADR-0199 — a fleet-wide working/alive state for surfaces mid-mutation (GH #1104): ONE `:state(working)` host custom state + a breathing diffused inner-shadow treatment on `--ui-working-*` tokens, DISTINCT from ADR-0191's `pending` (pending = THIS content is stale; working = this surface is live and being updated in place), precedence-slotted `disabled > pending > working > answered > …` (proposed)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-17
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-17 |
> | **Proposed by** | dispatched design lane for GH [#1104](https://github.com/kimgranlund/agent-ui/issues/1104) — the issue's own Scope names the fork ("does ADR-0191's `pending` cover this, extend to it, or is a distinct `working` fleet state warranted?") as ADR territory per the ADR-0191/0196 precedent chain, to be ratified before build |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-17, via the [`ratify ADR-0199` utterance](https://github.com/kimgranlund/agent-ui/issues/1101#issuecomment-5317478205) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build (not authored here): `shared/src/tokens/dimensions.css` (mints the `--ui-working-*` constants) · `.claude/docs/references/interaction-states.md` (a new `§7 · Working / live surface mutation` section alongside §5 pending and §6 answered) · `app/src/controls/surface-host/surface-host.{ts,css}` (the `working` prop + `:state(working)` breathing rule + CSS pin-test) · `app/src/controls/conversation/conversation.ts` (the turn-handle set/clear wiring) · the second/third consumers only if they earn it (`ui-sandbox-frame` genui in-place rebuilds; `ui-status-stream` already has its own live-narration face and needs nothing) |
> | **Supersedes / Superseded by** | **Relates** [ADR-0191](./0191-fleet-stale-pending-state-convention.md) (the adjacent async-freshness axis this ADR deliberately does NOT extend — Decision cl.1's semantic fence) · **Relates** [ADR-0196](./0196-answered-state-law-questionnaire-settle-edit-amend.md) (the state-family SHAPE re-applied a fourth time, and the precedence chain this ADR slots into) · **Relates** [TKT-0047](../tickets/tkt-0047-interaction-state-design-gaps-from-fleet-audit.md)/[TKT-0062](../tickets/tkt-0062-entry-control-filled-state-law.md) (the role-repoint/opacity canons, both left untouched — this state adds a THIRD channel, a shadow overlay) · **Relates** ADR-0146 F8 (the narration strip's "working from t=0" law — the header-level face this ADR gives a card-level body) · **Resolves** GH #1104's design-fork half (the builds are follow-up slices) |

## Context

Kim's live report (GH #1104, agent-admin test chat): when an agent turn UPDATES an existing A2UI card
in place — no new bubble; the Texas Hold'em card cycling pre-flop → flop while the narration strip
reads "Writing the response…" — the card itself gives ZERO indication it is alive. The narration strip
(ADR-0146 F8) is the turn's header-level face, but it sits outside the bubble; the card being mutated
is visually indistinguishable from a finished one until pixels happen to change. Kim's design seed:
"some kind of CSS effect, maybe with large diffused inner-shadow that cycles a breathing look?"

**The central fork, decided here.** Three candidate mechanisms were on the table:

- **(a) extend `:state(pending)` (ADR-0191)** — the card is "awaiting the turn's completion", which is
  pending-shaped if you squint.
- **(b) mint a distinct `working` fleet state** — pending and working are opposite messages.
- **(c) no new state — a surface-host-local `data-*` treatment** — cheapest, not fleet law.

**(a) is rejected on ratified semantics, not taste.** ADR-0191's `pending` says, verbatim, "the
currently-displayed content is a STALE last-settled answer while a new one is in flight", and its
mechanism is a 0.6 opacity DIM of that stale content. The GH #1104 card is the exact inverse: the
displayed content is FRESH — the surface is the live target receiving in-place `updateComponents`/
`updateDataModel` mutations, and each frame shows the current truth (the flop IS the current board).
Dimming a live, current card would assert "what you see is out of date" — a false statement — and
would fight the very treatment the eye needs (a dim reads as de-emphasis; "alive" needs emphasis).
Stretching `pending` to also mean "live and mutating" would make one selector token mean two opposite
things — precisely the drift ADR-0196 cl.1 refused when it declined to reuse `settled`.

**(c) is rejected on the fleet's own precedent discipline.** ADR-0191's fleet-precedent check ruled
that host-level boolean visual states are `:state()` vocabulary members, never host `data-*`
attributes (the `data-*` vocabulary lives on inner PARTS), and both ADR-0191 and ADR-0196 record that
a new vocabulary member is ADR territory so the next audit finds a cited decision, not drift. The
semantic ("this surface is being mutated by an in-flight producer turn") is also not surface-host-
private: `ui-sandbox-frame` genui surfaces get the same in-place rebuild (SPEC-R5's replace
lifecycle), and any future streamed-mutation surface inherits the same question — a local
`data-working` would be re-derived by the second consumer, the per-component-hack failure TKT-0062
and ADR-0191 exist to prevent.

**(b) wins.** The semantic difference is load-bearing: **`pending` = THIS content is stale (dim it);
`working` = this surface is live and mid-mutation (make it breathe)**. Two axes, two channels, both
composable — a surface can even be both at once (stale sub-content dimmed while the surrounding
surface breathes) with zero selector conflict.

**Fleet precedent check (the ADR-0191 discipline re-run):** the live host custom-state vocabulary is
`:state(ready)` / `:state(dragging)` / `:state(truncated)` / `:state(revealed)` / `:state(settled)`
(ui-status-stream) / `:state(pending)` (ADR-0191) / `:state(answered)` (ADR-0196) — all
`ElementInternals`-backed, presentation-only, none AX-reflected. `working` joins as the eighth member.

## Decision

1. **One host custom state: `:state(working)`.** Not `busy` (`aria-busy` exists as a platform AX
   semantic; this state is deliberately presentation-only like every other vocabulary member, and
   overloading the platform word invites accidental AX claims), not `live` (collides with ARIA live
   regions), not `active` (a CSS pseudo-class). Mechanically the exact ADR-0196 cl.1 pattern: the
   CONSUMING SURFACE sets a public boolean prop (`working`, in the host's `static props`); the
   control's own `connected()` effect mirrors it into `this.internals.states?.add('working')` /
   `.delete('working')`. Presentation-only, never AX-reflected — the turn's AX story stays with the
   narration strip (ADR-0146), which already announces progress; this state is its card-level visual
   body, not a second announcement channel.
2. **First consumer + wiring locus: `ui-surface-host`, driven by `ui-conversation`'s turn handle.**
   `conversation.ts` already owns the exact lifecycle window (`beginAgentTurn` → the single guarded
   `endTurn` that both `finalize()` and `fail()` funnel through, TKT-0034) and already tracks which
   surface hosts a turn touches (`touchedIds`/`SurfaceRecord`). The wiring: when a turn routes a line
   to a surface host (fresh OR known — an in-place update to a known id is the motivating case), set
   that host's `working` prop; at `endTurn`, clear it on every host this turn touched. `fail()` clears
   identically (a dead turn must never leave a card breathing forever — the honesty guard's visual
   twin). A host app driving `ui-surface-host` directly may set the prop itself; the fleet law fixes
   the state name, tokens, and treatment — not who flips it (the ADR-0191 cl.4 restraint).
3. **The visual treatment: a breathing diffused INNER shadow, on its own channel.** Kim's seed,
   adopted and argued against the motion laws:
   - The working rule paints an overlay pseudo-element (`::after` on the surface part: `position:
     absolute; inset: 0; pointer-events: none; border-radius: inherit`) carrying
     `box-shadow: inset 0 0 var(--ui-surface-host-working-blur) var(--ui-surface-host-working-color)`,
     and ANIMATES the pseudo-element's `opacity` between the two `--ui-working-opacity-{min,max}`
     rungs via one `@keyframes` breathe cycle (`alternate`, `infinite`,
     `var(--ui-surface-host-working-duration)` per half-cycle, `--md-sys-motion-easing-standard`).
     Animating overlay OPACITY — not the `box-shadow` value itself — keeps the loop compositor-only,
     the same exemption logic ADR-0095's sliding indicator rides (no reflow, no paint storm), and
     keeps §4[a]'s law intact: no geometry is transitioned, the sizing ramp never animates, content
     underneath is untouched (no dim, no recolor — TKT-0062's channels stay closed).
   - An inner shadow (not an outline/border pulse) because the treatment must read on a `[bare]`
     chromeless mount (GH #241 — the chat path strips background/padding; an outer glow would bleed
     into bubble chrome and neighbouring turns, while an inset vignette stays inside the card's own
     box) and must not perturb the geometry law (a shadow is paint, never layout).
   - **`prefers-reduced-motion: reduce` ⇒ STATIC, never NOTHING**: `animation: none` and the overlay
     held at `var(--ui-working-opacity-max)` — a constant visible inner vignette. The state stays
     legible motionless; removing the indicator entirely would make reduced-motion users the only
     ones who can't tell a live card from a dead one (§4[c] extended, not just obeyed).
4. **Tokens, minted in `dimensions.css` as :root constants + one color alias in `tokens.css`:**
   - `--ui-working-duration: 1600ms` — a genuinely NEW motion literal, and deliberately NOT an alias
     of `--md-sys-motion-duration-fast` (300ms): that token is a state-TRANSITION duration; a
     breathing half-cycle at 300ms is a strobe, not a breath. This is the first fleet LOOP duration;
     ~1.6s/half-cycle (≈3.2s full breath, ≈0.3Hz) sits in the calm-ambient band and well below any
     flash-frequency concern.
   - `--ui-working-opacity-min: 0.15` / `--ui-working-opacity-max: 0.55` — the breath's two rungs
     (new literals; no existing role covers an overlay-strength pair).
   - `--ui-working-blur: 24px` — the "large diffused" spread (a paint constant, like the focus-ring
     width; no `[scale]` ramp participation — it never animates, only the overlay's opacity does).
   - `--ui-working-color: var(--md-sys-color-primary)` — a PURE ALIAS in `tokens.css`, zero new color
     literals: the alive signal is accent-family by intent (activity, not neutrality); rendered
     strength is governed entirely by the opacity rungs above, which at max (0.55 of a diffused inset
     falloff) keeps any effective surface tint under the G9 14%-alpha ceiling across the shadow's
     body. Components hold zero colour opinions — a consumer repoints the alias, never mixes.
   - All four ride the TKT-0066 consumption law: NOT on the sanctioned direct-read list; a consuming
     control routes them through its own chain (`--ui-surface-host-working-duration:
     var(--ui-working-duration);` etc. in the `:where()` token block).
5. **Precedence, fixed: `disabled > pending > working > answered > focus > hover > filled > default`.**
   Rationale for the two new edges:
   - **`pending` over `working`** — if a consumer's CSS must pick one message, "what you see is
     stale" (a correctness statement) outranks "activity is happening" (an ambience statement).
     Mechanically the two compose for free — pending is a content opacity dim, working is a frame
     overlay glow, disjoint channels — so this edge only bites where a single-channel consumer must
     choose.
   - **`working` over `answered`** — an answered card being amended in place is, for that window,
     live again; the settled role-repoint (bg/ink) and the working overlay also compose mechanically
     (disjoint channels), so the edge is again message-precedence only.
   - `disabled` stays terminal (fleet canon); the TKT-0062 internal ordering is untouched;
     `user-invalid` stays orthogonal. Implementation follows TKT-0062's law: MUTUAL EXCLUSION via
     `:not()` guards where selectors overlap, never source-order/specificity.
6. **Nothing ships wired to this ADR in the same PR.** Docs-only proposal (the ADR-0191/0196
   sequence): no `.css` in this change references `:state(working)` or `--ui-working-*`; the token,
   surface-host, and conversation slices are follow-ups, built after ratification, verified
   pixel-truth in the agent-admin test chat per the issue's own Acceptance.

## Non-goals

- **Extending `pending`'s meaning or mechanism** — ADR-0191 is untouched; the two states coexist.
- **Any AX announcement** — `working` is presentation-only; the turn's announced face remains the
  narration strip (ADR-0146). A future audit wanting an announced "busy" semantic is a separate
  decision on the ARIA channel.
- **Per-node/fine-grained flash-on-change treatments** (highlighting WHICH binding just updated) — a
  different, heavier design; this ADR covers only the whole-surface alive ambience.
- **`ui-status-stream`** — it already narrates its own liveness; no working wiring is proposed there.
- **Any new event name** — the seven-member vocabulary (ADR-0153) is closed; state flips are props,
  not events.

## Consequences

- The host custom-state vocabulary gains its eighth member: `ready / dragging / truncated / revealed /
  settled / pending / answered / working` — cited here, not drift.
- The fleet gains its first LOOP-motion token (`--ui-working-duration`) — a second breathing/ambient
  consumer reuses it rather than minting another; if two consumers need different tempos, THAT is the
  revisit trigger for a motion-token ladder, not a per-component literal.
- The reduced-motion posture ("static, never nothing") is a new precedent for any future ambient
  animation: an animation that CARRIES STATE must degrade to a legible static form, unlike pure
  transition polish which may degrade to none (§4[c]).
- The exact literals (1600ms, 0.15/0.55, 24px) and both precedence edges are this proposal's judgment
  calls — genuinely open to revision at ratification, which is why this lands `proposed`.
- Until ratified, no surface may key off `:state(working)` or `--ui-working-*` (the ADR-0191
  consequence clause, unchanged).

## Alternatives considered

- **Extend `:state(pending)` (fork (a))** — rejected: ratified opposite semantics (stale-dim vs
  live-emphasis); see Context. One selector token must not mean two opposite things.
- **A surface-host-local `data-working` attribute (fork (c))** — rejected: host-level boolean visual
  states are `:state()` members per ADR-0191's precedent check; `data-*` is the PART-level vocabulary;
  and the semantic recurs on `ui-sandbox-frame` and future streamed surfaces — the third consumer
  would re-derive it.
- **An outline/border pulse instead of an inner shadow** — rejected: bleeds outside the box on
  `[bare]` chat mounts (chrome the ruling explicitly stripped), collides visually with the focus
  ring's outline channel (§2 — a keyboard user must never confuse "working" with "focused"), and a
  border pulse either animates a paint on the box edge only (too subtle on large cards) or touches
  layout (forbidden).
- **Animating `box-shadow` directly (no overlay pseudo-element)** — rejected: box-shadow
  interpolation repaints every frame on the CPU; opacity on a composited overlay is the
  compositor-only shape ADR-0095's exemption already blesses.
- **A shimmer/skeleton sweep** — rejected: skeleton grammar means "content not yet here"; this card's
  content IS here and current — the same false statement as the pending dim, in a different costume.
- **Dimming via `--ui-pending-opacity` reuse at a gentler value** — rejected: any dim de-emphasizes;
  the requirement is the opposite (alive/emphasis), and reusing pending's token would smear the two
  axes' vocabularies together.
- **`aria-busy` as the carrier** — rejected: a real platform AX semantic with announcement
  consequences this presentation-only state must not accidentally claim; the vocabulary precedent is
  `ElementInternals` custom states.

## Implementation note (2026-08-17, mechanical deviation — Kim nod, find-open-questions round)

The shipped overlay rides **`::before`**, not the `::after` this ADR's Decision names: the surface
part's `::after` was already ADR-0187's empty/terminal-empty placeholder channel at build time
(PR #1118), so the breathing overlay took the free pseudo-element instead. Behavior, tokens,
precedence, and reduced-motion arms are exactly as ruled — the deviation is the pseudo-element
slot only, documented in `surface-host.css` and pin-tested. Recorded here so the ADR stays
truthful to the shipped mechanism; not a Decision change, no re-ratification implied.
