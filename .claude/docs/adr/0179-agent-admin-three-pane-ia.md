# ADR-0179 — agent-admin three-pane IA: [Chat | Author | Settings] as first-class places, place-based context routing, the wide-width settings pairing

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-09
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-09 |
> | **Proposed by** | design intake for [GH #651](https://github.com/kimgranlund/agent-ui/issues/651) (Kim's 2026-08-09 IA ruling, restated as contract here) — decomposition [`admin-three-pane-ia.decomp.md`](../decompositions/admin-three-pane-ia.decomp.md), two-plane coverage clean |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-09, via the [`ratify ADR-0179` utterance](https://github.com/kimgranlund/agent-ui/issues/651#issuecomment-5233684511) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
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

## Amendment (2026-08-10, **ratified** — Kim, [utterance](https://github.com/kimgranlund/agent-ui/issues/662#issuecomment-5235141210), verified 2026-08-10) — cl.1's WIDE reading becomes the TRIPLE dock `[chat | author-chat | settings]`; cl.3's arrangement law extends to three; cl.2's selector re-keys from pane to composer ORIGIN

> Append-only, and **proposed**: the Status cell reads `accepted` for the record as a whole and stays
> byte-untouched — agents never flip status (`.claude/hooks/adr-status-guard.py`), and this amendment
> carries no ratification of its own until Kim gives one. Every accepted section above is unedited.
> The build that carries it is GH [#662](https://github.com/kimgranlund/agent-ui/issues/662) (S6 of the
> GH [#651](https://github.com/kimgranlund/agent-ui/issues/651) family), with the LLD's §2/§5 rows
> re-stated in the same change (`../lld/admin-three-pane-ia.lld.md`).
>
> **2026-08-11 correction (S7-e record-repair pass, found by doc-checker review of the GH #686
> Amendment's own identical fix below).** The "**proposed**… this amendment carries no ratification
> of its own until Kim gives one" sentence above was accurate when drafted and went stale the same
> day this amendment's own heading gained its "**ratified**" line (Kim's
> [utterance](https://github.com/kimgranlund/agent-ui/issues/662#issuecomment-5235141210), verified
> 2026-08-10) — a same-day edit that updated the heading but left this paragraph's own prose
> narrating the pre-ratification state, exactly the contradiction pattern the GH #686 Amendment
> below carried and this same slice corrected. GH #662 (S6) shipped against the ratified amendment
> the same wave; the whole GH #686 family (S7-a through S7-e) has since shipped on top of it. The
> stale sentence is left quoted above, not deleted, per this repo's append-over-edit-in-place
> ledger law — read it as describing the moment before ratification, not the record's current state.
>
> **What this re-rules, precisely.** cl.1's *tier* sentence — "places, all three, at every width" —
> stands; what changes is what "a place" costs at wide. cl.3's law — arrangement of the ONE settings
> region, never duplication, never a runtime reparent — stands and now governs three regions instead
> of two. cl.2's *survive* list stands byte-for-byte; its one SELECTOR sentence is re-ruled. cl.4
> stands entirely and is in fact what makes the re-keying possible. Nothing in Consequences moves.

**Why cl.1's wide reading changes.** cl.1 was ratified against a surface that did not exist yet. The
disjoint-places reading was the honest call at intake and the LLD flagged its one visible cost openly
(§15's first risk: "today's wide first paint is chat + settings; post-S1-b it is Chat alone", with the
recommendation "ship disjoint; show Kim early"). That is exactly what happened — the family shipped,
Kim looked at the finished surface, and ruled the other way (2026-08-10, GH #662): at wide the test
chat, the Builder interview and the settings rail sit SIDE BY SIDE. This is pixel-truth superseding a
paper reading, which is the process working, not a defect in it. The `[chat | author | settings]`
vocabulary cl.1 pinned is unchanged; the three places simply stop taking turns once there is room.

**The amended reading of cl.1.** Three first-class places at every width, arranged in two bands:

- **Below the triple line** — exactly the place the nav names has a box. Chat solo, or the
  Author⇄Settings pair (itself drilling into one region below the master-detail's own 40rem line).
  cl.1's original wide reading survives intact as this band's contract.
- **At and above the triple line** — the TRIPLE DOCK: all three regions paint side by side, in that
  reading order. The nav still names a place; it no longer gates one.

**cl.3 extended, not stretched.** The triple is arrangement of the same three singleton regions —
zero duplication, zero runtime reparenting, no second mount of anything. The pane holder becomes a
flex row of the Chat conversation plus the existing `ui-master-detail`; the master-detail, its two
pane elements and the five section units are byte-identical nodes in both bands. The visibility
mechanism moves from a `hidden` attribute written by `#applyPane` to a `data-pane` attribute written
by `#applyPane` and READ by the sheet against the holder's own inline-size — which keeps cl.3's
"never a JS layout decision" promise more literally than the attribute model did, since no resize
writes anything at all. Dropping the attribute is load-bearing, not incidental: a region that paints
in the triple must not simultaneously claim to be hidden, and `display:none` removes a non-painting
region from the a11y tree exactly as `hidden` did.

**The line: 52.5rem, measured, and the only one available.** `SHELL_COMPACT_BREAKPOINT`
(ADR-0150/0155) — the band ladder's own second line, which is precisely the escalation seam the LLD
§6 booked for this case ("a named drill-band seam citing `SHELL_COMPACT_BREAKPOINT` … never a third
number"). It is where it is by constraint, not by taste: the master-detail needs 40rem of its own
container or it drills in and the "triple" silently degrades to a pair, so the Chat column gets the
remainder, and 52.5rem is the first named line where that remainder still clears the engagement
floor. At the line, measured identically in Chromium and WebKit (holder 840px):

| region | box | content | floor (20ch) | margin |
|---|---|---|---|---|
| chat | 200px | 198px | 160px | 1.24× (composer 174px, 1.09× — the binding constraint) |
| author | 320px | 296px | 160px | 1.85× |
| settings | 320px | 296px | 160px | 1.85× (name field 270px) |

Above ~61rem the pair stops being floored and the three columns equalise (at a 1176px holder: 393 /
391 / 391). The floor holds at the line and everywhere above it, so this is BANDING — pair below,
triple at and above — not a cram, and no escalation is owed.

**cl.2's selector re-keys to ORIGIN — a correctness requirement the triple forced, flagged for Kim as
the one contract-touching finding in this slice.** cl.2 ruled that "pane identity replaces `#mode` as
`#contextFor()`'s selector". Below the triple line that is sound, because exactly one place paints and
so "the active place" and "the composer the user can reach" are the same thing. At the triple line they
come apart: both composers are on screen and typable at once. Under pane-keying, a turn typed into
CHAT's composer while the nav stood on Author resolved the AUTHORING quadruple — landing in the
interview transcript and, gate ON, patching the draft. That is the precise thing cl.4 promises cannot
happen ("Chat stays pure test holds by construction, not by policy"), and it was reproduced as a
negative control before the fix: the probe fails with `expected 'Concierge' to be 'Untitled agent'`
under the shipped selector.

The amended reading: `#contextFor()` is keyed by the **submitting composer's origin**. This is cl.4's
own property, not a new one — per-pane composers mean each composer IS a context, permanently, at
every band; pane identity was only ever a proxy for it. Consequences:

- **The fence is byte-untouched.** It keys off driving-store identity, never the selector. Origin
  STRENGTHENS it: the Chat composer cannot resolve `authoringStore` under any pane, band or timing.
- **cl.2's survive list is untouched.** Both conversations, the per-context histories, the session map,
  the gate conjunct, the GH #145 resets, the apply chain, the Builder persona — all byte-identical.
- **A named hazard closes for free.** The LLD §8 mid-defer pane-flip misroute (a deferred client turn
  reading `#contextFor()` at RUN time and routing to whatever place the user had since walked to) is
  gone: the deferred turn now carries the origin it was spawned from.
- **`#pane` becomes purely navigational** — it says which place the nav names and nothing else.
- `origin` is a separate parameter, deliberately never a member of the runner's `turn` wire shape
  (SPEC-N1): which composer a turn came from is this element's routing business, not the runner's.

**No painted dividers between docked regions** (Kim, GH #662 Findings 2026-08-10). The split
separator's resting rule unpaints via a token repoint (`--ui-split-divider-ink: transparent` on the
admin's own splits) — the retract-don't-delete pattern: the separator element, its ≥24px hit-slop,
`role=separator`, tabindex, keyboard step and drag survive untouched, and the hover/drag cue is
deliberately LEFT PAINTED so the handle still answers a reach for it. Only the resting ink goes. The
repoint must land on the `ui-split` elements themselves — `split.css` declares the token in its own
`:where(ui-split)` block, and a locally-declared custom property beats an inherited one regardless of
ancestor specificity. Its descendant reach is intended: it covers the triple's separators AND the one
inside `ui-settings`'s nested rail|panel, so the law holds everywhere in this surface.

**The pane-nav persists at wide** (the slice's measured call, Kim-visible). It stays painted and
mechanically unchanged at every band. Hiding it above the line was the alternative: it buys back one
header strip and removes a click that repaints nothing once all three places are already on screen.
Rejected because a resize would then ADD AND REMOVE the surface's primary navigation — the worst
discontinuity on offer — and because the nav still does real work at wide: it is the sole vehicle
below the line, and its selection is what a wide→narrow crossing lands on. Deliberately NOT given
focus-move mechanics on activation: `ui-tabs` may activate on arrow traversal, so a tab that yanked
focus into its region would fight keyboard navigation. If Kim prefers it hidden above the line, that
is a CSS-only change in this file.

> **2026-08-10 addendum (Kim's follow-on ruling, GH #665):** hidden above the line after all — with
> the triple showing all three regions the pane nav reads redundant, and the S6 persist-at-every-band
> call above is overruled. Implemented exactly as this paragraph's own closing sentence anticipated: a
> CSS-only change in `agent-admin.css`, on the SAME container-query line the triple itself engages
> (54rem on the composed shell's own width — the 1.5rem offset from the pane holder's own 52.5rem line
> is the canvas box's own gutter, both sides; see that rule's comment for the full derivation). Below
> the line the nav remains untouched — it is still the drill-in's only vehicle there, and this ruling
> does not extend to it (flagged to Kim as a separate design question if he wants it gone everywhere).

**Alternative considered and rejected: a three-pane split vehicle.** Composing `ui-split` directly with
three panes (or widening `ui-master-detail` to a third position) would give a single uniform
arrangement instead of a flex row wrapping a nested master-detail. Rejected: it mints an MD API change
this family's Non-goals fence off (LLD §10), it discards the narrow drill-in that composing the shipped
element buys for free, and the nested reading is what makes the pair band and the triple band the same
DOM with two sheet readings rather than two arrangements to keep in sync.

**If Kim rules against this**, the fallback is exact: the band rule and the flex row revert (the holder
returns to a column with `data-pane` still driving one-place-at-a-time), and cl.1's disjoint reading
stands unchanged. The ORIGIN re-keying should NOT revert with it — it is a defect fix that happens to
have been found by the triple, and the pane-keyed selector is unsound the moment two composers can
share a screen. The divider unpaint is likewise independent of the arrangement.

## Amendment (2026-08-10, **ratified** — kimgranlund, [utterance](https://github.com/kimgranlund/agent-ui/issues/686#issuecomment-5242385245), verified 2026-08-10) — GH [#686](https://github.com/kimgranlund/agent-ui/issues/686), Kim's Figma wireframe ruling: cl.1's `header` slot becomes the UNIFIED selector/visibility/actions bar; the pane nav retires everywhere; pane visibility becomes ONE shown-set with two band renderings; the place vocabulary re-pins to `[Chat | Settings | Co-pilot]`

> Append-only: the Status cell reads `accepted` for the record as a whole and stays
> byte-untouched — agents never flip status (`.claude/hooks/adr-status-guard.py`). Every section
> above, including both prior amendments, is unedited. The design brief is
> GH [#686](https://github.com/kimgranlund/agent-ui/issues/686) (Kim's Figma wireframe — desktop nodes
> `1:162`/`1:163`, mobile node `1:502`); the LLD's corresponding revision lands in the same change
> ([`admin-three-pane-ia.lld.md`](../lld/admin-three-pane-ia.lld.md) §16).
>
> **2026-08-11 correction (S7-e record-repair pass, GH #686).** The two sentences this paragraph
> used to close on — "**proposed**: … this amendment carries no ratification of its own until Kim
> gives one via a real GitHub utterance" and "No build dispatches until Kim rules" — were accurate
> the moment this amendment was drafted (2026-08-10, before ratification) and went stale the same
> day once the heading directly above gained its own "**ratified**" line (kimgranlund's
> [utterance](https://github.com/kimgranlund/agent-ui/issues/686#issuecomment-5242385245), verified
> 2026-08-10 by `adr_ratify.py`'s ADR-0149 path) — a same-day edit that updated the heading but left
> this paragraph's own prose narrating the pre-ratification state. Four build dispatches (S7-a
> through S7-d) then shipped against the ratified amendment, and this S7-e slice is the fifth and
> last (LLD §16.4's own S7-e row). Removed the two stale sentences rather than leaving them to
> mislead a future reader — the original text is preserved in git history, not deleted from the
> record. This amendment's own closing "If Kim rules against this" paragraph, below, carries the
> same class of staleness in its premise ("this amendment ships nothing until ratified, so the
> fallback is the shipped surface itself") — left as-is (a real hypothetical fallback, still
> correctly describing what "rules against this" would mean), but "the shipped surface itself" no
> longer means the pre-#686 pane-nav+MD surface that sentence was written against: S7-a→S7-e already
> shipped past it, so a revert today would be a REAL rollback of built work, not a no-op.
>
> **What this re-rules, precisely.** cl.1's *tier* sentence — three first-class places at every
> width — stands; what changes is the places' NAMES and reading order, the header slot's contents,
> and how "which places paint" is chosen. cl.2's survive list and the first Amendment's ORIGIN-keyed
> `#contextFor` stand byte-for-byte — origin routing is in fact what makes independent visibility
> SOUND (multiple composers on screen stops being the triple's special case and becomes the norm).
> cl.3's law — arrangement of singleton regions, never duplication, never a runtime reparent —
> stands and now governs every visibility SUBSET, not two fixed bands. cl.4 stands entirely.
> Superseded-in-part: the first Amendment's fixed pair/triple BANDING and its
> pane-nav-persists/pane-nav-hidden arc (the GH #665 addendum included — moot once the nav retires
> everywhere), and cl.1's original `header` = pane-nav reading.

**The unified header (cl.1's slot contract, re-ruled).** The `header` slot stops holding the pane
nav and holds ONE three-zone bar — absorbing the site page's own canvas-header, which retires
(`site/pages/agent-admin-app.ts`: title/tagline + roster `ui-menu` + the `(...)` overflow):

- **Leading — the agent selector.** A component-composed `ui-select` naming the active agent; the
  roster CONTENT and the switch handling stay page-owned, reaching the component through
  registration seams (below). The page's title/tagline pair retires — the selector IS the identity.
- **Center — pane visibility.** Wide: three toggle pills — Chat · Settings · Co-pilot, each
  icon + label + an Eye/EyeSlash state icon, independently on/off. Narrow: the SAME three, as an
  icon-only `ui-segmented-control` — mutually exclusive, one pane at a time. One state, two
  renderings (the model below).
- **Trailing — actions.** Wide: New Agent (Plus) · Import · Export as direct buttons. Narrow:
  `+` plus a `•••` overflow menu holding Import/Export. **Reset is deliberately NOT here** — it
  moves into the Settings pane's Model fold as "Reset Agent" (Kim's original text ruling).

**The vocabulary re-pins: `[Chat | Settings | Co-pilot]`.** The Author place is renamed
**Co-pilot** (the Builder interview, unchanged in substance — Robot icon) and the reading order
becomes chat | settings | copilot, per the wireframe's own pane order (`chat-pane`,
`settings-pane`, `copilot-pane`). A NEW shared icon vocabulary binds the pills, the segments and
the panes: ChatsCircle (Chat) · GearSix (Settings) · Robot (Co-pilot).

**The visibility model — one source of truth, two renderings, never two state machines.** The
state is a shown-SET plus a primary member: `shown ⊆ {chat, settings, copilot}` (wide truth,
invariant `|shown| ≥ 1` — the last-on pill's toggle is refused, a zero-pane surface is broken by
construction) and `primary ∈ shown` (narrow truth). Wide pills write set membership (removing the
primary repoints it to the first remaining member in reading order); the narrow segment writes
`primary` (and ensures membership). Rendering follows the shipped triple-dock mechanism made
general: the one apply method writes `data-show` (the set) + `data-primary` onto the pane holder,
and the sheet renders set-members at and above the line, the primary alone below it. A resize
writes NOTHING — crossing wide→narrow projects the set to its primary, narrow→wide restores the
full set, both losslessly, because no crossing ever wrote state.

**The line: 52.5rem, the SAME named line — not OQ3's 40rem, and not a new number.**
`SHELL_COMPACT_BREAKPOINT` (ADR-0150/0155), the line the triple dock already engages and measured
against. The first Amendment's table measured the RETIRED arrangement (200/320/320 under flex 2:1 +
the MD's 40rem floor), so it does not carry over as evidence; the new equal-thirds geometry
re-derives directly: at the line (840px holder) three equal columns are ~280px box each, clearing
the 160px (20ch) floor with margin — but the settings column's ~256px content sits BELOW the 270px
name-field width the old table measured, so this arithmetic is a floor check only and the LLD books
a real-engine density re-measure into S7-b rather than resting on it. Justification for
reusing it rather than OQ3's 40rem or a third number: (a) the multi-select pills are only an honest
control where more than one pane can actually paint, and 52.5rem is the measured line where that
holds three-up; (b) one line means the header rendering and the pane arrangement swap together — a
second line would let the header promise multi-select while the surface can only fit one pane;
(c) the header-level CSS already has the derived 54rem composed-shell container query (the GH #665
rule's own derivation, which this amendment repurposes rather than re-derives). OQ3's 40rem line
LEAVES this surface along with its owner (next paragraph) — the accepted trade, stated openly: in
the 40–52.5rem band today's Author⇄Settings docked pair becomes one-pane-at-a-time (flagged to
Kim, OQ-F below).

**What the wireframe geometry forces: `ui-master-detail` retires from this composition.** The
all-active state (`1:162`) paints settings + copilot at 296px each — 592px total, below the MD's
own 40rem (640px) dock floor, so the wireframe cannot be painted while the MD remains the vehicle.
Independent subsets don't fit pair semantics either (the MD has no "detail alone at wide" state —
verified at the S1 intake). The pane holder becomes three sibling regions — the chat conversation,
the settings region (its internal `settings-nav` sub-nav and five section units untouched), the
Co-pilot conversation card — with visibility per the model above. cl.3's law survives the vehicle:
same singleton nodes, zero duplication, zero runtime reparenting; the no-painted-dividers rule
carries over. The live-fill acceptance re-anchors from "the Author pairing" to the visibility
state `{settings, copilot} ⊆ shown` — the adjacency Kim named as must-survive is now a user
CHOICE the default state grants, not a band the layout imposes.

**The wide-pill vehicle: the fleet has no `ui-toggle` — mint it.** The wireframe's pill (icon +
label + state icon, pressed/unpressed) matches no shipped control: `ui-switch` is a track-and-thumb
form control, `ui-segmented-control` is single-select by construction (extends the radio group),
`ui-button` carries no pressed state. Ruling: a small fleet `ui-toggle` (a pressed-state pill
button; `aria-pressed` via `ElementInternals`; emits `toggle` — already a member of the closed
seven-event set, ADR-0153). Alternatives rejected: an admin-local pressed-button hack (bespoke
state on a composed `ui-button` — exactly what the fleet exists to prevent, and the second consumer
would re-mint it) and widening `ui-segmented-control` with a `multiple` mode (radio inheritance
makes that a semantics fork, not a flag). Kim can overrule the vehicle at ratification without
touching the rest of this amendment.

**New registration seams (SPEC-R5's never-a-CustomEvent law; the `onGenerateRequest` idiom —
last registration wins, safe before or after connect (the GH #666 order rule); unregistered ⇒ the
affordance HIDDEN — a stated divergence from the precedent, which DISABLES its card
(agent-admin.ts:1318) because a card has copy worth showing disabled and a bare button does not).** The component cannot import site/persona code
(the DAG, `layering.test.ts`), so the page registers in:

```ts
interface AgentRosterEntry { id: string; label: string }
setAgentRoster(entries: readonly AgentRosterEntry[], activeId?: string): void  // data-in; re-callable (mint/import re-push)
onAgentSelect(callback: (id: string) => void): void      // roster commit → page's applyPersona
onNewAgentRequest(callback: () => void): void            // trailing "New Agent"
onImportRequest(callback: () => void): void              // trailing "Import" / narrow ••• item
onExportRequest(callback: () => void): void              // trailing "Export" / narrow ••• item
onResetRequest(callback: () => void): void               // "Reset Agent", Settings › Model fold
```

`onGenerateRequest` (the Co-pilot card's composer-first entry) is untouched.

**"Reset Agent" lands in the Settings pane's Model fold** — a component-rendered action at the end
of the `model-grid` fold's content (the GH #225 fold whose summary carries the "Model" heading),
invoking `onResetRequest`; hidden when unregistered. The page's "Reset persona" overflow item
retires with the overflow menu; any confirm step stays page-side business.

**Retires** (each a named RETIRE entry in the LLD's map): the pane-nav `ui-tabs` + its header bar +
`setPaneSeam` (cl.1's original vehicle; the GH #665 hidden-at-wide CSS rule goes with it — moot,
not overruled) · single-`#pane` state as the visibility truth (`#pane`/`#setPane`/`#applyPane`
re-shape into the shown-set model) · the `ui-master-detail` composition + its back-affordance
suppression CSS (the MD element itself is untouched fleet stock) · the site page's canvas-header
(title/tagline, `agentMenu`, `overflowMenu` — the page keeps mount + seam registrations only).

**Open questions — flagged for Kim, deliberately NOT ruled here** (the LLD §16 fences them;
recommendations only): **OQ-A** New Agent's verb — one button, two shipped mint paths (Blank ·
Generate); rec: the button invokes `onNewAgentRequest` and the page routes it to the Generate
flow, Blank's home is Kim's call. **OQ-B** the narrow `•••` contents — the wireframe implies
Import/Export only; rec: exactly those two, Reset stays Settings-only. **OQ-C** inter-pane
resizing — the MD's resizable split retires with it; the wireframe's equal columns suggest fixed
flex; rec: fixed flex, compose `ui-split` back in only if Kim asks. **OQ-D** the entry default;
rec: all three shown at wide (the wireframe's all-active state), `chat` primary at narrow.
**OQ-F** the 40–52.5rem band's behavior change (pair → single pane) — named above, Kim-visible.

**If Kim rules against this**, the fallback is exact: the header bar reverts to the pane nav, the
shown-set reverts to `#pane`, the MD composition stands, and the site page keeps its
canvas-header — this amendment ships nothing until ratified, so the fallback is the shipped
surface itself. The seam SHAPES (registration methods, SPEC-R5) should survive any partial
adoption — they are the only DAG-legal bridge regardless of which header wins.

## Addendum (2026-08-18, Kim's ruling on GH [#1260](https://github.com/kimgranlund/agent-ui/issues/1260) — [utterance](https://github.com/kimgranlund/agent-ui/issues/1260#issuecomment-5329856957)) — the GH #686/#665 12px gutters are REVERSED: edge-to-edge panel IA

> Append-only, dated in place. GH #1260 was filed as "a light hairline on dark shell surfaces"; the lane's
> real-engine pixel forensics traced it to the two DESIGNED gutters this ADR's Amendments minted —
> `[data-part='canvas'] { padding: --ui-agent-admin-shell-gutter }` (a page-background strip on all four
> shell edges) and `[data-part='pane-holder'] { gap: --ui-agent-admin-shell-gutter }` (a strip between
> every two regions) — `surface` showing through around `surface-low` cards. Kim ruled the gutters OUT
> (a deliberate reversal, by ruling, of the #686/#665 gutter design): the three regions meet the shell's
> edges and each other FLUSH; the seam between two painted regions is ONE hairline
> (`border-inline-start` on every painted region after the first in `PANE_ORDER`, derived from
> `data-show`; the `ui-conversation` cards drop their own border + radius inside this composition so no
> seam doubles and no card border stripes the shell's own edges or doubles the header's ADR-0166 seam)
> — a narrowing of GH #662's "no painted divider between top-level regions" for THIS seam only. The
> header band constant re-derives 54rem → 52.5rem (it was `SHELL_COMPACT_BREAKPOINT` + one gutter per
> side; the shell's inline-size IS the holder's now). `--ui-agent-admin-shell-gutter` itself survives as
> the header bar's own inline inset. Standing pin: `agent-admin-edge-to-edge.browser.test.ts` (both
> engines, 414×896 + 1280×800, dark + light — card↔shell-edge and card↔card |gap| ≤ 0.5px).
