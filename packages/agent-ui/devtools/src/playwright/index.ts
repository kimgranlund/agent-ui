// @agent-ui/devtools/playwright — the types-only Playwright helper (ADR-0200 clause 6 / SPEC-R11).
//
// Lands with slice S5 (decomp n5): pure functions over a CONSUMER-supplied `Page` (`openHarness` ·
// `selectBackend` · `postTurn` · `waitForTurnEnd` · `readTimeline` · `expectRendered` ·
// `exportCapture`). Playwright appears as `import type` ONLY (erased by `verbatimModuleSyntax`) —
// never a runtime dependency (SPEC-R11 AC1's grep gate lives in `../layering.test.ts`).

export {}
