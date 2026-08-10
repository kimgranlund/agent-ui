# Decomposition — ui-conversation declarative composition (GH #688)

> Status: proposed · v1 · 2026-08-10 · Layer: decomposition (two-plane manifest, coverage-checked
> inline) · Companion to [ADR-0180](../adr/0180-conversation-declarative-composition-opt-in.md)
> (proposed) + [`conversation-declarative-composition.lld.md`](../lld/conversation-declarative-composition.lld.md).
> Whole build BLOCKED pending Kim's ADR-0180 ratification — this manifest sequences it, it does not
> authorize it.

## Plane 1 — outside-in (parts)

| Part | What it is | Inputs (executable from these alone) |
|---|---|---|
| P1 | ADR-0180 — the SPEC-R4/ADR-0129 opt-in carve-out (proposed; Kim-gated) | GH #688 · SPEC-R4 · ADR-0129 · conversation.md:102 |
| P2 | `ui-conversation-dialog` — new element (`conversation-dialog.{ts,css,md}`): the log's mechanical role promoted (scroll region · `role=log`/`aria-live=polite` via internals · `isNearBottom()`/`followTail()` per ADR-0023 seam) | LLD §3 · conversation.ts `#isNearLogBottom`/`#tailFollowLog` (:1027–:1076) |
| P3 | `ui-conversation-header` — new element (`conversation-header.{ts,css,md}`): fully author-composed non-scrolling band | LLD §2 |
| P4 | `ui-conversation` adoption seam — `connected()` adopt-or-create + band-order normalization; internal log vehicle promoted `div[data-part=log]` → JS-created `<ui-conversation-dialog>` | LLD §4 · conversation.ts `connected()` (:347–:400) |
| P5 | CSS migration — `[data-part='log']` rules → dialog sheet; header band tokens; host stays the flex column | conversation.css:59–84 · LLD §5 |
| P6 | Docs + gates — `conversation.md` slots/childModel/aria rows restated; two new descriptors; trip-wires; size re-base; browser parity | LLD §6–§7 · SPEC-R10/R11 |

Dependency edges: P1 → everything (ratification gate). P2, P3 independent of each other. P4
depends on P2 (creates/adopts the element). P5 depends on P2+P3 (their sheets exist). P6 last.

## Plane 2 — inside-out (actions the change must support)

| Action | Covered by |
|---|---|
| a1 Author composes header+dialog+composer declaratively → auto-wired | P4 (+P2/P3) |
| a2 Author composes nothing → byte-behavior-identical default (a2ui-chat/a2ui-live/agent-admin) | P4, P2 |
| a3 Partial authoring (any subset) → missing bands created, canonical order normalized | P4 |
| a4 Full imperative API (`addUserMessage`/`beginAgentTurn`+handle/`reset`/`setContentRenderer`/`setEmptyState`) identical on both paths | P4 (path-blind `#log`/`#composer` seating) |
| a5 Scroll-follow + `aria-live` + stick-to-bottom guard preserved exactly (SPEC-R4 AC2) | P2, P5 |
| a6 Header stays visible while the dialog scrolls beneath it | P3, P5 |
| a7 reset/emptyState/adopted-children lifecycle defined (no undefined DOM states) | P4 |
| a8 Standing gates: descriptor trip-wires · catalog invisibility (SPEC-R10) · size re-base (SPEC-R11) | P6 |
| a9 No build before ratification (proposed-marker is the real gate) | P1 |

## Coverage check (inline)

Every action a1–a9 names ≥1 owning part; every part P1–P6 carries ≥1 action (P1←a9 · P2←a2/a5 ·
P3←a6 · P4←a1/a3/a4/a7 · P5←a5/a6 · P6←a8). No orphan parts, no uncovered actions. Clean.

## Build slices (one writer per file; sequenced, post-ratification only)

1. **S1** — P2 (`conversation-dialog.{ts,css,md}` + unit tests).
2. **S2** — P3 (`conversation-header.{ts,css,md}` + unit tests). May run parallel to S1.
3. **S3** — P4+P5 (`conversation.ts` adoption seam + CSS migration + `conversation.md` restate) — one slice: the seam and the sheet move together or the default path breaks mid-wave.
4. **S4** — P6 (browser parity + declarative-composition browser tests + size re-measure).
