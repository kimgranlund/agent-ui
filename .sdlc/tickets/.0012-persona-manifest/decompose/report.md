Manifest: .sdlc/0012-persona-manifest/decompose/manifest-v1.json (technical-architecture · plan) · coverage_check: clean
Quadrant: load-bearing
Outside-in: 11 nodes, 9 leaves, 2 grouping nodes with `justify`. Home is site-side (`site/lib/persona-manifest/`) because two of the four members (preset, seedVersion) live in `site/` and the DAG forbids a2ui importing site; the 15 manifest JSON files are ONE leaf (one schema, one writer refreshes them). No node without an action.
Inside-out: 20 actions from the issue text (tie four members, gate agreement, decide the fragmentless five) plus the verified mechanics (seedVersion is a migration switch, no baseline covers persona sidecar/fragment edits, localPatterns typos read as "none"). None unhosted. Every leaf carries an `accept` predicate judged by exit code or a file predicate, never by eyeballing.
Hand-off: /plan
Forks for Kim (recorded in architect-L1.md): (1) digest pins vs version-only pins (recommend digests); (2) fragments for Quant/Curator/Stylist/Maitre d'/Travel Agent (recommend none in this ticket: every idiom they teach already names default-catalog types).
Note: handoff.md was not edited (architect writes only under decompose/); the conductor adds `Decomposition: decompose/report.md` under the handoff's Context.
