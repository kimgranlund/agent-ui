---
id: T-0082
title: "QuestionCard: match the approved mockup (letter badges, bordered rows, correct and wrong states, header, explanation panel)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The QuestionCard composite looks and behaves like the mockup Kim approved, with a test for each visible behaviour.

## Repro
1. Open http://127.0.0.1:5180/ (or render persona-quizmaster-question) and compare with the approved mockup: /private/tmp/claude-501/local-artifact/mockups.html section #qc, mockup CSS at /private/tmp/claude-501/widgets-artifact/own.css and body.html (QuestionCard).

## Expected
Per the approved mockup: a header row (a status pill such as 'Question 4 of 10' and right-aligned meta such as 'Science · medium'); the question; each option as a bordered, tap-sized row (min 44px) with a circular letter badge A, B, C, D; a selected state; a revealed state where the correct row is success-tinted with a check glyph and the label 'Correct', a wrong chosen row is danger-tinted with a cross glyph and the label 'Your answer', other rows neutral, options disabled; an explanation panel under the options (opens in place), with NO border-left highlight (Kim's ruling); a primary 'Check answer' button disabled until an option is picked. State must survive without color (glyph plus label).
## Actual
Built control (T-0074, #1902) renders plain radios and a progress bar; reveal only disables options and opens a disclosure. No correct or wrong marking, no letters, no header. The wire props lack the correct answer and header text.

## Context
packages/agent-ui/a2ui/src/catalog/personas/quizmaster/{catalog.json,factories.ts,selection.json}, src/examples/persona-exemplars.ts (quizmaster seeds), prompt teaching in site/pages/agent-admin-presets.ts (quiz-round). The plan for T-0074 omitted these props. Add wire props as needed (e.g. `answer` = the correct option value, `label` for the header pill, `meta` for the right-aligned text) and say so in ADR-0243 as an appended Amendment (accepted ADRs are append-only). Update catalog.json, sidecar, seeds, teaching, tests; regenerate generated files via their scripts; keep K6 under the 46,430 bound and report the number; one baseline recapture if prompt text changes. Styling by el.style or a scoped stylesheet: no border-left anywhere. Verify visually in Chromium with a screenshot of unselected, selected and revealed states next to the mockup.

## Constraints
No em dashes. Keep the existing QuestionCard value/change contract (a2uiQuestionValue).

## Acceptance criteria
verifier: L3

1. `npm run check` exits 0 and `npm test` exits 0 in the worktree.
2. The QuestionCard row in `packages/agent-ui/a2ui/src/catalog/personas/quizmaster/catalog.json` declares bindable string props `answer`, `label` and `meta` and `"children": "ChildList"`; the `value` mark stays `{prop: value, event: change, readProp: a2uiQuestionValue}`.
3. Through the real renderer (`question-card.test.ts`): each option is a `ui-radio` row with `min-block-size: 44px` and a key badge reading A, B, C, D in order; a click marks only that row `data-state="selected"` (dot glyph) and commits the value to the bound path.
4. With `revealed` true and `answer` set, the correct row has `data-state="correct"`, glyph ✓ and the label "Correct"; a wrong pick has `data-state="wrong"`, glyph ✕ and the label "Your answer"; other rows stay idle with their letters; the group and every radio are disabled, and a later click changes neither the pick nor any row.
5. The header shows a `ui-badge` pill from `label`, falling back to "Question n of m" from `progress`, and the `meta` text right-aligned.
6. The explanation is a plain panel shown only while revealed; no element in the card carries `border-left` in its style.
7. Both quizmaster seeds put a "Check answer" Button inside the card (`children`) with a `required` check on `/answer`, and that Button is disabled until a pick.
8. ADR-0243 ends with an appended `## Amendment 1`, and `git diff f35d8c24 -- .claude/docs/adr/0243-*.md` removes no line.
9. K6 (LLD section 4 shape: `agent-ui` default composition plus `renderSurfaceTool([])`) is at or under 46,430 chars.
10. The Quizmaster preset `seedVersion` is 4 in `site/pages/agent-admin-presets.ts` and `site/lib/agent-manifest/quizmaster.manifest.json`.
11. No added line contains an em dash.

## Closed

2026-10-12: Merged in #1903; verifier pass
