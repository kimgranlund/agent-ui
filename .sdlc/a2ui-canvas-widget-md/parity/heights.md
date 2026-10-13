# T-0119 parity: the A2UI widgets before and after the widget / md canvas register

Before: `b8645a5b` (product / md, the cut's step-down stamps). After: `392f2ff4` (widget / md, stamps reverted).
Each widget renders through the real renderer from its seed at 400px and 1000px, light and dark:
`<widget>-<width>-<scheme>-<before|after>.png`. Heights below are the light 1000px pass (400px matches).

| widget | register | card radius | card inline pad | control | before size / px | after size / px |
|---|---|---|---|---|---|---|
| bookingform | -/md to widget/md | 27px to 21px | 18px to 14px | ui-text-field Ada Lovelace | sm / 28 | - / 28 |
| bookingform | -/md to widget/md | 27px to 21px | 18px to 14px | ui-text-field 2 | sm / 28 | - / 28 |
| bookingform | -/md to widget/md | 27px to 21px | 18px to 14px | ui-text-field Sat, Nov 14, 2026 | sm / 28 | - / 28 |
| bookingform | -/md to widget/md | 27px to 21px | 18px to 14px | ui-button Change arrival date | sm / 14 | sm / 14 |
| bookingform | -/md to widget/md | 27px to 21px | 18px to 14px | ui-text-field Tue, Nov 17, 2026 | sm / 28 | - / 28 |
| bookingform | -/md to widget/md | 27px to 21px | 18px to 14px | ui-button Change departure date | sm / 14 | sm / 14 |
| bookingform | -/md to widget/md | 27px to 21px | 18px to 14px | ui-button Reserve | sm / 28 | md / 28 |
| cardtable | -/md to widget/md | 27px to 21px | 18px to 18px | ui-button +10 | md / 36 | lg / 32 |
| cardtable | -/md to widget/md | 27px to 21px | 18px to 18px | ui-button +25 | md / 36 | lg / 32 |
| cardtable | -/md to widget/md | 27px to 21px | 18px to 18px | ui-button +50 | md / 36 | lg / 32 |
| cardtable | -/md to widget/md | 27px to 21px | 18px to 18px | ui-button +100 | md / 36 | lg / 32 |
| cardtable | -/md to widget/md | 27px to 21px | 18px to 18px | ui-text-field 50 | md / 36 | lg / 32 |
| cardtable | -/md to widget/md | 27px to 21px | 18px to 18px | ui-button Clear | md / 36 | lg / 32 |
| cardtable | -/md to widget/md | 27px to 21px | 18px to 18px | ui-button Deal | md / 36 | lg / 32 |
| cardtable-hand | -/md to widget/md | 27px to 21px | 18px to 18px | ui-button Hit | md / 36 | lg / 32 |
| cardtable-hand | -/md to widget/md | 27px to 21px | 18px to 18px | ui-button Stand | md / 36 | lg / 32 |
| cardtable-hand | -/md to widget/md | 27px to 21px | 18px to 18px | ui-button Double | md / 36 | lg / 32 |
| questioncard | -/md to widget/md | 27px to 21px | 18px to 18px | ui-button Check answer | md / 36 | lg / 32 |
| productcard | -/md to widget/md | 27px to 21px | 0px to 0px | none | | |
| resultcard | -/md to widget/md | 27px to 21px | 18px to 18px | ui-button Play again | lg / 44 | lg / 32 |
| contrastpair | -/md to widget/md | 27px to 21px | 18px to 18px | none | | |

12 control height(s) changed.
