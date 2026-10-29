---
id: T-0531
title: "Descriptor contract sweep: each control's descriptor against its code and generated props"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A ranked list of drift between each ui-* control's descriptor (`{name}.md`: attributes, events, parts, slots, aria, keyboard) and its code and generated props, so the real gaps become tickets.

## Intent
- Do: read-only sweep over `packages/agent-ui/components/src/controls/*` and `packages/agent-ui/app/src/controls/*`: a scripted pass first (descriptor `attributes[]` vs `static props` and `*.props.gen.ts`; declared events vs dispatched events, which must be in ADR-0153's set; declared parts vs `data-part` in source; declared keyboard keys vs handlers), then a targeted read of every mismatch. Write `## Findings` to this handoff, High (a promised behavior missing or a wrong event name) / Medium (doc drift that misleads a consumer) / Low, each with file:line, evidence and a one-line fix, plus a proposed ticket per group. Skip what the T-0517 a11y sweep already reported.
- Non-goals: fixing anything.
- Done when: `## Findings` exists in that shape; High findings are confirmed by reading code (a run where cheap); `git status --short -- . ':!.sdlc'` prints nothing.

## Context
Descriptors are each control's contract (AGENTS.md, Where truth lives); props are generated from them by `scripts/generate-props.mjs` and drift-gated, so attribute drift is unlikely, but events, parts and keyboard are not gated.


## Constraints
Read-only outside `.sdlc`. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `## Findings` exists with High, Medium and Low groups, each finding carrying file:line, evidence and a one-line fix, and each group a proposed ticket.
- Each High finding is confirmed by a code read (or the group states that none was found).
- `git status --short -- . ':!.sdlc'` prints nothing.

## Findings

Method: three scripted passes over every `{name}.md` descriptor under `packages/agent-ui/components/src/controls/*` and `packages/agent-ui/app/src/controls/*`, using the repo's own `parseDescriptor`/`validateComponentDescriptor` (`components/src/descriptor/component-descriptor.ts`), then a targeted read of every mismatch. (1) Schema: `validateComponentDescriptor` on all descriptors, and a check that each one without a `*.props.gen.ts` has a `compareDescriptorToProps` test. (2) Events: each declared `events[].name` against ADR-0153's set and against a real `emit(...)`/`dispatchEvent` in the control, its `_base` class or its traits; each dispatched event against the declared list. (3) Parts and keyboard: every `dataset.part =`, `setAttribute('data-part', ...)`, `part(tag, name)` and template `data-part="..."` a folder's own TS creates, against the union of `parts[].name` across that folder's descriptors; each declared key token against a handler literal, and each handled key literal against the `keyboard:` block. False positives removed on reading: sub-descriptors sharing a folder (swiper-item/label/paddles/pagination, split-pane, toast-region, master-detail-pane, nav-rail-item/group, conversation-header/dialog) whose events and keys belong to the folder's primary element; `data-part` strings that are querySelector reads of a composed child's part (status-stream `detail`/`details`/`body`, timeline-item `body`, tabs `panel`, swiper `prev`/`next`, suggestions comments); events emitted by a base class or trait (indicator-element.ts:145-146, range-element.ts:184/196, selection-commit.ts:153, overlay.ts:757-758); platform-owned keys (popover/dialog Escape, native button, link and summary Enter/Space); prose mentions of a key the control explicitly does not handle (calendar Escape, choice-card's group-owned keys); agent-admin's `'Delete'` (a button label, agent-team-pane.ts:431). Button's `click` is the ratified pure-activation exception (family-coherence.test.ts:97-113). Skipped as already reported by T-0517: nav-rail's tab keyboard model, ui-list `listitem`, split separators, modal/drawer naming. Attribute drift is gated fleet-wide except super-shell (Medium 1). Paths below are relative to `packages/agent-ui/`.

### High

None found. Every declared event is dispatched by the control, its base class or a trait with the declared name; every name is in ADR-0153's set or the ratified `click` exception; every declared key traces to a handler, a trait or a platform-owned element. No descriptor promises a behavior the code lacks.

### Medium

Proposed ticket: "Descriptor contracts: bring super-shell.md to schema under a props drift gate, and add a `parts:` trip-wire to compareDescriptorToSource with the backlog below"

1. `super-shell.md` fails the descriptor schema and is the only descriptor with no props drift gate.
   - Where: `app/src/controls/super-shell/super-shell.md:7` (`name: ui-super-shell`, not `tag:`), `:31` and `:55` (`type: enum(collapse|stack|tabs)` / `enum(narrow|compact)`), `:10-58` (rows named by attribute, `collapsed-start`, mixed with prop names, `viewTransitions`); code `app/src/controls/super-shell/super-shell.ts:96-133`.
   - Evidence: `validateComponentDescriptor` returns `MISSING_FIELD@tag`, `MISSING_FIELD@tier`, `MISSING_FIELD@extends`, `MISSING_FIELD@slots` and `BAD_ATTRIBUTE` on `attributes[4]`, `[5]`, `[10]`; every other descriptor in both packages validates clean. No test calls `compareDescriptorToProps` for it (`super-shell.test.ts` has none), so `compareDescriptorToProps` over this fence would report every kebab-named row as missing or extra. Values and defaults match `super-shell.ts` by reading, so nothing ships wrong today, but nothing stops it. Nothing in `site/lib/frontmatter.ts` imports it, so no docs page derives from it.
   - Fix: rename to `tag:`, add `tier`/`extends`/`slots`, use `name: collapsedStart` + `attribute: collapsed-start` and `type: enum` + `values:`, and add a `compareDescriptorToProps` assertion in `super-shell.test.ts`.

2. Parts the code creates and its CSS styles, missing from `parts:` (no gate checks `parts:`; settings.md:43 and conversation.md:145 say so in their own comments).
   - `components/src/controls/playing-card/playing-card.ts:105` `index-rank` and `:108` `index-suit`: not in `playing-card.md:44` `parts:`, zero mentions in the descriptor; `index-suit` is styled at `playing-card.css:216`.
   - `components/src/controls/service-card/service-card.ts:190` `action-glyph`: not in `service-card.md:53` `parts:`, zero mentions.
   - `components/src/controls/menu/menu.ts:378` `check` (the menuitemradio/checkbox mark, T-0392): named only in prose (`menu.md:189`), not in `parts:` (`menu.md:61`).
   - `app/src/controls/settings/settings.ts:286` `notice` and `app/src/controls/settings/generate.ts:109` `unsupported-field`: zero descriptor mentions, both styled in `settings.css`.
   - `app/src/controls/super-shell/super-shell.ts:311` `bar-content`: zero descriptor mentions, styled in `super-shell.css`.
   - `app/src/controls/conversation/conversation-composer.ts:1073` `context-chip-meta`, `app/src/controls/conversation/conversation.ts:1355` `copy` and `:1702` `wire`: absent from every conversation `parts:` list (`copy` and `wire` appear only in prose).
   - `agent-admin.md:68` claims its `parts:` are "documented for completeness", yet about 60 parts its code creates are undeclared: `admin-help.ts:106-124` (`admin-help-title`, `-summary`, `-body`, `-facts`), `agent-admin.ts:1437-4147` (`surface-row`, `surface-toggle`, `model-row`, `drawer-heading`, `drawer-content`, `drawer-done`, `domain-row`, `domain-input`, `danger-confirm-*` and more), `agent-team-pane.ts:138-515` (`team-*`), and the `entry-list/` helper module that agent-admin mounts (`entry-list.ts:190-892`, `entry-form.ts:205-498`, `entry-*`; it has no element and no descriptor of its own).
   - Fix: add each to its descriptor's `parts:`, then extend `compareDescriptorToSource` with a `PART_UNDOCUMENTED` code (the existing `SLOT_UNDOCUMENTED` shape) so new ones are caught.

3. `conversation-composer.md` lists five `parts:` that are not parts.
   - Where: `app/src/controls/conversation/conversation-composer.md:121` `models-trigger`, `:123` `effort-trigger`, `:125` `providers-trigger`, `:127` `mode-trigger`, `:143` `capabilities-trigger`.
   - Evidence: the code marks them `data-picker="models"` etc., never `data-part`; no TS or CSS in `app/src` or `site` uses any `*-trigger` part name. A consumer reading `parts:` and writing `[data-part="models-trigger"]` matches nothing. The descriptions do say `[data-picker=...]`, so the name column is the misleading part.
   - Fix: move them out of `parts:` into a `pickers:` (or prose) list keyed by the real `data-picker` value, or stamp `data-part` on the triggers.

### Low

Proposed ticket: "Descriptor hygiene: one keyboard row shape so a keyboard gate can exist, real part names in place of placeholders, and the minor drifts below"

1. Keyboard blocks use four row shapes, so no `keyboard:` gate can be written. Row keys across descriptors: `keys` (19), `keys` + `note` (19), `note` only (17), `key` (4: calendar, color-picker, split, super-shell); the value field is `action` in some and `description` in others; keys sit inside free text (`ArrowRight/ArrowLeft (horizontal) or ...`, `split.md`; `Arrow keys / Home / End ... (a channel ui-slider focused)`, `color-picker.md`). Fix: one schema (`keys:` list + `action:`, `note:` for prose) enforced by `validateComponentDescriptor`.
2. `super-shell.ts:253` closes the narrow overlay on Escape, but `super-shell.md:117` `keyboard:` lists only the pane-resizer keys; Escape appears only in the `scrim` part description (`:92`) and prose. Fix: add an Escape row.
3. `ui-card-content`'s scroll keys (ArrowUp/Down, PageUp/Down, Home/End, `components/src/controls/card/card-content.ts:118`) are documented only inside a YAML comment on `card.md`'s `keyboard: []` line; card-content has no descriptor. Fix: a `keyboard:` entry scoped to the sub-element, or a `card-content.md`.
4. Placeholder and pseudo part names: `agent-admin.md:111` `entry-section (kind="catalog")`, `:119` `models drawer`, `:121` `tool-<tool> drawers` (the latter two are `data-drawer`, not `data-part`); `chat-shell.md:20` and `workspace-shell.md:20` `- name: (none)` where `parts: []` is the shape. Fix: use real part names or move them to prose; `parts: []` for none.
5. `components/src/controls/drill/drill.ts:507` holds a literal NUL byte inside `resolvedPath.join('...')`, so `file` reports the source as `data` and a grep without `-a` (ugrep `-I`, the shell default here) treats it as binary and skips it; a grep-based gate or audit silently misses drill.ts. Fix: write the separator as the `'\u0000'` escape.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 28bfcbd34a6b
- Changed: Descriptor contract sweep: no High drift; Medium and Low findings with proposed tickets
- Commits: none
- Check: 1 `## Findings` exists with High, Medium and Low groups, each finding carrying file:line, evidence ...: pass
- Check: 2 Each High finding is confirmed by a code read (or the group states that none was found): pass
- Check: 3 `git status --short -- . ':!.sdlc'` prints nothing: pass
- Follow-up: note: handoff.md ### Low item 3 says card-content's scroll keys are... -> notes.md
