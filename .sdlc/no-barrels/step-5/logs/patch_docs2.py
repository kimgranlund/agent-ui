def patch(p, pairs):
    s = open(p).read()
    for old, new in pairs:
        assert s.count(old) == 1, (p, old[:80])
        s = s.replace(old, new)
    open(p, 'w').write(s)

patch('.claude/docs/spec/persona-catalog-composition.spec.md', [
("""> Status: accepted · v0.2 · 2026-08-06 · Layer: SPEC (execution contract)""",
 """> Status: accepted · v0.3 · 2026-10-05 (v0.2 2026-08-06; v0.3 adds SPEC-R1's optional `controls` records, `ControlRecord`, and SPEC-R2 AC7, the derived entry's control loader, ADR-0233, accepted) · Layer: SPEC (execution contract)"""),
("""alone, preserving a single-base fragment's authoring shape unchanged by this widening).
`<persona-id>` is a stable kebab identifier""",
 """alone, preserving a single-base fragment's authoring shape unchanged by this widening).
The package MAY also export `controls: readonly ControlRecord[]` (ADR-0233; `ControlRecord` from
`@agent-ui/components/loader`): one lazy record (`tag`, `load()`) per control the fragment's factories
create that lives outside `@agent-ui/components`, so a renderer can define it on demand (SPEC-R2 AC7).
`<persona-id>` is a stable kebab identifier"""),
("""  posture AC3's collision case has — rather than silently skipping that pairing.
""",
 """  posture AC3's collision case has — rather than silently skipping that pairing.
- **AC7 (control loader, ADR-0233)** *Given* a persona package with `controls` records, *when* the
  derive-then-register step registers its derived entry, *then* the entry's `controls` loader
  (`composeControlLoaders(base.controls, pkg.controls)`) routes each tag with a persona record to a
  `'host'`-mode loader over those records and every other tag to the base entry's loader, so a
  persona control outside `@agent-ui/components` renders through the derived catalog (runtime SPEC-R9
  AC3's deferred apply). With no persona records the derived entry carries the base loader; with
  neither, it carries no `controls` at all, exactly as before.
"""),
])
print('ok')
