# Shared dispatch and code-placement law (laws 4–5)

Source of record: ADR `.claude/docs/adr/0168-integration-manifest-registry-validated-dispatch-server-keys.md`
(accepted 2026-08-04) and SPEC `.claude/docs/spec/a2ui-live-agent.spec.md` §3.6 (SPEC-R19). This
file states the laws; the cited requirement ids/symbols are the authority — Grep them in the live
spec/source and re-derive there, never from a peer's quote. ADR line numbers are frozen records
(ratified, unrevised) and stay pinned by line. SPEC citations here are requirement-id +
section-number anchors (`SPEC-R19 §3.6`, etc.), not absolute line numbers, precisely because the
spec's line count grows across versions (verified stable v0.13→v0.17) — an anchor never goes stale
on a spec bump, so there is nothing to repair here on drift. Code line cites still drift on refactor
— verify with Grep before trusting one.

## 4 · ONE shared dispatch on both live arms

Both routes — prose `/chat` AND produce — in both hosts build tool wiring through the same
`buildToolDispatch` (`tool-dispatch.ts:50`; callers `dev-proxy-plugin.ts:328,399` and
`worker/index.ts:184,268`). Per-route or per-host dispatch forks are the GH #402 defect class
(a toggle silently inert on one arm) — new arms consume the shared builder, never re-implement
validate→key→execute. An absent `integrations` field keeps a request byte-identical to the
pre-0168 shape. *(ADR-0168 cl.5 :86-97 · SPEC-R19 §3.6)*

## 5 · Where things live — the ADR-0137 shell law

Registry, manifests, validator, and dispatch are site-internal in
`packages/agent-ui/a2ui/tools/agent/integrations/` (anchor: `registry.ts` there — the shipped
pattern to copy for a new manifest). The portable `src/agent/` core stays types-only/zero-dep:
it carries the `ToolDef`/`ExecuteTool` seam, never key handling, registry code, or executors.
*(ADR-0168 preamble :48-50 · SPEC-N1 §4 · ADR-0137)*
