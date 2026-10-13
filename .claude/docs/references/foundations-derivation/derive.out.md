## 1. check()
```
check() = []
```
## 2. Reachable heights per tier (all 9 scale x size cells)
- widget: 20 / 24 / 28 / 32 / 36
- product: 24 / 28 / 32 / 36 / 44 / 56
- content: 32 / 36 / 40 / 44 / 52 / 64
- brand: 44 / 48 / 52 / 56 / 64 / 76
## 3. Root candidates against today's 24 / 28 / 36
- product/sm: 24 / 28 / 32 · per step 0 / 0 / -4 · total |delta| 4px
- widget/md: 24 / 28 / 32 · per step 0 / 0 / -4 · total |delta| 4px
- product/md: 28 / 36 / 44 · per step +4 / +8 / +8 · total |delta| 20px
- widget/lg: 28 / 32 / 36 · per step +4 / +4 / 0 · total |delta| 8px
## 4. Today's [scale] names mapped to tier/scale
| today | heights sm/md/lg | body-medium | proposed | heights sm/md/lg | body at md |
|---|---|---|---|---|---|
| `ui-sm` | 20/24/28 | 12.25 | `widget/sm` | 20/24/28 (0/0/0) | 13 |
| `ui-md` | 24/28/36 | 14 | `product/sm` | 24/28/32 (0/0/-4) | 14 |
| `ui-lg` | 28/36/48 | 15.75 | `product/md` | 28/36/44 (0/0/-4) | 16 |
| `content-sm` | 24/28/36 | 19.25 | `content/sm` | 32/36/40 (+8/+8/+4) | 16 |
| `content-md` | 28/36/48 | 21 | `content/md` | 36/44/52 (+8/+8/+4) | 18 |
| `content-lg` | 36/48/64 | 24.5 | `content/lg` | 40/52/64 (+4/+4/0) | 20 |
## 5. Controls at the root product/sm (size sm / md / lg = n 6 / 7 / 8)
| quantity | rule | today → derived (delta), sm · md · lg |
|---|---|---|
| height | 4n | 24 → 24 (0) · 28 → 28 (0) · 36 → 32 (-4) |
| icon box | 2n | 16 → 12 (-4) · 18 → 14 (-4) · 20 → 16 (-4) |
| glyph box (caret today = font) | 2n - 2c | 13 → 8 (-5) · 14 → 10 (-4) · 16 → 12 (-4) |
| control type | n + 6 | 13 → 12 (-1) · 14 → 13 (-1) · 16 → 14 (-2) |
| control gap (font/2 today) | n | 6.5 → 6 (-0.5) · 7 → 7 (0) · 8 → 8 (0) |
| button label padding (h/2 today) | 2n | 12 → 12 (0) · 14 → 14 (0) · 18 → 16 (-2) |
| button icon-side padding ((h - icon)/2 today) | n | 4 → 6 (+2) · 5 → 7 (+2) · 8 → 8 (0) |
| input inline padding (h/2 today) | n | 12 → 6 (-6) · 14 → 7 (-7) · 18 → 8 (-10) |
| button / toggle radius (the pill, kept at step 0) | h/2 = 2n | 12 → 12 (0) · 14 → 14 (0) · 18 → 16 (-2) |
| field radius (corner-base today) | n | 12 → 6 (-6) · 12 → 7 (-5) · 12 → 8 (-4) |
| checkbox / radio / switch / slider box (compact today) | 2n | 14 → 12 (-2) · 16 → 14 (-2) · 18 → 16 (-2) |
| checkbox radius (box/5 today) | n/2 | 2.8 → 3 (+0.2) · 3.2 → 3.5 (+0.3) · 3.6 → 4 (+0.4) |
| checkbox check (0.6 box today) | 2n - 2c | 8.4 → 8 (-0.4) · 9.6 → 10 (+0.4) · 10.8 → 12 (+1.2) |
| radio dot (0.56 box today) | 2n - 4c | 7.84 → 4 (-3.84) · 8.96 → 6 (-2.96) · 10.08 → 8 (-2.08) |
| switch thumb (box - 4 today) | 2n - 2c | 10 → 8 (-2) · 12 → 10 (-2) · 14 → 12 (-2) |
| switch track width (1.8 box today) | 2 thumb + 2c | 25.2 → 20 (-5.2) · 28.8 → 24 (-4.8) · 32.4 → 28 (-4.4) |
| switch track padding (widget-inset today) | c | 2 → 2 (0) · 2 → 2 (0) · 2 → 2 (0) |
| field label gap (space-xs today) | ceil(n/2) | 4 → 3 (-1) · 4 → 4 (0) · 4 → 4 (0) |
| avatar, the skill's 2n (not adopted) | 2n | 24 → 12 (-12) · 28 → 14 (-14) · 36 → 16 (-20) |
| avatar, 4n (ruled at step 0) | 4n | 24 → 24 (0) · 28 → 28 (0) · 36 → 32 (-4) |
| menu item row (font + 8 today) | 4n | 22 → 24 (+2) · 22 → 28 (+6) · 22 → 32 (+10) |
| table row (about 28 + 1px today) | 4n + 2c | 29 → 28 (-1) · 29 → 32 (+3) · 29 → 36 (+7) |
| table text cell inline padding (space-sm today) | n + c | 8 → 8 (0) · 8 → 9 (+1) · 8 → 10 (+2) |
| segmented-control padding (0 today) | c | 0 → 2 (+2) · 0 → 2 (+2) · 0 → 2 (+2) |
| segment inline padding (h/2 today) | 2n | 14 → 12 (-2) · 14 → 14 (0) · 14 → 16 (+2) |
| progress track (4 today) | 2c | 4 → 4 (0) · 4 → 4 (0) · 4 → 4 (0) |
| tabs tab height (height-lg today) | 4n | 36 → 24 (-12) · 36 → 28 (-8) · 36 → 32 (-4) |
### Badge (no size axis; sits at its context n, md)
- height: 18 → 14 (-4), rule 2n
- inline padding: 8.75 → 4 (-4.75), rule 2c
- radius: 9 → 3.5 (-5.5), rule n/2
- type: 13 → 11 (-2), rule field label n + 4
## 6. Containers at the root md (n 7, c 2)
| quantity | rule | today → derived (delta) |
|---|---|---|
| card / modal text inset, inline (region margin 6 + pad 12) | card margin 3n | 18 → 21 (+3) |
| card / modal text inset, block (6 + 6) | card margin 3n | 12 → 21 (+9) |
| card region gap (6) | card gutter 2n | 6 → 14 (+8) |
| card content child rhythm (`--ui-box-gap` 8) | card gutter 2n | 8 → 14 (+6) |
| card / modal radius (corner-base 12) | card radius 3n | 12 → 21 (+9) |
| popover padding (space-md 12) | widget margin 2n | 12 → 14 (+2) |
| popover radius (12) | widget radius 2n | 12 → 14 (+2) |
| toast padding inline (12) | widget margin 2n | 12 → 14 (+2) |
| toast padding block (8) | widget margin 2n | 8 → 14 (+6) |
| toast gap (8) | widget gutter n | 8 → 7 (-1) |
| tooltip padding (space-sm 8) | group margin n + c | 8 → 9 (+1) |
| tooltip radius (12) | group radius n + c | 12 → 9 (-3) |
| listbox padding (menu 6, select h/4 7) | c | 7 → 2 (-5) |
| listbox panel radius (12) | group radius n + c | 12 → 9 (-3) |
| listbox option radius (select 12 - h/4 = 5) | n | 5 → 7 (+2) |
| bar inline inset (`--ui-bar-inline-inset` 24) | layout margin 4n | 24 → 28 (+4) |
## 7. The --md-sys-space ladder as an alias layer at n 7
| step | rule | today → derived (delta) |
|---|---|---|
| `xs` | c | 4 → 2 (-2) |
| `sm` | n | 8 → 7 (-1) |
| `md` | n + c | 12 → 9 (-3) |
| `lg` | 2n | 16 → 14 (-2) |
| `xl` | 3n | 24 → 21 (-3) |
| `2xl` | 4n | 32 → 28 (-4) |
## 8. ui-text: variant x size, today (ADR-0078 cl.2/cl.2b at scale 1) → derived at n 6 / 7 / 8
| variant | skill role | today → derived (delta), sm · md · lg |
|---|---|---|
| `display` | display | 36 → 27 (-9) · 45 → 32 (-13) · 57 → 36 (-21) |
| `headline` | heading | 24 → 21 (-3) · 28 → 24 (-4) · 32 → 27 (-5) |
| `title` | title | 14 → 13 (-1) · 16 → 15 (-1) · 22 → 17 (-5) |
| `body` | body | 12 → 13 (+1) · 14 → 14 (0) · 16 → 15 (-1) |
| `label` | field label | 11 → 10 (-1) · 12 → 11 (-1) · 14 → 12 (-2) |
| `kicker` | section kicker | 11 → 15 (+4) · 12 → 16 (+4) · 14 → 17 (+3) |
| `overline` | group kicker | 11 → 9.5 (-1.5) · 12 → 10 (-2) · 14 → 10.5 (-3.5) |
| `lead` | subhead | 16 → 17 (+1) · 18 → 18 (0) · 22 → 20 (-2) |
| `quote` | subhead | 16 → 17 (+1) · 18 → 18 (0) · 22 → 20 (-2) |
### Display and heading where rule 4 puts them (a region with its own tier, size md)
- content/md/md (n 11): display 53, heading 37, subhead 26, body 18
- brand/md/md (n 14): display 75, heading 49, subhead 32, body 21
## 9. Rejected root product/md (the skill default), same quantities at md
- height: 28 → 36 (+8)
- icon box: 18 → 18 (0)
- glyph box: 14 → 12 (-2)
- control type: 14 → 15 (+1)
- body: 14 → 16 (+2)
- button radius (pill): 14 → 18 (+4)
- card margin: 18 → 27 (+9)
- card radius: 12 → 27 (+15)
## 9b. The A2UI canvas register product/md (ruled at step 0), size sm / md / lg
- height: 28 / 36 / 44
- icon box: 14 / 18 / 22
- glyph box: 10 / 12 / 16
- control type: 13 / 15 / 17
- button radius (pill): 14 / 18 / 22
## 10. Check values (SKILL.md section 9) recomputed
- product md/md: n 9, h 36, c 3, glyph 12; type {"display":42,"heading":30,"subhead":22,"sectionKicker":18,"title":17,"body":16,"control":15,"fieldLabel":13,"groupKicker":11}; card 27/18/27
- widget md/sm: n 6, h 24, c 2, glyph 8; body 13, control 12, field label 10, group kicker 9.5
- brand lg/lg: n 19, h 76, c 5; display 125, heading 74, subhead 44, body 26
## 11. Amendment 3: check() on the v2 constants
```
check() = []
```
Tiers (n0 a k g): widget 6/1/1/0 · product 8/2/2/1 · content 10/2/2/1 · brand 14/2/2/1; ladder 4 to 24; density {"compact":-1,"default":0,"spacious":1}; linear type floor 9px.
## 12. Reachable heights per tier on v2 (all 9 scale x size cells)
- widget: 16 / 20 / 24 / 28 / 32
- product: 20 / 24 / 28 / 32 / 40 / 52
- content: 28 / 32 / 36 / 40 / 48 / 60
- brand: 44 / 48 / 52 / 56 / 64 / 76
Registers, sm / md / lg heights, v1 → v2:
- product/sm: 24 / 28 / 32 → 20 / 24 / 28
- product/md: 28 / 36 / 44 → 24 / 32 / 40
- widget/md: 24 / 28 / 32 → 20 / 24 / 28
- widget/lg: 28 / 32 / 36 → 24 / 28 / 32
- content/sm: 32 / 36 / 40 → 28 / 32 / 36
## 13. Controls at the root product/sm, v1 (n 6 / 7 / 8) → v2 (n 5 / 6 / 7), size sm · md · lg
| quantity | rule v1 → v2 | v1 → v2 (delta), sm · md · lg |
|---|---|---|
| height, avatar, swatch tile (4n) | 4n | 24 → 20 (-4) · 28 → 24 (-4) · 32 → 28 (-4) |
| inset, gap, field radius (n) | n | 6 → 5 (-1) · 7 → 6 (-1) · 8 → 7 (-1) |
| c | ceil(n/4) | 2 → 2 (0) · 2 → 2 (0) · 2 → 2 (0) |
| icon box, indicator box, badge height (2n) | 2n | 12 → 10 (-2) · 14 → 12 (-2) · 16 → 14 (-2) |
| glyph box, checkbox check, switch thumb | 2n - 2c | 8 → 6 (-2) · 10 → 8 (-2) · 12 → 10 (-2) |
| button / toggle pill radius | h/2 → 2n | 12 → 10 (-2) · 14 → 12 (-2) · 16 → 14 (-2) |
| button label padding | 2n | 12 → 10 (-2) · 14 → 12 (-2) · 16 → 14 (-2) |
| checkbox radius | n/2 | 3 → 2.5 (-0.5) · 3.5 → 3 (-0.5) · 4 → 3.5 (-0.5) |
| switch track width | 2 thumb + 2c | 20 → 16 (-4) · 24 → 20 (-4) · 28 → 24 (-4) |
| field label gap | ceil(n/2) | 3 → 3 (0) · 4 → 3 (-1) · 4 → 4 (0) |
| table row | 4n + 2c | 28 → 24 (-4) · 32 → 28 (-4) · 36 → 32 (-4) |
| table text cell padding, tooltip padding (group margin) | n + c | 8 → 7 (-1) · 9 → 8 (-1) · 10 → 9 (-1) |
| glyph stroke | max(1.5, c/2) | 1.5 → 1.5 (0) · 1.5 → 1.5 (0) · 1.5 → 1.5 (0) |
| control type | n + 6 | 12 → 11 (-1) · 13 → 12 (-1) · 14 → 13 (-1) |
| body | n + 7 | 13 → 12 (-1) · 14 → 13 (-1) · 15 → 14 (-1) |
| title | body + 0/1/2 | 13 → 12 (-1) · 15 → 14 (-1) · 17 → 16 (-1) |
| field label (`label`) | n + 4 | 10 → 9 (-1) · 11 → 10 (-1) · 12 → 11 (-1) |
| group label (`overline`, table header) | n/2 + 6.5 | 9.5 → 9 (-0.5) · 10 → 9.5 (-0.5) · 10.5 → 10 (-0.5) |
| section label | round(body · 9/8) | 15 → 14 (-1) · 16 → 15 (-1) · 17 → 16 (-1) |
| subhead (`lead`, `quote`) | round(body · Q) | 17 → 15 (-2) · 18 → 17 (-1) · 20 → 18 (-2) |
| heading (`headline`) | round(body · Q²) | 21 → 19 (-2) · 24 → 21 (-3) · 27 → 24 (-3) |
| display | round(body · Q³) | 27 → 23 (-4) · 32 → 27 (-5) · 36 → 32 (-4) |
| radio dot | 2n - 4c → glyph - 2 | 4 → 4 (0) · 6 → 6 (0) · 8 → 8 (0) |
| `kicker` variant | field label (Amendment 1) → group label | 10 → 9 (-1) · 11 → 9.5 (-1.5) · 12 → 10 (-2) |
## 14. Containers and the derived exceptions at the root md, v1 (n 7, c 2) → v2 (n 6, c 2, m 6)
| quantity | rule v1 → v2 | v1 → v2 (delta) |
|---|---|---|
| group margin | n + c | 9 → 8 (-1) |
| group gutter | c | 2 → 2 (0) |
| group radius | n + c | 9 → 8 (-1) |
| widget margin | 2n → 2m | 14 → 12 (-2) |
| widget gutter | n → m | 7 → 6 (-1) |
| widget radius | 2n → 2m | 14 → 12 (-2) |
| card margin | 3n → 3m | 21 → 18 (-3) |
| card gutter | 2n → 2m | 14 → 12 (-2) |
| card radius | 3n → 3m | 21 → 18 (-3) |
| layout margin | 4n → 4m | 28 → 24 (-4) |
| layout gutter | 3n → 3m | 21 → 18 (-3) |
| layout radius | 4n → 4m | 28 → 24 (-4) |
| `--md-sys-space-xs` | c | 2 → 2 (0) |
| `--md-sys-space-sm` | n | 7 → 6 (-1) |
| `--md-sys-space-md` | n + c | 9 → 8 (-1) |
| `--md-sys-space-lg` | 2n → 2m | 14 → 12 (-2) |
| `--md-sys-space-xl` | 3n → 3m | 21 → 18 (-3) |
| `--md-sys-space-2xl` | 4n → 4m | 28 → 24 (-4) |
| gauge ring stroke | 0.5rem → 4c | 8 → 8 (0) |
| swatch box | 2rem → 4n (radius n) | 32 → 24 (-8) |
| column-chart top segment radius | 0.75rem → n + c | 12 → 8 (-4) |
| A2UI artboard padding | space-lg (2n) → card margin 3m | 14 → 18 (+4) |
| A2UI artboard gap | space-md (n + c) → card gutter 2m | 9 → 12 (+3) |
- Before the cut the artboard read 16 / 12 (the legacy space-lg / space-md); M14 holds the gauge ring at 4c: 8 at n 5, 12 at n 9, 16 at n 13, 20 at n 17.
## 15. data-density at the root md (n 6): m, then card margin / gutter / radius and layout margin
| density | m | card | layout margin |
|---|---|---|---|
| compact | 5 | 15 / 10 / 15 | 20 |
| default | 6 | 18 / 12 / 18 | 24 |
| spacious | 8 | 24 / 16 / 24 | 32 |
- The floor binds at product sm/sm compact: n 5, m 4 (n - a = 3), widget 8 / 4 / 8, group 7 / 2 / 7.
- `[density]` (retired) maps onto `data-density` in the bridge, so `[density="compact"]` moves m, never n.
## 16. The A2UI canvas register, sm / md / lg
- product/md on v2: height 24 / 32 / 40 · icon 12 / 16 / 20 · glyph 8 / 12 / 14 · control type 12 / 14 / 16 · pill radius 12 / 16 / 20
- widget/md on v2: height 20 / 24 / 28 · icon 10 / 12 / 14 · glyph 6 / 8 / 10 · control type 11 / 12 / 13 · pill radius 10 / 12 / 14
## 17. Not adopted from the skill v2: the control rule, and the sizes the fleet still holds at its own value
| quantity | fleet today → the skill v2 | today → skill (delta), sm · md · lg at the root |
|---|---|---|
| text edge of entry and trigger controls (text-field, select, combo-box, multi-select, otp-field, textarea), menu and listbox rows, tabs | n → 2n - c | 5 → 8 (+3) · 6 → 10 (+4) · 7 → 12 (+5) |
| text edge of button, toggle and segment labels | 2n → 2n - c | 10 → 8 (-2) · 12 → 10 (-2) · 14 → 12 (-2) |
| icon to label | n → gutter c + label margin n - c | 5 → 5 (0) · 6 → 6 (0) · 7 → 7 (0) |
| badge height | 2n → 2n + 2c | 10 → 14 (+4) · 12 → 16 (+4) · 14 → 18 (+4) |
| checkbox and badge radius | n/2 → ceil(n/2) | 2.5 → 3 (+0.5) · 3 → 3 (0) · 3.5 → 4 (+0.5) |
- The chip level (tag, badge, kbd: margin c, gutter c, radius ceil(n/2)) has no token yet: 2 / 2 / 3 · 2 / 2 / 3 · 2 / 2 / 4 at the root sm · md · lg. The reserved levels tray, lane and shell have none by design.
