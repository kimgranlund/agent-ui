---
id: T-0193
title: "OptionDeck: a general-purpose 'pick one to start' catalog pattern where each option is a selectable card"
type: feature         # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0172]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-14: "the game picker as a concept should become a new pattern catalog ... a nicer general purpose version ... a bit more creative where each game is presented as a card of some sort." Today the Croupier opens with a row of Buttons, which the model wraps one each in a bordered box. That is a ruled defect: buttons must not sit inside card containers. The new pattern makes the card itself the choice.

## The pattern (working name OptionDeck; name it in the design intake)
- **What it is:** a default-catalog composite for "pick one of a few things to start". Uses (widened 2026-10-14 by the pattern sweep: the default greeting for every preset via the greeting-card mini-skill, replacing T-0172's plain-button row): the game picker (Croupier, Quizmaster topics, Dungeon Master scenarios), concierge experiences (dine, spa, explore), a plan or template chooser, an onboarding path.
- **Each option is one card, and the whole card is the target.** It has:
  - a hero region: an icon from the pack, an emoji-free glyph or illustration slot, or an image;
  - a title;
  - one line of description;
  - up to three meta chips (for example players 1 to 6, 5 min, Easy).
- **No button inside a card.** Pressing a card fires one action with the option's `value`, so the component never contains Button children. A focus ring, a hover lift and a pressed state come from the fleet interaction states.
- **Variety without chaos:** each option may carry an accent from the color roles (one of a small set of named tones, never a raw color), so games read as distinct. The hero region can use a playful pattern, such as the playing-card back motif or a suit glyph for card games, drawn from tokens.
- **Optional "Surprise me" card:** a visually distinct last card (dashed edge or shuffle glyph) that fires the same action with `value: "random"`. Prop `allowRandom`.
- **Layout:**
  - a responsive grid from the geometry (min card width in n), single column at the 400px column, horizontal scroll never;
  - a card count of 2 to 8 (validator rejects more);
  - an optional heading and subheading above the deck.
- **Selected state:** after a pick, the deck collapses to the chosen card with a "changed your mind?" affordance, or stays with the chosen card marked. Decide which in intake.
- **A11y:**
  - a listbox or radiogroup-like role via ElementInternals;
  - arrow-key roving focus; Enter and Space select;
  - each card announces title, description and meta;
  - no native form elements.

## Intent
- Do:
  1. **Design intake** (skill `component-design`): run the precedent sweep against ChoiceCard and ChoiceGroup (value selection inside a form), ProductCard, ServiceCard and ResultCard (single cards with their own action). Say why this is a new composite and not a ChoiceGroup variant, or fold it into one if the sweep says so. Fill the fork sheet, and record decisions in this ticket (ADRs are retired).
  2. **Mockup first:** two or three directions (calm, playful, editorial) at widget / md on the A2UI canvas, light and dark, plus the 400px column. Kim approves one before any build.
  3. **Build:**
     - the `ui-*` control, with a descriptor `{name}.md` and generated props;
     - the default catalog row plus its `selection.json` intents and notFor (notFor: form fields, a single confirm button, more than 8 options);
     - a mini-skill teaching it;
     - a factory test, a browser test in both engines, a visual golden, and the dogfood render lint clean.
  4. **Adopt:**
     - the Croupier greeting uses it for the game picker, and the croupier skill and seeds teach it;
     - check the Quizmaster, Dungeon Master and Concierge for the same "pick one to start" moment and switch them where it fits;
     - bump the touched presets' seedVersion and refresh their manifests.
  5. **Lint:** the compose or render rule from T-0172 (a card whose only child is a Button) stays, and its message points at this pattern.
- Done when:
  - Kim has approved the mockup;
  - `npm run check` exits 0;
  - the control's and catalog's tests pass in Chromium and WebKit;
  - the render lint exits 0;
  - a live `npm run chat:probe -- --agent croupier --say hello --expect-component <Name>` passes on Haiku 5.5 and Sonnet 5.5;
  - screenshots are viewed and match the approved mockup.

## Context
- Geometry: ADR-0245 one-n foundations; the A2UI canvas sits at widget / md (20 / 24 / 28 controls). Standards: `.claude/docs/references/` (component-standards, geometry-sizing-spec), `component-design`, `component-build`, and `a2ui-multi-catalog` skills. Catalog content is hand-curated (`packages/agent-ui/a2ui/AGENTS.md`). Commit off origin/main, never push.

## Constraints
- Zero dependencies. Light DOM, ARIA via ElementInternals. Event `select` (or `action` through the catalog), per ADR-0153 names. No em dashes.
