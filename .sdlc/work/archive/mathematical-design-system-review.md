# Review request: mathematical-design-system, findings from the agent-ui adoption

To: the peer repo that owns `~/.claude/skills/mathematical-design-system` (SKILL.md, scale.mjs, tokens.css).
From: agent-ui (ADR-0245, accepted 2026-10-13; the cut landed as PR #1932; follow-ups in flight as T-0119 and T-0120).
Ask: review each proposal, accept or reject it, and implement the accepted ones in the skill. agent-ui will re-vendor `scale.mjs` and `tokens.css` afterwards (T-0120 adopts the updated skill; it already tracks the density axis and the control rule you published).

Evidence is from agent-ui's own migration: 10 file-disjoint lanes, 33 files of deferred cut work, 99 stale pins, and the defects below. Numbers come from `resolve()` and `check()` of the current `scale.mjs` (check() returns `[]`). Nothing here is an agent-ui-only preference unless it says so.

## Summary

| # | Proposal | Kind | Evidence | Urgency |
|---|---|---|---|---|
| P1 | Add contract M11: no derived px quantity shrinks as n grows | contract | radio dot regresses at n 9 and 13 | high |
| P2 | Radio dot becomes `glyph − 2` | formula | follows from P1 | high |
| P3 | Rename the kicker roles: section label, group label | naming | a real bug came from the name | high |
| P4 | State that the size axis applies only to elements that carry a size | rule | badge resized by a stray `size` | high |
| P5 | Derive the common exceptions so adopters stop hand-setting them: pill, avatar, gauge ring, swatch, canvas gutters, chart caps | formulas | 6 hand-set values in agent-ui | medium |
| P6 | Add a tier guideline for agent-generated and embedded cards: widget tier | rule | A2UI canvas decision | medium |
| P7 | Add an optional space ladder section | new section | alias ratios are irregular | medium |
| P8 | Reaffirm "no XL" and state the forcing function | rule wording | design intent | low |
| P9 | Record that controls, content and type use separate scaling laws, and that the half-pixel group label is intentional | notes | design intent | low |
| P10 | Implementation notes for token consumers (calc tokens read as NaN, self-referential var cycles) | guidance | 3 production bugs | medium |
| P11 | Confirm the tier anchor move was deliberate, and tell adopters what the old rungs map to | confirmation | root shrinks one step | high |
| P13 | Pill radius for every single-line control and chip; concentric panels | formula | agent-ui ADR-0245 Amendment 5 | medium |
| P14 | Icon versus glyph sizing; square entry cells and the segmented track | contract | agent-ui ADR-0245 Amendment 6 | medium |

## P1 and P2: M11 and the radio dot

`c = ⌈n/4⌉` is a staircase, so every quantity that subtracts a multiple of c can move backwards when c steps up.

| n | c | glyph 2n−2c | radio dot 2n−4c | group margin n+c | table row 4n+2c |
|---|---|---|---|---|---|
| 7 | 2 | 10 | 6 | 9 | 32 |
| 8 | 2 | 12 | 8 | 10 | 36 |
| 9 | 3 | 12 (stalls) | 6 (−2) | 12 (+2) | 42 (+6) |
| 10 | 3 | 14 | 8 | 13 | 46 |
| 12 | 3 | 18 | 12 | 15 | 54 |
| 13 | 4 | 18 (stalls) | 10 (−2) | 17 (+2) | 60 (+6) |

At n 8 to 9 (product tier, scale sm lg to scale md md) a control gets 4px taller while its radio dot gets 2px smaller. Today `check()` cannot see this.

Proposed text for section 6, after M10:

> M11: no derived px quantity decreases as n increases, for every quantity in sections 2 to 4 (a stall is allowed, a decrease is not).

Proposed formula change in section 2:

> **Radio**: a 2n circle with a dot of `glyph − 2` (2n − 2c − 2).

At n 7 the dot is 8 (was 6). It stalls with the glyph at n 8 to 9 and never regresses. A test would iterate n = 5..24 over every quantity in `resolve()`.

## P3: the kicker roles

The skill defines "section kicker" as "eyebrow above a heading" at `round(body · 9/8)`. Two problems.
1. In agent-ui the small uppercase labels over a group of items (navigation group headings such as FEED & STATUS) used the old kicker typescale. The generated bridge mapped them to the section-kicker role and they grew about 4px (11 to 15 at md). The name invited the mapping.
2. Kim's ruling: "eyebrow is incorrect in this context. This is a sub-heading that is neither a heading nor an eyebrow. It is a section-group heading of sorts."

Proposal: drop "kicker" from role names.

| today | proposed | formula | use |
|---|---|---|---|
| section kicker | section label | round(body · 9/8), weight 500 | label above a group of sections |
| group kicker | group label | n/2 + 6.5, weight 400 | label over a group of items, table header |

Keep the uppercase and 0.08em tracking rules as they are, attached to both labels. M4 becomes "body ≤ title ≤ section label". agent-ui keeps `ui-text[variant=kicker]` as an alias that reads the group label.

## P4: the size axis only applies where there is a size

agent-ui's generated tokens step n on `[size='lg']` for any element. A stray `size="lg"` on `ui-badge` made it 16px instead of 14, because the badge has no size axis and sits at its context n.

Proposed sentence for section 1:

> `data-size` and the reflected `size` attribute apply only to elements that define a size axis. Badge, avatar and other atoms with a fixed rule sit at their context n and ignore it.

## P5: derive the exceptions instead of leaving them hand-set

agent-ui had six values with no formula. Each can be derived.

| exception | today | proposed rule | value at n = 7 | notes |
|---|---|---|---|---|
| pill radius | h/2 | radius `2n` (h = 4n, so 2n = h/2) | 14 | same pixels as today; no exception remains |
| avatar | skill says `2n`; agent-ui used 24 / 28 / 36 | 4n circle (control height); 2n for inline avatars inside tags and rows | 28 | the skill's 2n shrinks avatars 12 px |
| gauge ring stroke | 8px | `4c` | 8 (12 at n 9 to 12) | stays density-invariant |
| swatch | 2rem | 4n square, radius n (icon tile) | 28 | |
| canvas padding and gap | 16 / 12 | card level: margin 3n, gutter 2n | 21 / 14 | |
| chart segment radius | 12 | group radius n + c | 9 | |

## P6: tier guideline for agent-generated and embedded cards

Kim's ruling (2026-10-13): the A2UI canvas uses `data-tier="widget"` at `data-scale="md"`, giving 24 / 28 / 32, the same n as the page root. Region comparison:

| region | sm / md / lg | body / control | card margin / gutter |
|---|---|---|---|
| product / sm (the page root) | 24 / 28 / 32 | 14 / 13 | 21 / 14 |
| product / md | 28 / 36 / 44 | 16 / 15 | 27 / 18 |
| widget / md | 24 / 28 / 32 | 14 / 13 | 21 / 14 |
| widget / lg | 28 / 32 / 36 | 15 / 14 | 24 / 16 |
| old agent-ui ramp | 24 / 28 / 36 | | |

No region reproduces 24 / 28 / 36, because the step between sizes within a region is constant. Proposal for section 5: add a rule "Agent-generated cards and other embedded compact UI use `data-tier="widget"`, not product". Note for P8: widget at md equals product at sm for controls (both n 6 / 7 / 8) and differs only in how a scale step moves.

## P7: an optional space ladder

Layout gaps need a ladder. agent-ui used c, n, n+c, 2n, 3n, 4n. The ratios between steps are irregular.

| n | xs | sm | md | lg | xl | 2xl | step ratios |
|---|---|---|---|---|---|---|---|
| 6 | 2 | 6 | 8 | 12 | 18 | 24 | 3.00, 1.33, 1.50, 1.50, 1.33 |
| 7 | 2 | 7 | 9 | 14 | 21 | 28 | 3.50, 1.29, 1.56, 1.50, 1.33 |
| 8 | 2 | 8 | 10 | 16 | 24 | 32 | 4.00, 1.25, 1.60, 1.50, 1.33 |
| 9 | 3 | 9 | 12 | 18 | 27 | 36 | 3.00, 1.33, 1.50, 1.50, 1.33 |

The xs step is 3 to 4 times the next, and sm to md barely moves. Candidates, for review (no recommendation is a formula yet):
- xs = ⌈n/2⌉ gives 1.75, 1.29, 1.56, 1.50, 1.33 at n 7.
- Drop md (n + c) from the ladder, since it is already the group margin.
- Keep the ladder and document the irregularity.

## P8 and P9: intent statements to record

- P8: "There is no XL" is a deliberate forcing function. A section that needs a huge call to action is probably not product UI, so its tier should change on a parent container (for example `data-tier="brand"`), not by inventing a size.
- P9: control size, content size and type are different quantities with different scaling laws, so they should not scale linearly with each other (Kim: "this is fine"). The half-pixel group label size (9.5 at n 6) is accepted.

## P10: implementation notes for token consumers

Three production bugs in agent-ui came from how tokens are consumed, not from the formulas. Worth a short "Consuming tokens" section.
1. A token defined as `calc(...)` is an unregistered custom property. JavaScript that reads it with `getComputedStyle().getPropertyValue()` and `parseFloat` gets NaN (tabs overflow measurement broke). Either register the token with `@property` (syntax `<length>`), or measure a probe element.
2. A radius rule that hands a container's radius down to its children made a self-referential `var()` cycle in WebKit but not Chromium. Avoid inherited radius chains; derive each container's radius from its own level.
3. A generator that maps typescale rows to roles by name needs a test that every role renders within 1px of the intended px; the kicker bug passed every unit test because the tests pinned the generated value.

## P11: the tier anchors moved

The updated `scale.mjs` changed the anchors: widget n0 7 to 6, product 9 to 8, content 11 to 10, and the ladder floor n 5 to 4. Same names, smaller controls.

| region | before: sm / md / lg | after: sm / md / lg |
|---|---|---|
| product / sm (agent-ui page root) | 24 / 28 / 32 | 20 / 24 / 28 |
| product / md | 28 / 36 / 44 | 24 / 32 / 40 |
| widget / md | 24 / 28 / 32 | 20 / 24 / 28 |
| widget / lg | 28 / 32 / 36 | 24 / 28 / 32 |
| content / sm | 32 / 36 / 40 | 28 / 32 / 36 |

Kim 2026-10-13 ruled that agent-ui takes the new constants byte for byte and accepts the one-step shrink of every control (page root 20 / 24 / 28). Asks for the skill owner:
1. Confirm the move was deliberate and say why (denser default, a smaller minimum), so adopters can explain the visible change.
2. Add a one-line migration note to SKILL.md: "anchors moved one step in this revision; a region that was at rung X is now at rung X + one scale step."
3. The new skill floors linear type at 9px (`max(9px, ...)`). A consumer's generator needs the same floor or its type disagrees at the widget sm/sm rung (field label 8 vs 9, group label 8.5 vs 9). State the floor in section 4's prose, not only in code.

## P12: control font against icon box at the new anchors (added 2026-10-13, after adopting sha 3c319761)

With the anchors one step down, agent-ui's page root is n 5 / 6 / 7. Control type is n + 6 and the icon box is 2n, so:

| n | control type n + 6 | icon box 2n | relation |
|---|---|---|---|
| 5 | 11 | 10 | type larger than icon |
| 6 | 12 | 12 | tie |
| 7 | 13 | 14 | icon larger |

agent-ui had a test law "control font < icon box", which held only from n 7 up. It is relaxed to "not larger" at n 6 and fails outright at n 5. Ask: state the intended relation between control type and icon box in the contracts, and either accept that it inverts below n 6 or floor the icon box.

## P13: pill radius for single-line controls and chips (added 2026-10-13, agent-ui ADR-0245 Amendment 5)

After dogfooding, agent-ui ruled "everything pill": every single-line control and every chip takes radius h/2, as the skill already does for the button. At the n 6 root the skill's `control.radius` n (6 on a 24px field) and `checkboxRadius` ceil(n/2) for the badge (3 on a 16px chip) read too sharp next to a pill button.

| element | skill today | agent-ui now | root sm · md · lg |
|---|---|---|---|
| field, select trigger, combo-box, otp cell, menu and listbox rows | n | h/2 = 2n | 10 · 12 · 14 |
| textarea (multi-line) | n | 2n, the single-line control radius | 10 · 12 · 14 |
| menu, listbox and select panels | group radius n + c | row radius + panel inset c = 2n + c | 12 · 14 · 16 |
| badge / tag chip (2n + 2c tall) | ceil(n/2) | h/2 = n + c | 7 · 8 · 9 |
| checkbox | ceil(n/2) | ceil(n/2), unchanged | 3 · 3 · 4 |

Two companion rules came with it: a pill takes circular corners, not the squircle (a squircle at h/2 reads as a soft rectangle), and a container around pill rows takes the concentric radius (row radius plus its own inset), not the level radius.

Ask: add `pill = h/2` to `control` (and `chip.radius = n + c`) in `scale.mjs` with a contract that every single-line control and chip uses it, keep `checkboxRadius` separate, and state the concentric panel radius and the round-not-squircle rule in SKILL.md. agent-ui emits these today as derived exceptions beside the vendored copy (`--md-sys-control-radius`, `--md-sys-chip-radius`, `--md-sys-checkbox-radius`).

## P14: icon versus glyph sizing, square entry cells and the segmented track (added 2026-10-13, agent-ui ADR-0245 Amendment 6)

The T-0137 dogfood review found two things the skill's contract leaves open. First, `icon = 2n` is declared once for the whole page, so a standalone icon beside a 1.5rem heading or a 1.25rem file row still rendered at the 12px icon box, smaller than its own text. Second, the P13 pill turned square entry cells into circles and left the segmented control as the one rounded rectangle in a row of pills.

agent-ui's rulings:

| element | skill today | agent-ui now | root sm · md · lg |
|---|---|---|---|
| glyph (plus, minus, carets, ticks, stat and board marks) | 2n − 2c inside a 2n slot | 2n − 2c everywhere, n clear of a label | 6 · 8 · 10 |
| icon in a control cell | 2n | 2n, unchanged | 10 · 12 · 14 |
| standalone icon, no tier region | 2n | 1em, the surrounding text | the text size |
| standalone icon in a `[data-tier]` region | 2n | 2n, unchanged | that region's 2n |
| OTP cell (square, 4n) | n, then h/2 under P13 | n, a round square with the squircle | 5 · 6 · 7 |
| segmented track (4n segment plus c padding) | group radius n + c | h/2 = 2n + c, thumb 2n | 12 · 14 · 16, thumb 10 · 12 · 14 |

Ask: state in SKILL.md that an icon is a box only inside a control cell (a slot) and otherwise follows the text, while a glyph keeps its box everywhere; add a "square entry cell" row to `control` (radius n, never h/2: a square at h/2 is a circle); and add the segmented track to the P13 pill family as `h/2` of its padded height with a concentric thumb. Open: at the n 5 root the 6px glyph box makes `dot`, `more` and `info` hard to read; either floor the glyph box or rule that those marks never ship at size sm.

## P15: floor the glyph box at 8px (added 2026-10-13, agent-ui ADR-0245 Amendment 7)

This closes P14's open item. At the n 5 root `2n - 2c` is 6px, and `dot`, `more` and `info` read as a faint dash, a speck and a blob. agent-ui floors the glyph box rather than banning those marks at size sm, so one rule holds everywhere.

| element | skill today | agent-ui now | root sm · md · lg |
|---|---|---|---|
| glyph box (every functional mark, the checkbox check) | 2n - 2c | max(8, 2n - 2c) | 6 → 8 · 8 · 10 |
| glyph inset in its 2n slot | c | (2n - glyph box) / 2 | 2 → 1 · 2 · 2 |
| radio dot, switch thumb, slider thumb | their own rules | unchanged | unchanged |

The floor binds at n 5 and below only, so md and lg are unchanged and M14 (no n-only size shrinks as n grows) still holds. agent-ui keeps its vendored `scale.mjs` byte for byte (sha `3c319761…`) and carries the floor locally: the generator emits `max(8px, 2n - 2c)` and a `glyphBox(r)` helper beside it mirrors it for the lint and tests. Adopting the ask below would let agent-ui drop the local helper.

Ask: add `glyphFloor` to CFG beside the type `floor`, use it in `at()`, and state in SKILL.md that a glyph never renders below 8px; keep the radio dot on the unfloored `2n - 2c - 2`.

## P16: a 3:1 field-boundary outline role (added 2026-10-13, agent-ui ADR-0245 Amendment 7)

The skill's tokens give an entry field a border but no contrast rule for it. In agent-ui the outline role is a translucent scrim (neutral at 60%) that composites to about 1.7 to 2.5:1 against the page, so a stack of fields read as faint stripes in dark and as soft buttons in light. SC 1.4.11 asks 3:1 for the boundary that identifies a control.

| element | skill today | agent-ui now |
|---|---|---|
| field resting border (text field, select, combo box, OTP cell, textarea) | no contrast rule | an opaque field-outline role at least 3:1 against every surface plane in both themes (neutral 550 light, 500 dark) |
| focus | ring | ring, border transparent, unchanged |
| disabled | no rule | no border, unchanged |

Ask: add a field-outline role to the skill's colour section with the 3:1 contract against every page plane in both schemes, opaque (an alpha outline cannot meet it on every plane), and use it for every entry control's resting border; panels and listboxes keep the softer outline.

## Related decision for agent-ui (not a skill change)

The skill now has `data-density` (container spacing only). agent-ui's ADR-0245 had retired `[density]` into `data-scale`; T-0120 amends that to map `[density]` to `data-density`. The skill's new control rule (box padding n plus label inset n − c) is not yet adopted by agent-ui. It would move every control's text edge from n to 2n − c (7 to 12 at n 7). That is a separate agent-ui decision.

## What agent-ui needs back

- A decision on each of P1 to P16.
- If P3 is accepted, the final names, so agent-ui's generated tokens and docs use the same words.
- If P7 is accepted, the formula.
- The updated `scale.mjs` and `tokens.css`, with `check()` returning `[]`.
