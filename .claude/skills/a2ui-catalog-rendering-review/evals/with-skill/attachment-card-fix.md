# with-skill behavior check — fix leg — 2026-08-18
Prompt: "Fix the Attachment card on the A2UI catalog page — its rendered surface shows a bare 'File' chip because the seeds are blank. Make it demonstrate a real file." Run by a general-purpose agent in an isolated worktree with the skill invoked via the Skill tool.

| card | tier | A1 A2 A4 B1 B2 C1 C2 | A3 B3 B4 C3 | verdict |
| Attachment (pre-fix, main @5174) | WIDGET | ✓ ✓ ✓ ✓ ✓ ✓ ✓ | 1 3 1 3 | HOLD |
| Attachment (post-fix, worktree @5199) | WIDGET | ✓ ✓ ✓ ✓ ✓ ✓ ✓ | 3 3 5 3 | PROMOTE |

Findings: B4 anchor 1 + A3 anchor 1, quadrant L-only, owner example-authoring-agent (A2UI_INITIAL had no Attachment key).
Blind-identify: pre "a file chip / attachment affordance" (hit type, miss job) · post "an attachment card for a PDF named Q3 roadmap.pdf, 428 KB" (hit).
Fixes: Attachment · shape (i) seed-only · site/lib/component-preview.ts A2UI_INITIAL.Attachment = { name: 'Q3 roadmap.pdf', mimeType: 'application/pdf', sizeBytes: '428000' } (href left blank — rendered nowhere, LLD-C6 leg deferred) · regen: none owed · gates: `npm run check` exit 0 · `npm test` exit 0 (10795 passed) · re-graded A3 1→3, B4 1→5 on a fresh capture from a temp `vite --port 5199` of the worktree.
Assertion 6 satisfied: fix shape named, files in layer order, regen reasoning, exit codes, re-graded delta on a NEW screenshot. Diff left uncommitted in the worktree `.claude/worktrees/agent-a4c56c520a6ee1440` (branch worktree-agent-a4c56c520a6ee1440).
