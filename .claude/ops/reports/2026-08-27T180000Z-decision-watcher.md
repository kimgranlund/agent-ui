## decision-watcher — forward mode + revalidation mode, firing 2026-08-27T18:00:00Z

### Forward mode: classify

`adr_checkpoint.py classify .claude/docs/adr` (226 ADRs scanned, table dialect):

- **amended (22):** adr-0006, adr-0009, adr-0012, adr-0014, adr-0016, adr-0032, adr-0033, adr-0035, adr-0036, adr-0038, adr-0041, adr-0042, adr-0043, adr-0046, adr-0078, adr-0095, adr-0103, adr-0111, adr-0112, adr-0113, adr-0117, adr-0220
- **newly_superseded (4):** adr-0007, adr-0025, adr-0032, adr-0033
- **newly_superseded_edges:** adr-0033→adr-0007, adr-0035→adr-0033, adr-0038→adr-0032, adr-0078→adr-0025

All 22 amendments trace to one commit (`96ebbd8d`, PR #1685/#1681, verified via `git show`): a mechanical ADR-0140 token-rename restatement (`--ui-*` → `--md-sys-*` prose sync in each ADR's own append-only Amendment section), no mechanism change. **Judgment: no harvest candidate.** This is bookkeeping catch-up on an already-ratified, already-current decision (ADR-0140 itself), not new signal against `save-lessons`' Phase 1 bar.

For the 4 `newly_superseded` targets, checked `origin/main`'s knowledge-pack corpus:

- **adr-0007** — cited in `.claude/skills/site-authoring/references/{best-practices,content-types}.md`, both citing the geometry-bands/subtree-scale mechanism that adr-0007's own header explicitly says **STANDS**. Not stale.
- **adr-0032** — cited in `.claude/skills/composition-patterns/references/surface-primitives.md` as "ADR-0032/0038" for the `[scale]` tier vocabulary, which adr-0032's own header says **SURVIVES**; already correctly paired with ADR-0038. Not stale.
- **adr-0025, adr-0033** — no citation found outside `adr-log-mechanics.md` (documents the pattern, not dependent on either ADR's superseded content). Nothing cites either — no candidate manufactured.

`adr-queue.json`: unchanged — still 1 pending row (adr-0129, harvest), no new candidates this firing.

`adr-checkpoint.json`: advanced (this firing's delta was judged with zero candidates).

### Revalidation mode: sample (cursor 45→50)

Sampled adr-0047 through adr-0051 (all `adr-decision`, table dialect):

| id | verdict | reason |
|---|---|---|
| adr-0047 | confirmed | `text-field.ts` implements `TYPE_CONFIG` v2 exactly as decided |
| adr-0048 | confirmed | `UICalendarElement extends UIFormElement` ships matching the ARIA-on-parts + bespoke grid-nav design |
| adr-0049 | **falsified** | family-barrel budget re-based 16→22→23 KB (Amendment 1); `scripts/measure-size.mjs`'s own comment ladder has since re-based it well over a dozen more times, unfed back except one rung ADR-0040 caught — current live budget is 70.5 KB, ~47 KB past adr-0049's last recorded figure. Same defect class as the already-queued adr-0040 finding, distinct claim id. |
| adr-0050 | confirmed | `ui-form-connect` protocol event + `traits/form-registry.ts` reactive registry + AbortSignal-driven deregistration all present exactly as decided |
| adr-0051 | confirmed | `setFieldLabelling`/`applyFieldLabelling`/`announceFormConnect` all present, upgrade-order catch-up wired per cl.5 |

### Next steps (named, not run by this agent)

- **adr-0049 falsified** → `file-task` against the ADR/measure-size ownership seam (the same underlying fix that would resolve adr-0040 also resolves this — worth batching one ticket covering both claim ids' root cause, not two).
- The 7 pre-existing falsified/untestable rows (adr-0036/0038/0040/0041/0042/0043/0046) are unresolved holdovers.
- adr-0129 harvest candidate (unchanged, pending) still needs `/make-pack` dispatch.

Unattended firing — no human in the loop, so the batched `AskUserQuestion` confirm over both scratch queues is deferred, not attempted.
