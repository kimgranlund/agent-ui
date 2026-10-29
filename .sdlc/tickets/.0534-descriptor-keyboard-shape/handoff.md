---
id: T-0534
title: "Descriptor keyboard rows share one shape and placeholder part names are real"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: [T-0533]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Every descriptor's `keyboard:` rows use one shape, and placeholder part names in descriptors name real parts, so a later keyboard gate can parse them.

## Intent
- Do: the Low findings below; pick the most common existing keyboard row shape and convert the others; replace placeholder part names with the names the code uses; fix the minor drifts listed.
- Non-goals: adding the keyboard gate itself (report what it would need).
- Done when: a scripted parse of every `keyboard:` block succeeds with one shape (the script in the report); `validateComponentDescriptor` still passes for every descriptor; `npm run check` exits 0.

## Context
From the T-0531 descriptor contract sweep (#2333):

### Low

Proposed ticket: "Descriptor hygiene: one keyboard row shape so a keyboard gate can exist, real part names in place of placeholders, and the minor drifts below"

1. Keyboard blocks use four row shapes, so no `keyboard:` gate can be written. Row keys across descriptors: `keys` (19), `keys` + `note` (19), `note` only (17), `key` (4: calendar, color-picker, split, super-shell); the value field is `action` in some and `description` in others; keys sit inside free text (`ArrowRight/ArrowLeft (horizontal) or ...`, `split.md`; `Arrow keys / Home / End ... (a channel ui-slider focused)`, `color-picker.md`). Fix: one schema (`keys:` list + `action:`, `note:` for prose) enforced by `validateComponentDescriptor`.
2. `super-shell.ts:253` closes the narrow overlay on Escape, but `super-shell.md:117` `keyboard:` lists only the pane-resizer keys; Escape appears only in the `scrim` part description (`:92`) and prose. Fix: add an Escape row.
3. `ui-card-content`'s scroll keys (ArrowUp/Down, PageUp/Down, Home/End, `components/src/controls/card/card-content.ts:118`) are documented only inside a YAML comment on `card.md`'s `keyboard: []` line; card-content has no descriptor. Fix: a `keyboard:` entry scoped to the sub-element, or a `card-content.md`.
4. Placeholder and pseudo part names: `agent-admin.md:111` `entry-section (kind="catalog")`, `:119` `models drawer`, `:121` `tool-<tool> drawers` (the latter two are `data-drawer`, not `data-part`); `chat-shell.md:20` and `workspace-shell.md:20` `- name: (none)` where `parts: []` is the shape. Fix: use real part names or move them to prose; `parts: []` for none.
5. `components/src/controls/drill/drill.ts:507` holds a literal NUL byte inside `resolvedPath.join('...')`, so `file` reports the source as `data` and a grep without `-a` (ugrep `-I`, the shell default here) treats it as binary and skips it; a grep-based gate or audit silently misses drill.ts. Fix: write the separator as the `'\u0000'` escape.

## Constraints
Descriptors and the descriptor gate only; regenerate generated props with `scripts/generate-props.mjs` if an attribute row changes. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 1e59e50b555c
- Changed: Descriptor keyboard rows share one shape and placeholder part names name real parts
- Commits: none
- Check: 1 a scripted parse of every `keyboard:` block succeeds with one shape (the script in the report): pass
- Check: 2 `validateComponentDescriptor` still passes for every descriptor: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: packages/agent-ui/components/src/controls/drill/drill.ts: file now... -> notes.md
- Follow-up: note: packages/agent-ui/app/src/controls/agent-admin/agent-admin.md:110... -> notes.md
