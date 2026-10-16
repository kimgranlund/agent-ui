---
id: W-fog-skill-contract-audit
title: "context-fog-of-war: a static contract audit of a harness's guidance surfaces (catalogs, schemas, skills, prompts, checks, corpus)"
status: ready
size: L3
created: 2026-10-16
---

## Goal
Kim 2026-10-16: "if context-fog-of-war does not review codebase/corpus contracts/schemas/etc it should probably be capable of doing that as well. improve the skill". Today the skill reads only traces: it sees what reached the model, not whether the guidance itself is coherent. Five live rounds showed most failures were (b) conflicting or ambiguous guidance and (d) check, oracle or scenario defects, both visible in the codebase before any live spend. The skill gains an audit mode that reads a project's guidance and contract surfaces statically and reports those defects with file:line evidence, so a team can find them before a live round and can tie a trace finding to the contract that caused it.

## Field evidence (agent-ui rounds 3 to 6, all found only after live spend)
- A skill said ServiceCard, the catalog said ProductCard, the persona said "compact info surface": every model failed (conflict across surfaces).
- A composite rule lived in a skill body that only ever reached the model as its one-line index description (index-only rule).
- A repair message asked for a BookingConfirmation shape the schema rejected (repair text vs schema).
- Shared grammar lines read literally by small models ("let the USER take the final action").
- A scenario oracle "expect Card" passed on any Card (oracle too generic); persona text named catalog types (modality lint); a case-sensitive id check missed "Table-3" (check narrower than the rule it enforces).
- An End-state rule covered "fleet sunk" but not surrender (rule coverage gap).

## Scope (skill folder `~/.claude/skills/context-fog-of-war/` only)
1. Routing table and checklist: a new input kind, "a codebase or corpus (no trace)", with goals "audit contracts" and "link a trace finding to its contract". Keep SKILL.md about 100 lines; detail goes to a new `references/contract-audit.md`.
2. `references/contract-audit.md`: what counts as a guidance or contract surface (catalog and component schemas, component contracts and descriptors, skill and reference files with their index descriptions, persona and system prompt text, shared grammar, few-shot exemplars and corpus records, validators and semantic checks with their repair messages, routing and selection metadata, scenario oracles and evals), how to discover them in an unfamiliar repo (manifests, registries, generated files and their sources), and an audit rubric with one detector family per defect class: cross-surface conflict, index-only rule, repair or exemplar that fails its own schema, rule coverage gap, check narrower than its rule, oracle too generic, literal-reading hazards in shared text, stale generated artifact vs its source, a type named in text that must stay modality-free. Each detector states its evidence rule (exact file:line excerpts, the same evidence discipline as traces), its blind spots, and the cause class (b) or (d) it maps to. Tag runtime-harness vs both, as the learnings do.
3. A deterministic script `scripts/audit.py` that does the mechanical part, standard library only: inventory surfaces from a mapping or discovery globs, extract named entities (component/type names, rule phrases, ids) per surface, and report at least these mechanical detectors with file:line: (a) the same entity given conflicting directives across surfaces, using a simple, documented heuristic, labeled candidate, never verdict; (b) exemplars or repair snippets that fail a provided JSON Schema; (c) generated files older than or diverging from their declared source; (d) rule text present only in bodies whose surface is index-only per the mapping. Output JSON plus a short text summary; findings are candidates for the agent's semantic review, like the trace detectors.
4. Link mode: given a trace finding's id or excerpt and an audit report, list the contract surfaces whose entities or rules appear in that finding, so the why-and-fix table can cite the contract to change.
5. Tests: unit tests for each mechanical detector with small synthetic fixtures (no agent-ui specifics in fixtures); the existing suite stays green.
6. Field run: run the audit on agent-ui (read-only, outputs under `/private/tmp/claude-501/scratch/fog-contract-audit/`) with a mapping you write there; report what it finds, and whether it would have flagged the field-evidence cases above (each: caught, partly, missed, with why).
7. Learnings: a short note in `references/learnings/` linking the audit mode (applies to both harness kinds), and an `updates-log/20261016-contract-audit/changelog.md` per `updates-log/AGENTS.md` (verifier fields pending).

## Constraints
Harness-agnostic: no agent-ui paths or names in the skill's own files or fixtures (the field run's mapping lives in scratch). Read-only on any audited project. No em dashes. Back up first (path in the brief). Do not edit files another agent is changing: wait for the conductor's go.

## Done when
- The routing table names the codebase/corpus input; `references/contract-audit.md` holds the rubric with every defect class above; `scripts/audit.py` runs with `--help` and on a fixture.
- One unit test per mechanical detector, each failing without the detector; `python3 -B -m unittest discover -s tests` exits 0.
- The field run report lists findings with file:line and the caught/partly/missed table for the field-evidence cases (eight: bullet 5 holds three).
- The changelog entry exists; no em dash on added lines (diff against the backup).

## Conductor note for the verifier (2026-10-16)
The acceptance checks are in the solo report (`.sdlc/runtime/tasks/fog-skill-contract-audit/solo-report.md`); judge them against the Done when above. Also judge honesty: the conflict detector is noisy (54 and 8 candidates, none held on review); its output and the docs must label conflicts as candidates and state the precision limit, and the field-report caught/partly/missed table must match what the script and the rubric actually do. Verifier L3: two criteria pin exact strings.
