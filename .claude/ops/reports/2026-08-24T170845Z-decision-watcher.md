# decision-watcher — sweep 2026-08-24T17:08:45Z

## Forward mode
Clean no-op: `adr_checkpoint.py classify .claude/docs/adr` — 226 ADR(s) scanned, 226 previously
known, nothing new/amended/newly_superseded. Checkpoint not touched (no delta to advance past).

## Revalidation mode
Sampled (cursor 10 -> 15): adr-0011, adr-0012, adr-0013, adr-0014, adr-0015.
IDR pool: 0 (dialect gap — see Attention below). RDD pool: 0 (ruled zero-RDD placeholder, expected).

| id | kind | verdict | reason |
|---|---|---|---|
| adr-0011 | adr-decision | confirmed | `readActionSpec` (renderer/wire-tolerances.ts) still reads canonical `action` over the `name` synonym; `context`/`wantResponse` surfaced off the same object shape. |
| adr-0012 | adr-decision | confirmed | button.css still carries the position(slot)/role(data-role) split verbatim: icon sized to `--ui-button-icon`, caret sized to `--ui-button-glyph`. |
| adr-0013 | adr-decision | confirmed | dom/form.ts: `formProps.name` reflects; verdict hook is `formValidity()` per the 2026-06-27 amendment. |
| adr-0014 | adr-decision | confirmed | text-field.css: `--ui-text-field-border-focus: transparent` on `:focus-within`, outline ring sole indicator, per the 2026-06-28 amendment. |
| adr-0015 | adr-decision | falsified | Cl.1-3 (elevation/brightness model, `--ui-container-bg`/`--ui-container-tint` seam) hold unchanged. Cl.4/5 name `--ui-space-{...}` / `--ui-radius-base`; ADR-0140 (2026-07-18) renamed these to `--md-sys-space-{...}` / `--md-sys-shape-corner-base` — neither old name exists in `shared/src/tokens/dimensions.css` or any consumer CSS today. Queued, owner unassigned. |

Queued this firing: adr-0015:falsified (owner unassigned — no `owner:` field on this ADR's
blockquote-table record; unattended scheduled firing). 1 pending total.

Next command: `file-task` against ADR-0015 for an appended, dated amendment restating cl.4/5 under
the current `--md-sys-space-*`/`--md-sys-shape-corner-base` names, cross-referencing ADR-0140. No
functional rework needed — only the record's own text.

Batched confirm: deferred (unattended multi-seat scheduled firing, no human in the loop).

## Attention — IDR dialect gap (new finding, not previously ruled)
`revalidation_checkpoint.py`'s IDR parser requires YAML frontmatter (`doc-type: idr`, `status:
locked`). agent-ui's `.claude/docs/idr/*.md` carries no frontmatter — H1+blockquote-status-table
dialect, `proposed · accepted · superseded` vocabulary, no `locked` state exists in this repo's IDR
tier at all (idr-0005's own table). Result: the IDR arm of Revalidation mode has sampled 0 claims
every firing since inception. Distinct from the already-ruled RDD placeholder gap. Detect-only per
this agent's boundary — not fixed here.
