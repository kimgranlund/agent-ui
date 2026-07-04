# ADR-0078 — `ui-text` three-axis redesign: `variant` (M3 type role) × `size` (sm/md/lg) × `as` (real-element semantic stamp) + the `--md-sys-typescale-*` fleet type scale

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-04 *(authored)* |
> | **Proposed by** | planner (the design seat) — turning Kim's ratified three-axis model (intent-extract, 2026-07-04) into the buildable contract. The MODEL's forks (the axis split · the M3 role vocabulary + editorial extras · `size` sm/md/lg default md · real-element stamping) are **Kim's decisions, recorded here, not re-opened**; this ADR resolves the six design questions UNDER that model. |
> | **Ratified by** | Kim (2026-07-04). Both open knobs resolved to **fully M3-canonical 14px**: ① bare `<ui-text>` = body-medium 14px; ② factory `body` → `body/md` 14px (the 2px demo shrink accepted for pure M3 parity). See “Resolved at ratification”. |
> | **Repairs** | `controls/text/{text.ts,text.css,text.md}` (the three-axis contract) · `@agent-ui/shared` `dimensions.css` + `dimensions.test.ts` (`--ui-type-*` → `--md-sys-typescale-*`) · [`0025-ui-text-display-primitive-type-scale.md`](./0025-ui-text-display-primitive-type-scale.md) (reciprocal partial-supersession note) · [`0074-md-sys-color-token-namespace.md`](./0074-md-sys-color-token-namespace.md) (foreseen `## Amendment` — the namespace split widens to typescale) · [`README.md`](./README.md) (0078 log row; 0025 stale status row → accepted) · `rubrics/component.md` Display lens (the `--ui-type-*` + host-as-content lines repaired now with forward pointers; the C6/C7/C10-Display anchors — type-scale binding, internals-heading, heading-effect residue — REWRITE in the build wave, since they describe the shipped control until then) · `references/geometry.md` *Display* row + `references/dimensional-standard.md` (living type-scale refs) · `CLAUDE.md` naming line · `a2ui-catalog.spec.md` §5.2 `Text` row / SPEC-R3 AC1 · `catalog/default/factories.ts` (`textFactory` fan-out) · `site/pages/text-doc.ts` |
> | **Supersedes / Superseded by** | **Supersedes ADR-0025 cl.1's prop schema (the one `variant` enum → the three axes — the Display-leaf class itself STANDS), cl.3/cl.3a (the `--ui-type-*` scale), and cl.4 (internals-only heading semantics); amends cl.2 (slotted content STANDS; void-`render()` gains the stamping exception) and cl.5 (catalog `Text` type STANDS; the factory gains the fan-out).** Amends **ADR-0074**’s “two token namespaces, cleanly split” consequence — the `--md-sys-*` namespace now also carries the typescale, exactly the “future decision MAY adopt additional MD3 roles” it anticipated. Relates: **ADR-0006** (host-as-content — the departure is called out in cl.4) · **ADR-0007** (`*`-ramp-vs-`:root`-constant law — the new family follows it) · **ADR-0076** (renderer honors catalog enums — the wire enum is unchanged, so no enforcement delta) · **ADR-0071** (the derived system prompt derives from `catalog.json`, which is unchanged — zero prompt drift). |

## Context

Kim identified the flaw (verbatim intent): **`<ui-text variant="h4">` conflates a SEMANTIC marker (heading
level) with a VISUAL treatment. “h4” is a semantic marker, not a variant.** Today `variant` is the ONE prop
(`h1…h5 | caption | body`, ADR-0025) doing double duty: it selects typography (`[variant]` →
`--ui-type-{level}-*` repoints in `text.css`) AND semantics (`h1…h5` → `internals.role='heading'` +
`ariaLevel` — no real `<hN>` exists in the DOM). You cannot render a page title that is *semantically* an
`<h2>` but *visually* modest, nor body-sized text that is a real heading — the two concerns share one knob.

Since ADR-0025 the project's declared foundation became **Material Design 3** (ADR-0074: `--md-sys-color-*`
is the official color namespace; Kim's directive — “an extension of Google Material Design 3 is the new
official foundation”). The M3 type scale IS role × size — five roles (display/headline/title/body/label) ×
three sizes (large/medium/small), each cell a `{size, line-height, weight, tracking}` quad — i.e. exactly
the substrate the ratified model needs.

**The ratified model (Kim, 2026-07-04 — decisions, not open questions):**

- **`variant`** = visual type ROLE ∈ `display · headline · title · body · label` (the M3 roles) **+**
  `kicker · overline · quote · lead` (editorial extras). Default `body`.
- **`size`** ∈ `sm · md · lg`, default **`md`** — maps to M3 Small/Medium/Large per role, independent of role.
- **`as`** = the semantic element, **stamping a REAL `<hN>`/`<p>`/`<span>` in light DOM** — Kim explicitly
  chose real-element stamping over the internals-only `role=heading`.

This ADR resolves the six design questions under that model: the token substrate (cl.2), the role-pure
consumption seam (cl.3), the stamping mechanism + the ADR-0006 departure (cl.4), the editorial extras'
treatments (cl.2b), the role×size matrix (cl.1), the A2UI reconciliation (cl.5), and migration (cl.6). The
build delta (§Realization) is the component-builder's executable spec — no re-deciding.

## Decision

### cl.1 — Three orthogonal axes; the full 27-cell matrix is defined

`ui-text` carries **three** reflected enum props (typed literal unions, the `button` `size` precedent):

| Prop | Values | Default | Owns |
|---|---|---|---|
| `variant` | `display · headline · title · body · label · kicker · overline · quote · lead` | `body` | the visual type ROLE (which token block) |
| `size` | `sm · md · lg` | `md` | the size WITHIN the role (which row of the block) |
| `as` | `none · h1 · h2 · h3 · h4 · h5 · h6 · p · span · blockquote` | `none` | document SEMANTICS (which real element is stamped) |

- **Fully orthogonal.** Every `variant × size` cell (9 × 3 = 27) is **defined** — no undefined or aliased
  combos (unlike the control ladder's deliberate shift-by-one aliasing, ADR-0038). Any `as` is legal with any
  visual pair: `as="h2" variant="body"` (a semantically-major, visually-modest heading) and
  `as="none" variant="display" size="lg"` (huge text that is NOT a heading) are both first-class — that
  independence is the point of the split.
- **M3's canonical role↔size pairings are NOT imposed.** M3 guidance pairs contexts with cells
  (e.g. dense-UI headlines ≈ headline-small); here `md` is the universal default for every role and the
  author moves along either axis freely.
- `as` includes **`h6`** (HTML parity — the old vocabulary stopped at h5 only because A2UI's wire enum does;
  a real-element stamp has no reason to forbid `<h6>`) and **`blockquote`** (pairs with `variant="quote"`).
  `none` = no wrapper: the host itself is the styled node, exactly today's model — see cl.4.

### cl.2 — The token substrate: `--md-sys-typescale-{role}-{size}-{property}`, a NEW fleet family; `--ui-type-*` is retired

A NEW token family in `@agent-ui/shared` `dimensions.css`, replacing `--ui-type-*` (7 triples, ADR-0025 —
consumed ONLY by `text.css`, confirmed by grep 2026-07-04, so the retirement's blast radius is `ui-text` +
the token tests + living doc refs):

**`--md-sys-typescale-{role}-{size}-{size|weight|line-height|tracking}`**

- **Spelling is M3-canonical**: roles `display/headline/title/body/label` (+ extension roles, cl.2b), sizes
  **`large/medium/small`** (NOT `lg/md/sm`), properties `size / weight / line-height / tracking` — the
  material-web token shape, greppable 1:1 against the MD3 spec and any future kit export (the ADR-0074
  adopt-the-kit-spelling precedent). The `sm/md/lg` ↔ `small/medium/large` mapping friction is contained in
  `text.css`'s repoint blocks (cl.3). `-font` (font-family) is deliberately NOT minted — the fleet has no
  font-family tokenization yet; a future decision.
- **The extension laws** (this is “an *extension* of M3” — the deviations from M3's literal px table, each
  forced by an existing fleet law):
  - **`-size`** = `calc(<M3 px> * var(--ui-scale))`, declared on the **`*` subtree ramp** (ADR-0007 — a
    subtree `[scale]` must re-multiply display type; `--ui-scale`'s ONLY consumer remains display type,
    ADR-0038 unchanged). NOT `× var(--ui-density)` — type stays density-invariant (ADR-0025's law stands).
  - **`-weight`**, **`-line-height`**, **`-tracking`** = **constants on `:root`** (scale-free, ADR-0007).
    `-line-height` is **unitless**, derived as *M3 line-height px ÷ M3 size px* (so it scales with the
    already-scaled size; at `--ui-scale:1` the rendered line-height equals the M3 px within rounding).
    `-tracking` is **em-converted**, *M3 tracking px ÷ M3 size px* (letter-spacing then rides font-size
    naturally under `[scale]`; M3's px tracking is calibrated to its px size, so the em ratio is the
    scale-invariant form).
- **The core 15 rows are M3-VERBATIM** (the recommended default table; per the ADR-0025/ADR-0015 hand-off
  boundary, exact rounding latitude — 3-decimal line-height, em tracking — is the token-builder's; the LAW
  and the px anchors are fixed here):

  | Role · size | size px | line-height | weight | tracking em |
  |---|---|---|---|---|
  | display-large | 57 | 1.123 | 400 | −0.004 |
  | display-medium | 45 | 1.156 | 400 | 0 |
  | display-small | 36 | 1.222 | 400 | 0 |
  | headline-large | 32 | 1.25 | 400 | 0 |
  | headline-medium | 28 | 1.286 | 400 | 0 |
  | headline-small | 24 | 1.333 | 400 | 0 |
  | title-large | 22 | 1.273 | 400 | 0 |
  | title-medium | 16 | 1.5 | 500 | 0.009 |
  | title-small | 14 | 1.429 | 500 | 0.007 |
  | body-large | 16 | 1.5 | 400 | 0.031 |
  | body-medium | 14 | 1.429 | 400 | 0.018 |
  | body-small | 12 | 1.333 | 400 | 0.033 |
  | label-large | 14 | 1.429 | 500 | 0.007 |
  | label-medium | 12 | 1.333 | 500 | 0.042 |
  | label-small | 11 | 1.455 | 500 | 0.045 |

  *(Anchors are the MD3 default type scale — px size/line-height/weight/tracking per m3.material.io. The
  planner seat cannot fetch; per the repo's verify-cited-authorities discipline the builder/host MUST verify
  this table against the authoritative M3 spec before shipping — a wrong anchor is a defect, not latitude.)*

#### cl.2b — The four editorial extras get EXTENSION rows in the same family

`kicker / overline / quote / lead` are not in the M3 typescale; they are minted as **extension rows** in the
same namespace (marked `/* extension — not MD3 */` in `dimensions.css`), each derived from an M3 anchor so
the family stays arithmetic-not-taste. Their **non-scale treatments** (uppercase, italic, the rule) are NOT
typescale properties and live in `text.css`'s variant blocks (cl.3):

| Extension role | Type rows (per size lg/md/sm) | Derivation + treatment |
|---|---|---|
| **kicker** | label sizes/line-heights · weight **700** · tracking **0.08** | the headline eyebrow: label metrics emboldened + `text-transform: uppercase` (text.css). Ink stays the one neutral on-surface role — an accent-colored kicker was REJECTED (color must not be the load-bearing signifier, ADR-0057 spirit; authors/themes may still color the host). |
| **overline** | label sizes/line-heights · weight 500 · tracking **0.15** | M2's overline heritage (10px/1.5px ≡ 0.15em), which M3 dropped and maps to label-small; + `text-transform: uppercase` (text.css). Distinct from kicker by weight (500 vs 700) and tracking. |
| **lead** | lg **22**/1.455 · md **18**/1.444 · sm **16**/1.5 · weight 400 · tracking 0 (sm: 0.031) | the enlarged opening paragraph: body at title-class sizes with body's weight — lg borrows title-large's 22px at weight 400; sm ≡ body-large; md the midpoint. |
| **quote** | ≡ lead rows (own tokens, changeable independently) | block quotation: lead metrics + `font-style: italic` + an inline-start rule `3px solid var(--md-sys-color-neutral-outline-variant)` + `padding-inline-start` from the `--ui-space-*` rhythm family (builder picks the ≈12px step; rhythm, so density-responsive is correct) — all in text.css. Pairs naturally with `as="blockquote"` (not enforced — axes stay orthogonal). |

Total: 15 M3-verbatim + 12 extension = **27 rows × 4 properties**; `-size` legs on the `*` ramp, the three
constants on `:root` — the same split `dimensions.test.ts` already enforces for the family it replaces.

### cl.3 — Role-pure consumption: the two-block seam survives, now a 9×3 matrix

`text.css` keeps the fleet's two-block shape (ADR-0025 cl.3a's seam law stands; only the fleet family it
repoints to changes):

- **Token block** — `:where(ui-text)` declares the component chain, now **five** tokens, spelled to match
  the new family: `--ui-text-{size, weight, line-height, tracking, color}` (the old `-leading` spelling
  retires with its family; `-color` keeps `--md-sys-color-neutral-on-surface`). Base = **body-medium** (the
  `variant=body size=md` defaults). Then the repoint matrix: **8 role blocks** (`:where(ui-text[variant='display'])`
  → `display-medium`, …) + **18 size-override blocks** (`:where(ui-text[variant='display'][size='lg'])` →
  `display-large`, …). **Attribute-absence law:** defaults do NOT auto-reflect (the shipped `text.css`
  precedent — bare `<ui-text>` has no `variant` attribute), so every `size` override MUST also cover the
  absent-variant body case (`:where(ui-text[size='lg']:not([variant]), ui-text[variant='body'][size='lg'])`).
- **Styles block** — `@scope (ui-text)` consumes ONLY `--ui-text-*` (`font-size/-weight/line-height/
  letter-spacing/color`), plus the variant **treatments** (structural, not scale, opinions): uppercase for
  kicker/overline, italic + rule + indent for quote, and the cl.4 **stamp transparency reset**. `display:
  block`, `user-select: text`, and the forced-colors `CanvasText` block all stand unchanged. The component
  still reads no fleet token directly — zero scale opinion (a table value change never touches the control).

### cl.4 — `as`: a real element is STAMPED around the light-DOM children; the internals-heading path is deleted

**The departure, called out:** ADR-0006/ADR-0025 cl.2's *host-as-content with void `render()`* is amended
for `ui-text`. The **content model stands** — the user's light-DOM children remain the displayed text and
the accessible name; there is still no `text` prop and no `html``` template. What changes: when `as ≠ none`,
`ui-text` **wraps those children in one real semantic element** (the *stamp*). This is deliberately NOT the
template system (`render()` stays void — a template would clobber user-owned content); it is a scope-owned
DOM-adoption effect, the `ui-select` options-move / repeat-seam lineage:

- **Mechanism** (normative; algorithm in §Realization): a `connected()` effect off the `as` signal
  creates/replaces/unwraps the stamp (moving the children, never cloning them — node identity is preserved,
  the ADR-0022 discipline), plus a **childList MutationObserver on the host** that restores the invariant
  whenever nodes land directly on the host. The observer is **load-bearing, not defensive**: (a) a
  parser-streamed `<ui-text as="h4">…` connects BEFORE its children exist — they arrive as host children and
  must be adopted; (b) the A2UI `textFactory` and every bound `text:{path}` update writes
  **`host.textContent`**, which destroys ALL children including the stamp — the observer detects the
  detached stamp and re-stamps around the new text node. **Invariant:** `as ≠ none` ⇒ the host has exactly
  one element child (the stamp) holding all content nodes; any childList mutation converges back to this
  within a microtask. `as = none` ⇒ no stamp, children flow untouched (byte-identical to today).
- **Default `as="none"` — no wrapper.** The host is the styled node: zero extra DOM for the 80 % display
  case, and the bare `<ui-text>` DOM shape is unchanged from today. (`p`-by-default was rejected — it taxes
  every chip/caption/cell leaf with a wrapper and makes `<ui-text>` inside phrasing contexts invalid HTML.)
- **Semantics move to the platform; ElementInternals exits.** The ADR-0025 cl.4 `connected()` effect
  (`internals.role='heading'` + `ariaLevel`) is **deleted** — a stamped `<h4>` IS the heading (name = its
  content, free), `<p>`/`<blockquote>`/`<span>` carry their native roles, and keeping an internals role on
  the host beside a real `<hN>` child would double-announce. `variant` alone now has **zero** semantic
  effect — an agent wanting a document heading must say `as` (the honest version of ADR-0025's
  spurious-heading tradeoff: semantics are now opt-in and explicit).
- **The stamp is visually transparent.** All typography stays on the host (the stamp inherits); the styles
  block resets the UA's element styles: `:scope > :is(h1,h2,h3,h4,h5,h6,p,blockquote,span) { margin: 0;
  font: inherit; letter-spacing: inherit; color: inherit; }` — so `as` changes semantics with **zero
  geometry delta** (asserted in the browser tests: same rendered box with and without a stamp).
  `display: contents` on the stamp was rejected: the explicit reset achieves the same layout with none of
  `display:contents`' assistive-tech regression history. `user-select: text` and the accessible-name path
  survive by inheritance/containment.

### cl.5 — A2UI reconciliation: the wire vocabulary is UNCHANGED; `textFactory` fans one wire `variant` out to the triple

A2UI v1.0's `Text` is protocol-fixed: `text` (bindable) + `variant ∈ h1…h5/caption/body` (ADR-0025's
verified reading). The catalog stays **protocol-faithful**; the translation to the new axes happens at the
factory seam:

- **`catalog.json` — UNCHANGED.** The `Text` row keeps `variant` enum `[h1…h5, caption, body]`,
  `text → textContent`. Consequences that fall out for free: `conformance.ts`/ADR-0076 enum enforcement
  unchanged · every shipped example payload (`examples/patterns.ts`, `examples/dynamic-lists.ts`,
  `site/pages/a2ui-*`) unchanged · the ADR-0071 drift-gated derived system prompt (derives from
  `catalog.json`) unchanged — zero corpus/prompt churn.
- **`factories.ts` `textFactory`** (the already-blessed bespoke factory, ADR-0025 cl.5) — `applyProp(el,
  'variant', v)` now translates the non-bindable wire value through a fixed table to the element triple
  (`text` → `textContent` is untouched; the cl.4 observer makes every later bound-text write safe):

  | Wire `variant` | → `as` | → `variant` | → `size` | Rendered (was) |
  |---|---|---|---|---|
  | `h1` | `h1` | `display` | `sm` | 36px (was 40) |
  | `h2` | `h2` | `headline` | `lg` | 32px (was 33) |
  | `h3` | `h3` | `headline` | `md` | 28px (was 28 — exact) |
  | `h4` | `h4` | `headline` | `sm` | 24px (was 23) |
  | `h5` | `h5` | `title` | `lg` | 22px (was 19) |
  | `body` | `none` | `body` | `md` | 14px (was 16 — Kim's knob ②: fully-M3) |
  | `caption` | `none` | `body` | `sm` | 12px (was 13; M2→M3's own caption≡body-small migration) |

  The table's principle is **nearest-M3-row** to the shipped ADR-0025 ramp (≤4px drift), and the five
  heading levels now stamp REAL `<h1>…<h5>` (an accessibility upgrade the demos get for free).
  **Ratified (knob ②): `body`→`body/md` 14px** — the fully-M3-canonical mapping; Kim accepted the 2px body
  shrink across the shipped demos for spec parity (the `body`→`body/lg` 16px visual-parity alternative was declined).
- **Conceptual owners (a2ui seat executes; named, not edited here):** `catalog/default/factories.ts` +
  `factories.test.ts` (the fan-out) · `a2ui-catalog.spec.md` §5.2 `Text` row + SPEC-R3 AC1 note (record the
  wire→triple table) · `a2ui-catalog.lld.md` where it describes `textFactory`.

### cl.6 — Migration: hard break, no deprecated alias

Old `variant` values (`h1…h5`, `caption`) are **removed**, not aliased (pre-1.0, small enumerated consumer
base; ADR-0074's own rejection of dual live vocabularies — “two live namespaces for one thing is drift by
construction”). An old value now fails the enum codec and falls back to `body/md` — silently, which is
acceptable ONLY because the consumer base is enumerated and swept in the same build (§Realization M-list),
and a zero-survivor grep (`variant="(h[1-5]|caption)"` over `packages/ site/`) lands as the regression
guard. The old fleet family `--ui-type-*` is deleted the same way (its only consumer is `text.css`).
**Living references update in the same build; historical ADRs stand untouched** (0007/0025/0032–0038 cite
`--ui-type-*` as history — unlike ADR-0074's same-name sweep, rewriting them here would falsify decisions
about a structurally different family; ADR-0078 is the forward pointer).

## Resolved at ratification (Kim, 2026-07-04)

Both knobs were resolved to the **fully-M3-canonical 14px** policy:

1. **Default body size → M3-verbatim 14px (RESOLVED).** Bare `<ui-text>` renders body-medium **14px** (today:
   16px); `size="lg"` gives today's 16/1.5 where reading comfort matters. The re-anchor-to-16px alternative
   was declined (it forfeits 1:1 M3 parity and cascades re-derivation across the table).
2. **Factory `body` mapping → M3-canonical `body/md` 14px (RESOLVED).** Consistent with the element default;
   Kim accepted the 2px shrink of the shipped A2UI demos in exchange for full M3 parity (the `body/lg` 16px
   visual-parity alternative was declined).

## Consequences

- **Realized by** (dependency order; one build wave): **token-builder** — `dimensions.css` swap +
  `dimensions.test.ts` rewrite (+ M3-table verification against m3.material.io, cl.2's note) →
  **component-builder** — `controls/text/*` (props, stamping, CSS matrix, descriptor, tests) →
  **a2ui owner** — `textFactory` fan-out + spec/LLD rows (cl.5) → **docs/site steward** — `text-doc.ts`
  rework + living-reference repairs → **component-reviewer** — NON-optional before commit (the
  test-the-whole-shape law), with the browser gate (`npm run test:browser`) and a manual `npm run size`
  (ui-text's marginal grows: observer + stamping; re-measure the `text.md` marginal note; family budget
  22 KB, ADR-0049 — 929 B headroom pre-wave, a re-base may be needed).
- **Stale → re-verify (same-build record repairs):** `text.md` (three attributes; aria section now
  “roleSource: stamped element”, internals rows deleted; slots note children flow into the stamp; geometry
  rows spell `--ui-text-line-height`; marginal re-measured) · `references/geometry.md` Display row
  (`--md-sys-typescale-{role}-{size}-*`, role×size) · ADR-0036's Display-exclusion line cites per-level
  leading — repoint the living sentence in `geometry.md` it feeds, ADR text stands · `references/
  dimensional-standard.md` type-family row · `CLAUDE.md` naming line (tokens `--ui-{name}-*` / color
  `--md-sys-color-*` / **typescale `--md-sys-typescale-*`**) · `references/tokens.md` if it gains a type
  section · a2ui spec/LLD rows (cl.5) · the host's project-ledger memory (flagged to the host, not edited).
- **Honest negatives.** (a) Bare `<ui-text>` drops 16→14px (knob ① ratified M3-verbatim) AND the shipped
  A2UI demos' body text drops 16→14px (knob ② ratified `body/md`) — the default-visual changes this
  redesign ships, accepted at ratification for full M3 parity. (b) The MutationObserver is ui-text's first bit of always-on machinery — cost
  is one childList observer per instance, no subtree; measured by the marginal note. (c) A `variant` alone
  no longer announces headings — any consumer that relied on `variant="h4"` for AT semantics MUST add
  `as="h4"` (the migration sweep covers the enumerated base; external consumers: none, pre-1.0).
  (d) Em-converted tracking rounds M3's px values (≤0.001em error). (e) The 27-block CSS matrix is
  mechanical but large; the css test pins it. (f) The cl.2 table is authored from planner knowledge of the
  M3 spec and MUST be verified at build (named above — the repo-absence≠spec-absence discipline).

## Realization — the build delta (the component-builder's spec)

**B1 · tokens (`@agent-ui/shared`).** In `dimensions.css`: delete the 7 `--ui-type-*` triples (both the `*`
ramp `-size` legs and the `:root` constants); add the 27-row family per cl.2/cl.2b — 27 × `-size` on the `*`
ramp as `calc(Npx * var(--ui-scale))`, 27 × `-weight`/`-line-height`/`-tracking` on `:root` (line-height
unitless 3-dp; tracking em 3-dp, `0` where zero). Rewrite `dimensions.test.ts`'s tok-type describe: assert
the exact table (spot-check all 15 M3 rows + the 12 extension rows), the ramp/constant split, `--ui-scale`
only on `-size`, no `[density]` touch, unitless line-height, and zero `--ui-type-` survivors.

**B2 · props (`text.ts`).**
```ts
const props = {
  variant: { ...prop.enum(['display','headline','title','body','label','kicker','overline','quote','lead'] as const, 'body'), reflect: true },
  size:    { ...prop.enum(['sm','md','lg'] as const, 'md'), reflect: true },
  as:      { ...prop.enum(['none','h1','h2','h3','h4','h5','h6','p','span','blockquote'] as const, 'none'), reflect: true },
} satisfies PropsSchema
```
Delete `HEADING_VARIANTS` + the internals effect entirely (`internals.role`/`ariaLevel` never set).

**B3 · stamping (`text.ts`).** Private `#stamp: HTMLElement | null`. In `connected()`:
(1) `this.effect(() => this.#restamp(this.as))`; (2) a `MutationObserver(() => this.#heal())` observing
`this` with `{ childList: true }`, disconnected on element disconnect (zero residue — tie to the connection
teardown; `disconnected()` hook or the abort signal).
- `#restamp(tag)`: `none` → if stamp: move `stamp.childNodes` back to host (insert at stamp's position),
  remove stamp, null the field. Else if `#stamp?.localName === tag` → no-op. Else → `createElement(tag)`,
  move the current content nodes into it (`stamp ? stamp.childNodes : host.childNodes` — moves, never
  clones), then `replaceWith`/`append`.
- `#heal()`: no stamp → return. Stamp detached (`parentNode !== this`, the `textContent`-clobber case) →
  null the field and `#restamp(this.as)` fresh (never re-append the detached stamp — it holds stale
  content). Else → adopt every host child node `≠ #stamp` into the stamp (append order). Self-converging:
  adoption only removes from the host, so the re-fired observer finds the invariant satisfied.

**B4 · CSS (`text.css`).** Token block: base = body-medium + `--ui-text-color`; 8 role blocks + 18 size
overrides per cl.3 (each override covering `:not([variant])` for body). Styles block: consume the five
`--ui-text-*`; add `letter-spacing: var(--ui-text-tracking)`; treatment rules for kicker/overline
(uppercase), quote (italic + rule + indent, cl.2b); the stamp reset (cl.4); keep `display:block`,
`user-select:text`, forced-colors.

**B5 · descriptor (`text.md`).** `attributes[]` = the three enums (mirrors B2 — the trip-wire);
`slots.text` description gains the stamp note; `aria:` rewritten — role from the STAMPED element (native),
no internals, `labelSource: textContent` stands; `geometry:` rows spell the new component tokens; keyboard/
face/customStates unchanged; re-measure the marginal comment.

**B6 · tests.** `text.test.ts`: three defaults; `@ts-expect-error` per prop; internals.role stays null even
with `as="h1"`. `text-descriptor.test.ts`: three-attribute mirror. `text-css.test.ts`: token block reads
`--md-sys-typescale-*`; matrix spot-checks incl. the `:not([variant])` legs; zero `--ui-type-` survivors.
`text.browser.test.ts` (Chromium + WebKit): stamp create / `as`-change re-stamp (node identity of content
preserved) / unwrap; **parser-streamed adoption** (children after connect); **`textContent`-clobber
self-heal** (write `host.textContent` post-stamp, await a microtask, assert fresh stamp wraps the new text —
the exact A2UI bound-text path); computed `font-size` samples (36px display/sm · 22px title/lg · 14px
body/md) + `[scale]` re-multiplication; **zero geometry delta** host box with vs without stamp; a stamped
`<h4>` exists in the tree (real-heading exposure); uppercase/italic/rule treatments; forced-colors.

**B7 · a2ui (its owner).** `textFactory`: the cl.5 fan-out table (non-bindable `variant` translates at
apply; unknown value → the `body` triple); `factories.test.ts` asserts all 7 rows land as triples;
spec/LLD rows per cl.5. No payload, catalog, conformance, or prompt changes.

**M · migration sweep (same build).** `site/pages/text-doc.ts` (rework: variant ramp × size row + an `as`
specimen; intro text) · any straggler `<ui-text variant="h…|caption">` in `site/`/`packages/` (today: none
outside the text control's own docs/tests — verified by grep; the zero-survivor grep lands as the guard) ·
delete `--ui-type-*` refs from living docs (cl.6 list) · `text-doc` page prose. Gates: `npm run check` +
`npm test` + `npm run test:browser` green; manual `npm run size`.

## Alternatives considered

- **Extend `--ui-type-*` with role×size names instead of a new family** — rejected: the foundation is
  declared M3 (ADR-0074); a parallel `--ui-*` spelling of M3's own table forfeits 1:1 spec/kit greppability
  and re-opens the exact dual-namespace drift ADR-0074 closed for color.
- **Token sizes spelled `sm/md/lg`** — rejected: the attribute vocabulary is the fleet's, but the TOKEN
  family is the M3 contract; `large/medium/small` matches material-web/kit exports verbatim. The mapping
  lives in one file (`text.css`).
- **Re-anchor body-medium at 16px** (extension table) — rejected, surfaced as knob ①: it silently forks
  every downstream M3 value (the table stops being verifiable against the spec) to preserve one default.
- **`as` default `p` (or `span`)** — rejected: taxes every non-document leaf (chips, captions, table cells)
  with a wrapper and semantic noise; `none` keeps today's DOM shape and makes semantics opt-in.
- **Keep internals `role=heading` driven by `as`** (no real element) — rejected by Kim (the ratified model):
  real elements give native semantics, reader shortcuts, copy-paste fidelity, and outline tooling for free.
- **Keep internals role ALONGSIDE the stamp** — rejected: double-announcement risk; one source of truth.
- **Wrap via the template system (`render()` returns the wrapper)** — rejected: templates own their output;
  user-owned light-DOM children would be clobbered on first commit (the exact reason ADR-0025 cl.2 chose
  void `render()`). The adoption effect wraps without owning content.
- **`display: contents` stamp instead of the inherit/margin reset** — rejected: identical layout is
  achievable with the reset, without `display:contents`' assistive-technology regression history on
  semantic elements.
- **No MutationObserver (adopt once at connect)** — rejected: provably insufficient — parser streaming
  delivers children after connect, and every A2UI bound-text update writes `host.textContent`, destroying
  the stamp; both paths then render OUTSIDE the wrapper (a silent semantics/typography loss).
- **Extend the A2UI wire enum to the new axes** (catalog `variant: display…`, `size`, `as`) — deferred, not
  taken: it breaks protocol familiarity (SPEC-R3 names alignment with A2UI's Basic catalog as a goal),
  invalidates the shipped corpus/examples/derived prompt, and buys nothing the factory fan-out doesn't.
  A future catalog revision may expose the axes additively.
- **Deprecated-alias the old `variant` values** — rejected (cl.6): dual vocabularies rot; pre-1.0 with an
  enumerated, same-build-swept consumer base, the hard break + zero-survivor grep is cheaper and honest.
- **Accent-colored kicker ink** — rejected (cl.2b): color as the distinguishing signifier violates the
  ADR-0057 non-color-signifier rule; weight + tracking + case carry the distinction.
