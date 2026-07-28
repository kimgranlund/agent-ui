// import-seeds.import-probe.mjs — GH #343 regression fixture, spawned as its own subprocess by
// import-seeds.test.ts. Its entire job is to IMPORT `import-seeds.ts` from a file whose name does not
// end in "import-seeds.ts" — the exact shape of "a test, a tooling script, a REPL" the issue names —
// so `process.argv[1]` (this file's own path) never satisfies the CLI-entry guard and `main()` must NOT
// fire. A dedicated fixture file (rather than inlining `node -e`) keeps the probe's own filename, and
// therefore its own non-match against the guard, explicit and durable.
await import(new URL('./import-seeds.ts', import.meta.url))
console.log('import-seeds.import-probe: import completed')
