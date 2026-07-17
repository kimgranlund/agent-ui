import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import * as core from './index.ts'
import { projectHighlight } from './core/project.ts'

declare const process: { cwd(): string }

// identity.test.ts (LLD-C10, SPEC-C3 AC2, SPEC-C9) — the identity gate: importing the `.` barrel registers
// NO custom element and installs NO global observer; the empty-registry projection is byte-level identical
// to a plain host-as-content ui-code. A structural note proves the wave touches NO file under
// packages/agent-ui/components (the identity root — ui-code itself is unchanged, ADR-0113).

describe('the identity gate — importing the core barrel registers nothing (LLD-C10)', () => {
  it('customElements.get("ui-markdown") is undefined after a core-only import', () => {
    expect(customElements.get('ui-markdown')).toBeUndefined()
  })

  it('customElements.get("ui-code") stays whatever the components package itself defined — the core never registers or redefines it', () => {
    // The core barrel imports nothing from @agent-ui/components (no side-effect import of controls/code);
    // if ui-code happens to be registered in this test's module graph, it was NOT this package's doing.
    const before = customElements.get('ui-code')
    void core.tokenize('x', 'ts') // exercise the core — still must not touch customElements
    expect(customElements.get('ui-code')).toBe(before)
  })

  it('the core barrel source installs no module-scope MutationObserver (grep — the structural absence)', () => {
    const src = readFileSync(`${process.cwd()}/packages/agent-ui/code/src/index.ts`, 'utf8') as string
    expect(src).not.toMatch(/new MutationObserver/)
  })

  it('core/*.ts installs no module-scope MutationObserver (grep across the core folder)', () => {
    const dir = `${process.cwd()}/packages/agent-ui/code/src/core`
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue
      const src = readFileSync(`${dir}/${f}`, 'utf8') as string
      expect(src, f).not.toMatch(/new MutationObserver/)
    }
  })
})

// The CodeMirror exception stays confined (ADR-0139 cl.8a) — the DEFAULT barrels (`.`, ./highlight,
// ./markdown) remain CodeMirror-free for any consumer not importing `./editor`. Source-text CM-freeness on
// the three barrels + the no-registration proof; the STATIC-graph proof that CM appears nowhere outside
// editor/cm-editor.ts is the separate editor/confinement.test.ts, and the tree-shake proof that `.` never
// re-exports a pack (now incl. ./editor) is barrels.test.ts.
describe('the default barrels stay CodeMirror-free — the ADR-0139 exception is opt-in (cl.8a)', () => {
  const PKG = `${process.cwd()}/packages/agent-ui/code`
  const CM_RE = /@codemirror\/|@lezer\//

  it('the `.`, ./highlight and ./markdown barrel sources reference no @codemirror/@lezer', () => {
    for (const rel of ['src/index.ts', 'src/highlight/index.ts', 'src/markdown/index.ts']) {
      const src = readFileSync(`${PKG}/${rel}`, 'utf8') as string
      expect(src, rel).not.toMatch(CM_RE)
    }
  })

  it('importing the core `.` barrel registers no ui-code-editor (the CM control is reachable ONLY via ./editor)', () => {
    // This test file imports `./index.ts` (the core barrel) but never `./editor.ts`; with per-file module
    // isolation, ui-code-editor is registered only if the core graph pulled it — it must not.
    expect(customElements.get('ui-code-editor')).toBeUndefined()
  })

  it('negative control: the CM matcher would catch a planted @codemirror reference in a barrel', () => {
    expect(`export { markdown } from '@codemirror/lang-markdown'`).toMatch(CM_RE)
  })
})

describe('the empty path is byte-identical (SPEC-C3 AC2 — the identity level)', () => {
  it('projectHighlight with an empty registry yields a single text node equal to the code, byte-level', () => {
    const host = document.createElement('ui-code')
    const code = 'npm run check && npm test'
    projectHighlight(host, code, 'shell')
    expect(host.childNodes.length).toBe(1)
    expect(host.childNodes[0].nodeType).toBe(Node.TEXT_NODE)
    expect(host.textContent).toBe(code)
    // `.innerHTML` entity-escapes text-node content (`&` -> `&amp;`) on serialization — that's the DOM
    // serializer, not a markup difference; the single-text-node + textContent checks above are the real
    // byte-identity proof. Confirm there is genuinely no ELEMENT markup (no tags) rather than re-asserting
    // the escaped string.
    expect(host.querySelectorAll('*').length).toBe(0)
  })
})

// Structural note (LLD-C10, "single-writer discipline") — NOT a runtime assertion: `packages/agent-ui/
// components` is touched by NO slice of this build. Verified at the build report via `git status`/`git
// diff` over that directory (a process-level check, not a testable runtime property — there is no file
// content here to assert against, only the absence of a diff). This package reaches `@agent-ui/components`
// only through its published subpaths (controls/text, controls/code, controls/table, descriptor) —
// layering.test.ts proves the import direction stays inward-only; it never WRITES into that package.
