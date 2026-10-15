# Agent preset review, 2026-10-12

Read-only review of the 15 presets in `site/pages/agent-admin-presets.ts`, by four sub-agents. Widget tiers (ProductCard, MediaGallery, GameHud, BoardGrid, Itinerary, AvailabilityPicker, QuestionCard, CharacterSheet, CardTable, SwatchPalette, ExhibitCard, CommitmentLedger) belong to T-0065 and are only pointed at here. Sizes S/M/L. [U] = not backed by a file read.

## Cross-preset themes
1. Missing data: most presets invent facts (no resources, no tools). Knowledge entries beat components for nine of them.
2. No random source: Croupier shuffle and Dungeon Master dice are prose.
3. No end state: Mentalist, Dungeon Master, Quizmaster, Negotiator and Admiral dead-end on win, lose, restart.
4. Repeated structure is hand-composed. Only Croupier has a templated hand and a semantic check.
5. The prompt stack contradicts the catalog in three places (Quant, Concierge gallery, Travel).
6. No preset except Croupier has a recorded fixture of its own surfaces.

## Top 3 per preset
| Preset | 1 | 2 | 3 |
|---|---|---|---|
| concierge | BookingForm field kinds (dateRange, number, text) M | fix stale gallery-swiper text S | booking-scenes pattern M |
| restaurant | vela-menu-and-cellar resource S | seating-pick recipe S | fully-booked-fallback recipe S |
| travel | trip-accumulator data-model pattern M | leg-compare-table recipe S | enable wikipedia-search S |
| admiral | templated-board pattern M | board semantic check M | fleet-ledger recipe S |
| lexicographer | tile-legend recipe S | templated-guess-rows pattern M | answer and valid word lists S/M |
| alchemist | colorBand function (oklch distance) M | duel-reveal recipe S | round-history pattern S |
| mentalist | guess-reveal-branch pattern S | answer-log pattern S | twenty-hud recipe S |
| croupier | table-result-line recipe plus check M | round-loop-fresh-surface pattern S | expose PlayingCard.size S |
| quizmaster | quiz-round-feedback recipe M | run-progress plus grand-reveal-restart S | quiz-categories resource S |
| negotiator | deal-closed-summary recipe S | bazaar-goods resource M | counter-offer-loop pattern S |
| dungeon-master | undervault-rooms resource M | game-over-state recipe M | branching-choice pattern S |
| quant | rewrite dashboard-kpi-grid mini-skill S | metrics dataset or tool M | Drill drilldown pattern M |
| curator | collection-carousel mini-skill S | collection dataset M | swiper-detail pattern M |
| stylist | token-surface mini-skill S | ContrastPair component M | design-token set as data M |
| builder | PlanChecklist component M | roster-confirm recipe M | team-review surface M |

## Contradictions to fix first (each S)
- Quant: `mini-skills/dashboard-kpi-grid.md:6` says charts and sparklines are not hosted; the catalog has BarChart, ColumnChart, LineChart, PieChart, Gauge, Sparkline, Stat. (`genui-packs/data-viz-layouts.md:9` was also reported but only says no charting library exists in the genui sandbox; not a contradiction. Conductor check 2026-10-12.)
- Concierge: `gallery-swiper` (libraries.ts:110) says no Image type; Image is at catalog.json:790.
- Travel: `trip-plan` teaches Cards in a Row where `comparison-table` applies.
- Games pack: NOT a contradiction (conductor check). CORE `round-loop` and Dungeon Master `quest-log` both say one persistent surface; Croupier's per-round override is deliberate (T-0002).

## Wire gaps
- Grid has no column count (Admiral, Lexicographer boards).
- PlayingCard wire has no size (control has it, playing-card.ts:50).
- BookingForm field kinds are dateSingle, select, checkbox only (factories.ts:45-49).
- Spanish 21 (48-card deck) cannot be expressed by the PlayingCard rank enum.

## Shared building blocks worth doing once
- Seeded shuffle and dice tool (Croupier, Dungeon Master).
- Templated board / guess-row / log pattern with a semantic check (Admiral, Lexicographer, Quizmaster, Dungeon Master).
- End-state recipe family: win, lose, restart (five games).
- Recorded fixture per preset (14 missing).

## Open [U]
- Whether a Button `action.context` accepts relative data paths in a template (templated board).
- colorBand as a client-only function on the wire contract.
- Value of question-strategy and dice-roll display ideas.
