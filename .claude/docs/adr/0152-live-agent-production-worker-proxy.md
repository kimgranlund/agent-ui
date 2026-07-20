# ADR-0152 — the live-agent overlay (`a2ui-chat`/`a2ui-live`/`agent-admin`/`agent-admin-app`) goes live in PRODUCTION via a Cloudflare Worker proxy — ADR-0136 Fork 1 and ADR-0131 cl.4/7's dev-only ruling are REVERSED for the deployed docs site, not merely narrowed

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-20
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-20 *(authored)* |
> | **Proposed by** | Kim's ask (2026-07-19/20 session): "walk me through how to add a subdomain ui-kit.nonoun.io for hosting agent-ui site pages," which grew — across the same session, each step explicitly directed — into "how do we host the LLM provider keys so we can access them on cloudflare," answered "build the live proxy endpoint too" over the narrower "just provision the secret" option, then an ultra code-review (xhigh effort) surfaced that this reverses ADR-0136 Fork 1's explicit rejection of exactly this architecture, and finally `/goal "finish and carefully review all this work while I sleep... make judgement calls"` directed the host to draft this supersession autonomously rather than leave it unrecorded. Every step Kim's own, escalating one decision at a time; this ADR is the host recording the accumulated decision, not originating it. |
> | **Ratified by** | _(unfilled — this is a `proposed` ADR; no self-ratification — the registered `adr-status-guard.py` hook blocks any agent flip to `accepted`)_ |
> | **Repairs** | `.claude/docs/spec/a2ui-live-agent.spec.md` (SPEC-R9/R10/N1/N2 — the build-time tree-shake guarantee narrows to a runtime-probe guarantee) · `.claude/docs/spec/a2ui-chat.spec.md` (SPEC-R8 AC1, same narrowing) · `site/lib/live-proxy-transport.ts`/`site/lib/admin-live-runner.ts`/`site/lib/provider-switcher.ts` (stale dev-only header claims) · `packages/agent-ui/a2ui/tools/agent/integrations.ts` (stale dev-only trust-boundary header claim) |
> | **Supersedes / Superseded by** | **Amends [ADR-0136](./0136-agent-admin-dev-only-live-model-overlay.md)** (Fork 1 explicitly RECOMMENDED dev-only and REJECTED "always-on live calls from the PUBLICLY DEPLOYED docs site" as "exactly the cost/abuse exposure ADR-0131 cl.4/7 was originally written to avoid" — this ADR ships that rejected alternative, with new mitigations Fork 1 didn't have available to weigh, see Decision cl.3 below) · **further narrows [ADR-0131](./0131-agent-admin-ui-scope-and-composition.md) cl.4/7** past ADR-0136's own narrowing (production/default path now DOES make an external call, gated by the mitigations below, not "the shipped docs site carries no key path, no live-call code at all"). Relates [ADR-0073](./0073-a2ui-live-model-provider-seam.md) (the trust boundary this preserves — the browser never holds a key — now enforced by a runtime `/status` probe + same-origin check instead of build-time tree-shaking), [ADR-0146](./0146-live-turn-lifecycle-progress-channel.md) (the progress-channel wire shape, reused verbatim by the Worker port), [ADR-0135](./0135-agent-harness-config-schema-and-prompt-files.md) (the prompt-file loading `system-prompt.ts`/`mini-skills.ts` this ADR ships unmodified into a Workers bundle via a build-time shim, never editing either file). Nothing else superseded. |

## Context

ADR-0136 Fork 1 considered this exact architecture — a live model call reachable from the publicly
deployed docs site — and rejected it in one sentence: "an unmetered, unauthenticated live chat endpoint
reachable by any site visitor is exactly the cost/abuse exposure ADR-0131 cl.4/7 was originally written to
avoid." That sentence was correct when written and remains correct as a description of what an
*unmitigated* always-on endpoint would be. What changed is not the risk calculus in the abstract — it's
that Kim asked for exactly this, across several explicit steps in one session (subdomain → "host the
keys on cloudflare" → "build the live proxy endpoint too," each a direct instruction, not a default this
ADR is retroactively justifying), and this build supplies three concrete mitigations ADR-0136 Fork 1 did
not have on the table when it recommended against the idea:

1. **A Cloudflare zone Rate Limiting Rule** scoped to the production hostname + the proxy's mount path
   (20 requests/60s per IP, verified live — 25 rapid requests returned exactly 20×200 then 5×429).
2. **A same-origin (CSRF) gate** on both POST routes, checking `Origin`/`Referer` — both browser-controlled,
   unspoofable by page JavaScript — against the one legitimate origin. Closes the specific "any page a
   visitor merely loads" attack ADR-0136 Fork 1's "any site visitor" language was really worried about:
   an anonymous visitor's OWN browser can reach the endpoint (that was always the design — the docs site's
   own live-agent demo pages are supposed to work for any visitor), but a THIRD-PARTY page can no longer
   silently trigger a call on that visitor's behalf.
3. **`workers_dev: false`** — the Worker is reachable ONLY at the custom domain the rate-limit rule
   protects, not also at an unthrottled `*.workers.dev` fallback (an early deploy of this same work
   briefly had this gap; caught and closed same-session, verified live).

None of this makes the endpoint "authenticated" in the sense of requiring a login — it remains reachable
by any visitor to the docs site, same as the recorded-backbone demo it upgrades. That is a DELIBERATE,
unchanged property: `a2ui-chat`/`a2ui-live`'s whole point is a real LLM demo any visitor can try. What
ADR-0136 Fork 1 was actually naming as the danger — unbounded cost from an uncoordinated abuse campaign,
or a drive-by cross-site trigger with no visible consent — is what the three mitigations above address.

The trust boundary ADR-0073 clause 5 established — the browser never holds a provider key — is UNCHANGED
and holds by the same mechanism family as before: a server-side proxy resolves the key and the browser
only ever sees a boolean `/status` response. What moved is WHERE that proxy runs (a Cloudflare Worker
instead of `vite dev`'s Node middleware) and WHEN the browser is allowed to reach it (always, instead of
only when `import.meta.env.DEV` is true, gated by the runtime mitigations above instead of a build-time
`vite build` tree-shake).

## Decision

**Ship a Cloudflare Worker port of `dev-proxy-plugin.ts` (`packages/agent-ui/a2ui/tools/agent/worker/`)
as the production live-agent proxy, mounted at `/__a2ui/agent` on the same Worker that serves the docs
site's static assets, reachable by every visitor — not gated behind a build-time flag.**

1. **The Worker reuses the dev proxy's trust-boundary chain verbatim, not a redesign.** Same three routes
   (`GET /status`, `POST /chat`, `POST /` — the full `produce()` loop), same `resolvePair`/
   `providerForModel`/`providerFor` PAIR-allowlist chain (SPEC-R12), same Anthropic adapter. The
   PAIR-allowlist validation helpers (`validateMode`/`isChatBody`/`resolveChatDispatch`) were extracted
   to a shared zero-dependency module (`tools/agent/chat-validation.ts`) so both transports import the
   SAME code rather than risking a silent fork between dev and production.
2. **`system-prompt.ts`/`mini-skills.ts` ship into the Workers bundle completely UNMODIFIED.** Both are
   ADR-cited (ADR-0090/0091/0135) and drift-gated (`prompt-drift.test.ts`); rather than touching either,
   their `node:fs` dependency is satisfied by aliasing `node:fs` (Wrangler's own documented module-aliasing
   feature) to a Worker-local shim backed by the same markdown source files, statically imported via a
   Wrangler Text module rule. Zero duplicated prompt-composition logic; zero risk of the prompt text
   drifting from its single source of truth.
3. **The mitigations named in Context are load-bearing, not incidental.** This ADR's ratification is
   conditioned on all three remaining in place: the Rate Limiting Rule, the same-origin/CSRF gate, and
   `workers_dev: false`. Removing any one of them without a replacement reopens exactly the exposure
   ADR-0136 Fork 1 named.
4. **The recorded-backbone default is unchanged and remains the fallback.** Every live-overlay page still
   defaults to `createRecordedTransport` (works offline, under CI, and whenever `/status` reports no
   provider configured) — this ADR widens WHEN the live path is reachable, it does not remove the
   deterministic default any consumer can still rely on.
5. **`agent-admin-app.ts` is brought into parity with `agent-admin.ts`.** Both pages drive the same
   `admin-live-runner.ts` backend; leaving one DEV-gated and the other not would be an unintentional,
   undocumented product inconsistency, not a considered scope boundary.

## Consequences

- ADR-0136 Fork 1's "dev-only, never the publicly deployed site" ruling no longer holds for
  `a2ui-chat.ts`/`a2ui-live.ts`/`agent-admin.ts`/`agent-admin-app.ts` — all four now probe the live proxy
  unconditionally and connect when a provider key is configured, in every environment.
- ADR-0131 cl.4/7's "no external runtime dependency" guarantee for the shipped docs site is narrowed
  further than ADR-0136 already narrowed it: the production path NOW makes an external call by design,
  gated by the mitigations in Context/Decision cl.3, not merely "a local `vite dev` session may."
- The trust boundary ADR-0073 clause 5 protects (browser never holds a key) is preserved, but its
  ENFORCEMENT MECHANISM changes from a `vite build` compile-time tree-shake (SPEC-R9 AC2/SPEC-N2, `grep
  dist/` returning zero hits) to a runtime `/status` probe + same-origin check. `.claude/docs/spec/
  a2ui-live-agent.spec.md` (SPEC-R9/R10/N1/N2) and `.claude/docs/spec/a2ui-chat.spec.md` (SPEC-R8 AC1) are
  living, versioned documents in this repo (each already carries a v0.1–v0.6 changelog trail) — updated
  in the SAME change as this ADR, not left stale, per this repo's own "a change that invalidates a record
  repairs that record in the same change" convention.
- `providers.json` (env-var NAMES + model labels — no secret values) is now present in the production
  client bundle wherever `provider-switcher.ts` mounts (whenever `/status` reports availability, in any
  environment) — a change from "leaves the production build entirely" to "ships, but carries no secret."
  `provider-switcher.ts`'s own header is corrected to match.
- `integrations.ts`'s outbound-fetch tool registry (weather/wikipedia/currency; fixed-host, sanitized
  inputs, no SSRF) now runs in the production Worker, not only `vite dev`'s node process — its header's
  dev-only trust-boundary claim is corrected; the underlying design (host-pinned, regex-validated inputs)
  was already safe for this exposure and needed no code change, only the doc correcting to match.

## Acceptance

- [x] The three mitigations (Rate Limiting Rule, same-origin/CSRF gate, `workers_dev: false`) are live
  and independently verified against the deployed Worker (not just unit-tested).
- [x] `npm run check && npm test` green.
- [x] The Worker's PAIR-allowlist logic is shared with `dev-proxy-plugin.ts` via `chat-validation.ts`, not
  duplicated (GH #108).
- [ ] SPEC-R9/R10/N1/N2 (`a2ui-live-agent.spec.md`) and SPEC-R8 (`a2ui-chat.spec.md`) updated in the same
  wave as this ADR (tracked alongside; see the Repairs cell).
- [ ] The four stale dev-only header claims (`live-proxy-transport.ts`, `admin-live-runner.ts`,
  `provider-switcher.ts`, `integrations.ts`) corrected in the same wave.
- [ ] Kim ratifies (`ratify ADR-0152`) — until then this remains `proposed`; the code it describes is
  already live (this ADR is documenting a shipped decision, not gating one still to build — the accepted
  pattern this repo already uses for e.g. ADR-0150, built and deployed same-session, ratified the
  following day).

## Alternatives considered

- **Leave ADR-0136 Fork 1's ruling standing and keep the production site on the recorded backbone only.**
  Rejected — Kim explicitly asked for the live proxy across multiple session steps; declining without
  surfacing the tension would have silently ignored a direct instruction rather than executing it with
  the mitigations that make it safe to do so.
- **Ship the Worker without the CSRF/rate-limit/workers_dev mitigations, matching ADR-0136 Fork 1's
  unmitigated framing exactly.** Rejected — that IS the specific exposure Fork 1 named; shipping it
  unmitigated would have been the reversal Fork 1 warned against, not a considered supersession of it.
- **Require a login/API key for the live overlay instead of leaving it visitor-reachable.** Rejected (for
  now) — nothing in Kim's ask asked for auth, and the docs site's live-agent pages are explicitly a
  public demo any visitor should be able to try; rate-limiting + CSRF-blocking address the cost/abuse
  exposure without changing that product intent. Revisit if abuse is observed despite the mitigations.
- **Silently ship the code without recording the ADR-0136 reversal at all.** Rejected — this repo's own
  convention (a change that invalidates a record repairs that record in the same change) and the
  ultra-review's own finding both named this explicitly; this ADR is that repair.
