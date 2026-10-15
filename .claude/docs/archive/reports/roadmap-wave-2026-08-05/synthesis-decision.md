# Decision sheet — Kim's rulings (2026-08-05)

Companion to `synthesis-spine.md` + `synthesis-milestones.md`. Recommended option listed first.
This wave PROPOSES only — no milestone is minted, no GitHub Issue filed, roadmap.md untouched;
every ruling below is Kim's to make.

## Q1 — Which milestone(s), what order?

Unlike 07-28's M-A (gated on two prerequisite design forks feeding it), all three candidates this
wave are independent — different files, no shared seam contract (synthesis-milestones.md
"Cross-milestone notes") — so this is a pure sequencing call, not an unblocking one.

- **(a) RECOMMENDED: M-E → M-F, with M-D held open pending Q2** — close the one CONFIRMED,
  live correctness gap first (M-E's `protocol.ts:120` `surfaceProperties` drift from the upstream
  spec this repo claims to track), then ship M-F's second SaaS composition and file the
  four-times-cited association/multi-select intake. M-D does not enter the order until Q2 is
  answered — it is the only candidate with an unresolved human ruling already on record (Kim's
  own 2026-08-05 "PARKED IDEA" comment on GH #421), so sequencing it before that's answered would
  mean building order around a bet that may not be authorized to start.
- (b) M-F → M-E — ship the user-visible page first (the only candidate of the three that ships
  new user-visible surface); M-E's drift fix and ratification wait. Reasonable if visible progress
  matters more than closing a spec-drift gap that inv-6 rates low blast radius today ("nothing
  consumes it incompatibly").
- (c) M-D first (requires Q2 = reopen) — start from the most strategically differentiating bet
  (personas that visibly diverge); defers the safer, cheaper M-E/M-F work behind a design intake
  whose own three open architectural questions (local-pattern-layer location, catalogId
  relationship, "system patterns" layer) are unscoped until GH #421 is re-triaged.
- (d) Run M-E and M-F in parallel now, M-D deferred indefinitely — since they touch disjoint files
  and neither depends on the other, there is no technical reason they can't overlap; only bandwidth
  decides whether to sequence or parallelize them.

**Reasoning for (a):** M-E is the only candidate with zero design-intake risk (synthesis-milestones.md,
"Cross-milestone notes": "every scope line is either a ratification, a confirmed drift fix, a
small filed issue, or a small build with an already-named implementation route... it carries no
open architectural fork, unlike M-D") and it repairs
a real, already-verified divergence from the protocol this repo's own `SUPPORTED_VERSIONS` claims
to track — the kind of drift that compounds the longer it sits unfixed, per the wave's own
cross-cutting finding #3 (both a2ui catalogs already share a corpus-thinness pattern one layer
apart; letting wire-type drift join that pile is the same shape of risk). M-F is next because it is
the only candidate that ships new user-visible surface AND it retires the wave's most-corroborated
standing gap (association/multi-select, cited four times across two inventory waves, inv-5 §6's own
named risk of "a fifth wave re-deriving the same finding from scratch") — filing that intake now,
regardless of which milestone runs, stops the compounding. M-D is sequenced last, not because it is
weaker as a bet, but because building an order around it presumes an answer to Q2 that only Kim can
give; slotting it first would silently treat "reopen the parked ruling" as already decided.

## Q2 — GH #421 / M-D: mint the design intake now, or leave it parked? (verbatim tension)

GH #421 (per-persona A2UI catalog composition, feeding M-D) is the single most-corroborated live
candidate in this wave's spine — named independently by inv-1 §3.1 ("the one visible
feature-shaped opportunity actually sitting on agent-admin's own backlog"), inv-2 §3.4
("architecturally closer... the prerequisite it names is done"), and inv-3 §4.2 (cited as GenUI's
own pattern-source precedent). **inv-3-genui.md also records that Kim independently triaged #421 on
2026-08-05, via issue comment, as: "PARKED IDEA, Later-tier ... has no ruled intake; it would
re-enter through a design intake like the ADR-0169 second-catalog arc did."**

That triage predates this synthesis and was made without seeing the M-D candidate framing. The
open question is genuine and not resolved here: **does M-D's design intake (freezing where a
persona's "local pattern" layer lives, its relationship to the two-catalog `catalogId` model, and
whether "system patterns" is an existing layer or needs carving out) get minted now — reopening
Kim's own ruling — or does #421 stay parked, with M-E and/or M-F run instead this cycle?** This
synthesis does not choose; choosing M-D would be Kim reopening his own ruling, not this wave
overriding it (synthesis-milestones.md, "Cross-milestone notes").

## Q3 — SPEC-R6(b): keep `surfaceProperties` as a tolerated Postel extension, or drop it?

PR #453's draft SPEC names this as its own open ruling (inv-6 §1e), and M-E's scope sketch cannot
close the `protocol.ts:120` drift without it. This is not gated purely on picking M-E: if Q4(a) is
taken (ratify #453 now), SPEC-R6's audit — including this arm — goes onto the filing path
regardless of which milestone runs first, so this ruling is worth making in the same pass as Q1
even if M-E is sequenced later:

- **(a) RECOMMENDED: drop it** — the upstream v1.0-RC spec removed the field entirely
  ("Decoupled Branding"); keeping a field the spec this repo claims to track no longer defines
  is the more likely source of future confusion for anyone diffing this repo against upstream,
  and inv-6 §5 rates today's blast radius as low ("nothing consumes it incompatibly") — meaning
  the cost of dropping it now, while nothing depends on it, is the cheapest it will ever be.
- (b) Keep it as a tolerated inbound extension — SPEC-R6(b)'s own text frames the choice as "keep
  as a tolerated inbound extension or remove, ruled explicitly, never silently patched"; choosing
  this arm means recording that rationale explicitly wherever the ruling lands, not leaving it
  implicit. Lower short-term churn if anything in-tree (undiscovered by this wave's inventories)
  does read the field.

## Q4 — Ratification batch (unblocks work, not a strategy call — listed for one-pass flipping)

- **(a) RECOMMENDED: ratify PR #453 now, independent of Q1's milestone order** — inv-6 §3
  candidate #1 names this "zero-cost (Kim's read only), unblocks filing SPEC-R1–R7 as real GitHub
  Issues per its own §5 routing table." It blocks nothing on `main` today (draft, one file
  changed) but every day it sits `proposed` is a day SPEC-R1–R7 stay un-filed, which is exactly
  the filing-drift risk inv-6 §5 names as the SPEC's own biggest exposure.
- (b) Hold ratification until a milestone (most likely M-E) is picked, and ratify as part of that
  milestone's own first slice — cheaper to reason about as one bundled decision, at the cost of a
  few more days of SPEC-R1–R7 sitting unfiled.

Two additional record-hygiene items surfaced this wave but are NOT bundled into (a) above because
they don't unblock any filing pass the way #453 does — naming them here only so they aren't
silently dropped, the way 07-28's Q5 batched ADR-0160's "record hygiene" flip alongside its two
load-bearing ratifications:

- GenUI's PRD (v0.4, `proposed` since 2026-07-24) and SPEC (v0.6, `proposed` since 2026-07-28)
  remain unratified despite the whole B0-B2 arc and the M-C dogfood arc having shipped and closed
  live — inv-3 §4.9 names this explicitly as "worth naming as a housekeeping candidate for this
  wave's synthesis, parallel to how ADR-0160 was named purely for 'record hygiene'." Ratifying
  either is a Kim-only read, independent of M-D/M-E/M-F.
- roadmap.md §3 still lists the 5-uncataloged-controls question as open even though inv-2 §3
  confirms it's resolved in-tree (four PERMANENT allowlist exclusions with cited ADRs, one catalog
  row) — the spine names this "a small repair independent of any milestone." Not a ruling Kim
  needs to make; a doc-drift line ready for a same-day fix whenever this wave's docs are touched.

## Recommendation (one paragraph)

M-E first: it is the smallest, safest bet — zero design-intake risk, every scope line already a
ratification, a confirmed drift fix, a small filed issue, or a small already-routed build — and it
closes a real, verified
divergence between this repo's wire types and the upstream spec it claims to track, before that
drift has a chance to compound the way the corpus-thinness pattern already has one layer over.
M-F second: it ships the wave's only new user-visible surface (a second SaaS composition proving
the fleet's data-app posture generalizes) and retires the single most-corroborated standing gap
in two inventory waves (association/multi-select, cited four times) by filing its re-entry intake
— cheap, and it stops a fifth wave from re-deriving the same finding from scratch. M-D stays
unscheduled pending Q2: it is architecturally the most differentiating bet (two personas speaking
visibly different UI idioms), and its own prerequisite (`catalogId` threading, ADR-0169/0170) is
now fully shipped — but Kim's own 2026-08-05 triage comment on GH #421 already calls it a parked
idea with no ruled intake, and this synthesis will not treat picking M-D as a foregone conclusion.
Q3 (SPEC-R6(b)'s keep-or-drop ruling) and Q4 (ratifying PR #453) are cheap enough to decide in the
same pass as Q1 regardless of which milestone order Kim picks.
