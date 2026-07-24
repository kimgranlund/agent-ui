# ADR-0159 — `ui-status-stream` adopts the receipt pattern: a live/done label-pair law for the closed stage table, plus two opt-in props (`oneline` — one morphing line while the turn runs; `receipt` — auto-collapse to a one-line receipt at a terminal state)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-23
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-23 |
> | **Proposed by** | build seat ([GH #238](https://github.com/kimgranlund/agent-ui/issues/238) + [GH #239](https://github.com/kimgranlund/agent-ui/issues/239) — waves A of Kim's 2026-07-23 receipt-pattern ruling, "all three slices"; the screenshot report behind #238 is the agent-admin chat activity. [GH #240](https://github.com/kimgranlund/agent-ui/issues/240), per-step source reveal, is wave B — deliberately NOT covered by this record) |
> | **Ratified by** | — |
> | **Repairs** | `packages/agent-ui/components/src/controls/status-stream/{status-stream.ts,status-stream.css,status-stream.md,status-stream.test.ts,status-stream.browser.test.ts,status-stream-descriptor.test.ts}` (the `oneline`/`receipt` props, the `collapsed` custom state, the `header-meta`/`header-caret` parts, `formatTotalElapsed`) · `packages/agent-ui/app/src/controls/conversation/{conversation.ts,conversation.md,conversation.test.ts}` (the live/done label-pair tables + the `receipt` pass-through prop) · `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` (the admin chat's opt-in) · `site/pages/a2ui-chat.test.ts` (done-form label expectations) |
> | **Supersedes / Superseded by** | Extends [ADR-0146](./0146-live-turn-lifecycle-progress-channel.md) (the F1 closed stage vocabulary, the F2 honesty-law guard, and the F8 header this pattern renders through — all stand unchanged) and [ADR-0153](./0153-status-stream-elapsed-timer-retry-action-planned-glyph.md) (the Fork 1 shared ticking interval + `formatElapsed`, which the one-line turn clock rides — never a second clock). Relates [ADR-0122](./0122-timeline-family-and-live-status-stream.md) (the family charter's role=log announcement discipline is the mechanism that keeps label transitions from double-firing). |
>
> **Amendment (2026-07-23, wave-B realization, append-only — the proposed Decision above is UNCHANGED):
> the third slice of Kim's ruling — the per-step source reveal ([GH #240](https://github.com/kimgranlund/agent-ui/issues/240)),
> which this record's own Consequences deferred as "a later wave" — is now BUILT, on the disclosure
> precedent this record set.** The realized mechanism, recorded here so the three slices read as one
> pattern: the producer attaches the raw A2UI JSONL behind a stage as `TurnProgress.source`
> (`meta-line.ts`/`produce.ts` — on `validating`, this round's candidate lines entering heal/validate;
> on `retry`, the PRIOR round's failed candidate, data that otherwise never crosses the wire), gated
> behind a NEW `progressDetail:'source'` member — a SIBLING of ADR-0146 F3's `'full'`, not a rung above
> it (raw reasoning and raw wire lines stay independent opt-ins; the default `'stages'` carries neither
> — fail-closed), capped at `SOURCE_ATTACHMENT_CAP` (16 KB, the proxies' own `personaSystem`
> runaway-guard constant) with an explicit truncation marker. `ui-status-stream` renders a per-entry
> reveal from a new `StatusEntry.source`: a `[data-role="detail"]` child planted at appendEntry time,
> adopted by `ui-timeline-item`'s OWN anatomy into its shared composed `ui-disclosure` (ADR-0143 — one
> fold primitive, never a second; ADR-0113's native details/summary supplies collapsed-by-default,
> button semantics, and Enter/Space), summary-labelled "Source", content a mono `<pre>` rendering the
> attached text byte-for-byte (never parsed; `@agent-ui/code` highlighting is structurally unlawful in
> `components` — the DAG points the other way — so plain mono is the ruled v1). `ui-conversation` gains
> a reflected `sources` prop (default false, fail-closed BOTH ways: category entries attach their own
> ingested lines — "Opened a new surface" reveals its createSurface JSONL — and producer-attached
> progress sources pass through, ONLY when set; a source-carrying stream against a default consumer
> renders byte-identically). `ui-agent-admin` opts in (`conversation.sources = true` + the live runner's
> `progressDetail:'source'` request, membership-validated by both proxies — `'full'` stays
> server-owned); a2ui-chat and every demo stay default-off. The revealed block sits inside a CLOSED
> details body — outside the `role=log` announcement path, so raw JSON is never live-announced; the
> re-stamp is a same-node textContent mutation (this record's own §2 discipline).

## Context

Kim's 2026-07-23 screenshot report ([GH #238](https://github.com/kimgranlund/agent-ui/issues/238)):
the agent activity feed shows green done-checkmarks next to progressive labels ("Validating…",
"Opening a new surface…") — a done step wearing an in-progress label. And the whole strip stays
fully expanded forever ([GH #239](https://github.com/kimgranlund/agent-ui/issues/239)), where the
frontier pattern (claude.ai/ChatGPT) renders a running turn as ONE morphing line and collapses a
finished turn to a one-line receipt. Kim ruled (2026-07-23): adopt the frontier UX, in three
slices — this record covers the first two (labels + collapse); the third (per-step source reveal,
GH #240) is a later wave.

The stage vocabulary is ADR-0146 F1's closed, code-owned table
(`meta-line.ts`'s `TurnProgressStage` union at the wire; `conversation.ts`'s closed `Record` at the
render); the F2 honesty law guards it (an unobserved stage never renders). ADR-0153 already gave the
strip a per-entry ticking elapsed display (`startedAt` → one shared interval → `formatElapsed`) and
ADR-0146 F8 the opt-in pinned header. Every shipped consumer renders the strip always-expanded — any
new posture must be opt-in to keep them byte-identical.

## Decision

### 1 — The label-pair law (GH #238)

Every stage/category label in the closed tables becomes a **live/done pair** — the progressive
`live` form ("Validating…") while the step runs, a quiet past-tense `done` form ("Validated")
stamped **on the entry's status transition to done**. The pair table lives at the single owning
site the stage→label mapping already occupied: `conversation.ts`'s `LABEL` (categories) and
`PROGRESS_LABEL` (ADR-0146 stages) — the F2 closed-table guard keeps gating it unchanged (closed
`Record` over the closed union; an absent stage still renders nothing). Two laws ride the pair:

- a factual suffix (retry round ordinal, tool name) composes into **both** forms — "Self-correcting…
  (round 2)" settles to "Self-corrected (round 2)";
- a step that never finished (truncated by `finalize()`'s completion invariant, or under `fail()`)
  **keeps its live form** — the done form is never claimed for work not completed (the honesty law's
  past-tense face).

The authored pair table (the register is claude.ai's: quiet past-tense, no exclamation):

| key | live | done |
|---|---|---|
| `sent` | Request sent | Request sent *(already a completed fact — the forms coincide)* |
| `started` | Generating… | Generated |
| `reasoning` | Reasoning… | Reasoned |
| `content` | Writing the response… | Wrote the response |
| `validating` | Validating… | Validated |
| `retry` | Self-correcting… | Self-corrected |
| `tool` | Running an integration… | Ran an integration |
| `done` | Done | Done *(the settle signal itself — never rendered as its own row)* |
| `open` | Opening a new surface… | Opened a new surface |
| `restructure` | Updating the surface… | Updated the surface |
| `react` | Updating data… | Updated data |
| `close` | Closing the surface… | Closed the surface |

### 2 — The two opt-in props (GH #239)

`ui-status-stream` gains two reflected booleans, **both default `false`** — every existing consumer
keeps its always-expanded shape byte-identically (no new DOM, no interactive semantics, no state
writes) until it opts in:

- **`oneline`** — while un-settled, the strip renders as **one morphing line**: the header row shows
  the current step's live label + a ticking turn-elapsed display + a soft shimmer, and the entry
  list hides. The line is a **real disclosure** (`role="button"`, `tabindex="0"`, `aria-expanded`,
  Enter/Space) — expandable to the full step list mid-turn; a user's explicit expand is never
  auto-yanked shut.
- **`receipt`** — at a terminal state (`finalize()`/`fail()`) the strip **auto-collapses to a
  one-line receipt**: the static `label` + `"N steps · total-elapsed"` + the settled outcome glyph
  (the F8 header's own escalated status — `fail()`'s forced `error` stays loud). Click re-expands
  the intact trace. Without `receipt`, a settled `oneline` strip auto-**expands** instead.

Mechanics ruled with them: both modes **materialize the header row** (it IS the one line) even when
`header` is false, the `header` prop's own semantics unchanged; the collapse state is a `collapsed`
custom state (`:state(collapsed)` hides the entry list — the `:state(truncated)` precedent); the
turn clock **anchors at the first `appendEntry`** (the first observed work — never fabricated) and
rides ADR-0153's ONE shared interval; the receipt total renders through a new pure
`formatTotalElapsed` (one decimal under 10s — "3.2s" — delegating to `formatElapsed` above, one
display vocabulary). Announcement discipline, stated honestly: `role=log`'s DEFAULT `aria-relevant`
is `additions text`, so a textContent morph IS relevant in principle — the quietness bet this wave
makes is the fleet's **established role=log discipline** (the ADR-0122 charter's precedent; ADR-0153's
once-per-second ticking timestamps already shipped the same bet), and the **tested** discipline is
same-node mutation: a label morph/re-stamp never inserts a node (asserted by node identity), so a
label transition can never ride the additions channel twice. A live screen-reader spot-check is the
named follow-up (Consequences).

### 3 — The consumer wiring

`ui-conversation` gains a reflected boolean **`receipt`** (default `false`): when set, each
per-turn narration strip gets BOTH stream-level opt-ins. `ui-agent-admin` — the surface Kim's
screenshot came from — sets it (`conversation.receipt = true`). Every other composer of
`ui-status-stream`/`ui-conversation` (a2ui-chat, a2ui-live, chat-shell, the doc/demo pages) stays
default-off, byte-identical.

## Consequences

- A done checkmark never again reads "-ing…" — and, symmetrically, a truncated step can never read
  as finished; the honesty law now has a tense dimension.
- The strip's public surface grows: 2 props, 2 header parts (`header-meta`, `header-caret`), 1
  custom state (`collapsed`), 1 exported pure function (`formatTotalElapsed`). No new event — the
  disclosure toggle deliberately emits nothing (the SPEC-R12 no-synthetic-event law holds; a
  consumer needing open-state can read `aria-expanded`).
- The header row becomes interactive **only** in the opt-in modes — a plain `header` consumer's row
  carries no role/tabindex, asserted as a negative control cross-engine.
- Consumers asserting settled label text (a2ui-chat's narration-honesty gate) now assert the done
  forms; the KNOWN_LABELS closed set carries both forms of each pair.
- **Named follow-up:** a live screen-reader spot-check (VoiceOver/NVDA) of the morphing line and the
  done-label re-stamps under `role=log` — the same-node-mutation discipline is tested mechanically,
  but actual SR quietness across engine/AT pairs is a bet inherited from ADR-0153's ticking
  timestamps, not something this wave has observed live.
- GH #240 (wave B — per-step source reveal) builds on this collapse mechanism later; nothing in
  this record forecloses it.

## Alternatives considered

- **Done labels applied inside the component (a `StatusEntry.doneLabel` field)** — rejected: the
  stage→label vocabulary is consumer-owned (ADR-0146 F2 put the closed table in `conversation.ts`);
  splitting the pair across the package boundary would create two owning sites for one law. The
  component already re-stamps a label on `update()` — the pair rides the existing seam.
- **One combined prop instead of two** — rejected: the live posture and the terminal posture are
  independently useful (a surface may want the always-expanded live trace but a tidy receipt, or
  the one-line live mode with a fully-expanded terminal trace); two orthogonal opt-ins compose all
  four shapes, and `ui-conversation`'s own `receipt` prop is the one-switch convenience layer.
- **Reusing `ui-disclosure` for the collapse** — rejected: the strip's entries are direct children
  of its own scroll region (the one-owned-scroll-region law, SPEC-R10); re-parenting them into a
  disclosure's body would restructure every consumer's DOM and break the appendEntry/tail-follow
  mechanics for a fold the header row + one custom state express with zero re-parenting.
- **A second interval for the turn clock** — rejected: ADR-0153 fixed ONE shared per-host interval;
  the line clock is one more repaint inside the same tick.
- **`aria-live` wiring for the morphing line** — rejected: bespoke live-region attributes are
  exactly what the ADR-0122 family charter forbids; the wave stays on the fleet's one established
  `role=log` discipline (same-node mutation, no insertions) rather than adding a second,
  contradictory announcement path.
