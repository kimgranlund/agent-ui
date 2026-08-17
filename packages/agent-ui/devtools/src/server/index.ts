// @agent-ui/devtools/server — the dev-only HTTP orchestration seam (ADR-0200 clause 4 / SPEC-R6).
//
// `devtoolsHarnessPlugin()` lands with slice S3 (decomp n3b): an `apply: 'serve'` Vite plugin mounting
// `/__devtools` (GET /status · POST /turn → streamed application/x-ndjson `DevtoolsEvent` timeline ·
// GET/POST /captures · GET /captures/:id). Node/Vite specifiers are lawful under `src/server/**` ONLY
// (the a2ui `src/agent/` node-fence precedent) — the `.` barrel never imports this subpath.

export {}
