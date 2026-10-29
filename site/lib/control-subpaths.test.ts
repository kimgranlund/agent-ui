// site/lib/control-subpaths.test.ts — T-0569: the getting-started per-control import list counts and labels only
// control module subpaths. The old filter kept every `./controls/*` key, so the `.css` sheet keys doubled the count
// and printed `// registers ui-{name}.css` lines.
import { describe, it, expect } from 'vitest'
import { controlModuleSubpaths } from './control-subpaths.ts'
import componentsPkgRaw from '../../packages/agent-ui/components/package.json?raw'

describe('controlModuleSubpaths', () => {
  it('drops .css sheet subpaths and non-control keys, sorted', () => {
    const map = {
      '.': './src/index.ts',
      './controls/button': './src/controls/button/index.ts',
      './controls/button.css': './src/controls/button/button.css',
      './controls/amount-picker': './src/controls/amount-picker/index.ts',
      './controls/amount-picker.css': './src/controls/amount-picker/amount-picker.css',
      './all.css': './src/all.gen.css',
    }
    expect(controlModuleSubpaths(map)).toEqual(['./controls/amount-picker', './controls/button'])
  })

  it('counts exactly the module keys of the real components exports map', () => {
    const exportsMap = (JSON.parse(componentsPkgRaw) as { exports: Record<string, unknown> }).exports
    const controlKeys = Object.keys(exportsMap).filter((k) => k.startsWith('./controls/'))
    const sheets = controlKeys.filter((k) => k.endsWith('.css'))
    const subpaths = controlModuleSubpaths(exportsMap)
    expect(sheets.length).toBeGreaterThan(0)
    expect(subpaths.length).toBe(controlKeys.length - sheets.length)
    expect(subpaths.some((s) => s.endsWith('.css'))).toBe(false)
    // each printed line would register a real ui-* tag, never `ui-{name}.css`
    expect(subpaths.map((s) => s.replace('./controls/', 'ui-')).every((t) => !t.includes('.'))).toBe(true)
  })
})
