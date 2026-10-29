---
id: T-0533
title: "super-shell.md meets the schema under a props drift gate, every created part is declared, and a PART_UNDOCUMENTED gate catches new ones"
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
`super-shell.md` validates against the descriptor schema and has a `compareDescriptorToProps` assertion; every part a control's code creates is in its descriptor's `parts:`; the five composer `*-trigger` rows stop posing as parts; and `compareDescriptorToSource` gains a `PART_UNDOCUMENTED` code so a new undeclared part reds the gate.

## Intent
- Do: the three Medium findings below, in that order: fix super-shell.md (rename `name:` to `tag:`, add tier, extends and slots, fix the enum rows) and add its props drift assertion; declare each missing part (including the agent-admin backlog); move the composer `*-trigger` rows to a `pickers:` list keyed by `data-picker` (or prose), not `parts:`; then add `PART_UNDOCUMENTED` on the existing `SLOT_UNDOCUMENTED` shape and prove it reds on a scratch undeclared part.
- Non-goals: renaming any part in code.
- Done when: `validateComponentDescriptor` passes for every descriptor; the new gate passes on the tree and fails on the mutation (noted); `npm run check` and the descriptor and affected control tests exit 0.

## Context
From the T-0531 descriptor contract sweep (#2333):

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

## Constraints
Descriptors and the descriptor gate only; regenerate generated props with `scripts/generate-props.mjs` if an attribute row changes. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `npx vitest run packages/agent-ui/app/src/controls/super-shell/super-shell.test.ts` exits 0: super-shell.md is schema-valid, its attributes match the live props, and its states, slots and parts match the source.
- `npx vitest run packages/agent-ui/components/src/descriptor/component-descriptor-sourcewire.test.ts` exits 0: a created `scratch` part missing from `parts:` yields exactly PART_UNDOCUMENTED, and declaring it clears it.
- `npx vitest run packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts packages/agent-ui/app/src/controls/settings/settings.test.ts packages/agent-ui/app/src/controls/conversation packages/agent-ui/components/src/controls/menu packages/agent-ui/components/src/controls/playing-card packages/agent-ui/components/src/controls/service-card` exits 0: every part those controls and their helper modules create is declared.
- `npm run check` exits 0.
- conversation-composer.md lists the five picker triggers under `pickers:` keyed by `data-picker`, and none under `parts:`.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 5a4ff7e81424
- Changed: Every descriptor meets the schema, every created part is declared, and PART_UNDOCUMENTED gates new ones
- Commits: none
- Check: 1 super-shell.test.ts: pass
- Check: 2 sourcewire test: pass
- Check: 3 agent-admin, settings, conversation, menu, playing-card and service-card tests: pass
- Check: 4 `npm run check`: pass
- Check: 5 pickers: pass
- Follow-up: note: collectCreatedParts component-descriptor.ts:672-683 skips computed... -> notes.md
