---
id: W-fog-skill-open-items
title: "context-fog-of-war: apply the open items from the round 7, contract-audit and lookup-gap entries"
status: done
size: L2
created: 2026-10-16
---

## Goal
Kim 2026-10-16: apply skill gaps as they are learned, not only log them. Every Open item below is applied or explicitly ruled out with a reason, in the skill folder `~/.claude/skills/context-fog-of-war/`.

## Open items (sources: `updates-log/20261016-round-7-field-test`, `20261016-contract-audit`, `20261016-lookup-gaps`)
1. Checklist: a step to exclude provider-error turns (usage limit, overload, auth) from a bundle before analysis, keeping line numbers stable (blank in an ingested copy), and to say so in the report.
2. Contract-audit reference and mapping guidance: the producer's repair text and the tool definitions are surfaces a mapping must list; the audit warns when a mapping lacks a declared repair or tool surface.
3. `audit.py`: a surface's `include`/`exclude` accepts a list of regexes or one string (it crashes on a list today); test it.
4. `audit.py link`: the phrase match runs over the mapped statements, not the whole file (today `import.meta.glob` lines match every query); test it.
5. Guidance: a finding passed to `link` should quote the guidance it suspects (SKILL.md or contract-audit.md, one line).
6. Truncation: name `outputTokens` equal to the request's `max_tokens` as stop-at-cap evidence when no stop reason is recorded; teach it in the diagnostics reference and, if the bundle mapping can carry both fields, detect it; test it.
7. `audit.py --text` prints the report's `limits` (the conflict precision line).
8. The modality-leak finding keeps every statement line as evidence (or says "first N of M").
9. `references/diagnostics.md` lists which shell forms count as a lookup request (cat, head, tail, sed, nl, wc, less, more; pipes, stderr redirects; cd compounds; same-command VAR expansion) and which do not (stdout redirect, heredoc write, git show REV:PATH).
10. Session-wide `VAR=` tracking across calls: implement if bounded and testable, else rule it out with the reason.

## Done when
- Each item applied (with a test where it is code) or ruled out with a reason in the changelog; each new test red against the backup and green after; `python3 -B -m unittest discover -s tests` exits 0.
- A changelog `updates-log/20261016-open-items/changelog.md` per `updates-log/AGENTS.md`, the earlier entries' Open items marked "applied in 20261016-open-items" where applied; verifier fields pending. No em dash on added lines. Backup: `/private/tmp/claude-501/scratch/cfow-backup-1792169942`.

## Debate record (2026-10-16)
Challenge: `/private/tmp/claude-501/scratch/fogskill6-challenge/challenge.md` (0 revert, 6 keep with change, 4 keep). Rebuttal: `.sdlc/runtime/tasks/fog-skill-open-items/rebuttal.md` (all 7 points conceded and applied with tests). The verifier judges the Done when above plus each conceded change in the rebuttal table, and that the challenge's probes (p1 to p4 in that folder) now behave as conceded.
