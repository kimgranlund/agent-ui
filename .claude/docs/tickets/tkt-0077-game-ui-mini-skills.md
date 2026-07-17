---
doc-type: ticket
id: tkt-0077
status: done
date: 2026-07-16
owner:
kind: feature
size: small
---
# TKT-0077 — game-UI mini-skills: card layout · table chrome · HUD (the Croupier's degraded render)

## Summary
Kim's screenshot (2026-07-16, post-TKT-0076): a live Croupier deal rendered as ONE narrow centered
column — bare rank letters ("K", "?") as loose Text lines, no card tiles, no zones, a lone Hit
button — visually broken despite being wire-valid. The producer's only game idiom is the thin
`card-game-sheet` mini-skill (one sentence of anatomy); nothing teaches HOW a playing card, a
table frame, or a score HUD composes from the real catalog. Kim: "The Croupier may need a few
skills specific to: Card Layout · Game UI Chrome (containers, canvas, etc) · Game UI (score, etc)."

The mechanism already exists — the ADR-0091/0135 mini-skill registry (`prompts/mini-skills/*.md`,
intent-matched via `selectMiniSkills`, cap 3/turn). This ticket adds three catalog-grounded
modules and aligns the Croupier preset's skills entries with them.

## Acceptance
- Three new `prompts/mini-skills/` modules, each ≤ the ~200-token budget, teaching ONLY real
  default-catalog vocabulary (no Divider — none exists; wire prop names):
  - `card-layout` — each playing card is its OWN Card tile with a rank+suit glyph Text (never a
    bare rank letter); face-down idiom; hand = Row of tiles; data-bound card text.
  - `game-table-chrome` — ONE Card as the table: CardHeader title+Badges, CardContent Column of
    per-participant zones (zone-name Row + hand Row, full width), CardFooter action Buttons;
    names the anti-pattern (a single narrow centered column of bare Text).
  - `game-hud` — score Badges with intent semantics (success/danger/warning), chips as a Stat
    with delta, Progress for round/shoe, caption status line; everything data-bound.
- Shared trigger core (`deal blackjack poker game round`) so a terse "deal me in" selects the
  trio together (cap = 3); distinct per-area nouns keep them separable on specific intents.
- `mini-skills.test.ts` length pin 6 → 9 + a trio-selection probe; the
  `prompt-equivalence.baseline.json` registry section extended (a deliberate content change per
  the fixture's own rule) — the composed-prompt baselines are untouched (no ★ body edited).
- The Croupier preset's skills list names the three modules; `surfaceStyle` drops the misleading
  "Icon+Text per playing card" phrasing for the card-tile idiom.
- Gates green; browser-verified: a fresh Croupier deal renders card tiles in zones, not a column
  of letters.

## Links
- [TKT-0076](tkt-0076-agent-admin-real-a2ui-surfaces.md) — the live-surface arm this tunes.
- ADR-0091 (mini-skill registry) · ADR-0135 cl.11 (prompt files) · ADR-0138 (persona seam).

## Findings

### 2026-07-16 — built, live-verified: the Croupier deals real card tiles — CLOSED

**The trio shipped** (`card-layout` 190 tokens · `game-table-chrome` 182 · `game-hud` 148, all under
the ~200 budget): catalog-grounded to the REAL wire vocabulary (Row/Column gap/align/justify/wrap,
Card elevation/brightness + Header/Content/Footer, Text variant/emphasis, Badge label/intent, Stat
label/value/delta, Progress, Button variant) — and deliberately teaching NO Divider (none exists).
The shared `deal blackjack poker game` trigger core makes a terse "deal me in" select exactly the
three (pinned by the new selection probe); distinct per-area nouns keep them separable.
`card-game-sheet` stays registry-only (it is one of the ★ blue-sky calibration entries composed
into `NEGOTIATE_BLUE_SKY` by id — removing/renaming it would break `system-prompt.ts`).

**Gates moved, per their own rules:** `mini-skills.test.ts` 6 → 9 + the trio/selection pins;
`prompt-equivalence.baseline.json` extended append-only (the fixture's "deliberate text change"
clause; the composed-prompt baselines untouched — no ★ body edited); the site preset-integrity
`targeted` list re-pointed at the trio.

**Live-verified (browser, Fable 5, fresh session):** "deal me in" → a real table Card — header
"Blackjack" + Bet/Round badges, dealer zone "K♥" + face-down "🂠" tiles with score badge, player
zone "9♣" "7♦" tiles + 16 badge, Chips Stat 100, solid Hit / soft Stand footer. Clicking **Hit**
updated the SAME single host (ADR-0129) and appended a real "4♠" tile.

**The diagnosis detour (recorded because it will recur):** the FIRST post-registry deal rendered
the right anatomy but EMPTY card tiles. The captured wire (server-side repro + a live fetch-tee)
proved the tiles were `Text.text` bound to data-model paths — a shape the renderer handles fine
(the new `renderer/bound-text.test.ts` pins it, data-before-components) — so the empties were that
one payload's own bound-path-never-set variance, which the validator legitimately cannot reject
(late-arriving data is a feature). Mitigation shipped in `card-layout`'s body: "SET every bound
path in the same turn, or the tile renders empty."

**Also:** the Croupier preset now carries the trio as its skills entries and its `surfaceStyle`
teaches the card-tile idiom (the old "Icon+Text per playing card" line was itself part of the
bare-letter failure). Gates: check green · full jsdom 6311/6311.
