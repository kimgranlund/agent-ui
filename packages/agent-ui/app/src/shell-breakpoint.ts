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
