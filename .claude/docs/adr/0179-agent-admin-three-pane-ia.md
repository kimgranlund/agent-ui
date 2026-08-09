# ADR-0179 — agent-admin three-pane IA: [Chat | Author | Settings] as first-class places, place-based context routing, the wide-width settings pairing

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-09
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-09 |
> | **Proposed by** | design intake for [GH #651](https://github.com/kimgranlund/agent-ui/issues/651) (Kim's 2026-08-09 IA ruling, restated as contract here) — decomposition [`admin-three-pane-ia.decomp.md`](../decompositions/admin-three-pane-ia.decomp.md), two-plane coverage clean |
> | **Ratified by** | *(unfilled — Kim ratifies; a `proposed` status is a real hold, never agent-flipped)* |
> | **Repairs** | on ratification+build: [`agent-authoring-flow.lld.md`](../lld/agent-authoring-flow.lld.md) §2 (dual-context + try-it rows), §5 (chat-stack/mode anatomy — mechanism survives, PLACEMENT superseded), §14 (S5 inheritance note gains the Author-pane pointer; its inherited-anatomy list — `#mode`/`#setMode`/`#contextFor` — re-states to the pane vehicle) · `agent-admin.md` (anatomy/parts rows) · [ADR-0131](./0131-agent-admin-ui-scope-and-composition.md) Fork 2 (layout reading superseded-in-part, see Consequences) · GH #650's try-it strip (placement superseded; probes' method + the `chat-shell.css` headerless fix survive) |
> | **Supersedes / Superseded by** | **Amends [ADR-0178](./0178-agent-authoring-conversational-persona-hydration.md) cl.5's VEHICLE only** — the flip affordance moves from an in-canvas strip to top-level pane navigation; cl.5's CONTRACT (one draft store, no identity swap, both transcripts survive — GH #145) stands byte-untouched. **Supersedes-in-part [ADR-0131](./0131-agent-admin-ui-scope-and-composition.md) Fork 2** (the `[chat | prompts | settings]` pane reading; the composition law itself — shipped M2/M4 primitives, no new primitive family — stands). Composes [ADR-0154] (chat-shell rehost — the shell stays the vehicle; what its strips MEAN changes) · [ADR-0150](./0150-compact-window-body-typescale-breakpoint.md)/ADR-0155 (the band ladder the "wide" line must come from) |

## Context

Today's agent-admin IA is one `ui-chat-shell`: content = the chat stack (test conversation +
lazily the Builder interview + the GH #650 try-it `ui-tabs` strip that flips between them), and
FIVE `options-pane` segments (Agent · Capabilities · Surface · Context: System · Context: Dialog)
behind the shell's own pane-tabs/narrow-tabs strips. The authoring family (GH #633, ADR-0178,
`agent-authoring-flow.lld.md`) landed the Builder interview *inside* Chat as a mode — and the
GH #646 pixel-truth arc (five follow-up commits on `task/646-try-it-tabs`, PR #650) spent real
effort making a strip-inside-a-strip read correctly, which is itself the evidence the placement
is wrong: two nav vocabularies compete on one surface, and "Authoring ⇄ Try it" is a place
switch wearing a mode toggle's clothes. Kim's #651 ruling: restructure to THREE first-class
panes — **Chat** (pure test surface) · **Author** (the Builder interview — a place, not a mode
of Chat) · **Settings** (the five sections grouped, internal sub-nav). The try-it toggle
*dissolves* rather than being solved.

The named tension: the generative flow's live-hydration adjacency — watching panes fill while
talking to the Builder — must survive the split. Working hypothesis (Kim's, #651): a
WIDE-viewport pairing (Author + a live settings rail, the app family's master-detail pattern),
with narrow widths paying the tab-switch cost.

## Decision

1. **Three first-class panes.** The admin's top-level navigation vocabulary becomes
   `[Chat | Author | Settings]` — three places, not six flattened section tabs plus an in-canvas
   strip. Settings groups today's five sections (Agent · Capabilities · Surface · Context:
   System · Context: Dialog) under ONE pane with internal sub-nav (vehicle: LLD-time, decomp
   OQ2). The concrete nav/shell vehicle is LLD business (S1-a), not this clause's — this clause
   pins the vocabulary and the tier: places, all three, at every width.

2. **Place-based context routing supersedes the mode seam.** Pane identity replaces `#mode` as
   `#contextFor()`'s selector: the Author pane's conversation drives with `authoringStore`, the
   Chat pane's with `this.store` — routing by WHERE, never by a toggle. The try-it strip
   (LLD-C9, reworked in #650) retires with the seam. Everything below the selector survives
   re-homing byte-identical, named so retirement can't overreach: both mounted conversations,
   the per-context histories (`#history`/`#authoringHistory`, GH #644), the runner's
   session-keyed `Session` map, the consumption fence + gate conjunct
   (`drivingStore === authoringStore ∧` gate ON — agent-admin.ts:1798 (post-#650 numbering; symbol: the `drivingStore === this.authoringStore` conjunct in the patch-receipt check), verified at intake), the
   GH #145 reset laws, the whole `persona-patch.ts` apply chain, the Builder persona, and
   #650's `chat-shell.css` headerless narrow-tabs fix + its screen-x probe method (fleet-shared
   facts that outlive the strip).

3. **The wide pairing is arrangement, never duplication.** At wide widths the Author pane pairs
   with the LIVE settings region beside the interview (the `ui-master-detail` idiom) — the SAME
   DOM region the Settings pane shows, arranged into adjacency, never a second mount of the
   section nodes (the shell family's visibility-only law, SPEC-R7c; the section content units
   are single light-DOM nodes and stay that way). Alternatives rejected: a duplicate settings
   rendering (two mounts of one store's sections — a sync liability the visibility-only law
   exists to prevent) and dropping adjacency at wide (loses the live-fill moment #651 names as
   the must-survive). Narrow widths show one pane at a time and pay the tab-switch cost —
   Kim's accepted trade, restated as contract. The "wide" line comes from the shell family's
   named band ladder (`shell-breakpoint.ts` — 40rem narrow / 52.5rem compact, ADR-0150/0155),
   never a new magic number; which named line is LLD business (decomp OQ3).

4. **OF-Kim — one-composer routing (the ratification's second question).** Recommendation:
   **IN** — the Author pane hosts its own composer permanently routed to the Builder; Chat's
   composer stays permanently the test context. Mechanics verified at intake: the consumption
   fence keys off the DRIVING store, not the mode seam, so an Author-pane composer IS the
   authoring context and the fence generalizes with zero widening — Chat can never drive
   `authoringStore`, so "Chat stays pure test" holds by construction, not by policy. The
   deeper single-interleaved-surface model (#646's declined-for-now note: one input, segmented
   per-message routing) stays OUT — it would reopen the dual-context anatomy this ADR
   deliberately preserves. Kim rules IN/OUT at ratification; S1's LLD binds the ruling.

## Consequences

- **Retires:** the try-it strip + its CSS + its placement probes (#650 supersession — probes'
  METHOD survives, repointed), `#mode`/`#setMode`/`#applyMode` as a mode seam, the chat-stack
  as a dual-conversation stacking vehicle, and the six-entry flattened narrow-tabs vocabulary.
- **Survives (cl.2's list):** the entire authoring mechanism — this is an IA change, not a
  contract change; ADR-0178's clauses stand, cl.5 amended in vehicle only.
- **PR #650 ships independently first** — this family supersedes its placement, not its
  mechanisms; the retirement slice builds against post-#650 main.
- **S5 (NL-edit everywhere) gains its natural front door:** the Author pane armed against an
  EXISTING persona's draft is exactly the entry shape LLD §14 fenced for S5's own intake.
  Named, not ruled — this family ships NO consumption-path widening (decomp OQ5).
- **Stale-context repairs ride the build** (header Repairs list): the authoring LLD's placement
  rows, `agent-admin.md`, ADR-0131's index note.

## Acceptance

Intake ADR, realized in stages: (this change) the fork recorded + the decomposition's coverage
clean; (ratification, Kim) status flip + the cl.4 IN/OUT ruling; (build, per the decomp's
slices) the 3-pane IA live at every band, the wide pairing's live-fill moment demonstrably
preserved (a browser proof at wide width, non-vacuous — panes visibly hydrate DURING an
interview turn without leaving Author), the strip retired, gates green by exit code.
