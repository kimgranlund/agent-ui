# ADR-0160 — GH #291 chat redesign: `ui-status-stream`'s header loses its background, the agent turn RE-BUBBLES (reversing ADR-0129/GH #241 fleet-wide), and `ui-conversation` gains a general pre-hydrated action-chip mechanism on settled turns

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-07-27
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-27 |
> | **Proposed by** | build seat ([GH #291](https://github.com/kimgranlund/agent-ui/issues/291) — Kim's reference screenshots + the 2026-07-27 rulings comment resolving all three open forks) |
> | **Ratified by** | Kim Granlund (repo owner), 2026-07-28 — the owner-authored Status flip in commit [`7ffaad5`](https://github.com/kimgranlund/agent-ui/commit/7ffaad5ef5d78d890221d1a087e7feba5e5362a4). Citation back-filled 2026-07-28 from that commit's git evidence: the flip was made by hand, and `adr_ratify.py` (which writes both cells together) was not the path, so this cell was left empty at the time. |
> | **Repairs** | `packages/agent-ui/components/src/controls/status-stream/status-stream.css` (retires `--ui-status-stream-header-surface`) · `packages/agent-ui/app/src/controls/conversation/{conversation.ts,conversation.css,conversation.md,conversation.browser.test.ts}` (restores `--ui-conversation-agent-bubble` + the agent-role bubble rule; adds `TurnAction`, `AgentTurnHandle.finalize(actions?)`, the `action` event, the `[data-part="actions"]` chip row) · `packages/agent-ui/app/src/index.ts` (exports `TurnAction`) · `site/pages/a2ui-chat.ts` (proof-of-concept consumer wiring: a Helpful/Not-Helpful pair on settled turns with content) |
> | **Supersedes / Superseded by** | Reverses, for the agent-role bubble ONLY, the de-bubbling half of the build that shipped under [ADR-0129](./0129-app-surfaces-m2-composition-and-transport-boundary.md) clause 2/3's `ui-conversation` (the GH #241 commit `5437c32`, never itself ADR-numbered — a same-day fix, not a separately ratified record). Everything else GH #241 shipped stands UNCHANGED: the A2UI/GenUI render surface's own chromeless `[bare]` mode (`ui-surface-host`), the sender label sitting above the content outside the text container, and the user bubble. Extends [ADR-0153](./0153-status-stream-elapsed-timer-retry-action-planned-glyph.md) (reuses its `action` event — the closed vocabulary's seventh member — for the settled-turn chip row; does NOT mint an eighth). Relates [ADR-0146](./0146-live-turn-lifecycle-progress-channel.md)/[ADR-0159](./0159-status-stream-receipt-pattern.md) (the header this wave flattens; the `finalize()` call site this wave extends). |

## Context

GH #291 (Kim's screenshots, an external chat-widget reference pattern — explicitly "A2UI not
affected", the generative-UI renderer stays out of scope) named three candidate changes to the
chat/status-stream presentation layer. Kim's 2026-07-27 rulings comment resolved all three:

1. **The "Agent activity" header (`ui-status-stream`'s opt-in streaming header, ADR-0146 F8) carries
   a visible boxed background today** (`status-stream.css:92`, `background:
   var(--ui-status-stream-header-surface)`). The reference shows the activity line floating directly
   on the page background — no box. Purely cosmetic, independent of the other two forks.
2. **The agent turn is missing its chat bubble.** `ui-conversation`'s `[data-part='bubble']
   [data-role='agent']` currently ships with NO background, NO padding, full message-column width —
   a deliberate design shipped the same day as ADR-0129's `ui-conversation` build (GH #241, commit
   `5437c32`, never itself ADR-numbered). The reference's settled state shows the bot's reply inside a
   visible light bubble/container. Kim's ruling: **YES, reverse GH #241's de-bubbling, fleet-wide**
   across every consumer of `ui-conversation` (`a2ui-chat`, `a2ui-live`, `gen-ui-live`,
   `agent-admin`) — contract-changing enough to require this record, never a silent restyle.
3. **Post-completion Helpful/Not-Helpful buttons.** No such affordance exists anywhere in the fleet.
   Kim's ruling: Helpful/Not-Helpful is one EXAMPLE of a general mechanism — "a settled agent turn
   can carry a row of pre-defined action chips… that emit an event on commit" — never a hardcoded
   pair.

Two adjacent forks GH #291 also raised are explicitly OUT of this record's scope, per Kim's ruling:
the numbered "Task Step NN" labeling stays a reference illustration, not a mandate — `conversation.ts`'s
existing contextual `PROGRESS_LABEL` stage-name table is UNCHANGED, never force-renumbered.

## Decision

### 1 — The header loses its background (`ui-status-stream`)

`--ui-status-stream-header-surface` is RETIRED (deleted from the token block; the fleet-wide grep
this build ran found no other consumer). The header row's `background` declaration is removed —
the pinned row now paints nothing of its own, floating on whatever the page behind it paints. The
hairline `border-block-end` (`--ui-status-stream-header-border`) is KEPT unchanged: a 1px rule line
is not a "box" in the sense Kim's ruling names, and it is the row's only remaining visual separation
from entries scrolling underneath it (the row stays `position: sticky`, unaffected). Every other
header-row property (padding, gap, ink, the status-marker glyph/dot/ring/pulse) is untouched.

### 2 — The agent turn re-bubbles, fleet-wide (`ui-conversation`)

`[data-part='bubble'][data-role='agent']` drops its GH #241 override wholesale: no more `background:
none; padding: 0; border-radius: 0; inline-size: auto; max-inline-size: 100%`. Restored instead —
byte-identical to the ADR-0129-adjacent pre-#241 shape, promoted from `site/pages/a2ui-chat.css`'s
own retired equivalent (`git log -S`-recovered):

- `--ui-conversation-agent-bubble: var(--md-sys-color-neutral-surface-high, currentColor)` — a
  **neutral CONTAINER tone**, deliberately NOT the user bubble's primary-tinted
  `--ui-conversation-user-bubble` (Kim's ruling: "a subtle light container", not a second accent
  bubble), one step up from the shell's own `--ui-conversation-surface` (surface-low) so the bubble
  still reads as a distinct shape against the shell behind it — `light-dark()`-backed at the source,
  legible in both schemes without a second per-scheme override.
- `align-self: flex-start` (not `stretch`) — restoring the shared base `[data-part='bubble']` rule's
  own `max-inline-size: 92%` cap unmodified (the agent override no longer needs its own width rule at
  all — it simply stops zeroing the base rule out).

Because this is a fleet-wide component change (`ui-conversation`'s own CSS, not a page override),
every composer of `ui-conversation`/`ui-status-stream` — `a2ui-chat.ts`, `a2ui-live.ts`,
`gen-ui-live.ts`, `agent-admin.ts` — inherits it automatically; a repo-wide grep for a page-level
`[data-part='bubble']` override confirmed none exists to fight it.

**What survives untouched — the A2UI/GenUI render surface stays chromeless.** GH #241's OTHER
half — `ui-surface-host`'s `[bare]` attribute (no checker background, zero internal padding, full
width relative to its OWN stage) — is not this record's concern and is not touched by it. The bubble
now contributes exactly ONE padding layer around the mounted `ui-surface-host` (the SAME single
layer it always contributed, pre-#241 too) — `[bare]`'s own internal padding stays zero, so this is
never a DOUBLE padding regression; the surface simply sits inside a chromed bubble again, instead of
a bare one. Browser probes (below) assert the surface fills the bubble's own content-box exactly,
never the full log column, and that the surface's own stage/padding stay zeroed regardless.

**Streaming-state parity, deliberately preserved:** the SAME `[data-part='bubble']` container carries
both the in-flight and settled states (conversation.ts never swaps bubbles mid-turn) — so the
re-bubble is visible from the FIRST rendered frame of a turn, never a bubble that appears only after
`finalize()`.

### 3 — The pre-hydrated action-chip mechanism (`ui-conversation`)

`AgentTurnHandle.finalize` gains an OPTIONAL second parameter:

```ts
finalize(actions?: readonly TurnAction[]): void
```

```ts
export interface TurnAction {
  readonly id: string
  readonly label: string
}
```

A non-empty `actions` list renders ONE `[data-part='actions']` chip row on that settled turn's
bubble (after the wire disclosure, when both are present) — one `ui-button` (`variant="soft"
size="sm"`, the `ui-status-stream` inline-retry precedent, ADR-0153 Fork 2) per action, labelled
`action.label`. Clicking ANY chip removes the WHOLE row first (a one-shot commit — a settled turn's
feedback/reply choice can never double-fire), then fires `action` on `ui-conversation` itself with
`{ id: action.id }` — **reusing** the fleet's existing `action` event (ADR-0153's seventh
closed-vocabulary member, minted for `ui-status-stream`'s inline retry button) rather than minting an
eighth. `id` is entirely the consumer's own vocabulary (`'helpful'`/`'not-helpful'`, `'yes'`/`'no'`,
anything) — never interpreted by the primitive itself. Omitted or empty `actions` ⇒ byte-identical
to every existing `finalize()` caller (no new DOM, no new listener).

This satisfies Kim's ruling directly: Helpful/Not-Helpful is a CONSUMER CHOICE (one array literal at
the `finalize()` call site), not a component-level hardcoded pair — a "Yes"/"No" quick-reply turn is
the identical mechanism with a different array. One proof-of-concept consumer wires it:
`site/pages/a2ui-chat.ts`'s `runTurn()` passes a Helpful/Not-Helpful pair whenever a settled turn
carried real content, and listens for `action` to surface a page-level thank-you status line —
demonstrating the full round-trip (render → click → one-shot commit → event → consumer reaction)
without the primitive itself knowing what "helpful" means.

## Consequences

- Every existing `ui-conversation`/`ui-status-stream` consumer's rendered chat surface changes
  visually: the header floats without a box, and agent replies render inside a visible neutral
  bubble again — a fleet-wide visual shift, not a page-local restyle. GH #241's own browser probes
  (`conversation.browser.test.ts`'s "chat-path chrome laws" suite) are UPDATED in this same build to
  pin the new ruled shape (background present, padding present, width capped at 92%) rather than
  deleted — the A2UI-surface-chromeless assertions in that same suite are re-scoped to compare
  against the BUBBLE's own content-box width (not the full log column) but otherwise stand unchanged.
- `ui-conversation`'s public surface grows: one new exported type (`TurnAction`), one widened method
  signature (`finalize`, backward-compatible — every existing zero-arg call site is unaffected), one
  new DOM event (`action`, reusing the existing closed-vocabulary member), one new documented part
  (`[data-part='actions']`).
- `--ui-status-stream-header-surface` is a genuine removal (not a deprecation) — any external
  consumer reading that custom property directly (none exist in this fleet, grep-confirmed) would see
  it resolve to nothing; `--ui-status-stream-header-border` is unaffected.
- The numbered "Task Step NN" labeling convention and `PROGRESS_LABEL`'s existing named-stage table
  are UNTOUCHED by this record — Kim's ruling named that fork resolved as "keep contextual labels,"
  a non-change, so no repair lands here for it.
- **GH #291 review repair (2026-07-27) — the chip `action` event was colliding with a pre-existing
  bubbling `action` shape.** `ui-sandbox-frame` already emitted its own `action` CustomEvent
  (`{surfaceId, name, payload}`, SPEC-R8's genui game-loop channel) bubbling+composed; `conversation.ts`'s
  `routeGenui` re-routes it through `onClientMessage` but was NOT stopping its propagation, so it
  continued bubbling past `ui-conversation`'s own host boundary — colliding there with clause 3's own
  `action` event (`{id}`, fired ON `ui-conversation` itself). A consumer's chip listener that read
  `detail.id` blindly (`site/pages/a2ui-chat.ts`) misfired on a genui action click. Fixed two ways:
  (1) `conversation.ts`'s `routeGenui` now calls `e.stopPropagation()` on the genui frame's `action`
  listener — the root-cause fix, safe because every OTHER fleet consumer that listens for a genui
  frame's `action` (`gen-ui-live.ts`, `sandbox-frame-demo.ts`) attaches its listener directly on the
  `ui-sandbox-frame` instance it itself created, never on an ancestor of `ui-conversation`, so nothing
  depends on the bubble reaching past the frame; (2) `a2ui-chat.ts`'s own chip listener additionally
  guards on `event.target === conv` (belt-and-suspenders, and the only correct check for any consumer
  attaching its listener above `ui-conversation` rather than relying on this build's `stopPropagation`).
  `conversation.md`'s `action` event entry now names the discriminant. No new coverage of THIS
  specific collision was added to `conversation.browser.test.ts` (the reviewer's second finding — zero
  coverage of the chip mechanism itself — is repaired there instead, including a target-discrimination
  assertion covering the chip's own `event.target` contract this note documents).
- **GH #306 (Kim's 2026-07-27 same-day revision) — the sender label AND the narration strip move
  OUTSIDE the bubble entirely.** This record's clause 2 re-bubble left `[data-part='who']` and (agent
  turns) `[data-part='narration']` as the bubble's OWN children — Kim's follow-up ruling on the
  reference mockup: both render as free-standing turn chrome ABOVE the bubble, on the page background,
  never painted by the bubble's own background. `conversation.ts` gains a new `[data-part='turn']`
  wrapper (`#makeBubble`, `Role`-carrying `data-role`, the SAME allowlisted dynamic-role identifier
  Gate-3 already covers) for `user`/`agent` turns only — `who` then (agent only) `narration` then the
  bubble, in that order; a `system` turn carries neither `who` nor `narration` and so gets no wrapper
  (the smaller diff, `outer === bubble`, unchanged from before this record). The wrapper takes over the
  log-level `align-self` and the base bubble's own 92% width cap; the bubble itself no longer sets
  either. `AgentTurnHandle.finalize()`'s action-chip row (clause 3, above) is UNAFFECTED — it still
  renders inside the bubble, appended after the note/wire-disclosure, since Kim's reference shows the
  chip row directly under the message content, not as free-standing chrome. Turn-resume
  (`beginAgentTurn({intoSurface})`) locates the narration strip via the bubble's OWN parent element now
  (`#resumableBubble`) rather than a bubble-scoped child query. `conversation.browser.test.ts`'s
  chrome-law suite is RE-PINNED (never weakened) to assert the label/strip sit outside the bubble and
  that the turn wrapper itself paints no background of its own.
- **GH #313 (Kim's 2026-07-28 ruling — "no bubble unless there is content for it")** — the GH #306
  amendment above left the bubble holding ONLY content (note/mounts/chips), so a fresh turn's
  up-front-created, still-empty bubble painted as a visible chromed pill for the whole pre-content
  phase of a live turn. `conversation.ts` now creates a fresh agent bubble with `data-empty` set
  (`conversation.css` hides it while present) and clears it, exactly once, on the first real content
  of any kind — a streamed `setNote()` token (now painted into the DOM immediately rather than
  buffered for `finalize()` alone), a fresh mount, the settled-turn chip row, or `finalize()`'s own
  fallback tally; a resumed bubble (TKT-0079) never carries the attribute, since it can only resume
  because it already has content. `fail()` is untouched — an agent bubble that never received content
  simply stays hidden beside the separate system-bubble error text. `conversation.browser.test.ts`
  gains a dedicated "empty-bubble hiding law" suite (never weakening the existing chrome-law probes).

## Alternatives considered

- **Scoping the re-bubble to `agent-admin` only** (the page GH #291's screenshots most likely came
  from) — rejected: Kim's ruling was explicit ("fleet-wide... across chat surfaces"), and the prior
  GH #241 de-bubbling was ALSO fleet-wide (a component-level CSS rule, not a page override) — a
  page-scoped reversal would require inventing per-page override CSS the fleet doesn't otherwise use
  for this component, splitting one shape into two for no ruled reason.
- **A negative-margin bleed on `[data-part='mounts']` to keep the A2UI surface visually flush with
  the bubble's outer edge** (canceling the bubble's own padding around the surface specifically) —
  considered, then rejected: GH #241's original complaint (checkered background + padding + width
  constriction) was about chrome the render surface's OWN wrapper (`ui-surface-host`'s stage/surface
  parts) contributed, already fixed by `[bare]` independently of whatever the OUTER bubble does. The
  bubble contributing ONE ordinary padding layer around a chromeless inner surface is the same shape
  every other bubbled chat UI uses (and the exact pre-#241 shape this fleet shipped before) — not a
  regression of GH #241's fix, so no extra bleed mechanism is needed.
- **A new `feedback` prop/method pair instead of widening `finalize()`** (e.g.
  `showFeedback(bubbleId, actions)` called after the fact) — rejected: the chip row is inherently a
  property of ONE turn's settlement, and `finalize()` is already the single call site that closes out
  a turn's rendering (note, disclosure); routing the actions through the same call keeps one owning
  site instead of two, and avoids inventing a bubble-identity handle `AgentTurnHandle` does not
  otherwise expose.
- **A dedicated `ui-chip`/`ui-tag` control** instead of reusing `ui-button` — rejected: no such
  control exists in the catalog today (confirmed by inventory check), and `ui-status-stream`'s own
  inline retry affordance already established `ui-button size="sm" variant="soft"` as the fleet's
  action-chip idiom (ADR-0153 Fork 2) — reusing it keeps one idiom, not two, for "a small labelled
  commit button inside a timeline/conversation surface."

## Amendment (2026-08-16, **ratified** — kimgranlund, [utterance](https://github.com/kimgranlund/agent-ui/pull/1036#issuecomment-5315590188), verified 2026-08-17) — the AGENT turn's 92% width cap is SUPERSEDED: the agent turn stretches to the full conversation column (GH [#1032](https://github.com/kimgranlund/agent-ui/issues/1032), Kim's ruling "use the full width"); the USER turn's cap + `flex-end` stand unchanged

> Append-only, and **proposed**: the Status cell reads `accepted` for the record as a whole and stays
> byte-untouched — agents never flip status (`.claude/hooks/adr-status-guard.py`), and this amendment
> carries no ratification of its own until Kim gives one (`ratify ADR-0160 amendment`, executed by
> `scripts/adr_ratify.py`'s amendment mode, GH #664). Every accepted section above — clauses 1–3 and
> the GH #306 / GH #313 consequence notes — is unedited. GH
> [#1032](https://github.com/kimgranlund/agent-ui/issues/1032) is the durable design record; PR
> [#1035](https://github.com/kimgranlund/agent-ui/pull/1035) (merged as
> [`95456f27`](https://github.com/kimgranlund/agent-ui/commit/95456f27da3892e0efcb1823f5a9505fe8189fd6))
> is the build that carries it.

**Which clause changes, and which does not.** Clause 2 ruled that the re-bubbled agent turn takes
`align-self: flex-start` and "the shared base rule's own `max-inline-size: 92%` cap unmodified"; the
GH #306 note moved BOTH of those (the log-level `align-self` and the 92% cap) from the bubble onto the
new `[data-part='turn']` wrapper. **For the AGENT turn only, that width-cap ruling is superseded:**
`[data-part='turn'][data-role='agent']` is now `align-self: stretch; max-inline-size: none` — the
wrapper, the narration strip inside it, and the bubble all reach the same right edge the user bubble
is aligned to. **The USER turn is untouched:** `[data-part='turn'][data-role='user']` keeps
`align-self: flex-end` and the base 92% cap — a bubble that hugs its short text, right-aligned. Every
other clause-2 fact stands: the agent bubble's neutral container tone
(`--ui-conversation-agent-bubble`), its padding, the single padding layer around a `[bare]`
`ui-surface-host`, streaming/settled parity in ONE container, and the GH #313 `data-empty` hiding law.
Clauses 1 and 3 are not touched.

**Why (Kim's ruling on GH #1032).** `align-self: flex-start` sizes the wrapper to its content's
intrinsic width. Once GH #306 put `ui-status-stream`'s narration strip inside the wrapper, that
intrinsic width was the strip's own 16rem floor — so on any real column the "Agent activity … N steps
· Ns" header, the "Generating…" pending row, and the bubble shrank to ~16rem and hugged the left edge
with the rest of the column empty. Kim's 2026-08-16 ruling on #1032: **"use the full width."** The
92% cap was written in clause 2 for a bubble that sized itself to its text; on a wrapper that also
carries a fixed-floor strip it produced the opposite of the reference mockup's settled state, so the
cap is dropped for the agent role rather than re-tuned. The user turn never carried the strip and
never exhibited the defect, hence its cap is deliberately kept — this is a one-role change, not a
fleet-wide un-capping.

**Evidence.** PR [#1035](https://github.com/kimgranlund/agent-ui/pull/1035) — one CSS delta in
`packages/agent-ui/app/src/controls/conversation/conversation.css` (the agent-turn rule above, plus its
sheet-level comment), and THREE re-pinned browser assertions in
`packages/agent-ui/app/src/controls/conversation/conversation.browser.test.ts` (never deleted, flipped
from `toBeLessThan(availableColumnWidth(log) - 1)` to `toBeCloseTo(availableColumnWidth(log), …)`):
(1) the A2UI-surface probe — the agent bubble spans the full column; (2) the re-bubble chrome-law probe
— the turn wrapper, the bubble, AND the narration strip each span the full column, the label/strip
still sitting outside the bubble on the page background; (3) the streaming-parity probe — the mid-turn
(pre-`finalize()`) container is chromed and full-column, matching the settled state. `npm run
test:browser` green on the merge.

**Consequences.** Every `ui-conversation` composer (`a2ui-chat`, `a2ui-live`, `gen-ui-live`,
`agent-admin`) inherits the full-width agent turn automatically — a component-level rule, no page
override involved (a repo-wide grep for a page-level `[data-part='turn']` override found none). No
public API, token, or event changes; `conversation.md` carries no width-cap prose (grep-verified
2026-08-16), so no sibling doc repair is owed. The clause-2 sentence itself is left as ratified text —
this section, not an in-place edit, is the record that it no longer holds for the agent role.
