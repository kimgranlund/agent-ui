// publish-packages.test.mjs — direct, cheap regression coverage for GH #69 item 3: `rewriteSpecifiers`
// (publish-packages.mjs) must rewrite ONLY real specifier positions (`from '...'`, bare `import '...'`,
// `require('...')`, CSS `@import '...'`/`@import url('...')`), never an arbitrary string literal that
// happens to contain `@agent-ui/<pkg>` text. Importing the module is safe — `main()` is guarded behind a
// direct-execution check (the module's own bottom-of-file comment) so this import never triggers a real
// build/publish.
import { describe, it, expect } from 'vitest'
import { rewriteSpecifiers, PACKAGE_ORDER } from './publish-packages.mjs'

describe('rewriteSpecifiers — scoped to real specifier positions (GH #69 item 3)', () => {
  it('rewrites a `from` import specifier (bare package)', () => {
    const out = rewriteSpecifiers(`import { X } from '@agent-ui/components'\n`, false)
    expect(out).toBe(`import { X } from '@agent-ui-kit/components'\n`)
  })

  it('rewrites a `from` import specifier (subpath)', () => {
    const out = rewriteSpecifiers(`import { X } from "@agent-ui/components/controls/text"\n`, false)
    expect(out).toBe(`import { X } from "@agent-ui-kit/components/controls/text"\n`)
  })

  it('rewrites a bare side-effect `import` specifier', () => {
    const out = rewriteSpecifiers(`import '@agent-ui/components/controls/button'\n`, false)
    expect(out).toBe(`import '@agent-ui-kit/components/controls/button'\n`)
  })

  it('rewrites an `export ... from` re-export specifier', () => {
    const out = rewriteSpecifiers(`export { Y } from '@agent-ui/shared'\n`, false)
    expect(out).toBe(`export { Y } from '@agent-ui-kit/shared'\n`)
  })

  it('rewrites a CSS @import specifier, bare and url()-wrapped', () => {
    const bare = rewriteSpecifiers(`@import '@agent-ui/shared/tokens.css';\n`, false)
    expect(bare).toBe(`@import '@agent-ui-kit/shared/tokens.css';\n`)
    const wrapped = rewriteSpecifiers(`@import url('@agent-ui/shared/tokens.css');\n`, false)
    expect(wrapped).toBe(`@import url('@agent-ui-kit/shared/tokens.css');\n`)
  })

  it('rewrites every PACKAGE_ORDER entry consistently', () => {
    for (const pkg of PACKAGE_ORDER) {
      const out = rewriteSpecifiers(`import '@agent-ui/${pkg}'\n`, false)
      expect(out, pkg).toBe(`import '@agent-ui-kit/${pkg}'\n`)
    }
  })

  it('NEGATIVE CONTROL — a string-literal survivor: a log/warning tag is left untouched, not just any @agent-ui/ text', () => {
    const src = `console.warn('[@agent-ui/icons] pack not found')\n`
    expect(rewriteSpecifiers(src, false)).toBe(src)
  })

  it('a specifier-shaped literal NOT preceded by from/import/require/@import is left untouched', () => {
    const src = `const DOC_LINK = "see @agent-ui/components in the README"\n`
    expect(rewriteSpecifiers(src, false)).toBe(src)
  })

  it('still rewrites a relative .ts import to .js inside .d.ts declarations only', () => {
    const dts = `import type { X } from './foo.ts'\n`
    expect(rewriteSpecifiers(dts, true)).toBe(`import type { X } from './foo.js'\n`)
    expect(rewriteSpecifiers(dts, false)).toBe(dts) // NOT declaration ⇒ untouched
  })

  it('a mixed file rewrites the real import but leaves an adjacent literal alone', () => {
    const src = `import '@agent-ui/router'\nconsole.log('tag: @agent-ui/router')\n`
    const out = rewriteSpecifiers(src, false)
    expect(out).toBe(`import '@agent-ui-kit/router'\nconsole.log('tag: @agent-ui/router')\n`)
  })
})
