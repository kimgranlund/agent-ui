# Decomposition — the per-agent MCP-services BUILD arc (service-ref grammar · expansion · services GET · MCP-services pack · the #787 repair fold)

> Status: proposed · v0.1 · 2026-08-12 · planner · Tracker: GH [#783](https://github.com/kimgranlund/agent-ui/issues/783) ·
> Contract: [`../spec/mcp-agent-config.spec.md`](../spec/mcp-agent-config.spec.md) v0.2 (SPEC-R1–R7 / N1–N3)
> under [ADR-0185](../adr/0185-enablement-wire-service-reference-grammar.md) (**ACCEPTED** 2026-08-12 — the
> grammar fork is RATIFIED; no slice below waits on an external ruling). Implementation shapes:
> [`../lld/mcp-agent-config.lld.md`](../lld/mcp-agent-config.lld.md) (LLD-C1–C7 — exact exports, constants,
> copy, and the test-placement law; this doc slices, that doc shapes). Repairs tracker: GH
> [#787](https://github.com/kimgranlund/agent-ui/issues/787) — its three checkboxes are FOLDED into S1/S4
> below per SPEC-N2's same-change law, never a follow-up slice; closing #787 = S1 and S4 merged.
> `break-down-problem` is not installed in this repo's `.claude/`; its two-plane method is applied inline
> (§1/§2) with the coverage check in §2. One writer per file per slice; every slice ends
> `npm run check && npm test` green — judged by EXIT CODES, never grep — plus `npm run test:browser`
> where `app/` or `site/` files are touched (S3, S4).

## 0 · What already exists (read, not rebuilt) — and this arc's own frozen fence

Shipped and landed INTO, byte-unchanged unless a slice names the file: the `mcp/` connector
(GH #567 whole arc — roster, client, mapping, discovery, boot-await, admin GET), the enablement
seam (`resolveIntegrations`' fail-closed intersection — THE one file this arc deliberately
changes), the entry layer (ADR-0132/0164/0170 + GH #564's collision option), the live-pack seam
(`setLiveIntegrations`/`librariesForCategory`), and `#enabledToolIds`' opaque-id forwarding
(GH #402).

**Frozen for this whole arc** (SPEC-R3 AC3 · SPEC-R6 AC1 · SPEC-R1 AC1 — a slice diffing these is
out of contract): `mcp/client.ts` · `mcp/servers-config.ts` · `mcp/map-tool.ts` · the ready-gate
wiring inside `dev-proxy-plugin.ts` (the `mcpReady` mechanics; the FILE takes S2's GET widening)
· `src/agent/` · `worker/` · `agentConfigSchema()`'s shape + `ENTRY_KINDS` · `#enabledToolIds` ·
`mcp-boot.test.ts` (new proxy suites are NEW sibling files — LLD §5.4) · every `app/` line not
implementing the one `rejectOnCollision` widening (no `mcp`-named identifier ever enters
`packages/agent-ui/app/src`, tests included — LLD §5.3's placement trap).

## 1 · Plane 1 — outside-in (the whole, broken into parts)

The domain: an agent declares MCP **services** (`mcp:<server-id>:*`, ADR-0185) as ordinary
`tool`-kind entries; the reference expands server-side against the boot-built registry each turn.

1. **Wire grammar + server-side expansion** — the anchored ref parse (one pure module), the
   `resolveIntegrations` expansion (union, dedup, provisioned-filter unchanged, post-expansion
   ceiling), and the one discovery-side completeness change (skip a tool literally named `*`).
2. **Host surfacing** — the additive `services` array on the dev proxy's `GET /integrations`:
   one trio-shaped row per live server, `integrations` byte-identical, secrets-free by shape.
3. **The generic pack collision law** — `EntryLibraryPack.rejectOnCollision` (per-pack), honored
   by the pack-add path and the picker-disable affordance; the ONLY `@agent-ui/app` diff.
4. **The admin pack + live plumbing** — `fetchLiveServices` (degrade-to-`undefined`),
   `setLiveServices`, the `mcp-services` pack (ref as explicit id, empty content, generic,
   ABSENT on degrade), wired into the page's existing live-overlay block.
5. **Turn-time proof + arc fences** — the churn/degrade-ladder integration suite over both POST
   arms, the site-level master-switch MCP case, and the arc-grain fence assertions.
6. **Record repairs (GH #787 / SPEC-N2)** — the a2ui-live-agent SPEC amendment + the
   integration-standards SKILL repoint (falsified by part 1 → ride S1) and the agent-schema
   page + library-kinds skill rows (created by part 4 → ride S4).

## 2 · Plane 2 — inside-out (the actions each part must support)

| # | Action | Part |
|---|---|---|
| a1 | Parse ref-vs-exact-id deterministically, anchored, charset-locked to the frozen roster grammar | 1 |
| a2 | Expand a ref to the server's CURRENT registered tools at turn time — union, dedup, fail-closed drops | 1 |
| a3 | Bound the post-expansion set by a stated, deterministic, disclosed ceiling | 1 |
| a4 | Keep the one grammar-colliding manifest id (`tool.name === '*'`) out of the id space, skip-with-reason | 1 |
| a5 | Serve one admin-display row per live service — additive body, `integrations` byte-identical, no secret fact | 2 |
| a6 | Degrade services surfacing to pack ABSENCE (production/fault/malformed) — never stale, never partial | 2, 4 |
| a7 | Reject a duplicate foreign-key pack add visibly (`Already in the list.`), store unchanged, per PACK | 3 |
| a8 | Disable (never hide) an already-added pack row in the picker, same signal | 3 |
| a9 | Add a service from the live pack: ref as explicit `NewEntryInput.id`, human label, empty content | 4 |
| a10 | Persist per-agent selection under the EXISTING `entries:tool`/`toolsEnabled` keys only, master-gated | 4 (the shipped entry layer; proven 5) |
| a11 | Ride the wire as opaque strings — zero MCP knowledge in `@agent-ui/app`, `#enabledToolIds` untouched | 3 (fence), proven 5 |
| a12 | Track registry churn with zero store edits (a ref widens/narrows per boot; a pinned id tracks itself) | 1, proven 5 |
| a13 | Complete every degrade rung as a served turn — master off · unknown ref · unprovisioned key · MCP-less host | 1, proven 5 |
| a14 | Repair every record this build falsifies in the same change (#787's three checkboxes) | 6 |

**Coverage check (both directions):** every action a1–a14 names ≥1 part; every part 1–6 hosts ≥1
action (1: a1/a2/a3/a4/a12/a13 · 2: a5/a6 · 3: a7/a8/a11 · 4: a6/a9/a10 · 5: a10–a13's proofs ·
6: a14). No orphan part, no unhomed action. Deliberately ABSENT actions are the SPEC's §8
Non-goals, not gaps: transport/discovery redesign, roster-editing UI, per-tool parameter
authoring, Worker rollout, subtraction grammar, authoring suppression for the tool kind, any new
kind/key/schema field.

## 3 · Slices (independently shippable; each executable from its enumerated inputs alone)

Standing DoD every slice inherits: `npm run check && npm test` green by exit code · no diff to
the §0 frozen list · no key value/endpoint/`envKey` fact in any browser-bound byte or fixture
(SPEC-N3) · one writer per file.

- **S1 — grammar + expansion + the `*`-skip, WITH the wire-law record repairs (#787-1, #787-2).**
  *Traces:* SPEC-R2 AC1/AC2 · SPEC-R3 AC1/AC2 · SPEC-N2. *Size: medium.*
  *Does:* NEW `tools/agent/integrations/service-ref.ts` (+ test — the AC1 vector set + the
  behavioral charset-parity trip-wire, LLD §3.1/§5.1); `registry.ts` — NEW pure `resolveAgainst`
  export, `resolveIntegrations` delegating (signature unchanged), `MAX_RESOLVED = 64` +
  truncation warn (LLD §3.2), `registry.test.ts` fabricated-array cases; `mcp/discover.ts` — the
  ONE per-tool `*`-name skip (reason `` `reserved tool name "*"` ``) + its `discover.test.ts`
  case. SAME CHANGE (SPEC-N2 — this slice's registry diff is what falsifies the records):
  [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) v0.14 → v0.15 — SPEC-R23's and
  SPEC-R28's *"the enablement wire stays `integrations: string[]` of registry `id`s"* sentences
  each gain the ADR-0185 delta (…— widened by ADR-0185: a member may also be a service reference
  `mcp:<server-id>:*`, expanded server-side; the contract lives in `mcp-agent-config.spec.md`
  SPEC-R2/R3), plus the v0.15 changelog line, append-only discipline · the
  `agent-ui-integration-standards` skill's Admin-surfacing law line (*"the enablement wire
  itself stays `integrations: string[]` of ids, unchanged"*) repoints to the widened grammar,
  citing ADR-0185.
  *Does NOT:* touch the proxy routes, any site file, or any `app/` file; edit ADR-0168/0177
  (their clauses stand for their arcs — ADR-0185 IS the amendment record).
  *Inputs:* the SPEC · ADR-0185 · LLD §3.1/§3.2 · shipped `registry.ts`/`discover.ts`.
  *DoD:* standing gates + tick #787's first two checkboxes in a dated comment.
- **S2 — the `services` array on the host GET.**
  *Traces:* SPEC-R4 AC1/AC2. *Size: small.* *Depends: S1 (imports `serviceRef`/`serviceRefPrefix`).*
  *Does:* `dev-proxy-plugin.ts` — NEW `projectServiceRows` export (LLD §3.2's exact row grammar +
  description copy), the GET body widened to `{ integrations, services }`, factory opts gaining
  test-only `mcpRoster?` (the `mcpDiscovery` precedent); NEW
  `src/live-agent/mcp-services-get.test.ts` (own module graph, LLD §5.4): the two-fake-server
  route case (two rows, grammar, whole-body secret-free assertion, `integrations` byte-identical
  to its pre-SPEC projection) + the empty-roster `services: []` case + `projectServiceRows` unit
  cases over fabricated arrays.
  *Does NOT:* touch the ready-gate lines, `mcp-boot.test.ts`, `worker/`, or any browser file.
  *Inputs:* S1 merged · LLD §3.2 · shipped `dev-proxy-plugin.ts` + the `chat-route.test.ts`
  mount-harness precedent.
- **S3 — the per-pack `rejectOnCollision` widening (parallel-safe with S1/S2).**
  *Traces:* SPEC-R6 AC1 (slice-grain)/AC2. *Size: small-medium.*
  *Does:* `entry-data.ts` — `EntryLibraryPack.rejectOnCollision?` (LLD §3.3's doc comment);
  `entry-list.ts` — picker-disable honors kind-level OR pack-level, select handler forwards the
  pack flag as `onAdd`'s NEW optional second argument; `agent-admin.ts` — `#makeSection`'s
  `onAdd` merges `isCatalog || context?.rejectOnCollision === true` into the ONE
  `validateNewEntry` call. Tests (app-package, NON-mcp ids only — LLD §5.3): a flagged pack's
  duplicate add rejected visibly + store unchanged; its colliding row picker-disabled; every
  unflagged pack byte-identical (the GH #564 additive-options law re-proven at pack grain);
  `validateNewEntry` itself untouched.
  *Does NOT:* name MCP anywhere (identifier, string, or test literal); touch `validateNewEntry`,
  `ENTRY_KINDS`, `agentConfigSchema()`, or `#enabledToolIds`.
  *Inputs:* LLD §3.3 · shipped `entry-data.ts`/`entry-list.ts`/`agent-admin.ts`.
  *DoD:* standing gates + `npm run test:browser` (app files touched) + `grep -ri mcp
  packages/agent-ui/app/src` exits non-zero (no matches) + FILE the Integrations-pack
  suffix-dedup collision-flag follow-up as its own GitHub issue (SPEC §9.3 / LLD §6.6 — this
  slice lands the vehicle; the filing is what keeps the booked defect from evaporating when
  the arc closes).
- **S4 — the MCP-services pack + live plumbing, WITH the page/skill repairs (#787-3).**
  *Traces:* SPEC-R5 AC1/AC2 · SPEC-R1 (by construction) · SPEC-N2. *Size: medium.*
  *Depends: S2 (the served `services` shape) + S3 (the pack flag).*
  *Does:* `site/lib/admin-live-runner.ts` — `fetchLiveServices` + `LiveServiceRow` (LLD §3.4's
  degrade law; its test file's fetch-boundary legs mirror the `fetchLiveIntegrations` suite);
  `site/pages/agent-admin-libraries.ts` — `setLiveServices`, `MCP_SERVICES_PACK`
  (`rejectOnCollision: true`, entries getter, empty content), the `ADMIN_LIBRARIES` tool-key
  GETTER (pack absent ⇔ `undefined` — LLD §3.4), `INTEGRATIONS_PACK` hoisted byte-identical;
  `site/pages/agent-admin-app.ts` — the sibling fetch/set calls before the one
  `admin.libraries` reassignment; `agent-admin-app.test.ts` — SPEC-R5 AC1 both directions +
  AC2's visible rejection. SAME CHANGE (#787-3): `site/pages/agent-schema.ts` gains its
  MCP-services pointer (the entry layer's tool kind carries service refs — cite
  `mcp-agent-config.spec.md` SPEC-R1/R2, point at the pack; derived-not-transcribed posture
  preserved) · the `agent-admin-library-kinds` skill gains the `mcp-services` pack row (the
  §1 roster table's library-pack join point) citing the shipped symbols.
  *Does NOT:* add a static service fallback (no roster exists to mirror — SPEC-R5); flip the
  Integrations pack's own collision flag (SPEC §9.3, not built); touch `FLAVORED_PACK_CATEGORY`
  (generic by absence); file any new store key.
  *Inputs:* S2 + S3 merged · LLD §3.4 · shipped `agent-admin-libraries.ts`/`admin-live-runner.ts`.
  *DoD:* standing gates + `npm run test:browser` + tick #787's third checkbox (dated comment);
  with S1's two, #787 is fully ticked → close it citing both PRs.
- **S5 — turn-time proofs + the arc fences (serial-last).**
  *Traces:* SPEC-R7 AC1/AC2 · SPEC-R1 AC1/AC2 · SPEC-R3 AC3 · SPEC-R6 AC1 (arc-grain). *Size: medium.*
  *Depends: S1 functionally; LAST by role — it grades the whole arc's diffs.*
  *Does:* NEW `src/live-agent/mcp-enablement.test.ts` (own module graph — LLD §5.4): both POST
  arms driven through injected `mcpRoster` + an `mcpDiscovery` registering fabricated `mcp:*`
  manifests via the real `registerIntegration`; the SPEC-R7 AC1 churn case (append one manifest
  between turns, next turn's tool defs widen, store byte-identical); the full degrade ladder
  (LLD §5.5), every rung a completed turn. `site/pages/agent-admin-app.test.ts` — SPEC-R1 AC2's
  master-switch MCP-id case (SITE layer, never `app/` — LLD §5.3's placement trap). Arc-fence
  assertions recorded in the PR: empty `git diff` over the §0 frozen list at HEAD ·
  `agent-schema.test.ts` + the shipped SPEC-R16–R19/R23–R28 suites pass unmodified · the
  SPEC-R6 grep, exit-code judged.
  *Does NOT:* modify any shipped suite; touch `mcp-boot.test.ts`; add production code (test-only
  slice — any behavior gap it finds is a handback to the owning slice, never a local patch).
  *Inputs:* S1–S4 merged · LLD §5.
  *DoD:* standing gates; the tracker's dated Findings comment stating the arc's ACs all proven.

## 4 · Open forks

None. ADR-0185 (the one genuine fork, recorded at SPEC time) is ACCEPTED — every slice above
builds inside ratified law. Two carried notes, neither blocking: SPEC §9.2 (fakes-only
provability until a real server enters the roster — Kim's later call, on the issue) and SPEC
§9.3 (the Integrations pack's pre-existing suffix-dedup phantom — S3 lands the fix vehicle only;
its own filing decides the flip). If S3's `onAdd` context argument is judged to reopen ADR-0164
cl.3 (LLD §6.1's stated reading says it does not), that is a blocked handback, not a quiet
reinterpretation.

## 5 · Dependency order (dispatchable)

```
S1 (grammar+expansion+skip, #787-1/2) ──→ S2 (services GET) ──┐
S3 (per-pack rejectOnCollision, ∥ with S1/S2) ────────────────┼──→ S4 (pack+plumbing, #787-3) ──→ S5 (proofs+fences)
                                          S1 ─────────────────┴──────────────────────────────────↗
```

Every edge is a real input dependency: S2 imports S1's `serviceRef` composer; S4 consumes S2's
served shape AND S3's pack flag; S5 grades everything so it goes last (its functional dependency
is S1 alone — a builder may draft it early but it merges last). S1 ∥ S3 are file-disjoint
(`tools/agent/` vs `app/src/`). One writer per file holds throughout: `dev-proxy-plugin.ts` is
S2's alone; `agent-admin-app.test.ts` is touched by S4 then S5, SERIALIZED by their edge; only
S1 touches the two repair records it carries, only S4 the two it carries.

## 6 · Recommended first dispatch

**S1 and S3 in parallel** (disjoint files, no shared inputs). S1 first if serializing — it is
the arc's contract-bearing slice (the ADR-0185 grammar made executable + the falsified records
repaired in the same change), and S2/S5 both key off its exports.
