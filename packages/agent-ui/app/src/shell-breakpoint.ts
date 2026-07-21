// shell-breakpoint.ts — LLD-C7 (GH #99, round 5): the ONE documented source of truth for the shell
// family's narrow-collapse threshold, shared by app-shell.css, app-shell-isolation.css,
// master-detail.css, nav-rail.css, and super-shell.css.
//
// Why this is a TS constant and NOT a CSS custom property: an `@container` condition's value must be a
// literal — `@container (inline-size < var(--x))` is not valid CSS (Container Queries §2, "the range
// MUST be a <length>", no `var()` substitution point exists there) — so a runtime custom property
// genuinely cannot drive the five sites' `@container (inline-size < 40rem)` rules. Each site therefore
// keeps its OWN literal `40rem` (a real CSS constraint, not an oversight); what this file gives them is a
// single NAMED, CITED value plus a mechanical consistency gate (shell-breakpoint.test.ts) that reds the
// instant any site's literal drifts from this one — the DRY fix GH #99 asks for, honestly scoped to what
// CSS actually allows rather than claiming a live substitution that can't exist.
export const SHELL_NARROW_BREAKPOINT_REM = 40
export const SHELL_NARROW_BREAKPOINT = `${SHELL_NARROW_BREAKPOINT_REM}rem`

// The COMPACT line (SPEC-R8/ADR-0155): the second named band boundary, joining the narrow line above.
// 52.5rem is deliberately ADR-0150's number — the M3 compact-window boundary (840px) the fleet already
// owns for the body typescale — reused here so the shell family cuts its band ladder at one fleet-named
// line rather than inventing a third magic number (the shell's own module math — dual full sides + canvas
// floor, 2·(54+252)+162+4·18 ≈ 846px — lands within one 18px module of it). One number, two mechanisms:
// a viewport `@media` there, a container `@container` here (super-shell.css's compact arms, guarded by
// `collapse-band='compact'`); shell-breakpoint.test.ts sweeps BOTH literals against their named source.
export const SHELL_COMPACT_BREAKPOINT_REM = 52.5
export const SHELL_COMPACT_BREAKPOINT = `${SHELL_COMPACT_BREAKPOINT_REM}rem`
