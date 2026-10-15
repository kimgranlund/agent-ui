---
id: T-0004
title: "Croupier on Haiku: cards render without faces and Card body padding is missing (GH #1795)"
type: bug             # feature | bug | chore | spike | idea
status: done
size: M
priority: P2
depends: [file:packages/agent-ui/a2ui/src/catalog/personas/croupier/__fixtures__/haiku-blackjack-turn1.jsonl, file:packages/agent-ui/a2ui/src/catalog/personas/croupier/__fixtures__/sonnet-blackjack-turn1.jsonl]
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Reproduce, with captured evidence, why The Croupier on `claude-haiku-4-5` shows playing cards without faces and a Card body with no padding, then fix the owning layer (prompt text, catalog row, CSS or renderer) or close it as model-tier variance with a documented guard. Tracks GH #1795.

## Intent
- Do: first step is reproduction with evidence, not a guess; then the smallest fix at the owning layer, with a red-then-green fixture; scrub list applied.
- Non-goals: retuning the model in the preset (Sonnet stays the default), widening wire enums, breaking the ADR-0225 contract.
- Done when: a recorded Haiku turn and a Sonnet turn replay offline, the fixture fails before the fix and passes after, and the scrub list is applied.

## Context (a read-only agent verified the code 2026-10-05; nothing is known about the actual Haiku payload)
- Known only from the issue body: reported on Haiku; two symptoms (faceless cards, unpadded container body). No comments, screenshot, payload, model id, temperature or turn number exist; no recorded Haiku Croupier transport or corpus seed exists.
- The preset is `site/pages/agent-admin-presets.ts:141` (seedVersion 6, line 144; default model `claude-sonnet-5`, line 147, so Haiku is a user model switch). Substantive teaching lives in byte-pinned mini-skills `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/card-layout.md` (templated hands, relative paths; warns `"/rank"` renders empty) and `game-table-chrome.md`.
- The `PlayingCard` row: `packages/agent-ui/a2ui/src/catalog/personas/croupier/catalog.json`; `rank`, `suit`, `faceDown` are bindable optional enums with no `required` list. The factory (`factories.ts:24-40`) coerces a missing value to `''`; `ui-playing-card` (`components/src/controls/playing-card/playing-card.ts`, about line 40) renders a blank face for `''`. `enumType.from` (`components/src/dom/props.ts:61`) snaps any unknown attribute to the first member (`''`), so `"Ace"`, `"ace"`, `"10♠"` also render blank if the validator lets them through. A bare `PlayingCard` with no props is schema-valid, which explains a faceless card with no validator signal.
- `card.css` (about lines 48-55) has an ADR-0056 fallback: a Card with no region child gets padding; a Card with regions plus loose siblings does not ("documented, not repaired").
- Gap: `tools/catalog-files.ts` registers only `agent-ui` and `a2ui-basic`; the agent asserts, did not run, that `validate-payload.ts --catalog agent-ui` flags `PlayingCard` as unknown. Persona rows exist only in the derived `agent-ui--croupier` catalog (`compose.ts`).

## Hypotheses (ranked; each with a confirm and a kill)
1. Props omitted or bound as `"/rank"` inside a template: blank face, no validation failure. Confirm: captured payload shows `PlayingCard` without rank/suit or leading-slash template paths. Kill: rank and suit present and valid but the face is empty.
2. A valid-looking wire value the enum codec snaps to blank (numeric `10`, `"Ace"`, `"T"`). Confirm: `String(value)` not in `RANKS`/`SUITS`. Kill: values in-enum.
3. Haiku omits `CardContent` or mixes regions with loose siblings so the ADR-0056 fallback does not apply. Confirm: Card children include region nodes next to bare nodes. Kill: `CardContent` wraps everything (then CSS or renderer).
4. A cross-layer defect not specific to Haiku. Confirm: the Sonnet payload on the same build reproduces it.
5. Streaming or heal effect on partial updates after PR #1794's fresh-surface-per-round change.

## Constraints
Reproduce before editing (a Haiku and a Sonnet turn of the same game); mini-skills are byte-pinned: any prompt-stack text change goes through the prompt-equivalence recapture flow (skill `a2ui-prompt-authoring`) and a `seedVersion` bump; gates by exit code; no em dashes. Do not edit `.claude/worktrees/agent-ui-1727` (stale copies).

## Scrub and upsert list (by fix path)
- Prompt text: `site/pages/agent-admin-presets.ts` (`seedVersion` to 7; migration around lines 785-797); `card-layout.md`, `game-table-chrome.md`, `card-game-sheet.md`; `prompt-equivalence.baseline.json`; `live-agent/{mini-skills,system-prompt-grammar,chat-validation}.test.ts`; `agent/dogfood-inventory.ts`.
- Catalog row: croupier `catalog.json`, `selection.json`, `factories.ts` and tests; ADR-0225 (note only), `.claude/docs/spec/playing-card.intake.md`, `a2ui-container-vocabulary.spec.md`, `genui-surface.spec.md`; `.claude/docs/decompositions/md-content-concierge-croupier-promotion.decomp.md`; `.claude/doctrine.manifest.json`.
- CSS or renderer: `card.css` and its descriptor; skills `component-patterns` and `composition-patterns` (box-model section).
- Rubric and tooling: `.claude/docs/rubrics/a2ui-payload.md` (version bump if P4 or P9 anchors move); `tools/catalog-files.ts` and `validate-payload.ts` if persona catalog support is added, then skills `a2ui-payload-authoring` and `a2ui-jsonl-mcp`.

## Dependencies and conflicts
- No conflict with #1804, #1805, #1806 (#1806's retry behavior matters when capturing Haiku turns). Coordinate with the per-persona manifest and registry tickets if the fix edits `selection.json`, `manifest.ts` or `seedVersion`. Most recent Croupier change is PR #1794 (5b8308d7): check its fresh-surface text did not alter the hand structure.
- Order: reproduce, diagnose, fix. Persona-catalog validator work is separate and comes after.

## Size and lane
Diagnosis S; the fix S to M (mini-skill text with recapture, or CSS), M to L if it needs persona catalog support in the CLI or a catalog `required` change (ADR-0225 territory: then an architect). Planner level M; `solo` lane after the reproduction step.

## Acceptance outline
1. A committed fixture: a recorded Haiku Croupier turn (JSONL via the devtools transport shelf) plus the same game on Sonnet, replayable offline.
2. A test that fails before the fix: mounts the fixture and asserts each `ui-playing-card` has a non-empty face and the table `ui-card-content` computed padding is greater than 0.
3. Either `validate-payload.ts --catalog agent-ui--croupier` exits 1 on the faceless payload, or an equivalent unit test rejects it.
4. After the fix: fixture green, `npm run check` and touched package tests exit 0, prompt-equivalence green if prompt text changed; a pre-bump store migrates.
5. Every scrub-list record repaired in the same change.

## Decision (Kim, 2026-10-05): how a real Haiku turn is captured
Kim records the turns herself and drops the raw NDJSON wire lines (the `/__a2ui/agent` response, one line per row, no edits) at `packages/agent-ui/a2ui/src/catalog/personas/croupier/__fixtures__/haiku-blackjack-turn1.jsonl` and `sonnet-blackjack-turn1.jsonl`, plus `capture-meta.json` (`{prompt, capturedAt, commit, haiku:{model, temperature, attempts}, sonnet:{...}}`). Prompt: `Deal a round of Blackjack.` in `/agent-admin-app.html`, persona The Croupier, models `claude-haiku-4-5-20251001` and `claude-sonnet-5`. No key ever reaches a headless run (ADR-0073 trust boundary). The ticket is `blocked` on those fixture files (the `depends` entries are met when they exist). Step 1 of the plan becomes diagnosis from the fixtures; a deterministic reproduction from a hand-built payload (hypotheses 1 to 3) can proceed meanwhile. The closed-loop headless flow library requested later (T-0010) is the longer-term way to record these turns without a key.

## Closed

2026-10-06: Fixed and merged in #1838 (nested hand lists, recorded Haiku fixtures)
