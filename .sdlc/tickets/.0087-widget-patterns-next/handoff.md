---
id: T-0087
title: "Design spike: the next shared widget patterns (result card, availability picker, and the rest of the review gaps)"
type: spike           # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Question
Which shared widget patterns and components should the A2UI kit build next, and in what order, using the ADR-0243 admission test (a widget earns a type only when its hand composition is large and re-minted)? Candidates from .sdlc/preset-review-2026-10-12.md and the deferred set in .sdlc/tickets/.0065-preset-widgets-design/design.md: a result or summary card with a restart action (five games dead-end on win, lose, restart; the Negotiator's deal summary), AvailabilityPicker (date, room or time slot for Concierge and Restaurant), a templated board and guess-row pattern with a semantic check (Admiral, Lexicographer), a comparison table recipe, a stat or KPI group, PlanChecklist (Builder), ContrastPair and a swatch surface (Stylist), a collection carousel with detail (Curator), MediaGallery, and a seeded shuffle and dice tool.

## Goal
A ranked, evidenced recommendation written back into this file: for each candidate, component (a shared control in the agent-ui catalog) or pattern (a composite in a persona fragment) or recipe/tool only, the admission-test verdict, the fork-sheet answers a build ticket needs, size and dependencies, and which two to build first. Then draft ADR-0244 (proposed, append-only rules) and file the build tickets for the first two as blocked-on-ratification children, in the shape ADR-0243's T-0067 to T-0075 campaign used.

## Context
Kim's taxonomy ruling 2026-10-12: components = raw materials in the shared agent-ui catalog (anyone can use); patterns = composites a persona fragment adds. Merged precedents: ADR-0243 (ProductCard, BoardGrid, GameHud as components; CardTable, QuestionCard as fragment composites), T-0082/T-0083/T-0084 style and gutter fixes. Approved visual language: the widget mockups in /private/tmp/claude-501/local-artifact/mockups.html and /private/tmp/claude-501/widgets-artifact/own.css; ADR-0046 container box model (6px inset, 12/6 region padding, 8px gap); buttons at the lg step (36px); no border-left highlights. Use the repo's seat-map, component-design (fork sheet) and a2ui-multi-catalog skills.

## Constraints
No production code lands from this spike; the ADR draft and ticket files are its outputs. Cap the written recommendation at about 150 lines. No em dashes.

## Closed

2026-10-12: merged #1909, ADR-0244 ratified #1911
