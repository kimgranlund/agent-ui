// site/pages/testing-guide.ts — the CONSUMER testing guide (GH #1047): how to test code that mounts
// agent-ui controls, without re-deriving the fleet's own harness from scratch. `@agent-ui/shared` exports
// `./testing/dialog-polyfill` (GH #1006); `.claude/skills/component-testing/SKILL.md` +
// `integration-standards/SKILL.md` were both read as candidate canonical sources for this page —
// `integration-standards` turned out to be scoped to ADR-0168's tool/integration-manifest laws, not
// testing, and carries nothing this page derives from (named here rather than silently dropped).
//
// DERIVE-FIRST, the getting-started.ts/traits-doc.ts precedent: the npm-script table is read from the
// real root package.json `scripts` map (Vite `?raw` + JSON.parse); the dialog-polyfill's subpath row,
// its own banner rationale, and every interface/function signature below are sliced VERBATIM out of the
// real `@agent-ui/shared/testing/dialog-polyfill.ts` source (this page's own brace-balanced extractors —
// the traits-doc.ts convention); the jsdom/browser vitest PROJECT names and the focus-timing isolation
// list's live file COUNT are read the same way straight out of `vitest.config.ts` / `vitest.browser.
// config.ts` — never hand-retyped, so a shard renamed/added/removed, a script renamed, or the polyfill's
// own contract changing shows up here with zero edits to this page (a genuine rename that breaks a
// marker throws at page-load, a real drift gate).
//
// What is hand-authored, flagged: the "why jsdom vs a real engine" framing prose (cited to
// component-testing/SKILL.md by path — soft staleness, the T6 discipline), the dialog-polyfill's
// "consumed by" list (grepped by hand 2026-08-17, no build-time "who imports this test-only module"
// derivation exists for a page Vite bundles — the same limitation traits-doc.ts's own consumer lists
// name), the runnable jsdom example (illustrative, mirrors the real shape every `*.test.ts` file in this
// repo opens with), and the ElementInternals/ARIA probe idiom (illustrative, cited by file:line to the
// real probe subclass this pattern is lifted from — `checkbox.test.ts`).
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { heading, tableHead, tableRow, textCell, codeCell } from '../lib/doc-page.ts'
import { codeBlock } from '../lib/code-block.ts'
import { el } from '../lib/specimens.ts'
import rootPkgRaw from '../../package.json?raw'
import sharedPkgRaw from '../../packages/agent-ui/shared/package.json?raw'
import dialogPolyfillSrc from '../../packages/agent-ui/shared/src/testing/dialog-polyfill.ts?raw'
import jsdomConfigRaw from '../../vitest.config.ts?raw'
import browserConfigRaw from '../../vitest.browser.config.ts?raw'

// ── local derivation helpers — used only on this page ───────────────────────────────────────────────────

/** The first N lines of a source file's own banner comment, verbatim — the file's own stated purpose. */
function bannerLines(source: string, n: number): string {
  return source
    .split('\n')
    .slice(0, n)
    .map((l) => l.replace(/^\/\/ ?/, ''))
    .join('\n')
}

/** Slice `export interface {name} { ... }` (its immediately preceding JSDoc comment included, if any)
 *  verbatim out of `source`, brace-balanced from the marker. Throws — a real build-time drift gate — if
 *  the interface has been renamed/removed. */
function extractInterfaceWithDoc(source: string, name: string): string {
  const marker = `export interface ${name} {`
  const markerIdx = source.indexOf(marker)
  if (markerIdx === -1) throw new Error(`testing-guide: interface "${name}" not found — renamed or removed?`)
  const docStart = source.lastIndexOf('/**', markerIdx)
  let depth = 0
  let i = markerIdx
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  return source.slice(docStart === -1 ? markerIdx : docStart, i).trim()
}

/** Slice an `export function {name}(…): ReturnType` signature — with its preceding JSDoc comment, if
 *  any — through the char right before its body's opening `{`, verbatim out of `source`. Throws if the
 *  function has been renamed/removed. */
function extractSignatureWithDoc(source: string, name: string): string {
  const marker = `export function ${name}(`
  const markerIdx = source.indexOf(marker)
  if (markerIdx === -1) throw new Error(`testing-guide: function "${name}" not found — renamed or removed?`)
  const docStart = source.lastIndexOf('/**', markerIdx)
  const bodyStart = source.indexOf('{', markerIdx)
  return source.slice(docStart === -1 ? markerIdx : docStart, bodyStart).trim()
}

/** Every `name: '…'` a vitest config's `test.projects[]` array declares, in source order — the real
 *  project list, not a hand-typed copy. Throws if none are found (an empty/broken scan can't pass silently). */
function extractProjectNames(configRaw: string): string[] {
  const names = [...configRaw.matchAll(/name:\s*'([\w-]+)'/g)].map((m) => m[1])
  if (names.length === 0) throw new Error('testing-guide: 0 vitest project names found — config shape changed?')
  return names
}

/** The live entry COUNT of `vitest.browser.config.ts`'s `FOCUS_TIMING_FILES` array — brace(bracket)-
 *  balanced from the marker, counting quoted-string entry lines. Throws if the marker is gone. */
function extractFocusTimingCount(configRaw: string): number {
  const marker = 'const FOCUS_TIMING_FILES = ['
  const start = configRaw.indexOf(marker)
  if (start === -1) throw new Error('testing-guide: FOCUS_TIMING_FILES marker not found — renamed or removed?')
  let depth = 0
  let i = start + marker.length - 1
  for (; i < configRaw.length; i++) {
    if (configRaw[i] === '[') depth++
    else if (configRaw[i] === ']') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  const body = configRaw.slice(start, i)
  return body.split('\n').filter((l) => /^\s*'[^']+',?\s*$/.test(l)).length
}

function para(...parts: (string | Node)[]): HTMLElement {
  const p = document.createElement('p')
  for (const part of parts) p.append(typeof part === 'string' ? document.createTextNode(part) : part)
  return p
}
function code(text: string): HTMLElement {
  const c = document.createElement('code')
  c.textContent = text
  return c
}
function link(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = href
  a.textContent = text
  return a
}
function listOf(items: readonly Node[]): HTMLElement {
  const ul = document.createElement('ul')
  for (const item of items) {
    const li = document.createElement('li')
    li.append(item)
    ul.append(li)
  }
  return ul
}

const { content } = mountPage({
  title: 'Testing guide',
  intro:
    'How to test code that mounts agent-ui controls: the two-layer harness (jsdom fast-loop vs. real-engine ' +
    'browser truth), the shared jsdom `<dialog>` stub every modal-surface control needs, when jsdom is not ' +
    'enough, and the ElementInternals/ARIA assertion idiom FACE controls require.',
})

content.append(
  pageLead(
    'agent-ui wires ARIA through ',
    code('ElementInternals'),
    ' rather than host attributes, and its modal surfaces (',
    code('ui-modal'),
    ' / ',
    code('ui-drawer'),
    ' / ',
    code('ui-command-modal'),
    ') sit on a real ',
    code('<dialog>'),
    '. Both of those choices mean jsdom — absent a small, shared stub — cannot fully exercise a page that ' +
      'mounts them. This page is that stub, plus the rest of the harness this repo’s own test suite runs, ' +
      'documented for a consumer testing their OWN code against the fleet.',
  ),
)

// ════════════════ 1 · The harness at a glance — DERIVED from package.json ════════════════
content.append(heading(2, 'The harness at a glance'))
content.append(
  para(
    'Read straight from the workspace root’s own ',
    code('package.json'),
    ' ',
    code('scripts'),
    ' map — a script renamed, added, or removed there updates this table with zero edits to this page.',
  ),
)
{
  interface PackageJsonScripts {
    readonly scripts: Record<string, string>
  }
  const pkg = JSON.parse(rootPkgRaw) as PackageJsonScripts
  const testScripts = Object.entries(pkg.scripts).filter(([k]) => k === 'test' || k.startsWith('test:'))
  if (testScripts.length === 0) throw new Error('testing-guide: 0 "test"/"test:*" npm scripts found in package.json')
  const table = document.createElement('table')
  table.append(tableHead('npm run …', 'Runs'))
  const tbody = document.createElement('tbody')
  for (const [name, command] of testScripts) tbody.append(tableRow(codeCell(name), textCell(command)))
  table.append(tbody)
  content.append(table)
}
content.append(
  el('p', { class: 'gs-note' }, [
    document.createTextNode(
      'Two SEPARATE vitest configs back this table: vitest.config.ts (jsdom, the "test"/"test:watch" rows — ' +
        'the fast inner loop) and vitest.browser.config.ts (real Chromium + WebKit via Playwright, every ' +
        '"test:browser:*"/"test:visual*" row). Both sections below read straight from those two files.',
    ),
  ]),
)

// ════════════════ 2 · jsdom — the fast inner loop ════════════════
content.append(heading(2, 'jsdom — the fast inner loop'))
content.append(
  para(
    'Verbatim from ',
    code('vitest.config.ts'),
    '’s own banner comment:',
  ),
)
content.append(codeBlock(bannerLines(jsdomConfigRaw, 8)))
{
  const names = extractProjectNames(jsdomConfigRaw)
  content.append(
    para(
      `${names.length} vitest projects share that one jsdom environment today (`,
      code(names.join(', ')),
      '), split by WHAT they test — the framework’s own suites, the docs site’s, plain-Node CLI scripts, ' +
        'and the site’s Worker-side tools — never by consumer vs. framework code. A consumer’s own test ' +
        'suite is exactly this shape: plain jsdom, no special config, run through the plain vitest CLI.',
    ),
  )
}
content.append(
  para(
    'A minimal example — mounting a real control and asserting on it, the same shape every ',
    code('*.test.ts'),
    ' file in this repo opens with (illustrative — the props-and-events probes in ',
    link('./checkbox-doc.html', 'ui-checkbox'),
    '’s own suite are the fuller reference):',
  ),
)
content.append(
  codeBlock(
    [
      "import { describe, it, expect } from 'vitest'",
      "import '@agent-ui/components/components' // registers ui-button (and every other ui-*)",
      '',
      "describe('my app renders a save button', () => {",
      "  it('mounts and reflects its label', () => {",
      "    const button = document.createElement('ui-button')",
      "    button.setAttribute('variant', 'solid')",
      "    button.textContent = 'Save'",
      '    document.body.append(button)',
      '',
      "    expect(button.textContent).toBe('Save')",
      "    expect(button.getAttribute('variant')).toBe('solid')",
      '  })',
      '})',
    ].join('\n'),
    'ts',
  ),
)

// ════════════════ 3 · the dialog polyfill — DERIVED from source ════════════════
content.append(heading(2, 'The dialog polyfill — @agent-ui/shared/testing/dialog-polyfill'))
{
  interface PackageJsonExports {
    readonly exports: Record<string, string>
  }
  const shared = JSON.parse(sharedPkgRaw) as PackageJsonExports
  const testingEntries = Object.entries(shared.exports).filter(([k]) => k.startsWith('./testing/'))
  if (testingEntries.length === 0) throw new Error('testing-guide: 0 "./testing/*" exports found in @agent-ui/shared/package.json')
  const table = document.createElement('table')
  table.append(tableHead('Subpath', 'Source'))
  const tbody = document.createElement('tbody')
  for (const [subpath, source] of testingEntries) tbody.append(tableRow(codeCell(`@agent-ui/shared${subpath.slice(1)}`), codeCell(source.replace(/^\.\//, ''))))
  table.append(tbody)
  content.append(table)
}
content.append(para('Verbatim from the module’s own header comment — why it exists:'))
content.append(codeBlock(bannerLines(dialogPolyfillSrc, 17)))
content.append(heading(3, 'The API — derived from source'))
content.append(codeBlock(extractInterfaceWithDoc(dialogPolyfillSrc, 'DialogCalls'), 'ts'))
content.append(codeBlock(extractSignatureWithDoc(dialogPolyfillSrc, 'installDialogPolyfill'), 'ts'))
content.append(codeBlock(extractSignatureWithDoc(dialogPolyfillSrc, 'dialogCallsOf'), 'ts'))
content.append(
  para(
    'Usage (illustrative — mirrors the real call at ',
    code('packages/agent-ui/components/src/controls/modal/modal.test.ts:21-23'),
    '):',
  ),
)
content.append(
  codeBlock(
    [
      "import { describe, it, expect, beforeAll } from 'vitest'",
      "import { installDialogPolyfill, dialogCallsOf } from '@agent-ui/shared/testing/dialog-polyfill'",
      '',
      'beforeAll(() => {',
      '  installDialogPolyfill() // no-op under a real engine — safe to call unconditionally',
      '})',
    ].join('\n'),
    'ts',
  ),
)
content.append(
  para(
    'Needed by any jsdom suite driving a control that opens a real ',
    code('<dialog>'),
    ' — ',
    link('./modal-doc.html', 'ui-modal'),
    ' · ',
    link('./drawer-doc.html', 'ui-drawer'),
    ' · ',
    link('./command-modal-doc.html', 'ui-command-modal'),
    ' — or any page/composition that mounts one. Repo-wide consumers today (grepped 2026-08-17, no ' +
      'build-time "who imports this test-only module" derivation exists for a page Vite bundles):',
  ),
)
content.append(
  listOf([
    para(code('packages/agent-ui/components/src/controls/modal/modal.test.ts')),
    para(code('packages/agent-ui/components/src/controls/drawer/drawer.test.ts')),
    para(code('packages/agent-ui/components/src/controls/command-modal/command-modal.test.ts')),
    para(code('packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts'), ' and ', code('agent-admin-authoring.test.ts')),
    para(code('site/lib/command-palette.test.ts')),
    para(code('site/pages/agent-admin-app.test.ts'), ' and ', code('agent-admin-app-drawer.test.ts')),
  ]),
)
content.append(
  para(
    'It never proves the REAL top-layer / focus-trap / Escape / backdrop behaviour — that stays the job of ' +
      'each control’s own ',
    code('*.browser.test.ts'),
    ' leg, next.',
  ),
)

// ════════════════ 4 · when jsdom isn't enough ════════════════
content.append(heading(2, 'When jsdom isn’t enough — the real-engine browser harness'))
content.append(
  para(
    'jsdom computes no real layout, has no ',
    code('@scope'),
    ' or ',
    code('light-dark()'),
    ' resolution, no real focus/keyboard timing, and no accessibility tree — a control’s per-part checks can ' +
      'all pass in jsdom while the rendered geometry, computed colour, or AX role is wrong. The full layer-by-' +
      'layer bar (what each layer proves, which exemplar to pattern from) is this repo’s own ',
    code('.claude/skills/component-testing/SKILL.md'),
    ' — cited here rather than restated, since it is internal contributor guidance this page is not the ' +
      'owner of.',
  ),
)
{
  const browserNames = extractProjectNames(browserConfigRaw)
  const focusCount = extractFocusTimingCount(browserConfigRaw)
  content.append(
    para(
      'The real-engine config (',
      code('vitest.browser.config.ts'),
      `) splits into ${browserNames.length} vitest projects today (`,
      code(browserNames.join(', ')),
      '), run as sequential shards (',
      code('npm run test:browser'),
      ', the table above) so no single process holds the whole module graph at once — never re-monolithed, ' +
        'per that config’s own load-bearing HEAP comment. One of those, ',
      code('focus-timing'),
      `, runs with ZERO file parallelism: ${focusCount} files today (a live count, read the same way as ` +
        'every other derived fact on this page) whose focus/keyboard/scroll-timing assertions flake under ' +
        'concurrent-page contention, not under a component regression.',
    ),
  )
}
content.append(
  para(
    'A control-touching suite of your own that asserts real rendered geometry, real focus movement, or a ' +
      'real accessibility role belongs in a ',
    code('.browser.test.ts'),
    ' file, run through ',
    code('npm run test:browser'),
    ' (or your own equivalent real-engine harness) — never simulated in jsdom.',
  ),
)

// ════════════════ 5 · the ElementInternals / ARIA assertion idiom ════════════════
content.append(heading(2, 'The ElementInternals / ARIA assertion idiom'))
content.append(
  para(
    'Every FACE control wires ARIA through a protected ',
    code('internals'),
    ' getter on the shared base class (',
    code('packages/agent-ui/components/src/dom/element.ts:285'),
    ') — never a host ',
    code('role'),
    '/',
    code('aria-*'),
    ' attribute. That is correct at runtime (the AX tree reads it either way) but means a jsdom assertion ' +
      'that only checks host attributes will find nothing: there is nothing there to find, by design.',
  ),
)
content.append(
  para(
    'To assert on it in jsdom, reach the protected field with a small probe subclass (illustrative — the ' +
      'real pattern this is lifted from: ',
    code('packages/agent-ui/components/src/controls/checkbox/checkbox.test.ts:33-41,94-100'),
    '):',
  ),
)
content.append(
  codeBlock(
    [
      "import { describe, it, expect } from 'vitest'",
      "import { UIButtonElement } from '@agent-ui/components/controls/button'",
      '',
      'class ProbeButton extends UIButtonElement {',
      '  /** Re-expose the protected `internals` so a probe can read role / aria-* state. */',
      '  get probeInternals(): ElementInternals {',
      '    return this.internals',
      '  }',
      '}',
      "customElements.define('ui-button-probe', ProbeButton)",
      '',
      "describe('my button carries the right accessible role', () => {",
      "  it('exposes role via internals, never a host attribute', () => {",
      '    const el = new ProbeButton()',
      '    document.body.append(el)',
      '',
      "    expect(el.probeInternals.role).toBe('button')",
      "    expect(el.getAttribute('role')).toBeNull() // FACE — ARIA via internals only",
      '  })',
      '})',
    ].join('\n'),
    'ts',
  ),
)
content.append(
  para(
    'jsdom’s ',
    code('ElementInternals'),
    ' surface is itself partial — form-association methods (',
    code('setFormValue'),
    ' / ',
    code('setValidity'),
    ') are absent, the same gap the dialog surface has, each control’s own suite stubs the same way (',
    code('checkbox.test.ts'),
    '’s ',
    code('stubFormAssoc'),
    '). The real, full ',
    code('ElementInternals'),
    ' contract — and the real computed AX role a screen reader sees — is only ever true in the browser ' +
      'harness above.',
  ),
)
