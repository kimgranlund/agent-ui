---
doc-type: ticket
id: tkt-0070
status: done
date: 2026-07-16
owner:
kind: feature
size: small
---
# TKT-0070 — lateral fleet review, campaign 2: the attributes axis vs the post-TKT-0025/0069 naming canon

## Summary
The `agent-ui-lateral-review` workflow's own repeat trigger fired: a law change makes its axis due.
Since campaign 1 ([TKT-0065](tkt-0065-lateral-review-campaign-1.md)) the attributes canon was
substantially rewritten — the TKT-0025 naming master plan landed `references/naming.md` (reserved
words, concept canons, the §10 rubric, §12 exceptions, the naming gates), and TKT-0069 executed four
rulings against it (label reflects fleet-wide · scheme sentinel `'auto'` · duration = ms number ·
the eight `name`/`value` renames with the wire-stable catalog mapping). This run re-sweeps ONE axis
(attributes-as-API) over the whole fleet to verify the fleet actually converged on the new canon,
and exercises the updated axis-pack ledger for the first time.

Census: 69 descriptors (machine-derived). Pre-pass: the attribute-matrix v2 (campaign 1's four
recorded improvements applied — `variant` suppressed, enums set-compared, `attribute:` column,
quoted-scalar flag kept) — 39 shared attributes, 17 mechanical divergence flags entering the sweep
as candidates, several of which are already-ledgered rulings the reviewer must recognize, not
re-flag.

## Acceptance
- Per the workflow's contract: the per-axis findings table (control × checks × verdict), every
  finding routed DRIFT / GAP / UNRECORDED-DEVIATION / MISSED-REUSE with `file:line` evidence.
- Phase 4 verification by the host before routing; Phase 5 routing per TKT-0046's discipline.
- The attributes-pack ledger updated with anything ratified this run.
- Explicit verdicts on the two carried TKT-0069 candidates: `grid.md`'s `min` (CSS length vs the
  numeric range `min`) and the `String(default)` trip-wire gate hole.

## Links
- `.claude/skills/agent-ui-lateral-review/SKILL.md` — the workflow + the attributes axis pack.
- [TKT-0065](tkt-0065-lateral-review-campaign-1.md) — campaign 1 · [TKT-0069](tkt-0069-attribute-api-rulings.md) — the rulings this run verifies.
- `references/naming.md` — the rewritten canon under test.

## Findings

### 2026-07-16 — swept, verified, ruled, routed — CLOSED. The fleet CONVERGED on the new canon.

**Run:** one attributes-axis reviewer over all 69 descriptors (slice-read), pre-armed with the
rewritten naming.md + the updated ledger + the matrix v2. **Zero ledger re-flags** (the campaign-1
noise class did not recur). All 17 mechanical matrix flags dispositioned: 9 ledgered/sanctioned ·
2 genuine GAPs · rest artifacts or per-control-documented practice. Host verification opened every
GAP citation (exact) and independently re-ran the events extraction — the fleet emit set is
{change, click, close, input, select, toggle}, ⊂ the closed six + click, zero out-of-vocabulary.

**Headline verdicts:**
- The TKT-0069 rulings HELD under fresh review: `label` shows zero reflect divergence across all
  23 carriers; the renames left no residue; `scheme`/`duration` match their §12 records exactly.
- **Carried Q1 (`min`/`max`) RULED — concept-canon entry (Kim):** three measured clusters resolve
  into TWO sanctioned senses now recorded in naming.md §3 — value-domain bound (numeric-native or
  string-serialized native-`<input>` parity; text-field↔calendar were already cross-cited) vs
  CSS-`<length>` layout-dimension bound (grid/split-pane, the `minmax()` grain). No renames.
- **`href` GAP RULED — navigation URLs reflect (Kim):** recorded in §3; `ui-attachment.href`'s
  reflect:false is marked TEMPORARY-INERT in its descriptor with an explicit flip-at-LLD-C6 note,
  so that wave inherits the decision.
- **Carried Q2 (`rows`) PASS:** table-data vs textarea-sizing are independently well-established
  senses, both individually canon-compliant — a matrix artifact, now ledgered against re-litigation
  (with `type`).
- **Four ledger addenda ratified as a batch (Kim):** default-divergence-with-cited-rulings benign ·
  href temporary-inert · the scheme reflect principle (JS-global-effect reflects, pure-render
  doesn't) · rows/type artifact suppression for the pre-pass.

**Pre-pass:** matrix v2 (69 descriptors · 39 shared attrs · 17 flags) with campaign 1's four
improvements applied; artifacts in the session scratchpad (`lateral-review/attribute-matrix-v2.md`),
the campaign-1 precedent. Next-run note: suppress `rows`/`type`, and teach the reflect-divergence
flag the display-tier property-only doctrine (finding #11's progress-vs-slider split was principled).

**The other carried item — the `String(default)` trip-wire hole — CLOSED with a schema rule.**
`component-descriptor.ts` rule 5b: the parser now records a quoted `default` under a sentinel key
(the BARE_SCALAR_KEY trick — quoting was previously erased by `unquote` before validation could see
it), and `validateComponentDescriptor` rejects a QUOTED scalar default on a `boolean`/`number`
attribute (`default: 'false'` for `type: boolean` — exactly the mis-typing the contract↔props
trip-wire is structurally blind to, since it compares `String(config.default)`). A string
attribute's quoted `''` stays legal. Own gate + negative control:
`component-descriptor-quoted-default.test.ts` (the quoted form FAILS, the bare form passes) — and
the rule ran clean against all 69 real descriptors (campaign 1's 19 unquotings left zero residue).

**Gates:** `npm run check` green · full jsdom 6279/6279 (342 files) · docs-grammar + naming-gates
green after the naming.md/ledger edits · descriptor suite 222/222 with the new rule live.
