---
id: T-0022
title: "Activity strip polish: connector, circled icons, expandable steps, contained nested panels, clearer copy"
type: feature
status: done
size: M
priority: P2
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
Polish the agent activity strip (agent-admin Test Chat) from Kim's screenshot review of 2026-10-07: clearer step copy, a continuous timeline, circled status icons, every step expandable, and contained, well-spaced nested panels. Worktree `.claude/worktrees/wave-strip-polish`, branch `feat/activity-strip-polish` (conductor creates both).

## Intent
- Do 1, timeline: the connector line stretches and connects vertically through every row, including multi-line rows; icons align on one column.
- Do 2, icons: use the contained, circled variants (check, warning, repaired, running, error) for step status. A repaired validate step gets a distinct warning-toned glyph, never a spinner-style icon once finished.
- Do 3, expandable steps: each step row expands for review (details/summary or the existing disclosure pattern; button, aria-expanded via ElementInternals rules). Expanded content per step: Validated shows the failure codes and a plain-words repair line; Updated the surface shows the surface id and component list; Updated data shows the key names; Reasoned shows the #1844 panel, or "No reasoning captured" when there is no text. Steps with nothing to show stay non-expandable.
- Do 4, nested panels: fix the spacing between nested accordions and the Raw output disclosure; restyle scrollbars (thin, token-colored, no nested double scrollbar); contain the JSON/raw output in a bordered, padded code surface with horizontal scroll (no mid-token wrapping), a copy button, and the monospace token.
- Do 5, copy and header: say what PARSE means in plain words ("Model output did not parse, retried"); merge or rename the overlapping Generated and Wrote the response steps; hide durations under 0.1s; tabular numerals on times; header carries the warning icon only on failure and groups the stats; footer splits the model onto its own muted line; the closed strip after a finished turn shows a one-line summary ("Done in 13s, 1 retry"); drop the redundant "AGENT" label if the card header already says it.
- Non-goals: new reasoning capture (done in #1844); persona behavior; new ADR unless the neutral ActivityStep contract changes (then amend ADR-0159 with a note, never self-ratify).
- Done when: `npm run check` and full `npm test` exit 0; `test:browser` for touched browser tests exits 0; each Do has a red-then-green test (jsdom or browser as fits); registry, sitemap and descriptors regenerated as needed; no em dashes; stale records repaired in the same change.

## Context
Strip code: `site/lib/a2ui-activity.ts`, `packages/agent-ui/app/src/controls/conversation/activity-step.ts` and `conversation.ts`, plus the descriptors beside them. Recent work: #1839 (retry marker, header badge), #1844 (reasoning panel, ADR-0240), ADR-0159 amendment (neutral ActivityStep), ADR-0233 (per-control entries, no barrels). Use existing tokens for scrollbar, border and spacing; check for a shared scrollbar style before adding one. Never hand-edit generated files. Judge gates by exit code.

## Constraints
Imports point inward only. Keep the ActivityStep model neutral (no Croupier specifics). Light DOM, ARIA via ElementInternals, no native form elements beyond the descriptor-documented `<button data-part>`. Commit locally in the worktree; no push or PR without the user's approval.

## Acceptance criteria
1. The connector is continuous top to bottom across all rows; icons are circled variants; a repaired step is visibly distinct from running.
2. Every step with detail expands and collapses; Validated shows codes and plain-words repair; Reasoned with no text says so.
3. Nested panels have consistent spacing, styled scrollbars, and the raw output sits in a contained code surface with copy and horizontal scroll.
4. Copy and header changes above are in place; durations under 0.1s are hidden; the closed strip shows a one-line summary.
5. Red-then-green tests for each Do; gates green.

## Closed

2026-10-07: Merged in #1845
