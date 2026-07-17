---
doc-type: ticket
id: tkt-0088
status: open
date: 2026-07-17
owner:
kind: feature
size: small
---
# TKT-0088 — the site shell dogfoods scheme + theme through `ui-theme-provider` (ADR-0141 cl.4/5)

## Summary
Leg 3 of the THEMING arc. The docs shell (and the standalone app pages) mounts ONE
`ui-theme-provider` around its content; a shell-header control offers the scheme toggle
(auto/light/dark) and the theme picker (default + packs). `site/lib/theme-loader.ts` lazy-injects
a pack's stylesheet on first selection and persists both choices — the provider component itself
stays untouched (its LLD's own prediction for this seam).

## Acceptance
- Shell-wide provider: every doc page + `agent-admin-app.html` render inside it; scheme unset
  still tracks the OS (the ADR-0117 unset-inherits fix must not regress).
- Theme picker switches among default + the TKT-0087 proof packs LIVE: first selection injects
  the pack CSS once, re-selection is instant, choice + scheme persist across reloads.
- Browser-verified in both schemes × ≥2 themes (the tokens actually repaint — computed-style
  spot checks on a role each pack overrides).
- No fetch/env code enters any packaged component; the loader lives site-side.

## Links
- [ADR-0141](../adr/0141-theme-packs-ultimate-tokens-pipeline.md) — the contract ·
  [TKT-0087](tkt-0087-theme-pack-pipeline.md) — the packs this consumes.

## Scope/Open
- The gallery/theming teaching pages update to point at the live shell mechanism (small prose
  deltas), not rebuilt.

## Findings
