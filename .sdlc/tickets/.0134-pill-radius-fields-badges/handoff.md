---
id: T-0134
title: "Everything pill: fields, select, combo-box, menu and listbox rows, badges and tags take radius h/2"
type: feature        # feature | bug | chore | spike | idea
status: done
size: L3
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-13, after dogfooding the A2UI sheets: badges, tags, select and menu read too sharp at the n 6 root (badge 3px on 16, fields 6px on 24). Ruling: everything pill. Single-line controls and chips take radius h/2, like buttons and toggles already do.

## Scope (one brief paragraph, per the Inner loop rule)
In scripts/generate-foundations.mjs add the derived pill radius for every single-line control and chip (h/2: 2n for a control, n + c for the badge chip at 2n + 2c), and point text-field, select trigger, combo-box, multi-select, otp-field cells, date and number style fields, menu and listbox rows, badge, tag and chip radii at it. Multi-line and container surfaces follow the concentric rule rather than h/2: a textarea takes the single-line control radius 2n; a menu, listbox, select or combo-box PANEL takes its row radius plus the panel's own inset so rows nest concentrically; a card keeps its level radius. Checkbox stays a rounded square (ceil(n/2)), radio and switch unchanged. Record it as ADR-0245 Amendment 5 (append-only) with the ruling and the reason, and add a P13 to .sdlc/mathematical-design-system-review.md proposing pill radius for single-line controls and chips to the skill. Another lane (T-0135, the date input) edits text-field.ts and text-field.css at the same time: keep your text-field change to the radius lines only. Root is n 5 / 6 / 7 (heights 20 / 24 / 28). Local gate: npm run check, census gate, probe --strict, the touched folders' unit and browser tests (heavy runs through gate_lock.py), then the six browser shards one at a time in the foreground; re-pin what the change turns red from resolve() and re-mint goldens one file at a time with '<file> --update' (filter before the flag) after viewing each. Never wait on a background monitor: run commands in the foreground and send the conductor a one-line progress message after each major step. Regenerate generated files by script. Before and after screenshots at 400 and 1000, light and dark, in the ticket folder, viewed, not committed. Commit locally, do not push, no per-ticket verifier, no em dashes.

## Closed

2026-10-13: merged as #1951
