---
id: T-0086
title: "Rename the A2UI catalog page's Pattern tier to Compound"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The A2UI catalog page and site call the compound-container tier 'Compound' instead of 'Pattern', so 'pattern' only means a composed widget a persona fragment adds.

## Intent
- Do: rename the tier label and every user-visible mention of the Pattern tier on the catalog page and docs (TIER_LABEL in site/lib/a2ui-catalog-tiers.ts, the tab and header text in site/pages/a2ui-catalog.ts, the catalog tiers comments, any test expecting the label); keep the internal key stable if renaming it would churn generated files, but prefer renaming the key to COMPOUND if it is a local type with no generated dependents.
- Non-goals: moving types between tiers; the persona fragment 'pattern' vocabulary stays.
- Done when: the page tab reads Compound with the same members, the tier tests pass, npm run check plus the touched site tests exit 0 (CI runs the full suite).

## Context
Kim ruled 2026-10-12: components are raw materials in the shared agent-ui catalog; patterns are composites a persona fragment adds. The site's 'Pattern' tier (Menu, Tabs, Toolbar, Tooltip, Swiper, SplitPane, Drill, ProductCard, BoardGrid, GameHud and others) collides with that word. Files: site/lib/a2ui-catalog-tiers.ts, site/lib/a2ui-catalog-tiers.test.ts, site/pages/a2ui-catalog.ts and its tests, docs that name the tier (git grep -n "Pattern tier\|'PATTERN'" site .claude/docs .claude/skills). Do not edit accepted ADR prose; add nothing to ADRs. Local gate: npm run check plus the touched site tests; CI runs the full suite. No em dashes.

## Constraints
Tier membership, the type-to-tier table, and wire behaviour do not change.

## Closed

2026-10-12: Merged in #1907; mechanical rename
