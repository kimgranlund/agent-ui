---
id: T-0563
title: "Catalog media props declare a media URL format"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: [T-0553]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The default catalog's media props declare a media URL format, so the validator rejects what the render gate would deny.

## Intent
- Do: add a media URL format to the validator and the catalog PropDefs for Image.src, Avatar.src, Video.src, Video.poster, AudioPlayer.src and ProductCard.image, matching the render-time media gate's rules; regenerate generated files with their scripts; tests.
- Non-goals: changing the render-time gate's rules.
- Done when: the new validator tests fail on base and pass after; the a2ui suites and `npm run check` exit 0.

## Context
Hardening follow-up from T-0553 (PR 2349). Its verifier noted the media PropDefs still carry no format, so the static validator admits any string and only the render gate (`packages/agent-ui/components/src/controls/text/media-src.ts`) denies. The existing `safe-href` format does not fit (it rejects `data:` and admits `mailto:`), so a media format is needed.

## Constraints
No em dashes. No paid runs. Public repo: describe the change as hardening only, with no exploit detail in code, comments, commits or the PR. Starts after PR 2349 merges.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/catalog/conformance.test.ts` exits 0; its `PropDef.format media-src (T-0563)` and `MEDIA_SRC_SCHEMES stays in sync` tests fail on base 23e236205 (14 failures) and pass after.
- Image.src, Avatar.src, Video.src, Video.poster, AudioPlayer.src and ProductCard.image in `packages/agent-ui/a2ui/src/catalog/default/catalog.json` declare `"format": "media-src"`; the render-time gate `media-src.ts` is unchanged.
- `npx vitest run packages/agent-ui/a2ui` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 23e236205278
- Changed: Catalog media props declare a media URL format that the validator checks
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/catalog/conformance.test.ts` exits 0; its media-src an...: pass
- Check: 2 Image.src, Avatar.src, Video.src, Video.poster, AudioPlayer.src and ProductCard.image in `package...: pass
- Check: 3 `npx vitest run packages/agent-ui/a2ui` exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/a2ui-basic/catalog.json:16... -> notes.md
