---
id: W-fog-skill-lookup-gaps
title: "context-fog-of-war: shell_lookup false negatives and a merged-output batch fixture"
status: done
size: L2
created: 2026-10-16
---

## Goal
The failed-discovery detector counts real reads it now misses, without bringing back the write false positives (Kim 2026-10-16). Source: `~/.claude/skills/context-fog-of-war/updates-log/20261016-cli-trace-field-test/changelog.md` (Open 1 to 4); field outputs in `/private/tmp/claude-501/scratch/fog-cli-proof/`.

## Scope (skill folder only: scripts/diagnostics.py, scripts/wrapped.py if needed, tests/)
1. A stderr redirect (`2>/dev/null`, `2>&1`) or a pipe after a read keeps it a lookup; only a stdout redirect to a file (`>`, `>>`, `1>`) or a heredoc write ends one. Trace A line 1938.
2. `cd DIR; cmd file` and `cd DIR && cmd file`: resolve the target against DIR (or keep it relative) instead of returning nothing. Trace A lines 17301 and 17947.
3. A `$VAR` target: match when the error line names a path whose tail matches the rest of the token, or when an earlier `VAR=...` assignment in the same command or session sets it; else record it as unresolved, never as a match. Trace A line 615.
4. A regression fixture for a real truncated-output batch with an indexed loop (Codex C1 line 40, output line 45): `parse_calls` gets 3 calls and `pair_outputs` returns None on the merged block; add a reversed-loop rejection test.
Unit tests use minimal excerpts of those trace lines (no secrets, redact anything key-like).

## Done when
- One new test per item, each red against the backup's scripts and green after; `python3 -B -m unittest discover -s tests` exits 0.
- Rerun the diagnose on trace A (`~/.claude/projects/-Users-kimgranlund-Projects-adia-ui-kit/7c041c91-ffe8-4068-8b56-9807c539368d.jsonl`, outputs under `/private/tmp/claude-501/scratch/fog-lookup-gaps/`, `library.py --root` there if publishing): `cat > file` writes counted as lookups stay 0, the lines above are now lookups, and the failed-discovery findings are listed with their lines versus the field test's 1.
- A changelog entry `updates-log/20261016-lookup-gaps/changelog.md` per `updates-log/AGENTS.md` (verifier fields pending); no em dash on added lines. Backup: `/private/tmp/claude-501/scratch/cfow-backup-1792161488`.

## Conductor amendment (2026-10-16)
Line 18529 was misfiled in the field test: its read is `git show REV:PATH | sed -n`, not a `cd` compound, and its failure text never matches the error regex, so it is out of scope (solo report, plan defect). Judge item 2 on lines 17301 and 17947.
