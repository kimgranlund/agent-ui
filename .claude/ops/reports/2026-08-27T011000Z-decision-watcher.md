## Decision-watcher sweep — 2026-08-27T01:10:00Z (repo: agent-ui)

### Forward mode: clean no-op

`adr_checkpoint.py classify .claude/docs/adr --checkpoint .claude/ops/adr-checkpoint.json` against the freshly re-baselined checkpoint (main@227c87d4): **226/226 ADRs scanned, nothing changed** — no new/amended/newly_superseded delta. This confirms the incidental `reap-scratch-clones.mjs` selftest fix (commit `9a62617f`) genuinely touched no ADR content, and confirms the queue-clear on adr-0030/0032/0033/0035 landed as reported (those rows are gone from `revalidation-queue.json`; they still sit as **harvest** candidates in `adr-queue.json`, a separate, already-queued concern, unaffected).

Per the no-op clause: no checkpoint/queue mutation, no fenced payload for `.claude/ops/adr-checkpoint.json` or `.claude/ops/adr-queue.json` this firing. For context only (not a write): `adr-queue.json` still carries **7 pending harvest rows** (adr-0129, adr-0021, adr-0025, adr-0030, adr-0032, adr-0033, adr-0035) awaiting a human batch-confirm — untouched by this firing.

### Revalidation mode: cursor 40 → 45, sampled adr-0042..adr-0046

All five are ADR-decision claims (0 IDR/0 RDD in the corpus — `.claude/docs/idr/` has none locked, `.claude/docs/rdd/` is just its README, so the script's `0 IDR, 0 RDD` count is correct, not a bug).

| id | kind | verdict | reason |
|---|---|---|---|
| adr-0042 | adr-decision | **falsified** | Decision cl.2/cl.4 name `--ui-compact`/`--ui-widget-inset`; ADR-0140 renamed both. Mechanism + values are byte-correct in shipped `indicator-element.ts`/`dimensions.css` — only the ADR's own token spelling is stale. Already tracked in `agent-ui#1681`. |
| adr-0043 | adr-decision | **falsified** | Decision cl.5 names `--ui-compact` verbatim (same ADR-0140 rename). Substantive geometry-boundary point is correct. **Not** in #1681's 24-candidate list — a genuinely new instance that sweep's regex missed. Appended to #1681 as a 25th instance by the dispatching session. |
| adr-0044 | adr-decision | **confirmed** | `-webkit-text-security: disc/none` reveal-toggle mechanism verified byte-for-byte in `text-field.css:369-378`; no stale tokens, no drift. |
| adr-0045 | adr-decision | **confirmed** | All four rulings verified live in `overlay.ts`/`combo-box.ts`/`selection-commit.ts`: platform-owned Escape/light-dismiss (combo-box carries no Escape handler by design), `restoreFocus()` targets `anchor` not `activeElement`, `close()`'s `:popover-open`-first resilience, `selectionCommit`'s Enter `preventDefault`. 0.25rem anchor gap literal still matches. |
| adr-0046 | adr-decision | **falsified** | Two separate problems on one claim: (1) stale `--ui-space-md/-lg`/`--ui-radius-base` prose (ADR-0140 rename, already in #1681's 24-candidate list); (2) **new** — the file's literal last line (415) reads `(unchanged). **Status: proposed** — awaiting Kim's ratification.` immediately after Amendment 6 refinement's own `**Status: accepted**` (line 414) and after the header blockquote's own accepted Status cell — an orphaned, self-contradicting fragment with no heading of its own. Shipped `card.css`/`card-content.ts` confirm every substantive Amendment-6 mechanism (scrollbar-hide, `:has()` focus-ring, restored inline margin) is correctly implemented — the fragment reads like stray leftover text, not a real pending decision. Filed separately as agent-ui#1682 by the dispatching session. |

Next steps named by decision-watcher (executed by the dispatching session): adr-0043 appended to `agent-ui#1681`'s candidate list; adr-0046's orphaned line-415 fragment filed as a new task, `agent-ui#1682`, asking for an appended dated Amendment (append-only) that either explains or strikes the stray trailing sentence — kept distinct from the token-rename fix.

Batched confirm: deferred — unattended `/sweep-chores` firing, no human present to run the `AskUserQuestion` round now.
