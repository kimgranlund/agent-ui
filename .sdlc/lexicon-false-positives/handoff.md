---
id: T-0063
title: "Response-type override lexicon: stop surface-noun false positives and add missed phrasings"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-11
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`detectUserOverride` stops forcing a surface on ordinary prompts that merely contain a surface noun, and catches the common explicit asks it misses, without regressing the 43 labelled prompts.

## Intent
- Evidence (T-0060 step 10 verifier, built tree): false positives that force a surface: "build a list of reasons", "make me a table of contents", "show me the list of files in my home folder", "show me how a table join works", "show me the screen resolution settings in macOS", "show me what a card game looks like", "build a wizard character". Misses: "show me a diagram", "Build me a form", "show me a pricing tables" (plural). Kept correct: "show me the plans as a table", "Make me a short satisfaction survey", "Build a settings panel", "show me a chart of sales", "render the page as a card", "make me a dashboard", "just tell me" and "text only" forms, text wins a tie.
- Do: tighten in `packages/agent-ui/a2ui/src/agent/response-type.ts` (the phrase lists and noun gate): require the surface noun to be the head of the phrase (directly after the optional article and up to two modifiers, not anywhere within four words; reject "how", "what", "why", "where", "when", "list of", "of contents" after the verb or noun), add `diagram`, `build me a` / `make me a` already via 'me', and plural nouns; update `response-type.test.ts` (a new describe named exactly "lexicon round 2" holding every phrase above as red-now tests, the false positives expecting no override, the misses and the kept-correct phrases expecting surface or text), and SPEC RTS-R6 (`.claude/docs/spec/response-type-selection.spec.md`) plus PRD section 8 so the limitation text matches. Bump the SPEC status line.
- Non-goals: any other file; the prompt stack; ADR-0242 text (accepted); the live leg (do NOT run it, never read a key).
- Done when: the new describe is red at base and green after; `response-type.test.ts`, `layering.test.ts`, `produce-response-type.test.ts` and the agent-eval tests exit 0; the 43 labelled prompts in `agent-eval/fixtures/response-type-cases.json` still classify as before (only the two surface-expecting ones may trigger an override, and they still do); `npm run check` exits 0; doc_lint exits 0 on the SPEC and PRD; no em dash in any added line.

## Context
PRD section 8 (known limitations), SPEC RTS-R6, ADR-0242. Selected by Kim 2026-10-11 (AskUserQuestion). One verifier (L1) then merge; close-first rules apply.

## Constraints
Imports point inward only; `response-type.ts` keeps zero value imports. Commit locally; no push.

## Closed

2026-10-12: Merged in #1884; verifier pass, all 43 labelled prompts unchanged
