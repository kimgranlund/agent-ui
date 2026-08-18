# IDR-0004 — The widget vocabulary reaches ecosystem parity, composition-first

> | | |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-17 |
> | **Author** | product seat (fleet-bootstrap Phase 2) |
> | **Ratified by** | Kim — 2026-08-17, fleet-bootstrap Phase-3 hard gate (AskUserQuestion ratify round) (Kim only; vocabulary `proposed · accepted · superseded`; an accepted IDR body is append-only) |
> | **Tier** | IDR — intent decision (WHY/WHAT); realized by catalog rows, corpus seeds, component ADRs |
> | **Realized by** | [req-a2ui-library](../research/req-a2ui-library.md) R1–R6 · `ui-image`/`Image` (the gate-opener) · seeds packs A/B · later-tier chart ADRs (each its own future ruling) |

## Intent

Agents built here can express the widget vocabulary the generative-UI ecosystem treats as table
stakes — slideshows, confirmations, itineraries, weather, menus, trend lists, wizards — so a
produced agent never looks poorer than a Vercel/Thesys/A2UI-standard demo. The vocabulary grows
by **payload patterns over existing types**, not by catalog sprawl.

## Decision

1. **Composition-first.** Eight of the candidate widgets are corpus seeds + grammar/skill
   patterns over the shipped catalog — zero new container types. New types are minted only when
   composition is provably impossible.
2. **Image is the one new media primitive now.** `ui-image` + the `Image` catalog row (A2UI
   standard-catalog parity) unblocks every full-bleed candidate; Video/AudioPlayer wait until
   Image proves the media seam.
3. **Honest analytics floor.** v1 charts = the existing zero-dep Sparkline/BarChart/Stat, hand
   rolled; axes/pie/tooltip engines are later-tier, each its own ADR; no charting dependency,
   ever.
4. **Semantics honesty rides along** (Kim rulings, 2026-08-17): outcomes are toasts not badges;
   glyphs never impersonate affordances; labels never wrap; library rows must let a user choose
   without insider knowledge. Parity means *well-made*, not merely present.

## Falsifiers

- If seed-taught compositions keep failing the producer's compose→validate loop where a
  dedicated type would trivially succeed, the composition-first default (clause 1) is what gets
  revised here.
- If Image's full-bleed/scrim craft cannot pass the WCAG fixture across themes, the "parity
  without sprawl" bar returns here before any per-widget CSS workaround.

## Ratification question

Accept "parity composition-first; Image the sole new media primitive; zero-dep analytics floor"
as product intent for the widget lane?
