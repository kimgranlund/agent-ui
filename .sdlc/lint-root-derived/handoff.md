---
id: T-0167
title: "Lints read the root and canvas register from the generator, not a pinned sm"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: [T-0152]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
No lint or test hard-codes the page root register: one shared `ROOT_REGISTER` read from `ROOT_INPUTS` / `foundations.gen.css`, so the next root change touches one line. Lint audit 2026-10-14.

## Intent
- Do:
  - Shared helper (e.g. in `scripts/lib/foundations-rules.mjs` plus a browser-safe twin) exporting the root `{tier, scale}` derived from the generator; `shell-spacing-gate.test.ts` `rootRegister()` is the precedent.
  - `site/pages/dogfood-render.browser.test.ts`: `registerOf` fallback (`scale ?? 'sm'`, about :73) and the header comment (:28) read the helper; add a sweep leg asserting the page root register equals the helper; the A2UI canvas asserts (:651, :682) also check `data-scale === 'md'` (canvas widget / md ruling); import `glyphBox` from foundations-rules instead of the inline `Math.max(8, ...)` (:384); name the 1.3 contrast constants (:433, :469).
  - Point the re-pinned tests' `resolve('product','md',...)` root reads (and `foundations.test.ts:90`, `foundations.browser.test.ts:136`) at the helper where they mean "the root", leaving explicit-region legs explicit. A codemod is fine.
  - `shell-spacing-gate.test.ts`: add a stale-entry check (each allowlist entry must still fire), drop the entry if its 9rem = 24n collision ended at n 8, and fix the message's retired `--md-sys-space-*` wording.
  - `.claude/docs/references/dogfood-lint.md`: root line, the landed T-0143 3:1 role, the ruled icon floor; state that the render lint and eval-catalog are local and queue gates, not CI.
- Done when: `npm run check` exit 0; render lint, shell-spacing-gate, foundations tests exit 0; a negative control: flipping `ROOT_INPUTS` scale in a scratch copy reds the root-register leg (describe how you proved it); touched browser tests exit 0 in both engines.

## Context
- Starts after T-0152 (product / md root) merges. Commit locally, never push. Heavy tests via `gate_lock.py run`, foreground.

## Constraints
- No literal px geometry; no em dashes.

## Acceptance criteria
- `npm run check` exits 0.
- `npx vitest run site/lib/shell-spacing-gate.test.ts packages/agent-ui/shared/src/tokens/foundations.test.ts` exits 0 (the allowlist is empty, the stale-entry leg and its control, the gen.css :root equals ROOT_REGISTER).
- `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts` exits 0 in Chromium and WebKit, the root-register leg and the canvas `data-scale` md asserts included.
- `git grep -n "resolve('product', 'md'" -- '*.ts'` lists only lines inside explicit `data-tier` / `data-scale` region legs, none that mean the root; root reads go through `rootResolve` from `scripts/lib/foundations-rules.mjs`.
- The root-register leg reads `getComputedStyle(document.documentElement)`'s `--md-sys-tier-*` and `--md-sys-scale-s`, decodes them through `CFG.tiers` and `STEP`, and compares them to `ROOT_REGISTER`, never to `registerOf`'s fallback (the flip proof is in solo's report).
