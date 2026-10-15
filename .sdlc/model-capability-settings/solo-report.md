T-0185 solo L2, branch chore/model-capability-settings, commits d74706cf 14f69cc6 56c812f6 737148c9 88eb77de (local only, not pushed).

Changed: a2ui `src/agent/model-capabilities.ts` (new, the table, docs URLs cited; exported as `./agent/model-capabilities`), `providers/anthropic.ts` (buildRequestBody reads the table), `agent-transport.ts`, `produce.ts`, `tools/agent/dev-proxy-plugin.ts`, `tools/agent/worker/index.ts`, `providers.json` (+claude-opus-5-5), `prompts/authoring-teaching.md` + `assets.gen.ts`; app `agent-admin-schema.ts` (generated Model section, resolvers, temperature removed), `agent-admin.ts`, `persona-patch.ts`, `field-location.ts`; site presets, runner, schema page; tests; docs (agent-admin.md, a2ui AGENTS.md, agent-model and agent-content specs, agent-model reference).

Checks:
- `npm run check` exit 0
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/model-capabilities.test.ts packages/agent-ui/a2ui/src/live-agent/anthropic-request-body.test.ts` exit 0
- `npx vitest run --project site site/pages/agent-admin-app.test.ts site/pages/agent-admin-presets.test.ts site/pages/agent-admin-persona-file.test.ts site/pages/agent-schema.test.ts site/lib/team-agent-card.test.ts` exit 0
- `npx vitest run --project packages packages/agent-ui/app/src/controls/agent-admin` exit 0
- `npm run e2e:admin` exit 0 (25 passed)
- a2ui live-agent folder exit 0; baseline recapture left the golden file unchanged.

Live probes (no key in lane; conductor runs under `npm run dev`, ANTHROPIC_WORKSPACE_ID path untouched):
`curl -N localhost:5173/__a2ui/agent/chat -H 'content-type: application/json' -d '{"system":"Be brief.","model":"<M>","messages":[{"role":"user","content":"Why is the sky blue? Think first."}],"effort":"medium","modelSettings":{"display":"summarized"}}'` with M = claude-haiku-5-5, claude-sonnet-5-5, claude-opus-5-5. Opus 5.5 is in providers.json but not in SUPPORTED_MODELS (rev.4 roster ruling), so its probe is proxy-only.

Open:
- blocked: plan defect: scope. 3b composer split ("Thinking off" in the effort menu, show-reasoning toggle, web search and fetch toggles), server tools in the request body (table lists them, nothing sends them), the mid-conversation `output_config` beta header, and the Model section screenshot are not built.
- Opus 4.8 and Fable 5 rows are filled from pre-table behavior, not docs.
- `meta-line.test.ts` and `produce-loop.test.ts` still use `temperature` as an opaque patch value (harmless).
- Behavior change: an explicit `low` effort on Sonnet now sends `output_config.effort: low` (before: nothing).

verify: needed
