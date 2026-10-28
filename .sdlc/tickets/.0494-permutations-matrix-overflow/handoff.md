---
id: T-0494
title: "Permutation matrices fit their card at 1000 and 400px, and the render lint visits the permutations and states pages"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Every permutation matrix fits its card at 1000px and stacks or scrolls inside it at 400px, and the render lint covers the permutations and states pages.

## Context
Found by T-0488 (F2, F3). `site/pages/permutations.css` `.matrix` fixes `grid-template-columns: max-content repeat(4, minmax(7rem, 1fr))`, while text-field, textarea, toggle and otp pages emit 5 or 6 columns. Content paints past the card edge by 14px (button) to 478px (otp) at 1000px and 122 to 718px at 400px. ui-otp-field is 174px wide in a 144px cell, so adjacent cells overlap. On button-permutations at 400px, labels get 7 to 10px of 42 to 56px needed. `site/pages/dogfood-render.browser.test.ts` line 1061 globs `./*-demo.ts` only, so the 11 permutations and states pages are unlinted. `.matrix` also uses literal `border-radius: 0.75rem` and `padding: 1.25rem`; use the card-level tokens. Crops: /private/tmp/claude-501/-Users-kimgranlund-Projects-nonoun-agent-ui/a8ce3b21-c0a4-4e5f-b099-1796666e5f7f/scratchpad/0488-shots/crops/otp-perm.png, /private/tmp/claude-501/-Users-kimgranlund-Projects-nonoun-agent-ui/a8ce3b21-c0a4-4e5f-b099-1796666e5f7f/scratchpad/0488-shots/crops/text-field-perm-clip.png

## Constraints
Columns come from each page's own column count. Fix the layout first, then extend the lint's page list so it lands green. Screenshot before and after at 1000 and 400px into the artifacts dir. Heavy browser runs through `gate_lock.py run`. No em dashes.

## Acceptance criteria
- The render lint's page list includes every `site/*-permutations.html` and `*-states.html` page, and the site dogfood-render browser test exits 0 on chromium and webkit.
- With the `.matrix` fix reverted, that test fails on at least one permutations page.
- After screenshots for otp-field, text-field, textarea, toggle and button permutations at 1000 and 400px are in the artifacts dir.
- `npm run check` exits 0.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: c01455b8045c
- Changed: Permutation matrices fit their card at 1000 and 400px, and the render lint now covers the permutations and states pages
- Commits: none
- Check: 1 Render lint page list includes every `site/*-permutations.html` and `*-states.html` page and the ...: pass
- Check: 2 With the `.matrix` fix reverted the test fails on at least one permutations page: pass
- Check: 3 After screenshots for otp-field, text-field, textarea, toggle, button permutations at 1000 and 40...: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: note: scripts/dogfood-render-allowlist.json layout-permutations entry... -> notes.md
- Follow-up: note: at 1000px the otp/text-field/toggle/textarea-lg matrices scroll... -> notes.md
