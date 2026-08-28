## decision-watcher — 2026-08-28T01:15:00Z firing (forward + revalidation)

**Forward mode: clean no-op.** `adr_checkpoint.py classify .claude/docs/adr --checkpoint .claude/ops/adr-checkpoint.json` scanned 226 ADRs against 226 checkpointed entries — nothing new/amended/newly_superseded. Checkpoint not advanced, no queue mutation. `adr-queue.json` stays as-is: 1 row (adr-0129, unchanged since 2026-08-25).

**Revalidation mode: 5 claims sampled, cursor 55→60.** All 5 sampled claims were ADR Decisions:

| id | kind | verdict | reason |
|---|---|---|---|
| adr-0057 | adr-decision | confirmed | "no intent by color alone" rule spot-checked against `field.css`/`badge.css` — both still co-carry a non-color signifier alongside the color role. |
| adr-0058 | adr-decision | **falsified** | Decision pinned the reserved `-selected` intent-sibling remedy to `light-dark({f}-550, {f}-600)` with numeric AA proof; `references/tokens.md` (edited post-ADR, after a 2026-07-10 ramp rework) now states the `550` light leg no longer clears and repoints the remedy to `light-dark({f}-600, {f}-600)`, flagging re-verify per family. The deferral itself still holds (no filled intent control exists yet to trigger activation) but the ADR's own pinned numbers are stale. |
| adr-0059 | adr-decision | confirmed | `--md-sys-color-neutral-track`/`-track-hover` still minted in `tokens.css`; `switch.css`/`slider.css` still repoint to them exactly as decided. |
| adr-0060 | adr-decision | confirmed | `admit.ts` still carries the DI'd `Judge` seam and the eval-facet fail-closed `E_LEAK` rejection, both cited to ADR-0060 inline. |
| adr-0061 | adr-decision | confirmed | `heal.ts`'s `HealResult`/`heal()` signature matches the Decision verbatim. |

Next step, named not run: `file-task` against `.claude/docs/adr/0058-defer-intent-fill-selected-roles.md` and `.claude/docs/references/tokens.md`, asking for an appended amendment that re-verifies and re-pins the four intent `-selected` remedy formulas against the current ramp before any future activation, since the ADR's own numbers would mint wrong values today.

No human present in this unattended fan-out firing — the batched confirm is deferred, not attempted.
