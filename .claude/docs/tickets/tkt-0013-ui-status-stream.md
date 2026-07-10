---
doc-type: ticket
id: tkt-0013
status: open
date: 2026-07-10
owner:
kind: feature
size: big
---
# TKT-0013 — `ui-status-stream`: the live "what the system is doing now" surface

## Summary
Kim's ask (2026-07-10): a way to display **in real time** what the system is working on —
the example: an `a2ui-chat` surface showing the agent's chain of thought / reasoning /
actions / tool-use **as it is occurring**. (`a2ui-chat` resolves to nothing in the repo —
it is a future surface named as context, recorded as such, not a dependency.) Dedup: no
status-stream component exists, but this lands INSIDE recorded territory, not beside it:
the **feed-family PRD** (`prd/feed-family.prd.md`) explicitly owns the "activity
vocabulary — what agent work *looks like* while and after it happens" (its v1/ADR-0112
shipped `ui-progress · ui-avatar · ui-attachment · ui-toast`). This ticket records the
DELTA: the live, streaming, in-progress display member that family doesn't yet have — and
links rather than duplicates (the PRD stays the why-owner; the intake decides whether this
amends feed-family or earns a sibling record).

## The distinction triangle (the record's core, so three surfaces don't blur)
- **`ui-status-stream` (this)** — the EPHEMERAL live strip: entries appear as work starts
  (thinking · tool X running · action Y), transition state (running → done/error), and
  collapse/summarize as they resolve; the "now" surface with a tail-follow posture.
- **`ui-timeline` (TKT-0010, queued)** — the DURABLE chronology display: authored events,
  read-back posture. The sharpest intake fork: is status-stream its own control, or
  ui-timeline's LIVE posture (one family, two postures — the toolbar dual-posture
  parallel)? Argue it; do not let two overlapping components ship.
- **The a2a artifact feed** — the message/artifact conversation timeline (turns), already
  live-streaming (B7/ADR-0116); status-stream is finer-grained (WITHIN a turn's work), and
  its real in-repo feed source today is exactly that arc's NDJSON streams.

## Research inputs
- No external prior art given (unlike TKT-0008..0012) — the intake's references are
  in-repo: the B7 live arcs (`site/lib/{arena-live-transport,feed-live-transport}.ts`,
  `ndjson-lines.ts`, the part-frame/completion-invariant discipline), the feed-family PRD +
  ADR-0112, and A2A's task-status vocabulary (`@agent-ui/a2a` wire types — TaskStatusUpdate
  -shaped events are the natural upstream; verify the actual type names at intake, never
  from memory).
- Market shape worth one survey pass at intake: the "agent activity" idioms current AI
  chat products use (collapsible thinking sections, tool-call chips with running/done
  states) — as UX vocabulary, not API to port.

## Acceptance
- A design intake via `agent-ui-component-design` resolves the forks before any build:
  - **The timeline fork above** (own control vs ui-timeline's live posture) — resolved
    FIRST; it decides whether TKT-0010 and this are one intake or two.
  - **The data contract** — entries arrive by IMPERATIVE APPEND (the consumer pushes
    entry elements/records as its stream yields) vs a bound reactive list; entry states
    (pending/running/done/error) with ADR-0057 non-color signifiers; the completion
    invariant (a stream that ends without resolving entries must be SHOWABLE as truncated
    — the B7 tracked-completion doctrine applies to display too).
  - **Live UX** — tail-follow scrolling (the TKT-0004 revealScroll lesson + the one-owned-
    scroll-region law), collapse/expand of resolved entries (ui-disclosure reuse row),
    reduced-motion behavior for streaming animations, and streaming TEXT within an entry
    (chain-of-thought tokens — the a2ui validate-then-stream posture: what does v1
    genuinely support vs fence).
  - **A11y** — a live region done right: `aria-live` politeness levels for entry
    transitions (announce state changes, never token-by-token spam), internals-ARIA.
  - **Catalog posture** — plausibly EMITTABLE (an agent narrating its own work inside a
    Gen-UI surface is coherent) but also shell-chrome-flavored; argue under ADR-0087 with
    the feed-family's dispositions (ADR-0097) as the precedent frame.
  - Geometry/density under the `[scale]` dialect; events (display-first — likely none or
    `toggle` for collapse; an interactive "cancel this action" affordance is a fork to
    fence).
- The shipped surface meets the full per-control bar, incl. a REAL streamed proof (feed it
  a live NDJSON source in a browser test — the arena stream is right there) and the
  whole-shape + tail-follow behavior cross-engine.
- Follow-up candidate recorded (NOT scope): the a2a pages narrating their own live matches
  through it (dogfood), and the eventual a2ui-chat surface consuming it.

## Links
- `prd/feed-family.prd.md` + ADR-0112 — the owning family record this extends (link,
  don't duplicate).
- TKT-0010 (`ui-timeline`) — the fork counterpart; one of these intakes may absorb the
  other.
- ADR-0116 + `site/lib/arena-live-transport.ts` / `feed-live-transport.ts` /
  `ndjson-lines.ts` — the live-stream discipline + the real in-repo feed sources.
- ADR-0057 (state signifiers) · ADR-0087/0097 (catalog posture + feed dispositions) ·
  TKT-0004 (tail-scroll lesson).
- `.claude/skills/agent-ui-component-design/` — the intake procedure.

## Scope / Open
- **Open:** the timeline fork (the big one); nesting (a tool-use entry containing
  sub-steps — flat v1 vs one nesting level); persistence hand-off (when the live strip
  resolves, does its history convert into timeline/feed content, or scroll away?);
  entry identity for streamed updates (keyed updates to an existing entry vs
  append-only).
- **Non-goal:** owning the TRANSPORT (the consumer feeds it — ndjson-lines et al. stay
  where they are); interpreting model output (entries are structured records the
  consumer/protocol provides, never parsed prose); a chat surface itself (a2ui-chat is a
  future consumer, not this component).
- **Sequencing:** design intake first; the TIMELINE FORK makes this and TKT-0010
  candidates for a SINGLE combined intake — flag to Kim when ordering the queue.

## Findings
