---
id: T-0391
title: "Agent tab: open fields, drawers for model roster and server tools, danger zone"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-21
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 60
---

## Goal
The agent-admin Settings > Agent tab shows only what an author changes often, as open fields; set-once structured config moves into drawers, and destructive actions sit in a collapsed Danger zone behind a confirm modal.

## Intent
- Do:
  1. Step 0, mockup for Kim's approval before any build: a screenshot-grade mockup of the Agent tab at regular density, showing the open fields, the closed Advanced fold, one opened drawer (Manage models) and the Danger zone with its confirm modal.
  2. Build the approved layout:
     - Open: the agentEnabled switch, Name, plus `tagline` and `category` (persona fields with no pane control today), a default-model select, Effort and Thinking (both still gated by the model's capability row).
     - Collapsed "Advanced" fold: Show reasoning, Max tokens, Prompt cache.
     - "Manage models" `ui-drawer`: the modelsIncluded roster (the per-model On switch, grouped by provider).
     - One `ui-drawer` per server tool (web search, web fetch and the rest): max uses, allowed and blocked domains as a list editor (not comma strings), and the location fields.
     - Collapsed "Danger zone" fold at the bottom: Reset Agent, Delete agent, Bankroll Reset (still hidden when not bankrollCapable), each behind a `ui-modal` confirm.
  3. Follow the change reaches drawer fields: `field-location.ts` gains a drawer level, so a Co-pilot edit to a field inside a drawer opens that drawer and lands on the field.
- Non-goals: other Settings tabs (Capabilities, Surface, Context); `notes` and `changelog` controls (a later ticket if wanted); any persona file shape change beyond what the list editor needs on read and write.
- Done when: Kim approves the step 0 mockup; a screenshot of the built tab matches it; the field-location totality, anchor-parity and pane-coverage tests pass with every moved field still carrying its `data-field`; a test shows a Co-pilot change to a drawer field washes its trigger button with the change cue and opens no drawer (fork 6, Kim 2026-10-21); `npm run check` plus the tests of the touched folders exit 0.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Context
- Asked by Kim 2026-10-21 ("review the contents of Settings > Agent tab and evaluate what should be exposed as open fields and what could be placed in drawers or modals"); chose "mockup first".
- Today: the tab is built inline in `#compose()` of `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` (agentContent near line 1317, folds near 1583 to 1681, sub-nav near 1858 to 1895). Three `ui-disclosure` folds, all open: Agent (switch + Name), Model (model-grid of On switch and Default radio per model, then `modelSettingsEl` ui-settings with effort, thinking, showReasoning, maxTokens, cacheTtl and the server-tool rows, then Reset Agent and Delete rows), Bankroll (Reset).
- Field table: `agent-admin/content-fields.ts` (PERSONA_FIELDS); schema: `agent-admin/agent-admin-schema.ts` (agentConfigSchema, modelSettingsSection, settingsFieldFor, SERVER_TOOL_SETTING_KEYS); location: `agent-admin/field-location.ts` (`locationFor`, used by `#followChange` near line 2308).
- Precedent: `ui-drawer` entry CRUD in Capabilities (`entry-list/entry-list.ts`, `entry-list/entry-form.ts`, `hasDrawerCrud`, ADR-0188). `ui-modal` exists in components but agent-admin does not use it yet.
- Prior styling of this tab: T-0306 (`.sdlc/tickets/.0306-settings-pane-styling/`). IA: ADR-0179, `.claude/docs/lld/admin-three-pane-ia.lld.md`; follow the change: ADR-0181, `.claude/docs/spec/follow-the-change.spec.md`.

## Constraints
- One field definition: every control keeps a `data-field` and a `content-fields.ts` row with a `locationFor` entry (ACS-R10).
- Library ramp and geometry (`.claude/docs/references/geometry.md`); no one-off heights; no native form elements; no em dashes.
- Persona file keys and values stay compatible; existing persona files load unchanged.
Lane: full because size L3 decides before planning (steps.py lane)

## Design
Step 1 mockup: `.sdlc/tickets/0391-agent-tab-drawers/mockup/agent-tab.html`, four panels at the page register (md, regular density, 32px control rows): `open-fields`, `models-drawer`, `tool-drawer`, `danger-confirm`. The step ends at the human gate: the forks below wait for Kim, and Kim's answers go under each one.

### Forks for Kim
Each fork has a firm recommendation. Kim's answer goes on the `Answer:` line.
1. Tagline and Category: they write the roster record, not the persona store, so they are editable only for library records and read-only for shipped presets. Recommendation: roster record, read-only on presets. Answer: Kim 2026-10-21: accepted as recommended.
2. Default model: it becomes a select in the Model fold, and the Manage models drawer keeps only the per-model On switch (no Default column; the default model's switch reads on and is locked). Recommendation: select plus On-only roster. Answer: Kim 2026-10-21: accepted as recommended.
3. Server tools: each tool row (switch, label, trailing Configure button) sits open in the Model fold; Configure opens that tool's drawer. Recommendation: rows open, details in the drawer. Answer: Kim 2026-10-21: accepted as recommended.
4. Domain lists: they stay comma strings in the store, and the list editor (one text field and Remove per domain, plus Add domain) splits on read and joins on write, so existing persona files load unchanged. Recommendation: comma strings in the store, list in the pane. Answer: Kim 2026-10-21: accepted as recommended.
5. Danger confirm: Reset Agent, Delete agent and Bankroll Reset share one `ui-modal` confirm whose heading, sentence and confirm label change per action, with Cancel taking initial focus. Recommendation: one shared modal. Answer: Kim 2026-10-21: accepted as recommended.
6. Follow the change into a drawer: a Co-pilot edit to a drawer field opens that drawer and moves focus to the field. This is a deliberate exception to the ADR-0181 cl.2 no-focus law, limited to drawer fields. `ui-drawer` opens with `showModal()` (top layer, `::backdrop`, focus trap, Escape; `drawer.md` property `open`, `drawer.ts:125-129`), so the page behind it, the Co-pilot chat whose patch opened it included, is inert until the drawer is dismissed. Kim decides the top-layer modal reveal, not only the focus move. Recommendation: open the drawer modally and move focus, drawer fields only. Answer: Kim 2026-10-21: badge, do not open. A Co-pilot edit to a drawer field marks the Configure or Manage models button with the change cue; the drawer opens only on click; no focus move, no ADR-0181 exception.

## Plan review
- Kim 2026-10-21: step 1 mockup approved as drawn (mockup/agent-tab.html, four panels). Forks 1 to 5 accepted as recommended. Fork 6 changed: badge, do not open the drawer (see the fork 6 Answer). Step 3 is replanned for fork 6 before it builds.
- plan review: replan: step 3 only, for Kim's fork 6 ruling: follow-the-change never opens a drawer. A Co-pilot edit to a drawer field marks the owning Configure or Manage models button with the existing change cue (the fold-level attention treatment), the drawer opens only on the user's click, and nothing moves focus, so ADR-0181 cl.2 holds with no exception and the spec note records the drawer-level badge only. Keep steps 1, 2 and 4 unchanged byte for byte; step 3's criteria assert the badge and that no drawer opens.
- 2026-10-21 plan defect at split: step 3: (guard) criterion is red now (exit 1): npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/controls/agent-admin/provenance.browser.test.ts packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts packages/agent-ui/app/src/controls/agent-admin/follow-the-change.browser.test.ts
- 2026-10-21 plan defect at split: step 3: (guard) criteria changed the work tree: packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts
- 2026-10-21 plan defect at split: step 3: (guard) criteria changed the work tree: packages/agent-ui/app/src/controls/agent-admin/provenance.browser.test.ts

## Outcome

2026-10-21 · lane: full L3 · verdict: skipped (static mockup whose gate is Kim's approval (approved as drawn 2026-10-21)) · verifier: verifier-L3 (fable) · base: cfe2b5291043
- Changed: Agent tab: open fields, Advanced and Danger zone folds with a shared confirm modal, Manage models and per-tool drawers with domain list editors, drawer trigger change cue
- Commits: none
- Check: step-4#1 (red) `for f in built-agent-tab.png built-models-drawer.png built-tool-drawer.png built-danger-co...: pass
- Check: step-4#2 (guard) `npm run check`: pass
- Check: step-4#3 (guard) `npx vitest run --project packages packages/agent-ui/app/src/controls/agent-admin package...: pass
- Check: step-4#4 (guard) `npx vitest run --project site site/pages/agent-admin-app.test.ts site/pages/agent-admin-...: pass
- Check: step-4#5 (guard) `npx vitest run --config vitest.browser.config.ts --project packages .../provenance.brows...: pass
- Check: step-4#6 (guard) `npx vitest run --config vitest.browser.config.ts --project site site/pages/agent-admin-a...: pass
- Check: step-4#7 (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others ...: pass
- Check: step-4#1 (red) `npx vitest list ... -t "T-0391 layout" | grep -q "T-0391 layout"`: pass
- Check: step-4#2 `npx vitest run --project packages .../agent-admin.test.ts .../field-location.test.ts -t "T-0391 ...: pass
- Check: step-4#3 (red) `grep -qF "settingsItem('advanced', 'Advanced'" .../agent-admin.ts`: pass
- Check: step-4#4 (red) `grep -qF "settingsItem('danger', 'Danger zone'" .../agent-admin.ts`: pass
- Check: step-4#5 (red) `grep -qF "ui-modal" .../agent-admin.ts`: pass
- Check: step-4#6 (red) `grep -qF "onAgentMetaRequest(" site/pages/agent-admin-app.ts`: pass
- Check: step-4#7 (guard) packages jsdom suite: pass
- Check: step-4#8 (guard) site jsdom files: pass
- Check: step-4#9 (guard) packages browser files: pass
- Check: step-4#10 (guard) `npx vitest run --config vitest.browser.config.ts --project site site/pages/agent-admin-a...: pass
- Check: step-4#11 (guard) scope grep: pass
- Check: step-4#1 (red) `npx vitest list ... -t "T-0391 drawer" | grep -q "T-0391 drawer"`: pass
- Check: step-4#2 `npx vitest run --project packages .../field-location.test.ts .../follow-the-change.test.ts .../a...: pass
- Check: step-4#3 (red) `grep -qF "washes the Manage models trigger and opens no drawer" .../follow-the-change.test...: pass
- Check: step-4#4 (red) `grep -qF "T-0391 drawer: a consumed modelsIncluded patch washes the trigger and opens no d...: pass
- Check: step-4#5 `npx vitest run --config vitest.browser.config.ts --project packages .../follow-the-change.browse...: pass
- Check: step-4#6 (red) `grep -qF "[data-part='drawer-trigger'][data-attention]" .../agent-admin.css`: pass
- Check: step-4#7 (red) `! grep -qF "Comma-separated" .../content-fields.ts`: pass
- Check: step-4#8 (red) `grep -q "T-0391" .claude/docs/spec/follow-the-change.spec.md`: pass
- Check: step-4#9 (guard) packages jsdom suite: pass
- Check: step-4#10 (guard) packages browser files: pass
- Check: step-4#11 (guard) `... --project site site/pages/agent-admin-app.browser.test.ts`: pass
- Check: step-4#12 (guard) scope grep: pass
- Deviation: step 1 verifier skipped: static mockup whose gate is Kim's approval (approved as drawn 2026-10-21)
- Deviation: step 2 verifier skipped: covered by the one ticket verifier at step 4, which reran step 2's criteria over cfe2b5291..HEAD
- Deviation: step 3 verifier skipped: covered by the one ticket verifier at step 4, which reran step 3's criteria over cfe2b5291..HEAD
- Follow-up: note: packages/agent-ui/app/src/controls/agent-admin/provenance.browser.t... -> notes.md
- Follow-up: note: packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:3901... -> notes.md
- Follow-up: note: .sdlc/tickets/0391-agent-tab-drawers/screens/built-agent-tab.png is... -> notes.md
- Follow-up: note: em dashes in added lines of the ticket diff, for example... -> notes.md
- Follow-up: note: the two vitest list | grep -q red controls were not replayed in a... -> notes.md
