---
id: T-0131
title: "Stale [scale]/[density] doc line and the squashed catalog AudioPlayer preview"
type: chore           # feature | bug | chore | spike | idea
status: ready
size: L2
priority: P2
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Two leftovers: a skill reference that still teaches the retired axes, and a catalog preview that renders a squashed native control.

## Scope (one brief paragraph, per the Inner loop rule)
(1) .claude/skills/composition-patterns/references/surface-primitives.md line 17 (and any other live skill, reference or descriptor line a grep for the [scale] and [density] attribute axes finds outside accepted ADRs, dated reports and the legacy bridge) is rewritten to data-tier / data-scale / data-size / data-density per ADR-0245 and its amendments; accepted ADRs and dated reports are history and stay untouched. (2) the a2ui catalog page's AudioPlayer preview renders a squashed native audio control: give the preview specimen a sensible width and a real or silent source so it renders at its natural size; fix it in the preview or example content, not in the renderer. Evidence: a before and after screenshot of the AudioPlayer preview, viewed. Docs-only parts gate on doc_lint plus check. Local gate: npm run check plus the touched folders' tests (browser files through gate_lock.py; a golden only with '<file> --update', the file filter before the flag, and only after viewing it). Regenerate generated files with their scripts, never by hand. Root is n 5 / 6 / 7 (heights 20 / 24 / 28). Two other lanes are running: stay out of the shell, page chrome and container CSS (T-0121) and out of control padding, badge, checkbox and scripts/generate-foundations.mjs (T-0122). Commit locally, do not push, no per-ticket verifier, no em dashes, report in one short message with exit codes.
