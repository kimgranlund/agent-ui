# Page and shell geometry sweep against ADR-0245 clause 6 (2026-10-13)

Read-only audit of main at the time of the sweep. n = 7 at the root md control (product/sm under the old anchors); the new skill anchors (root n 6) are not on main yet, so values are shown at n 6 / 7 / 8. c = ⌈n/4⌉ = 2. Files cited are relative to the repo root. UNVERIFIED items are listed at the end.

## Level values

| level | n=6 margin / gutter | n=7 | n=8 |
|---|---|---|---|
| group | 8 / 2 | 9 / 2 | 10 / 2 |
| widget | 12 / 6 | 14 / 7 | 16 / 8 |
| card | 18 / 12 | 21 / 14 | 24 / 16 |
| layout | 24 / 18 | 28 / 21 | 32 / 24 |

Level tokens: `packages/agent-ui/shared/src/tokens/foundations.gen.css:34-45`. Space aliases: `foundations-bridge.gen.css:37-42` (xs = c, sm = n, md = n+c, lg = 2n, xl = 3n, 2xl = 4n). Legacy literals survive only under `[data-foundations='legacy']`.

## Key regions (D = derived, H = hand-set)

| Region | file:line | value | D/H | should be | px at n 6/7/8 |
|---|---|---|---|---|---|
| Shell frame outer padding | `app/.../super-shell/super-shell.css:140-150` | none declared | H (absent) | layout margin | 0 now; target 24/28/32 |
| Shell inter-card gutter | `super-shell.css:18,24,265` | `--ui-super-shell-gap` = 1.125rem module | H | layout gutter 3n | 18 / 18 / 18 (target 18/21/24) |
| Bar height | `super-shell.css:19-20,200` | module x 3 = 54px | H | 8n | 54 (target 48/56/64) |
| Header bar inline inset (docs) | `site/pages/_page.css:182` | `--ui-bar-inline-inset` = layout margin | D | layout margin | 24/28/32 |
| Header content gap | `_page.css:177` | `--md-sys-space-md` | D | layout gutter | 8/9/10 (target 18/21/24) |
| Footer bar column | `_page.css:253-255` | `min(64rem, 100% - 2*bar-inset)` | D (cap H) | layout margin | 24/28/32 |
| Content column inline | `_page.css:544-545` | same min() formula | D (cap H) | layout margin | 24/28/32 |
| Content block padding | `_page.css:549` | `--md-sys-space-xl` (3n) | D | layout margin 4n | 18/21/24 (target 24/28/32) |
| Prose block margin | `_page.css:578` | `0 space-lg` | D | widget margin 2n | 12/14/16 |
| Lead paragraph | `_page.css:428` | `margin: 0 0 1.25rem` | H | widget margin | 20 (target 12/14/16) |
| Code block radius, inline code | `_page.css:629,633,676,678` | `0.5rem`, `0.3rem`, `0.1em 0.35em` | H | group radius, group margin | 8/9/10 |
| Nav flyout padding and radius | `nav-rail.css:80-81` | `space-xs`; corner-base | D | group margin / group radius | 2 (target 8/9/10) |
| Overlay pane inset | `super-shell.css:71` | module x 2/3 | H | widget margin 2n | 12 (target 12/14/16) |
| Agent-admin shell gutter | `agent-admin.css:188` | module x 2/3 | H | widget margin 2n | 12 (target 12/14/16) |
| Conversation header | `conversation-header.css:20-21,37` | block `sm`, inline `lg` | D | inline = widget margin | 6/7/8; 12/14/16 |
| Conversation composer | `conversation-composer.css:72,143,237-243,500` | `0.65rem`, `0.35rem`, `0.3rem`, `0.4rem`, chip `0.15rem 0.3rem 0.15rem 0.55rem` | H | widget margin / gutter | ~10.4 block |
| Surface-host stage / artboard | `surface-host.css:36-38`; `artboard.css:20-22,52` | gap `md`; pad `lg`; inset `2xl`; `min(32rem, 100% - 2xl)` | D (cap H) | card gutter / widget margin | 8-10; 12-16; 24-32 |
| Card region | `card.css:89-92`; `_surface/container-box.css:37,49-51` | margin `inset`, pad-inline `card-gutter`, pad-block `inset`, gap `card-gutter` | D | card | margin n, pad 2n, pad-block n |
| Modal | `modal.css:35-42,65,91,108` | card radius; `--ui-modal-padding` declared, dialog `padding: 0` | D; dead token | card | 18/21/24 |
| Drawer | `drawer.css:39-40,65-67,73,142` | `--ui-drawer-padding` declared, never consumed; width `min(92vw,26rem)` | D; dead token | card | n/a |
| Popover | `popover.css:35,38,43` | radius widget; padding widget margin | D | widget | 12/14/16 |
| Toast | `toast.css:44-47,35` | pad-inline widget margin; pad-block widget gutter; width `20em` | D | widget | 12/14/16; 6/7/8 |
| Row / column / grid gap | `row.css:85-100`; `column.css:79-94`; `grid.css:42-57` | the six `--md-sys-space-*` enums | D | by enum | per alias |
| Command modal | `command-modal.css:27,54,58-64,70,82-85` | inset and c based; width `min(92vw,36rem)`; radius `--md-sys-radius` | D (width H) | card level (modal) | n, c |

## Hand-set literals to replace

1. The shell module family (`super-shell.css:18-24,71,113,390`, `agent-admin.css:188`): one rem-fixed 18px module that does not move with n. gap to layout gutter, overlay-inset and shell-gutter to widget margin, tabs seam and padding to `--md-sys-inset`, bar-size to `height + 2 * widget margin`. Pane and canvas floors (252 / 162) to n multiples or named content floors.
2. Page literals (`_page.css:428,439-440,472,633,676,678`) to space aliases or group tokens; the CTA and tab anchors should use real `ui-button` and `ui-tabs`.
3. Conversation literals (`0.65rem`, `0.3rem`, `0.35rem`, `0.4rem`, chip padding) to `--md-sys-space-*`.
4. Dead tokens `--ui-modal-padding` (`modal.css:36`) and `--ui-drawer-padding` (`drawer.css:40`): delete.
5. Site: `doc-page.ts:515` inline gap and margin; `doc-page.css:21-32,164` api row `0.75rem 1rem` and radius `0.75rem`; `shell-spacing-gate.test.ts` still polices the old 18px module and density-1 ladder and needs repointing to the n-based levels.

## Inconsistencies

1. Header content inset: docs header = layout margin (24/28/32); agent-admin header = 12px module (`agent-admin.css:188`, a deliberate departure). Same role, two values.
2. Content region: inline = layout margin 4n, block padding = `space-xl` 3n. A layout region should pad 4n on both axes.
3. Card regions are not square: inline text edge = inset n + pad 2n = 3n; block text edge = inset n + pad-block n = 2n. Clause 6 says the card margin 3n applies on all sides, so pad-block should be 2n (`container-box.css:50`, `card.css:91`).
4. The `md` gap enum is now n + c: row, column and grid defaults at md went 12 to 9. Header gap, footer gap and stage gap that used `md` as a gutter should read `--md-sys-*-gutter`.
5. Widgets: toast pads inline 2n and block n; popover pads 2n all round. A widget pads 2n on all sides.
6. Radius: shell cards use `corner-lg` or the 18px module; `--md-sys-shape-corner-base` equals the card radius 3n; conversation inner radius = card radius minus c, not widget radius; the layout radius 4n is not used by the shell.
7. Toolbar maps `md` to group margin and `xl` to card margin, so `gap` reads as a margin (`toolbar.css:73-82`).
8. Command modal is a card-level member but uses group values and `--md-sys-radius` (n).

## Text-edge alignment (offset = margin minus child inset)

- Docs header brand at layout margin (28 at n 7); a boxed child at that edge would sit at 28 - 7 = 21. Nothing in `_page.css` applies the negative `--md-sys-inset` margin, so header buttons start at 35, not 28.
- Header, footer and page text use different x origins: the header spans the full frame including the nav rail; the footer bar and page footer centre in different containers; the header uses plain `padding-inline` while the footer bar uses `min(64rem, ...)`, so above the cap their text edges diverge (certain from CSS, not visually verified).
- Card block against inline edges: see inconsistency 3.

## Measure and breakpoint rules (none derive from n)

| Rule | file:line |
|---|---|
| `min(64rem, 100% - 2*bar-inset)` | `_page.css:253,340,503,544` |
| prose `72ch`, description `62ch`, lead `68ch` | `_page.css:576,582,383,429` |
| artboard `min(32rem, 100% - 2xl)` | `artboard.css:52`, `surface-host.css:38` |
| modal `min(92vw, 32rem)`, drawer `min(92vw, 26rem)`, command modal `min(92vw, 36rem)` | `modal.css:65`, `drawer.css:42`, `command-modal.css:54` |
| toast `20em`; nav flyout `12rem` / `min(90vw,20rem)` | `toast.css:35`, `nav-rail.css:92-94` |
| narrow line 40rem; compact line 52.5rem (ADR-0150, superseded, kept as the shell band) | `shell-breakpoint.ts:12-22` and consumers |
| row 24rem, column 30rem, composer 21rem container queries | `row.css:136`, `column.css:138`, `conversation-composer.css:592` |

Recommendation: express caps in n multiples or name them as content-measure constants; keep `ch` for prose only. Breakpoints stay rem literals (`@container` cannot read `var()`), but name them in one place.

## Recommended page and shell spec

| Region | Level | Inline margin | Block margin | Gutter | Radius |
|---|---|---|---|---|---|
| Page frame (shell, outer) | layout | 4n | 4n | 3n between cards | 4n |
| Header / footer bar | layout | 4n inline | 2n block (bar = 8n) | 2n between bar items | 0 (edge to edge) |
| Nav pane and rail | card inside layout | 3n inset (items at group n+c) | 2n | n between rows | 4n on the frame side |
| Content body | layout | 4n inline, centred column capped at a named measure | 4n | 3n between sections | n/a |
| Prose blocks in body | widget | 0 | 2n | n | n/a |
| Cards in body | card | 3n | 3n (fix to 2n block text edge) | 2n | 3n |
| Modal / drawer / command modal | card | 3n | 3n | 2n | 3n |
| Popover / toast | widget | 2n | 2n | n | 2n |
| Menus / listbox / table rows | group | n+c | n+c | c | n+c |
| A2UI row / column / grid | enum gap | none | none | c, n, n+c, 2n, 3n, 4n | n/a |

Placement rule everywhere: a boxed child at a container edge applies `margin-inline: calc(-1 * var(--md-sys-inset))` so its label lands on the container's text edge.

## Priority fixes

1. Bar inset and content padding to the layout margin.
2. Replace the 18px shell module with level tokens.
3. Make card block padding 2n.
4. Centre the header content in the same column as the footer.
5. Delete the dead modal and drawer padding tokens.
6. Repoint `shell-spacing-gate.test.ts` to the n-based levels.

## UNVERIFIED

`--md-sys-shape-corner-lg` value; `nav-rail-item` internal padding; the visual x-offsets above the 64rem cap; the n = 6 anchor (not on main yet); form-provider (no spacing CSS found); `super-shell.ts` inline styles.
