---
id: T-0122
title: "Adopt the skill's control rule: box padding n plus label inset n minus c (text edge 2n minus c)"
type: feature
status: done
size: L3
priority: P1
depends: []
created: 2026-10-13
router: .sdlc/AGENTS.md
---

## Goal
The updated mathematical-design-system control rule: one geometry for every control. box padding n, gap c, label inset p = n - c carried by the text slot; icon edge n, icon to text n, text edge 2n - c; min width 4n; label-only control 4n - 2c plus text; action labels stretch and align per the skill's table. Kim 2026-10-13: adopt it next, after T-0120 lands (the anchors shift first; this ticket starts only when T-0120 is merged).

## Scope (one brief paragraph, per the Inner loop rule)
Read ~/.claude/skills/mathematical-design-system/SKILL.md section 2 (the control rule and the label stretch table) and packages/agent-ui/shared/src/tokens/scale.mjs after T-0120. For every control the skill names (button, input, textarea, select, combobox trigger, tab, menu and listbox row, segmented option, toolbar item, badge and tag) put the label inset on the text slot, set min-inline-size 4n, align action labels per the table (centred alone or between content, start with trailing only, end with leading only, using the three selectors, no :has()), and keep icons and boxed items pinned to their edges with no inset. Add --md-sys-label-inset to the generator (foundations.gen.css and the bridge), a per-control geometry test inside and outside data-tier regions (text edge 2n - c: 12 at n 7), re-pin affected tests, re-mint goldens family by family after eye review, and report the px that move per control with before and after screenshots of eight controls at 400px and 1000px, light and dark. ADR-0245 gets an append-only amendment recording the adoption. Local gate: npm run check, touched folders' tests, all four browser shards and the visual shard, census gate, probe --strict; no per-ticket verifier; no em dashes; commit locally, do not push; report in one short message.

## Update 2026-10-13, after T-0120 merged as #1942 (read this first)
The root is now n 5 / 6 / 7 (heights 20 / 24 / 28), so the text edge 2n - c is 8 / 10 / 12 at the root, not 12 at md. scale.mjs is vendored at sha 3c319761 and already carries the rule: read `resolve().control.margin`, `control.gutter`, `labelMargin` and `parts.*`; do not re-vendor, and if the skill's sha has moved, note it and do not chase it. Also adopt in this ticket the three items T-0120 left (ADR-0245 Amendment 3 point 7): badge height 2n + 2c (12 to 16 at root md), checkbox and badge radius ceil(n/2), and the chip level tokens. Number the ADR amendment 4. Work as T-0120 did: land the production change, the generator tokens and the per-control geometry tests, get `npm run check`, the census gate and probe --strict green, then run the unit suite and the six browser shards once and write `.sdlc/control-rule-adoption/repin-list.md` (tracked, grouped by census lane, law checks called out) instead of re-pinning the fleet or re-minting goldens yourself; the conductor fans those out. Then shoot the before and after screenshots (eight controls plus badge and checkbox, 400 and 1000, light and dark, one labelled contact sheet per theme, viewed, PNGs not committed). T-0121 (shell geometry) merges around the same time and owns the shell, page and container files; stay out of them.

## Closed

2026-10-13: merged as #1949
