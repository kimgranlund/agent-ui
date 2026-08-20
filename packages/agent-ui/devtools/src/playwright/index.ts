// @agent-ui/devtools/playwright — the types-only Playwright helper (ADR-0200 clause 6 / SPEC-R11;
// decomp n5): pure functions over a CONSUMER-supplied `Page`.
//
// TYPES-ONLY, delivered structurally: this module names NO playwright specifier at all — `HarnessPage`
// below is the structural slice of playwright's `Page` the helper drives (goto · click · fill ·
// waitForSelector · $eval · $$eval), and the real `Page` satisfies it (type-compat proven in
// `index.test.ts`, where playwright IS a repo devDependency). This is the stronger form of SPEC-R11's
// `import type`-only rule, and the one the package's own layering gate enforces (`layering.test.ts`
// check 1 admits only {a2ui, a2a, local} specifiers in shipped source): the module type-checks AND
// runs for a consumer with no playwright installed, while a playwright consumer passes their `Page`
// straight in. Playwright is never a runtime dependency (SPEC-R11 AC1).
//
// The selector list below IS the harness page's `data-devtools` hook list (SPEC-R8 AC3) — one list,
// two consumers (`site/pages/devtools-harness.ts` writes the hooks, this helper drives them),
// drift-gated by the harness page suites driving the REAL page through these exact selectors.

import { parseCapture } from '../capture/format.ts'
import type { DevtoolsCapture } from '../capture/format.ts'
import type { DevtoolsEvent } from '../timeline/events.ts'
import type { BackendId } from '../transports/backends.ts'

/** The structural slice of playwright's `Page` the helper needs — the real `Page` satisfies it
 *  (type-compat test in `index.test.ts`); any object with these six members works (the jsdom-backed
 *  fake in the site suite is the second prover). Functions passed to `$eval`/`$$eval` execute in the
 *  BROWSER context under real playwright — they are self-contained arrows, no closure over imports. */
export interface HarnessPage {
  goto(url: string): Promise<unknown>
  click(selector: string): Promise<unknown>
  fill(selector: string, value: string): Promise<unknown>
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>
  $eval<R>(selector: string, fn: (element: Element) => R): Promise<R>
  $$eval<R>(selector: string, fn: (elements: Element[]) => R): Promise<R>
}

/** The page's stable DOM hooks (SPEC-R8 AC3) — the ONE selector list this helper and the harness page
 *  share; every function below drives only these. */
export const HARNESS_SELECTORS = {
  status: '[data-devtools="status"]',
  backend: (id: BackendId | string): string => `[data-devtools="backend"][data-backend-id="${id}"]`,
  backendActive: (id: BackendId | string): string => `[data-devtools="backend"][data-backend-id="${id}"][data-active="true"]`,
  composerEditor: '[data-devtools="conversation"] ui-conversation-composer [data-part="editor"]',
  composerSend: '[data-devtools="conversation"] ui-conversation-composer [data-part="send"]',
  timelineEvents: '[data-devtools="timeline"] [data-devtools-event]',
  verdictOk: (surfaceId: string): string => `[data-devtools="verdict"][data-surface-id="${surfaceId}"][data-ok="true"]`,
  exportButton: '[data-devtools="export"]',
  downloadButton: '[data-devtools="download"]',
  captureOutput: '[data-devtools="capture-output"]',
} as const

export const HARNESS_PAGE_PATH = '/devtools-harness.html'

/** Navigate to the harness page under `baseUrl` and wait for its status hook (page ready). */
export async function openHarness(page: HarnessPage, baseUrl: string): Promise<void> {
  await page.goto(`${baseUrl.replace(/\/$/, '')}${HARNESS_PAGE_PATH}`)
  await page.waitForSelector(HARNESS_SELECTORS.status)
}

/** Select a backend row and wait for the switcher to reflect it (`data-active` — SPEC-R2 AC1's one
 *  construction-site swap, observed from outside). */
export async function selectBackend(page: HarnessPage, id: BackendId): Promise<void> {
  await page.click(HARNESS_SELECTORS.backend(id))
  await page.waitForSelector(HARNESS_SELECTORS.backendActive(id))
}

/** Read the status hook's turn bookkeeping — `waitForTurnEnd`'s poll target. */
export async function readTurnState(page: HarnessPage): Promise<{ turnState: string; turnCount: number }> {
  return page.$eval(HARNESS_SELECTORS.status, (el) =>
    el instanceof HTMLElement
      ? { turnState: el.dataset.turnState ?? '', turnCount: Number(el.dataset.turnCount ?? '0') }
      : { turnState: '', turnCount: 0 },
  )
}

/**
 * Type into the reused conversation composer and send — one turn. Returns the turn count BEFORE the
 * send, the `since` baseline `waitForTurnEnd` disambiguates consecutive turns with.
 */
export async function postTurn(page: HarnessPage, text: string): Promise<number> {
  const { turnCount } = await readTurnState(page)
  await page.fill(HARNESS_SELECTORS.composerEditor, text) // playwright fill drives contenteditable
  await page.click(HARNESS_SELECTORS.composerSend)
  return turnCount
}

/** Wait until the harness reports idle with MORE completed turns than `since` (default 0 — the
 *  first-turn case needs no baseline). Throws past `timeoutMs` — a hung turn is a loud failure. */
export async function waitForTurnEnd(page: HarnessPage, opts?: { since?: number; timeoutMs?: number }): Promise<void> {
  const since = opts?.since ?? 0
  const deadline = Date.now() + (opts?.timeoutMs ?? 10_000)
  for (;;) {
    const { turnState, turnCount } = await readTurnState(page)
    if (turnState === 'idle' && turnCount > since) return
    if (Date.now() > deadline) {
      throw new Error(`waitForTurnEnd: still ${turnState} at turnCount ${turnCount} (waiting for > ${since})`)
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

/** Read the whole rendered timeline pane back as typed events — one `JSON.parse` per NDJSON row
 *  (SPEC-R7's wire contract, read off the REAL page DOM). */
export async function readTimeline(page: HarnessPage): Promise<DevtoolsEvent[]> {
  const rows = await page.$$eval(HARNESS_SELECTORS.timelineEvents, (els) => els.map((el) => el.textContent ?? ''))
  return rows.map((row) => JSON.parse(row) as DevtoolsEvent)
}

/** Assert a surface REALLY rendered: waits for the page's own `data-ok="true"` verdict row (browser
 *  truth, SPEC-R9). A surface that never rendered times out — the RED negative control (SPEC-R11 AC2). */
export async function expectRendered(page: HarnessPage, surfaceId: string, opts?: { timeoutMs?: number }): Promise<void> {
  await page.waitForSelector(HARNESS_SELECTORS.verdictOk(surfaceId), { timeout: opts?.timeoutMs ?? 10_000 })
}

/** Click Export and parse the capture the page wrote into its output box — a TYPED `DevtoolsCapture`
 *  (via `parseCapture`, the one format module), ready for `replayTransport`/a bundle. */
export async function exportCapture(page: HarnessPage): Promise<DevtoolsCapture> {
  await page.click(HARNESS_SELECTORS.exportButton)
  const text = await page.$eval(HARNESS_SELECTORS.captureOutput, (el) => (el instanceof HTMLTextAreaElement ? el.value : ''))
  return parseCapture(text)
}
