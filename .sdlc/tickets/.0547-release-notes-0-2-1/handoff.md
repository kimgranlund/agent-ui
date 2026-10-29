---
id: T-0547
title: "Release notes and a dry run for 0.2.1, the first publish that includes @agent-ui-kit/data"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: [T-0530]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
`.github/release-notes/v0.2.1.md` is ready for Kim to publish 0.2.1 from main: the first release that includes `@agent-ui-kit/data`, plus every consumer-facing change since 0.1.0, with the breaking export moves called out.

## Intent
- Do: follow the `package-release` skill (lockstep versioning, the cut-a-release procedure); write v0.2.1.md from v0.2.0.md plus the changes merged since (`git log` from the v0.2.0 tag to main), with a "Breaking changes" section for the export moves (scroll-fade and pane-resize to `./traits/*` (T-0526), the a2ui catalogs to a subpath (T-0530)), new subpaths (`./traits/roving-focus` T-0521), and a note that v0.2.0 was tagged but never published; run `npm run publish:packages -- 0.2.1 --dry-run` (or the script's dry-run form) and record that it packs all nine packages in the order shared, icons, a2a, components, data, router, code, a2ui, app.
- Non-goals: publishing, tagging, moving or deleting the v0.2.0 tag (Kim's call).
- Done when: the notes file exists with no em dash; the dry run packs nine tarballs at 0.2.1; `npm run check` exits 0.

## Context
v0.2.0 was tagged 2026-10-26 on a commit before the data fix (#2295); its release workflow failed twice and npm still serves 0.1.0, whose app package depends on an unpublished data package. Kim ruled 2026-10-28: leave v0.2.0, cut 0.2.1 from main. The release workflow's OIDC trusted publish fails for a package never published before, so Kim publishes 0.2.1 by hand once.

## Constraints
No em dashes. No paid runs.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: d82820d6c741
- Changed: Release notes for 0.2.1 and a lockstep dry run of the nine packages
- Commits: none
- Check: 1 the notes file exists with no em dash: pass
- Check: 2 the dry run packs nine tarballs at 0.2.1: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: package READMEs and CDN recipes still name 0.2.0 as the latest... -> notes.md
