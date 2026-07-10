---
doc-type: ticket
id: tkt-0010
status: open
date: 2026-07-10
owner:
kind: feature
size: big
---
# TKT-0010 — `ui-timeline`: an event-sequence display family

## Summary
Kim's ask (2026-07-10): a `ui-timeline` component — learn from
`https://ui-kit.exe.xyz/site/components/timeline` and
`/Users/kimba/Projects/adia/gen-ui-kit/packages/web-components/components/timeline/` (exists,
verified — a TWO-tag family: timeline + timeline-item, incl. a test file), and "we will need
to support `size=\"...\"` patterns, etc" — i.e. the fleet's geometry axes apply as first-class
contract, not decoration. Dedup: **greenfield** — no timeline element, ADR, or PRD row exists;
the one repo mention is TKT-0004's prose about the a2a feed page's hand-rolled
`.feed-timeline` CSS chrome (`site/pages/a2a-artifact-feed.ts`) — which, like toolbar's
`document-row-toolbar` seed, is standing evidence a real primitive is missing: the fleet's own
flagship demo hand-builds this shape today.

## Research inputs (for the design intake, recorded verbatim)
- The exe.xyz timeline docs page (fetch at intake — capabilities/props read there, never from
  memory).
- The adia timeline family: `timeline.class.js` + `timeline-item.yaml` for the item contract,
  `timeline.css` for the marker/connector/gutter geometry, `timeline.test.js` for the proven
  behaviors; promote to this fleet's laws, never port.

## Acceptance
- A design intake via `agent-ui-component-design` resolves the forks before any build:
  - **Geometry under `[size]`/`[scale]`** — Kim's explicit requirement: the marker (dot/icon),
    connector, and gutter quantities join the fleet's explicit per-`[scale]` lookup dialect
    (no multipliers — the ADR-0038 law); size-class assignment likely Pattern/Display (the
    novelty leg fires if no row fits the marker+connector shape).
  - **The family shape** — `ui-timeline-item` as a sub-tag (the prior art's model; the
    radio-group/toast-region precedent) with position slots × roles per item (marker ·
    timestamp · content · trailing) per the anatomy dialect.
  - **Marker semantics** — state markers (done/current/pending/error) need non-color
    signifiers (ADR-0057) and honest ARIA (a timeline is a list structure to AT — role
    semantics via internals, the list/description-list question argued).
  - **Orientation** — vertical default; whether horizontal ships v1 or fences with a trigger.
  - **Catalog posture** — STRONG emittable candidate (agent activity chronologies are core
    Gen-UI content; the feed page's hand-rolled chrome is the demand evidence) — argue under
    the ADR-0087 gate; a catalog row likely lands with the build.
  - Content model per item (rich content slots — the ui-swiper-item "almost any contents"
    parallel); density participation; events (a timeline is display-first — probably NO
    events; an interactive-item variant is a fork to fence).
- The shipped family meets the full per-control bar (descriptors, jsdom + cross-engine
  browser probes incl. whole-shape + the connector/marker geometry under `[scale]`,
  independent review, barrels/exports/size, doc + demo pages).
- Follow-up candidate recorded (NOT scope): repointing the a2a feed page's hand-rolled
  `.feed-timeline` chrome onto the shipped element (the theme-provider promotion pattern).

## Links
- The two research inputs above.
- `site/pages/a2a-artifact-feed.ts` — the hand-rolled timeline chrome (gap evidence + the
  eventual dogfood consumer).
- `.claude/skills/agent-ui-component-design/` — the intake procedure.
- ADR-0038 (geometry lookup law) · ADR-0057 (non-color signifiers for marker states) ·
  ADR-0112 (multi-tag family + feed-family adjacency — timeline complements, does not join,
  that family's v1 scope) · ADR-0087 (catalog posture).

## Scope / Open
- **Open:** marker state vocabulary (done/current/pending/error vs a freer content-slot
  marker); timestamp formatting (the value-codec question — likely the consumer's string,
  not a codec); whether items can be appended live (the feed's streaming case — reactive
  children handling, the list/repeat seam) vs static-first v1.
- **Non-goal:** porting either prior art's full API; data-driven item generation (items are
  authored children — the A2UI list template covers data-driven at the catalog layer).
- **Sequencing:** design intake first; no build from this ticket directly. Queue position:
  third behind TKT-0008 (swiper) and TKT-0009 (toolbar), Kim's call on order.

## Findings

- **2026-07-10 — combined design intake COMPLETE (docs only, no code).** Run jointly with TKT-0013
  (`ui-status-stream`) as ONE intake, because the posture fork resolves to a shared family. Records:
  [ADR-0122](../adr/0122-timeline-family-and-live-status-stream.md) (proposed, forks F1–F6 recommended) ·
  [`../spec/timeline-family.spec.md`](../spec/timeline-family.spec.md) ·
  [`../lld/timeline-family.lld.md`](../lld/timeline-family.lld.md) ·
  [`../decompositions/timeline-family-ship.decomp.json`](../decompositions/timeline-family-ship.decomp.json)
  (coverage_check `--strict` clean, exit 0). ADR README row added.
- **The posture fork (F1) — RESOLVED: a THREE-tag family, not one control, not two.** `ui-timeline`
  (durable, `role=list`, authored children) + `ui-status-stream` (live, `role=log`, imperative-fed) share ONE
  inert atom `ui-timeline-item` (marker + connector + content + `status` signifiers + the collapsible detail)
  but diverge on five mechanical axes (data ingress · completion · scroll · ARIA role · motion). The
  `role=list`↔`role=log` split is a contract a `live` boolean cannot honestly carry; the `ui-toast`/
  `ui-toast-region` dumb-item+liveness-host pair is the exact precedent. So this ticket owns `ui-timeline` +
  `ui-timeline-item`; TKT-0013 owns `ui-status-stream` (reusing the item). ONE record set, both tickets.
- **This ticket's forks settled:** geometry (F2) — the marker/connector/gutter join a NEW explicit
  per-`(scale × size)` `--ui-timeline-*` table with a FIRST-CLASS `size` prop (Kim's directive; the novelty leg
  fired, ADR-0048 precedent, NO multiplier per ADR-0038); marker states (F3) — `status`=`''/pending/active/
  done/error`, each a distinct non-color SHAPE (ADR-0057), reconciling the adia code↔yaml drift; orientation
  (F6) — vertical only v1 (horizontal fenced); catalog (F5) — `Timeline`+`TimelineItem` EMITTABLE; events —
  `events:[]` + the item's `ui-disclosure`-reused detail emits `toggle` (the adia `timeline-toggle` custom name
  dropped); timestamp is the consumer's string (no codec); items are authored children (no `data` array prop).
- **Follow-up recorded (NOT scope):** repoint the `a2a-artifact-feed` page's hand-rolled `.feed-timeline`
  chrome onto the shipped `ui-status-stream` (the ADR-0117/0121 dogfood-promotion pattern).
