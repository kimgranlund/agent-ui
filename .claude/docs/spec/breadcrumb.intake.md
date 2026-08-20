# Design intake — `ui-breadcrumb`: the wayfinding trail with a `collapse="menu"` folded middle (GH #1515)

> Status: proposed · v0.1 · 2026-08-19 · Layer: intake record (fork sheet, `component-design`
> procedure — a component MINT; the gen-ui-kit DOM snippet on GH #1515 is a MARKUP-SHAPE reference
> only, every name/attr re-derived under this repo's own law).
> Refines: GH #1515 (Compose/Realize acceptance drafted there; separator ruled SLOTTABLE by Kim on
> the claim — that fork arrives pre-decided, this sheet designs its contract).
> Refined by: nothing — the novelty leg (§6) finds NO contract-changing fork; no ADR is drafted,
> deliberately (see §6).

## 1 · The job (one sentence)

Show the user WHERE they are as an ordered trail of crumb links ending in the current page, and —
when the trail is long — fold the middle crumbs behind a composed `ui-menu` overflow trigger while
the first and trailing crumbs stay visible.

## 2 · Two-plane decomposition (coverage-checked before the sheet)

**Outside-in (parts):** host landmark (role/label) · crumb partition (which children are crumbs) ·
separator injection (slottable template → per-gap clones) · current-page stamping (last crumb) ·
collapse mechanism (pin/fold set + composed `ui-menu` + proxy items + commit relay) · geometry +
sizing posture · tokens/forced-colors · keyboard/focus · catalog posture · site surfaces + gates ·
build slices.

**Inside-out (actions the acceptance demands):**

| # | Action (GH #1515 acceptance) | Covered by part |
|---|---|---|
| a | Ordered crumb links + separators + current-page text | crumb partition + separator injection + current-page stamping |
| b | Root `nav` landmark, `aria-label="Breadcrumb"` | host landmark |
| c | Optional leading icon crumb (`ui-icon`) | crumb partition (tag-agnostic author child — zero coupling) |
| d | Collapse mode keeping a configurable trailing count, middle folded into `ui-menu`/`ui-menu-item` | collapse mechanism |
| e | Keyboard reachability of trigger + menu items; visible focus on crumb links | keyboard/focus |
| f | Separators must not vanish under `forced-colors` | tokens/forced-colors (real-text-node law) |
| g | Router-link question (issue Non-goals → ruled here) | crumb partition + commit relay (§4 Router row) |
| h | Narrow-viewport parity for the collapse behavior | collapse mechanism (author-driven, viewport-independent) + site demo leg |

Coverage holds — every action maps to a part; every part serves an action. The sheet proceeds.

**DoD carve-out (doc-checker finding, 2026-08-20):** no separate `.decomp.json` manifest is
minted for this ticket — the two-row a/b action↔part table above IS the coverage artifact,
recorded explicitly as the `size:small` carve-out (a standalone, single-anatomy display
component with no multi-plane decomposition needed); `coverage_check.py --strict` is not run
against a manifest that was never meant to exist here. A future ticket of this size inherits the
same carve-out by citation, not by re-deriving it.

## 3 · Precedent sweep (SOURCE read, nothing redesigned)

| Mechanism needed | Reused precedent (SOURCE read) | Owner |
|---|---|---|
| Navigation-pattern host: `internals.role='navigation'`, `label` → `internals.ariaLabel`, tier `pattern` with NO new geometry row, delegated activation, `inline` opt-out | `controls/pagination/pagination.ts` end-to-end (ADR-0163 cl.6: "the buttons carry their own geometry; the novelty is zero") | ADR-0163 |
| Fold-the-rest-behind-a-menu: composed `ui-menu` part created once, control-created `<button>` trigger as menu FIRST CHILD, `setIcon(trigger, 'dots-three')` (the fleet's ONE horizontal overflow glyph), PROXY items (never reparented children), commit relay to the real hidden element | `controls/tabs/tabs.ts` `#ensureOverflowPart`/`#wireOverflow` (GH #586, `lld/tabs-vertical-overflow.lld.md` §4/§5) | GH #586 / GH #168 |
| Menu trigger/panel/roving/Escape/commit-close + `select {value,index}` detail | `controls/menu/menu.ts` (trigger = first element child, `data-part="trigger"`; items auto-stamped `role=menuitem`) | ADR-0043 |
| `collapse` as an author-chosen strategy ENUM (values incl. `'none'` and `'menu'`), never a verb boolean; the `collapse`-prefixed compound attr for a dependent axis | `app/src/controls/nav-rail/nav-rail.ts` (`collapse: prop.enum(...)`; `collapseContainer`/`collapse-container`, TKT-0035 — naming.md §3's own multi-word template) | naming.md §3 |
| Stamping ARIA/roles onto AUTHOR-supplied light-DOM children | `menu.ts` roleless→`menuitem` auto-stamp; swiper-paddles/pagination sanction for composed-child `aria-*` | GH #55 / ADR-0163 |
| The `[slot=…]` position-slot grammar for authored children | `controls/disclosure/disclosure.ts` `slot="summary"` (ADR-0158); button `slot="leading"`/`slot="trailing"` (ADR-0006/0012) | ADR-0158 |
| Streamed/mutated light-DOM children re-adopted after connect | `disclosure.ts` slot-partition adoption of late children | ADR-0158 |
| Fill-by-default sizing: block-level fill, reflected `inline` boolean as the ONE opt-out; `sizing-gates.test.ts` ENFORCING | ADR-0223 (ratified + built; pagination.ts:43 is the shape) | ADR-0223 |
| Real-`<a>` composability + `href` reflection doctrine (crumbs stay author anchors) | ADR-0114 stamp doctrine; `router/src/controls/router-link/router-link.ts` (stamps ONE real `<a>`, click listener on the stamp) | ADR-0114 / ADR-0115 |
| Naming derivation + catalog type | naming.md §1/§3/§7 + §10 rubric (run in §5) | naming.md |

Adjacent, cited-not-overlapping: `ui-drill chrome="crumbs"` (GH #1510 intake) is drill-INTERNAL
host-owned trail chrome inside a contained pane container; this is the standalone shared component
— no shared mechanism, no overlap (GH #1515 Origin says the same).

## 4 · Fork sheet

| Row | Decision | Justification (one line) |
|---|---|---|
| **Tag** | `ui-breadcrumb` / `UIBreadcrumbElement`; no sub-tags | one host, author children as items — the crumb/separator "parts" are authored or control-created nodes, not tag-worthy family members (contrast tabs' `ui-tab`, which carries per-item state; a crumb carries none) |
| **Anatomy** | Flat light-DOM: every element child that is not the separator template and not control furniture (`[data-part]`) is a CRUMB, tag-agnostic; control injects one separator clone between adjacent visible items (`data-part="separator"`, `aria-hidden="true"`); when folding, a `[data-part="overflow"]` composed `ui-menu` sits in the first-gap position. No `ol/li` — a deliberate, recorded deviation from APG's list markup (flat light-DOM is the fleet convention; the landmark + `aria-current` carry the pattern's essential semantics) | matches the reference DOM's flat shape and the fleet's light-DOM law |
| **Separator (Kim-ruled slottable)** | ONE optional `[slot="separator"]` child = the per-INSTANCE template: the control hides the template itself (`hidden` + `aria-hidden`) and inserts a `cloneNode(true)` per gap; unslotted default = control-created `<span>` with the `/` glyph; multiple `[slot="separator"]` children → first wins, rest inert (deterministic). Per-GAP customization is REJECTED: no named use case, and it fights auto-injection (a consumer needing bespoke gaps authors their own composition). **Clone semantics, pinned (doc-checker finding, 2026-08-20): SNAPSHOT, not live** — the template is cloned once per gap at render time via a host-childList observer only (crumb count changing re-renders and re-clones); a mutation made *inside* an already-slotted template's subtree after mount does NOT propagate to existing clones, asserted by an S1 jsdom test. **Clone hygiene**: clones are inert decoration only — the build strips any `id` from each clone (preventing N-duplicate ids) and carries `aria-hidden="true"` (already stated above) | rides the existing `[slot=…]` grammar (ADR-0158/0006); clone-per-gap is component-local anatomy, not a fleet-contract change — N gaps need N copies, which position-slot adoption cannot express |
| **Props** | `collapse: prop.enum(['none','menu'], 'none'), reflect` · `collapseKeepTrailing: { ...prop.number(2), reflect, attribute: 'collapse-keep-trailing' }` · `label: prop.string(''), reflect` · `inline: prop.boolean(false), reflect`. NOT ported: gen-ui-kit's bare `collapse` boolean — a verb is not a boolean name (naming.md §3, the `truncate` §12 lesson); nav-rail already owns `collapse` as the fleet's strategy ENUM with `'none'` rendering bare, reused verbatim. `collapseKeepTrailing` clamps: non-finite/`null` → 2; `< 1` → 1 (the current page is always visible; pagination's clamp discipline) | one concept one name — the collapse-strategy enum exists (nav-rail); the compound `collapse-*` attr for the dependent count is TKT-0035's own template |
| **Events** | NONE of its own — crumb activation is native anchor navigation; the composed `ui-menu`'s `select`/`toggle`/`close` are composed-part internals (the tabs posture: commit relays, nothing re-emitted). **Mechanism, pinned (doc-checker finding, 2026-08-20): `stopPropagation` on `select`/`toggle`/`close` at the `[data-part="overflow"]` boundary (tabs `#wireOverflow`/C8 precedent)** — without it, `ui-menu`'s bubbling+composed events would surface on the breadcrumb host, falsifying "NONE of its own"; the build must wire this exactly, not merely rely on the posture by analogy. Zero new event names; the closed seven untouched | navigation is the platform's event; minting a `select`-per-crumb would duplicate `<a>` semantics |
| **Collapse mechanics** | `collapse="menu"`: pin the FIRST crumb (the reference DOM's Home pin; tabs' selected-tab-always-pinned analog) and the LAST `collapseKeepTrailing` crumbs (count INCLUDES the current page); the middle range, when non-empty, folds — each folded crumb stamped `data-collapsed` (CSS `display:none`, stays in DOM), one proxy `ui-menu-item` per folded crumb labeled from its accessible text (`aria-label` ?? `textContent`), menu placed in the first gap. Commit relays activation to the REAL crumb's activation surface: `crumb.matches('a') ? crumb : (crumb.querySelector('a') ?? crumb)`, then `.click()` — `HTMLElement.click()` dispatches on `display:none` nodes, so the hidden crumb navigates. Author-driven, viewport-independent (narrow-viewport parity = the author sets `collapse="menu"`); fit-driven auto-collapse (ResizeObserver) is a NAMED future extension, not built speculatively | the tabs proxy-items + relay mechanism verbatim, minus fit-measurement (breadcrumb's fold is count-driven, which is why nav-rail's `collapse` vocabulary fits better than tabs' fit-driven `overflow`) |
| **Router-link composability** | ADR-0115-BLIND BY CONSTRUCTION, and composable anyway: crumbs are tag-agnostic light-DOM children, so `<a href>`, `<ui-router-link>` (which stamps a real inner `<a>` — relay hits it via the `querySelector('a')` arm), and plain `<span>` interchange freely; `ui-breadcrumb` never imports, names, or sniffs `@agent-ui/router` (the components→router edge is illegal anyway — `layering.test.ts`). **Upgrade-order assumption, pinned (doc-checker finding, 2026-08-20)**: the relay assumes `ui-router-link` is ALREADY UPGRADED (its inner `<a>` stamped) by the time collapse folds the crumb — pre-upgrade, the custom element has no inner anchor yet, so `.click()` on the host is a silent no-op. Fold computation must run POST-CONNECT (never pre-upgrade); S2's browser test asserts the upgraded case explicitly, and this ordering assumption is the reason it works, not an incidental pass. #1515's Non-goals deferred this question to "the build seat" — the design intake decides it here instead (the better home, since it's a mechanism question, not an API-surface one); this row is that deferral consumed, not still-open | composability falls out of the mechanism; no edge, no allowlist, nothing to fence |
| **Current-page stamping** | The last crumb is auto-stamped `aria-current="page"` (and the stamp moves on child-set mutation), UNLESS the crumb or a descendant already carries `[aria-current]` (a router-exact-active `ui-router-link` already marks its stamped `<a>` — defer, never double-mark); recommended authored shape for the leaf is a plain `<span>` (the reference DOM's shape). Child-set changes observed via a childList MutationObserver → re-partition, re-inject separators, re-stamp, re-fold (the disclosure late-children posture) | APG allows link-or-text with `aria-current`; defer-if-marked prevents nested duplicate announcements |
| **Geometry** | Tier `pattern`, NO new geometry row (the pagination/ADR-0163 cl.6 reasoning verbatim: composed/authored stops carry their own geometry, novelty zero). Crumb text reads the LABEL typescale row; gaps via the space scale; the overflow trigger is a compact square keyed to the crumb line-height with a padded hit area (the tabs tab-height-trigger shape, sized in `breadcrumb.css`). ADR-0223 posture: block-level fill, `inline` = hug — ships conformant against the ENFORCING `sizing-gates.test.ts`, empty DEBT table untouched | routes per `geometry.md` §size-class table — decided here, not left open |
| **Tokens** | No new SYSTEM role. Crumb links consume the fleet link/text color roles (the ADR-0114 anchor convention); current page + separators `--md-sys-color-on-surface-variant`; one component token `--ui-breadcrumb-gap` consuming the space scale (the ONE CSS knob the anatomy needs) | GH #1515's "no new token anticipated" holds at the system tier |
| **A11y** | `internals.role = 'navigation'` (never a host attribute); `internals.ariaLabel = label \|\| 'Breadcrumb'` — the APG-named pattern default (deviation from pagination's null-default is deliberate: Breadcrumb HAS a canonical landmark name; multiple unnamed navs are an AT defect). Separator clones + template `aria-hidden="true"`. Trigger: control-created `<button aria-label="More pages">` (the tabs "More tabs" control-created-literal sanction), `ui-menu` supplies `aria-expanded`/`aria-haspopup`/`aria-controls` | pagination template + APG Breadcrumb pattern |
| **Keyboard/focus** | Crumb links: normal document tab order, NO roving (N independent links, not one composite — the pagination/ADR-0163 cl.3 posture; APG Breadcrumb specifies no arrow-key model). Trigger: in tab order at its DOM position (first gap); menu open/rove/type-ahead/Escape/commit-close per `ui-menu`; after a menu commit the relay navigates — focus follows navigation (menu's default focus-restore-to-trigger is correct for the no-navigation edge, e.g. a preventDefault-ed anchor); visible focus ring on crumb links = the fleet four-state standard, no deviation | zero new focus machinery |
| **Forced-colors** | Separators are REAL DOM text nodes (default `/` clone or the author's slotted content) — CanvasText under `forced-colors: active`, they cannot vanish; LAW for the build: the separator is never realized as background-image, alpha-only wash, or color-only `::before` decoration; browser test asserts the separator's rendered text/subtree survives forced-colors emulation | the vanish class only exists for painted (non-text) affordances |
| **Interaction states** | No deviation — links/trigger follow the fleet four-state standard + `[density]` participation | law-owned (`interaction-states.md`); no row-level fork |
| **Form participation** | None — `UIElement`, not form-associated; no value, no codec, no labelling seam | wayfinding is transient view state (the pagination F5 reasoning extends verbatim) |
| **Site surfaces** | `site` doc + demo page (incl. a narrow-viewport collapse demo), gallery/preview specimen, descriptor `breadcrumb.md` — dragging the standing descriptor/site/naming/sizing/styling gates (slice S3) | the testing map owns the bar |
| **Catalog posture** | A2UI-EMITTABLE — a `Breadcrumb` catalog row + factory land WITH the build (ADR-0087's coverage gate forces row-or-allowlist at ship time; Pagination/Tabs/Menu/Toolbar are all catalogued, and a crumb trail is one-shot serializable content, not imperative app chrome — the ADR-0112 cl.6 exclusion test fails to bite). Wire shape (crumbs as `{label, action}` children vs composed Link children) is the build seat's call under `component-catalog` | the fleet-control arm of ADR-0087 decides this, not the ADR-0220 TYPE arm (the component's existence is already ruled by the ticket) |

## 5 · Classification + naming rubric

Base class **`UIElement`** (reactive display — no value, no container adoption, none of the three
`_base` families fits: not an indicator, range, or listbox). Tier **`pattern`** (descriptor
`tier:` field; the Pattern band's "composed interactive rows carry control geometry, shell uses
the space scale" — pagination's exact classification, and the crumb text's typescale sizing rides
inside it). Catalog **emittable** (§4). naming.md §10: namespaces entered = tag + class + one
component token + catalog type `Breadcrumb`; no reserved-word collision (`collapse` reuses the
existing canon on purpose; `label` used in its reserved sense); no closed-set admission (zero new
events); prefix/derivability standard (`ui-breadcrumb` → `UIBreadcrumbElement` →
`--ui-breadcrumb-*` → `Breadcrumb`); §12 exceptions checked — none touched.

## 6 · Novelty leg — ADR verdict: **NO ADR**

Explicitly: this mint is ROUTINE — no new base class, no new event name, no new geometry row, no
new system token, no new interaction family, no dependency edge. Every mechanism is a swept row:
pagination's navigation-host template, tabs' composed-menu fold + proxy/relay, menu's trigger/roving
contract, nav-rail's `collapse` enum canon, disclosure's slot grammar + late-children adoption,
ADR-0223's ratified sizing posture. The two mildest wrinkles — clone-per-gap separator semantics
and the `'Breadcrumb'` default landmark name — are component-local anatomy/a11y decisions justified
in §4, changing no fleet contract; a Context section with no Decision above it is not an ADR.
Nothing here is hard to reverse. (If independent review disagrees, the named candidate fork would
be the separator-template slot semantics — escalate, don't self-draft.)

## 7 · Build slices (one writer per file; each slice lands gate-green)

- **S1 — core anatomy** (`controls/breadcrumb/`): `breadcrumb.ts` (host landmark + label default,
  crumb partition, separator template/clone injection, `aria-current` stamping + defer-if-marked,
  childList observer, `inline`) · `breadcrumb.css` (flex row, `--ui-breadcrumb-gap`, label
  typescale, fill-by-default, focus-visible, forced-colors posture) · `breadcrumb.md` descriptor ·
  jsdom tests (partition/separator/stamping/clamps) — accept-criteria per the `component-testing`
  bar.
- **S2 — `collapse="menu"`** (depends S1): fold-set computation + `data-collapsed` + composed
  `ui-menu` part (created once, dots-three trigger) + proxy items + click relay · browser tests
  (keyboard path end-to-end: Tab→trigger→open→rove→commit→navigation; relay against `<a>` AND an
  anchor-wrapping custom-element crumb — proving ADR-0115-blindness without importing router;
  forced-colors separator survival).
- **S3 — site + catalog** (last): doc/demo pages (incl. narrow-viewport collapse demo),
  gallery/preview specimen, `Breadcrumb` catalog row + factory (+ eval-catalog ride-along per its
  standing gate), descriptor/naming/sizing/styling gates green.

No built-output leg beyond the standing production checks — the design depends on no
production-CSS-only behavior (no `@scope`-minify hazard named). Dependency-true: S2 after S1,
S3 last.

## 8 · Independent doc review

Gated per `component-design` step 8 — a fresh-context doc-checker pass runs on this intake before
any build dispatches (pre-armed: blockquote house header, not scribe frontmatter; `doc_lint`
abstains by design). The frozen-interface-vs-real-code check targets: `prop.enum`/`prop.number`
attribute overrides (nav-rail:89–90), `setIcon` from `@agent-ui/icons` (tabs.ts:43,333), menu's
first-child trigger + `select {value,index}` (menu.ts), `internals.role`/`ariaLabel`
(pagination.ts:51–55) — all verified against shipped consumers at intake time.
