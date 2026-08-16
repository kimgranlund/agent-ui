# ADR-0183 — View Transitions (GH #740): ONE shared `withViewTransition` seam in `components/dom`, per-surface OPT-IN booleans (router outlet · super-shell segments · a CSS-only `@view-transition` for the MPA docs site), progressive-enhancement-only — un-fencing ADR-0115 cl.7's named future candy; the A2UI re-render surface is DESIGN-DEFERRED to its own booked slice

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-12
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-12 |
> | **Proposed by** | host session (GH [#740](https://github.com/kimgranlund/agent-ui/issues/740)'s design intake; Kim's same-morning clarify ruling: ALL FOUR candidate surfaces are in scope) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-12, via the [`ratify ADR-0183` utterance](https://github.com/kimgranlund/agent-ui/pull/743#issuecomment-5262035942) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification: none owed elsewhere (ADR-0115 cl.7's fence text stays as history — this ADR IS the "earns its own record" record it demanded; `prd/router.prd.md` §Non-goals' trigger line is satisfied by Kim's mobilization ruling, no edit needed) · on ratification+build: shipped WITH this ADR in the same PR (cl.2–cl.5 below) + the S4 follow-up issue for the A2UI surface (cl.6). |
> | **Supersedes / Superseded by** | **Un-fences** [ADR-0115](./0115-spa-router-v1-scope.md) cl.7's view-transitions item (the one named "natural future candy" — every OTHER cl.7 fence stands untouched) · **Relates** [ADR-0022](./0022-childpart-native-movebefore-reorder-focus.md) (the `moveBefore` identity work is exactly why the A2UI surface is deferred, cl.6) · **Resolves** the design-intake half of GH #740 (the build ships alongside; the issue closes when the S4 follow-up is filed and the PR merges). |

## Context

Kim's ruling (2026-08-12, the AskUserQuestion clarify round GH #740's intake could not run): View
Transitions land on **all four** candidate surfaces — `@agent-ui/router` navigation, `ui-super-shell`
pane/tab swaps, A2UI surface re-renders, and the MPA docs site. Verified platform facts: same-document
`document.startViewTransition` (Level 1) ships in Chromium 111+/Safari 18+; cross-document
`@view-transition` (Level 2) in Chromium 126+/Safari 18.2+; Firefox has neither behind default flags at
intake time — so every design below MUST be progressive enhancement (the issue's own acceptance).

## Decision

1. **ONE shared seam, in `components/dom`.** `withViewTransition(mutate, enabled)` +
   `viewTransitionAvailable()` (`dom/view-transition.ts`): run `mutate` inside
   `document.startViewTransition` iff `enabled` AND the API exists AND `prefers-reduced-motion` is not
   set; synchronously otherwise. `components/dom` is the one home every same-document surface can import
   without a layering violation (`components ← {router, a2ui, code} ← app`). The one stated caveat: the
   transition path runs `mutate` asynchronously (the platform snapshots first) — callers with staleness
   guards re-check INSIDE `mutate`.
2. **Router (S1, shipped here): `viewTransitions` boolean prop on `ui-router-outlet`** (attribute
   `view-transitions`, default `false`) wrapping the ONE `#swap` site every path funnels through — sync,
   async-resolved, and clear alike. The last-navigation-wins token re-checks inside the transition
   callback; a no-op clear (already empty) never transitions; the flag is read `untracked` so a toggle
   never re-runs the route effect (which would re-invoke the factory). `.router` stays property-only —
   SPEC-R5's serializability rationale never applied to a boolean.
3. **Shell (S2, shipped here): `viewTransitions` boolean prop on `ui-super-shell`** wrapping
   `#setActiveSegment`'s visibility flips ONLY. Band crossings stay pure CSS (the shell family's
   no-JS-on-resize law) — unwrappable and deliberately unwrapped. The pane-tabs strip's `selected`
   mirror stays OUTSIDE the wrap (chrome state, not swapped content).
4. **Named-element morphs are the CONSUMER's vocabulary, not shipped defaults.** The platform's own
   `view-transition-name` CSS is fully usable by consumers on top of the shipped cross-fade; the fleet
   ships no names of its own in this wave (a names convention, if ever, is a separate intake).
5. **Docs site (S3, shipped here): CSS-only Level 2** — `@view-transition { navigation: auto }` in
   `_page.css` + a reduced-motion suppression of the transition pseudo-elements. Zero JS; the MPA
   posture (ADR-0115's own fence) is untouched.
6. **A2UI re-renders (S4): DESIGN-DEFERRED to its own booked slice, not silently dropped.** Two real
   unknowns make a same-PR ship dishonest: (a) the renderer applies updates incrementally per streamed
   message — there is no single swap site, and wrapping per-message would strobe a whole-document
   snapshot on every chunk; (b) the ADR-0022 `moveBefore` identity work touches the same swaps — the
   interaction (double-animation, identity conflicts) needs its own analysis. The follow-up issue is
   filed with this PR; its design question is "which grain is the transition boundary for a streamed
   surface" (candidate: `finalize(surfaceId)`), not "whether".

## Consequences

- Default-off everywhere: every no-opt-in, no-API, and reduced-motion path is byte-identical to before
  this family existed — the helper's truth table is unit-pinned, and the outlet/shell behavior is
  pinned at both the jsdom (stubbed API) and real-engine (genuine `startViewTransition` on Chromium,
  feature-detect honesty on WebKit) grains.
- `@agent-ui/router`'s ≤4.0 KB gz marginal (ADR-0115 cl.8, ADR-0040 manual gate) re-measured with the
  new prop — the helper itself is ~30 lines and lives in components (already counted in its own line).

## Amendment (2026-08-12, **ratified** — kimgranlund, [utterance](https://github.com/kimgranlund/agent-ui/pull/765#issuecomment-5262269510), verified 2026-08-12) — the A2UI surface's grain is RESOLVED: `ui-surface-host`'s settled-once re-render boundary, an opt-in `viewTransitions` boolean on that host (GH [#742](https://github.com/kimgranlund/agent-ui/issues/742), the slice cl.6 booked)

> Append-only. The Status cell, its vocabulary, and every accepted section above stay byte-untouched —
> agents never flip status; the ratification path for this amendment is Kim's own `ratify ADR-0183
> amendment` utterance (adr_ratify.py's amendment mode, GH #664), and GH #742 is the durable design
> record. This amendment RESOLVES cl.6's deferred design question; cl.6's deferral reasoning stands as
> history, un-edited.

**The grain ruling.** cl.6's candidate (`finalize(surfaceId)`) did not survive contact with the
mechanism: the renderer's `finalize()` is a VALIDATION stage (the ADR-0002 id-graph check) — the DOM
was already painted progressively during `ingest()`, so wrapping finalize would animate nothing.
The event actually worth a transition is the **re-render**: wire lines mutating a surface that is
already fully painted (the Builder updating a persona card turns after it first rendered — the
flash Kim's sessions saw live). The detector for "already painted" is `ui-surface-host`'s OWN
settled-once boundary — the host's first `finalize()` call marks it settled; every `ingest()` before
that is first-paint streaming, every one after is re-render.

1. **`viewTransitions` boolean prop on `ui-surface-host`** (attribute `view-transitions`, default
   `false` — the family's byte-identical guarantee). When set, `ingest()` wraps the line's
   application in `withViewTransition` **iff the host has settled once**; `finalize()` routes through
   the SAME wrap under the same condition. Pre-settle streaming NEVER transitions — progressive
   paint is the surface's whole value (cl.6's strobe concern, honored by construction rather than
   by wrapping less often).
2. **Burst coalescing is the platform's own semantics, relied on deliberately.** A re-render turn
   applies several wire lines in rapid succession; each wrapped call skips the previous in-flight
   transition (at most ~one visible cross-fade per burst), and the spec's update-callback queue runs
   every mutate in FIFO order — no line is lost, none reorders. `finalize()` riding the same channel
   is what keeps the validator behind the last queued mutation.
3. **The ADR-0022 `moveBefore` interaction, analyzed as cl.6 demanded:** the fleet ships ZERO
   `view-transition-name`s (cl.4 above), so a re-render transition is a single root cross-fade —
   there are no named elements to double-animate and no identity conflicts for a reorder to trip.
   The `moveBefore` identity preservation happens INSIDE the wrapped mutate, invisible to the
   transition machinery. Should a names convention ever ship (cl.4's separate intake), this analysis
   must be redone — that intake owes a re-read of this amendment.
4. **One accepted edge, stated:** `enabled` is evaluated per call, so a reduced-motion/API flip
   arriving MID-burst could run a later line synchronously past a still-queued earlier one. A
   mid-burst environment flip is not a real operating condition (bursts are sub-second); accepted
   and documented at the wrap site rather than engineered around.

## Amendment (2026-08-16, **ratified** — kimgranlund, [utterance](https://github.com/kimgranlund/agent-ui/pull/984#issuecomment-5310073353), verified 2026-08-16) — cl.4's "separate intake" ARRIVED: the fleet's opt-in named-morph convention (GH [#958](https://github.com/kimgranlund/agent-ui/issues/958)) — `ui-vt-{surface}-{token}` via `dom/view-transition.ts`, applied only behind a surface's own opt-in, proven on `ui-super-shell` segments; cl.4's no-DEFAULT-names law stands

> Append-only, and **proposed**: the Status cell reads `accepted` for the record as a whole and stays
> byte-untouched — agents never flip status (`.claude/hooks/adr-status-guard.py`), and this amendment
> carries no ratification of its own until Kim gives one (`ratify ADR-0183 amendment`, executed by
> `scripts/adr_ratify.py`'s amendment mode, GH #664). Every accepted section above — cl.1–cl.6 and the
> 2026-08-12 amendment — is unedited. GH [#958](https://github.com/kimgranlund/agent-ui/issues/958)
> is the durable design record; the build that carries this amendment is its PR.

**What cl.4 said, and what changes.** cl.4 ruled two things: (a) named-element morphs are the
CONSUMER's vocabulary — the fleet ships no `view-transition-name`s of its own **as defaults**; and
(b) "a names convention, if ever, is a separate intake." GH #958 is that intake. (a) STANDS WHOLE:
no control applies a name unless its own opt-in is set, and every default-off / no-API /
reduced-motion path stays byte-identical (the family law, cl.1). (b) is now RESOLVED:

1. **The convention** — `viewTransitionName(surface, token)` + `setViewTransitionName(el, name, enabled)`
   in `components/dom/view-transition.ts`, beside `withViewTransition`. Names are `ui-vt-{surface}-{token}`:
   `surface` = the owning control's slug, `token` = a PERSISTENT identity within it (a slot name, an id,
   an instance counter — never an array index). Both halves are sanitized to `[a-zA-Z0-9-]` (lossy on
   purpose; callers own distinctness at their identity grain). The `ui-vt-` prefix scopes fleet names
   away from a consumer's own vocabulary, which cl.4's (a) still hands to the consumer.
2. **The pairing law, both halves, documented at the seam:** (i) every element that can occupy ONE
   visual role carries the SAME name (only one is painted at a time — the browser morphs the outgoing
   into the incoming across different DOM nodes); (ii) a name is unique per DOCUMENT, not per surface
   INSTANCE — a surface that can mount twice folds an instance discriminator (authored `id`, else a
   per-document counter) into its token, or the transition aborts (the review-found M1 hazard, repaired
   in the same PR).
3. **First proving surface** — `ui-super-shell`'s `viewTransitionNames` boolean (attribute
   `view-transition-names`, default `false`), meaningful only alongside `viewTransitions` (cl.3): each
   segmented pane's segments share `ui-vt-super-shell-segment-{shell}-{slot}`, so a segment swap morphs
   instead of cross-fading. Both opt-ins off, or either off, or no API/reduced-motion: no name is ever
   written, not even cleared.
4. **The 2026-08-12 amendment's cl.3 re-read, as it demanded.** That analysis rested on "the fleet
   ships ZERO names"; it now rests on "the fleet ships no names on the A2UI surface" — `ui-surface-host`
   sets none, the A2UI catalog exposes no `viewTransitionNames` opt-in, and `ui-super-shell` is not
   inside a surface-host re-render. A re-render there is therefore still a single root cross-fade and
   the ADR-0022 `moveBefore` interaction analysis holds unchanged. Should a NAMED opt-in ever land on
   the A2UI surface itself, that intake owes the re-read again.
5. **Verify tier, honestly:** the token/pairing/gating truth table is unit-pinned (jsdom, stubbed
   API); the morph itself is browser-UNMEASURED at this amendment's date — a real-engine visual pin
   is owed by the shell's browser suite, not claimed here.
