# LLD — the agent-admin three-pane IA (S1-a, the admin-three-pane family's one full-LLD slice)

> Status: proposed · v0.3 · 2026-08-10 (GH #686 amendment: §16 — the unified header + shown-set visibility, dated in place; supersession markers added to the §2/§3 rows it re-rules; the earlier S6/GH #662 re-statements — §2 rows, §5, §6, §8, §15 — untouched) · Layer: LLD (implementation plan)
>
> Refines: [ADR-0179](../adr/0179-agent-admin-three-pane-ia.md) (ACCEPTED 2026-08-09 — cl.1 the
> three-place vocabulary, cl.2 place-based routing + the named survive/retire lists, cl.3 the
> one-region wide-pairing law, cl.4 one-composer routing **RULED IN by Kim at ratification**:
> per-pane composers, pane identity replaces the mode seam, zero fence widening) ·
> [`admin-three-pane-ia.decomp.md`](../decompositions/admin-three-pane-ia.decomp.md) §S1 (the S1-a
> leaf this LLD fills; §1 grants S1 "full LLD" — acceptance lives inline here, §12; §4's OQ2/OQ3/OQ4
> are ruled here, each against the decomp's own recommendation) ·
> [GH #653](https://github.com/kimgranlund/agent-ui/issues/653) (ADR-0179's four booked record
> repairs — each is a named step in §13's build sequence; closing #653 is part of S4-a's DoD).
> This LLD **supersedes by citation** `agent-authoring-flow.lld.md` §5's PLACEMENT rows (chat-stack
> as a dual-conversation stacking vehicle, the `#mode` seam, the try-it strip) while inheriting its
> MECHANISM rows byte-identical — ADR-0179 cl.2's split, restated per-symbol in §7. The physical
> repair of that doc's §2/§5/§14 text is booked (§13 step 6), not duplicated here.
> Author: planner (design seat). No new ADR: every ruling below lands inside ADR-0179's grant; a
> contradiction found at build is an ESCALATION (a coordinated LLD/ADR repair), never a silent edit.
>
> **Composes on (every API verified against shipped source on main @ `af956bfc`+, not summaries):**
> `agent-admin.ts` (`#contextFor()` 1094–1108 — the ONE place `#mode` selects a context; the
> consumption fence's `drivingStore === this.authoringStore` conjunct 1798–1801 —
> selector-independent, verified; `#setMode` 1151 / `#applyMode` 1160–1171 /
> `#rewireAuthoringContext` 1176–1200; the try-it bar compose block 998–1040 + fields 368–369; the
> chat-stack 587–595; per-context histories `#history`/`#authoringHistory` 434–443, GH #644;
> `#handleSubmit` 1515 / `#runSurfaceTurn` 1624 — both already parameterized over `#contextFor()`) ·
> `master-detail.ts` (consumer-written reflected `selected` 48; `#view` derivation + the
> first-run-is-registration `select`/`change` pair 93–105; `#compose`'s fixed list-then-detail
> relocation 133–155; the control-rendered back affordance 160–166) · `master-detail.css` (the
> 40rem own-container drill-in 85–109 — the shell family's named narrow line; wide = pure composed
> `ui-split`, resizable, zero bespoke split code) · `super-shell.ts` (the `data-slot` vocabulary
> incl. `header` 55–61; `SLOT_ROLE` + the `data-landmark` override seam 68–91; `narrow-start/end ∈
> collapse·stack·tabs` 104–105) · `chat-shell.ts` (relocates authored children by the SAME
> `data-slot` vocabulary — the header slot is available to the admin, which composes headerless
> today) · `shell-breakpoint.ts` (`SHELL_NARROW_BREAKPOINT` 40rem · `SHELL_COMPACT_BREAKPOINT`
> 52.5rem = ADR-0150's number — the ONLY two legal "wide" lines, ADR-0155) ·
> `agent-admin-app.ts` (`applyPersona` 213 clears `authoringStore` first at 219;
> `createGeneratedAgent` 324–331; `NEW_AGENT_ACTIONS` 183) · `agent-admin.css` (chat-stack rows
> 174–186; try-it rows 189–216) · GH #650's shipped probes (`agent-admin.browser.test.ts` — the
> border-box screen-x method, e.g. the canvas/pane adjacency assert at 122–124).
>
> **Freeze discipline.** §9 is the fan-out contract for the builder seats — a builder who finds a
> seam unworkable STOPS and escalates, never improvises past this document. Two standing escalation
> triggers named up front: (a) if the wide pairing cannot be realized as ARRANGEMENT of the one
> settings region without reparenting or duplication, that is the decomp's named cl.3 risk —
> escalate, never mint a second copy; (b) if the S3-a density check fails at the 40rem line, the
> escalation is the §6 drill-band widening (the 52.5rem named line), never a third number.

## 1 · Intent

Restructure `ui-agent-admin`'s IA from one chat surface + five flattened section tabs + the
in-canvas try-it strip into THREE first-class places — **[Chat | Author | Settings]** — per Kim's
GH #651 ruling as ratified in ADR-0179. Chat becomes the pure test surface (its composer
permanently the test context); Author becomes the Builder interview's own place (its composer
permanently the authoring context — cl.4's IN ruling realized as per-pane composers); Settings
groups today's five sections under one place with internal sub-nav. At wide widths the Author
place pairs with the LIVE settings region (the `ui-master-detail` idiom — the SAME DOM nodes the
Settings place shows, arranged into adjacency, never a second mount), preserving the
live-hydration moment #651 names as the must-survive. `#contextFor()`'s selector re-keys from the
`#mode` seam to ACTIVE PANE — a one-line selector swap; everything below it (both conversations,
per-context histories, the session map, the consumption fence + gate conjunct, the GH #145 reset
laws, the whole apply chain) survives byte-identical. The try-it strip and the mode seam retire;
the six-entry narrow-tabs vocabulary dissolves.

## 2 · Fork sheet (every row decided; WHY one line each)

| Row | Ruling | Why |
|---|---|---|
| **Top-level nav vehicle** ⚠️ **SUPERSEDED (proposed) 2026-08-10 (GH #686) — the pane nav retires everywhere; the header slot becomes the unified selector/visibility/actions bar, §16** | An admin-owned, panel-less fleet `ui-tabs` strip — `data-part="pane-nav"`, three `ui-tab`s (Chat · Author · Settings, ADR-0179 cl.1's vocabulary verbatim) — authored into the chat-shell's **`header` slot** (`data-slot="header"`, `data-landmark="navigation"` via super-shell's shipped override seam). ONE vehicle at every band; `select` commits call `#setPane(...)`, `stopPropagation`'d (the try-it bar's own containment precedent — the host's closed event set is untouched). | The shell's own narrow-tabs machinery enumerates content + pane segments — structurally the SIX-entry vocabulary cl.1 retires; it cannot voice three grouped places, so the top-level nav must be admin-composed. The GH #221 panel-less `ui-tabs` composition is the shipped shape (the try-it strip's own — its composition method survives re-anchored one level up, which is exactly what "#650's placement superseded, method survives" means). Header placement makes the shell meaningfully the vehicle still (ADR-0154 composed, not hollowed) and re-joins the GH #575/#626 `--ui-bar-inline-inset` rhythm the #650 headerless split existed to patch around — the header-bearing arm now applies to the admin; the headerless arm survives as the fleet fact it already is. |
| **The pairing vehicle** ⚠️ **Author-region contents AMENDED 2026-08-10 (GH #666) — the region is ONE conversation card, armed or not; see the row below** · ⚠️ **SUPERSEDED (proposed) 2026-08-10 (GH #686) — the MD composition retires; the wireframe's all-active geometry cannot paint under its 40rem dock floor, §16** | `ui-master-detail`, composed inside the shell's `content` slot: `pane="list"` = the **Author region** (empty state + the lazily-mounted authoring conversation) · `pane="detail"` = the **Settings region** (sub-nav strip + the five section units, moved whole — TKT-0085's single reparent-able nodes, a compose-time re-home, never a runtime reparent). The admin's `options-pane`/`resizable-end`/`narrow-end` usage retires with the move. | cl.3 names the idiom; OQ3's rec names the element: composing it buys the docked resizable pair at wide (ui-split inherited, SPEC-R7's zero-bespoke-split-code law) AND the narrow one-place-at-a-time drill-in for FREE — the one shipped arrangement that gives Settings a full-surface narrow home (the super-shell grammar has no "end pane as sole surface" state; verified against `narrow-start/end`'s three arms). Pane assignment by visual truth: the settings region stays the END/right rail (its home since ADR-0154) and the interview reads primary — list-then-detail DOM order makes Author start-side. |
| **`#contextFor` re-keyed by pane — the frozen algorithm (cl.2's zero-widening move)** ⚠️ **RE-STATED 2026-08-10 (GH #662) — see the row below; this row records what S1-b shipped, the row below what the triple dock requires** | `#pane: 'chat' \| 'author' \| 'settings'` replaces `#mode` as component state (entry default `'chat'`). The selector: **authoring quadruple iff `this.#pane === 'author' ∧ this.authoringStore !== undefined ∧ this.#authoringConversation !== null`; else the test quadruple** — the literal diff from shipped 1101 is `this.#mode === 'authoring'` → `this.#pane === 'author'`, one token. Everything downstream — the quadruple's members, `#handleSubmit`/`#runSurfaceTurn`'s parameterization, the session map, the fence conjunct at 1798 — is byte-untouched. | The fence keys off DRIVING-STORE IDENTITY, not the selector (verified at intake and again here) — so re-keying the selector widens nothing: a Settings-pane or Chat-pane turn can never resolve to `authoringStore`, and "Chat stays pure test" holds by construction, cl.4's own mechanics. Stating the algorithm frozen is what lets S1-b's builder prove the zero-regression assert byte-wise. | *(conjunct LIST, not byte order — shipped line 1101's byte order keeps `authoringStore !== undefined` first; the one-token-diff sentence is the byte-wise claim)*
| **Per-pane composers (cl.4 IN, realized)** | Chat's `#conversation` keeps its composer, permanently the test context; Author's `#authoringConversation` keeps its own, permanently the Builder. No composer ever re-routes; no shared composer exists; submissions can only originate from the visible place's composer. | Kim's IN ruling verbatim — pane identity IS the routing. The deeper single-interleaved-surface model stays OUT (ADR-0179 cl.4's own fence). |
| **The Author region is ONE conversation card, armed or not** — **NEW 2026-08-10 (GH #666, Kim's pixel ruling: "the center pane should be a CHAT, just like Test chat")** | The Author pane holds exactly one child: `#authoringConversation`, mounted at `#compose()` time rather than on the first `authoringStore` assignment. Unarmed, its log carries the `author-empty` copy through `ui-conversation.setEmptyState()` (a new, additive, default-off seam on the fleet control — `setContentRenderer`'s own optional-hook shape) and its OWN bottom-pinned composer is the flow's entry; arming DROPS the copy and fills the same element. The `hidden` flips `#applyPane` used to make between two boxes are gone with the second box. | Kim shipped-surface ruling: the pre-#666-reopen arrangement rendered a borderless prose block beside a bordered chat card. The card treatment, the BUILDER INTERVIEW kicker and the bottom-pinned composer are `ui-conversation`'s own, so the only non-duplicative way to wear them is to BE one. This supersedes ADR-0178 cl.5's lazy-mount clause on cost grounds only: cl.5's dual-context mechanism (two mounted conversations, the reset law, the fence keyed off driving-store identity) is untouched. Per-pane composers (the row above) now read literally — one composer per place at every moment of the flow, with no second unarmed composer to keep in step. |
| **Settings place arrangement** | `#applyPane()` drives the MD's consumer-written `selected`: pane=`author` ⇒ `selected=''` (narrow view `list` = the interview); pane=`settings` ⇒ `selected='settings'` (narrow view `detail` = the settings region); pane=`chat` ⇒ the MD region `hidden`, the chat region shown. At WIDE the Author and Settings places converge on the SAME docked arrangement (both regions visible — the pairing); selection is still tracked so a wide→narrow band crossing lands on the place the nav says. MD's `select`/`change` emissions are contained (`stopPropagation` on the MD host — the closed-event-set discipline). | One region, arranged — never duplicated (cl.3). The convergence at wide is the honest reading of "three places at every width": at wide the settings region is on screen either way; the tab-switch cost is narrow's accepted trade (cl.3, Kim's restated contract). |
| **The back affordance** | Suppressed via admin CSS (`[data-part='back']` display:none, winning the scoped cascade on SPECIFICITY (the shipped `(0,4,2)` exact-chain selector beats the reveal's `(0,4,1)` — `:scope` counts as an ordinary pseudo-class and specificity compares BEFORE scope proximity, the fleet fact settings.css already records; a bare attribute selector could never win, no `!important`)). | The pane-nav is the ONE nav vocabulary — #651's whole point; MD's back flips `#view` without touching `selected`, which would desync the nav's truth. A future `ui-master-detail back="none"` attr is the cleaner fleet seam — named in §15, not minted here (no MD API change in this family). |
| **Chat is solo at every width** ⚠️ **SUPERSEDED 2026-08-10 (GH #662) — true BELOW the triple line only** | The Chat place shows the test conversation alone — no settings rail beside it, wide included. | Places are disjoint (cl.1) and Chat is "the pure test surface" (ADR-0179 Context). The settings node lives in the MD detail pane; a Chat-wide rail would need a reparent or second mount — cl.3's named escalation, not an improvisation. The tune-while-testing adjacency survives at wide as the AUTHOR pairing (hand-edit the draft beside the interview, decomp a5); flagged as a Kim-visible first-paint change in §15 — today's wide admin paints chat + settings. **§15's first risk fired exactly as written: Kim looked at the shipped surface and ruled the adjacency back in (2026-08-10, GH #662). The triple-dock row below is the resolution — and it needs no reparent and no second mount, so cl.3's escalation was never owed.** |
| **THE TRIPLE DOCK (2026-08-10, GH #662 — ADR-0179 cl.1's proposed Amendment)** ⚠️ **SUPERSEDED (proposed) 2026-08-10 (GH #686) — fixed pair/triple banding gives way to the user-chosen shown-set; the 52.5rem line, the `data-*`+container-query mechanism and the no-JS-layout law all carry over, §16** | Two bands, one DOM. `#applyPane` stops writing `hidden` onto the place regions and writes the active place onto the pane holder as `data-pane`; `agent-admin.css` reads that attribute against the holder's OWN inline-size (the holder is `container-type: inline-size`). **Below 52.5rem** exactly the named place has a box — every row above holds unchanged. **At and above 52.5rem** all three paint side by side: the holder is a flex row of the Chat conversation (`flex: 1 1 0`) and the existing `ui-master-detail` (`flex: 2 1 0; min-inline-size: 40rem`), giving `[chat \| author \| settings]`. | 52.5rem is `SHELL_COMPACT_BREAKPOINT` — §6's own booked escalation seam, never a third number — and it is forced, not chosen: the MD needs 40rem of its own container or it drills in and the triple silently degrades to a pair, leaving Chat the remainder. MEASURED at the line, both engines, holder 840px: chat 200 (content 198, composer 174) · author 320 (content 296) · settings 320 (content 296, name 270), against a 20ch floor of 160 — every column clears it, the Chat composer by the narrowest margin (1.09×) and therefore the constraint that SETS the line. The `2` share makes the three columns equalise once the MD floor stops binding (holder 1176 ⇒ 393/391/391). Dropping the `hidden` attribute is load-bearing, not cosmetic: a region that paints in the triple must not also claim to be hidden, and `display:none` takes a non-painting one out of the a11y tree identically. No ResizeObserver, no JS layout, no state written by a resize — the own-container-width law, kept more literally than the attribute model kept it. |
| **`#contextFor` re-keyed by composer ORIGIN (2026-08-10, GH #662 — cl.2's selector, re-ruled)** | The selector is the SUBMITTING COMPOSER'S ORIGIN, not `#pane`: authoring quadruple iff `origin === 'author' ∧ authoringStore !== undefined ∧ #authoringConversation !== null`, else the test quadruple. `origin` is threaded from each conversation's own `onSubmit`/`onClientMessage` registration through `#handleSubmit` and `#runSurfaceTurn` — a SEPARATE parameter, never a member of the runner's `turn` wire shape (SPEC-N1). `#pane` becomes purely navigational. | A CORRECTNESS requirement of the triple, not a preference. The pane key was sound while exactly one place painted, because "active place" and "the composer the user can reach" were the same thing. In the triple both composers are on screen and typable: a turn typed into CHAT's composer while the nav stood on Author resolved the AUTHORING quadruple — landing in the interview and, gate ON, patching the draft, which is exactly what cl.4 promises cannot happen. NEGATIVE-CONTROLLED before the fix (`expected 'Concierge' to be 'Untitled agent'` under the shipped selector). Origin is cl.4's OWN property — per-pane composers mean each composer IS a context, permanently; pane identity was only ever a proxy for it. The fence is byte-untouched (it keys off driving-store identity) and strictly strengthened, cl.2's survive list is byte-untouched, and §8's mid-defer misroute closes for free (a deferred turn carries the origin it was spawned from). |
| **No painted dividers between docked regions (2026-08-10, GH #662 — Kim's Findings addition)** | `--ui-split-divider-ink: transparent`, declared on `[data-part='pane-holder'] ui-split`. Resize MECHANICS untouched: the separator element, its ≥24px hit-slop, `role=separator`, tabindex, keyboard step and drag all survive, and `--ui-split-divider-ink-hover` is deliberately left painted. | Kim's 2026-08-10 ruling on the shipped pair — regions separate by spacing and surface alone. Retract-don't-delete: only the RESTING ink goes, so the handle still answers a reach for it. The repoint must land on the `ui-split` elements THEMSELVES — `split.css` declares the token in its own `:where(ui-split)` block, and a locally-declared custom property beats an inherited one regardless of ancestor specificity. The descendant reach is intended: it covers the triple's separators AND `ui-settings`'s nested rail\|panel, so the law holds everywhere in this surface. |
| **The pane-nav at wide (2026-08-10, GH #662 — the slice's measured call, Kim-visible; overruled by the GH #665 addendum)** ⚠️ **MOOT (proposed) 2026-08-10 (GH #686) — the nav retires at every band, §16** | PERSISTS, mechanically unchanged, at every band. No focus-move mechanics on activation. | Hiding it above the line buys one header strip and removes a click that repaints nothing once all three places are on screen; rejected because a resize would then ADD AND REMOVE the surface's primary navigation, and because the nav still does real work at wide (sole vehicle below the line; its selection is what a wide→narrow crossing lands on). Focus-move on activation was considered and rejected: `ui-tabs` may activate on arrow traversal, so a tab that yanked focus into its region would fight keyboard navigation. If Kim prefers it hidden above the line, that is a CSS-only change. |
| **OQ2 — Settings sub-nav vehicle (ruled: the segment machinery, per the rec)** | An admin-composed panel-less `ui-tabs` strip — `data-part="settings-nav"`, five `ui-tab`s labeled from the sections' kept `data-segment` attributes, `link()`ed per section (the `#nextId` aria-controls precedent), visibility-only flips (one section visible at a time, exactly the shell strip's SPEC-R7c behavior). | The rec adopted in vehicle: the same segment/tab machinery, one level down — visibility-only by construction, shipped metrics, #650's cross-strip equality probes transfer. Divergence in LETTER, flagged: the shell's own `#applySegments` instance no longer reaches the region (it left the shell pane for the MD), so the strip is admin-composed from the identical GH #221 shape (~30 lines, the try-it bar's pattern — its second re-anchoring). A rail idiom would mint a second nav vocabulary inside the pane that just shed one (the rec's own argument, unchanged). |
| **OQ3 — the wide line (ruled: the 40rem line, per the rec)** | The pairing docks/drills at `ui-master-detail`'s own 40rem own-container line (`SHELL_NARROW_BREAKPOINT`, master-detail.css 85). Never a third number. | The rec adopted: composing the shipped element gives the line AND the drill-in for free; own-container-width is the shell family's law. Static arithmetic check (this seat is docs-only; the real-engine check is booked into S3-a, §11): at the worst wide width (40rem = 640px) the pair splits ≈ 388px interview + 252px rail (the composed `ui-split`'s default EVEN flex split (≈320/320 at 640px) — `--ui-super-shell-pane-size`'s 252px is the retiring options-pane's shipped-width comparison and the §6(c) flex-basis polish target, not the vehicle's own math; both splits clear the 20ch floor) — above the conversation's 20ch floor and the settings pane's shipped width; the fleet default 414×896 viewport (ADR-0150's below-compact band) correctly lands narrow. Escalation if S3-a's density evidence fails: widen `ui-master-detail` with a named drill-band seam citing `SHELL_COMPACT_BREAKPOINT` (an ADR-0155-shaped follow-up) — §15. |
| **OQ4 — the Author empty state (ruled: always-present, per the rec)** | The Author place always exists in the nav. `authoringStore` unset ⇒ the region shows `data-part="author-empty"`: headline + copy + the flow-entry action ("New agent → Generate") invoking a NEW registration seam `onGenerateRequest(cb)` (the `UIConversationElement.onSubmit` registration idiom; SPEC-R5's never-CustomEvent law; the action hides when no callback is registered — the static-build degrade). Armed ⇒ the interview conversation shows, empty state hides. | The rec adopted: a first-class PLACE that vanishes isn't one; the empty state hosts a8's entry affordance where the user already is, and is exactly where S5's future existing-persona entry will live (OQ5's fence — named, NOT built; zero consumption-path widening). The callback seam is the smallest bridge to the page-owned mint path (`createGeneratedAgent`, reused verbatim) — the component cannot import site code (DAG). |
| **IA-entry re-point** | `createGeneratedAgent()` (site) stays byte-identical; the COMPONENT lands the user in Author: `#rewireAuthoringContext`'s arm branch calls `#setPane('author')` on a real `authoringStore` arm. Teardown never forces navigation (clearing while on Author shows the empty state — always-present). | a8's "lands IN the Author pane" with one line, at the one choke point every arm path already crosses; both entry affordances (roster menu + empty state) converge on the same page path. |
| **Retirement + seam split (S1-b vs S4-a)** | S1-b RETIRES THE SEAM: `#contextFor` re-keys to `#pane`, the try-it bar stops being composed, `setModeSeam`-anchored tests re-anchor to a `setPaneSeam` (same protected compile-time construct), mode-flip suites re-state in pane vocabulary. S4-a DELETES THE RESIDUE: `#mode`/`#setMode`/`#applyMode`/`#tryItBar`/`#tryItAuthoringTab` + the compose block 998–1040 + agent-admin.css 189–216 + the browser strip probes (method repointed, §11) — and executes #653's record repairs. | `#contextFor` cannot serve two selectors, so the seam necessarily flips at S1-b; deleting the residue earlier than S4 would strand a red intermediate state, later would leave two mode vocabularies live. The decomp's "mode seam stays load-bearing until pane routing is proven" is honored: the SYMBOLS survive till S4, inert, while the routing proof runs on panes. |
| **Events / catalog / naming** | No new host events (the closed seven-member set untouched); one new registration seam (`onGenerateRequest`); no new `ui-*` element; no catalog change; no new tokens beyond `pane-nav`/`settings-nav`/`author-empty` component-local CSS; `data-part="chat-stack"` renames to `data-part="pane-holder"` (it no longer stacks two conversations of one place — it holds the places). | The slice composes shipped primitives end to end; naming follows the thing it IS. |

## 3 · Pane anatomy (the composed DOM after S1-b)

```
ui-agent-admin
└── ui-chat-shell                       (the vehicle stays — ADR-0154/ADR-0179; resizable-end/narrow-end retire)
    ├── [data-slot="header"] div[data-part="pane-nav-bar"][data-landmark="navigation"]
    │   └── ui-tabs[data-part="pane-nav"]  — Chat · Author · Settings (panel-less, link()ed to the regions)
    └── [data-slot="content"] div[data-part="pane-holder"]        (was chat-stack)
        ├── #conversation (test — byte-unchanged)                  visible ⇔ pane = chat
        └── ui-master-detail[data-part="pane-pair"]                visible ⇔ pane ∈ {author, settings}
            ├── ui-master-detail-pane[pane="list"][data-part="author-pane"]
            │   └── #authoringConversation      GH #666: mounted at compose, armed or not
            │       └── [data-part="log"]
            │           └── [data-part="author-empty"]  seated ⇔ authoringStore unset
            └── ui-master-detail-pane[pane="detail"][data-part="settings-pane"]
                ├── ui-tabs[data-part="settings-nav"]              (§2 OQ2 — five tabs from data-segment)
                └── the five section units (Agent · Capabilities · Surface · Context: System ·
                    Context: Dialog — single light-DOM nodes, moved whole, one visible at a time)
```

Composition order matters twice: the MD's pane children must exist before the MD connects (its
static-composition law — the admin builds the subtree before appending, as `#compose` already
does), and the authoring conversation inserts into the RELOCATED `author-pane` element (same
node identity after MD's relocation — verified against `#compose` 147–148: whole elements move,
never their grandchildren). *(GH #666, 2026-08-10: that insert happens at compose time now, not on
the first arm — the relocation property it depends on is unchanged either way.)*

*(GH #686, 2026-08-10, proposed: this anatomy is superseded by §16.1's — the header slot's contents
change and the MD row dissolves into three sibling regions. This diagram stays as the shipped
record.)*

## 4 · Place-based routing (ADR-0179 cl.2/cl.4, realized)

- **State.** `#pane: 'chat' | 'author' | 'settings'`, entry default `'chat'` (content-first, the
  narrow content-tab's own precedent; §15 flags the default for Kim). `#setPane()` guards no-ops,
  sets `#pane`, calls `#applyPane()`. PRIVATE by contract, like `#setMode` before it: no
  attribute, no event, no `attributes[]` row; the pane-nav strip and `#rewireAuthoringContext`
  are its only callers; probes reach it via the protected `setPaneSeam` (the `setModeSeam`
  precedent, which it replaces).
- **`#applyPane()`** — visibility + arrangement, nothing else (no store touch, no reset, no
  serialization — `#applyMode`'s own discipline): chat region `hidden` ⇔ pane ≠ chat; MD region
  `hidden` ⇔ pane = chat; `md.selected = pane === 'settings' ? 'settings' : ''`;
  `paneNav.selected = #pane` (programmatic write — no `select` echo, ADR-0019); empty state vs
  interview visibility from `authoringStore` presence.
- **`#contextFor()`** — the frozen algorithm, §2's row verbatim: authoring quadruple
  (`authoringStore` / `#authoringConversation` / `'authoring'` / `#authoringHistory`) iff
  `#pane === 'author' ∧ authoringStore !== undefined ∧ #authoringConversation !== null`, else the
  test quadruple. One-token diff from shipped line 1101. Both turn arms (`#handleSubmit` 1515,
  `#runSurfaceTurn` 1624) are ALREADY parameterized over it — zero further edits there.
- **The fence, restated (not re-decided).** The consumption conjunct at 1798–1801
  (`drivingStore === this.authoringStore ∧` fresh gate read ON, target always `this.store`)
  ships byte-identical. Both polarities re-proven in the pane world (§11): gate-OFF on an
  Author-pane turn ⇒ `patchIgnored`; gate-ON on a Chat-pane turn ⇒ `patchIgnored`, zero writes.
- **Reset laws (GH #145 — inherited, zero new machinery).** A real `store` reassignment resets
  both transcripts + both histories (unchanged); an `authoringStore` identity change rebuilds only
  the authoring context and clears `#authoringHistory` alone (unchanged); `applyPersona` still
  clears `authoringStore` first (site, 219). New pane-world consequence: arm ⇒ `#setPane('author')`
  (§2 IA-entry row); clear ⇒ no forced navigation.
- **Degrade.** Runner unarmed: places all exist; Author submits run the prose/stub arm against the
  Builder's config; no patch arrives; panes don't hydrate — every persona's own degrade, unchanged.

## 5 · The Settings seam (what S2-a builds against)

S1-b ships the VEHICLE at parity: the region moved whole into the MD detail pane + the
`settings-nav` strip scaffolded mechanically from the five existing `data-segment` labels in
today's order — zero grouping decisions, so no intermediate commit loses a6 (every section
reachable). S2-a then owns the GROUPING pass inside this frozen boundary: final label set/order,
any fold-default polish, the strip's dense/narrow metrics, and the a6 acceptance probes. S2-a
touches ONLY the strip + section labels/order — never the section internals, the entry machinery
(ADR-0132/0164/0170, untouched by this family), the MD anatomy, or `#applyPane`. A grouping need
that can't be met inside that boundary escalates.

**Re-stated 2026-08-10 (GH #662), one row.** S2-a's ruled answer — `overflow="menu"` on the
`settings-nav` strip, GH #586's not-enough-room strategy — is unchanged and stays the vehicle. What
the triple dock moved is the measured PREMISE beneath its evidence: S2-a measured the rail at
388–390px across the bands the admin then ran at, where the two long `Context: …` tabs overflow at
every one of them. In the triple the rail is a third of the surface rather than half of it, so its
width now varies with the band in both directions — at the 40rem line the rail is 296px and the
overflow leg engages exactly as S2-a described, while at 52.5rem of the pair's own container it is
420px and all five labels fit outright. The a6 acceptance ("every section reachable at every band")
is unaffected and still holds by construction; only the ROAD it travels is band-dependent now, which
is why S3-a's density probe re-anchored its overflow leg to assert reachability by whichever road the
band offers rather than asserting that overflow occurs. **S2's own overflow-band flag is thereby
resolved rather than carried forward**: `overflow="menu"` is a strategy, not a fixed layout, so the
strip is correct in both regimes without a further ruling.

## 6 · The wide pairing (what S3-a builds against)

The arrangement is already live after S1-b (the MD docks at ≥ 40rem own-container — §2 OQ3). S3-a
owns: (a) the non-vacuous live-fill browser proof at wide, both engines — during a scripted
interview turn, with the Author place active and never left, the settings region's visible DOM
reflects the patched values while the turn streams (ADR-0179's acceptance line, exercised not
cited); (b) the density evidence at both named lines (40rem and 52.5rem real-engine passes — the
rail's shipped width + the conversation floor both honored); (c) rail sizing polish via admin CSS
initial flex-basis on the composed `ui-split-pane[data-role]` wrappers ONLY if the even default
reads wrong (sizing, never split logic — the resize interaction stays ui-split's). If (b) fails at
40rem: the §2 OQ3 escalation (drill-band seam citing `SHELL_COMPACT_BREAKPOINT`), never a third
number, never a duplication.

**Re-stated 2026-08-10 (GH #662).** (a) and (b) both passed at S3-a and their probes still run; what
this section now ALSO governs is the band above them, the triple dock (§2's new rows). The escalation
seam booked here was in fact spent — though not for the reason anticipated. The 40rem density check
PASSED, and `SHELL_COMPACT_BREAKPOINT` is instead the line at which a THIRD region can join without
any of the three falling under the 20ch floor. Same named number, same ladder, still no third one,
which is why the triple needed no ADR-0155-shaped follow-up of its own — only cl.1's Amendment.
The density evidence is consequently TWO tables, not one: the PAIR's (this section's, at 640 and 840
of the pair's own container) and the TRIPLE's (at 840 of the HOLDER's, tabulated in §2's triple-dock
row). The mounts differ because the pair is no longer the whole holder above the line — S3-a's
52.5rem row re-mounts at 1286px outer so that its subject, the pair's own container, is still
measured ON 840.

## 7 · Retirement map (per-symbol; S4-a executes, §13 sequences)

**Retires** (ADR-0179 cl.2/Consequences, resolved to code): `#mode` (360) · `#setMode` (1151) ·
`#applyMode` (1160–1171) · `setModeSeam` + its test drivers (`agent-admin-authoring.test.ts` 79+,
`agent-admin.browser.test.ts` 1310+) · `#tryItBar`/`#tryItAuthoringTab` (368–369) + the compose
block (998–1040) · agent-admin.css's try-it rows (189–216) · the chat-stack NAME + its
`data-tab-label` (594 — narrow-tabs participation ends) · the shell attrs `resizable-end`/
`narrow-end="tabs"` (584–585) and with them the six-entry narrow-tabs vocabulary.

**Survives byte-identical** (the overreach guard): both mounted conversations · `#contextFor()`'s
quadruple shape · `#history`/`#authoringHistory` (GH #644) · the runner's session-keyed `Session`
map · the fence + gate conjunct (1798–1801) · the GH #145 reset laws · the whole
`persona-patch.ts` apply chain · the Builder persona · `chat-shell.css`'s header-presence split
(#650 — now serving its header-bearing arm for the admin, its headerless arm for the fleet) · the
screen-x probe METHOD.

**What #650's probes become:** the border-box screen-x method (anchor to the conversation card's
edge, frame-independent) repoints from the try-it strip to (a) the pane-nav strip's inset-vs-header
rhythm and (b) the settings-nav strip's inset equality against the section content — plus the
pairing's displacement-axis assert (§11). The probes' METHOD survives re-anchored; their strip
subject retires.

## 8 · Error / edge handling

- **Mid-defer pane flip (GH #63's deferred client turn):** a client turn deferred to a macrotask
  reads `#contextFor()` at RUN time — a pane flip inside the defer window routes it to the new
  place's context. This was the shipped `#mode` hazard verbatim, inherited knowingly (zero-widening:
  the selector swap may not grow origin-anchoring); named in §15 with the follow-up shape (thread
  the origin conversation `#handleClientMessage` already receives into `#contextFor`).
  **CLOSED 2026-08-10 (GH #662)** — by exactly that follow-up shape, arrived at from the other
  direction: the triple dock forced origin-keyed routing for its own correctness (§2's new selector
  row), and a deferred turn now carries the origin it was spawned from rather than reading a place
  that may have changed under it. No separate issue is owed.
- **Band crossing mid-place:** wide→narrow lands on the nav's place (`selected` tracks §2's
  mapping); narrow→wide converges Author/Settings onto the pairing. No state is written by a
  resize — arrangement is CSS (`data-view` + the drill container query), the shell family's law.
- **Patch outside the Author context:** unchanged — `patchIgnored`, zero writes (the fence; §4).
- **`authoringStore` cleared while on Author:** empty state paints (always-present, OQ4); the
  interview transcript tears down under the shipped identity-change law, not this LLD's.
- **MD emissions:** `select`/`change` contained at the MD host (§2); the first-run-is-registration
  idiom means the compose-time `selected=''` write emits nothing.
- **No callback registered on `onGenerateRequest`:** the empty state's action hides; copy still
  names the flow (static-build degrade, §2 OQ4).

## 9 · Components (build slices — one writer per file; serialized per the decomp §5)

| ID | Component | File(s) | Slice |
|---|---|---|---|
| **LLD-P1** | Pane state + routing: `#pane`/`#setPane`/`#applyPane`, the `#contextFor` re-key (frozen algorithm), `setPaneSeam`, arm ⇒ `#setPane('author')`. | `agent-admin.ts` | S1-b |
| **LLD-P2** | Pane-nav: the header-slot bar + panel-less `ui-tabs` (3 places), `link()` wiring, containment. | `agent-admin.ts` + `agent-admin.css` | S1-b |
| **LLD-P3** | The MD re-home: `ui-master-detail` + both pane elements; the five section units + a mechanical `settings-nav` scaffold moved/composed into the detail pane; chat-stack → pane-holder rename; shell attrs retired; back-affordance suppression + region scroll CSS. | `agent-admin.ts` + `agent-admin.css` | S1-b |
| **LLD-P4** | Author place: `author-empty` + the `onGenerateRequest` registration seam; the conversation's new mount target. *(GH #666, 2026-08-10: `author-empty` became the card's empty-LOG state and the mount stopped being lazy — see the Author-region row in §2.)* | `agent-admin.ts` (+ `agent-admin-app.ts` registering the callback → `createGeneratedAgent`) | S1-b |
| **LLD-P5** | Docs-at-parity: `agent-admin.md` anatomy/parts/seam rows re-stated to the pane world (#653 item 2, first pass). | `agent-admin.md` | S1-b |
| **LLD-P6** | Settings grouping pass per §5's boundary. | `agent-admin.ts`/`agent-admin.css` | S2-a |
| **LLD-P7** | The wide live-fill proof + density evidence + rail sizing per §6. | `agent-admin.browser.test.ts` (+ CSS if (c) fires) | S3-a |
| **LLD-P8** | Residue deletion per §7's retire list; probe repointing; #653 items 1/3/4 executed (authoring LLD §2/§5/§14 restate · ADR-0131 Fork 2 note · #650 supersession record) + `agent-admin.md` final pass; close #653. | `agent-admin.ts`/`agent-admin.css`/tests/docs | S4-a |

## 10 · Non-goals

- **No consumption-path widening** — the fence ships byte-identical; S5's intake owns its own
  ruling (authoring LLD §14, inherited verbatim; the Author empty state merely NAMES the future
  front door, OQ5).
- **No MD API change** — back suppression is admin CSS; the drill-band seam is the named
  escalation, built only if S3-a's evidence demands it.
- **No pane persistence, no URL/router binding** (the router stays catalog-invisible; the admin is
  not router-bound), no new host events, no new `ui-*` element, no catalog rows, no entry-machinery
  changes (ADR-0132/0164/0170 untouched).
- **No interim dual nav** — the try-it strip stops composing the moment pane routing lands (S1-b);
  its residue deletion is S4-a's.

## 11 · Test plan (per step; every gate judged by EXIT CODE)

- **LLD-P1 (jsdom, `agent-admin.test.ts`/`agent-admin-authoring.test.ts`):** the frozen algorithm
  — `#contextFor` resolves the authoring quadruple ONLY on `pane === 'author'` with an armed
  store; the zero-regression assert — pane=chat requests byte-match today's shape, and
  `admin.store` reference-identity holds across pane flips (GH #145's probe, re-anchored from
  mode); **both fence polarities in the pane world** — gate-OFF on an Author turn ⇒ `patchIgnored`;
  gate-ON on a Chat turn ⇒ `patchIgnored` + zero writes; gate-ON Author turn ⇒ applied to
  `this.store`. Arm ⇒ pane lands on Author; clear ⇒ no forced navigation.
- **LLD-P2/P3 (jsdom):** three nav entries at every compose; region visibility truth-table over
  the three panes; `selected` mapping (`''`/`'settings'`); MD `select`/`change` never escape the
  admin host; section units are the SAME node identities before/after the re-home (the
  one-region/no-duplication assert — `isSameNode` across arrangement flips); settings-nav flips
  are visibility-only (SPEC-R7c's probe shape).
- **LLD-P4:** empty-state visibility both arms of `authoringStore`; `onGenerateRequest` fires the
  registered callback once per activation; unregistered ⇒ the action absent.
- **Browser (`agent-admin.browser.test.ts` — existing shards, never a new one; per the ledgered
  screen-x/displacement-axis law):** at narrow (fleet default 414×896 — below ADR-0150's line):
  exactly one place's region has nonzero geometry per nav selection; pane-nav inline inset tracks
  the header rhythm (the #650 method, repointed). At wide (≥ 40rem container): pane=author ⇒
  interview and settings rail both nonzero, top-aligned, split on the INLINE axis only —
  `interview.right ≤ rail.left + 1` (the shipped 122–124 adjacency probe, re-anchored); pane=chat
  ⇒ the conversation card alone (whole-shape assert, not per-part). Settings-nav inset equality vs
  section content (the #650 cross-strip probe, repointed).
- **LLD-P7 (S3-a, both engines):** the live-fill proof — scripted interview turn streams a patch
  while pane=author at wide; the VISIBLE settings DOM reflects the written values mid-stream
  without leaving Author (non-vacuous: assert the value CHANGED during the stream, not after).
  Density passes at 40rem and 52.5rem.
- **LLD-P8 (S4-a):** grep-gates for the retired symbols (zero references outside history/docs);
  the full suite green post-deletion; both #650-surviving facts still probed (header-split CSS,
  screen-x method now on the new strips).
- **Gates:** `npm run check && npm test` FOREGROUND, then the affected `test:browser` shards —
  exit codes only, every slice.

## 12 · Acceptance (inline — the decomp granted no SPEC for this family)

1. The three-place nav is live at every band from ONE vehicle; the six-entry narrow-tabs
   vocabulary is gone (cl.1).
2. `#contextFor` is keyed by active pane via §2's frozen algorithm — the selector diff is the one
   token; the fence conjunct ships byte-identical, both polarities asserted in the pane world
   (cl.2/cl.4; zero widening).
3. Per-pane composers: Author's composer drives the Builder, Chat's the test context, permanently;
   `admin.store` reference-identity holds across every pane flip; GH #145 resets unchanged.
4. The wide pairing is the SAME section nodes arranged (identity-asserted), docked at the 40rem
   named line, resizable via the composed split; the live-fill proof passes non-vacuously at wide,
   both engines (cl.3; #651's acceptance line).
5. Settings' five sections are each reachable via the internal sub-nav at every band (a6).
6. "New agent → Generate" — from the roster menu AND the Author empty state — lands the user in
   Author with the flow armed (a8); clearing the flow leaves an always-present Author place (OQ4).
7. The try-it strip, mode seam, and stacking vehicle are retired per §7 with zero survive-list
   casualties; #653's four record repairs are executed and #653 closed.
8. `npm run check && npm test` + affected browser shards green by exit code at every slice
   boundary; the doc-checker seat ratifies this LLD before S1-b dispatches.

## 13 · Build sequence (ordered; a builder follows it top-down)

1. **LLD-P1** — pane state + the `#contextFor` re-key + `setPaneSeam` + re-anchored routing tests
   (the seam retirement; the try-it bar stops composing in the same change — no interim dual nav).
2. **LLD-P2** — the header pane-nav + containment + jsdom nav suite.
3. **LLD-P3** — the MD re-home + settings-nav scaffold + CSS (scroll, back suppression, pane-holder
   rename) + the identity/visibility suites.
4. **LLD-P4 + LLD-P5** — the Author empty state + `onGenerateRequest` + site registration;
   `agent-admin.md` re-stated (**#653 item 2, first pass**). Browser probes for §11's band matrix.
   ⇒ S1-b review hand-off (generator ≠ critic).
5. **LLD-P6** — the S2-a grouping pass inside §5's boundary + a6 probes.
6. **LLD-P7** — the S3-a proof + density evidence (OQ3's booked real-engine check) ± rail sizing.
7. **LLD-P8** — S4-a: §7's residue deletion + probe repointing + the record repairs — authoring
   LLD §2/§5/§14 re-stated to the pane vehicle (**#653 item 1**) · ADR-0131 Fork 2 index note
   (**#653 item 3**) · the #650 supersession record (**#653 item 4**) · `agent-admin.md` final
   pass — then close #653.

## 14 · What the later slices inherit

S2-a inherits §5's frozen boundary; S3-a inherits §6 (arrangement already live — it owes proof,
evidence, and at most sizing); S4-a inherits §7's two lists and #653's checklist. S5's future
intake inherits exactly what the authoring LLD §14 already fences — the apply machinery + gate row
but NO consumption path — plus one new fact: its natural entry affordance now has a home (the
Author empty state, OQ5's named-not-built pointer). None of the four re-litigates this document or
ADR-0179; contradictions escalate.

## 15 · Risks / open items (named; recommendation each; none blocks dispatch)

- **Chat loses the wide settings adjacency** (§2's solo-Chat row) — today's wide first paint is
  chat + settings; post-S1-b it is Chat alone until the user visits Author/Settings. Kim-visible;
  the disjoint-places reading is ADR-grounded, but if pixel-truth rules the adjacency back in, the
  clean vehicle is a cl.3 escalation (the settings node cannot ALSO rail beside Chat without
  reparenting/duplication). **Recommendation: ship disjoint; show Kim early (the S1-b review
  screenshot names this delta explicitly).**
  **FIRED AND RESOLVED 2026-08-10 (GH #662).** The recommendation was followed and the risk paid out
  exactly as written: Kim looked at the finished surface and ruled the adjacency back in. The
  resolution is §2's triple-dock row — and the feared cl.3 escalation turned out NOT to be owed: the
  settings node rails beside Chat with no reparent and no second mount, because the arrangement is a
  band reading of the one holder rather than a second home for the region. The prediction that a
  Chat-wide rail *requires* duplication was the one part of this risk that was wrong.
- **Entry default pane = Chat** — content-first precedent; Kim may prefer Author (the flow's
  front door) or Settings (today's densest surface). One-token change. **Recommendation: Chat.**
- **Density at the 40rem line** — booked into S3-a with the named 52.5rem escalation (§6); the
  static arithmetic passes with ~2rem margin, so the risk is real-engine word-wrap, not layout.
- **The suppressed back affordance** — CSS suppression of a composed control is rude-but-lawful;
  the cleaner fleet seam (`back="none"` on `ui-master-detail`) is a small follow-up issue when a
  second consumer wants it. **Recommendation: file on first second-consumer.**
- **Mid-defer pane flip misroute** (§8) — inherited from the shipped mode seam, not widened here;
  the follow-up shape is named (origin-anchored `#contextFor`). File as a small issue at S1-b if
  the re-anchored tests surface it concretely. **CLOSED 2026-08-10 (GH #662)** — origin-anchoring
  shipped as a correctness requirement of the triple dock; see §8. No issue was filed or is owed.
- **The S2 boundary shift** — the sub-nav SCAFFOLD ships in S1-b (continuity: no commit may
  strand a6), the grouping pass stays S2-a's; this narrows S2-a relative to the decomp's line and
  is stated here openly rather than discovered at dispatch.
- **MD emission containment** — `stopPropagation` on light-DOM children's `select`/`change` is the
  shipped try-it precedent; if a future consumer WANTS pane-change observability, that is a new
  host-event fork (the closed set) — an ADR, not a drive-by.

## 16 · Amendment — the unified header + shown-set visibility (GH #686, 2026-08-10, **proposed**)

> Dated in place, append-only: every section above stays the shipped record; the §2/§3 rows this
> re-rules carry dated ⚠️ markers pointing here, never rewrites. Refines ADR-0179's third (proposed)
> Amendment — the GH [#686](https://github.com/kimgranlund/agent-ui/issues/686) unified-header
> ruling (Kim's Figma wireframe: desktop `1:162`/`1:163`, mobile `1:502`). **Nothing here dispatches
> until Kim ratifies that amendment**; this section is the build-ready OUTLINE (slice grain +
> seam shapes + retirement map), and each slice gets its full per-slice acceptance detail in a
> post-ratification pass. Contradictions with the accepted body escalate, never silently edit.

### 16.1 · Anatomy (post-#686 target)

```
ui-agent-admin
└── ui-chat-shell
    ├── [data-slot="header"] div[data-part="admin-header"]           (banner — no landmark override; the nav retired)
    │   ├── [data-part="agent-select"]   ui-select                    ← setAgentRoster / onAgentSelect
    │   ├── [data-part="pane-pills"]     ui-toggle ×3                  wide only (CSS band) — Chat · Settings · Co-pilot,
    │   │                                                              icon + label + Eye/EyeSlash state icon
    │   ├── [data-part="pane-segments"]  ui-segmented-control          narrow only (CSS band) — same 3, icon-only, single-select
    │   └── [data-part="header-actions"]                               wide: New Agent (+) · Import · Export as ui-buttons;
    │                                                                  narrow: + and a ••• ui-menu (Import/Export)
    └── [data-slot="content"] div[data-part="pane-holder"]            container-type: inline-size; data-show + data-primary
        ├── [data-part="chat-pane"]      #conversation                 (byte-unchanged)
        ├── [data-part="settings-pane"]  settings-nav + 5 section units (internals untouched; "Reset Agent" joins the
        │                                                              model-grid fold's content end)
        └── [data-part="copilot-pane"]   #authoringConversation        (the GH #666 card, renamed from author-pane)
```

The `ui-master-detail`, both its pane elements' wrapper role, and the back-affordance suppression
CSS leave the composition (the MD element itself is untouched fleet stock). The five section units
and both conversations move as whole nodes — cl.3's singleton law, re-verified at build with the
`isSameNode` probes.

### 16.2 · The visibility model (one machine, two renderings)

- **State:** `#panesShown: Set<'chat' | 'settings' | 'copilot'>` (invariant `size ≥ 1`) +
  `#panePrimary: 'chat' | 'settings' | 'copilot'` (invariant: a member of the set). Replaces
  `#pane`/`#setPane`/`#applyPane` as the truth; `setPaneSeam` retires in favor of
  `protected setPaneVisibilitySeam(shown: readonly Pane[], primary: Pane): void`.
- **Writes:** a wide pill toggles membership (turning off the last member is refused — the pill
  no-ops and stays pressed; turning off the primary repoints primary to the first remaining member
  in reading order). A narrow segment select sets `primary` and ensures membership. Arm
  (`#rewireAuthoringContext`) replaces its `#setPane('author')` line with: ensure
  `copilot ∈ shown` + `primary = 'copilot'`. Teardown still never forces navigation.
- **Render:** ONE `#applyPaneVisibility()` writes `data-show="chat settings copilot"` (space-joined
  set) + `data-primary` onto the pane holder and mirrors pressed/selected state onto the pills and
  the segment control (programmatic writes — no event echo, ADR-0019). The sheet does the rest
  against the holder's own inline-size: `≥ 52.5rem` (`SHELL_COMPACT_BREAKPOINT`; the header bar
  uses the derived 54rem composed-shell query, the GH #665 rule's own derivation repurposed) shows
  the `data-show` members as equal flex columns; below it only the `data-primary` pane. A resize
  writes nothing — band crossings are lossless by construction.
- **Routing:** untouched. `#contextFor` stays ORIGIN-keyed (the first Amendment); with subsets,
  multiple visible composers are the norm and origin-keying is what already makes that sound. The
  fence conjunct, both histories, the session map, the GH #145 resets: byte-identical.

### 16.3 · Seam shapes (frozen enough to build from; SPEC-R5's law throughout)

```ts
export interface AgentRosterEntry { id: string; label: string }
setAgentRoster(entries: readonly AgentRosterEntry[], activeId?: string): void
onAgentSelect(callback: (id: string) => void): void
onNewAgentRequest(callback: () => void): void
onImportRequest(callback: () => void): void
onExportRequest(callback: () => void): void
onResetRequest(callback: () => void): void
```

All six follow `onGenerateRequest`'s shipped semantics verbatim: callback registration, never a
CustomEvent; last registration wins; unregistered ⇒ the affordance hidden (static-build degrade);
safe before OR after connect (the GH #666 order rule — reflect at build time and at registration).
`setAgentRoster` is data-in and re-callable (the page re-pushes after mint/import); the select's
internal `select`/`change` stay contained (`stopPropagation` — the closed event set is untouched).
`onGenerateRequest`/`GenerateSeed` unchanged. Site side, `agent-admin-app.ts` retires its
canvas-header DOM + CSS and instead registers: roster + `applyPersona` routing, New Agent (OQ-A's
ruling), `importPersonaFile`, the export flow, and `resetPersona`.

### 16.4 · Slice outline (S-numbered; serialized, one writer per file; full acceptance detail
post-ratification)

| Slice | Scope | Done-when (outline grade) |
|---|---|---|
| **S7-a** | The fleet `ui-toggle` control (pressed pill: icon + label + optional state-icon slot; `aria-pressed` via `ElementInternals`; `toggle` event; disabled/refused-toggle affordance) + vendored icons (`chats-circle`, `gear-six`, `robot` — `vendor-phosphor.mjs` regen; `eye`/`eye-slash`/`plus`/`dots-three` already in the pack) + control doc + jsdom/browser tests. | Control passes the fleet's naming/styling gates; `toggle` emission + pressed reflection probed; icons resolve from `@agent-ui/icons/phosphor`. |
| **S7-b** | The visibility model in `agent-admin.ts`/`.css`: §16.2 verbatim — shown-set + primary, `#applyPaneVisibility`, `data-show`/`data-primary` + band CSS, MD retirement (three sibling regions, `author-pane` → `copilot-pane` rename, back-suppression CSS deleted), pane-nav retirement incl. the GH #665 rule, `setPaneVisibilitySeam`. | jsdom visibility truth-table over set×band; `isSameNode` across arrangement flips; min-one refusal; arm lands Co-pilot visible+primary; browser band matrix (wide subsets paint, narrow paints primary alone); no state written on resize. |
| **S7-c** | The unified header bar: three zones composed into `header` (§16.1), the six seams (§16.3), pills⇄segment band rendering, narrow `+`/`•••` collapse. | Seams' register-before/after-connect probes; unregistered-degrade per affordance; pills and segment mirror ONE state (flip in one rendering, cross-check the other); header inset rhythm probes re-anchored from the retired pane-nav. |
| **S7-d** | "Reset Agent" at the `model-grid` fold's content end (`onResetRequest`) + the site page pass: canvas-header retired, registrations in, overflow menu deleted, roster re-push on mint/import. | Reset hidden unregistered / invokes callback registered; the page renders no header of its own; every prior overflow action reachable through its new home; `layering.test.ts` untouched-green. |
| **S7-e** | Residue + records: grep-gates for retired symbols (`#pane`, `#setPane`, `#applyPane`, `setPaneSeam`, pane-nav parts, MD parts, canvas-header classes); probe repointing (live-fill re-anchored to `{settings, copilot} ⊆ shown`; the #650-descended screen-x probes onto the new bar); `agent-admin.md` re-stated; this LLD's §16 markers confirmed against the built tree. | Full gates green by exit code; zero retired-symbol references outside history/docs; doc-checker ratifies the record pass. |

### 16.5 · Retirement map additions (RETIRE entries, the §7 convention)

**Retires:** the pane-nav `ui-tabs` + `pane-nav-bar` + per-tab `link()` wiring + `setPaneSeam` ·
`#pane`/`#setPane`/`#applyPane` as visibility truth (re-shaped per §16.2) · the `ui-master-detail`
composition (`pane-pair`, both `ui-master-detail-pane` wrappers, the back-affordance suppression
CSS, the MD `selected` mapping row) · the GH #665 hidden-at-wide CSS rule (moot — its 54rem
derivation is REUSED by §16.2's header query) · site: the canvas-header (title/tagline,
`agentMenu`, `overflowMenu` incl. `NEW_AGENT_ACTIONS`' menu items, `resetItem`, `exportItem`,
`importItem` — the ACTIONS survive behind the seams; only their menu housing retires).

**Survives byte-identical (the overreach guard, §7's list still binding):** both mounted
conversations · origin-keyed `#contextFor` · the fence + gate conjunct · both histories · the
session map · GH #145 resets · the apply chain · the Builder persona · `onGenerateRequest` +
`GenerateSeed` · the settings region's internals (settings-nav, five section units, entry
machinery) · the no-painted-dividers token law.

### 16.6 · Open questions (fenced for Kim — named, NOT ruled; the OQ5 discipline)

- **OQ-A — New Agent's verb.** One wireframe button; two shipped mint paths (Blank · Generate).
  Rec: `onNewAgentRequest` → the page routes to the Generate flow; Blank's home is Kim's call
  (narrow `•••`? retire? an ADR-0170 pack action?).
- **OQ-B — the narrow `•••` contents.** The wireframe implies Import/Export only ("presumably", the
  issue's own word). Rec: exactly those two; Reset stays Settings-only per Kim's text ruling.
- **OQ-C — inter-pane resizing.** The MD's resizable split retires with it; the wireframe's equal
  columns suggest fixed flex. Rec: fixed flex; compose `ui-split` back only on Kim's ask.
- **OQ-D — entry default.** Rec: all three shown at wide (the wireframe's all-active state),
  `chat` primary at narrow — a change from the shipped chat-first entry, so it is Kim's to confirm.
- **OQ-F — the 40–52.5rem band.** Today it paints the Author⇄Settings docked pair; post-#686 it is
  single-pane (the MD's 40rem line leaves with the MD). Kim-visible behavior change between the two
  wireframe states; flagged, not smoothed over.

*(OQ-E from the drafting pass — "can the set be empty" — is RULED, not open: min-one, §16.2; a
zero-pane surface is broken by construction.)*
