# CSS structural laws — PR-harvested

Two normative laws (2026-08-19 harvest), each proven by a merged fix and stated here because no
shared-corpus law doc owns its question yet. Each cites its proving PR — read the diff's own
commentary for the measured evidence before relaxing either. Promotion path: a third instance of
either class graduates the law into `.claude/docs/references/` (or an ADR) and this file's entry
becomes a citation.

## 1. A visually-hidden absolutely-positioned part REQUIRES a positioned host

Any control minting a visually-hidden `position: absolute` part (the clip idiom — an aria-label
mirror, a live region) MUST position its own host (`:scope { position: relative }`). Unpositioned,
the hidden part's containing block is the nearest positioned ANCESTOR — outside the host — where
its static position can land inside some ancestor's scroll region and INFLATE it: the
**phantom-scroll class**. Measured (GH #1297, PR #1301): `ui-select`'s `[data-part='aria-label']`
span, host unpositioned inside `ui-agent-admin`, resolved its containing block to super-shell's
`[data-part='middle']` (`position: relative`), landed ~1000px down but OUTSIDE the settings pane's
scroll clip, and grew `middle` to `scrollHeight=1062` vs `clientHeight=546` — a real, visible
scrollbar on a container that owns no scroll, while the actual scroll owner's bar was hidden. The
positioned host is the standard companion of the clip idiom (`otp-field.css` carried it already;
`select.css` gained it in the fix).

- Review check: any `position: absolute` hidden part in a control's CSS ⇒ its `:scope` block
  declares `position: relative`. A `position: fixed` overlay part (listbox panels) is exempt —
  fixed boxes never resolve to the host anyway.
- The defect is INVISIBLE at the component's own probe scale: it only paints once the control sits
  deep inside a positioned-ancestor + scroll-container composition. PR #1301's probe shape is the
  pin to copy — "the pane is the ONLY vertical scroller on its ancestor chain", plus the span
  staying inside its host's box.

## 2. A shell/app `[data-part='…']` selector MUST be zero-specificity-fenced or component-scoped

`data-part` names are a PER-FAMILY convention, not a global registry — every family mints its own
`bar`/`frame`/`track`/… A shell's `@scope (ui-x) to (ui-x)` lower bound only fences NESTED
INSTANCES of the same shell; it does nothing against OTHER families' parts, so an unqualified
`[data-part='bar']` inside the scope matches every part named "bar" anywhere in shell-HOSTED
content. Measured (GH #1328, PR #1404): super-shell's bar rule (54px `min-block-size` + flex +
shell surface) reached `ui-ladder`'s magnitude bars on the docs site — whose whole page lives
inside the shell — turning 12px pills into full-row-height slabs, and the degradation masqueraded
as an A2UI-path defect because the comparison shot mounted outside the shell.

The fence: qualify with a **zero-specificity discriminator only the family's own parts carry** —
`[data-part='bar']:where([data-bar])` (super-shell.ts stamps `data-bar` in the same breath as
`data-part` on its two bars; content-side parts never carry it). `:where()` is load-bearing: it
keeps the rule at its historical specificity so page-side overrides that out-specified it keep
winning (a plain `[data-part='bar'][data-bar]` spelling flips those ties via scope proximity —
verified live both ways in the fix). Where no discriminator exists, scope the rule to the
component's own element instead.

- KNOWN LATENT instance (flagged in GH #1328's Findings; still unfenced as of 2026-08-19, main
  `6c706655`): super-shell.css's `[data-part='frame']` rule (`display: flex; flex: 1 1 auto; …`,
  ~line 147, plus its two `:has()` variants) — and `ui-sandbox-frame` mints `data-part='frame'`
  on its sandboxed `<iframe>` (sandbox-frame.ts:273), so the rule reaches any sandbox-frame hosted
  inside a super-shell the same way. Unobserved so far; the shell's frame is a plain div with no
  second attribute (super-shell.ts:296), so closing it needs a minted discriminator or `:scope`
  child scoping. Whoever next touches super-shell.css or composes sandbox-frame into a shell owns
  closing it. The shell's other generic part names (canvas, middle, pane, rail, scrim) collided
  with nothing fleet-side at harvest time.
