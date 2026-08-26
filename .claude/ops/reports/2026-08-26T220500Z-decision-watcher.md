## Summary

Ran both modes against `/Users/kimba/Projects/nonoun/agent-ui`. Forward mode surfaced one important tooling anomaly I ran down before trusting any output; revalidation mode found 4 new falsified claims plus confirmed the four PRs cited in dispatch landed cleanly.

### Tooling anomaly found and resolved (forward mode)

`adr_checkpoint.py classify` on the currently-preloaded script version (harness 3.18.8) reported **all 226 ADRs as "amended"** — an implausible full-corpus flood. Root cause, confirmed by diffing `3.18.6` vs `3.18.8`'s `adr_checkpoint.py`: issue #929 changed the hash basis (`status + markers + decision_content` vs the old `status + decision_content`), with no checkpoint migration — every ADR's hash shifts once, regardless of content. I re-ran `classify` with `3.18.6` (the version the current checkpoint's hashes actually match) to isolate the **true** delta: `amended: adr-0030, adr-0032, adr-0033, adr-0035` (exactly the four PRs named in the dispatch) plus `newly_superseded: adr-0007, adr-0033` via edges `adr-0033→adr-0007 [font/glyph linear-derivation leg]` and `adr-0035→adr-0033 [font/icon pow-derivation mechanism]` — both pre-existing header-cell facts re-surfaced because their announcing ADRs changed hash this session, not new events. I then advanced the checkpoint using `3.18.8` (the current script) to re-baseline every hash under the new formula in one clean move, so the flood doesn't repeat next firing. Judgment below covers only the real 4-ADR delta, never the full 226.

### Forward mode: harvest queue (4 new rows)

adr-0030/0032/0033/0035 each landed a same-file `## Amendment` restating a Decision clause the header cell had already partially superseded — the identical shape already queued under adr-0021/adr-0025 (extend `.claude/skills/doc-standards/references/adr-log-mechanics.md`'s Amendment/Supersession/Extension table with a 4th row). Re-checked against `origin/main` (ac6b80f2): the table still has no such row. Now **9 corpus-wide instances** (adr-0007/0017/0018/0021/0025/0030/0032/0033/0035). Queued all 4 as new rows, idempotent, same plan.

### Forward mode: newly_superseded — no stale citations

- **adr-0007**: 2 citations on `origin/main` (`site-authoring/references/{best-practices,content-types}.md`), both citing the `[scale]/[density]` subtree-geometry mechanism — the leg adr-0033's own text says explicitly **STANDS**, not the superseded font/glyph-formula leg. No candidate.
- **adr-0033**: zero citations found on `origin/main`. No candidate.

### Revalidation mode: sampled 5 (cursor 35→40)

| id | kind | verdict | reason |
|---|---|---|---|
| adr-0036 | adr-decision | falsified | `--ui-control-line-height` renamed to `--md-sys-control-line-height` by ADR-0140 (2026-07-18); mechanism/value intact, literal name stale |
| adr-0038 | adr-decision | falsified | `--ui-height/-font/-icon-*` renamed to `--md-sys-*` by ADR-0140; all 6 tiers' values verified byte-correct against shipped `dimensions.css`; ADR-0140's own Repairs cell claims this ADR's prose was fixed — it wasn't |
| adr-0039 | adr-decision | **confirmed** | box-alignment `start`/`end` verified live in `column.ts`/`list.ts`, no `flex-start`/`flex-end` |
| adr-0040 | adr-decision | falsified | budget re-based ≥8 more times since the ADR's own 2026-08-16 Amendment (58KB→…→70KB+ per `measure-size.mjs` comments), none fed back as a further Amendment — the exact silent-drift failure mode this ADR's own Amendment said it was fixing |
| adr-0041 | adr-decision | falsified | `--ui-compact-*`/`--ui-widget-inset` renamed to `--md-sys-*` by ADR-0140; ratified table + values verified byte-correct, only the name is stale |

**New finding worth flagging on its own**: 3 of 5 sampled claims (adr-0036/0038/0041) share a root cause distinct from the doc-standards pattern above — ADR-0140's corpus-wide `--ui-*`→`--md-sys-*` rename (2026-07-18, ~34 tokens, ~150 files) swept shipped code but never propagated back into the literal token-name prose of ADRs that predate it, and none of those ADRs' own header cells cite ADR-0140 as a downstream marker. Given 3-of-5 in a random sample, this is very likely a wider corpus gap (any pre-2026-07-18 ADR naming one of ADR-0140's renamed tokens verbatim) — worth a dedicated sweep, not something queued as a forward-mode harvest candidate this firing since ADR-0140 itself isn't in this firing's real delta.

### The four already-queued adr-0030/0032/0033/0035 revalidation rows — left queued, not self-cleared

Independently re-read all four landed Amendments and confirmed each accurately restates its clause against shipped reality (details in the tooling-anomaly section above). Per `watch-adrs`'s own Boundaries ("never decides a queued falsified/untestable finding is 'resolved' on its own — only a human clearing the queue row does that"), `queue-clear` was not run — naming the exact command for whoever clears it:

```
python3 "<harness plugin root>/scripts/revalidation_checkpoint.py" queue-clear <path> --ids adr-0030:falsified,adr-0032:falsified,adr-0033:falsified,adr-0035:falsified
```

Next commands (never run by this seat): `file-task` against ADR-0036/0038/0040/0041 (owner: unassigned) asking for a restating Amendment; and a `file-task` for a dedicated sweep of ADR-0140's rename against every pre-2026-07-18 ADR.

No human was present (unattended fan-out firing) — the batched `AskUserQuestion` confirm for the 7 pending ADR-queue rows and 8 pending revalidation-queue rows is deferred, not attempted blind.
