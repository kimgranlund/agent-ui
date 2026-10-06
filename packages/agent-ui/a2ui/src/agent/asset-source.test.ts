// asset-source.test.ts: `readAsset`/`listAssets` over the committed `assets.gen.ts`. The on-disk listings
// are read with `node:fs` (allowed in tests) so the embedded directory view is held to the real tree.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { AgentAssetError, listAssets, readAsset } from './asset-source.ts'

declare const process: { cwd(): string }
const SRC = `${process.cwd()}/packages/agent-ui/a2ui/src`

describe('asset-source', () => {
  it('readAsset returns the embedded text of a known key, byte-equal to the file', () => {
    const text = readAsset('agent/prompts/grammar.md')
    expect(text.length).toBeGreaterThan(0)
    expect(text).toBe(readFileSync(`${SRC}/agent/prompts/grammar.md`, 'utf8'))
  })

  it('readAsset throws AgentAssetError naming the regen script on an unknown key', () => {
    expect(() => readAsset('agent/prompts/no-such-prompt.md')).toThrow(AgentAssetError)
    expect(() => readAsset('agent/prompts/no-such-prompt.md')).toThrow(/generate-agent-assets\.mjs/)
    try {
      readAsset('agent/prompts/no-such-prompt.md')
    } catch (e) {
      expect((e as Error).name).toBe('AgentAssetError')
    }
  })

  it('listAssets(mini-skills) equals the sorted on-disk .md names', () => {
    const onDisk = readdirSync(`${SRC}/agent/prompts/mini-skills`)
      .filter((n) => n.endsWith('.md'))
      .sort()
    expect(onDisk.length).toBeGreaterThan(0)
    expect(listAssets('agent/prompts/mini-skills')).toEqual(onDisk)
  })

  it('listAssets(agent/prompts) lists each subdirectory once', () => {
    const names = listAssets('agent/prompts')
    expect(names.filter((n) => n === 'mini-skills')).toHaveLength(1)
    expect(names.filter((n) => n === 'genui-packs')).toHaveLength(1)
    expect(names).toEqual([...names].sort())
  })

  it('listAssets(catalog/personas) lists the three persona folders', () => {
    expect(listAssets('catalog/personas')).toEqual(['concierge', 'croupier', 'fixture-demo'])
  })

  it('listAssets throws AgentAssetError when nothing lies under the key', () => {
    expect(() => listAssets('agent/no-such-dir')).toThrow(AgentAssetError)
    // A key prefix that is not a whole segment never matches (`agent/prompt` is not `agent/prompts`).
    expect(() => listAssets('agent/prompt')).toThrow(AgentAssetError)
  })
})
