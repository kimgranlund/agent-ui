## decision-watcher — forward mode + revalidation mode, firing 2026-08-27T23:20:00Z

### Forward mode: classify

`adr_checkpoint.py classify .claude/docs/adr` (226 ADRs scanned, table dialect):

- **amended (2):** adr-0040, adr-0049
- no `newly_superseded` this round

Both amendments trace to one commit (`720b907d`, PR #1688/ticket #1687): the restatement amendments that closed the two falsified-verdicts this agent queued 2026-08-26/2026-08-27T18:00:00Z. Both ADRs' own text self-classifies the restatement under `doc-standards/references/adr-log-mechanics.md`'s "4th shape" (partial supersession left unrestated), citing the ADR-0030/0032/0033/0035 precedent. Checked against `origin/main`: `adr-log-mechanics.md`'s worked-instances list (9 entries, adr-0007 through adr-0035, dated 2026-08-21–2026-08-26) does NOT yet include adr-0040 or adr-0049 — genuinely new instances.

**Judgment: harvest candidate, extend the existing reference** — plus a flagged open question for the human: the documented 4th-shape trigger is a LATER ADR's header-recorded supersession of a clause; adr-0040/adr-0049's own `Supersedes/Superseded by` cells read "None" — the drift here is against `scripts/measure-size.mjs`'s own comment-ladder value, not another ADR's clause, so this may warrant its own named 5th shape rather than folding into the 4th.

`adr-queue.json`: 2 new rows queued this firing (adr-0040 harvest, adr-0049 harvest) — 3 pending total (adr-0129 unchanged from prior firings).

`adr-checkpoint.json`: advanced.

**Not self-cleared, per the standing boundary:** `revalidation-queue.json`'s adr-0040/adr-0049 falsified rows are reported by the dispatching session as separately resolved via #1687/PR #1688 — named here for the dispatching session's own `queue-clear` call, not cleared by this agent.

### Revalidation mode: sample (cursor 50→55)

Sampled adr-0052 through adr-0056, each verified against live code plus a green test run:

| id | verdict | reason |
|---|---|---|
| adr-0052 | confirmed | `container-box.css` still carries `isolation: isolate` on `:where([data-box])`; the z-index≥20 rejection probe still passes |
| adr-0053 | confirmed | all six catalog rows present verbatim in `catalog/default/factories.ts`; `factories.test.ts` green |
| adr-0054 | confirmed | `submit: true` action flag + `WidgetFactory.submitGate` + `#wireAction`'s gate branch all present; `renderer.test.ts` green |
| adr-0055 | confirmed | `packages/agent-ui/a2ui/src/examples/` ships the seed shelf + `"./examples"` subpath export; `examples.test.ts` green |
| adr-0056 | confirmed | `card.css`'s region-less fallback still present (now also excludes `[slot='hero']` — an elaboration, not a contradiction); `card.test.ts` green |

All five confirmed — nothing queued this round. Cursor advanced 50→55.

### Next steps (named, not run by this agent)

- adr-0040/adr-0049 harvest candidates → extend `.claude/skills/doc-standards/references/adr-log-mechanics.md`'s 4th-shape worked-instances list (or, on human review, split a 5th shape for script/config-value drift with no ADR-to-ADR supersession).
- adr-0129 harvest candidate (unchanged, pending since 2026-08-25) still needs `/make-pack` dispatch.
- `revalidation-queue.json`'s adr-0040/adr-0049 rows → `queue-clear` once the dispatching session confirms #1687/PR #1688 resolved them.

Unattended firing — the batched `AskUserQuestion` confirm over both scratch queues is deferred, not attempted.
