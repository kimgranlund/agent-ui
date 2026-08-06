# Decomposition — M-D CONTENT slice: concierge + croupier idiom-by-idiom catalog promotion

> Status: proposed · v0.1 · 2026-08-06 · Contract: ADR-0172 (ratified) + `persona-catalog-composition.spec.md`
> v0.2 (accepted) already rule HOW fragment packages compose (`composeCatalog`, reject-loud collisions,
> `<base>--<persona>` derived ids, `catalog/personas/<persona-id>/` package shape). This note rules WHAT
> ships as content for the two demonstrating personas (GH #421 AC2, GH #497). Not an ADR — no architectural
> fork is opened here; every promotion argued below is a direct application of ADR-0172 cl.1's ruling +
> SPEC-R1's package shape + the promotion bar GH #497 states. Build dispatch consumes §1's table + §2's
> shapes; it does not re-litigate them.
>
> Sources read: ADR-0172 (`0172-persona-catalog-composition-intake.md`), SPEC v0.2 (`persona-catalog-composition.spec.md`),
> PR #492 (`9e712f0`, the `fixture-demo` package + `compose.ts`/`compose.test.ts`), `site/pages/agent-admin-presets.ts`
> + `site/pages/agent-admin-libraries.ts` (concierge/croupier config + seed libraries), the mini-skill registry
> (`packages/agent-ui/a2ui/src/agent/prompts/mini-skills/{card-layout,game-table-chrome,game-hud}.md`), the
> default catalog (`packages/agent-ui/a2ui/src/catalog/default/catalog.json`), `renderer/checks.ts` (ADR-0029),
> the rubric (`.claude/docs/rubrics/a2ui-catalog.md` v0.1) + GH #493 (its named fit-gap), and TKT-0080 (a real,
> closed live-bug precedent cited for scoping, not overclaimed — see §1 footnote).

## 1 · Per-idiom promotion table

The promotion bar (GH #497, restated): a type earns catalog promotion when validation-enforceability adds
real value over prose teaching — i.e. there is a NEW schema surface, or a producer-authoring burden that
moves from "the LLM must get English-language instructions right every time" to "client code that cannot
get it wrong." A pure-arrangement idiom whose every part is already a validated existing catalog row stays
prose.

| Persona | Idiom | Verdict | Argument | Fleet controls it factors into |
|---|---|---|---|---|
| Concierge | **booking-flow** (range Calendar + Select + Checkbox extras + checks gating one Submit, confirmation bound to submitted values) | **PROMOTE** — two types: `BookingForm`, `BookingConfirmation` | Two concrete, currently-real authoring failure modes this closes structurally: (a) today `checks` gating a Submit is a WIRE-level array the producer must hand-author on the Button node (`renderer/checks.ts` — `wireChecks` reads `node.checks` per mounted node); a booking form with N required fields means N hand-written `{call,args,message}` entries the producer can under- or over-write. `BookingForm`'s `fields` prop (per-field `required`) lets the factory wrap the assembled controls in a real `ui-form-provider` (`submitGate:true`, the EXISTING `FormProvider` row's own mechanism, ADR-0054) and propagate native `required` — the gating computation moves from producer prose-following to deterministic client code, eliminating "forgot a required-field check" as a producer mistake class entirely. (b) "confirmation bound to the SAME data-model values the form wrote, never re-ask a value the model already holds" is a real, currently unenforced constraint — `Text.text` accepts either a literal or a `{path}` binding today, so nothing stops a producer from echoing a LITERAL string in a confirmation Card instead of a live binding (silent value drift). `BookingConfirmation`'s `rows: [{label, path}]` schema has NO literal-value slot at all — structurally, a confirmation row can only ever be a bound pointer, never a hand-typed echo. Both failure modes are exactly the "teaching bug, not renderer bug" class the M-B lesson names, and both close by construction, not by better prose. | `ui-form-provider` (submitGate), `ui-calendar` (range/single), `ui-select`, `ui-checkbox`, `ui-button`, `ui-card` (+ header/content/footer), `ui-text` |
| Concierge | **gallery-swiper** (tour images) | STAYS PROSE | Pure arrangement: `Swiper > SwiperItem > Card > Text (title) + Text (caption) + Badge`. Every part (`Swiper`, `SwiperItem`, `Card`, `Text`, `Badge`) is already a validated default-catalog row (`catalog/default/catalog.json:602,620` etc.) with its own enums/bindable props; nothing about "which existing type nests inside which" is schema-expressible in a way prose doesn't already state as well. No new data shape — the tile set is templated via `Swiper`'s existing `ChildList`, the SAME generic mechanism every other list idiom in the fleet uses. | — (no new type; existing `Swiper`/`SwiperItem`/`Card`/`Text`/`Badge`) |
| Concierge | **itinerary-timeline** | STAYS PROSE | `Timeline > TimelineItem` already exists with a real enum (`TimelineItem.status ∈ {'',pending,active,done,error}`, `catalog/default/catalog.json:591`) and bindable `label`/`description` — the idiom is "use Timeline for a day plan," not a new shape. Nothing to validate beyond what `TimelineItem` already validates. | — (existing `Timeline`/`TimelineItem`) |
| Concierge | **menu-card** | STAYS PROSE | `Card > List (dishes) + Badge (price)` — pure arrangement of already-validated rows (`List`, `Badge`, `Text`). The "dietary marks as text, never color alone" rule is a copy/a11y instruction, not a schema constraint any PropDef could express. | — (existing `Card`/`List`/`Badge`/`Text`) |
| Concierge | **facility-info card** | STAYS PROSE | One `Card` with a title `Text` + labeled body rows + ≤2 `Button`s — pure arrangement, no gating, no confirmation-binding risk, nothing new to enforce. | — (existing `Card`/`Text`/`Button`) |
| Croupier | **card rendering** (rank+suit glyph formatting, face-down handling — the card-rendering HALF of "card-table hand/score layout") | **PROMOTE** — one type: `PlayingCard` | Today a card is a bare `Text` string the producer hand-formats ("K♠", "10♥" — `card-layout.md` verbatim: "glyphs ♠ ♥ ♦ ♣ always — never a bare rank letter"). Nothing in the schema constrains this: `Text.text` is an unconstrained string, so a malformed rank, a missing suit glyph, or a bare letter all validate cleanly today and only fail at the READING layer (an agent or a user misreads a glyph-less "K"). `PlayingCard.rank`/`.suit` as closed enums make a malformed card a `CATALOG` validation failure instead of a silent formatting defect — a genuinely new, currently-absent schema surface. Face-down handling (today: a SEPARATE Card+"🂠" construction the producer must remember to swap to) becomes one `faceDown: boolean` on the SAME type. **Explicitly NOT claimed:** this does not close TKT-0080 (the recurring-empty-tile bug) — that was a `ChildList`-template item-relative-binding gap at the GRAMMAR layer (`scopedPointer`, `binding.ts:118`), already fixed in prose (`grammar.md` + `card-layout.md`'s own template-binding line) and orthogonal to card FORMATTING; a composite `WidgetFactory` cannot fix a wire-templating grammar gap (see §3 for why this distinction matters to what retires). | `ui-card` (brightness), `ui-text` (variant h3, emphasis) |
| Croupier | **table-frame arrangement** (the chrome HALF of "card-table hand/score layout": `Card > CardHeader/CardContent(zones)/CardFooter`) | STAYS PROSE | Pure slot arrangement over already-validated rows (`Card`, `CardHeader`, `CardContent`, `CardFooter`, `Row`, `Column`, `Text`, `Badge`) — no new data shape, no gating, no binding-drift risk. A composite here would be a DRY convenience over existing rows, not a closed validation gap (the promotion bar's own "nothing to validate that isn't already covered by existing fleet controls" case). | — (existing `Card` family + `Row`/`Column`/`Text`/`Badge`) |
| Croupier | **game-HUD** (score badges, chips Stat, Progress, status Text) | STAYS PROSE | Every part (`Badge.intent`, `Stat.value`/`.delta`, `Progress.value`/`.max`, `Text.variant`) is an existing, already-validated row. The actual "teaching" content here is game-RULE semantics (which `intent` a win/bust/push maps to) — that mapping is computed by the agent's own turn logic from the round outcome; no schema can pre-decide it, and no PropDef enum can validate "the right `intent` for THIS round's actual outcome" (that is business logic, not shape). | — (existing `Badge`/`Stat`/`Progress`/`Text`) |
| Croupier | **round-loop** | STAYS PROSE | A procedural/workflow instruction ("one surfaceId, each move is an `updateDataModel`, never redraw") — it has no component shape at all; there is nothing a catalog schema entry could express for it. Not a candidate by construction, not a close call. | — (no component involved) |

**Reading the table:** of the 8 named idioms, 2 promote (`BookingForm`/`BookingConfirmation` for concierge,
`PlayingCard` for croupier), 6 stay prose. Both promoted cases share the same shape of argument: a producer
authoring burden that is CURRENTLY unenforced and has a concrete, nameable failure mode (checks omission,
confirmation-value drift, malformed/inconsistent card glyphs) — not "this idiom is common" or "GH #421 named
it first." The five pure-arrangement idioms (gallery-swiper, itinerary-timeline, menu-card, facility-info,
table-frame, game-HUD) all fail the bar the same way: every part is already a validated row, so a composite
would encode DRY convenience, not close a validation gap — exactly the bar's own stated disqualifier.

## 2 · Fragment package shapes

Both mirror `catalog/personas/fixture-demo/`'s shape (SPEC-R1: `catalog.json` + `factories.ts` + `index.ts`,
optional `functions.ts` — neither fragment below needs one). Neither introduces a new `ui-*` component;
every factory assembles EXISTING `@agent-ui/components` controls via a composite `WidgetFactory.create()`
(no precedent for this shape exists yet in `default/` or `a2ui-basic/`'s own factories — GH #497 authorizes
it for this slice; §4 flags the rubric-fit consequence).

### 2.1 `packages/agent-ui/a2ui/src/catalog/personas/concierge/`

**`catalog.json` (sketch):**
```jsonc
{
  "components": {
    "BookingForm": {
      "properties": {
        "title": { "type": { "type": "string" }, "mapsTo": "title" },
        "fields": {
          "type": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "kind": { "type": "string", "enum": ["dateRange", "dateSingle", "select", "checkbox"] },
                "path": { "type": "string" },
                "label": { "type": "string" },
                "required": { "type": "boolean" },
                "options": {
                  "type": "array",
                  "items": { "type": "object", "properties": { "value": { "type": "string" }, "label": { "type": "string" } } }
                }
              },
              "required": ["kind", "path", "label"]
            }
          },
          "mapsTo": "fields"
        },
        "submitLabel": { "type": { "type": "string" }, "mapsTo": "submitLabel" },
        "submitAction": {
          "type": {
            "type": "object",
            "properties": { "action": { "type": "string" }, "context": { "type": "object" }, "wantResponse": { "type": "boolean" } },
            "required": ["action"]
          },
          "mapsTo": "submitAction"
        }
      }
    },
    "BookingConfirmation": {
      "properties": {
        "title": { "type": { "type": "string" }, "mapsTo": "title" },
        "rows": {
          "type": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": { "label": { "type": "string" }, "path": { "type": "string" } },
              "required": ["label", "path"]
            }
          },
          "mapsTo": "rows"
        }
      }
    }
  },
  "functions": {}
}
```

**`factories.ts` (signatures, not bodies):**
```ts
// bookingFormFactory: WidgetFactory
//   tag: 'ui-form-provider' (the actual mounted root — submitGate:true, reusing the SAME mechanism
//   the default catalog's shipped FormProvider row already carries, ADR-0054)
//   create(): assembles a ui-form-provider wrapping one ui-calendar/ui-select/ui-checkbox per `fields`
//     entry (kind → control), each with native `required` set from the field's `required` flag, plus
//     a trailing ui-button (submitLabel/submitAction).
//   applyProp(el, prop, value): 'fields' rebuilds the inner control set; 'title'/'submitLabel' map
//     directly; 'submitAction' maps onto the trailing button's `action`.
//   submitGate: true
export const bookingFormFactory: WidgetFactory = { /* ... */ }

// bookingConfirmationFactory: WidgetFactory
//   tag: 'ui-card'
//   create(): a ui-card containing one ui-text row per `rows` entry — 'title' Text (label) is a
//     literal, but the row's VALUE Text is ALWAYS constructed as a bound Text (its content ships
//     from the row's `path`, never a literal) — the schema gives this factory no other option, which
//     is the whole point (§1's argument).
//   applyProp(el, prop, value): 'rows' rebuilds the bound row set.
export const bookingConfirmationFactory: WidgetFactory = { /* ... */ }
```

**`index.ts`:** exports `concierge{Fragment,Factories,TargetCatalogs,Persona}` mirroring
`fixture-demo/index.ts`'s five exports 1:1 (`CONCIERGE_PERSONA_ID = 'concierge'`).

**Open build question (flagged, not settled here):** how `fields[].path` / `rows[].path` resolve to LIVE
data-model values inside the factory. Two candidate mechanisms exist in-tree and neither is obviously the
right fit without testing: (a) the renderer's ordinary top-level `bindable` prop resolution (resolves
`{path}` BEFORE `applyProp` is called) — but `fields`/`rows` here carry a `path` STRING nested inside an
array item, not a top-level `{path}` marker, so it is not obvious the existing resolver reaches it; (b) the
factory does its own per-item `surface`/`evaluate` subscription, mirroring `renderer/checks.ts`'s own
pattern (`evaluate()` called per check, reactively). This is a real LLD-level decision, not a design-note
one — named here so the build dispatch doesn't discover it mid-build.

### 2.2 `packages/agent-ui/a2ui/src/catalog/personas/croupier/`

**`catalog.json`:**
```jsonc
{
  "components": {
    "PlayingCard": {
      "properties": {
        "rank": {
          "type": { "type": "string", "enum": ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] },
          "bindable": true,
          "mapsTo": "rank"
        },
        "suit": {
          "type": { "type": "string", "enum": ["spades", "hearts", "diamonds", "clubs"] },
          "bindable": true,
          "mapsTo": "suit"
        },
        "faceDown": { "type": { "type": "boolean" }, "bindable": true, "mapsTo": "faceDown" }
      }
    }
  },
  "functions": {}
}
```

**`factories.ts`:**
```ts
// playingCardFactory: WidgetFactory
//   tag: 'ui-card'
//   create(): a ui-card (brightness "-1" when faceDown) containing one ui-text (variant "h3",
//     emphasis true) whose textContent is derived: faceDown → "🂠"; else rank+suit-glyph pair
//     ("K♠", "10♥", "A♦") via a fixed suit→glyph map ({spades:'♠',hearts:'♥',diamonds:'♦',clubs:'♣'}).
//   applyProp(el, prop, value): 'rank'/'suit'/'faceDown' all re-derive the composed glyph string;
//     'faceDown' additionally toggles the card's brightness.
export const playingCardFactory: WidgetFactory = { /* ... */ }
```

**`index.ts`:** mirrors `fixture-demo/index.ts` (`CROUPIER_PERSONA_ID = 'croupier'`).

**`targetCatalogs` for both fragments — flagged, not ruled here.** SPEC-N5 (v0.2) widens composition to
BOTH shipped bases by default. Both composites are built directly against `@agent-ui/components` DOM
controls, which both `agent-ui` and `a2ui-basic` bind to — nothing in either fragment's OWN vocabulary
collides with either base (reject-loud collision, SPEC-R2, only trips on a name match; `BookingForm`/
`BookingConfirmation`/`PlayingCard` are new names in both). Recommending `targetCatalogs: ['agent-ui',
'a2ui-basic']` for both by default, but flagging as an open item: neither this note nor the SPEC's own
text has verified empirically that `a2ui-basic`'s own dialect (its narrower `ChoicePicker`/boolean-
`CheckBox` shapes, ADR-0169 cl.9) composes cleanly with a factory that reaches for `ui-select`/
`ui-checkbox` unconditionally — the build slice should prove this with a real fixture the way
`fixture-demo` proved cross-base composition generically, not assume it from this note.

## 3 · Retiring prose — LOUD flag, per the byte-pinned prompt-equivalence baseline re-capture rule

**The rule, found and cited (not guessed):** `packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`
is the golden reference ADR-0135 cl.15 pins; `prompt-equivalence.test.ts`'s own header: *"regenerate it ONLY
when a prompt's TEXT is deliberately changed (edit the `.md`, then re-capture), never to make a red gate
pass."* The `a2ui-prompt-author` skill (`.claude/skills/a2ui-prompt-author/SKILL.md`) is the sanctioned
editing discipline for anything under `packages/agent-ui/a2ui/src/agent/prompts/` — this baseline covers
`MINI_SKILLS` (every `prompts/mini-skills/*.md` file's id/triggers/body) byte-for-byte.

**What actually retires, and where each piece lives (three DIFFERENT prose surfaces per persona — do not
conflate them):**

1. **`packages/agent-ui/a2ui/src/agent/prompts/mini-skills/card-layout.md` — PARTIAL trim, BYTE-PINNED,
   requires the `a2ui-prompt-author` recapture flow.** Only the glyph-formatting sentence ("Each card is
   its OWN small Card... rank+suit together... glyphs ♠ ♥ ♦ ♣ always — never a bare rank letter... A
   face-down/hole card is a Card with brightness '-1' holding a Text '🂠'") becomes redundant once
   `PlayingCard` ships — the REST of the file (the `Row`-of-cards arrangement + the template item-relative
   binding rule, TKT-0080's own fix) stays prose UNCHANGED (§1's table: table-frame arrangement stays
   prose; the binding-grammar rule is orthogonal to card formatting, not superseded by it). This is a
   same-file PARTIAL retirement, the trickiest kind to get right — trim only the formatting clause, keep
   the rest byte-stable apart from that one edit, then re-capture the baseline deliberately.
2. **`packages/agent-ui/a2ui/src/agent/prompts/mini-skills/game-table-chrome.md` and `game-hud.md` — NO
   change.** Both idioms stay prose (§1); both files are untouched.
3. **`site/pages/agent-admin-presets.ts`'s inline croupier `skills` array (the `card-layout` entry, lines
   ~119–125) — retires/trims in lockstep with (1), but this is PAGE-LOCAL data, NOT covered by
   `prompt-equivalence.baseline.json`** (it lives outside `agent/prompts/`, feeds the admin UI's pre-seeded
   Entry list, never the produce-time `MINI_SKILLS` intent-matched injection). ADR-0172's own Context
   already names this exact duplication risk ("mini-skills... already teach the exact GH #421 casino
   example... almost verbatim") — (1) and (3) currently carry NEAR-IDENTICAL glyph-formatting prose,
   authored independently; trimming one without the other leaves them silently out of sync. Both must be
   edited in the SAME change, but only (1) needs the formal recapture flow — (3) is an ordinary page edit.
4. **`site/pages/agent-admin-libraries.ts`'s `HOSPITALITY_SKILLS['hotel-booking-form']` and
   `HOSPITALITY_PLAYBOOKS['booking-flow']` entries — retire/trim once `BookingForm`/`BookingConfirmation`
   ship, NOT byte-pinned.** Neither entry has a `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/*.md`
   counterpart today (confirmed: the 9 shipped mini-skill files are `form-rhythm`, `dashboard-kpi-grid`,
   `card-layout`, `game-table-chrome`, `card-game-sheet`, `login-form`, `settings-screen`,
   `master-detail-split`, `game-hud` — no hospitality-domain file exists in that registry at all) — this
   content is page-local only, so `prompt-equivalence.baseline.json` never covered it and no recapture flow
   applies; it is still a real prose change worth flagging loudly (both feed the concierge's default seeded
   Skills/Workflows and the admin's "add from library" picker) — just not a formally-gated one. `restaurant`'s
   own `menu-card`/`hotel-booking-form` seed selection (`agent-admin-presets.ts:276`) and `travel`'s
   `itinerary-timeline`/`gallery-swiper` selection (`:314`) are OUT OF SCOPE (neither `restaurant` nor
   `travel` is one of GH #497's two demonstrating personas) — noted so a future reader does not assume this
   note rules on them too.

**Net:** one byte-pinned file needs a partial, deliberately-recaptured trim (`card-layout.md`); one page-local
seed array needs a matching partial trim in the same change (croupier's inline `skills`); two page-local
seed-library entries retire for concierge (`hotel-booking-form`, `booking-flow`) with no formal gate but a
real content change. `game-table-chrome.md`/`game-hud.md` and every other concierge/croupier prose surface
is untouched.

## 4 · Rubric-fit anticipation (GH #493's known gap)

`a2ui-catalog.md` v0.1's D3/D4 anchors assume a factory binds ONE existing DOM element (`create()` returns a
single node); every composite factory this note proposes (`create()` assembling a multi-element subtree)
is a shape the rubric's anchors don't explicitly examine — the SAME "fit gap" GH #493 already names for
PR #492's `compose.ts`-class artifacts. D1/D2 (name conformance, load/payload conformance) are unaffected —
both are mechanical gates over the `catalog.json` PropDef shape, indifferent to what the factory's `create()`
does internally. D3 (factory presence) still applies cleanly (`FACTORY_MISSING` fires the same way regardless
of composite vs. single-element `create()`). D4/D5/D6 (mapping fidelity, PropDef typing, example/doc coverage)
are the dimensions most likely to need a reviewer judgment call an anchor doesn't cover verbatim (e.g. "does
`BookingConfirmation.rows[].path` count as a `bindable`-equivalent claim even though the PropDef's own
`bindable` flag sits on the array, not the nested pointer?"). GH #493 is already sequenced "before the next
M-D slice's review" — this note does not fix the rubric, only names the two rows (`BookingForm`/
`BookingConfirmation`/`PlayingCard`) most likely to surface the gap in practice, so the build dispatch and
its reviewer aren't discovering it cold.

## Open questions / forks for a human

1. **`fields[]`/`rows[]` nested-`path` resolution mechanism (§2.1's Open build question).** Genuinely
   undecided — needs an LLD-level spike, not a guess in this note.
2. **`targetCatalogs` scope for both fragments (§2.2's flag).** Recommending both bases per SPEC-N5's
   default, but unverified against `a2ui-basic`'s own dialect; the build slice should prove it with a
   fixture rather than trust this note's recommendation blindly.
3. **Whether `BookingForm`/`BookingConfirmation` should be ONE dual-mode component or two** — this note
   rules two (cleaner PropDef-to-control correspondence, matches the rubric's own "one type → one factory"
   framing more literally than a `mode` discriminator would); flagged in case a build LLD finds a reason to
   prefer one.
4. **No missing baseline docs found** — the "prompt-equivalence"/"byte-pinned" grep in §3 successfully
   located the rule (`prompt-equivalence.baseline.json`, ADR-0135 cl.15, `a2ui-prompt-author` SKILL.md); no
   open item there.
