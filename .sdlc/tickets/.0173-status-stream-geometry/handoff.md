---
id: T-0173
title: "ui-status-stream and its parts derive alignment, gaps and rail from n (one geometry grid)"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-14: "the ui-status-stream and its constituent parts don't seem to follow a geometry system that would make alignment, gaps, etc more reliable and consistent." Every part of ui-status-stream (the agent-activity strip in the chat: header row with state mark, label and "Done in 39s"; step rows with marker, label, duration; the rail; nested Details disclosures; detail text; raw output block and Copy) sits on one grid derived from n, so alignment and gaps hold at every tier and scale.

## Intent
- Do:
  1. Audit first: measure the current parts in a real browser at product / md (the chat) and widget / md (canvas), list every literal or hand-picked offset in `packages/agent-ui/components/src/controls/status-stream/status-stream.css` (440 lines) and anything the app's conversation styles add, with the misalignments (marker vs label baseline, rail vs marker centre, Details indent vs label start, detail text indent, raw block left edge, duration column).
  2. Define the grid once, from the foundations (h = 4n, c = ceil(n/4), glyph box max(8px, 2n-2c), icon 2n inside a control or tier region): a marker column of the glyph or icon box, a column gap of n, a label column; every nested block (Details summary, detail text, raw output) starts at the label column; the rail is centred on the marker column; row rhythm from h or the type line; the duration and the header's "Done in" share one trailing column with tabular numerals. Write it as named custom properties in the control's CSS and a short geometry section in `status-stream.md`.
  3. Rebuild the CSS on that grid; remove one-off offsets. Status marks are glyphs (icon vs glyph ruling).
  4. Tests: a browser test (both engines) that asserts the alignment invariants by measurement (marker centre = rail centre; label, Details, detail text and raw block share a left edge; duration right edges equal; gaps equal n) at two registers; re-mint the visual goldens after viewing.
  5. Evidence for Kim: before and after screenshots of the activity strip expanded (like her 2026-10-14 Concierge screenshot) in the chat.
- Non-goals: content or copy changes, the producer bugs (T-0172).
- Done when: `npm run check` exit 0; foundations census gate clean (no px geometry); status-stream tests and the conversation browser tests exit 0 in chromium and webkit; render lint exit 0; before and after screenshots saved in the ticket folder and viewed.

## Context
- Commit on `chore/status-stream-geometry` off origin/main, never push. Heavy tests via `gate_lock.py run`, foreground; report after the audit with the measured list before rebuilding.

## Constraints
- No literal px geometry; derive from the ramp. No em dashes.

## Acceptance criteria
- `npm run check` exits 0.
- `node scripts/foundations-census.mjs --gate` exits 0 (no px geometry in the changed sheets).
- `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/status-stream packages/agent-ui/components/src/controls/timeline packages/agent-ui/components/src/controls/timeline-item packages/agent-ui/app/src/controls/conversation` exits 0 in chromium and webkit, including the T-0173 describe in `conversation.browser.test.ts` (marker centre = rail centre = header marker centre; label, Details summary, detail text, raw block and Copy share the label column; durations end on the header meta edge; inline edge and marker-to-label equal n, step to step 2n; at the root register read from `ROOT_REGISTER` and at widget / md) and the timeline-item gutter and row gap at 2n.
- Kim's 2026-10-14 rulings: row gap 2n; status marks stay 2n icons; the conversation sets no `size` on the strip and no rem font pin (type from `--md-sys-type-body`).
- `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts` exits 0.
- `npx vitest run packages/agent-ui/components/src/controls/status-stream packages/agent-ui/components/src/controls/timeline packages/agent-ui/components/src/controls/timeline-item packages/agent-ui/components/src/controls/family-coherence.test.ts packages/agent-ui/app/src/controls/conversation` exits 0.
- Before and after screenshots exist in `.sdlc/0173-status-stream-geometry/` (`before-*.png`, `after-*.png`).

## Closed

2026-10-14: merged (queue)
