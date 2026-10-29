---
id: T-0579
title: "The daily-read docs carry no em dashes"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P3
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The docs agents read every day carry no em dashes: `.claude/docs/references/`, `.claude/docs/rubrics/`, and `.claude/docs/{process,goals,plan,roadmap,product-brief}.md` (about 1,330 dashes, Kim 2026-10-29, wave 1 of the em dash sweep).

## Intent
- Do: replace every em dash in those files by hand with the punctuation the sentence needs (comma, colon, semicolon, parentheses, or a split sentence), keeping meaning and every link, code span and table intact; leave en dashes in numeric ranges alone.
- Non-goals: spec, LLD, PRD, decompositions and the other folders (later waves); ADRs and archive (frozen); generated files.
- Done when: `grep -c` of the em dash character in each named file is 0; `doc_lint` on the touched files and `npm run check` exit 0; any doc that feeds a generated file (sitemap, llms-full) is regenerated with its script.

## Constraints
No em dashes. No paid runs. Docs-only gate (doc_lint plus check). Meaning unchanged.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- No em dash remains in the wave-1 set: `! grep -r -l "$(printf '\342\200\224')" .claude/docs/references .claude/docs/rubrics .claude/docs/process.md .claude/docs/goals.md .claude/docs/plan.md .claude/docs/roadmap.md .claude/docs/product-brief.md` exits 0.
- doc_lint passes on every touched markdown file: `git diff --name-only HEAD -- .claude/docs | grep '\.md$' | xargs python3 /Users/kimgranlund/.claude/plugins/cache/nonoun-plugins/docs/1.22.5/scripts/doc_lint.py` exits 0.
- The standing gate is green: `npm run check` exits 0.
- The doc-reading suites stay green: `npx vitest run site/lib/wire-tolerance-index.test.ts site/lib/docs-grammar.test.ts packages/agent-ui/a2ui/src/corpus/corpus-data.test.ts packages/agent-ui/a2ui/src/corpus-genui/corpus-genui-data.test.ts` exits 0.
- The edited red-team fixtures still validate: `node --experimental-strip-types packages/agent-ui/a2ui/tools/harness/validate-payload.ts .claude/docs/rubrics/fixtures/a2ui-deceptive-composition/red-team-account-summary-credential-form.json` exits 0, and the same for `red-team-order-status-payment-recapture.json` and `benign-newsletter-signup.json`.
- The product-brief section 8 anchor cited by `prd/agent-admin-app.prd.md` keeps its slug: `grep -q '^## 8 · Addendum (2026-08-23) · the four' .claude/docs/product-brief.md` exits 0.
- Meaning is unchanged: a reader comparing `git diff HEAD -- .claude/docs` finds only punctuation swaps, plus code spans that quote runtime strings now spelling the dash as `—`.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 6e1b2734db75
- Changed: The daily-read docs (references, rubrics, process, goals, plan, roadmap, product brief) carry no em dashes
- Commits: none
- Check: 1 No em dash remains in the wave-1 set: pass
- Check: 2 doc_lint on every touched markdown file: pass
- Check: 3 Standing gate green: pass
- Check: 4 Doc-reading suites green: pass
- Check: 5 Edited red-team fixtures still validate: pass
- Check: 6 Product-brief section 8 anchor keeps its slug: pass
- Check: 7 Meaning unchanged: pass
- Follow-up: note: .claude/docs/rubrics/genui-pack-idiom.md D2 row: the pack files... -> notes.md
- Follow-up: note: the solo report says grep -c exits 2 as written in the Done-when... -> notes.md
