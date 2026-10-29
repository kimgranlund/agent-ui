---
id: T-0527
title: "text-field loads its type=color codec and swatch only on first color use"
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
A `ui-text-field` that never uses `type=color` no longer pays about 1.4 KB gz for the OKLCH color codec and the swatch preview.

## Intent
- Do: move `colorCodecOptions` and the swatch preview behind the existing dynamic `import('../color-picker/color-picker.ts')` in text-field.ts, or a small type=color module loaded on first color use; keep type=color behavior and its tests unchanged (including T-0495's swatch value tests).
- Done when: a size measurement of `./controls/text-field` drops by roughly the color.ts plus swatch.ts weight (report before and after); the type=color browser tests pass; `npm run check` and the text-field tests exit 0.

## Context
From the T-0523 bundle-size sweep (#2328):

| # | Row | Measured / budget | Over or headroom | Culprits (est gz) | Belongs? | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| M6 | heavy import on a default entry: `./controls/text-field` | eager 14846 B gz solo (unbudgeted: a cluster member) | n/a | text-field.ts 3318, traits/overlay.ts 2139, traits/value-codec.ts 1351, color-picker/color.ts 1049 (OKLCH math), glyph 712, swatch.ts 337 | color.ts and swatch.ts are static imports (`text-field.ts:70-71`) for the type=color leg only; every plain text field pays about 1.4 KB gz for them | move `colorCodecOptions` and the swatch preview behind the existing dynamic `import('../color-picker/color-picker.ts')` (`text-field.ts:524`), or a small type=color codec module loaded on first color use |

## Constraints
Budgets live in `scripts/measure-size.mjs`; every budget change carries a dated reason comment naming its mover (existing precedent around :205 and :265). Generated files only through their scripts. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The eager (static-import closure) gz of text-field drops from the 14846 B baseline by roughly color.ts plus swatch.ts: `node .sdlc/runtime/tasks/0527-text-field-lazy-color/eager.mjs packages/agent-ui/components/src/controls/text-field/text-field.ts --max 14000`
- The text-field jsdom tests (the unchanged type=color probes plus the new lazy-window replay test) and the tree-shake record pass: `npx vitest run packages/agent-ui/components/src/controls/text-field packages/agent-ui/components/src/controls/tree-shake.test.ts`
- The type=color browser tests pass: `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/text-field packages/agent-ui/components/src/controls/color-picker packages/agent-ui/components/src/controls/swatch`
- The standing gate is green: `npm run check`

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 16a8e95f82d1
- Changed: text-field loads its type=color codec and swatch only on first color use, 1169 B gz off every plain text field
- Commits: none
- Check: 1 Eager gz of text-field drops from 14846 B (`eager.mjs ... --max 14000`): pass
- Check: 2 text-field jsdom tests plus tree-shake record (`npx vitest run .../controls/text-field .../contro...: pass
- Check: 3 type=color browser tests (gate_lock, `--project packages` text-field, color-picker, swatch): pass
- Check: 4 `npm run check` (via gate_lock): pass
- Follow-up: note: text-field.ts:~548-550 the codec comment block now has one... -> notes.md
- Follow-up: note: the browser tests import @agent-ui/components/all, so they only... -> notes.md
