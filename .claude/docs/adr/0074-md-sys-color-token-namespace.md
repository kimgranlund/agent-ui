# ADR-0074 — the color-token namespace becomes `--md-sys-color-*`: an extension of Google Material Design 3 is the official color foundation; a color-only, value-preserving rename of `--c-*` (+ one `-500-50 → -500-050` alpha-padding normalization)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-04 |
> | **Proposed by** | orchestration-coordinator (executing Kim's foundation directive; a mechanical cross-cutting rename, not a design-seat proposal) |
> | **Ratified by** | Kim (directive: "make an extension of Google Material Design 3 the new official foundation" + "proceed" · scope answered via `/intent-extract`: color-only, rename-only, pad `-500-50 → -500-050`, 2026-07-04) + orchestration-coordinator on green gates — check(+site) · jsdom 2342 · browser 564/564 · size 6542/7168 + 22193/22528 · **zero `--c-` survivors, 1910→1910 conserved 1:1** |
> | **Repairs** | Cross-cutting naming change — no single owning-doc ID. Touches: `CLAUDE.md` naming line · `references/tokens.md` · `interaction-states.md` · `component-authoring-best-practices.md` · `component-packaging.md` · component `{name}.md` descriptors · `a2ui-catalog.spec.md` SPEC-R5 + `a2ui-catalog.lld.md` LLD-C8 (theming convention refs) · every `.css`/`.ts` token consumer across `packages/` + `site/` |
> | **Supersedes / Superseded by** | Renames (does not reverse) the token roles established by ADR-0008 (interaction-state roles) · ADR-0009 (`--c-focus-ring` → `--md-sys-color-focus-ring`) · ADR-0015 (container-surface space + neutral tint/wash primitives) · ADR-0057/0058/0059 (intent / selected / track roles). Each decision **stands**; only the token spelling changes. |

## Context

The Ultimate Tokens kit at `.claude/docs/other/nonoun-color-tokens-agent-ui/` (name: "Agent UI" — exported
FROM this very palette) publishes the color layer under the **Material Design 3 system-color namespace**
`--md-sys-color-*` (760 vars; `colorPrefix: "md-sys-color"`; the same 8 palettes — Neutral / Primary /
Secondary / Tertiary / Info / Success / Warning / Danger — and the same 59 role-per-palette ladder the repo
already ships under `--c-*`). Kim's directive: **make an extension of Google Material Design 3 the new
official foundation.** A `/intent-extract` narrowed the scope to three load-bearing decisions:

1. **Color-only.** `--ui-*` dimensional/type/geometry tokens are OUT of scope and unchanged.
2. **Rename-only, values preserved.** The exact `oklch(...)` values are byte-identical before and after — a
   **zero visual change**. The kit was exported from this palette, so the namespaces already denote the same
   colors; this decision aligns the *spelling*, not the *pixels*.
3. **One alpha-padding normalization.** The kit's alpha suffix is 3-digit; the repo's 500-stop 5%-alpha
   translucents were 2-digit `-500-50`. Pad to `-500-050` to match the kit convention.

## Decision

**Adopt `--md-sys-color-{palette}-{stop}[-{alpha}]` as the official color-token namespace; retire `--c-*`.**

1. **The rename.** `--c-` → `--md-sys-color-` across every color-token definition (`packages/agent-ui/shared/
   src/tokens/tokens.css`) and every consumer — component `.css`, `.ts` template literals, `site/` pages, and
   the author-facing docs/refs/rubrics. Executed as a deterministic prefix swap (`s/--c-/--md-sys-color-/g`):
   **1910 occurrences across 83 code files (+ 36 doc files), conserved 1:1, zero survivors.** No `--c-` name
   survives in `packages/` · `site/` · `.claude/`.

2. **The alpha padding.** `-500-50 → -500-050` (word-bounded), tokens.css only — **24 occurrences = 8 palettes
   × (1 definition + 2 references** in each `scrim-weakest` `light-dark(X, X)` pair). The `-050-50` / `-950-50`
   neutral **wash primitives** (ADR-0015, repo-local, absent from the kit) are DELIBERATELY NOT padded —
   `-500-50\b` cannot match inside them, and they keep their exact suffix under the new prefix.

3. **What did NOT change.** Values (byte-identical oklch) · the 8-palette × 59-role structure · `--ui-*`
   type/geometry/dimensional tokens · the pairing/AA laws (ADR-0057–0059) · any component behavior. The
   `tokens.test.ts` contract holds unchanged except the prefix (its `${stop}-50` regexes target the *unpadded*
   wash primitives, not `-500-50`).

4. **History is recorded, not rewritten.** Historical ADRs and decompositions were swept to the new spelling
   too (so `grep --md-sys-color-focus-ring` resolves and no record cites a dead token name — the "context is
   memory: update every record that lies" discipline). Each such ADR's **decision is unchanged**; only the
   token's current name updates. THIS ADR is the point-in-time record of *when and why* the rename happened.

## Consequences

- **The color foundation is now MD3-aligned by name.** A future decision MAY adopt the kit's other export
  formats or additional MD3 roles; this ADR only aligns the existing namespace, changing no pixel.
- **`--c-*` is a dead name.** A standing zero-survivor grep over the CODE surface
  (`grep -rIn -- '--c-' packages site` — zero tolerance) is the regression guard; any reintroduction in
  code is a defect. (The `.claude/` docs are NOT in scope for the guard: this ADR and the index legitimately
  name the retired token in prose, and the kit export dir already uses the new namespace.)
- **Two token namespaces, cleanly split:** `--md-sys-color-*` (color) · `--ui-*` (dimension/type/geometry).
  The split is now explicit in the CLAUDE.md naming line and `references/tokens.md`.
- **`site/` has no automated color gate** (site tests are excluded from vitest; the browser gate is
  packages-only). The zero-survivor grep is EXTENDED to `site/`, and a manual dev-site smoke is the only visual
  net — called out so it is not mistaken for gate-covered.
- **The rename is mechanically reversible** (reverse prefix swap + un-pad) should the foundation decision be
  revisited — no information is lost.

## Acceptance

- 🟢 Zero `--c-` survivors in `packages/` · `site/` · `.claude/` (kit export dir excluded); 1910 → 1910 conserved.
- 🟢 Padding: 24 `-500-050`, zero stray `-500-50`, wash primitives (`-050-50`/`-950-50`) preserved unpadded, no over-application (`-500-0500`).
- 🟢 `npm run check` (tsc + site) · `npm test` **2342/2342** (incl. `tokens.test.ts`) · `npm run test:browser` **564/564** (Chromium + WebKit) · `npm run size` within budget, byte-identical to pre-migration.
- 🟢 Values unchanged: no `oklch(...)` literal edited; the diff is names-only (+ the one alpha pad).

## Alternatives considered

- **Rename-only, values preserved [CHOSEN].** Kim's scope. Aligns the namespace to the MD3 foundation with a
  provably zero visual change and a clean, reversible mechanical diff.
- **Rename + re-value to the kit's numbers [REJECTED for this slice].** Unnecessary — the kit was exported from
  this palette, so the values already coincide; re-valuing would risk a visual delta with no benefit. Left as a
  future decision if MD3 role expansion is wanted.
- **Leave `--c-*`, alias `--md-sys-color-*` to it [REJECTED].** Two live namespaces for one thing is drift by
  construction; the switcher between them rots. A hard rename with a zero-survivor guard is cleaner.
- **Leave historical ADRs on the old spelling [REJECTED — surfaced to Kim].** Would leave records citing a dead
  token name (grep-rot). The repo treats ADRs as living context; the decisions are unchanged, only the spelling,
  and this ADR preserves the *when/why*. (Reversible per-file if Kim prefers verbatim history.)

## Amendment — 2026-07-04 (ADR-0078): the namespace split widens to typescale

The Consequences line "Two token namespaces, cleanly split: `--md-sys-color-*` (color) · `--ui-*`
(dimension/type/geometry)" no longer holds for TYPE: [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md)
(proposed 2026-07-04) mints **`--md-sys-typescale-{role}-{size}-{property}`** as the fleet type scale and
retires `--ui-type-*` — exactly the "future decision MAY adopt the kit's other export formats or additional
MD3 roles" this ADR's first consequence anticipated (a foreseen amendment, not a supersession). The split
becomes: `--md-sys-color-*` (color) · `--md-sys-typescale-*` (type) · `--ui-*` (dimension/geometry). The
color decision itself is unchanged. Effective when ADR-0078 is ratified and its build lands.
