# The descriptor generation ratchet (ADR-0173) — packaging angle

Harvested verbatim from `component-packaging`'s own body (2026-08-15 extraction, GH #933/wave-2
W2-9). Read when converting a control to generated props, checking whether a control is on the
7-control bespoke-codec allowlist, or deciding which drift-wire test retires in a conversion
commit. For the architecture-level rationale (why props generate but the catalog row never
does) see `component-standards`' own `references/descriptor-generation.md` — this file covers
the packaging-side mechanics only (the grammar fields, the ratchet's per-control timing, the
drift-wire test names, and the regenerate command) and deliberately does not restate that
architecture doc.

The descriptor inverts from a hand-mirrored MIRROR into the generating SOURCE for exactly one
artifact — a control's `static props` table — never the catalog row (`@agent-ui/a2ui`'s own
hand-authored wire contract, cl.5; two of its three catalog shapes can never generate from fleet
descriptors at all). Five grammar fields on an `attributes[]` row carry the generation-facing facts
beyond `type`/`default`/`reflect`/`values` (`component-descriptor.ts`'s `ParsedAttribute`):

| Field | Carries | Specimen |
|---|---|---|
| `attribute` | string \| `false` — an attribute-name override, or opts a prop OUT of DOM reflection | `button.md`'s `icon-only` |
| `tsType` | a TS type expression, legal (and required) only when `type: json` AND no `codec:` is declared (a codec's own type rides its import) | PROSPECTIVE — no live descriptor carries one at HEAD (GH #761); the shape a `split.md` sizes-array row WOULD use: `number[] \| undefined` |
| `const` | the exported shared-tuple constant name, legal only when `type: enum` | `badge.md`'s `const: INTENTS` |
| `codec` | `{ import, name }` — a bespoke, already-assembled `PropConfig` import for a control whose codec encodes real validation logic no field can express | `table.md`'s `codec: { import: './table-model.ts', name: 'tableColumnsProp' }` |
| `description` | plain-scalar per-attribute teaching, emitted as a provenance-stamped comment in the generated file | — |

**The ratchet is per-control, never fleet-wide** (cl.6): a control is "converted" the moment its
folder carries a committed `{name}.props.gen.ts` — the filesystem itself is the migration-allowlist,
no separate list to keep in sync (`scripts/generate-props.mjs`'s own `alreadyConverted()`). The OLD
`compareDescriptorToProps` (s10) trip-wire in a control's own `*-descriptor.test.ts` retires in the
SAME COMMIT that lands its generator-drift-gate coverage — never a commit where both exist for a
control, never one where neither does (cl.4c/OF4).

**The drift-gate test names**: `descriptor/props-gen-driftwire.test.ts` regenerates every converted
control's props module in-memory from its `.md` and diffs it byte-for-byte against the committed
`{name}.props.gen.ts` (cl.4b — the generator CLI and this gate share ONE implementation,
`generate-props.ts`, so they cannot drift into two). `a2ui/src/catalog/default/descriptor-agreement.test.ts`
is a SEPARATE, fleet-wide gate live from wave 1 (not scoped to converted controls) — it checks every
catalog `PropDef` whose `mapsTo` names a descriptor attribute agrees on type/enum members (cl.5);
curated omissions and non-props `mapsTo` targets (`textContent`, controller-owned props, value-mark
plumbing) are legal, recorded exceptions in that file's own table, never a silent pass.

The 7-control bespoke-codec allowlist (seed population, drains via `codec:`): `table`, `bar-chart`,
`sparkline`, `stat`, `sandbox-frame`, `ladder`, `ramp` — each has at least one hand-rolled
`PropConfig` encoding real parse/sanitize logic a bare `prop.*()` factory call cannot express. Check
the live allowlist file at migration time; this list is the ratification-time seed, not a standing
count.

Regenerate a converted control after any descriptor edit: `node scripts/generate-props.mjs {name}`
(no args regenerates every already-converted control). Never hand-edit a `{name}.props.gen.ts` —
the drift gate's own negative-control assertion exists to catch exactly that.
