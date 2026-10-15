Manifest: .sdlc/work/no-barrels/decompose/manifest-v1.json (technical-architecture · plan) · coverage_check: clean
Quadrant: load-bearing
Outside-in: 30 nodes, 24 leaves. Granularity stops at one file-owner per leaf (one writer per file for the fan-out). Four grouping nodes carry `justify`. The 87 control folders are ONE leaf because a codemod writes them (idempotent, gate-proven), never 87 hand slices.
Inside-out: 30 actions from the handoff's five parts, its six open questions, and the constraints (publish/smoke, size gate, docs). No action names a solution the tree lacks a home for. Every leaf carries an `accept` predicate.
Hand-off: /plan
Note: handoff.md was not edited (architect writes only under decompose/); the conductor adds `Decomposition: decompose/report.md` under the handoff's Context.
