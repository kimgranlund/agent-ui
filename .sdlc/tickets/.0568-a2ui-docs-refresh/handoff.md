---
id: T-0568
title: "A2UI specs, overviews and skills match the October 29 renderer and catalog changes"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: [T-0530]
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A2UI specs, overviews, references and skills describe the renderer and catalog behaviour that landed on 2026-10-28 and 29.

## Intent
- Do: update the A2UI docs (`.claude/docs/` specs, LLDs and references, package READMEs, `site/` overview pages, `.claude/skills/` a2ui skills, descriptor prose) for: the renderer applies only catalog-declared props (T-0552), the media URL scheme gate and `media-src` format (T-0553, T-0563, T-0565), a2ui-basic defaults (T-0555), the reset of dropped mapped props and the INERT_PROP and RECEIPT_TOTAL_PATH checks (T-0556), the `./catalogs` subpath (T-0530), and the AmountPicker receipt check (T-0550); regenerate generated docs (llms-full, sitemap) with their scripts.
- Non-goals: ADRs (frozen); grammar.md (Kim's ruling only); producer prompt text (Opus author plus Fable review rule) unless a doc states a now-false fact.
- Done when: `doc_lint` and `npm run check` exit 0; a grep for the old root-barrel `SHIPPED_*_CATALOGS` import in docs returns nothing; the report lists each doc changed.

## Context
Changes merged 2026-10-28 and 29: PRs 2347, 2349, 2350, 2359, 2361, 2364, 2365. The hardening changes are described as hardening only.

## Constraints
No em dashes. No paid runs. Public repo: no exploit detail. Starts after PR 2365 merges.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
1. `renderer-structural-resend.spec.md` SPEC-R2 AC3 and its non-goals no longer say a non-identity omitted prop is left unreset; the LLD's TreeDeps block, `#resetOmittedProps` snippet and test notes match `renderer/tree.ts` (T-0556).
2. `a2ui-catalog.spec.md` states the declared-props allow-list (SPEC-R9 AC2, T-0552), `PropDef.format` with `media-src` and `WidgetFactory.resetProp` (§5.1), the Basic `longText` arm (SPEC-R11 AC5), Basic defaults and inert props (SPEC-R10 AC7, AC8), `media-src` on Avatar and ProductCard, and `RECEIPT_TOTAL_PATH` on ConfirmReceipt; each matches the code.
3. The five media descriptors (image, avatar, video src and poster, audio, product-card image) describe the media gate, and `node scripts/generate-props.mjs` output is committed beside them (generate-props.test.ts green).
4. `rubrics/a2ui-payload.md` P7 no longer says validation rides `validationRegexp`.
5. `! git grep -n -E "import \{[^}]*SHIPPED_(PERSONA|DOMAIN)_CATALOGS[^}]*\} from '@agent-ui/a2ui'" -- '*.md' 'site/**/*.ts'` exits 0 (no match).
6. `npm run check` exits 0; doc_lint on every touched `.md` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 4b1be4538010
- Changed: A2UI specs, LLDs, skills, site page and media descriptors describe the declared-props renderer, the media URL format, Basic defaults, mapped-prop reset, the inert-prop checks and the catalogs subpath
- Commits: none
- Check: 1 SPEC-R2 AC3, non-goals and LLD match T-0556 code: pass
- Check: 2 a2ui-catalog.spec.md states each item and each matches the code: pass
- Check: 3 five media descriptors describe the gate and generated props are committed: pass
- Check: 4 rubric P7 no longer says validation rides `validationRegexp`: pass
- Check: 5 grep for the root-barrel `SHIPPED_*_CATALOGS` import: pass
- Check: 6 `npm run check` and doc_lint exit 0: pass
- Follow-up: note: .claude/docs/spec/a2ui-catalog.spec.md §5.1 types PropDef.format as... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/renderer/renderer.ts:29-31 a code header... -> notes.md
- Follow-up: note: the builder-reported older drift stays open: a2ui-catalog.spec.md... -> notes.md
- Follow-up: note: added lines contain no em dashes -> notes.md
