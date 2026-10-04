# Intent record: a2ui-jsonl-mcp

Authored 2026-10-03 for GH #1734, on Kim's ruling of the same date that the ADR-0067 trigger has
fired. ADR-0067 (accepted 2026-07-03) deferred this skill ("Author the jsonl-mcp skill now against
the streaming SPEC", rejected under Alternatives) until a producer need existed. The producer now
exists and ships: `produce()`, the meta-line channel, the transport seam and the devtools capture
family are all built and tested. The ADR-0067 amendment dated 2026-10-03 records the firing.

## Phase 0: route

Primitive = skill. Not a hook (nothing mechanically pass or fail), not an entry-file fact (needed
only when someone touches the line protocol), not an agent (the build seat `a2ui-build-agent`
already exists; this is knowledge it and the payload seat consult). Knowledge on demand = skill.

## Phase 1: slots

- Trigger (verbatim phrasings): "my meta-line was dropped", "why was the note ignored", "what
  order do lines arrive", "when does the first line stream", "per-line heal", "what does heal
  repair", "validate-then-stream", "terminal error line", "record a turn", "replay a transcript",
  "replay a devtools capture", "ndjson stream", "genui line".
- Behavior delta: without the skill, an ask about the line protocol is answered from partial
  reading of `produce.ts`. The recurring misreads this skill closes: a meta-line placed after the
  first line is treated as peeled (it is not; heal gives it a `version` and validate rejects it);
  per-line heal's "changed" is read as "corrected" (it always reports `single-object-envelope`);
  a malformed arm is assumed to kill the line (only `note` and `trace` do); a recording is assumed
  to carry every arm (it carries four); devtools replay is assumed to re-emit meta (it replays
  `line` events only).
- Species: knowledge, a pattern map that cites code by symbol.
- Dials: `user-invocable: false`, `disable-model-invocation: false` (a model-only router, the
  `a2ui-multi-catalog` posture).
- Freedom: high. The code and the ADRs are the contract; the skill states mechanics and routes.
- Fences: composition and the arm vocabulary stay with `a2ui-payload-authoring` (its
  `references/meta-line-vocabulary.md` owns what each arm means). Package code and build method
  stay with `a2ui-build`. Corpus admission stays with `a2ui-corpus-curation`. Catalog selection
  stays with `a2ui-multi-catalog`.
- Done-when: a line-protocol question reaches the right reference and the right symbol instead of
  an improvised answer, and an authoring or code question still routes to its owner.

## Overlap decision

`a2ui-payload-authoring`'s `references/meta-line-vocabulary.md` already describes the meta-line
envelope in a short "what it is and is not" section. That section and this skill's framing
reference agree today; this skill does not restate the arm table. If the two drift, the code
(`meta-line.ts`) wins and both are repaired. No sibling description was edited in this change:
both siblings are being refreshed on a separate branch. The blind routing check (19 cases) leaked one
code-change case to this skill on run 1; tightening this skill's own NOT-fence fixed it (run 2: 19/19),
so no sibling edit was needed.

## Provenance

Facts were re-read against current code on 2026-10-03: `produce.ts`, `meta-line.ts`,
`genui-line.ts`, `corpus/heal.ts`, `recorded-transport.ts`, and in `devtools/src/`: the timeline,
capture and replay modules. The mid-stream meta-line trap was reproduced by running `heal()` on
a late meta-line and validating the result (SCHEMA at path `[0]`).
