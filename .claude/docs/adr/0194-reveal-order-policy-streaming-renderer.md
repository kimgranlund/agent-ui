# ADR-0194 — Reveal-order policy for the A2UI streaming renderer: an opt-in, default-OFF top-down sibling hold (`TreeDeps.revealOrder` / `RendererOptions.revealOrder`), never widening SPEC-R4 AC1's default

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-16
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-16 |
> | **Proposed by** | dispatched build seat, GH [#975](https://github.com/kimgranlund/agent-ui/issues/975) (Kim's owner-approved seed off the Solid 2.0 RC `<Reveal>`/SuspenseList announcement) — the ticket's own Scope/Open names the exact policy shape as a builder design call; this ADR is that call, never self-ratified |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-16, via the [`ratify ADR-0194` utterance](https://github.com/kimgranlund/agent-ui/pull/990#issuecomment-5310074518) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification: none owed elsewhere by construction (default-OFF, Consequences below) · on ratification+widen (a follow-up making this the DEFAULT, or wiring the opt-in through `ui-surface-host`): `a2ui-renderer.lld.md` §4's "Patch-in (SPEC-R4 AC1)" prose, `a2ui-runtime.spec.md` SPEC-R4's own wording if the widen changes the DEFAULT contract, and `tree.test.ts`'s "preserves sibling order when an earlier sibling is patched in late" test (named in Consequences — it encodes exactly the greedy-reveal default this ADR does NOT touch) |
> | **Supersedes / Superseded by** | **Relates** [ADR-0183](./0183-view-transitions-opt-in-family.md) (the opt-in-boolean/default-false/progressive-enhancement pattern this ADR reuses verbatim; ADR-0183's own S4 amendment explicitly scopes to POST-settle re-renders and disclaims first-paint streaming — "pre-settle streaming NEVER transitions — progressive paint is the surface's whole value" — so this ADR's pre-settle reveal-order work is orthogonal, not a duplicate) · **Cites** [GH #974](https://github.com/kimgranlund/agent-ui/issues/974) (the traits-layer pending-aware primitive, same Solid 2.0 RC provenance, independently shippable) |

## Context

GH #975: today the renderer materializes streamed `updateComponents` chunks in **stream (arrival)
order**, not **visual (declared child) order** — a container's later-declared child may finish
streaming before an earlier-declared sibling, and `tree.ts`'s existing out-of-order mechanism
(`#pendingParents`, SPEC-R4) reveals each id the instant its own data lands, independent of its
siblings. The result: components pop into a coordinated-looking surface at random positions as a
turn streams in, rather than the top-down, coherent reveal a reader expects (the announcement's
`<Reveal>`/SuspenseList framing — coordinate how async children reveal relative to each other and
their container).

**The mechanism (verified against `packages/agent-ui/a2ui/src/renderer/tree.ts`).** `SurfaceTree`
buffers every component by id into `surface.components` as it arrives (`apply()`), and mounts
depth-first from `root` the moment it exists. A child not yet buffered mounts as a position-
preserving comment anchor, registered in `#pendingParents` keyed by its id (SPEC-R4). When that id
later arrives, `#patchPending` swaps the anchor for the real subtree — **unconditionally**, the
instant the id is buffered, with zero regard for whether that id's EARLIER siblings (by declared
`child`/`children` order under the same parent) have themselves arrived yet. That unconditional
swap is the entire jitter: sibling reveal order is accidental (a function of network/model timing),
not declared (document) order.

**The direct SPEC-R4 AC1 tension, named rather than glossed over.** SPEC-R4 (`a2ui-runtime.spec.md`)
states: *"The renderer MUST render what is available, hold unresolved references, and patch them in
when later messages arrive — never blocking or erroring on a not-yet-defined reference."* A
top-down/hold policy — deliberately WITHHOLDING an already-arrived (available) later sibling's
reveal until an earlier sibling arrives — reads, on a literal parse, as exactly the "not rendering
what is available" SPEC-R4 forbids. Two things keep this a live design tension rather than a settled
non-issue: (a) SPEC-R4's own worked example and its co-located test (`tree.test.ts`'s "preserves
sibling order when an earlier sibling is patched in late", SPEC-R4 AC1) assert the CURRENT
greedy-reveal behavior directly — delivering only `b` (of declared siblings `[a, b]`) asserts
`childIds(root)` equals `['b']` **before** `a` ever arrives; a reveal-order policy applied
unconditionally would make that assertion false (root would show neither child yet, both still
anchors.) (b) a stalled or truly-never-arriving earlier sibling means every later sibling this
ADR's hold policy withholds never reveals either — an honest, bounded-but-real regression against
SPEC-R4's stream-liveness guarantee, not merely a display-timing nuance.

## Decision

1. **The policy: top-down sibling hold, scoped to the STATIC component tree only.** For a
   container's ordinary `child`/`children` (the `A2uiComponent[]`/string-id form — **not** a
   `children`-TEMPLATE dynamic list, LLD-C6, which is already data-driven/positionally reconciled
   and carries no cross-batch reveal-order ambiguity; and **not** a dynamic-list ITEM's own
   descendants, LLD-C6's instance mode, which never registers in `#pendingParents` at all today),
   a child only swaps its real content in for its pending anchor once **every earlier sibling** (by
   declared order under the same parent) has ALSO revealed. A held sibling's data is never
   discarded or re-fetched — it sits buffered in `surface.components` exactly as SPEC-R3 already
   guarantees; only the VISUAL reveal (`#pendingParents`'s anchor swap) is deferred. When a blocking
   earlier sibling finally arrives, the swap cascades forward through every already-buffered,
   still-held later sibling in one pass (a run of already-delivered content reveals together,
   matching what a single coordinated batch would have looked like).
2. **Opt-in, default OFF (`revealOrder?: boolean`, `TreeDeps`/`RendererOptions`) — the ADR-0183
   pattern, reused verbatim.** Mirrors that ADR's own "default-off everywhere: every no-opt-in path
   is byte-identical to before this family existed" guarantee. This is the resolution to the
   SPEC-R4 AC1 tension above: SPEC-R4's DEFAULT contract (the renderer's out-of-the-box behavior,
   and the co-located test asserting it) is untouched byte-for-byte — `tree.test.ts`'s existing
   out-of-order suite passes unmodified, because `harness()` never sets the flag. The policy exists
   as an additional, explicit mode a caller opts into when the coordinated-reveal property is worth
   the SPEC-R4 AC1 trade named in Consequences — never a silent widen of the default.
3. **File scope stays exactly `packages/agent-ui/a2ui/src/renderer/` (this ticket's own bound).**
   `ui-surface-host` (`@agent-ui/app`) already carries the ADR-0183 amendment's precedent for
   wiring an opt-in boolean through as a reflected attribute (`viewTransitions`/`view-transitions`)
   — the SAME wiring for `revealOrder` is the natural next step, but doing it here would touch a
   package outside this ticket's `a2ui`-only scope. Named explicitly as a **rejected alternative**
   (not silently deferred): the renderer-level mechanism + opt-in ship complete and independently
   testable at the `RendererOptions`/`SurfaceTree` grain; the host-wiring follow-up is a separate,
   small ticket.
4. **No wire/protocol change, no catalog change (the ticket's own acceptance).** `protocol.ts` is
   untouched; the policy is pure presentation-timing over already-valid, already-buffered data. The
   signals kernel (`reactive/graph.ts`/`scheduler.ts`) stays fully synchronous — the hold is
   expressed entirely as "which DOM swap happens this `apply()` pass," never a `setTimeout`/promise/
   microtask deferral, so no new async surface enters the renderer.

## Consequences

- **Named regression risk, bounded and opt-in only:** under `revealOrder: true`, a container whose
  EARLIEST declared child never arrives (a stalled turn, a dropped connection, a server bug) means
  every later sibling of that container — even fully delivered — never reveals either. This is the
  direct cost of coherent ordering and is accepted deliberately for callers who opt in; it does NOT
  apply to the default (unset) path, which keeps SPEC-R4 AC1's literal "render what is available"
  guarantee exactly as tested today.
- `tree.test.ts`'s existing out-of-order suite (SPEC-R4 AC1) is a live, standing regression check for
  the DEFAULT (off) path — any future change that makes `revealOrder` the default must first update
  or replace that suite's own assertions, named here so the next reader does not mistake it for
  stale coverage.
- The reveal-order state (`#siblingOrder`/`#childContainer`/`#revealedCount`, `tree.ts`) is
  per-container bookkeeping, disposed alongside the container's own node scope (`#disposeSubtree`) —
  no new persistent per-surface allocation survives a container's removal. **A container's own
  children changing via structural resend (RSR-C4/C5, `#reconcileChildren`) resyncs this same
  bookkeeping** (`#resyncOrderedChildren`, added after a `code-checker` review caught the gap): the
  declared order and cursor are refreshed to the NEW list and any already-buffered-but-held sibling
  the resend unblocks cascades immediately — without this, a resend that removed or reordered the
  blocking sibling would leave the cursor pointed at a stale position that could never advance,
  stranding an already-delivered later sibling behind it permanently (proven regression-tested:
  `tree.test.ts`'s "reveal-order resync on structural resend" describe block).
- **Named limitation, scoped out rather than fixed (2nd `code-checker` pass): a structural resend
  that ADDS a new child to an already-tracked container is not itself reveal-order-gated.**
  `#reconcileChildren`'s fresh-mount branch (RSR-C5) mounts a newly-declared child via the plain
  `#mountNode` — if that child's data is already buffered (e.g. delivered earlier as an orphan,
  unreferenced component), it reveals IMMEDIATELY, out of declared order, exactly the jitter this
  policy exists to prevent — this is a real, accepted gap in the resend-ADD case specifically. What
  IS fixed (a hard liveness requirement, not optional): `#advanceReveal` now treats "already has a
  widget" as satisfied-and-skip rather than mis-reading the missing `#pendingParents` registration as
  "not ready" and permanently stranding every later sibling behind it — regression-tested (`tree.test.ts`'s "a resend-added child with already-buffered data does not strand later siblings behind it").
  Closing the reveal-order gap on the resend-ADD path fully (gating the fresh-mount itself against the
  in-flight cursor) is deferred to a follow-up — this ADR's Decision cl.1 targets the reported jitter
  in INITIAL streamed paint (GH #975's own framing); a resend is a fundamentally different event (an
  already-rendered, already-settled surface being incrementally restructured, ADR-0183 S4's own
  post-settle/pre-settle distinction) with materially smaller real-world exposure to this specific gap.
- Dynamic-list items (LLD-C6) and `children`-TEMPLATE containers are explicitly OUT of this policy's
  reach (Decision cl.1) — their own reconcile mechanism (a length-effect + positional index binding)
  already reveals deterministically by array order, not stream-arrival order, so they carry none of
  GH #975's reported jitter.
