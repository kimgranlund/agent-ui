# Design intake — `ui-playing-card`, the standard playing-card display leaf (GH #1478)

> Status: proposed · v0.1 · 2026-08-19 · Layer: intake record (fork sheet, `component-design`
> procedure)
> Refines: GH #1478 (owner ruling 2026-08-19: the fork is CLOSED — MINT `ui-playing-card`, the
> real fleet component, not a factory restyle; full scope: corner indices top-left + rotated
> bottom-right, suit pips, red/black suit inks, a real CSS face-down back pattern, bridge
> aspect + size ramp, deal/flip animation).
> Refined by: `.claude/docs/adr/0225-ui-playing-card-mint-persona-scoped.md` (the
> contract-changing forks this intake finds) → the component build once the ADR ratifies
> (design-only record; no component source is authored here).
> Decomposition: `.claude/docs/decompositions/playing-card-ship.decomp.json`
> (`coverage_check.py --strict` clean, 2026-08-19).

## 1 · The job (one sentence)

A **playing card** renders exactly ONE standard card — rank × suit as a true card face (corner
indices + pip field, red/black suit inks) or a patterned back when face-down — as a
fixed-bridge-aspect, non-interactive display leaf that flips between the two and deals in on
insertion.

## 2 · Two-plane decomposition (coverage-checked before the sheet)

Ran as a real `break-down-problem` manifest —
`.claude/docs/decompositions/playing-card-ship.decomp.json`, components domain, `plan: true`,
`coverage_check.py --strict` exit 0. Summary of the crossing:

**Outside-in (parts):** host (props/a11y/ready-state) · flipper rotor · face (upper index +
rotated lower index + pip field) · back (CSS lattice) · css (tokens/geometry/motion) ·
descriptor · barrel · croupier factory retarget · default-catalog allowlist entry · site
surfaces · browser-proof leg.

**Inside-out (actions, from the ruling's own scope list):** identify rank+suit at a glance ·
render the rank's pip layout · red/black inks as redundant carriers · conceal when face-down
behind a painted back · hold bridge aspect across the ramp · flip on `faceDown` change · deal
entrance on insertion · one accessible name, no face-down leak · typed reflected props ·
croupier wire emission unchanged · default catalog stays closed · painted truth in a real
engine · standing gates · docs-site teaching specimen.

Every action hosts on a part; the one action-free node (`face`, pure grouping) carries
`justify: "structural"`.

## 3 · Precedent sweep (SOURCE read, nothing redesigned)

| Mechanism needed | Reused precedent (SOURCE read) | Owner |
|---|---|---|
| Fixed-square/fixed-box widget with `[size]` sm/md/lg repoint of one host token | `ui-avatar` (`controls/avatar/avatar.css:29-43` — `--ui-avatar-size` off the compact ramp, fork F3) — the REPOINT pattern is reused; the ramp itself is NOT (compact tops out at 28px, unusable for a card) | ADR-0041 F3 |
| Reserved fixed-aspect box (zero CLS) | `ui-image`/`ui-video` (`controls/video/video.css:32` — `aspect-ratio: var(--_aspect)`, always concrete) | GH #1189 / video.md fence |
| Density-invariant, em-keyed MARK geometry (a visual whose box rides the type scale, not the control ramp) | `ui-pie-chart` (`pie-chart.css:35-36` — `--ui-pie-chart-ring-size: 8em`, fixed em box) | ADR-0219 / chart family |
| Interior glyph sizes derived by calc off the owned box | `ui-avatar` (`avatar.css:69,79` — `calc(var(--ui-avatar-size) * 0.42)`) | avatar family |
| Categorical identity in a visual mark — color as a REDUNDANT carrier, never the only one | chart-family CVD law: order + label + printed value + fill-as-fourth-carrier | ADR-0219 cl.4–5 (generalizing ADR-0057) |
| Component tokens aliasing system color primitives via `light-dark()` | `ui-pie-chart` slice inks (`pie-chart.css:47-48`) | ADR-0219 |
| State-paint transition gated behind post-first-paint `:state(ready)` + reduced-motion zero | interaction-states.md §4a–c (rAF `internals.states.add('ready')`; fleet motion tokens `--md-sys-motion-duration-fast`/`-easing-standard`, no magic numbers) | ADR-0008/§4 law |
| Entry animation on DOM insertion, degrading gracefully | `ui-drawer`'s `@starting-style` + `transition-behavior: allow-discrete` edge-slide | ADR-0188 cl.5 |
| Owned mark renders with zero pack/asset dependency | `ui-rating`'s owned star (no icons-pack glyph — the mark IS the content) — the card's pips are Unicode suit glyphs (♠♥♦♣), even cheaper: real text, crisp at any size, `currentColor` | ADR-0216 cl.3 |
| Non-interactive display leaf, `internals` role, no host attributes | `ui-icon`/`ui-swatch`/`ui-stat` display-class posture | geometry.md §Display |
| Persona-scoped catalog type + factory table | `personas/croupier/{catalog.json,factories.ts,manifest.ts,index.ts}` read end-to-end — the factory currently composes `ui-card`+`ui-text` with a WeakMap side-table and the 🂠 glyph | GH #497 / SPEC-R1 |
| Catalog-or-allowlist coverage gate | `catalog/default/index.test.ts:175` `EXCLUSION_ALLOWLIST` (Map<type, reason>) — every fleet descriptor resolves to a default row OR an entry | ADR-0087 · ADR-0112 cl.6 |

Verified against real shipped consumers, not doc lines: the factory's `applyProp` signature
(`(el, prop, value)`), the allowlist's `Map<string,string>` shape, avatar's calc idiom, the
`:state(ready)` rAF idiom.

## 4 · Fork sheet

### The mint-vs-compose row — applied explicitly

**Verdict: MINT `ui-playing-card`** — the fork is already owner-closed on #1478; the mechanics
agree:

- **The aggregate-value bar** (`component-design/references/mint-vs-compose.md`, ADR-0175):
  NOT APPLICABLE — `rank`/`suit`/`faceDown` are three ordinary scalars, nothing form-bearing.
- **Lane 1 — compose:** the shipped composition (`ui-card` + `ui-text` + glyph string) is
  exactly what the ruling retires: it cannot express corner indices, pip layouts, suit inks, a
  painted back, or a flip — five obligations with no host in that composition.
- **Lane 2 — widen:** widening `ui-card` (a generic container) with card-game anatomy would
  bolt a domain object onto a layout primitive — different tier, different job.
- **Lane 3 — mint:** cheap — no new base class, no new event, no new geometry row/class (see
  Geometry), one new controls folder; the only genuinely new fleet mechanisms are the 3D flip
  rotor and the suit-ink pigment tokens, both named as ADR clauses.
- **New-catalog-TYPE arm:** no new TYPE — `PlayingCard` already exists in the croupier persona
  catalog with the exact wire props (`rank` enum A–K, `suit` enum, `faceDown` boolean); the
  wire contract is untouched (catalog.json stays byte-identical).

### The standard rows

| Row | Decision | Justification (one line) |
|---|---|---|
| **Tag** | `ui-playing-card` / `UIPlayingCardElement` / `controls/playing-card/playing-card.{ts,css,md}` + sibling module `playing-card-pips.ts` | naming §10: no reserved-word/canon collision (`card` = the container; `choice-card`/`service-card` establish the `*-card` compound), derivable, never-abbreviated |
| **Anatomy** | Host renders once: `[data-part="flipper"]` (3D rotor) → `[data-part="face"]` (holding two `[data-part="index"]` corners — top-left, and bottom-right carrying `data-inverted` + a 180° rotation — and `[data-part="pips"]`) + `[data-part="back"]`. BOTH faces stay in the DOM (`backface-visibility: hidden`); `[face-down]` rotates the rotor 180° | a real two-face flip requires both faces painted; parts grammar per anatomy.md, no slots (the card owns all content — nothing is authorable) |
| **Props** | `rank`: `prop.enum('', 'A','2','3','4','5','6','7','8','9','10','J','Q','K')`, reflected, default `''` (blank face — graceful empty, the fleet `''`-first law) · `suit`: `prop.enum('', 'spades','hearts','diamonds','clubs')`, reflected (CSS keys ink + glyph off the attribute), default `''` · `faceDown`: boolean, attribute `face-down`, reflected, default `false` | mirrors the croupier wire contract 1:1 (`mapsTo` untouched); `''` members are the component-side graceful-empty extension, never wire-exposed |
| **Events** | **NONE** — flips/deals are prop-driven; a display leaf emits nothing | no closed-set admission; zero event forks |
| **Geometry** | **tier: `display`**, no new row/class. Box = `inline-size: var(--ui-playing-card-inline-size)` (em-keyed, the pie-chart mark posture: `sm 3.5em · md 5em (default) · lg 7em` via `[size]` repoint, the avatar F3 pattern) with `aspect-ratio: 9 / 14` (bridge 2¼ × 3½ in — the ui-image reserved-box mechanism). Corner radius + index/pip font sizes = `calc()` fractions of the box (radius ≈ box × 0.055, the physical card ratio; the avatar calc idiom) — density-invariant mark geometry, snap-on-resize (never transitioned) | three shipped mechanisms composed (em mark box + [size] repoint + aspect-ratio); the compact ramp explicitly NOT reused (28px ceiling); **no novelty-leg geometry fork** |
| **Tokens** | `--ui-playing-card-inline-size` (geometry, above) · `--ui-playing-card-face-surface` — the face stays LIGHT in BOTH schemes (a depicted physical object, not a UI surface; ADR-0225 cl.4) · `--ui-playing-card-ink` (black suits + rank text — a near-black constant on the pinned-light face, NOT `on-surface`, which flips in dark mode) · `--ui-playing-card-ink-red` (hearts/diamonds — aliases the danger LADDER's flat mode-independent primitives as PIGMENT, explicitly not the danger intent role; ADR-0225 cl.3, the honest token fork: the fleet has no content-red role) · `--ui-playing-card-back-surface` / `--ui-playing-card-back-ink` (the lattice — accent/primary-family ramp steps) · `--ui-playing-card-outline` (hairline, existing outline role) | every token consumes an existing `--md-sys-color-*` primitive/role; the two FORKS (pigment-not-intent red, pinned-light face) are ADR clauses with firm recommendations |
| **A11y** | `internals.role = 'img'`; `internals.ariaLabel` derived: face-up → `"<Rank name> of <suit>"` (`"Ace of spades"`), face-down → `"Face-down card"` — the label MUST NOT leak rank/suit while `faceDown` (the attributes may legitimately be set underneath). Parts are presentational under the img role; identity is text-readable regardless (corner indices are real text; suit glyphs are shape-distinct, so red/black is a redundant carrier — ADR-0057 satisfied by construction, ADR-0219 cl.4's fill-is-never-the-only-carrier applied) | never host ARIA attributes (fleet law); concealment is an information-contract, not just paint |
| **Interaction states** | No deviation to declare — non-interactive, non-focusable display leaf (the divider/icon/swatch class); no hover/active/focus styling, no `[density]` participation (mark geometry is density-invariant, the chart precedent) | display-class posture, not a fork |
| **Form participation** | NONE — `UIElement`, `formAssociated` false; no codec, no value, no validity | display leaf |
| **Motion (greenfield-mechanism check, step 5)** | TWO motions, both on fleet tokens (`--md-sys-motion-duration-fast` / `--md-sys-motion-easing-standard`), NO new motion tokens, NO timing props. **Flip** = `transform: rotateY(180deg)` transition on the flipper (the fleet's FIRST 3D transform — greenfield): gated behind `:state(ready)` (§4b — a card first-painting already face-down must NOT animate), `prefers-reduced-motion` ⇒ `transition: none` (instant swap — static, never nothing), `transform` is on the sanctioned transition list as the part's own channel (§4a's caret-transform allowance; geometry ramp changes still snap). Host carries a `perspective`; `backface-visibility: hidden` both faces. **Deal** = `@starting-style` entrance on the host (opacity + small translate/rotate — the drawer mechanism verbatim), automatic on insertion, reduced-motion ⇒ none. Mechanism-honors-every-attribute check: PASSES TRIVIALLY — no timing/easing/distance prop is minted, nothing configurable can silently no-op | exactly one mechanism per motion; the 3D-flip admission is ADR-0225 cl.6 |
| **Site surfaces** | `playing-card.md` descriptor (tier `display`, extends `UIElement`) · doc + demo pages · gallery/preview specimen (a real dealt hand incl. one face-down card — example-authoring law, no lorem stub) · the standing descriptor/site/barrel gates | testing map owns the bar; slices in §7 |
| **Catalog posture** | **Persona-scoped; the default catalog stays closed.** The croupier persona catalog KEEPS the `PlayingCard` type (catalog.json byte-identical); `factories.ts` retargets to `tag: 'ui-playing-card'` with direct prop pass-through (WeakMap/`render()`/`SUIT_GLYPH` deleted). The new fleet descriptor forces the ADR-0087 gate's other arm: an `EXCLUSION_ALLOWLIST` entry — a NEW justification category (persona-scoped content type: catalogued, but only on the persona surface), extending the chrome-only categories; entry drafted VERBATIM in ADR-0225 cl.2 | the default catalog is generic UI an agent may always emit; a casino-domain object belongs to the persona that teaches it — admitting it fleet-wide is a separate, later decision nobody asked for |

## 5 · Classification (the three axes, descriptor-enum vocabulary)

- **Base class:** `UIElement` — reactive display, no value, no container semantics; none of the
  `_base` families fit (no indicator/range/listbox semantics).
- **Size-class / tier:** `display` — no control height, mark-geometry sizing (geometry.md's
  Display row: intrinsic structural sizing; here the em-keyed owned box).
- **Catalog posture:** persona-scoped (croupier row retarget) + default-catalog
  `EXCLUSION_ALLOWLIST` entry (ADR-0225 cl.2 — the new persona-scoped justification category).

## 6 · Novelty leg (step 5) — what is genuinely new, and what is refused

Genuinely new (each an ADR-0225 clause, firm recommendation attached):
1. **The 3D flip rotor** — the fleet's first `rotateY`/`perspective`/`backface-visibility`
   mechanism (cl.6).
2. **Pigment tokens** — a content color that is NOT an intent role and NOT theme-polarity-bound
   (red suit ink off the danger ladder's flat primitives; pinned-light face) (cl.3/cl.4).
3. **The persona-scoped allowlist category** — an exclusion whose reason is "catalogued
   elsewhere", not "chrome" (cl.2).

No new geometry row/class, no new base class, no new event, no new interaction family, no new
motion tokens.

**Refused from the full-scope reading (with reasoning):**
- **Court art for J/Q/K** — illustrated face cards are image-asset territory (zero-dep law; no
  fleet asset mechanism; illegible at the sm/md ramp anyway). J/Q/K render the large center
  rank letter + suit treatment. The corner indices — the actual identification surface — are
  identical to every other rank.
- **Jokers / rank-enum widening** — the wire contract (croupier catalog.json) is untouched;
  extending the rank enum is a persona-catalog decision, not this mint's.
- **Interactivity (select/flip-on-click, events)** — a display leaf; a selectable card is a
  composition (`ui-choice-card` exists) or a later intake, not scope creep here.
- **A `deal` prop / configurable motion** — no timing props (the swiper lesson: every
  configurable must be honored by the mechanism; the cheapest way to honor that is to mint
  nothing — both motions are automatic + reduced-motion-governed).

## 7 · Decomposition + test plan (build slices, one writer per file)

Manifest: `.claude/docs/decompositions/playing-card-ship.decomp.json` (`--strict` clean; edges
carry the build order). Slices:

1. `controls/playing-card/playing-card-pips.ts` — the per-rank layout table (pure data).
2. `controls/playing-card/playing-card.ts` — host, parts, props, internals label, ready-state.
3. `controls/playing-card/playing-card.css` — tokens, geometry, back lattice, flip + deal
   motion, reduced-motion arms.
4. `controls/playing-card/playing-card.md` — descriptor (drags the standing gates).
5. `playing-card.test.ts` (jsdom) — props/reflection, label derivation + face-down
   concealment, pip-table truth, descriptor validity.
6. `playing-card.browser.test.ts` (existing shard, never a new monolith) — painted truth:
   aspect ratio at every `[size]`, ink contrast both schemes, rotated lower index, pip gestalt
   bounding boxes (test-the-whole-shape), back lattice `background-image`, flip transition
   present only under `:state(ready)`, reduced-motion zero.
7. `controls/index.ts` barrel (serial integration slice — the one shared-file edit).
8. `a2ui` croupier `factories.ts` retarget + `factories.test.ts` update; `catalog.json`
   asserted byte-identical.
9. `a2ui` `catalog/default/index.test.ts` — the `PlayingCard` allowlist entry (verbatim from
   ADR-0225 cl.2).
10. Site doc/demo/gallery specimen pages.

Built-output leg: NOT required — no production-CSS-only behavior beyond the ordinary `@scope`
styling every control carries (the TKT-0002 class does not apply; the back pattern and flip are
plain authored CSS the browser shard already exercises). Eval-catalog page: unaffected — the
eval loop renders the DEFAULT catalog, and `PlayingCard` never enters it (verified: croupier
appears on the site only via `agent-admin-presets.ts`).

Gates for the wave: `npm run check` + `npm test` + `npm run test:browser`, judged by exit
codes.

## 8 · Independent doc review

Gated per `component-design` step 8 — a fresh-context doc-checker pass runs on this intake +
ADR-0225 + the decomposition manifest before any build dispatches (generator ≠ critic; this
seat does not grade its own record). Reviewer pre-arm: this corpus uses the blockquote-header
house style gated by `site/lib/adr.test.ts` + docs-grammar, not scribe frontmatter.
