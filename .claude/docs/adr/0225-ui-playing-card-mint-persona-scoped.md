# ADR-0225 — mint `ui-playing-card`: a true card-face display leaf, persona-scoped in the catalog

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-19 *(authored)* |
> | **Proposed by** | planner (design seat — GH #1478 component-design intake; ADR number host-assigned, next free after 0224 per the file tree + `adr-checkpoint.json`) |
> | **Ratified by** | *(pending — Kim, by explicit `ratify ADR-0225`)* |
> | **Repairs** | none — new component intake, no existing doc corrected. On ratification the build wave applies: NEW `controls/playing-card/playing-card.{ts,css,md}` + `playing-card-pips.ts` · `personas/croupier/factories.ts` retarget (drafted verbatim below; `catalog.json` byte-identical) · `catalog/default/index.test.ts` `EXCLUSION_ALLOWLIST` entry (drafted verbatim below) · site doc/demo/gallery surfaces |
> | **Supersedes / Superseded by** | (none) — retires the croupier factory's `ui-card`+`ui-text`+🂠 composition (GH #497 catalog LLD-C5's rendering half; the WIRE contract it minted stands untouched) · composes ADR-0041 F3 (the `[size]` repoint pattern) · ADR-0219 cl.4–5 + ADR-0057 (identity never color-alone) · ADR-0188 cl.5 (`@starting-style` entry motion) · ADR-0087/ADR-0112 cl.6 (the catalog-or-allowlist gate this extends) |

## Context

The croupier persona catalog (GH #497) promoted `PlayingCard` into a real wire type — `rank`
(enum A–K) × `suit` (enum) × `faceDown` (boolean) — but its factory renders it as a `ui-card`
holding one `ui-text` glyph pair (`"A♠"`), with 🂠 for face-down. Kim ruled on #1478
(2026-08-19): mint the real fleet component, full scope — corner indices (top-left + rotated
bottom-right), suit pips, red/black suit inks, a real CSS back pattern, bridge aspect + size
ramp, deal/flip animation. The intake record is
`.claude/docs/spec/playing-card.intake.md`; the decomposition
`.claude/docs/decompositions/playing-card-ship.decomp.json` (`coverage_check.py --strict`
clean).

The intake found four contract-changing forks the mint cannot proceed without ruling — everything
else composes shipped mechanisms (the em-keyed mark box, the `[size]` repoint, `aspect-ratio`
reserved boxes, `@starting-style` entry motion, the `:state(ready)` transition gate):

1. **Catalog posture.** A new fleet descriptor trips the ADR-0087 gate: every shipped `ui-*`
   descriptor must resolve to a default-catalog row OR an `EXCLUSION_ALLOWLIST` entry. Every
   existing allowlist reason is "app/page chrome, never agent-emittable" (ADR-0112 cl.6's
   family). `PlayingCard` is neither a default row candidate (a casino-domain object in the
   generic catalog nobody asked for) nor chrome — it IS agent-emittable, through exactly one
   surface: the croupier persona catalog.
2. **The red suit ink.** The fleet has no content-red color role. The intent families
   (`danger` et al.) are semantic — using the danger ROLE for hearts would claim an intent that
   isn't there; minting a raw literal would bypass the token system entirely.
3. **Face polarity.** Every fleet surface flips with the color scheme. A playing card is a
   depicted physical object: a dark-mode-inverted card face (light ink on dark "paper") stops
   reading as a playing card at all, and the red/black suit distinction collapses against a
   dark ground.
4. **The flip.** The fleet has no 3D transform anywhere; a real card flip
   (`rotateY`/`perspective`/`backface-visibility`) is a greenfield platform mechanism, which
   under the intake's greenfield check must state what it honors and what it refuses to make
   configurable.

## Decision

**We will mint ONE display leaf `ui-playing-card` (`UIElement`, tier `display`, no events, no
form participation) rendering the true card face/back, retarget the croupier factory to it with
the wire contract byte-untouched, fence it from the default catalog by a persona-scoped
allowlist entry, paint suits with pigment tokens (not intent roles) on a face pinned light in
both schemes, and animate flip/deal on fleet motion tokens with zero configurable timing.**

1. **The mint + factory retarget.** `controls/playing-card/` ships the component (anatomy,
   props, geometry, a11y per the intake fork sheet — props `rank`/`suit`/`faceDown` mirror the
   wire 1:1, plus the `''` graceful-empty members). The croupier factory becomes a direct
   pass-through; `catalog.json` stays byte-identical (the enum contract, `mapsTo`, bindability
   all stand). Drafted `factories.ts` shape (VERBATIM — the whole replacement body):

   ```ts
   export const playingCardFactory: WidgetFactory = {
     tag: 'ui-playing-card',
     create: () => document.createElement('ui-playing-card'),
     applyProp: (el, prop, value) => {
       switch (prop) {
         case 'rank':
           ;(el as unknown as { rank: string }).rank = value == null ? '' : String(value)
           break
         case 'suit':
           ;(el as unknown as { suit: string }).suit = value == null ? '' : String(value)
           break
         case 'faceDown':
           ;(el as unknown as { faceDown: boolean }).faceDown = Boolean(value)
           break
       }
     },
   }
   ```

   `SUIT_GLYPH`, the `PlayingCardState` WeakMap, and `render()` are deleted — the component owns
   all derivation.

2. **Default-catalog posture: allowlist, NEW justification category — persona-scoped content
   type.** The `PlayingCard` type's ONLY emission path is the croupier persona catalog; the
   default catalog stays closed. This extends ADR-0087's exclusion arm beyond the ADR-0112
   cl.6 chrome family with a second legitimate reason: *catalogued elsewhere, on the persona
   surface that teaches it*. Drafted `EXCLUSION_ALLOWLIST` entry (VERBATIM):

   ```ts
   ['PlayingCard',
     'ADR-0225 cl.2 — PERMANENT exclusion from the DEFAULT catalog, the persona-scoped content-type ' +
     'category (a NEW exclusion reason beside ADR-0112 cl.6\'s chrome family): the type IS agent-' +
     'emittable, but only through the croupier persona catalog (personas/croupier/catalog.json), whose ' +
     'fragment + mini-skills teach it; a default-catalog row would hand every generic agent a casino-' +
     'domain object with no teaching context. Widening to the default catalog is a separate, later ' +
     'intake (the mint-vs-compose TYPE arm), never a drive-by row.'],
   ```

3. **Suit inks are PIGMENT tokens, never intent roles.** `--ui-playing-card-ink` (spades/clubs
   + rank text: a near-black constant) and `--ui-playing-card-ink-red` (hearts/diamonds: a
   mid-dark step off the **danger ladder's flat mode-independent primitives** — the hue source,
   explicitly NOT the `danger` intent role and NOT `on-surface`, both of which flip with the
   scheme). Color is a REDUNDANT identity carrier here: rank text + shape-distinct suit glyphs
   carry the identity (ADR-0057 satisfied by construction; ADR-0219 cl.4's
   fill-is-never-the-only-carrier applied). The build's browser gate pins ≥4.5:1 contrast for
   BOTH inks on the face surface in BOTH schemes.

4. **The face is pinned LIGHT in both schemes; the back patterns in theme ink.**
   `--ui-playing-card-face-surface` aliases high-lightness surface primitives in light AND dark
   (a depicted object, the image-content posture — not a themed UI surface); the exact steps
   are the build's, gated by clause 3's contrast probe. The face-down back is a pure-CSS
   lattice (repeating-gradient cross-hatch inside an inset frame — no image asset, no glyph)
   whose inks alias the accent/primary ramp, so the back — the side that IS themed table
   furniture — follows the theme. The 🂠 glyph rendering retires.

5. **Geometry: bridge aspect on an em-keyed owned box; no new geometry row.**
   `aspect-ratio: 9 / 14` (bridge 2¼ × 3½ in), `--ui-playing-card-inline-size` em-keyed
   (`sm 3.5em · md 5em · lg 7em` by `[size]` repoint — the avatar-F3 pattern on the pie-chart
   mark posture; the compact ramp is explicitly NOT reused, its 28px ceiling cannot hold a
   card). Radius + interior type ride `calc()` fractions of the box. Density-invariant;
   ramp changes snap, never animate.

6. **Motion: the fleet's first 3D transform, and zero configurability.** Flip = `rotateY`
   rotor (`perspective` on the host, `backface-visibility: hidden` both faces, both faces
   always in the DOM), transitioning ONLY under `:state(ready)` (a card first-painting
   face-down never animates) on `--md-sys-motion-duration-fast`/`--md-sys-motion-easing-standard`;
   `prefers-reduced-motion` ⇒ instant swap (static, never nothing). Deal = `@starting-style`
   entrance on insertion (the drawer mechanism verbatim); reduced-motion ⇒ none. NO new motion
   tokens, NO timing/easing/distance props — the greenfield mechanism-honors-every-attribute
   check passes because nothing is configurable.

7. **No events, no form participation, no interactivity.** The closed event set is untouched.
   A selectable/clickable card is composition (`ui-choice-card`) or a later intake.

### Refused from the full-scope reading (recorded so the refusals are deliberate)

- **Court art (J/Q/K illustrations)** — image-asset territory against the zero-dep law,
  illegible at the sm/md ramp; J/Q/K take the large center rank-letter treatment, corner
  indices identical to every rank.
- **Rank-enum widening (Jokers)** — the wire contract is untouched by design.
- **A `deal`/motion-config prop** — clause 6's zero-configurability is the recommendation, not
  an omission.

## Consequences

- A new controls folder drags the standing gates (descriptor, barrels, family-coherence,
  naming/sizing/styling, site coverage) — priced into the build wave (the decomposition's
  slices), not this ADR.
- The allowlist gains a second justification CATEGORY; future persona-scoped types cite this
  clause instead of stretching the chrome reasoning. The reversal path stays what ADR-0112's
  amendment proved: allowlist-drain-by-amendment, if `PlayingCard` ever earns a default row.
- The croupier persona's rendered output changes materially (true faces/backs replace glyph
  cards) with ZERO wire/corpus/prompt churn — every existing payload, seed, and taught idiom
  stays valid; no prompt-baseline recapture is triggered (the persona catalog document is
  unchanged). Croupier factory TESTS change (they assert the old `ui-card` composition today).
- Two pigment tokens exist that deliberately do not flip with the scheme — a documented
  exception class (depicted-object color), citable if a future depicted-object component
  (chess pieces, dice) needs the same posture.
- The 3D-transform admission means the browser shard carries the fleet's first
  `transform-style`/`backface-visibility` assertions; jsdom proves none of it (painted truth
  lives in the browser leg only).
- **Stale → re-verify on land:** `personas/croupier/factories.ts` + `factories.test.ts` (the
  drafted retarget) · `catalog/default/index.test.ts` (the drafted entry) · the intake's §7
  slices · `component-patterns` earns a persona-scoped-catalog-posture row on ratification.
